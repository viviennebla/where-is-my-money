import { useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { MonthlyTrendItem } from '../../lib/types'

function Skeleton() {
  return <div className="h-72 bg-gray-100 rounded-lg animate-pulse" />
}

export default function MonthlyTrendChart({ data, isLoading, error }: {
  data?: MonthlyTrendItem[]
  isLoading: boolean
  error: Error | null
}) {
  const [months, setMonths] = useState(6)

  if (isLoading) return <Skeleton />
  if (error) return <div className="text-sm text-red-600">加载失败：{error.message}</div>
  if (!data || data.length === 0) return <div className="h-72 flex items-center justify-center text-sm text-gray-400">暂无趋势数据</div>

  const chartData = data.map((d) => ({
    label: `${d.month}月`,
    expense: parseFloat(d.expense),
    income: parseFloat(d.income),
    net: parseFloat(d.income) - parseFloat(d.expense),
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-600">月度收支趋势</span>
        <div className="flex gap-1">
          {[6, 12].map((n) => (
            <button
              key={n}
              onClick={() => setMonths(n)}
              className={`px-3 py-1 text-xs rounded-md border ${
                months === n
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              近{n}月
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={chartData.slice(-months)}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" fontSize={12} tick={{ fill: '#9ca3af' }} />
          <YAxis fontSize={12} tick={{ fill: '#9ca3af' }} tickFormatter={(v: number) => `¥${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = { expense: '支出', income: '收入', net: '结余' }
              return [`¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`, labels[name] || name]
            }}
          />
          <Legend formatter={(v: string) => ({ expense: '支出', income: '收入', net: '结余' })[v] || v} />
          <Bar dataKey="expense" fill="#f87171" radius={[4, 4, 0, 0]} barSize={20} />
          <Bar dataKey="income" fill="#4ade80" radius={[4, 4, 0, 0]} barSize={20} />
          <Line dataKey="net" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
