import { CalendarDay } from '../../lib/types'

function Skeleton() {
  return (
    <div className="grid grid-cols-7 gap-0.5 animate-pulse">
      {Array.from({ length: 35 }).map((_, i) => (
        <div key={i} className="h-7 bg-gray-100 rounded" />
      ))}
    </div>
  )
}

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']

export default function CalendarView({
  year, month, data, isLoading, error, selectedDate, onSelectDate,
}: {
  year: number
  month: number
  data?: CalendarDay[]
  isLoading: boolean
  error: Error | null
  selectedDate: string | null
  onSelectDate: (date: string | null) => void
}) {
  if (isLoading) return <Skeleton />
  if (error) return <div className="text-[10px] text-red-600">加载失败：{error.message}</div>

  const dayMap = new Map<string, CalendarDay>()
  if (data) {
    for (const d of data) {
      dayMap.set(d.date, d)
    }
  }

  const maxExpense = data && data.length > 0
    ? Math.max(...data.map((d) => parseFloat(d.expense)))
    : 1

  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDow = new Date(year, month - 1, 1).getDay()

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const pad = (n: number) => String(n).padStart(2, '0')
  const monthStr = pad(month)

  function bgIntensity(expense: number): string {
    if (expense === 0) return 'bg-gray-50'
    const ratio = expense / maxExpense
    if (ratio > 0.66) return 'bg-red-200'
    if (ratio > 0.33) return 'bg-red-100'
    return 'bg-red-50'
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-0.5 mb-0.5">
        {DAY_NAMES.map((n) => (
          <div key={n} className="text-center text-[10px] text-gray-400">{n}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} className="h-7" />

          const dateStr = `${year}-${monthStr}-${pad(day)}`
          const entry = dayMap.get(dateStr)
          const expense = entry ? parseFloat(entry.expense) : 0
          const isSelected = dateStr === selectedDate

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(isSelected ? null : dateStr)}
              className={`h-7 rounded flex flex-col items-center justify-center text-[10px] leading-tight transition ${
                isSelected
                  ? 'ring-1 ring-blue-500 bg-blue-50'
                  : `${bgIntensity(expense)} hover:bg-gray-200`
              }`}
            >
              <span className={`font-medium ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>{day}</span>
              {expense > 0 && (
                <span className={`text-[8px] leading-none ${isSelected ? 'text-blue-500' : 'text-red-400'}`}>
                  {Math.round(expense)}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {selectedDate && (
        <div className="mt-1 text-center">
          <button
            onClick={() => onSelectDate(null)}
            className="text-[10px] text-blue-600 hover:underline"
          >
            清除
          </button>
        </div>
      )}
    </div>
  )
}
