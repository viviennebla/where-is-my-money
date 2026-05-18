import { Transaction } from '../../lib/types'
import { TX_TYPE_LABELS, TX_TYPE_COLORS } from '../../lib/constants'

interface Props {
  tx: Transaction
  onEditClick: (tx: Transaction) => void
}

export default function TransactionRow({ tx, onEditClick }: Props) {
  const dateStr = new Date(tx.transaction_date).toLocaleDateString('zh-CN')
  const timeStr = new Date(tx.transaction_date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

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
      <td className="py-3 px-1">
        <div className="flex flex-wrap gap-0.5">
          {tx.tags && tx.tags.length > 0 ? tx.tags.map((tag) => (
            <span key={tag.id} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded whitespace-nowrap">
              {tag.emoji} {tag.name}
            </span>
          )) : <span className="text-gray-300 text-xs">-</span>}
        </div>
      </td>
      <td className="py-3 px-2 text-sm">
        {tx.merchant_name || <span className="text-gray-300">-</span>}
      </td>
      <td className="py-3 px-2 text-sm text-gray-500 max-w-[200px] truncate">
        {tx.description || <span className="text-gray-300">-</span>}
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
