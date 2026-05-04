export const API_BASE = '/api/v1'

export const TX_TYPE_LABELS: Record<string, string> = {
  expense: '支出',
  income: '收入',
  transfer: '转账',
  refund: '退款',
}

export const TX_TYPE_COLORS: Record<string, string> = {
  expense: 'text-red-600',
  income: 'text-green-600',
  transfer: 'text-blue-600',
  refund: 'text-orange-600',
}
