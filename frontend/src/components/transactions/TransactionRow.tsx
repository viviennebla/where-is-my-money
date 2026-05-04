import { Transaction, Tag } from '../../lib/types'
import { TX_TYPE_LABELS, TX_TYPE_COLORS } from '../../lib/constants'

interface Props {
  tx: Transaction
  onTagClick: (tx: Transaction) => void
}

export default function TransactionRow({ tx, onTagClick }: Props) {
  const sign = tx.type === 'income' || tx.type === 'refund' ? '+' : '-'
  const date = new Date(tx.transaction_date).toLocaleDateString('zh-CN')

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-3 px-2 text-sm text-gray-500">{date}</td>
      <td className="py-3 px-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${TX_TYPE_COLORS[tx.type]} bg-opacity-10`}>
          {TX_TYPE_LABELS[tx.type]}
        </span>
      </td>
      <td className="py-3 px-2 text-sm">{tx.merchant_name || '-'}</td>
      <td className="py-3 px-2 text-sm text-gray-500 max-w-[200px] truncate">
        {tx.description || '-'}
      </td>
      <td className="py-3 px-2 text-sm text-right font-medium">
        <span className={tx.type === 'expense' ? 'text-red-600' : 'text-green-600'}>
          {sign}¥{Math.abs(Number(tx.base_amount)).toFixed(2)}
        </span>
      </td>
      <td className="py-3 px-2">
        <button
          onClick={() => onTagClick(tx)}
          className="text-xs text-blue-600 hover:underline"
        >
          编辑标签
        </button>
      </td>
    </tr>
  )
}
