export type TransactionType = 'expense' | 'income' | 'transfer' | 'refund'

export interface Account {
  id: string
  name: string
  currency: string
  initial_balance: string
  current_balance: string
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
  transfer_account_id: string | null
  parent_id: string | null
  merchant_name: string | null
  description: string | null
  remark: string | null
  external_tx_id: string | null
  external_source: string | null
  transaction_date: string
  created_at: string
  updated_at: string
}

export interface Tag {
  id: string
  name: string
  emoji: string | null
  parent_id: string | null
  is_system_default: boolean
  created_at: string
}

export interface ImportTemplate {
  id: string
  platform_name: string
  field_mapping: Record<string, string>
  file_format_hint: string | null
}
