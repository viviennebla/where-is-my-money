import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { Transaction, Account, Tag } from '../lib/types'

export function useLocalTransactions() {
  return useLiveQuery(() => db.transactions.orderBy('transaction_date').reverse().toArray()) || []
}

export function useLocalAccounts() {
  return useLiveQuery(() => db.accounts.toArray()) || []
}

export function useLocalTags() {
  return useLiveQuery(() => db.tags.toArray()) || []
}

export async function syncToLocal(type: 'transactions' | 'accounts' | 'tags', items: any[]) {
  switch (type) {
    case 'transactions':
      await db.transactions.bulkPut(items)
      break
    case 'accounts':
      await db.accounts.bulkPut(items)
      break
    case 'tags':
      await db.tags.bulkPut(items)
      break
  }
}
