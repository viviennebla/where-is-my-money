from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel


class AccountCreate(BaseModel):
    name: str
    currency: str = "CNY"
    initial_balance: Decimal = Decimal("0.00")


class AccountUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None


class AccountResponse(BaseModel):
    id: str
    name: str
    currency: str
    initial_balance: Decimal
    current_balance: Decimal
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
