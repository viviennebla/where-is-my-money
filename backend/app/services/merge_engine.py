import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import Transaction, TransactionType

FUZZY_WINDOW_HOURS = 24


def _non_null(a, b):
    """Pick non-null value, preferring the richer one (longer string for descriptions)."""
    if a and b:
        return a if len(a) >= len(b) else b
    return a or b


async def upsert_transactions(
    session: AsyncSession,
    user_id: str,
    records: list[dict],
) -> dict:
    """
    Upsert transactions with dedup logic.
    Each record dict must have keys matching Transaction fields.
    Returns {created: N, updated: M}.
    """
    created = 0
    updated = 0

    for rec in records:
        existing = await _find_match(session, user_id, rec)

        if existing:
            await _merge(session, existing, rec)
            updated += 1
        else:
            tx = Transaction(
                id=str(uuid.uuid4()),
                user_id=user_id,
                **rec,
            )
            session.add(tx)
            created += 1

    await session.commit()
    return {"created": created, "updated": updated}


async def _find_match(session: AsyncSession, user_id: str, rec: dict) -> Transaction | None:
    """Try strong match first, then fuzzy match."""

    ext_id = rec.get("external_tx_id")
    if ext_id:
        result = await session.execute(
            select(Transaction).where(
                Transaction.user_id == user_id,
                Transaction.external_tx_id == ext_id,
            )
        )
        match = result.scalar_one_or_none()
        if match:
            return match

    amount = rec.get("original_amount") or rec.get("base_amount")
    tx_type = rec.get("type")
    tx_date = rec.get("transaction_date")

    if amount and tx_type and tx_date:
        window_start = tx_date - timedelta(hours=FUZZY_WINDOW_HOURS)
        window_end = tx_date + timedelta(hours=FUZZY_WINDOW_HOURS)

        result = await session.execute(
            select(Transaction).where(
                Transaction.user_id == user_id,
                Transaction.original_amount == amount,
                Transaction.type == tx_type,
                Transaction.transaction_date.between(window_start, window_end),
            )
        )
        return result.scalar_one_or_none()

    return None


async def _merge(session: AsyncSession, existing: Transaction, rec: dict):
    """Merge non-null fields from rec into existing, with enrichment strategy."""
    for field in ("merchant_name", "description", "remark", "external_tx_id", "external_source",
                  "merchant_order_id", "transaction_status", "source_category"):
        new_val = rec.get(field)
        old_val = getattr(existing, field, None)
        if new_val and old_val:
            setattr(existing, field, _non_null(old_val, new_val))
        elif new_val:
            setattr(existing, field, new_val)

    existing.updated_at = datetime.utcnow()
