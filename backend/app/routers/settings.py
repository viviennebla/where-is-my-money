from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.encryption import encrypt_api_key
from app.models.user import User
from app.models.import_template import ImportTemplate
from app.schemas.settings import ApiKeyResponse, ApiKeyUpdate, TemplateResponse

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])


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
