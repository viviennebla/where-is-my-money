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
- merchant_order_id: merchant's own order/reference number (商户单号)
- transaction_status: status of the transaction (当前状态), e.g. 支付成功, 已全额退款
- source_category: transaction category from source (交易类型), e.g. 商户消费, 转账, 退款
- currency: currency code (CNY, USD, etc.)

Rules:
- If a column contains amounts and there is a separate "income/expense" indicator, map amount to "amount" and the direction indicator helps determine type
- If there are separate "income" and "expense" amount columns, note that in your reasoning
- Look for column names like: 交易时间, 金额, 商户名称, 商品描述, 订单号, 商户单号, 当前状态, 交易类型, etc.
- type should be inferred as: "expense" for spending, "income" for receiving money, "refund" if transaction_status or source_category contains 退款

Return ONLY valid JSON with this exact schema:
{
  "field_mapping": {"original_column_name": "standard_field_name", ...},
  "confidence": 0.0-1.0,
  "notes": "brief explanation of your reasoning"
}"""

ACCOUNT_MATCHING_PROMPT = """You are an account matching assistant. Given a list of payment methods extracted from a financial file and the user's existing accounts, match each payment method to the most likely account.

Rules:
- Match by name similarity, bank name, card type, or account type
- 零钱/余额/yue/balance → software_balance type accounts
- 储蓄卡/借记卡/debit card/savings → bank_card type accounts
- 信用卡/credit card → monthly_bill or bank_card type accounts
- 花呗/借呗/白条 → monthly_bill or installment type accounts
- 理财/基金/fund → financial_product type accounts
- Match card number suffixes like (1234) to the right bank
- If the payment method is a bank name without a specific card match, match to any bank_card account with that bank name
- If no reasonable match exists, set the value to null

Return ONLY valid JSON with this exact schema:
{
  "matches": {"payment_method_name": "account_id_or_null", ...},
  "notes": "brief explanation of your matching reasoning"
}"""


async def _call_deepseek(user_message: str, api_key: str) -> str:
    """Call DeepSeek API and return the text response."""
    payload = {
        "model": settings.DEEPSEEK_MODEL,
        "max_tokens": 4096,
        "messages": [
            {"role": "user", "content": user_message},
        ],
        "response_format": {"type": "json_object"},
    }

    http_headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{settings.DEEPSEEK_BASE_URL}/v1/messages",
            json=payload,
            headers=http_headers,
        )
        resp.raise_for_status()
        data = resp.json()

    for block in data.get("content", []):
        if block.get("type") == "text":
            return block.get("text", "")
    return data["content"][-1].get("text", "")


async def infer_column_mapping(headers: list[str], sample_rows: list[list[str]], api_key: str) -> dict:
    """Call DeepSeek to infer column mapping from file headers + sample rows."""
    if not headers:
        return {
            "field_mapping": {},
            "confidence": 0.0,
            "notes": "No data provided",
            "prompt_sent": "",
            "raw_response": "",
        }

    sample_text = "\n".join([
        " | ".join(headers),
        *[" | ".join(str(c) for c in r) for r in sample_rows],
    ])

    combined_message = f"{INFERENCE_PROMPT}\n\nFile preview:\n{sample_text}"
    raw_response = await _call_deepseek(combined_message, api_key)
    prompt_sent = combined_message

    result = json.loads(raw_response)
    result["prompt_sent"] = prompt_sent
    result["raw_response"] = raw_response
    return result


async def infer_account_matching(
    payment_methods: list[dict],
    accounts: list[dict],
    api_key: str,
) -> dict:
    """Call DeepSeek to match payment methods to user accounts."""
    if not payment_methods:
        return {"matches": {}, "notes": "No payment methods to match", "raw_response": ""}

    methods_text = "\n".join([
        f"- {m['payment_method']} (count: {m.get('count', 0)})"
        for m in payment_methods
    ])
    accounts_text = "\n".join([
        f"- id: \"{a['id']}\", name: \"{a['name']}\", type: \"{a['account_type']}\""
        for a in accounts
    ])

    combined_message = (
        f"{ACCOUNT_MATCHING_PROMPT}\n\n"
        f"Payment methods from file:\n{methods_text}\n\n"
        f"User's accounts:\n{accounts_text}"
    )

    raw_response = await _call_deepseek(combined_message, api_key)
    result = json.loads(raw_response)
    result["raw_response"] = raw_response
    return result
