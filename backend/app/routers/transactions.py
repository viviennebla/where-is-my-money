from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.auth import get_current_user
from app.models.transaction import Transaction, TransactionType
from app.models.transaction_tag import TransactionTag
from app.models.tag import Tag
from app.models.account import Account
from app.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionResponse, TransactionListResponse
from app.schemas.tag import TagResponse
from app.services.balance_calculator import apply_balance, reverse_balance

router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])

SORT_COLUMNS = {
    "date": Transaction.transaction_date,
    "amount": Transaction.base_amount,
    "type": Transaction.type,
}


@router.get("", response_model=TransactionListResponse)
async def list_transactions(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    type: TransactionType | None = None,
    account_id: str | None = None,
    tag_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    search: str | None = None,
    sort_by: str = Query("date"),
    sort_order: str = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    query = select(Transaction).where(Transaction.user_id == user_id)

    if type:
        query = query.where(Transaction.type == type)
    if account_id:
        query = query.where(Transaction.account_id == account_id)
    if date_from:
        query = query.where(Transaction.transaction_date >= date_from)
    if date_to:
        query = query.where(Transaction.transaction_date <= date_to)
    if tag_id:
        query = query.join(TransactionTag).where(TransactionTag.tag_id == tag_id)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                Transaction.merchant_name.ilike(pattern),
                Transaction.description.ilike(pattern),
                Transaction.remark.ilike(pattern),
            )
        )

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    col = SORT_COLUMNS.get(sort_by, Transaction.transaction_date)
    if sort_order == "asc":
        query = query.order_by(col.asc())
    else:
        query = query.order_by(col.desc())

    query = query.options(
        selectinload(Transaction.account),
        selectinload(Transaction.transfer_account),
        selectinload(Transaction.tags).selectinload(TransactionTag.tag),
    ).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.unique().scalars().all()

    response_items = []
    for t in items:
        d = TransactionResponse.model_validate(t).model_dump()
        d['account_name'] = t.account.name if t.account else ''
        d['transfer_account_name'] = t.transfer_account.name if t.transfer_account else None
        response_items.append(TransactionResponse(**d))

    return TransactionListResponse(
        items=response_items,
        total=total,
    )


@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    body: TransactionCreate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.type == TransactionType.REFUND and not body.parent_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Refund requires parent_id")
    if body.type == TransactionType.TRANSFER and not body.transfer_account_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transfer requires transfer_account_id")

    tx = Transaction(
        user_id=user_id,
        type=body.type,
        original_currency=body.original_currency,
        original_amount=body.original_amount,
        base_currency=body.base_currency,
        base_amount=body.base_amount,
        account_id=body.account_id,
        transfer_account_id=body.transfer_account_id,
        parent_id=body.parent_id,
        merchant_name=body.merchant_name,
        description=body.description,
        remark=body.remark,
        external_tx_id=body.external_tx_id,
        external_source=body.external_source,
        transaction_date=body.transaction_date,
    )
    db.add(tx)
    await db.flush()

    for tag_id in body.tag_ids:
        db.add(TransactionTag(transaction_id=tx.id, tag_id=tag_id))

    await apply_balance(db, tx)
    await db.commit()

    # Build response from explicit queries (avoids lazy-loading issues)
    tag_result = await db.execute(
        select(Tag).select_from(TransactionTag).join(Tag)
        .where(TransactionTag.transaction_id == tx.id)
    )
    tags = [TagResponse.model_validate(t) for t in tag_result.scalars().all()]

    acc = await db.get(Account, tx.account_id)
    transfer_acc = await db.get(Account, tx.transfer_account_id) if tx.transfer_account_id else None

    return TransactionResponse(
        id=tx.id, type=tx.type,
        original_currency=tx.original_currency, original_amount=tx.original_amount,
        base_currency=tx.base_currency, base_amount=tx.base_amount,
        account_id=tx.account_id, account_name=acc.name if acc else '',
        transfer_account_id=tx.transfer_account_id,
        transfer_account_name=transfer_acc.name if transfer_acc else None,
        parent_id=tx.parent_id, merchant_name=tx.merchant_name,
        description=tx.description, remark=tx.remark,
        external_tx_id=tx.external_tx_id, external_source=tx.external_source,
        merchant_order_id=tx.merchant_order_id,
        transaction_status=tx.transaction_status, source_category=tx.source_category,
        transaction_date=tx.transaction_date,
        created_at=tx.created_at, updated_at=tx.updated_at,
        tags=tags,
    )


