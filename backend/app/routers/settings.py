import asyncio
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.auth import get_current_user
from app.database import get_db, engine
from app.encryption import encrypt_api_key
from app.models.user import User
from app.models.import_template import ImportTemplate
from app.models.import_session import ImportSession
from app.models.account import Account
from app.models.transaction import TransactionType
from app.schemas.settings import ApiKeyResponse, ApiKeyUpdate, TemplateResponse, TemplateUpdate, TemplateSaveAs, ReapplyResponse
from app.utils.file_parser import parse_file_data
from app.services.merge_engine import upsert_transactions, match_refunds
from app.services.task_manager import task_manager

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])

PRESET_TEMPLATES = [
    {
        "platform_name": "微信支付",
        "field_mapping": {
            "交易时间": "transaction_date",
            "交易类型": "source_category",
            "交易对方": "merchant_name",
            "商品": "description",
            "收/支": "type",
            "金额(元)": "original_amount",
            "当前状态": "transaction_status",
            "交易单号": "external_tx_id",
            "商户单号": "merchant_order_id",
            "备注": "remark",
        },
    },
]


async def seed_preset_templates(db: AsyncSession):
    """Ensure preset import templates exist in DB."""
    from app.models.import_template import ImportTemplate

    for pt in PRESET_TEMPLATES:
        result = await db.execute(
            select(ImportTemplate).where(
                ImportTemplate.is_preset == True,
                ImportTemplate.platform_name == pt["platform_name"],
            )
        )
        if result.scalar_one_or_none() is None:
            db.add(ImportTemplate(
                platform_name=pt["platform_name"],
                field_mapping=pt["field_mapping"],
                is_preset=True,
            ))
    await db.flush()


