import {
  ComposedChart, Bar, Line, LineChart, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { TrendItem } from '../../lib/types'
import { Granularity } from './GranularitySwitcher'

function Skeleton() {
  return <div className="h-72 bg-gray-100 rounded-lg animate-pulse" />
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
    label: d.period,
    expense: parseFloat(d.expense),
    income: parseFloat(d.income),
    net: parseFloat(d.income) - parseFloat(d.expense),
  }))

  const fmtCurrency = (v: number) => `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
  const fmtLabel: Record<string, string> = { expense: '支出', income: '收入', net: '结余' }

  // Day granularity: pure line chart
  if (granularity === 'day') {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" fontSize={10} tick={{ fill: '#9ca3af' }} interval={Math.max(0, Math.floor(chartData.length / 10) - 1)} />
          <YAxis fontSize={12} tick={{ fill: '#9ca3af' }} tickFormatter={(v: number) => `¥${(v / 1000).toFixed(0)}k`} />
          <Tooltip formatter={(value: number, name: string) => [fmtCurrency(value), fmtLabel[name] || name]} />
          <Legend formatter={(v: string) => fmtLabel[v] || v} />
          <Line type="monotone" dataKey="expense" stroke="#f87171" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="income" stroke="#4ade80" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" fontSize={11} tick={{ fill: '#9ca3af' }} />
        <YAxis fontSize={12} tick={{ fill: '#9ca3af' }} tickFormatter={(v: number) => `¥${(v / 1000).toFixed(0)}k`} />
        <Tooltip formatter={(value: number, name: string) => [fmtCurrency(value), fmtLabel[name] || name]} />
        <Legend formatter={(v: string) => fmtLabel[v] || v} />
        <Bar dataKey="expense" fill="#f87171" radius={[4, 4, 0, 0]} barSize={20} />
        <Bar dataKey="income" fill="#4ade80" radius={[4, 4, 0, 0]} barSize={20} />
        <Line dataKey="net" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
