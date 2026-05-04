import { useState, useEffect } from 'react'
import api from '../../api/client'
import { Tag } from '../../lib/types'

interface Props {
  open: boolean
  txId: string | null
  onClose: () => void
  onSaved: () => void
}

export default function TagEditor({ open, txId, onClose, onSaved }: Props) {
  const [tags, setTags] = useState<Tag[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      api.get('/tags').then((res) => setTags(res.data))
      setSelectedIds(new Set())
    }
  }, [open])

  const toggle = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const save = async () => {
    if (!txId) return
    setLoading(true)
    try {
      await api.put(`/transactions/${txId}`, { tag_ids: [...selectedIds] })
      onSaved()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
        <h3 className="font-semibold text-lg mb-4">编辑分类标签</h3>
        <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => toggle(tag.id)}
              className={`px-3 py-1 rounded-full text-sm transition ${
                selectedIds.has(tag.id)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tag.emoji} {tag.name}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            取消
          </button>
          <button
            onClick={save}
            disabled={loading}
            className="px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
