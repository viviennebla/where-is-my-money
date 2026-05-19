import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { MerchantItem } from '../../lib/types'

function Skeleton() {
  return <div className="h-72 bg-gray-100 rounded-lg animate-pulse" />
}

export default function MerchantRanking({ data, isLoading, error }: {
  data?: MerchantItem[]
  isLoading: boolean
  error: Error | null
}) {
  if (isLoading) return <Skeleton />
  if (error) return <div className="text-sm text-red-600">加载失败：{error.message}</div>
  if (!data || data.length === 0) return (
    <div className="h-72 flex items-center justify-center text-sm text-gray-400">暂无商户数据</div>
  )

  const chartData = data.map((d) => ({
    name: d.merchant.length > 8 ? d.merchant.slice(0, 8) + '…' : d.merchant,
    fullName: d.merchant,
    amount: parseFloat(d.amount),
  }))

  return (
    <div>
      <div className="text-sm font-medium text-gray-600 mb-2">商户支出排名 (Top {data.length})</div>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 32)}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
          <XAxis type="number" fontSize={11} tick={{ fill: '#9ca3af' }} tickFormatter={(v: number) => `¥${v}`} />
          <YAxis type="category" dataKey="name" fontSize={12} tick={{ fill: '#6b7280' }} width={80} />
          <Tooltip
            formatter={(value: number) => [`¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`]}
            labelFormatter={(label: string, payload: any[]) => payload?.[0]?.payload?.fullName || label}
          />
          <Bar dataKey="amount" fill="#60a5fa" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
