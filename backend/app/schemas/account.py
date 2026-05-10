from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel
from app.models.account import AccountType
from app.models.transaction import TransactionType


class AccountCreate(BaseModel):
    name: str
    currency: str = "CNY"
    initial_balance: Decimal = Decimal("0.00")
    account_type: AccountType = AccountType.BANK_CARD
    alias: str | None = None
    card_number: str | None = None


class AccountUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None
    account_type: AccountType | None = None
    initial_balance: Decimal | None = None
    adjusted_balance: Decimal | None = None
    alias: str | None = None
    card_number: str | None = None


class AccountResponse(BaseModel):
    id: str
    name: str
    currency: str
    initial_balance: Decimal
    current_balance: Decimal
    alias: str | None = None
    card_number: str | None = None
    is_active: bool
    account_type: AccountType
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AccountAdjustRequest(BaseModel):
    target_balance: Decimal
    date: datetime
    note: str = ""


class TransactionWithBalance(BaseModel):
    id: str
    type: TransactionType
    original_currency: str
    original_amount: Decimal
    base_currency: str
    base_amount: Decimal
    account_id: str
    transfer_account_id: str | None = None
    parent_id: str | None = None
    merchant_name: str | None = None
    description: str | None = None
    remark: str | None = None
    external_tx_id: str | None = None
    external_source: str | None = None
    merchant_order_id: str | None = None
    transaction_status: str | None = None
    source_category: str | None = None
    transaction_date: datetime
    created_at: datetime
    updated_at: datetime
    running_balance: Decimal

    model_config = {"from_attributes": False}


class AccountTransactionsResponse(BaseModel):
    account: AccountResponse
    transactions: list[TransactionWithBalance]
