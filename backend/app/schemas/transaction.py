from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel

from app.models.transaction import TransactionType


class TransactionCreate(BaseModel):
    type: TransactionType
    original_currency: str = "CNY"
    original_amount: Decimal
    base_currency: str = "CNY"
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
    tag_ids: list[str] = []


class TransactionUpdate(BaseModel):
    merchant_name: str | None = None
    description: str | None = None
    remark: str | None = None
    merchant_order_id: str | None = None
    transaction_status: str | None = None
    source_category: str | None = None
    tag_ids: list[str] | None = None


class TransactionResponse(BaseModel):
    id: str
    type: TransactionType
    original_currency: str
    original_amount: Decimal
    base_currency: str
    base_amount: Decimal
    account_id: str
    transfer_account_id: str | None
    parent_id: str | None
    merchant_name: str | None
    description: str | None
    remark: str | None
    external_tx_id: str | None
    external_source: str | None
    merchant_order_id: str | None
    transaction_status: str | None
    source_category: str | None
    transaction_date: datetime
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TransactionListResponse(BaseModel):
    items: list[TransactionResponse]
    total: int
