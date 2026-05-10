import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { ImportTemplate } from '../lib/types'

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const { data, isLoading } = useQuery<{ has_key: boolean }>({
    queryKey: ['api-key-status'],
    queryFn: () => api.get('/settings/api-key').then((r) => r.data),
  })

  const { data: templates, isLoading: templatesLoading } = useQuery<ImportTemplate[]>({
    queryKey: ['templates'],
    queryFn: () => api.get('/settings/templates').then((r) => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: (key: string) => api.put('/settings/api-key', { api_key: key }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-key-status'] })
      setApiKey('')
      setErrorMsg(null)
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Save API key failed:', msg, err)
      setErrorMsg(msg)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete('/settings/api-key'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-key-status'] })
      setErrorMsg(null)
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Delete API key failed:', msg, err)
      setErrorMsg(msg)
    },
  })

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/settings/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
    },
  })

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!apiKey.trim()) return
    saveMutation.mutate(apiKey.trim())
  }

  if (isLoading) {
    return <div className="p-6 text-gray-500">Loading...</div>
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">设置</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-2">DeepSeek API Key</h2>
        <p className="text-sm text-gray-500 mb-4">
          设置你的 DeepSeek API Key 以使用 AI 功能（列推断、账户匹配、交易分类）
        </p>

        <div className="mb-4">
          <span className="text-sm text-gray-600">状态：</span>
          {data?.has_key ? (
            <span className="text-sm text-green-600 font-medium">已设置</span>
          ) : (
            <span className="text-sm text-orange-600 font-medium">未设置</span>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">API Key</label>
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={data?.has_key ? '输入新 Key 以替换' : '输入你的 DeepSeek API Key'}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg"
              >
                {showKey ? '隐藏' : '显示'}
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!apiKey.trim() || saveMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {saveMutation.isPending ? '保存中...' : '保存'}
            </button>

            {data?.has_key && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('确定要删除 API Key 吗？AI 功能将无法使用。')) {
                    deleteMutation.mutate()
                  }
                }}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100 disabled:opacity-50"
              >
                {deleteMutation.isPending ? '删除中...' : '删除'}
              </button>
            )}
          </div>

          {saveMutation.isSuccess && (
            <p className="text-sm text-green-600">API Key 已保存</p>
          )}
          {errorMsg && (
            <p className="text-sm text-red-600 break-all">保存失败：{errorMsg}</p>
          )}
        </form>
      </div>

      {/* Templates Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
        <h2 className="text-lg font-semibold mb-2">导入模板管理</h2>
        <p className="text-sm text-gray-500 mb-4">
          管理已保存的导入模板，可在导入时直接选择模板跳过 AI 分析步骤。
        </p>

        {templatesLoading ? (
          <p className="text-gray-500 text-sm">加载中...</p>
        ) : !templates?.length ? (
          <p className="text-gray-400 text-sm">暂无保存的模板</p>
        ) : (
          <div className="space-y-2">
            {templates.map((tmpl) => (
              <div key={tmpl.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-3 hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {tmpl.platform_name}
                    {tmpl.is_preset && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">预设</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    {Object.keys(tmpl.field_mapping).length} 个字段映射 · 更新于 {new Date(tmpl.updated_at).toLocaleDateString('zh-CN')}
                  </p>
                </div>
                {!tmpl.is_preset && (
                  <button
                    onClick={() => {
                      if (window.confirm(`确定要删除模板「${tmpl.platform_name}」吗？`)) {
                        deleteTemplateMutation.mutate(tmpl.id)
                      }
                    }}
                    disabled={deleteTemplateMutation.isPending}
                    className="px-3 py-1 text-xs text-red-500 hover:bg-red-50 rounded disabled:opacity-50"
                  >
                    删除
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
