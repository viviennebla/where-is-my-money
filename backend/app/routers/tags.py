from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user
from app.models.tag import Tag
from app.models.transaction_tag import TransactionTag
from app.schemas.tag import TagCreate, TagUpdate, TagResponse

router = APIRouter(prefix="/api/v1/tags", tags=["tags"])

SYSTEM_TAGS = [
    {"name": "餐饮", "emoji": "🍽️"},
    {"name": "交通", "emoji": "🚗"},
    {"name": "居住", "emoji": "🏠"},
    {"name": "娱乐", "emoji": "🎮"},
    {"name": "医疗", "emoji": "🏥"},
    {"name": "购物", "emoji": "🛒"},
    {"name": "教育", "emoji": "📚"},
    {"name": "通讯", "emoji": "📱"},
    {"name": "服饰", "emoji": "👔"},
    {"name": "美容", "emoji": "💄"},
    {"name": "运动", "emoji": "⚽"},
    {"name": "旅行", "emoji": "✈️"},
    {"name": "宠物", "emoji": "🐱"},
    {"name": "礼物", "emoji": "🎁"},
    {"name": "办公", "emoji": "💼"},
    {"name": "转账", "emoji": "💸"},
    {"name": "收入", "emoji": "💰"},
    {"name": "退款", "emoji": "↩️"},
    {"name": "日常消费", "emoji": "💳"},
]


async def seed_system_tags(db: AsyncSession):
    result = await db.execute(select(Tag).where(Tag.is_system_default == True))
    existing = result.scalars().all()
    existing_names = {t.name for t in existing}

    for tag_data in SYSTEM_TAGS:
        if tag_data["name"] not in existing_names:
            tag = Tag(
                name=tag_data["name"],
                emoji=tag_data["emoji"],
                is_system_default=True,
            )
            db.add(tag)
    await db.commit()


@router.get("", response_model=list[TagResponse])
async def list_tags(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await seed_system_tags(db)
    result = await db.execute(
        select(Tag).where(or_(Tag.user_id == user_id, Tag.is_system_default == True))
    )
    return result.scalars().all()


@router.post("", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
    body: TagCreate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if len(body.name) > 50:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tag name too long")

    result = await db.execute(
        select(Tag).where(
            or_(Tag.user_id == user_id, Tag.is_system_default == True),
            Tag.name == body.name,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tag already exists")

    tag = Tag(
        user_id=user_id,
        name=body.name,
        emoji=body.emoji,
        parent_id=body.parent_id,
    )
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return tag


@router.put("/{tag_id}", response_model=TagResponse)
async def update_tag(
    tag_id: str,
    body: TagUpdate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Tag).where(Tag.id == tag_id, Tag.user_id == user_id, Tag.is_system_default == False)
    )
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found or is system default")

    if body.name is not None:
        tag.name = body.name
    if body.emoji is not None:
        tag.emoji = body.emoji

    await db.commit()
    await db.refresh(tag)
    return tag


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Tag).where(Tag.id == tag_id, Tag.user_id == user_id, Tag.is_system_default == False)
    )
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found or is system default")

    txs = await db.execute(
        select(TransactionTag).where(TransactionTag.tag_id == tag_id)
    )
    for tt in txs.scalars().all():
        await db.delete(tt)

    await db.delete(tag)
    await db.commit()
