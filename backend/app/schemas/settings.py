from pydantic import BaseModel


class ApiKeyResponse(BaseModel):
    has_key: bool


class ApiKeyUpdate(BaseModel):
    api_key: str
