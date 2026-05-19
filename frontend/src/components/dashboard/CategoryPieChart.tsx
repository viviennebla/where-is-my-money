import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { CategoryItem } from '../../lib/types'

const COLORS = [
  '#f87171', '#60a5fa', '#4ade80', '#fbbf24', '#a78bfa',
  '#fb923c', '#34d399', '#f472b6', '#818cf8', '#a3e635',
]

function Skeleton() {
  return <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
}

export default function CategoryPieChart({ data, title, isLoading, error }: {
  data?: CategoryItem[]
  title: string
  isLoading: boolean
  error: Error | null
}) {
  if (isLoading) return <Skeleton />
  if (error) return <div className="text-sm text-red-600">加载失败：{error.message}</div>
  if (!data || data.length === 0) return (
    <div className="h-64 flex items-center justify-center text-sm text-gray-400">暂无类别数据</div>
  )

  const total = data.reduce((s, d) => s + parseFloat(d.amount), 0)

  // Merge items < 5% into "其他", merge 退款 into income/expense
  const threshold = total * 0.05
  const main: { name: string; value: number }[] = []
  let otherValue = 0
  for (const d of data) {
    const v = parseFloat(d.amount)
    const name = d.category || '未分类'
    if (name.includes('退款')) {
      otherValue += v
    } else if (v < threshold || main.length >= 8) {
      otherValue += v
    } else {
      main.push({ name, value: v })
    }
  }
  if (otherValue > 0) {
    main.push({ name: '其他', value: otherValue })
  }

  return (
    <div>
      <div className="text-sm font-medium text-gray-600 mb-2">{title}</div>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={main}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {main.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [`¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`]}
          />
          <Legend
            formatter={(value: string) => <span className="text-xs text-gray-600">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
