from pydantic import BaseModel


class UploadResponse(BaseModel):
    file_id: str
    filename: str
    preview: list[list[str]]
    row_count: int


class InferRequest(BaseModel):
    file_id: str
    preview: list[list[str]]


class InferResponse(BaseModel):
    field_mapping: dict[str, str]
    confidence: float
    notes: str


class ConfirmRequest(BaseModel):
    platform_name: str
    field_mapping: dict[str, str]


class ConfirmResponse(BaseModel):
    template_id: str
    message: str


class ExecuteRequest(BaseModel):
    template_id: str


class ExecuteResponse(BaseModel):
    created: int
    updated: int
    total: int
