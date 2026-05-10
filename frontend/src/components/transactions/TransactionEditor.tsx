import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import { Transaction, Account } from '../../lib/types'
import { TX_TYPE_LABELS } from '../../lib/constants'

interface Props {
  open: boolean
  tx: Transaction | null
  onClose: () => void
}

export default function TransactionEditor({ open, tx, onClose }: Props) {
  const queryClient = useQueryClient()
  const [type, setType] = useState('')
  const [merchantName, setMerchantName] = useState('')
  const [description, setDescription] = useState('')
  const [remark, setRemark] = useState('')
  const [amount, setAmount] = useState('')
  const [txDate, setTxDate] = useState('')
  const [accountId, setAccountId] = useState('')
  const [transferAccountId, setTransferAccountId] = useState('')
  const [saving, setSaving] = useState(false)

  // Refund fields
  const [refundAmount, setRefundAmount] = useState('')
  const [refundDate, setRefundDate] = useState('')

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts').then((r) => r.data),
    enabled: open,
  })

  useEffect(() => {
    if (tx && open) {
      setType(tx.type)
      setMerchantName(tx.merchant_name || '')
      setDescription(tx.description || '')
      setRemark(tx.remark || '')
      setAmount(tx.base_amount)
      setTxDate(tx.transaction_date ? tx.transaction_date.slice(0, 16) : '')
      setAccountId(tx.account_id)
      setTransferAccountId(tx.transfer_account_id || '')
      setRefundAmount('')
      setRefundDate('')
    }
  }, [tx, open])

  const save = async () => {
    if (!tx) return
    setSaving(true)
    try {
      await api.put(`/transactions/${tx.id}`, {
        type: type || undefined,
        merchant_name: merchantName || undefined,
        description: description || undefined,
        remark: remark || undefined,
        base_amount: amount || undefined,
        original_amount: amount || undefined,
        transaction_date: txDate ? new Date(txDate).toISOString() : undefined,
        account_id: accountId || undefined,
        transfer_account_id: type === 'transfer' ? (transferAccountId || undefined) : undefined,
      })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['account-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const createRefund = async () => {
    if (!tx || !refundAmount || !refundDate) return
    setSaving(true)
    try {
      await api.post('/transactions', {
        type: 'refund',
        original_currency: 'CNY',
        original_amount: refundAmount,
        base_currency: 'CNY',
        base_amount: refundAmount,
        account_id: tx.account_id,
        parent_id: tx.id,
        transaction_date: new Date(refundDate).toISOString(),
        merchant_name: tx.merchant_name,
        description: `退款: ${tx.description || tx.merchant_name || ''}`,
      })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['account-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (!open || !tx) return null

  const showTransfer = type === 'transfer'
  const showRefund = tx.type === 'expense'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-lg mb-4">编辑交易记录</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">类型</label>
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              {Object.entries(TX_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">金额</label>
              <input type="number" step="0.01" value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">日期时间</label>
              <input type="datetime-local" value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">账户</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              {accounts?.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {showTransfer && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">目标账户 (转入)</label>
              <select value={transferAccountId} onChange={(e) => setTransferAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                <option value="">选择目标账户</option>
                {accounts?.filter(a => a.id !== accountId).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-600 mb-1">交易对象</label>
            <input type="text" value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              placeholder="交易对象名称"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">描述</label>
            <input type="text" value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="交易描述"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">备注</label>
            <input type="text" value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="备注"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>

          {/* Refund section for expenses */}
          {showRefund && (
            <div className="border-t pt-3 mt-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">标记退款</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">退款金额</label>
                  <input type="number" step="0.01" value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">退款日期</label>
                  <input type="datetime-local" value={refundDate}
                    onChange={(e) => setRefundDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <button
                onClick={createRefund}
                disabled={saving || !refundAmount || !refundDate}
                className="mt-2 px-3 py-1 text-xs bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 disabled:opacity-50"
              >
                {saving ? '创建中...' : '创建退款记录'}
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            取消
          </button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
