import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { TagRule, Tag } from '../lib/types'

const FIELD_LABELS: Record<string, string> = {
  merchant_name: '交易对象',
  description: '描述',
  source_category: '来源分类',
}

export default function TagRulesPage() {
  const queryClient = useQueryClient()
  const [newField, setNewField] = useState('merchant_name')
  const [newKeyword, setNewKeyword] = useState('')
  const [newTagId, setNewTagId] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editField, setEditField] = useState('')
  const [editKeyword, setEditKeyword] = useState('')
  const [editTagId, setEditTagId] = useState('')

  const { data: rules } = useQuery<TagRule[]>({
    queryKey: ['tag-rules'],
    queryFn: () => api.get('/tag-rules').then((r) => r.data),
  })

  const { data: tags } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: () => api.get('/tags').then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: { field: string; keyword: string; tag_id: string }) =>
      api.post('/tag-rules', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tag-rules'] })
      setNewKeyword('')
      setNewTagId('')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; field?: string; keyword?: string; tag_id?: string }) =>
      api.put(`/tag-rules/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tag-rules'] })
      setEditId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tag-rules/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tag-rules'] }),
  })

  const systemRules = rules?.filter((r) => r.is_system_default) || []
  const customRules = rules?.filter((r) => !r.is_system_default) || []

  const startEdit = (rule: TagRule) => {
    setEditId(rule.id)
    setEditField(rule.field)
    setEditKeyword(rule.keyword)
    setEditTagId(rule.tag_id)
  }

  const cancelEdit = () => setEditId(null)

  const saveEdit = (id: string) => {
    updateMutation.mutate({ id, field: editField, keyword: editKeyword, tag_id: editTagId })
  }

  const findTag = (tagId: string) => tags?.find((t) => t.id === tagId)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">标签匹配规则</h1>
          <p className="text-sm text-gray-500 mt-1">设置关键词匹配规则，导入时自动为交易打标签</p>
        </div>
        <span className="text-sm text-gray-400">{rules?.length || 0} 条规则</span>
      </div>

      {/* Create new rule */}
      <div className="bg-white rounded-lg shadow-sm p-5">
        <h2 className="font-medium mb-4">新建规则</h2>
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">匹配字段</label>
            <select
              value={newField}
              onChange={(e) => setNewField(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              {Object.entries(FIELD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs text-gray-500 mb-1">关键词</label>
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newKeyword.trim() && newTagId) createMutation.mutate({ field: newField, keyword: newKeyword, tag_id: newTagId }) }}
              placeholder="例如：美团"
              maxLength={100}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">匹配标签</label>
            <select
              value={newTagId}
              onChange={(e) => setNewTagId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">选择标签</option>
              {tags?.map((t) => (
                <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => createMutation.mutate({ field: newField, keyword: newKeyword, tag_id: newTagId })}
            disabled={!newKeyword.trim() || !newTagId || createMutation.isPending}
            className="px-5 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 font-medium"
          >
            {createMutation.isPending ? '创建中...' : '创建'}
          </button>
        </div>
      </div>

      {/* System default rules */}
      <div className="bg-white rounded-lg shadow-sm p-5">
        <h2 className="font-medium mb-4 text-sm text-gray-500 flex items-center gap-2">
          <span className="inline-block w-1 h-4 bg-gray-300 rounded-full"></span>
          系统默认规则
          <span className="text-xs text-gray-400">（只读）</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {systemRules.map((rule) => {
            const tag = rule.tag || findTag(rule.tag_id)
            return (
              <span
                key={rule.id}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm bg-gray-50 text-gray-600 border border-gray-100"
              >
                <span className="text-gray-400 text-xs">{FIELD_LABELS[rule.field] || rule.field}:</span>
                <span className="font-medium">"{rule.keyword}"</span>
                <span className="text-gray-400">→</span>
                <span>{tag?.emoji} {tag?.name || rule.tag_id}</span>
              </span>
            )
          })}
        </div>
      </div>

      {/* User custom rules */}
      <div className="bg-white rounded-lg shadow-sm p-5">
        <h2 className="font-medium mb-4 text-sm flex items-center gap-2">
          <span className="inline-block w-1 h-4 bg-blue-400 rounded-full"></span>
          自定义规则
        </h2>
        {customRules.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-3xl mb-2">🔧</p>
            <p className="text-sm">还没有自定义规则</p>
            <p className="text-xs mt-1">上方新建规则开始使用</p>
          </div>
        ) : (
          <div className="space-y-1">
            {customRules.map((rule) => {
              const tag = rule.tag || findTag(rule.tag_id)
              return (
                <div key={rule.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 group">
                  {editId === rule.id ? (
                    <div className="flex items-center gap-2 flex-1 flex-wrap">
                      <select
                        value={editField}
                        onChange={(e) => setEditField(e.target.value)}
                        className="px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
                      >
                        {Object.entries(FIELD_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={editKeyword}
                        onChange={(e) => setEditKeyword(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(rule.id) }}
                        className="px-2 py-1.5 border border-gray-300 rounded text-sm flex-1 min-w-[100px]"
                        maxLength={100}
                      />
                      <select
                        value={editTagId}
                        onChange={(e) => setEditTagId(e.target.value)}
                        className="px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
                      >
                        {tags?.map((t) => (
                          <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => saveEdit(rule.id)}
                        disabled={updateMutation.isPending}
                        className="px-3 py-1.5 text-xs bg-slate-800 text-white rounded-md hover:bg-slate-700 font-medium"
                      >
                        保存
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-blue-50 text-blue-700 border border-blue-100">
                        <span className="text-blue-400 text-xs">{FIELD_LABELS[rule.field] || rule.field}:</span>
                        <span className="font-medium">"{rule.keyword}"</span>
                        <span className="text-blue-400">→</span>
                        <span>{tag?.emoji} {tag?.name || rule.tag_id}</span>
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEdit(rule)}
                          className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`确定删除规则 "${rule.keyword}" → ${tag?.name || ''}？`)) {
                              deleteMutation.mutate(rule.id)
                            }
                          }}
                          className="px-2 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          删除
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
