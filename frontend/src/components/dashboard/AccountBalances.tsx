import { AccountBalanceItem } from '../../lib/types'
import { ACCOUNT_TYPE_LABELS } from '../../lib/constants'

function fmt(n: string): string {
  const v = parseFloat(n)
  return '¥' + Math.abs(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2].map((i) => (
        <div key={i} className="h-12 bg-gray-200 rounded-lg" />
      ))}
    </div>
  )
}

export default function AccountBalances({ data, isLoading, error }: {
  data?: AccountBalanceItem[]
  isLoading: boolean
  error: Error | null
}) {
  if (isLoading) return <Skeleton />
  if (error) return <div className="text-sm text-red-600">加载失败：{error.message}</div>
  if (!data || data.length === 0) return <div className="text-sm text-gray-400">暂无账户</div>

  const maxAbs = Math.max(...data.map((a) => Math.abs(parseFloat(a.current_balance))), 1)

  return (
    <div className="space-y-3">
      {data.map((a) => {
        const bal = parseFloat(a.current_balance)
        const pct = Math.round((Math.abs(bal) / maxAbs) * 100)
        const typeLabel = ACCOUNT_TYPE_LABELS[a.account_type as keyof typeof ACCOUNT_TYPE_LABELS] || a.account_type
        return (
          <div key={a.id} className="flex items-center gap-3">
            <div className="w-32 text-sm font-medium text-gray-700 truncate" title={a.name}>
              {a.name}
            </div>
            <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${bal >= 0 ? 'bg-green-400' : 'bg-red-400'}`}
                style={{ width: `${pct}%`, minWidth: bal !== 0 ? '4px' : '0' }}
              />
            </div>
            <div className={`w-32 text-right text-sm font-semibold ${bal >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {bal >= 0 ? '' : '-'}{fmt(a.current_balance)}
            </div>
            <div className="w-16 text-right text-xs text-gray-400">{typeLabel}</div>
          </div>
        )
      })}
    </div>
  )
}
