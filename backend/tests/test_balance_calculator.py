import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.balance_calculator import apply_balance, reverse_balance
from app.models.transaction import Transaction, TransactionType
from app.models.account import Account


def make_tx(**overrides):
    defaults = {
        "id": str(uuid.uuid4()),
        "user_id": str(uuid.uuid4()),
        "type": TransactionType.EXPENSE,
        "original_currency": "CNY",
        "original_amount": Decimal("100.00"),
        "base_currency": "CNY",
        "base_amount": Decimal("100.00"),
        "account_id": str(uuid.uuid4()),
        "transfer_account_id": None,
        "parent_id": None,
        "merchant_name": None,
        "description": None,
        "remark": None,
        "external_tx_id": None,
        "external_source": None,
        "transaction_date": None,
    }
    defaults.update(overrides)
    tx = MagicMock(spec=Transaction)
    for k, v in defaults.items():
        setattr(tx, k, v)
    return tx


def make_account(**overrides):
    defaults = {
        "id": str(uuid.uuid4()),
        "user_id": str(uuid.uuid4()),
        "name": "Test Account",
        "currency": "CNY",
        "initial_balance": Decimal("0.00"),
        "current_balance": Decimal("1000.00"),
        "is_active": True,
    }
    defaults.update(overrides)
    acct = MagicMock(spec=Account)
    for k, v in defaults.items():
        setattr(acct, k, v)
    return acct


class TestApplyBalance:
    @pytest.mark.asyncio
    async def test_expense_reduces_balance(self, mock_session):
        acct = make_account(current_balance=Decimal("1000.00"))
        mock_session.get.return_value = acct
        tx = make_tx(type=TransactionType.EXPENSE, base_amount=Decimal("100.00"),
                     account_id=acct.id)

        await apply_balance(mock_session, tx)

        assert acct.current_balance == Decimal("900.00")

    @pytest.mark.asyncio
    async def test_income_increases_balance(self, mock_session):
        acct = make_account(current_balance=Decimal("1000.00"))
        mock_session.get.return_value = acct
        tx = make_tx(type=TransactionType.INCOME, base_amount=Decimal("500.00"),
                     account_id=acct.id)

        await apply_balance(mock_session, tx)

        assert acct.current_balance == Decimal("1500.00")

    @pytest.mark.asyncio
    async def test_refund_increases_balance(self, mock_session):
        acct = make_account(current_balance=Decimal("800.00"))
        mock_session.get.return_value = acct
        tx = make_tx(type=TransactionType.REFUND, base_amount=Decimal("100.00"),
                     account_id=acct.id, parent_id=None)

        await apply_balance(mock_session, tx)

        assert acct.current_balance == Decimal("900.00")

    @pytest.mark.asyncio
    async def test_refund_with_parent_restores_parent_balance(self, mock_session):
        parent_acct = make_account(current_balance=Decimal("500.00"))
        refund_acct = make_account(current_balance=Decimal("1000.00"))
        parent_tx = make_tx(type=TransactionType.EXPENSE, base_amount=Decimal("200.00"),
                            account_id=parent_acct.id)

        mock_session.get.side_effect = lambda model, id: {
            (Transaction, refund_acct.id): refund_acct,
            (Transaction, parent_tx.id): parent_tx,
            (Account, refund_acct.id): refund_acct,
            (Account, parent_acct.id): parent_acct,
        }.get((model, id))

        tx = make_tx(type=TransactionType.REFUND, base_amount=Decimal("50.00"),
                     account_id=refund_acct.id, parent_id=parent_tx.id)

        await apply_balance(mock_session, tx)

        assert refund_acct.current_balance == Decimal("1050.00")
        assert parent_acct.current_balance == Decimal("550.00")

    @pytest.mark.asyncio
    async def test_transfer_reduces_source_increases_dest(self, mock_session):
        src = make_account(current_balance=Decimal("1000.00"))
        dst = make_account(current_balance=Decimal("500.00"))
        tx = make_tx(type=TransactionType.TRANSFER, base_amount=Decimal("200.00"),
                     account_id=src.id, transfer_account_id=dst.id)

        mock_session.get.side_effect = lambda model, id: {
            (Account, src.id): src,
            (Account, dst.id): dst,
        }.get((model, id))

        await apply_balance(mock_session, tx)

        assert src.current_balance == Decimal("800.00")
        assert dst.current_balance == Decimal("700.00")

    @pytest.mark.asyncio
    async def test_transfer_without_dest(self, mock_session):
        src = make_account(current_balance=Decimal("1000.00"))
        mock_session.get.return_value = src
        tx = make_tx(type=TransactionType.TRANSFER, base_amount=Decimal("200.00"),
                     account_id=src.id, transfer_account_id=None)

        await apply_balance(mock_session, tx)

        assert src.current_balance == Decimal("800.00")

    @pytest.mark.asyncio
    async def test_account_not_found_no_error(self, mock_session):
        mock_session.get.return_value = None
        tx = make_tx(type=TransactionType.EXPENSE, base_amount=Decimal("100.00"))

        await apply_balance(mock_session, tx)


class TestReverseBalance:
    @pytest.mark.asyncio
    async def test_expense_reverse_adds_back(self, mock_session):
        acct = make_account(current_balance=Decimal("900.00"))
        mock_session.get.return_value = acct
        tx = make_tx(type=TransactionType.EXPENSE, base_amount=Decimal("100.00"),
                     account_id=acct.id)

        await reverse_balance(mock_session, tx)

        assert acct.current_balance == Decimal("1000.00")

    @pytest.mark.asyncio
    async def test_income_reverse_subtracts(self, mock_session):
        acct = make_account(current_balance=Decimal("1500.00"))
        mock_session.get.return_value = acct
        tx = make_tx(type=TransactionType.INCOME, base_amount=Decimal("500.00"),
                     account_id=acct.id)

        await reverse_balance(mock_session, tx)

        assert acct.current_balance == Decimal("1000.00")

    @pytest.mark.asyncio
    async def test_transfer_reverse(self, mock_session):
        src = make_account(current_balance=Decimal("800.00"))
        dst = make_account(current_balance=Decimal("700.00"))
        tx = make_tx(type=TransactionType.TRANSFER, base_amount=Decimal("200.00"),
                     account_id=src.id, transfer_account_id=dst.id)

        mock_session.get.side_effect = lambda model, id: {
            (Account, src.id): src,
            (Account, dst.id): dst,
        }.get((model, id))

        await reverse_balance(mock_session, tx)

        assert src.current_balance == Decimal("1000.00")
        assert dst.current_balance == Decimal("500.00")

    @pytest.mark.asyncio
    async def test_refund_reverse(self, mock_session):
        acct = make_account(current_balance=Decimal("1100.00"))
        mock_session.get.return_value = acct
        tx = make_tx(type=TransactionType.REFUND, base_amount=Decimal("50.00"),
                     account_id=acct.id, parent_id=None)

        await reverse_balance(mock_session, tx)

        assert acct.current_balance == Decimal("1050.00")

    @pytest.mark.asyncio
    async def test_reverse_account_not_found_no_error(self, mock_session):
        mock_session.get.return_value = None
        tx = make_tx(type=TransactionType.EXPENSE, base_amount=Decimal("100.00"))

        await reverse_balance(mock_session, tx)
