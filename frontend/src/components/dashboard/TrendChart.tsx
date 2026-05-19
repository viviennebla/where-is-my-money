import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { TrendItem } from '../../lib/types'
import { Granularity } from './GranularitySwitcher'

function Skeleton() {
  return <div className="h-72 bg-gray-100 rounded-lg animate-pulse" />
}

function fmtLabel(period: string, granularity: Granularity): string {
  if (granularity === 'quarter') {
    // "2026-Q1" → "Q1"
    const m = period.match(/Q(\d)$/)
    return m ? `Q${m[1]}` : period
  }
  // Daily: "2026-05-18" → "5/18" or just "18" for current month
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    const parts = period.split('-')
    return `${parseInt(parts[1])}/${parseInt(parts[2])}`
  }
  // Monthly: "2026-05" → "5月"
  if (/^\d{4}-\d{2}$/.test(period)) {
    return `${parseInt(period.slice(5))}月`
  }
  // Weekly: "2026-W20" → "W20"
  if (/W\d/.test(period)) {
    const m = period.match(/W(\d+)$/)
    return m ? `W${m[1]}` : period
  }
  return period
}

export default function TrendChart({ data, granularity, isLoading, error }: {
  data?: TrendItem[]
  granularity: Granularity
  isLoading: boolean
  error: Error | null
}) {
  if (isLoading) return <Skeleton />
  if (error) return <div className="text-sm text-red-600">加载失败：{error.message}</div>
  if (!data || data.length === 0) return <div className="h-72 flex items-center justify-center text-sm text-gray-400">暂无趋势数据</div>

  const chartData = data.map((d) => ({
    label: fmtLabel(d.period, granularity),
    period: d.period,
    expense: parseFloat(d.expense),
    income: parseFloat(d.income),
    net: parseFloat(d.income) - parseFloat(d.expense),
  }))

  const fmtCurrency = (v: number) => `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
  const fmtLabelMap: Record<string, string> = { expense: '支出', income: '收入', net: '结余' }

  const xInterval = chartData.length > 20 ? Math.floor(chartData.length / 10) : 0

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" fontSize={10} tick={{ fill: '#9ca3af' }} interval={xInterval} />
        <YAxis fontSize={12} tick={{ fill: '#9ca3af' }} tickFormatter={(v: number) => `¥${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          formatter={(value: number, name: string) => [fmtCurrency(value), fmtLabelMap[name] || name]}
          labelFormatter={(label: string, payload: any[]) => payload?.[0]?.payload?.period || label}
        />
        <Legend formatter={(v: string) => fmtLabelMap[v] || v} />
        <Bar dataKey="expense" fill="#f87171" radius={[4, 4, 0, 0]} barSize={chartData.length > 20 ? 8 : 20} />
        <Bar dataKey="income" fill="#4ade80" radius={[4, 4, 0, 0]} barSize={chartData.length > 20 ? 8 : 20} />
        <Line dataKey="net" stroke="#60a5fa" strokeWidth={2} dot={{ r: chartData.length > 20 ? 0 : 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
