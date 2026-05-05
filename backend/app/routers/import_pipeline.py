import json
import uuid
import os
import csv
import io
from datetime import datetime
from decimal import Decimal

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user
from app.config import settings
from app.models.import_template import ImportTemplate
from app.models.import_session import ImportSession
from app.models.account import Account
from app.models.transaction import TransactionType
from app.schemas.import_ import (
    UploadResponse, InferRequest, InferResponse,
    ConfirmRequest, ConfirmResponse, ExecuteRequest, ExecuteResponse,
    ExtractPaymentMethodsRequest, ExtractPaymentMethodsResponse,
    PaymentMethodSuggestion, AccountBrief, SaveBindingsRequest,
    AiMatchAccountsRequest, AiMatchAccountsResponse,
)
from app.utils.file_parser import find_header_row, parse_file_data, parse_file_preview
from app.utils.sanitizer import sanitize_for_ai
from app.services.ai_inference import infer_column_mapping, infer_account_matching
from app.services.merge_engine import upsert_transactions
from app.encryption import get_user_api_key

router = APIRouter(prefix="/api/v1/import", tags=["import"])

PAYMENT_KEYWORDS = ["支付方式", "付款方式", "付款账户", "支付账户", "账户"]


def _get_ext(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def _find_payment_column(headers: list[str], field_mapping: dict[str, str] | None = None) -> str | None:
    """Find which source column contains payment method info."""
    # First check if any mapped-to-standard-field column has payment keywords
    for i, h in enumerate(headers):
        for kw in PAYMENT_KEYWORDS:
            if kw in h:
                return h
    # Check unmapped columns (not in field_mapping) for payment keywords
    if field_mapping:
        for h in headers:
            if h not in field_mapping:
                for kw in PAYMENT_KEYWORDS:
                    if kw in h:
                        return h
    return None


def _fuzzy_match_account(method: str, accounts: list[Account]) -> tuple[str | None, str | None]:
    """Try to match a payment method name to an account. Returns (account_id, account_name)."""
    method_lower = method.lower().strip()
    for acc in accounts:
        acc_name_lower = acc.name.lower()
        # Direct substring match
        if method_lower in acc_name_lower or acc_name_lower in method_lower:
            return acc.id, acc.name
    # Keyword matching
    for acc in accounts:
        acc_name_lower = acc.name.lower()
        if "零钱" in method_lower and ("零钱" in acc_name_lower or "余额" in acc_name_lower):
            return acc.id, acc.name
        if "储蓄" in method_lower and "储蓄" in acc_name_lower:
            return acc.id, acc.name
        if "信用" in method_lower and "信用" in acc_name_lower:
            return acc.id, acc.name
    return None, None


@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()

    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 50MB)")

    filename = file.filename or "unknown"
    ext = _get_ext(filename)

    try:
        preview = parse_file_preview(filename, content, header_row_index=None, preview_rows=20)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot parse file: {str(e)}")

    file_id = str(uuid.uuid4())
    file_path = os.path.join(settings.UPLOAD_DIR, file_id)
    with open(file_path, "wb") as f:
        f.write(content)

    session = ImportSession(
        user_id=user_id,
        filename=filename,
        file_path=file_path,
        file_format=ext,
        status="uploaded",
        header_row_index=preview["header_row_index"],
        total_rows=preview["total_rows"],
        preview_rows={"headers": preview["headers"], "sample_rows": preview["sample_rows"]},
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    return UploadResponse(
        file_id=session.id,
        filename=filename,
        headers=preview["headers"],
        sample_rows=preview["sample_rows"],
        header_row_index=preview["header_row_index"],
        total_rows=preview["total_rows"],
    )


@router.post("/infer", response_model=InferResponse)
async def infer_mapping(
    body: InferRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ImportSession).where(
            ImportSession.id == body.file_id,
            ImportSession.user_id == user_id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    headers = session.preview_rows.get("headers", [])
    sample_rows = session.preview_rows.get("sample_rows", [])

    if not headers:
        raise HTTPException(status_code=400, detail="No headers found in session")

    # Only send headers + at most 3 sample rows to AI (enough for inference, keeps it fast)
    ai_sample_rows = sample_rows[:3]
    sanitized_sample = sanitize_for_ai([headers] + ai_sample_rows)
    sanitized_headers = sanitized_sample[0]
    sanitized_rows = sanitized_sample[1:]

    api_key = await get_user_api_key(db, user_id)
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="请先在设置页面配置 API Key",
        )

    try:
        ai_result = await infer_column_mapping(sanitized_headers, sanitized_rows, api_key)
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail=f"AI service error: {e.response.status_code} — {e.response.text[:300]}",
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Cannot reach AI service: {str(e)}",
        )
    except (json.JSONDecodeError, KeyError) as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to parse AI response: {str(e)}",
        )

    return InferResponse(
        field_mapping=ai_result.get("field_mapping", {}),
        confidence=ai_result.get("confidence", 0.0),
        notes=ai_result.get("notes", ""),
        prompt_sent=ai_result.get("prompt_sent", ""),
        raw_response=ai_result.get("raw_response", ""),
    )


