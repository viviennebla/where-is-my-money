from pydantic import BaseModel


class UploadResponse(BaseModel):
    file_id: str
    filename: str
    headers: list[str]
    sample_rows: list[list[str]]
    header_row_index: int
    total_rows: int


class InferRequest(BaseModel):
    file_id: str


class InferResponse(BaseModel):
    field_mapping: dict[str, str]
    confidence: float
    notes: str
    prompt_sent: str
    raw_response: str


class ConfirmRequest(BaseModel):
    file_id: str
    platform_name: str
    field_mapping: dict[str, str]


class ConfirmResponse(BaseModel):
    template_id: str
    message: str


class ExtractPaymentMethodsRequest(BaseModel):
    file_id: str
    payment_column: str | None = None


class AccountBrief(BaseModel):
    id: str
    name: str
    account_type: str


class PaymentMethodSuggestion(BaseModel):
    payment_method: str
    count: int
    suggested_account_id: str | None = None
    suggested_account_name: str | None = None
    all_accounts: list[AccountBrief] = []


class ExtractPaymentMethodsResponse(BaseModel):
    column_name: str
    methods: list[PaymentMethodSuggestion]


class SaveBindingsRequest(BaseModel):
    file_id: str
    bindings: dict[str, str]


class AiMatchAccountsRequest(BaseModel):
    file_id: str


class AiMatchAccountsResponse(BaseModel):
    matches: dict[str, str | None]
    notes: str


class ExecuteRequest(BaseModel):
    file_id: str
    template_id: str | None = None
    account_binding: dict[str, str] | None = None


class ExecuteResponse(BaseModel):
    created: int
    updated: int
    total: int
