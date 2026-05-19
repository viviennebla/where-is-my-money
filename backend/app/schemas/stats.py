from decimal import Decimal
from pydantic import BaseModel


class StatSummary(BaseModel):
    expense: Decimal
    income: Decimal
    net: Decimal
    tx_count: int


class MonthlyTrendItem(BaseModel):
    year: int
    month: int
    expense: Decimal
    income: Decimal


class CategoryItem(BaseModel):
    category: str
    amount: Decimal
    count: int
    pct: float


class MerchantItem(BaseModel):
    merchant: str
    amount: Decimal
    count: int


class AccountBalanceItem(BaseModel):
    id: str
    name: str
    current_balance: Decimal
    account_type: str
    currency: str
