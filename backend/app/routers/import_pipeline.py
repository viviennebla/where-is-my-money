import uuid
import os
import csv
import io
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user
from app.config import settings
from app.models.import_template import ImportTemplate
from app.models.account import Account
from app.models.transaction import TransactionType
from app.schemas.import_ import (
    UploadResponse, InferRequest, InferResponse,
    ConfirmRequest, ConfirmResponse, ExecuteRequest, ExecuteResponse,
)
from app.utils.file_parser import parse_file_preview
from app.utils.sanitizer import sanitize_for_ai
from app.services.ai_inference import infer_column_mapping
from app.services.merge_engine import upsert_transactions

router = APIRouter(prefix="/api/v1/import", tags=["import"])

temp_files = {}


@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
):
    content = await file.read()
    filename = file.filename or "unknown"
    preview = parse_file_preview(filename, content, row_limit=5)

    file_id = str(uuid.uuid4())
    file_path = os.path.join(settings.UPLOAD_DIR, file_id)
    with open(file_path, "wb") as f:
        f.write(content)

    row_count = len(content.decode("utf-8-sig").strip().split("\n")) - 1
    temp_files[file_id] = {"path": file_path, "filename": filename}

    return UploadResponse(
        file_id=file_id,
        filename=filename,
        preview=preview,
        row_count=max(row_count, 0),
    )


@router.post("/infer", response_model=InferResponse)
async def infer_mapping(
    body: InferRequest,
    user_id: str = Depends(get_current_user),
):
    sanitized = sanitize_for_ai(body.preview)
    result = await infer_column_mapping(sanitized)
    return InferResponse(
        field_mapping=result.get("field_mapping", {}),
        confidence=result.get("confidence", 0.0),
        notes=result.get("notes", ""),
    )


@router.post("/confirm", response_model=ConfirmResponse)
async def confirm_mapping(
    body: ConfirmRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ImportTemplate).where(
            ImportTemplate.user_id == user_id,
            ImportTemplate.platform_name == body.platform_name,
        )
    )
    template = result.scalar_one_or_none()

    if template:
        template.field_mapping = body.field_mapping
    else:
        template = ImportTemplate(
            user_id=user_id,
            platform_name=body.platform_name,
            field_mapping=body.field_mapping,
        )
        db.add(template)

    await db.commit()
    await db.refresh(template)

    return ConfirmResponse(
        template_id=template.id,
        message=f"Template '{body.platform_name}' saved",
    )


@router.post("/execute", response_model=ExecuteResponse)
async def execute_import(
    body: ExecuteRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ImportTemplate).where(
            ImportTemplate.id == body.template_id,
            ImportTemplate.user_id == user_id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    first_file = None
    for fid, info in temp_files.items():
        first_file = info
        break

    if not first_file:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No uploaded file found")

    with open(first_file["path"], "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        all_rows = list(reader)

    records = []
    for row in all_rows:
        rec = {}
        for src_col, std_field in template.field_mapping.items():
            if src_col in row:
                rec[std_field] = row[src_col]

        if "transaction_date" in rec:
            rec["transaction_date"] = datetime.fromisoformat(rec["transaction_date"])
        if "original_amount" in rec:
            rec["original_amount"] = Decimal(str(rec["original_amount"]))
        if "base_amount" in rec:
            rec["base_amount"] = Decimal(str(rec["base_amount"]))
        elif "original_amount" in rec:
            rec["base_amount"] = rec["original_amount"]

        if "type" in rec:
            try:
                rec["type"] = TransactionType(rec["type"].lower())
            except ValueError:
                rec["type"] = TransactionType.EXPENSE

        if "account_id" not in rec:
            acc_result = await db.execute(
                select(Account.id).where(Account.user_id == user_id).limit(1)
            )
            acc_id = acc_result.scalar_one_or_none()
            if acc_id:
                rec["account_id"] = acc_id
            else:
                continue

        records.append(rec)

    result = await upsert_transactions(db, user_id, records)
    return ExecuteResponse(
        created=result["created"],
        updated=result["updated"],
        total=len(records),
    )
