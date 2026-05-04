import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import { useFilterStore } from '../../stores/filterStore'
import { Transaction } from '../../lib/types'
import TransactionRow from './TransactionRow'
import TransactionFilters from './TransactionFilters'
import TagEditor from './TagEditor'

export default function TransactionList() {
  const { type, dateFrom, dateTo } = useFilterStore()
  const queryClient = useQueryClient()
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

  const params: Record<string, string> = {}
  if (type) params.type = type
  if (dateFrom) params.date_from = dateFrom
  if (dateTo) params.date_to = dateTo

  const { data, isLoading, error } = useQuery({
    queryKey: ['transactions', params],
    queryFn: () => api.get('/transactions', { params }).then((r) => r.data),
  })

  if (error) {
    return <p className="text-red-600 text-center py-8">加载失败，请检查网络连接。</p>
  }

  return (
    <div>
      <TransactionFilters />

      {isLoading ? (
        <p className="text-gray-500 text-center py-8">加载中...</p>
      ) : !data?.items?.length ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg mb-2">暂无交易记录</p>
          <p className="text-gray-400 text-sm">上传账单文件或手动添加一笔交易开始使用</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <tr>
                <th className="py-3 px-2">日期</th>
                <th className="py-3 px-2">类型</th>
                <th className="py-3 px-2">商户</th>
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
                  onTagClick={(t) => setEditingTx(t)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TagEditor
        open={editingTx !== null}
        txId={editingTx?.id || null}
        onClose={() => setEditingTx(null)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['transactions'] })}
      />
    </div>
  )
}
