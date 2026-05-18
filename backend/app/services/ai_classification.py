import json
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tag import Tag
from app.models.tag_rule import TagRule
from app.models.transaction_tag import TransactionTag
from app.models.transaction import Transaction
from app.services.ai_inference import _call_deepseek
from app.routers.tag_rules import seed_default_tag_rules

CLASSIFY_PROMPT = """Classify the given transaction into 1-3 tags.

Rules (in priority order):
1. First, pick from the provided existing tags list if any match.
2. Only if NO existing tag fits, you may create a new tag with a short name (<=4 characters).
3. Return ONLY valid JSON.

Existing tags (id -> name):
{tags_list}

Return JSON schema:
{{
  "tags": [{{"tag_id": "xxx", "name": "tag_name"}}, ...],
  "is_new": [true/false, ...]
}}"""


async def _get_available_tags(db: AsyncSession, user_id: str) -> list[Tag]:
    result = await db.execute(
        select(Tag).where((Tag.user_id == user_id) | (Tag.is_system_default == True))
    )
    return list(result.scalars().all())


async def _find_local_rules(db: AsyncSession, tx: Transaction) -> str | None:
    """Look up user's historical tag for the same merchant."""
    if not tx.merchant_name:
        return None

    result = await db.execute(
        select(TransactionTag)
        .join(Transaction)
        .join(Tag)
        .where(
            Transaction.user_id == tx.user_id,
            Transaction.merchant_name == tx.merchant_name,
            TransactionTag.tag_id == Tag.id,
        )
        .limit(1)
    )
    row = result.scalar_one_or_none()
    return row.tag_id if row else None


async def _match_keyword_tags(db: AsyncSession, tx: Transaction) -> list[dict]:
    """Match tags based on configured keyword rules (DB-backed). Returns [{tag_id, name}]."""
    await seed_default_tag_rules(db)

    rules_result = await db.execute(
        select(TagRule).where(
            or_(TagRule.user_id == tx.user_id, TagRule.is_system_default == True)
        )
    )
    rules = rules_result.scalars().all()

    matched_tag_ids: set[str] = set()
    for rule in rules:
        field_value = getattr(tx, rule.field, None) or ''
        if rule.keyword in field_value:
            matched_tag_ids.add(rule.tag_id)

    if not matched_tag_ids:
        return []

    tags_result = await db.execute(
        select(Tag).where(Tag.id.in_(list(matched_tag_ids)))
    )
    tags = tags_result.scalars().all()
    return [{"tag_id": t.id, "name": t.name} for t in tags]


async def classify_transaction(db: AsyncSession, tx: Transaction, api_key: str | None = None) -> list[dict]:
    """Classify a transaction. Returns list of {tag_id, name}.

    Uses local history first, then keyword matching, then AI fallback (only if api_key is set).
    """
    user_id = tx.user_id

    local_tag_id = await _find_local_rules(db, tx)
    if local_tag_id:
        tag = await db.get(Tag, local_tag_id)
        if tag:
            return [{"tag_id": tag.id, "name": tag.name}]

    keyword_tags = await _match_keyword_tags(db, tx)
    if keyword_tags:
        return keyword_tags

    if not api_key:
        return []

    available_tags = await _get_available_tags(db, user_id)
    tags_list = "\n".join([f"- {t.id}: {t.name}" for t in available_tags])

    # Merge system prompt into user message since DeepSeek rejects system role
    user_message = CLASSIFY_PROMPT.format(tags_list=tags_list) + \
        f"\n\nTransaction:\nMerchant: {tx.merchant_name or 'N/A'}\nDescription: {tx.description or 'N/A'}\nType: {tx.type.value}"

    raw_response = await _call_deepseek(user_message, api_key)
    result = json.loads(raw_response)

    return result.get("tags", [])
