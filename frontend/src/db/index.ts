import Dexie, { Table } from 'dexie'
import { Transaction, Account, Tag } from '../lib/types'

class WIMMDB extends Dexie {
  transactions!: Table<Transaction, string>
  accounts!: Table<Account, string>
  tags!: Table<Tag, string>
  pendingOps!: Table<{ id?: number; op: string; url: string; data: unknown; createdAt: string }, number>

  constructor() {
    super('WIMMDB')
    this.version(1).stores({
      transactions: 'id, type, account_id, transaction_date, merchant_name',
      accounts: 'id, name',
      tags: 'id, name, is_system_default',
      pendingOps: '++id, op, createdAt',
    })
  }
}

export const db = new WIMMDB()
