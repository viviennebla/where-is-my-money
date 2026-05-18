import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import Transaction, TransactionType
from app.services.balance_calculator import apply_balance

FUZZY_WINDOW_HOURS = 24



async def upsert_transactions(
    session: AsyncSession,
    user_id: str,
    records: list[dict],
) -> dict:
    """
    Upsert transactions with dedup logic.
    Each record dict must have keys matching Transaction fields.
    Returns {created: N, updated: M, diffs: [...]}.
    """
    created = 0
    updated = 0
    all_diffs = []

    for rec in records:
        # Override type to refund if status/category indicates it
        if rec.get("transaction_status") and "退款" in str(rec["transaction_status"]):
            rec["type"] = TransactionType.REFUND
        elif rec.get("source_category") and "退款" in str(rec["source_category"]):
            rec["type"] = TransactionType.REFUND

        # Combine source_category into merchant_name for richer display
        sc = rec.get("source_category")
        mn = rec.get("merchant_name")
        if sc and mn:
            rec["merchant_name"] = f"{sc} · {mn}"
        elif sc and not mn:
            rec["merchant_name"] = sc

        existing = await _find_match(session, user_id, rec)

        if existing:
            diffs = await _merge(session, existing, rec)
            all_diffs.extend(diffs)
            updated += 1
        else:
            tx = Transaction(
                id=str(uuid.uuid4()),
                user_id=user_id,
                **rec,
            )
            session.add(tx)
            await apply_balance(session, tx)
            created += 1

    await session.commit()
    return {"created": created, "updated": updated, "diffs": all_diffs}


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


async def _merge(session: AsyncSession, existing: Transaction, rec: dict) -> list[dict]:
    """Merge non-null fields from rec into existing (fill blanks only).
    When both old and new have values but new is richer, record as diff instead of overwriting."""
    diffs = []
    for field in ("merchant_name", "description", "remark", "external_tx_id", "external_source",
                  "merchant_order_id", "transaction_status", "source_category"):
        new_val = rec.get(field)
        old_val = getattr(existing, field, None)
        if new_val and not old_val:
            setattr(existing, field, new_val)
        elif new_val and old_val and len(new_val) > len(old_val):
            diffs.append({
                "transaction_id": existing.id,
                "field": field,
                "old": old_val,
                "new": new_val,
            })

    existing.updated_at = datetime.utcnow()
    return diffs


async def match_refunds(session: AsyncSession, user_id: str) -> int:
    """Match REFUND transactions without parent_id to their original expenses.

    Returns count of refunds matched.
    """
    from sqlalchemy import select, and_
    from app.models.transaction import Transaction, TransactionType

    # Find all unmatched refunds for this user
    result = await session.execute(
        select(Transaction).where(
            Transaction.user_id == user_id,
            Transaction.type == TransactionType.REFUND,
            Transaction.parent_id.is_(None),
        )
    )
    refunds = result.scalars().all()

    if not refunds:
        return 0

    matched = 0
    for refund in refunds:
        match = None

        # Strategy 1: same merchant_order_id
        if refund.merchant_order_id:
            match_result = await session.execute(
                select(Transaction).where(
                    Transaction.user_id == user_id,
                    Transaction.type == TransactionType.EXPENSE,
                    Transaction.merchant_order_id == refund.merchant_order_id,
                    Transaction.id != refund.id,
                ).order_by(Transaction.transaction_date.desc()).limit(1)
            )
            match = match_result.scalar_one_or_none()

        # Strategy 2: same merchant_name + same amount within 30-day window (also try when order_id exists but didn't match)
        if not match and refund.merchant_name:
            window_start = refund.transaction_date - timedelta(days=30)
            window_end = refund.transaction_date + timedelta(hours=2)
            match_result = await session.execute(
                select(Transaction).where(
                    Transaction.user_id == user_id,
                    Transaction.type == TransactionType.EXPENSE,
                    Transaction.merchant_name == refund.merchant_name,
                    Transaction.original_amount == refund.original_amount,
                    Transaction.transaction_date >= window_start,
                    Transaction.transaction_date <= window_end,
                    Transaction.id != refund.id,
                ).order_by(Transaction.transaction_date.desc()).limit(1)
            )
            match = match_result.scalar_one_or_none()

        # Strategy 3: fuzzy merchant name (substring) + same amount within 30-day window
        if not match and refund.merchant_name:
            window_start = refund.transaction_date - timedelta(days=30)
            window_end = refund.transaction_date + timedelta(hours=2)
            candidates = await session.execute(
                select(Transaction).where(
                    Transaction.user_id == user_id,
                    Transaction.type == TransactionType.EXPENSE,
                    Transaction.original_amount == refund.original_amount,
                    Transaction.transaction_date >= window_start,
                    Transaction.transaction_date <= window_end,
                    Transaction.id != refund.id,
                    Transaction.merchant_name.isnot(None),
                ).order_by(Transaction.transaction_date.desc()).limit(50)
            )
            refund_name = refund.merchant_name.lower().replace('平台商户', '').strip()
            for c in candidates.scalars().all():
                c_name = (c.merchant_name or '').lower()
                if len(c_name) >= 2 and len(refund_name) >= 2:
                    if c_name in refund.merchant_name.lower() or refund_name in c_name:
                        match = c
                        break

        if match:
            refund.parent_id = match.id
            matched += 1

    if matched > 0:
        await session.commit()

    return matched
