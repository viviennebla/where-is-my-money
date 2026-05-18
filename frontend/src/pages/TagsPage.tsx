import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { Tag } from '../lib/types'

const EMOJI_SUGGESTIONS = ['🍽️', '🚗', '🏠', '🎮', '🏥', '🛒', '📚', '📱', '👔', '💄', '⚽', '✈️', '🐱', '🎁', '💼', '💸', '💰', '↩️', '🧪', '🏷️']

export default function TagsPage() {
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmoji, setEditEmoji] = useState('')

  const { data: tags } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: () => api.get('/tags').then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: { name: string; emoji?: string }) =>
      api.post('/tags', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      setNewName('')
      setNewEmoji('')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; emoji?: string }) =>
      api.put(`/tags/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      setEditId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tags/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tags'] }),
  })

  const systemTags = tags?.filter((t) => t.is_system_default) || []
  const customTags = tags?.filter((t) => !t.is_system_default) || []

  const startEdit = (tag: Tag) => {
    setEditId(tag.id)
    setEditName(tag.name)
    setEditEmoji(tag.emoji || '')
  }

  const cancelEdit = () => setEditId(null)

  const saveEdit = (id: string) => {
    updateMutation.mutate({ id, name: editName, emoji: editEmoji || undefined })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">标签管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理交易分类标签，自定义你的消费分类体系</p>
        </div>
        <span className="text-sm text-gray-400">{tags?.length || 0} 个标签</span>
      </div>

      {/* Create new tag */}
      <div className="bg-white rounded-lg shadow-sm p-5">
        <h2 className="font-medium mb-4">新建标签</h2>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs text-gray-500 mb-1">标签名称</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) createMutation.mutate({ name: newName, emoji: newEmoji || undefined }) }}
              placeholder="例如：咖啡、房租"
              maxLength={50}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">图标</label>
            <div className="flex gap-1 items-center">
              <input
                type="text"
                value={newEmoji}
                onChange={(e) => setNewEmoji(e.target.value)}
                placeholder="🏷️"
                maxLength={10}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-16 text-center focus:ring-2 focus:ring-slate-200 focus:border-slate-400 outline-none"
              />
              <div className="hidden md:flex gap-0.5 ml-1">
                {EMOJI_SUGGESTIONS.slice(0, 8).map((e) => (
                  <button key={e} type="button" onClick={() => setNewEmoji(e)}
                    className={`w-7 h-7 flex items-center justify-center rounded text-sm hover:bg-gray-100 ${newEmoji === e ? 'bg-blue-50 ring-1 ring-blue-300' : ''}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={() => createMutation.mutate({ name: newName, emoji: newEmoji || undefined })}
            disabled={!newName.trim() || createMutation.isPending}
            className="px-5 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 font-medium"
          >
            {createMutation.isPending ? '创建中...' : '创建'}
          </button>
        </div>
      </div>

      {/* System default tags */}
      <div className="bg-white rounded-lg shadow-sm p-5">
        <h2 className="font-medium mb-4 text-sm text-gray-500 flex items-center gap-2">
          <span className="inline-block w-1 h-4 bg-gray-300 rounded-full"></span>
          系统默认标签
          <span className="text-xs text-gray-400">（只读）</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {systemTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm bg-gray-50 text-gray-600 border border-gray-100"
            >
              <span className="text-base leading-none">{tag.emoji}</span>
              <span>{tag.name}</span>
            </span>
          ))}
        </div>
      </div>

      {/* User custom tags */}
      <div className="bg-white rounded-lg shadow-sm p-5">
        <h2 className="font-medium mb-4 text-sm flex items-center gap-2">
          <span className="inline-block w-1 h-4 bg-blue-400 rounded-full"></span>
          自定义标签
        </h2>
        {customTags.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-3xl mb-2">🏷️</p>
            <p className="text-sm">还没有自定义标签</p>
            <p className="text-xs mt-1">上方创建新标签开始使用</p>
          </div>
        ) : (
          <div className="space-y-1">
            {customTags.map((tag) => (
              <div key={tag.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 group">
                {editId === tag.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={editEmoji}
                      onChange={(e) => setEditEmoji(e.target.value)}
                      className="px-2 py-1.5 border border-gray-300 rounded text-sm w-14 text-center"
                      maxLength={10}
                    />
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(tag.id) }}
                      className="px-2 py-1.5 border border-gray-300 rounded text-sm flex-1"
                      maxLength={50}
                      autoFocus
                    />
                    <button
                      onClick={() => saveEdit(tag.id)}
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
                      <span className="text-base leading-none">{tag.emoji || '🏷️'}</span>
                      <span>{tag.name}</span>
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(tag)}
                        className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`确定删除标签"${tag.name}"？关联该标签的交易将保留但不再显示此标签。`)) {
                            deleteMutation.mutate(tag.id)
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
