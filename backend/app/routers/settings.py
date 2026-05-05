from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.encryption import encrypt_api_key
from app.models.user import User
from app.schemas.settings import ApiKeyResponse, ApiKeyUpdate

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
