from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import Transaction, TransactionType
from app.models.account import Account


async def apply_balance(session: AsyncSession, tx: Transaction):
    """Apply balance changes for a new transaction."""
    account = await session.get(Account, tx.account_id)
    if not account:
        return

    match tx.type:
        case TransactionType.EXPENSE:
            account.current_balance -= tx.base_amount
        case TransactionType.INCOME:
            account.current_balance += tx.base_amount
        case TransactionType.REFUND:
            account.current_balance += tx.base_amount
            if tx.parent_id:
                parent = await session.get(Transaction, tx.parent_id)
                if parent:
                    parent_account = await session.get(Account, parent.account_id)
                    if parent_account:
                        parent_account.current_balance += tx.base_amount
        case TransactionType.TRANSFER:
            account.current_balance -= tx.base_amount
            if tx.transfer_account_id:
                to_account = await session.get(Account, tx.transfer_account_id)
                if to_account:
                    to_account.current_balance += tx.base_amount


async def reverse_balance(session: AsyncSession, tx: Transaction):
    """Reverse balance changes when deleting a transaction."""
    account = await session.get(Account, tx.account_id)
    if not account:
        return

    match tx.type:
        case TransactionType.EXPENSE:
            account.current_balance += tx.base_amount
        case TransactionType.INCOME:
            account.current_balance -= tx.base_amount
        case TransactionType.REFUND:
            account.current_balance -= tx.base_amount
            if tx.parent_id:
                parent = await session.get(Transaction, tx.parent_id)
                if parent:
                    parent_account = await session.get(Account, parent.account_id)
                    if parent_account:
                        parent_account.current_balance -= tx.base_amount
        case TransactionType.TRANSFER:
            account.current_balance += tx.base_amount
            if tx.transfer_account_id:
                to_account = await session.get(Account, tx.transfer_account_id)
                if to_account:
                    to_account.current_balance -= tx.base_amount
