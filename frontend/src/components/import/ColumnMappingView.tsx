import { useState } from 'react'

interface Props {
  headers: string[]
  mapping: Record<string, string>
  onChange: (srcCol: string, stdField: string) => void
  disabled?: boolean
}

const STANDARD_FIELDS = [
  { key: 'transaction_date', label: '交易时间' },
  { key: 'amount', label: '金额' },
  { key: 'type', label: '收支方向' },
  { key: 'merchant_name', label: '商户名称' },
  { key: 'description', label: '商品描述' },
  { key: 'external_tx_id', label: '外部交易单号' },
  { key: 'merchant_order_id', label: '商户单号' },
  { key: 'transaction_status', label: '当前状态' },
  { key: 'source_category', label: '交易类型' },
  { key: 'currency', label: '币种' },
  { key: 'account_id', label: '账户ID（自动绑定）' },
  { key: 'original_currency', label: '原始币种' },
  { key: 'original_amount', label: '原始金额' },
  { key: 'base_currency', label: '基础币种' },
  { key: 'base_amount', label: '基础金额' },
  { key: 'remark', label: '备注' },
]

const CUSTOM_VALUE = '__custom__'

export default function ColumnMappingView({ headers, mapping, onChange, disabled }: Props) {
  const [customKeys, setCustomKeys] = useState<Record<string, string>>({})

  const isKnown = (col: string) =>
    STANDARD_FIELDS.some((f) => f.key === mapping[col])

  const selectValue = (col: string) => {
    const v = mapping[col]
    if (!v) return ''
    if (isKnown(col)) return v
    return CUSTOM_VALUE
  }

  const handleSelect = (col: string, value: string) => {
    if (value === CUSTOM_VALUE) {
      // Switch to custom input mode — keep existing custom value or clear
      setCustomKeys((prev) => ({ ...prev, [col]: mapping[col] || '' }))
      onChange(col, mapping[col] || '')
    } else {
      setCustomKeys((prev) => {
        const next = { ...prev }
        delete next[col]
        return next
      })
      onChange(col, value)
    }
  }

  const handleCustomInput = (col: string, value: string) => {
    setCustomKeys((prev) => ({ ...prev, [col]: value }))
    onChange(col, value)
  }

  return (
    <div className="bg-white rounded-lg border p-4">
      <h4 className="font-medium mb-3">列映射配置</h4>
      <p className="text-xs text-gray-400 mb-3">
        为每个文件列选择对应的标准字段，或选择"自定义"输入自己的字段名。
      </p>
      {headers.map((col) => (
        <div key={col} className="py-3 border-b border-gray-50">
          <span className="block text-sm font-medium text-gray-700 truncate mb-1" title={col}>
            {col}
          </span>
          <div className="flex items-center gap-2">
            <select
              value={selectValue(col)}
              onChange={(e) => handleSelect(col, e.target.value)}
              disabled={disabled}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 min-w-0 flex-1 disabled:opacity-50 disabled:bg-gray-50 bg-white"
            >
              <option value="">-- 不映射 --</option>
              <option disabled>── 常用字段 ──</option>
              {STANDARD_FIELDS.slice(0, 10).map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
              <option disabled>── 其他字段 ──</option>
              {STANDARD_FIELDS.slice(10).map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
              <option disabled>──</option>
              <option value={CUSTOM_VALUE}>✎ 自定义...</option>
            </select>
            {selectValue(col) === CUSTOM_VALUE && (
              <input
                type="text"
                value={customKeys[col] ?? ''}
                onChange={(e) => handleCustomInput(col, e.target.value)}
                disabled={disabled}
                placeholder="输入字段名..."
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 w-36 disabled:opacity-50 disabled:bg-gray-50"
              />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
