import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '../../stores/filterStore'
import { TX_TYPE_LABELS } from '../../lib/constants'
import { Account, Tag } from '../../lib/types'
import api from '../../api/client'

interface Props {
  hideAccountFilter?: boolean
}

export default function TransactionFilters({ hideAccountFilter }: Props) {
  const {
    type, accountId, tagId, dateFrom, dateTo, search, sortBy, sortOrder,
    setType, setAccountId, setTagId, setDateRange, setSearch, setSortBy, setSortOrder, reset,
  } = useFilterStore()

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts').then((r) => r.data),
  })

  const { data: tags } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: () => api.get('/tags').then((r) => r.data),
  })

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm mb-4 space-y-3">
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={search || ''}
          onChange={(e) => setSearch(e.target.value || null)}
          placeholder="搜索交易对象、描述..."
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 w-48"
        />

        <select
          value={type || ''}
          onChange={(e) => setType(e.target.value || null)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
        >
          <option value="">全部类型</option>
          {Object.entries(TX_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        {!hideAccountFilter && (
          <select
            value={accountId || ''}
            onChange={(e) => setAccountId(e.target.value || null)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value="">全部账户</option>
            {accounts?.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}

        <select
          value={tagId || ''}
          onChange={(e) => setTagId(e.target.value || null)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
        >
          <option value="">全部标签</option>
          {tags?.map((t) => (
            <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
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

      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500">排序:</span>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
        >
          <option value="date">日期</option>
          <option value="amount">金额</option>
          <option value="type">类型</option>
        </select>
        <button
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          className="border border-gray-300 rounded px-2 py-1 hover:bg-gray-50"
          title={sortOrder === 'asc' ? '升序' : '降序'}
        >
          {sortOrder === 'asc' ? '↑ 升序' : '↓ 降序'}
        </button>
      </div>
    </div>
  )
}
