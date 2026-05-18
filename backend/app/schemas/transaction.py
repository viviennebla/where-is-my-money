from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, field_validator

from app.models.transaction import TransactionType
from app.schemas.tag import TagResponse


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
    type: TransactionType | None = None
    original_currency: str | None = None
    original_amount: Decimal | None = None
    base_currency: str | None = None
    base_amount: Decimal | None = None
    account_id: str | None = None
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
    transaction_date: datetime | None = None
    tag_ids: list[str] | None = None


class TransactionResponse(BaseModel):
    id: str
    type: TransactionType
    original_currency: str
    original_amount: Decimal
    base_currency: str
    base_amount: Decimal
    account_id: str
    account_name: str = ""
    transfer_account_id: str | None = None
    transfer_account_name: str | None = None
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
    tags: list[TagResponse] = []

    @field_validator("tags", mode="before")
    @classmethod
    def _extract_tags(cls, v):
        if v is None or not v:
            return []
        first = v[0]
        if isinstance(first, TagResponse):
            return v  # already validated
        if isinstance(first, dict):
            return v  # already serialized dicts from model_dump
        # ORM TransactionTag objects — extract .tag
        return [TagResponse.model_validate(item.tag) for item in v]

    model_config = {"from_attributes": True}


class TransactionListResponse(BaseModel):
    items: list[TransactionResponse]
    total: int
