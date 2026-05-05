import { useState, useMemo } from 'react'
import api from '../../api/client'
import ColumnMappingView from './ColumnMappingView'

interface Props {
  fileId: string
  headers: string[]
  sampleRows: string[][]
  onConfirmed: (mapping: Record<string, string>, platformName: string) => void
  onBack: () => void
}

const AI_SYSTEM_PROMPT = `You are a data mapping assistant. Given the first few rows of a financial transaction file (CSV/Excel), infer which columns map to standard fields.

Standard fields:
- transaction_date: the date/time of the transaction
- amount: the transaction amount (positive number)
- type: expense, income, transfer, or refund
- merchant_name: the merchant/counterparty name
- description: item description or details
- external_tx_id: external transaction ID / order number
- merchant_order_id: merchant's own order/reference number (商户单号)
- transaction_status: status of the transaction (当前状态), e.g. 支付成功, 已全额退款
- source_category: transaction category from source (交易类型), e.g. 商户消费, 转账, 退款
- currency: currency code (CNY, USD, etc.)

Rules:
- If a column contains amounts and there is a separate "income/expense" indicator, map amount to "amount" and the direction indicator helps determine type
- If there are separate "income" and "expense" amount columns, note that in your reasoning
- Look for column names like: 交易时间, 金额, 商户名称, 商品描述, 订单号, 商户单号, 当前状态, 交易类型, etc.
- type should be inferred as: "expense" for spending, "income" for receiving money

Return ONLY valid JSON with this exact schema:
{
  "field_mapping": {"original_column_name": "standard_field_name", ...},
  "confidence": 0.0-1.0,
  "notes": "brief explanation of your reasoning"
}`

function buildPromptPreview(headers: string[], sampleRows: string[][]): string {
  const limited = sampleRows.slice(0, 3)
  const sampleText = [
    headers.join(' | '),
    ...limited.map((r) => r.map((c) => String(c)).join(' | ')),
  ].join('\n')
  return `${AI_SYSTEM_PROMPT}\n\nFile preview:\n${sampleText}`
}

export default function AIParseView({ fileId, headers, sampleRows, onConfirmed, onBack }: Props) {
  const [inferring, setInferring] = useState(false)
  const [inferred, setInferred] = useState(false)
  const [error, setError] = useState('')
  const [rawResponse, setRawResponse] = useState('')
  const [confidence, setConfidence] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [platformName, setPlatformName] = useState('')
  const [showPrompt, setShowPrompt] = useState(true)
  const [showResponse, setShowResponse] = useState(false)

  const promptPreview = useMemo(() => buildPromptPreview(headers, sampleRows), [headers, sampleRows])

  const handleInfer = () => {
    setInferring(true)
    setError('')
    setRawResponse('')
    setConfidence(null)
    setNotes('')
    setShowResponse(false)
    api.post('/import/infer', { file_id: fileId })
      .then((res) => {
        setMapping(res.data.field_mapping || {})
        setConfidence(res.data.confidence)
        setNotes(res.data.notes)
        setRawResponse(res.data.raw_response || '')
        setShowResponse(true)
        setInferred(true)
      })
      .catch((err) => {
        const msg = err.response?.data?.detail || err.response?.data?.message || err.message || '未知错误'
        setError(`AI 推断失败：${msg}`)
      })
      .finally(() => setInferring(false))
  }

  const updateMapping = (srcCol: string, stdField: string) => {
    const next = { ...mapping }
    if (stdField) {
      next[srcCol] = stdField
    } else {
      delete next[srcCol]
    }
    setMapping(next)
  }

  const formatJson = (raw: string) => {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2)
    } catch {
      return raw
    }
  }

  return (
    <div className="space-y-4">
      {/* AI Analysis Panel */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">AI 分析</h3>
            {inferring && (
              <span className="flex items-center gap-1 text-blue-600 text-sm">
                <span className="animate-spin w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full inline-block" />
                分析中...
              </span>
            )}
            {!inferring && !error && confidence !== null && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                confidence >= 0.8 ? 'bg-green-100 text-green-700' :
                confidence >= 0.5 ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                置信度 {(confidence * 100).toFixed(0)}%
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border-b border-red-100">
            <p className="text-red-700 text-sm whitespace-pre-wrap">{error}</p>
          </div>
        )}

        {/* Prompt — always visible */}
        <div>
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            className="w-full p-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              发送给AI的数据
            </span>
            <span className="text-gray-400 text-xs">{showPrompt ? '收起' : '展开'}</span>
          </button>
          {showPrompt && (
            <div className="bg-gray-50 border-t">
              <pre className="p-3 text-xs text-gray-600 whitespace-pre-wrap max-h-64 overflow-y-auto">
                {promptPreview}
              </pre>
              <div className="px-3 pb-3">
                <button
                  onClick={handleInfer}
                  disabled={inferring}
                  className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {inferring ? (
                    <>
                      <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full inline-block" />
                      AI 分析中...
                    </>
                  ) : inferred ? (
                    '重新发送分析'
                  ) : (
                    '发送给 AI 分析'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* AI Response */}
        {!inferring && !error && rawResponse && (
          <div>
            <button
              onClick={() => setShowResponse(!showResponse)}
              className="w-full p-3 text-left text-sm font-medium text-gray-700 hover:bg-blue-50 flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                AI分析结果
              </span>
              <span className="text-gray-400 text-xs">{showResponse ? '收起' : '展开'}</span>
            </button>
            {showResponse && (
              <div className="bg-blue-50 border-t p-3">
                {notes && (
                  <p className="text-sm text-blue-800 mb-2">{notes}</p>
                )}
                <pre className="text-xs text-blue-900 whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {formatJson(rawResponse)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Column Mapping */}
      <ColumnMappingView
        headers={headers}
        mapping={mapping}
        onChange={updateMapping}
        disabled={inferring}
      />

      {/* Platform name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          平台名称（用于保存模板）
        </label>
        <input
          type="text"
          value={platformName}
          onChange={(e) => setPlatformName(e.target.value)}
          placeholder="例如: 微信账单"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          返回
        </button>
        <button
          onClick={() => onConfirmed(mapping, platformName || '未命名平台')}
          disabled={!platformName || Object.keys(mapping).length === 0}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          确认并继续
        </button>
      </div>
    </div>
  )
}
