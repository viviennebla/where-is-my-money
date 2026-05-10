from datetime import datetime
from pydantic import BaseModel


class ApiKeyResponse(BaseModel):
    has_key: bool


class ApiKeyUpdate(BaseModel):
    api_key: str


class TemplateResponse(BaseModel):
    id: str
    platform_name: str
    field_mapping: dict[str, str]
    is_preset: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