@router.get("/api-key", response_model=ApiKeyResponse)
async def get_api_key_status(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    return ApiKeyResponse(has_key=bool(user and user.api_key_encrypted))


@router.put("/api-key", response_model=ApiKeyResponse)
async def set_api_key(
    body: ApiKeyUpdate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not body.api_key.strip():
        raise HTTPException(status_code=400, detail="API Key cannot be empty")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.api_key_encrypted = encrypt_api_key(body.api_key.strip())
    await db.commit()

    return ApiKeyResponse(has_key=True)


@router.delete("/api-key", response_model=ApiKeyResponse)
async def delete_api_key(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.api_key_encrypted = None
    await db.commit()

    return ApiKeyResponse(has_key=False)


@router.get("/templates", response_model=list[TemplateResponse])
async def list_templates(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await seed_preset_templates(db)
    result = await db.execute(
        select(ImportTemplate)
        .where(
            (ImportTemplate.user_id == user_id) | (ImportTemplate.is_preset == True)
        )
        .order_by(ImportTemplate.updated_at.desc())
    )
    templates = result.scalars().all()
    return [TemplateResponse(
        id=t.id,
        platform_name=t.platform_name,
        field_mapping=t.field_mapping,
        is_preset=t.is_preset,
        created_at=t.created_at,
        updated_at=t.updated_at,
    ) for t in templates]


@router.put("/templates/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: str,
    body: TemplateUpdate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ImportTemplate).where(
            ImportTemplate.id == template_id,
            ImportTemplate.user_id == user_id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    template.platform_name = body.platform_name
    template.field_mapping = body.field_mapping
    await db.commit()
    await db.refresh(template)

    return template


@router.post("/templates/{template_id}/reapply", response_model=ReapplyResponse)
async def reapply_template(
    template_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify template exists
    result = await db.execute(
        select(ImportTemplate).where(ImportTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Find all completed sessions linked to this template
    result = await db.execute(
        select(ImportSession).where(
            ImportSession.template_id == template_id,
            ImportSession.status == "completed",
        )
    )
    sessions = result.scalars().all()

    if not sessions:
        return ReapplyResponse(task_id="", total_sessions=0)

    task_id = task_manager.create("reapply", len(sessions))
    asyncio.create_task(_run_reapply(task_id, user_id, sessions, template.field_mapping))

    return ReapplyResponse(task_id=task_id, total_sessions=len(sessions))


@router.post("/templates/save-as", response_model=TemplateResponse)
async def save_as_template(
    body: TemplateSaveAs,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check platform name doesn't conflict for this user
    existing = await db.execute(
        select(ImportTemplate).where(
            ImportTemplate.user_id == user_id,
            ImportTemplate.platform_name == body.platform_name,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Template '{body.platform_name}' already exists")

    template = ImportTemplate(
        user_id=user_id,
        platform_name=body.platform_name,
        field_mapping=body.field_mapping,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


async def _run_reapply(task_id: str, user_id: str, sessions: list[ImportSession], new_mapping: dict):
    """Background: re-parse files and re-upsert with new field_mapping."""
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    try:
        async with async_session() as db:
            total_created = 0
            total_updated = 0
            total_refunds = 0

            for idx, s in enumerate(sessions):
                field_mapping = new_mapping
                account_binding = s.account_binding or {}

                with open(s.file_path, "rb") as f:
                    content = f.read()

                headers, data_rows = parse_file_data(s.filename, content, s.header_row_index)

                # Find payment column
                payment_col = None
                for h in headers:
                    for kw in ["支付方式", "付款方式", "付款账户", "支付账户", "账户"]:
                        if kw in h:
                            payment_col = h
                            break
                    if payment_col:
                        break

                payment_col_idx = headers.index(payment_col) if payment_col and payment_col in headers else None

                # Get default account
                acc_result = await db.execute(
                    select(Account.id).where(Account.user_id == user_id, Account.is_active == True).limit(1)
                )
                default_acc_id = acc_result.scalar_one_or_none()

                records = []
                for row in data_rows:
                    rec = {}
                    for src_col, std_field in field_mapping.items():
                        try:
                            col_idx = headers.index(src_col)
                            if col_idx < len(row):
                                rec[std_field] = str(row[col_idx]).strip()
                        except ValueError:
                            continue

                    if "amount" in rec and "original_amount" not in rec:
                        rec["original_amount"] = rec.pop("amount")
                    if "currency" in rec and "original_currency" not in rec:
                        rec["original_currency"] = rec.pop("currency")

                    account_id = None
                    if payment_col_idx is not None and account_binding:
                        payment_val = str(row[payment_col_idx]).strip() if payment_col_idx < len(row) else ""
                        account_id = account_binding.get(payment_val)
                    if not account_id:
                        account_id = default_acc_id
                    if account_id:
                        rec["account_id"] = account_id

                    if "transaction_date" in rec:
                        try:
                            rec["transaction_date"] = datetime.fromisoformat(rec["transaction_date"])
                        except (ValueError, TypeError):
                            try:
                                rec["transaction_date"] = datetime.strptime(rec["transaction_date"], "%Y-%m-%d %H:%M:%S")
                            except (ValueError, TypeError):
                                rec["transaction_date"] = datetime.utcnow()

                    if "original_amount" in rec:
                        try:
                            rec["original_amount"] = Decimal(str(rec["original_amount"]).replace(",", "").replace("¥", ""))
                        except Exception:
                            rec["original_amount"] = Decimal("0")
                    if "base_amount" in rec:
                        try:
                            rec["base_amount"] = Decimal(str(rec["base_amount"]).replace(",", "").replace("¥", ""))
                        except Exception:
                            rec["base_amount"] = rec.get("original_amount", Decimal("0"))
                    elif "original_amount" in rec:
                        rec["base_amount"] = rec["original_amount"]

                    if "type" in rec:
                        try:
                            rec["type"] = TransactionType(rec["type"].lower())
                        except ValueError:
                            rec["type"] = TransactionType.EXPENSE

                    if "transaction_status" in rec and "退款" in str(rec.get("transaction_status", "")):
                        rec["type"] = TransactionType.REFUND
                    elif "source_category" in rec and "退款" in str(rec.get("source_category", "")):
                        rec["type"] = TransactionType.REFUND

                    if "account_id" not in rec:
                        continue

                    records.append(rec)

                result = await upsert_transactions(db, user_id, records)
                total_created += result["created"]
                total_updated += result["updated"]

                matched_refunds = await match_refunds(db, user_id)
                total_refunds += matched_refunds

                task_manager.update(task_id, idx + 1)

            task_manager.complete(task_id, {
                "created": total_created,
                "updated": total_updated,
                "matched_refunds": total_refunds,
            })
    except Exception as e:
        task_manager.fail(task_id, str(e))


@router.delete("/templates/{template_id}", status_code=200)
async def delete_template(
    template_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ImportTemplate).where(
            ImportTemplate.id == template_id,
            ImportTemplate.user_id == user_id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if template.is_preset:
        raise HTTPException(status_code=403, detail="Cannot delete preset template")
    await db.delete(template)
    await db.commit()
    return {"status": "ok"}
