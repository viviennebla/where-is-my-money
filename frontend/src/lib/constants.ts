export const API_BASE = '/api/v1'

export const STANDARD_FIELDS = [
  { value: 'transaction_date', label: '交易时间' },
  { value: 'type', label: '收/支' },
  { value: 'merchant_name', label: '交易对方' },
  { value: 'description', label: '商品描述' },
  { value: 'original_amount', label: '金额' },
  { value: 'source_category', label: '交易类型' },
  { value: 'transaction_status', label: '当前状态' },
  { value: 'external_tx_id', label: '交易单号' },
  { value: 'merchant_order_id', label: '商户单号' },
  { value: 'account_id', label: '支付方式' },
  { value: 'remark', label: '备注' },
]

export const TX_TYPE_LABELS: Record<string, string> = {
  expense: '支出',
  income: '收入',
  transfer: '转账',
  refund: '退款',
  balance_adjustment: '余额调整',
}

export const TX_TYPE_COLORS: Record<string, string> = {
  expense: 'text-red-600',
  income: 'text-green-600',
  transfer: 'text-blue-600',
  refund: 'text-orange-600',
  balance_adjustment: 'text-gray-600',
}

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  bank_card: '银行卡',
  software_balance: '软件余额',
  financial_product: '理财产品',
  monthly_bill: '月付',
  installment: '分期账单',
}

export const ACCOUNT_TYPE_EMOJIS: Record<string, string> = {
  bank_card: '\u{1F4B3}',
  software_balance: '\u{1F4F1}',
  financial_product: '\u{1F4C8}',
  monthly_bill: '\u{1F4CB}',
  installment: '\u{1F4E6}',
}
