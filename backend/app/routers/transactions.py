from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.auth import get_current_user
from app.models.transaction import Transaction, TransactionType
from app.models.transaction_tag import TransactionTag
from app.models.account import Account
from app.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionResponse, TransactionListResponse
from app.services.balance_calculator import apply_balance, reverse_balance

router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])


@router.get("", response_model=TransactionListResponse)
async def list_transactions(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    type: TransactionType | None = None,
    account_id: str | None = None,
    tag_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
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

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    query = query.order_by(Transaction.transaction_date.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()

    return TransactionListResponse(
        items=[TransactionResponse.model_validate(t) for t in items],
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
    await db.refresh(tx)
    return tx


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

    if body.merchant_name is not None:
        tx.merchant_name = body.merchant_name
    if body.description is not None:
        tx.description = body.description
    if body.remark is not None:
        tx.remark = body.remark

    if body.tag_ids is not None:
        existing = await db.execute(
            select(TransactionTag).where(TransactionTag.transaction_id == tx.id)
        )
        for tt in existing.scalars().all():
            await db.delete(tt)
        for tag_id in body.tag_ids:
            db.add(TransactionTag(transaction_id=tx.id, tag_id=tag_id))

    await db.commit()
    await db.refresh(tx)
    return tx


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
