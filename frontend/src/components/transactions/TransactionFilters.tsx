import { useFilterStore } from '../../stores/filterStore'
import { TX_TYPE_LABELS } from '../../lib/constants'

export default function TransactionFilters() {
  const { type, dateFrom, dateTo, setType, setDateRange, reset } = useFilterStore()

  return (
    <div className="flex flex-wrap gap-3 items-center bg-white p-4 rounded-lg shadow-sm mb-4">
      <select
        value={type || ''}
        onChange={(e) => setType(e.target.value || null)}
        className="text-sm border border-gray-300 rounded-lg px-3 py-2"
      >
        <option value="">全部类型</option>
        {Object.entries(TX_TYPE_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      <input
        type="date"
        value={dateFrom || ''}
        onChange={(e) => setDateRange(e.target.value || null, dateTo)}
        className="text-sm border border-gray-300 rounded-lg px-3 py-2"
      />
      <span className="text-gray-400 text-sm">至</span>
      <input
        type="date"
        value={dateTo || ''}
        onChange={(e) => setDateRange(dateFrom, e.target.value || null)}
        className="text-sm border border-gray-300 rounded-lg px-3 py-2"
      />
      <button
        onClick={reset}
        className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
      >
        重置
      </button>
    </div>
  )
}