@router.post("/confirm", response_model=ConfirmResponse)
async def confirm_mapping(
    body: ConfirmRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ImportSession).where(
            ImportSession.id == body.file_id,
            ImportSession.user_id == user_id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Save field_mapping to session
    session.field_mapping = body.field_mapping
    session.status = "parsed"

    # Save or update template
    tmpl_result = await db.execute(
        select(ImportTemplate).where(
            ImportTemplate.user_id == user_id,
            ImportTemplate.platform_name == body.platform_name,
        )
    )
    template = tmpl_result.scalar_one_or_none()

    if template:
        template.field_mapping = body.field_mapping
    else:
        template = ImportTemplate(
            user_id=user_id,
            platform_name=body.platform_name,
            field_mapping=body.field_mapping,
        )
        db.add(template)

    await db.flush()
    session.template_id = template.id
    await db.commit()
    await db.refresh(template)

    return ConfirmResponse(
        template_id=template.id,
        message=f"Template '{body.platform_name}' saved",
    )


@router.post("/extract-payment-methods", response_model=ExtractPaymentMethodsResponse)
async def extract_payment_methods(
    body: ExtractPaymentMethodsRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ImportSession).where(
            ImportSession.id == body.file_id,
            ImportSession.user_id == user_id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    headers = session.preview_rows.get("headers", [])
    field_mapping = session.field_mapping

    # Find payment method column
    payment_col = body.payment_column or _find_payment_column(headers, field_mapping)

    if not payment_col:
        return ExtractPaymentMethodsResponse(column_name="", methods=[])

    # Read file and extract unique payment methods
    with open(session.file_path, "rb") as f:
        content = f.read()

    all_headers, data_rows = parse_file_data(
        session.filename, content, session.header_row_index
    )

    # Find index of payment column
    try:
        col_idx = all_headers.index(payment_col)
    except ValueError:
        try:
            col_idx = headers.index(payment_col)
        except ValueError:
            return ExtractPaymentMethodsResponse(column_name=payment_col, methods=[])

    # Count occurrences
    counts: dict[str, int] = {}
    for row in data_rows:
        if col_idx < len(row):
            val = str(row[col_idx]).strip()
            if val:
                counts[val] = counts.get(val, 0) + 1

    # Get user's accounts for suggestions
    acc_result = await db.execute(
        select(Account).where(Account.user_id == user_id, Account.is_active == True)
    )
    accounts = acc_result.scalars().all()
    account_briefs = [AccountBrief(id=a.id, name=a.name, account_type=a.account_type.value) for a in accounts]

    # Build suggestions with fuzzy matching
    methods = []
    for method, count in sorted(counts.items(), key=lambda x: -x[1]):
        sug_id, sug_name = _fuzzy_match_account(method, accounts)
        methods.append(PaymentMethodSuggestion(
            payment_method=method,
            count=count,
            suggested_account_id=sug_id,
            suggested_account_name=sug_name,
            all_accounts=account_briefs,
        ))

    return ExtractPaymentMethodsResponse(column_name=payment_col, methods=methods)


@router.post("/save-bindings", status_code=status.HTTP_200_OK)
async def save_bindings(
    body: SaveBindingsRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ImportSession).where(
            ImportSession.id == body.file_id,
            ImportSession.user_id == user_id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.account_binding = body.bindings
    session.status = "binding_done"
    await db.commit()

    return {"status": "ok"}


@router.post("/ai-match-accounts", response_model=AiMatchAccountsResponse)
async def ai_match_accounts(
    body: AiMatchAccountsRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ImportSession).where(
            ImportSession.id == body.file_id,
            ImportSession.user_id == user_id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    headers = session.preview_rows.get("headers", [])
    field_mapping = session.field_mapping or {}

    # Find payment method column
    payment_col = _find_payment_column(headers, field_mapping)
    if not payment_col:
        return AiMatchAccountsResponse(matches={}, notes="No payment method column detected")

    # Read file and extract unique payment methods
    with open(session.file_path, "rb") as f:
        content = f.read()

    all_headers, data_rows = parse_file_data(
        session.filename, content, session.header_row_index
    )

    try:
        col_idx = all_headers.index(payment_col)
    except ValueError:
        try:
            col_idx = headers.index(payment_col)
        except ValueError:
            return AiMatchAccountsResponse(matches={}, notes="Payment column not found in file")

    counts: dict[str, int] = {}
    for row in data_rows:
        if col_idx < len(row):
            val = str(row[col_idx]).strip()
            if val:
                counts[val] = counts.get(val, 0) + 1

    # Get user's accounts
    acc_result = await db.execute(
        select(Account).where(Account.user_id == user_id, Account.is_active == True)
    )
    accounts = acc_result.scalars().all()

    if not accounts:
        return AiMatchAccountsResponse(matches={}, notes="No accounts configured")

    # Build input for AI
    payment_methods = [
        {"payment_method": method, "count": count}
        for method, count in sorted(counts.items(), key=lambda x: -x[1])
    ]
    account_dicts = [
        {"id": a.id, "name": a.name, "account_type": a.account_type.value}
        for a in accounts
    ]

    api_key = await get_user_api_key(db, user_id)
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="请先在设置页面配置 API Key",
        )

    try:
        ai_result = await infer_account_matching(payment_methods, account_dicts, api_key)
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail=f"AI service error: {e.response.status_code} — {e.response.text[:300]}",
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Cannot reach AI service: {str(e)}",
        )
    except (json.JSONDecodeError, KeyError) as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to parse AI response: {str(e)}",
        )

    return AiMatchAccountsResponse(
        matches=ai_result.get("matches", {}),
        notes=ai_result.get("notes", ""),
    )


@router.post("/execute", response_model=ExecuteResponse)
async def execute_import(
    body: ExecuteRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ImportSession).where(
            ImportSession.id == body.file_id,
            ImportSession.user_id == user_id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    field_mapping = session.field_mapping or {}
    account_binding = body.account_binding or session.account_binding or {}

    # Read and parse full file
    with open(session.file_path, "rb") as f:
        content = f.read()

    headers, data_rows = parse_file_data(
        session.filename, content, session.header_row_index
    )

    if not headers:
        raise HTTPException(status_code=400, detail="No headers found in file")

    # Determine payment method column for account binding
    payment_col = _find_payment_column(headers, field_mapping)
    payment_col_idx = headers.index(payment_col) if payment_col and payment_col in headers else None

    # Get default account (first active account)
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

        # Apply account binding
        account_id = None
        if payment_col_idx is not None and account_binding:
            payment_val = str(row[payment_col_idx]).strip() if payment_col_idx < len(row) else ""
            account_id = account_binding.get(payment_val)
        if not account_id:
            account_id = default_acc_id
        if account_id:
            rec["account_id"] = account_id

        # Date parsing
        if "transaction_date" in rec:
            try:
                rec["transaction_date"] = datetime.fromisoformat(rec["transaction_date"])
            except (ValueError, TypeError):
                try:
                    rec["transaction_date"] = datetime.strptime(rec["transaction_date"], "%Y-%m-%d %H:%M:%S")
                except (ValueError, TypeError):
                    rec["transaction_date"] = datetime.utcnow()

        # Amount parsing
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

        # Type parsing
        if "type" in rec:
            try:
                rec["type"] = TransactionType(rec["type"].lower())
            except ValueError:
                rec["type"] = TransactionType.EXPENSE

        if "account_id" not in rec:
            continue

        records.append(rec)

    upsert_result = await upsert_transactions(db, user_id, records)

    session.status = "completed"
    await db.commit()

    return ExecuteResponse(
        created=upsert_result["created"],
        updated=upsert_result["updated"],
        total=len(records),
    )
