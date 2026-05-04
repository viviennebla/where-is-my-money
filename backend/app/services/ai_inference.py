import json
import httpx
from app.config import settings

INFERENCE_PROMPT = """You are a data mapping assistant. Given the first few rows of a financial transaction file (CSV/Excel), infer which columns map to standard fields.

Standard fields:
- transaction_date: the date/time of the transaction
- amount: the transaction amount (positive number)
- type: expense, income, transfer, or refund
- merchant_name: the merchant/counterparty name
- description: item description or details
- external_tx_id: external transaction ID / order number
- currency: currency code (CNY, USD, etc.)

Rules:
- If a column contains amounts and there is a separate "income/expense" indicator, map amount to "amount" and the direction indicator helps determine type
- If there are separate "income" and "expense" amount columns, note that in your reasoning
- Look for column names like: 交易时间, 金额, 商户名称, 商品描述, 订单号, etc.
- type should be inferred as: "expense" for spending, "income" for receiving money

Return ONLY valid JSON with this exact schema:
{
  "field_mapping": {"original_column_name": "standard_field_name", ...},
  "confidence": 0.0-1.0,
  "notes": "brief explanation of your reasoning"
}"""


async def infer_column_mapping(rows: list[list[str]]) -> dict:
    """Call DeepSeek to infer column mapping from file header + sample rows."""
    if not rows:
        return {"field_mapping": {}, "confidence": 0.0, "notes": "No data provided"}

    headers = rows[0]
    sample_rows = rows[1:] if len(rows) > 1 else []
    sample_text = "\n".join([
        " | ".join(headers),
        *[" | ".join(r) for r in sample_rows],
    ])

    payload = {
        "model": settings.DEEPSEEK_MODEL,
        "max_tokens": 1024,
        "messages": [
            {"role": "system", "content": INFERENCE_PROMPT},
            {"role": "user", "content": f"File preview:\n{sample_text}"},
        ],
        "response_format": {"type": "json_object"},
    }

    headers_dict = {
        "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{settings.DEEPSEEK_BASE_URL}/v1/messages",
            json=payload,
            headers=headers_dict,
        )
        resp.raise_for_status()
        data = resp.json()

    content = data["content"][0]["text"]
    return json.loads(content)
