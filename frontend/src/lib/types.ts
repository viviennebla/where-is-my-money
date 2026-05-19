export type TransactionType = 'expense' | 'income' | 'transfer' | 'refund' | 'balance_adjustment'

export type AccountType = 'bank_card' | 'software_balance' | 'financial_product' | 'monthly_bill' | 'installment'

export interface Account {
  id: string
  name: string
  currency: string
  account_type: AccountType
  initial_balance: string
  current_balance: string
  alias: string | null
  card_number: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  type: TransactionType
  original_currency: string
  original_amount: string
  base_currency: string
  base_amount: string
  account_id: string
  account_name?: string
  transfer_account_id: string | null
  transfer_account_name?: string | null
  parent_id: string | null
  merchant_name: string | null
  description: string | null
  remark: string | null
  external_tx_id: string | null
  external_source: string | null
  transaction_date: string
  created_at: string
  updated_at: string
  tags?: Tag[]
}

export interface Tag {
  id: string
  name: string
  emoji: string | null
  parent_id: string | null
  is_system_default: boolean
  created_at: string
}

export interface TagRule {
  id: string
  user_id: string | null
  field: string
  keyword: string
  tag_id: string
  tag?: Tag
  is_system_default: boolean
  created_at: string
}

export interface TransactionListResponse {
  items: Transaction[]
  total: number
}

export interface ImportTemplate {
  id: string
  platform_name: string
  field_mapping: Record<string, string>
  file_format_hint: string | null
  is_preset: boolean
  created_at: string
  updated_at: string
}

export interface StatSummary {
  expense: string
  income: string
  net: string
  tx_count: number
  total_assets: string
}

export interface MonthlyTrendItem {
  year: number
  month: number
  expense: string
  income: string
}

export interface TrendItem {
  period: string
  expense: string
  income: string
}

export interface CalendarDay {
  date: string
  expense: string
  income: string
  count: number
}

export interface CategoryItem {
  category: string
  amount: string
  count: number
  pct: number
}

export interface MerchantItem {
  merchant: string
  amount: string
  count: number
}

export interface AccountBalanceItem {
  id: string
  name: string
  current_balance: string
  account_type: string
  currency: string
}
