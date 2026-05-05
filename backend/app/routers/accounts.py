from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user
from app.models.account import Account, AccountType
from app.models.transaction import Transaction, TransactionType
from app.schemas.account import AccountCreate, AccountUpdate, AccountResponse

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

    # Balance update: adjust current_balance proportionally
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
