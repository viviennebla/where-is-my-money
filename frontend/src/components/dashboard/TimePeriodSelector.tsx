const THIS_YEAR = new Date().getFullYear()
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const YEARS = Array.from({ length: 7 }, (_, i) => THIS_YEAR - 3 + i)

export default function TimePeriodSelector({
  year, month, onChange,
}: {
  year: number | null
  month: number | null
  onChange: (year: number | null, month: number | null) => void
}) {
  const isCurrentYear = year === THIS_YEAR && month === null
  const isAll = year === null && month === null

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={year ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null, month)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
      >
        <option value="">所有年份</option>
        {YEARS.map((y) => (
          <option key={y} value={y}>{y}年</option>
        ))}
      </select>
      <select
        value={month ?? ''}
        onChange={(e) => onChange(year, e.target.value ? Number(e.target.value) : null)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
      >
        <option value="">所有月份</option>
        {MONTHS.map((m) => (
          <option key={m} value={m}>{m}月</option>
        ))}
      </select>
      <div className="flex gap-1">
        <button
          onClick={() => onChange(THIS_YEAR, null)}
          className={`px-3 py-1.5 text-xs rounded-md border ${
            isCurrentYear ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
          }`}
        >
          本年
        </button>
        <button
          onClick={() => onChange(null, null)}
          className={`px-3 py-1.5 text-xs rounded-md border ${
            isAll ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
          }`}
        >
          全部
        </button>
      </div>
    </div>
  )
}