@router.put("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: str,
    body: TransactionUpdate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction).where(Transaction.id == transaction_id, Transaction.user_id == user_id)
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    # Check if balance-affecting fields changed
    balance_changed = (
        body.type is not None or
        body.base_amount is not None or
        body.account_id is not None or
        body.transfer_account_id is not None or
        body.parent_id is not None
    )

    if balance_changed:
        await reverse_balance(db, tx)

    if body.type is not None:
        tx.type = body.type
    if body.original_currency is not None:
        tx.original_currency = body.original_currency
    if body.original_amount is not None:
        tx.original_amount = body.original_amount
    if body.base_currency is not None:
        tx.base_currency = body.base_currency
    if body.base_amount is not None:
        tx.base_amount = body.base_amount
    if body.account_id is not None:
        tx.account_id = body.account_id
    if body.transfer_account_id is not None:
        tx.transfer_account_id = body.transfer_account_id
    if body.parent_id is not None:
        tx.parent_id = body.parent_id
    if body.merchant_name is not None:
        tx.merchant_name = body.merchant_name
    if body.description is not None:
        tx.description = body.description
    if body.remark is not None:
        tx.remark = body.remark
    if body.external_tx_id is not None:
        tx.external_tx_id = body.external_tx_id
    if body.external_source is not None:
        tx.external_source = body.external_source
    if body.merchant_order_id is not None:
        tx.merchant_order_id = body.merchant_order_id
    if body.transaction_status is not None:
        tx.transaction_status = body.transaction_status
    if body.source_category is not None:
        tx.source_category = body.source_category
    if body.transaction_date is not None:
        tx.transaction_date = body.transaction_date

    if body.tag_ids is not None:
        existing = await db.execute(
            select(TransactionTag).where(TransactionTag.transaction_id == tx.id)
        )
        for tt in existing.scalars().all():
            await db.delete(tt)
        await db.flush()
        for tag_id in body.tag_ids:
            db.add(TransactionTag(transaction_id=tx.id, tag_id=tag_id))

    if balance_changed:
        await apply_balance(db, tx)

    await db.commit()

    tag_result = await db.execute(
        select(Tag).select_from(TransactionTag).join(Tag)
        .where(TransactionTag.transaction_id == tx.id)
    )
    tags = [TagResponse.model_validate(t) for t in tag_result.scalars().all()]

    acc = await db.get(Account, tx.account_id)
    transfer_acc = await db.get(Account, tx.transfer_account_id) if tx.transfer_account_id else None

    return TransactionResponse(
        id=tx.id, type=tx.type,
        original_currency=tx.original_currency, original_amount=tx.original_amount,
        base_currency=tx.base_currency, base_amount=tx.base_amount,
        account_id=tx.account_id, account_name=acc.name if acc else '',
        transfer_account_id=tx.transfer_account_id,
        transfer_account_name=transfer_acc.name if transfer_acc else None,
        parent_id=tx.parent_id, merchant_name=tx.merchant_name,
        description=tx.description, remark=tx.remark,
        external_tx_id=tx.external_tx_id, external_source=tx.external_source,
        merchant_order_id=tx.merchant_order_id,
        transaction_status=tx.transaction_status, source_category=tx.source_category,
        transaction_date=tx.transaction_date,
        created_at=tx.created_at, updated_at=tx.updated_at,
        tags=tags,
    )


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction).where(Transaction.id == transaction_id, Transaction.user_id == user_id)
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    await reverse_balance(db, tx)

    tags = await db.execute(select(TransactionTag).where(TransactionTag.transaction_id == tx.id))
    for tt in tags.scalars().all():
        await db.delete(tt)

    await db.delete(tx)
    await db.commit()
