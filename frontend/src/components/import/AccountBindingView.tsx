import { useState, useEffect } from 'react'
import api from '../../api/client'

interface PaymentMethod {
  payment_method: string
  count: number
  suggested_account_id: string | null
  suggested_account_name: string | null
  all_accounts: Array<{ id: string; name: string; account_type: string }>
  sample_rows: Array<Record<string, string>>
}

interface Props {
  fileId: string
  onConfirmed: (bindings: Record<string, string>) => void
  onBack: () => void
}

const ACCOUNT_TYPES = [
  { value: 'bank_card', label: '银行卡' },
  { value: 'software_balance', label: '软件余额' },
  { value: 'financial_product', label: '理财产品' },
  { value: 'monthly_bill', label: '月度账单' },
  { value: 'installment', label: '分期付款' },
]

const KEY_LABELS: Record<string, string> = {
  '交易时间': '交易时间',
  '金额': '金额',
  '收支方向': '收支方向',
  '商户名称': '交易对象',
  '商品描述': '描述',
  '当前状态': '状态',
  '交易类型': '类型',
  '备注': '备注',
}

function PaymentMethodRow({ method, binding, onChange }: {
  method: PaymentMethod
  binding: string
  onChange: (v: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const accounts = method.all_accounts || []
  const samples = method.sample_rows || []

  const previewFields = samples.length > 0
    ? Object.keys(samples[0]).filter((k) => KEY_LABELS[k]).slice(0, 6)
    : []

  return (
    <div className="border-b border-gray-100 py-2">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-gray-600 text-xs"
          title="展开查看数据详情"
        >
          {expanded ? '▼' : '▶'}
        </button>
        <div className="w-44">
          <span className="text-sm font-medium text-gray-700">{method.payment_method}</span>
          <span className="text-xs text-gray-400 ml-2">({method.count}条)</span>
        </div>
        <span className="text-gray-300">→</span>
        <select
          value={binding}
          onChange={(e) => onChange(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 flex-1 bg-white"
        >
          <option value="">选择账户...</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        {method.suggested_account_name && (
          <span className="text-xs text-green-600 whitespace-nowrap">
            建议: {method.suggested_account_name}
          </span>
        )}
      </div>

      {/* Expanded sample data */}
      {expanded && samples.length > 0 && (
        <div className="mt-2 ml-6 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                {previewFields.map((f) => (
                  <th key={f} className="px-2 py-1 text-left text-gray-500 border-b whitespace-nowrap">
                    {KEY_LABELS[f] || f}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {samples.slice(0, 3).map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  {previewFields.map((f) => (
                    <td key={f} className="px-2 py-1 text-gray-700 border-b border-gray-50 whitespace-nowrap max-w-32 truncate" title={row[f]}>
                      {row[f] || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function AccountBindingView({ fileId, onConfirmed, onBack }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [columnName, setColumnName] = useState('')
  const [bindings, setBindings] = useState<Record<string, string>>({})
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newAccount, setNewAccount] = useState({ name: '', account_type: 'bank_card', currency: 'CNY' })
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [aiMatching, setAiMatching] = useState(false)
  const [aiNotes, setAiNotes] = useState('')
  const [aiMatched, setAiMatched] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError('')
    api.post('/import/extract-payment-methods', { file_id: fileId })
      .then((res) => {
        setColumnName(res.data.column_name)
        setMethods(res.data.methods || [])
      })
      .catch(() => setError('获取支付方式失败'))
      .finally(() => setLoading(false))
  }, [fileId])

  const updateBinding = (method: string, accountId: string) => {
    const next = { ...bindings }
    if (accountId) {
      next[method] = accountId
    } else {
      delete next[method]
    }
    setBindings(next)
  }

  const createAccount = async () => {
    setCreating(true)
    try {
      const res = await api.post('/accounts', newAccount)
      const acc = res.data
      setMethods((prev) =>
        prev.map((m) => ({
          ...m,
          all_accounts: [...m.all_accounts, { id: acc.id, name: acc.name, account_type: acc.account_type }],
        }))
      )
      setShowCreateForm(false)
      setNewAccount({ name: '', account_type: 'bank_card', currency: 'CNY' })
    } catch {
      setError('创建账户失败')
    } finally {
      setCreating(false)
    }
  }

  const handleAiMatch = async () => {
    setAiMatching(true)
    setAiNotes('')
    try {
      const res = await api.post('/import/ai-match-accounts', { file_id: fileId })
      const aiMatches: Record<string, string | null> = res.data.matches || {}
      setAiNotes(res.data.notes || '')
      setBindings((prev) => {
        const next = { ...prev }
        for (const [method, accountId] of Object.entries(aiMatches)) {
          if (accountId) {
            next[method] = accountId
          }
        }
        return next
      })
      setAiMatched(true)
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || '未知错误'
      setAiNotes(`AI 匹配失败：${msg}`)
    } finally {
      setAiMatching(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.post('/import/save-bindings', { file_id: fileId, bindings })
      onConfirmed(bindings)
    } catch {
      setError('保存绑定失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-gray-500 text-center py-8">正在分析支付方式...</p>
  }

  if (error && methods.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">{error}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={onBack} className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
            返回
          </button>
          <button onClick={() => onConfirmed({})} className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">
            跳过绑定
          </button>
        </div>
      </div>
    )
  }

  if (methods.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">未检测到支付方式列，无需绑定账户</p>
        <div className="flex gap-3 justify-center">
          <button onClick={onBack} className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
            返回
          </button>
          <button onClick={() => onConfirmed({})} className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">
            继续
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h3 className="font-semibold text-gray-900 mb-1">账户绑定</h3>
        <p className="text-sm text-gray-500 mb-3">
          将文件中的支付方式「{columnName}」映射到系统账户。点击 ▶ 展开查看该支付方式的交易明细。
        </p>

        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={handleAiMatch}
            disabled={aiMatching}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {aiMatching ? (
              <>
                <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full inline-block" />
                AI 匹配中...
              </>
            ) : aiMatched ? (
              '重新 AI 匹配'
            ) : (
              'AI 智能匹配'
            )}
          </button>
          {aiMatched && (
            <span className="text-xs text-green-600">AI 匹配完成，可手动调整</span>
          )}
        </div>

        {aiNotes && (
          <p className={`text-sm mb-3 ${aiNotes.startsWith('AI 匹配失败') ? 'text-red-600' : 'text-blue-600'}`}>
            {aiNotes}
          </p>
        )}

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        <div className="space-y-1">
          {methods.map((m) => (
            <PaymentMethodRow
              key={m.payment_method}
              method={m}
              binding={bindings[m.payment_method] || ''}
              onChange={(v) => updateBinding(m.payment_method, v)}
            />
          ))}
        </div>
      </div>

      {/* Create account form */}
      {showCreateForm ? (
        <div className="bg-gray-50 rounded-lg border p-4 space-y-3">
          <h4 className="font-medium text-sm text-gray-700">新建账户</h4>
          <div className="flex gap-3">
            <input
              type="text"
              value={newAccount.name}
              onChange={(e) => setNewAccount((p) => ({ ...p, name: e.target.value }))}
              placeholder="账户名称"
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 flex-1"
            />
            <select
              value={newAccount.account_type}
              onChange={(e) => setNewAccount((p) => ({ ...p, account_type: e.target.value }))}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={createAccount}
              disabled={creating || !newAccount.name}
              className="px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {creating ? '创建中...' : '创建'}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-1.5 text-sm text-gray-500 hover:text-gray-700"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowCreateForm(true)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          + 新建账户
        </button>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          返回
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存绑定并继续'}
        </button>
        <button
          onClick={() => onConfirmed({})}
          className="px-6 py-2 text-gray-500 hover:text-gray-700"
        >
          跳过绑定
        </button>
      </div>
    </div>
  )
}
