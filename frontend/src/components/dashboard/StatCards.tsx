import { StatSummary } from '../../lib/types'

function fmt(n: string | number): string {
  const v = typeof n === 'string' ? parseFloat(n) : n
  return '¥' + Math.abs(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function Skeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="bg-white rounded-xl shadow-sm p-5 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-12 mb-3" />
          <div className="h-7 bg-gray-200 rounded w-24" />
        </div>
      ))}
    </div>
  )
}

export default function StatCards({ data, isLoading, error, compact }: {
  data?: StatSummary
  isLoading: boolean
  error: Error | null
  compact?: boolean
}) {
  if (isLoading) {
    if (compact) return <div className="space-y-2">{Array.from({length:5}).map((_,i)=><div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse"/>)}</div>
    return <Skeleton />
  }

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
      加载失败：{error.message}
    </div>
  )

  if (!data) return null

  const net = parseFloat(data.net)
  const assets = parseFloat(data.total_assets)
  const cards = [
    { label: '总资产', value: fmt(data.total_assets), sub: '', color: assets >= 0 ? 'text-blue-600' : 'text-red-600' },
    { label: '支出', value: fmt(data.expense), sub: '', color: 'text-red-600' },
    { label: '收入', value: fmt(data.income), sub: '', color: 'text-green-600' },
    { label: '结余', value: (net >= 0 ? '+' : '') + fmt(data.net), sub: '', color: net >= 0 ? 'text-green-600' : 'text-red-600' },
    { label: '交易笔数', value: String(data.tx_count), sub: '笔', color: 'text-gray-800' },
  ]

  if (compact) {
    return (
      <div className="space-y-2">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-lg border border-gray-100 p-3 flex justify-between items-center">
            <span className="text-xs text-gray-500">{c.label}</span>
            <span className={`text-sm font-bold ${c.color}`}>{c.value}{c.sub ? <span className="text-xs font-normal text-gray-400 ml-1">{c.sub}</span> : null}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-xl shadow-sm p-5">
          <div className="text-xs text-gray-500 mb-1">{c.label}</div>
          <div className={`text-xl font-bold ${c.color}`}>
            {c.value}
            {c.sub && <span className="text-sm font-normal text-gray-400 ml-1">{c.sub}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
