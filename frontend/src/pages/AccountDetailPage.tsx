import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import { Account } from '../lib/types'
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_EMOJIS } from '../lib/constants'
import TransactionList from '../components/transactions/TransactionList'

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts').then((r) => r.data),
  })

  const account = accounts?.find((a) => a.id === id)

  if (!account) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500 mb-4">加载中...</p>
        <button onClick={() => navigate('/accounts')} className="text-blue-600 hover:underline">返回账户列表</button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Account header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/accounts')} className="text-gray-400 hover:text-gray-600">
          ← 返回
        </button>
        <span className="text-2xl">{ACCOUNT_TYPE_EMOJIS[account.account_type] ?? '💳'}</span>
        <div>
          <h1 className="text-xl font-bold">
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

      <TransactionList fixedAccountId={id!} />
    </div>
  )
}
