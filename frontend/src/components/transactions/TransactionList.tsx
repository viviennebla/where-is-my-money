import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import { useFilterStore, PAGE_SIZES } from '../../stores/filterStore'
import { Transaction, TransactionListResponse } from '../../lib/types'
import TransactionRow from './TransactionRow'
import TransactionFilters from './TransactionFilters'
import TransactionEditor from './TransactionEditor'

interface Props {
  fixedAccountId?: string
}

export default function TransactionList({ fixedAccountId }: Props) {
  const { type, accountId, tagId, dateFrom, dateTo, search, sortBy, sortOrder, page, pageSize, setPage, setPageSize } = useFilterStore()

  const effectiveAccountId = fixedAccountId ?? accountId
  const queryClient = useQueryClient()
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

  const params: Record<string, string | number> = {}
  if (type) params.type = type
  if (effectiveAccountId) params.account_id = effectiveAccountId
  if (tagId) params.tag_id = tagId
  if (dateFrom) params.date_from = dateFrom
  if (dateTo) params.date_to = dateTo
  if (search) params.search = search
  if (sortBy) params.sort_by = sortBy
  if (sortOrder) params.sort_order = sortOrder
  params.page = page
  params.page_size = pageSize

  const { data, isLoading, error } = useQuery<TransactionListResponse>({
    queryKey: ['transactions', params],
    queryFn: () => api.get('/transactions', { params }).then((r) => r.data),
  })

  if (error) {
    return <p className="text-red-600 text-center py-8">加载失败，请检查网络连接。</p>
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endItem = Math.min(page * pageSize, total)

  return (
    <div>
      <TransactionFilters hideAccountFilter={!!fixedAccountId} />

      {isLoading ? (
        <p className="text-gray-500 text-center py-8">加载中...</p>
      ) : !data?.items?.length ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg mb-2">暂无交易记录</p>
          <p className="text-gray-400 text-sm">上传账单文件或手动添加一笔交易开始使用</p>
        </div>
      ) : (
        <div>
          <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                <tr>
                  <th className="py-3 px-2">日期</th>
                  <th className="py-3 px-2">账户</th>
                  <th className="py-3 px-2">类型</th>
                  <th className="py-3 px-2">标签</th>
                  <th className="py-3 px-2">交易对象</th>
                  <th className="py-3 px-2">描述</th>
                  <th className="py-3 px-2 text-right">金额</th>
                  <th className="py-3 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((tx: Transaction) => (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    onEditClick={(t) => setEditingTx(t)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <span>每页</span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
                className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
              >
                {PAGE_SIZES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <span>条 · 共 {total} 条</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <span className="px-2">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      )}

      <TransactionEditor
        open={editingTx !== null}
        tx={editingTx}
        onClose={() => setEditingTx(null)}
      />
    </div>
  )
}
