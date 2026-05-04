import { useState, useEffect } from 'react'
import api from '../../api/client'

interface Props {
  fileId: string
  preview: string[][]
  onConfirmed: (platformName: string, mapping: Record<string, string>) => void
}

const STANDARD_FIELDS = [
  { key: 'transaction_date', label: '交易时间' },
  { key: 'amount', label: '金额' },
  { key: 'type', label: '收支方向' },
  { key: 'merchant_name', label: '商户名称' },
  { key: 'description', label: '商品描述' },
  { key: 'external_tx_id', label: '外部交易单号' },
  { key: 'currency', label: '币种' },
]

export default function ColumnMappingView({ fileId, preview, onConfirmed }: Props) {
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [platformName, setPlatformName] = useState('')
  const [inferring, setInferring] = useState(false)
  const [confidence, setConfidence] = useState<number | null>(null)

  const headers = preview[0] || []

  useEffect(() => {
    setInferring(true)
    api.post('/import/infer', { file_id: fileId, preview })
      .then((res) => {
        setMapping(res.data.field_mapping || {})
        setConfidence(res.data.confidence)
      })
      .catch(() => {})
      .finally(() => setInferring(false))
  }, [fileId])

  const updateMapping = (srcCol: string, stdField: string) => {
    const next = { ...mapping }
    if (stdField) {
      next[srcCol] = stdField
    } else {
      delete next[srcCol]
    }
    setMapping(next)
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">AI 推断结果</h3>
        {inferring ? (
          <p className="text-blue-700 text-sm">正在分析文件结构...</p>
        ) : (
          <p className="text-blue-700 text-sm">
            {confidence !== null
              ? `推断完成（置信度: ${(confidence * 100).toFixed(0)}%），请确认并调整下方的映射关系`
              : '推断失败，请手动配置映射'}
          </p>
        )}
      </div>

      <div className="bg-white rounded-lg border p-4">
        <h4 className="font-medium mb-3">列映射配置</h4>
        {headers.map((col) => (
          <div key={col} className="flex items-center gap-3 py-2 border-b border-gray-50">
            <span className="w-40 text-sm font-medium text-gray-700 truncate" title={col}>
              {col}
            </span>
            <span className="text-gray-300">→</span>
            <select
              value={mapping[col] || ''}
              onChange={(e) => updateMapping(col, e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 flex-1"
            >
              <option value="">忽略此列</option>
              {STANDARD_FIELDS.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">平台名称（用于保存模板）</label>
        <input
          type="text"
          value={platformName}
          onChange={(e) => setPlatformName(e.target.value)}
          placeholder="例如: 微信账单"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      <button
        onClick={() => onConfirmed(platformName || '未命名平台', mapping)}
        disabled={!platformName || Object.keys(mapping).length === 0}
        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
      >
        确认并保存模板
      </button>
    </div>
  )
}
