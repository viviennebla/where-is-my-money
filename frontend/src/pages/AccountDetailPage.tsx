import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import { Transaction } from '../lib/types'
import { TX_TYPE_LABELS, TX_TYPE_COLORS, ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_EMOJIS } from '../lib/constants'
import TransactionEditor from '../components/transactions/TransactionEditor'

interface TxWithBalance extends Transaction {
  running_balance: string
}

interface AccountTxData {
  account: {
    id: string
    name: string
    currency: string
    account_type: string
    current_balance: string
    alias: string | null
    card_number: string | null
  }
  transactions: TxWithBalance[]
}

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

  const { data, isLoading, error } = useQuery<AccountTxData>({
    queryKey: ['account-transactions', id],
    queryFn: () => api.get(`/accounts/${id}/transactions`).then((r) => r.data),
  })

  if (isLoading) {
    return <div className="p-6 text-gray-500">Loading...</div>
  }

  if (error || !data) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600 mb-4">加载失败</p>
        <button onClick={() => navigate('/accounts')} className="text-blue-600 hover:underline">返回账户列表</button>
      </div>
    )
  }

  const { account, transactions } = data

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/accounts')} className="text-gray-400 hover:text-gray-600">
          ← 返回
        </button>
        <span className="text-2xl">{ACCOUNT_TYPE_EMOJIS[account.account_type] ?? '💳'}</span>
        <div>
          <h1 className="text-2xl font-bold">
            {account.name}
            {account.alias && <span className="text-sm text-gray-400 ml-2">({account.alias})</span>}
          </h1>
          <span className="text-sm text-gray-500">
            {ACCOUNT_TYPE_LABELS[account.account_type] ?? account.account_type}
            {account.card_number && <span className="ml-2">卡号: {account.card_number}</span>}
          </span>
        </div>
        <div className="ml-auto text-right">
          <span className="text-sm text-gray-500">当前余额</span>
          <p className="text-2xl font-mono font-bold">{account.current_balance} {account.currency}</p>
        </div>
      </div>

      {/* Transactions Table */}
      {transactions.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>暂无交易记录</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <tr>
                <th className="py-3 px-2">日期</th>
                <th className="py-3 px-2">类型</th>
                <th className="py-3 px-2">交易对象</th>
                <th className="py-3 px-2">描述</th>
                <th className="py-3 px-2 text-right">金额</th>
                <th className="py-3 px-2 text-right">余额</th>
                <th className="py-3 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const dateStr = new Date(tx.transaction_date).toLocaleDateString('zh-CN')
                const timeStr = new Date(tx.transaction_date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                const isExpense = tx.type === 'expense' || tx.type === 'transfer'
                const isBalanceAdj = tx.type === 'balance_adjustment'
                return (
                  <tr
                    key={tx.id}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setEditingTx(tx)}
                  >
                    <td className="py-3 px-2 text-sm text-gray-500 whitespace-nowrap">
                      {dateStr}
                      <span className="text-xs text-gray-400 ml-1">{timeStr}</span>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${TX_TYPE_COLORS[tx.type] || 'text-gray-600'} bg-opacity-10`}>
                        {TX_TYPE_LABELS[tx.type] || tx.type}
                      </span>
                      {tx.type === 'transfer' && tx.transfer_account_name && (
                        <span className="text-xs text-blue-500 ml-1">→ {tx.transfer_account_name}</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-sm">{tx.merchant_name || '-'}</td>
                    <td className="py-3 px-2 text-sm text-gray-500 max-w-[200px] truncate">
                      {tx.description || '-'}
                    </td>
                    <td className="py-3 px-2 text-sm text-right font-medium">
                      <span className={isBalanceAdj ? 'text-gray-500' : isExpense ? 'text-red-600' : 'text-green-600'}>
                        {isBalanceAdj ? (Number(tx.base_amount) >= 0 ? '+' : '') : ''}
                        ¥{Math.abs(Number(tx.base_amount)).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-sm text-right font-mono text-gray-600">
                      {Number(tx.running_balance).toFixed(2)}
                    </td>
                    <td className="py-3 px-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingTx(tx) }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        编辑
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editingTx && (
        <TransactionEditor
          open={true}
          tx={editingTx}
          onClose={() => setEditingTx(null)}
          key={editingTx.id}
        />
      )}
    </div>
  )
}
