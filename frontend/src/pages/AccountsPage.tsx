import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { Account, AccountType } from '../lib/types'
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_EMOJIS } from '../lib/constants'

const ACCOUNT_TYPES: AccountType[] = ['bank_card', 'software_balance', 'financial_product', 'monthly_bill', 'installment']

export default function AccountsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [name, setName] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('bank_card')
  const [currency, setCurrency] = useState('CNY')
  const [alias, setAlias] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [showAdjust, setShowAdjust] = useState(false)
  const [adjustAcct, setAdjustAcct] = useState<Account | null>(null)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustDate, setAdjustDate] = useState('')
  const [adjustNote, setAdjustNote] = useState('')

  const { data: accounts, isLoading } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts').then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: { name: string; account_type: AccountType; currency: string; alias?: string; card_number?: string }) =>
      api.post('/accounts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; account_type?: AccountType; is_active?: boolean; alias?: string; card_number?: string }) =>
      api.put(`/accounts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      resetForm()
    },
  })

  const recalcMutation = useMutation({
    mutationFn: (id: string) => api.post(`/accounts/${id}/recalculate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  })

  const adjustMutation = useMutation({
    mutationFn: ({ id, target_balance, date, note }: { id: string; target_balance: string; date: string; note: string }) =>
      api.post(`/accounts/${id}/adjust-balance`, { target_balance, date, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['account-transactions'] })
      setShowAdjust(false)
      setAdjustAcct(null)
    },
  })

  function resetForm() {
    setShowForm(false)
    setEditing(null)
    setName('')
    setAccountType('bank_card')
    setCurrency('CNY')
    setAlias('')
    setCardNumber('')
  }

  function openCreate() {
    resetForm()
    setShowForm(true)
  }

  function openEdit(acct: Account) {
    setEditing(acct)
    setName(acct.name)
    setAccountType(acct.account_type)
    setCurrency(acct.currency)
    setAlias(acct.alias || '')
    setCardNumber(acct.card_number || '')
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const data = {
      name,
      account_type: accountType,
      currency,
      alias: alias || undefined,
      card_number: cardNumber || undefined,
    }
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, ...data })
    } else {
      await createMutation.mutateAsync(data)
    }
  }

  function openAdjust(acct: Account) {
    setAdjustAcct(acct)
    setAdjustAmount(acct.current_balance)
    setAdjustDate(new Date().toISOString().slice(0, 16))
    setAdjustNote('')
    setShowAdjust(true)
  }

  if (isLoading) {
    return <div className="p-6 text-gray-500">Loading...</div>
  }

  const showBankCardFields = accountType === 'bank_card'

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">账户管理</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          + 新建账户
        </button>
      </div>

      {accounts?.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-2">还没有账户</p>
          <p className="text-sm">点击"新建账户"添加银行卡、软件余额、理财产品等</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {accounts?.map((acct) => (
          <div
            key={acct.id}
            className={`p-4 rounded-xl border cursor-pointer transition-colors ${acct.is_active ? 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm' : 'bg-gray-50 border-gray-100 opacity-60'}`}
            onClick={() => navigate(`/accounts/${acct.id}`)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{ACCOUNT_TYPE_EMOJIS[acct.account_type] ?? '💳'}</span>
                <div>
                  <h3 className="font-semibold">{acct.name}</h3>
                  <span className="text-xs text-gray-500">
                    {ACCOUNT_TYPE_LABELS[acct.account_type] ?? acct.account_type}
                  </span>
                  {acct.alias && (
                    <span className="text-xs text-gray-400 ml-1">({acct.alias})</span>
                  )}
                </div>
              </div>
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => openEdit(acct)}
                  className="text-xs px-2 py-1 text-gray-500 hover:bg-gray-100 rounded"
                >
                  编辑
                </button>
                <button
                  onClick={() => updateMutation.mutate({ id: acct.id, is_active: !acct.is_active })}
                  className={`text-xs px-2 py-1 rounded ${acct.is_active ? 'text-red-500 hover:bg-red-50' : 'text-green-500 hover:bg-green-50'}`}
                >
                  {acct.is_active ? '停用' : '启用'}
                </button>
              </div>
            </div>

            {acct.card_number && (
              <div className="text-xs text-gray-400 mb-2">卡号: {acct.card_number}</div>
            )}

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">当前余额</span>
                <span className="font-mono font-bold text-lg">
                  {acct.current_balance} {acct.currency}
                </span>
              </div>
            </div>

            <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => recalcMutation.mutate(acct.id)}
                className="text-xs text-blue-500 hover:text-blue-700"
              >
                重新计算
              </button>
              <button
                onClick={() => openAdjust(acct)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                调整余额
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Balance Adjustment Dialog */}
      {showAdjust && adjustAcct && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl mx-4">
            <h2 className="text-lg font-bold mb-4">调整余额</h2>
            <p className="text-sm text-gray-500 mb-3">
              {adjustAcct.name} 当前余额：{adjustAcct.current_balance} {adjustAcct.currency}
            </p>
            <label className="block mb-3">
              <span className="text-sm text-gray-600">调整为</span>
              <input
                type="text"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
              />
            </label>
            <label className="block mb-3">
              <span className="text-sm text-gray-600">调整日期</span>
              <input
                type="datetime-local"
                value={adjustDate}
                onChange={(e) => setAdjustDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </label>
            <label className="block mb-4">
              <span className="text-sm text-gray-600">备注</span>
              <input
                type="text"
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder="余额调整"
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowAdjust(false); setAdjustAcct(null) }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm"
              >
                取消
              </button>
              <button
                onClick={() => adjustMutation.mutate({
                  id: adjustAcct.id,
                  target_balance: adjustAmount,
                  date: new Date(adjustDate).toISOString(),
                  note: adjustNote,
                })}
                disabled={adjustMutation.isPending}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {adjustMutation.isPending ? '调整中...' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl mx-4"
          >
            <h2 className="text-lg font-bold mb-4">
              {editing ? '编辑账户' : '新建账户'}
            </h2>

            <label className="block mb-3">
              <span className="text-sm text-gray-600">名称</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="如：招商银行储蓄卡"
              />
            </label>

            <label className="block mb-3">
              <span className="text-sm text-gray-600">类型</span>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as AccountType)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ACCOUNT_TYPE_EMOJIS[t]} {ACCOUNT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>

            {showBankCardFields && (
              <>
                <label className="block mb-3">
                  <span className="text-sm text-gray-600">别名</span>
                  <input
                    type="text"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="如：工资卡"
                  />
                </label>
                <label className="block mb-3">
                  <span className="text-sm text-gray-600">卡号</span>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="如：6217 **** 1234"
                  />
                </label>
              </>
            )}

            <label className="block mb-3">
              <span className="text-sm text-gray-600">币种</span>
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </label>

            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {createMutation.isPending || updateMutation.isPending ? '保存中...' : '保存'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
