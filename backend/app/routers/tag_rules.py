from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.auth import get_current_user
from app.models.tag import Tag
from app.models.tag_rule import TagRule
from app.schemas.tag_rule import TagRuleCreate, TagRuleUpdate, TagRuleResponse
from app.routers.tags import seed_system_tags

router = APIRouter(prefix="/api/v1/tag-rules", tags=["tag-rules"])

DEFAULT_RULES = [
    # (field, keyword, tag_name)
    ("merchant_name", "美团", "餐饮"),
    ("merchant_name", "饿了么", "餐饮"),
    ("merchant_name", "外卖", "餐饮"),
    ("merchant_name", "大众点评", "餐饮"),
    ("merchant_name", "口碑", "餐饮"),
    ("merchant_name", "麦当劳", "餐饮"),
    ("merchant_name", "肯德基", "餐饮"),
    ("merchant_name", "必胜客", "餐饮"),
    ("merchant_name", "滴滴", "交通"),
    ("merchant_name", "曹操", "交通"),
    ("merchant_name", "花小猪", "交通"),
    ("merchant_name", "高德打车", "交通"),
    ("merchant_name", "T3", "交通"),
    ("merchant_name", "首汽约车", "交通"),
    ("merchant_name", "如祺出行", "交通"),
    ("merchant_name", "群收款", "转账"),
    ("merchant_name", "转账", "转账"),
    ("merchant_name", "汇款", "转账"),
    ("merchant_name", "转入", "转账"),
    ("merchant_name", "二维码付款", "日常消费"),
    ("merchant_name", "扫二维码", "日常消费"),
    ("merchant_name", "扫码付", "日常消费"),
    ("merchant_name", "付款码", "日常消费"),
    ("merchant_name", "二维码收款", "日常消费"),
    ("merchant_name", "星巴克", "餐饮"),
    ("merchant_name", "瑞幸", "餐饮"),
    ("merchant_name", "喜茶", "餐饮"),
    ("merchant_name", "奈雪", "餐饮"),
    ("merchant_name", "茶颜悦色", "餐饮"),
    ("merchant_name", "咖啡", "餐饮"),
    ("merchant_name", "奶茶", "餐饮"),
    ("merchant_name", "京东", "购物"),
    ("merchant_name", "淘宝", "购物"),
    ("merchant_name", "天猫", "购物"),
    ("merchant_name", "拼多多", "购物"),
    ("merchant_name", "唯品会", "购物"),
    ("merchant_name", "苏宁", "购物"),
    ("merchant_name", "网购", "购物"),
    ("merchant_name", "房租", "居住"),
    ("merchant_name", "物业", "居住"),
    ("merchant_name", "水电", "居住"),
    ("merchant_name", "燃气", "居住"),
    ("merchant_name", "暖气", "居住"),
    ("merchant_name", "宽带", "居住"),
    ("merchant_name", "工资", "收入"),
    ("merchant_name", "奖金", "收入"),
    ("merchant_name", "报销", "收入"),
    ("merchant_name", "劳务", "收入"),
    ("merchant_name", "薪金", "收入"),
    ("merchant_name", "医院", "医疗"),
    ("merchant_name", "药房", "医疗"),
    ("merchant_name", "诊所", "医疗"),
    ("merchant_name", "医保", "医疗"),
    ("merchant_name", "挂号", "医疗"),
    ("merchant_name", "电影", "娱乐"),
    ("merchant_name", "KTV", "娱乐"),
    ("merchant_name", "演出", "娱乐"),
    ("merchant_name", "景点", "娱乐"),
    ("merchant_name", "门票", "娱乐"),
    ("merchant_name", "酒店", "娱乐"),
    ("merchant_name", "机票", "娱乐"),
    ("merchant_name", "火车票", "娱乐"),
    ("merchant_name", "高铁", "娱乐"),
    ("merchant_name", "动车", "娱乐"),
    ("merchant_name", "充值", "通讯"),
    ("merchant_name", "话费", "通讯"),
    ("merchant_name", "流量", "通讯"),
    ("merchant_name", "中国移动", "通讯"),
    ("merchant_name", "中国联通", "通讯"),
    ("merchant_name", "中国电信", "通讯"),
    ("merchant_name", "退款", "退款"),
    ("merchant_name", "退票", "退款"),
    ("merchant_name", "退费", "退款"),
    ("merchant_name", "退回", "退款"),
]


async def seed_default_tag_rules(db: AsyncSession) -> None:
    """Seed system-default tag rules if they don't exist."""
    await seed_system_tags(db)

    # Build tag name → tag id lookup
    tag_result = await db.execute(
        select(Tag).where(Tag.is_system_default == True)
    )
    tag_name_to_id: dict[str, str] = {t.name: t.id for t in tag_result.scalars().all()}

    # Check which rules already exist
    existing_result = await db.execute(
        select(TagRule.field, TagRule.keyword).where(TagRule.is_system_default == True)
    )
    existing = {(r.field, r.keyword) for r in existing_result.all()}

    for field, keyword, tag_name in DEFAULT_RULES:
        if (field, keyword) in existing:
            continue
        tag_id = tag_name_to_id.get(tag_name)
        if not tag_id:
            continue
        db.add(TagRule(
            field=field,
            keyword=keyword,
            tag_id=tag_id,
            is_system_default=True,
        ))
    await db.commit()


@router.get("", response_model=list[TagRuleResponse])
async def list_tag_rules(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await seed_default_tag_rules(db)
    result = await db.execute(
        select(TagRule)
        .options(selectinload(TagRule.tag))
        .where(or_(TagRule.user_id == user_id, TagRule.is_system_default == True))
        .order_by(TagRule.is_system_default.desc(), TagRule.created_at.asc())
    )
    return result.scalars().all()


@router.post("", response_model=TagRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_tag_rule(
    body: TagRuleCreate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if len(body.keyword) > 100:
        raise HTTPException(status_code=400, detail="Keyword too long")

    rule = TagRule(
        user_id=user_id,
        field=body.field,
        keyword=body.keyword,
        tag_id=body.tag_id,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)

    # Refetch with tag relationship loaded
    result = await db.execute(
        select(TagRule).options(selectinload(TagRule.tag)).where(TagRule.id == rule.id)
    )
    return result.scalar_one()


@router.put("/{rule_id}", response_model=TagRuleResponse)
async def update_tag_rule(
    rule_id: str,
    body: TagRuleUpdate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TagRule).where(
            TagRule.id == rule_id,
            TagRule.user_id == user_id,
            TagRule.is_system_default == False,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found or is system default")

    if body.field is not None:
        rule.field = body.field
    if body.keyword is not None:
        rule.keyword = body.keyword
    if body.tag_id is not None:
        rule.tag_id = body.tag_id

    await db.commit()
    await db.refresh(rule)

    result = await db.execute(
        select(TagRule).options(selectinload(TagRule.tag)).where(TagRule.id == rule.id)
    )
    return result.scalar_one()


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag_rule(
    rule_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TagRule).where(
            TagRule.id == rule_id,
            TagRule.user_id == user_id,
            TagRule.is_system_default == False,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found or is system default")

    await db.delete(rule)
    await db.commit()
