from datetime import datetime
from pydantic import BaseModel

from app.schemas.tag import TagResponse


class TagRuleCreate(BaseModel):
    field: str
    keyword: str
    tag_id: str


class TagRuleUpdate(BaseModel):
    field: str | None = None
    keyword: str | None = None
    tag_id: str | None = None


class TagRuleResponse(BaseModel):
    id: str
    user_id: str | None
    field: str
    keyword: str
    tag_id: str
    tag: TagResponse | None = None
    is_system_default: bool
    created_at: datetime

    model_config = {"from_attributes": True}
