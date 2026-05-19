import { StatSummary } from '../../lib/types'

function fmt(n: string | number): string {
  const v = typeof n === 'string' ? parseFloat(n) : n
  return '¥' + Math.abs(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function Skeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white rounded-xl shadow-sm p-5 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-12 mb-3" />
          <div className="h-7 bg-gray-200 rounded w-24" />
          <div className="h-3 bg-gray-100 rounded w-16 mt-2" />
        </div>
      ))}
    </div>
  )
}

export default function StatCards({ data, isLoading, error }: {
  data?: StatSummary
  isLoading: boolean
  error: Error | null
}) {
  if (isLoading) return <Skeleton />

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
      加载失败：{error.message}
    </div>
  )

  if (!data) return null

  const net = parseFloat(data.net)
  const cards = [
    { label: '支出', value: fmt(data.expense), sub: '', color: 'text-red-600' },
    { label: '收入', value: fmt(data.income), sub: '', color: 'text-green-600' },
    { label: '结余', value: (net >= 0 ? '+' : '') + fmt(data.net), sub: '', color: net >= 0 ? 'text-green-600' : 'text-red-600' },
    { label: '交易笔数', value: String(data.tx_count), sub: '笔', color: 'text-gray-800' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
