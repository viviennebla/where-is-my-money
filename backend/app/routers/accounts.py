import uuid
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user
from app.models.account import Account, AccountType
from app.models.transaction import Transaction, TransactionType
from app.schemas.account import AccountCreate, AccountUpdate, AccountResponse, AccountAdjustRequest, TransactionWithBalance, AccountTransactionsResponse

router = APIRouter(prefix="/api/v1/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountResponse])
async def list_accounts(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    account_type: AccountType | None = None,
):
    query = select(Account).where(Account.user_id == user_id)
    if account_type:
        query = query.where(Account.account_type == account_type)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    body: AccountCreate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = Account(
        user_id=user_id,
        name=body.name,
        currency=body.currency,
        account_type=body.account_type,
        initial_balance=body.initial_balance,
        current_balance=body.initial_balance,
        alias=body.alias,
        card_number=body.card_number,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


@router.put("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: str,
    body: AccountUpdate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == user_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    if body.name is not None:
        account.name = body.name
    if body.is_active is not None:
        account.is_active = body.is_active
    if body.account_type is not None:
        account.account_type = body.account_type
    if body.alias is not None:
        account.alias = body.alias
    if body.card_number is not None:
        account.card_number = body.card_number

    # Balance adjustment: set current_balance directly
    if body.adjusted_balance is not None:
        account.current_balance = body.adjusted_balance

    # Legacy: initial_balance update (shifts current_balance proportionally)
    if body.initial_balance is not None:
        diff = body.initial_balance - account.initial_balance
        account.initial_balance = body.initial_balance
        account.current_balance += diff

    await db.commit()
    await db.refresh(account)
    return account


@router.post("/{account_id}/recalculate", response_model=AccountResponse)
async def recalculate_balance(
    account_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == user_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    delta_result = await db.execute(
        select(func.sum(
            case(
                (Transaction.type == TransactionType.INCOME, Transaction.base_amount),
                (Transaction.type == TransactionType.REFUND, Transaction.base_amount),
                (Transaction.type == TransactionType.BALANCE_ADJUSTMENT, Transaction.base_amount),
                (Transaction.type == TransactionType.EXPENSE, -Transaction.base_amount),
                (Transaction.type == TransactionType.TRANSFER, -Transaction.base_amount),
                else_=0,
            )
        )).where(
            Transaction.account_id == account_id,
            Transaction.user_id == user_id,
        )
    )
    total_delta = delta_result.scalar() or Decimal("0")
    account.current_balance = account.initial_balance + total_delta
    await db.commit()
    await db.refresh(account)
    return account


@router.post("/{account_id}/adjust-balance", response_model=AccountResponse)
async def adjust_balance(
    account_id: str,
    body: AccountAdjustRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == user_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    delta = body.target_balance - account.current_balance
    if delta == 0:
        return account

    tx = Transaction(
        user_id=user_id,
        type=TransactionType.BALANCE_ADJUSTMENT,
        original_currency=account.currency,
        original_amount=delta,
        base_currency=account.currency,
        base_amount=delta,
        account_id=account_id,
        remark=body.note or None,
        transaction_date=body.date,
    )
    db.add(tx)
    account.current_balance = body.target_balance
    await db.commit()
    await db.refresh(account)
    return account


@router.get("/{account_id}/transactions", response_model=AccountTransactionsResponse)
async def get_account_transactions(
    account_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == user_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    txn_result = await db.execute(
        select(Transaction)
        .where(Transaction.account_id == account_id, Transaction.user_id == user_id)
        .order_by(Transaction.transaction_date.desc())
    )
    transactions = txn_result.scalars().all()

    running = account.current_balance
    txns_with_balance = []
    for tx in transactions:
        balance_before = running
        if tx.type == TransactionType.EXPENSE:
            running += tx.base_amount
        elif tx.type == TransactionType.TRANSFER:
            running += tx.base_amount
        elif tx.type in (TransactionType.INCOME, TransactionType.REFUND, TransactionType.BALANCE_ADJUSTMENT):
            running -= tx.base_amount
        running_at_tx = balance_before
        txns_with_balance.append(TransactionWithBalance(
            id=tx.id,
            type=tx.type,
            original_currency=tx.original_currency,
            original_amount=tx.original_amount,
            base_currency=tx.base_currency,
            base_amount=tx.base_amount,
            account_id=tx.account_id,
            transfer_account_id=tx.transfer_account_id,
            parent_id=tx.parent_id,
            merchant_name=tx.merchant_name,
            description=tx.description,
            remark=tx.remark,
            external_tx_id=tx.external_tx_id,
            external_source=tx.external_source,
            merchant_order_id=tx.merchant_order_id,
            transaction_status=tx.transaction_status,
            source_category=tx.source_category,
            transaction_date=tx.transaction_date,
            created_at=tx.created_at,
            updated_at=tx.updated_at,
            running_balance=running_at_tx,
        ))

    return AccountTransactionsResponse(
        account=AccountResponse.model_validate(account),
        transactions=txns_with_balance,
    )
