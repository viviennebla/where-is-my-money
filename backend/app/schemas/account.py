from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel
from app.models.account import AccountType


class AccountCreate(BaseModel):
    name: str
    currency: str = "CNY"
    initial_balance: Decimal = Decimal("0.00")
    account_type: AccountType = AccountType.BANK_CARD


class AccountUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None
    account_type: AccountType | None = None
    initial_balance: Decimal | None = None


class AccountResponse(BaseModel):
    id: str
    name: str
    currency: str
    initial_balance: Decimal
    current_balance: Decimal
    is_active: bool
    account_type: AccountType
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
