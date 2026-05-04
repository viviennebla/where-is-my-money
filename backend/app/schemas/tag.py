from datetime import datetime
from pydantic import BaseModel


class TagCreate(BaseModel):
    name: str
    emoji: str | None = None
    parent_id: str | None = None


class TagUpdate(BaseModel):
    name: str | None = None
    emoji: str | None = None


class TagResponse(BaseModel):
    id: str
    name: str
    emoji: str | None
    parent_id: str | None
    is_system_default: bool
    created_at: datetime

    model_config = {"from_attributes": True}
