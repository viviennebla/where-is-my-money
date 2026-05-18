import { useState } from 'react'
import { ImportTemplate } from '../lib/types'
import { STANDARD_FIELDS } from '../lib/constants'

interface Props {
  template: ImportTemplate
  onClose: () => void
  onSaveAndReapply: (id: string, name: string, mapping: Record<string, string>) => void
  onSaveAsNew: (name: string, mapping: Record<string, string>) => void
}

export default function TemplateEditor({ template, onClose, onSaveAndReapply, onSaveAsNew }: Props) {
  const [platformName, setPlatformName] = useState(template.platform_name)
  const [entries, setEntries] = useState<[string, string][]>(
    () => Object.entries(template.field_mapping)
  )
  const [saving, setSaving] = useState<string | null>(null) // 'reapply' | 'save-as'

  function updateSourceKey(index: number, val: string) {
    setEntries(prev => prev.map((e, i) => i === index ? [val, e[1]] : e))
  }

  function updateTarget(index: number, val: string) {
    setEntries(prev => prev.map((e, i) => i === index ? [e[0], val] : e))
  }

  function addEntry() {
    setEntries(prev => [...prev, ['', '']])
  }

  function removeEntry(index: number) {
    setEntries(prev => prev.filter((_, i) => i !== index))
  }

  function getMapping(): Record<string, string> {
    const m: Record<string, string> = {}
    for (const [k, v] of entries) {
      if (k.trim() && v.trim()) m[k.trim()] = v.trim()
    }
    return m
  }

  async function handleReapply() {
    setSaving('reapply')
    await onSaveAndReapply(template.id, platformName.trim(), getMapping())
  }

  async function handleSaveAs() {
    setSaving('save-as')
    await onSaveAsNew(platformName.trim(), getMapping())
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">编辑模板</h2>

        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-1">平台名称</label>
          <input
            type="text"
            value={platformName}
            onChange={e => setPlatformName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-600">字段映射</label>
            <button onClick={addEntry} className="text-xs text-blue-600 hover:text-blue-700">+ 添加</button>
          </div>
          <div className="space-y-2">
            {entries.map(([src, tgt], i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={src}
                  onChange={e => updateSourceKey(i, e.target.value)}
                  placeholder="Excel列名"
                  className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm"
                />
                <span className="text-gray-400 self-center">→</span>
                <select
                  value={tgt}
                  onChange={e => updateTarget(i, e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm bg-white"
                >
                  <option value="">选择...</option>
                  {STANDARD_FIELDS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
                <button onClick={() => removeEntry(i)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 justify-end border-t pt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">取消</button>
          <button
            onClick={handleSaveAs}
            disabled={!platformName.trim() || saving !== null}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {saving === 'save-as' ? '保存中...' : '另存为新模板'}
          </button>
          <button
            onClick={handleReapply}
            disabled={!platformName.trim() || saving !== null}
            className="px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
          >
            {saving === 'reapply' ? '保存中...' : '保存并更新历史数据'}
          </button>
        </div>
      </div>
    </div>
  )
}
