import json
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.tag import Tag
from app.models.transaction_tag import TransactionTag
from app.models.transaction import Transaction

CLASSIFY_PROMPT = """You are a transaction classifier. Classify the given transaction into 1-3 tags.

Rules (in priority order):
1. First, pick from the provided existing tags list if any match.
2. Only if NO existing tag fits, you may create a new tag with a short name (≤4 characters).
3. Return ONLY valid JSON.

Existing tags (id -> name):
{tags_list}

Return JSON schema:
{
  "tags": [{"tag_id": "xxx", "name": "tag_name"}, ...],
  "is_new": [true/false, ...]
}"""


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


async def classify_transaction(db: AsyncSession, tx: Transaction, api_key: str) -> list[dict]:
    """Classify a transaction. Returns list of {tag_id, name}."""
    user_id = tx.user_id

    local_tag_id = await _find_local_rules(db, tx)
    if local_tag_id:
        tag = await db.get(Tag, local_tag_id)
        if tag:
            return [{"tag_id": tag.id, "name": tag.name}]

    available_tags = await _get_available_tags(db, user_id)
    tags_list = "\n".join([f"- {t.id}: {t.name}" for t in available_tags])

    payload = {
        "model": settings.DEEPSEEK_FLASH_MODEL,
        "max_tokens": 512,
        "messages": [
            {
                "role": "system",
                "content": CLASSIFY_PROMPT.format(tags_list=tags_list),
            },
            {
                "role": "user",
                "content": f"Merchant: {tx.merchant_name or 'N/A'}\nDescription: {tx.description or 'N/A'}\nType: {tx.type.value}",
            },
        ],
        "response_format": {"type": "json_object"},
    }

    headers_dict = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{settings.DEEPSEEK_BASE_URL}/v1/messages",
            json=payload,
            headers=headers_dict,
        )
        resp.raise_for_status()
        data = resp.json()

    content = data["content"][0]["text"]
    result = json.loads(content)

    return result.get("tags", [])
