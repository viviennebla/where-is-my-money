import { useState, useRef, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import { Transaction } from '../../lib/types'
import { TX_TYPE_LABELS, TX_TYPE_COLORS } from '../../lib/constants'

interface Props {
  tx: Transaction
  onEditClick: (tx: Transaction) => void
}

export default function TransactionRow({ tx, onEditClick }: Props) {
  const queryClient = useQueryClient()
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const dateStr = new Date(tx.transaction_date).toLocaleDateString('zh-CN')
  const timeStr = new Date(tx.transaction_date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingField])

  const startEdit = useCallback((field: string, value: string) => {
    setEditingField(field)
    setEditValue(value)
  }, [])

  const saveEdit = useCallback(async () => {
    if (!editingField) return
    const field = editingField
    setEditingField(null)

    const body: Record<string, string | undefined> = {}
    if (field === 'merchant_name') body.merchant_name = editValue
    else if (field === 'description') body.description = editValue
    else return

    try {
      await api.put(`/transactions/${tx.id}`, body)
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    } catch {
      // revert silently
    }
  }, [editingField, editValue, tx.id, queryClient])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit()
    else if (e.key === 'Escape') setEditingField(null)
  }

  const isExpense = tx.type === 'expense' || tx.type === 'transfer'
  const isBalanceAdj = tx.type === 'balance_adjustment'

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-3 px-2 text-sm text-gray-500 whitespace-nowrap">
        {dateStr}
        <span className="text-xs text-gray-400 ml-1">{timeStr}</span>
      </td>
      <td className="py-3 px-2 text-sm text-gray-600">
        {tx.account_name || '-'}
      </td>
      <td className="py-3 px-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${TX_TYPE_COLORS[tx.type] || 'text-gray-600'} bg-opacity-10`}>
          {TX_TYPE_LABELS[tx.type] || tx.type}
        </span>
        {tx.type === 'transfer' && tx.transfer_account_name && (
          <span className="text-xs text-blue-500 ml-1">→ {tx.transfer_account_name}</span>
        )}
      </td>
      <td
        className="py-3 px-2 text-sm cursor-pointer hover:bg-blue-50 rounded"
        onClick={() => startEdit('merchant_name', tx.merchant_name || '')}
      >
        {editingField === 'merchant_name' ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
            className="w-full px-1 py-0.5 border border-blue-300 rounded text-sm"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          tx.merchant_name || <span className="text-gray-300">-</span>
        )}
      </td>
      <td
        className="py-3 px-2 text-sm text-gray-500 max-w-[200px] truncate cursor-pointer hover:bg-blue-50 rounded"
        onClick={() => startEdit('description', tx.description || '')}
      >
        {editingField === 'description' ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
            className="w-full px-1 py-0.5 border border-blue-300 rounded text-sm"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          tx.description || <span className="text-gray-300">-</span>
        )}
      </td>
      <td className="py-3 px-2 text-sm text-right font-medium">
        <span className={isBalanceAdj ? 'text-gray-500' : isExpense ? 'text-red-600' : 'text-green-600'}>
          {isBalanceAdj ? (Number(tx.base_amount) >= 0 ? '+' : '') : ''}
          ¥{Math.abs(Number(tx.base_amount)).toFixed(2)}
        </span>
      </td>
      <td className="py-3 px-2">
        <button
          onClick={(e) => { e.stopPropagation(); onEditClick(tx) }}
          className="text-xs text-blue-600 hover:underline"
        >
          编辑
        </button>
      </td>
    </tr>
  )
}
