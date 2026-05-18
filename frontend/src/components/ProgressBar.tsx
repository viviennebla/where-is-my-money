import { useEffect, useState, useRef } from 'react'
import api from '../api/client'

interface TaskProgress {
  type: string
  current: number
  total: number
  status: 'processing' | 'done' | 'error'
  message?: string
  result: { created: number; updated: number; matched_refunds?: number; diffs?: Array<{transaction_id: string; field: string; old: string; new: string}> } | null
  error: string | null
}

interface Props {
  taskId: string
  label: string
  onDone?: (result: TaskProgress['result']) => void
  onError?: (error: string) => void
}

export default function ProgressBar({ taskId, label, onDone, onError }: Props) {
  const [progress, setProgress] = useState<TaskProgress | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await api.get(`/tasks/${taskId}/progress`)
        setProgress(res.data)

        if (res.data.status === 'done') {
          clearInterval(timerRef.current)
          onDone?.(res.data.result)
        } else if (res.data.status === 'error') {
          clearInterval(timerRef.current)
          onError?.(res.data.error || 'Unknown error')
        }
      } catch {
        // Task may not be ready yet
      }
    }

    poll()
    timerRef.current = setInterval(poll, 1000)
    return () => clearInterval(timerRef.current)
  }, [taskId])

  if (!progress) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <p className="text-sm text-gray-500">{label} — 启动中...</p>
      </div>
    )
  }

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  if (progress.status === 'done') {
    return (
      <div className="bg-green-50 rounded-xl border border-green-200 p-4 mb-4">
        <p className="text-sm text-green-700 font-medium">✓ {label} — 完成</p>
        {progress.result && (
          <p className="text-xs text-green-600 mt-1">
            新建 {progress.result.created} · 更新 {progress.result.updated}
            {progress.result.matched_refunds != null && ` · 匹配退款 ${progress.result.matched_refunds}`}
            {progress.result.diffs && progress.result.diffs.length > 0 && ` · ${progress.result.diffs.length} 处字段可补充`}
          </p>
        )}
      </div>
    )
  }

  if (progress.status === 'error') {
    return (
      <div className="bg-red-50 rounded-xl border border-red-200 p-4 mb-4">
        <p className="text-sm text-red-700 font-medium">✗ {label} — 失败</p>
        <p className="text-xs text-red-600 mt-1">{progress.error || '未知错误'}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
      <p className="text-sm text-gray-700 mb-2">
        {label} · {progress.current}/{progress.total} · {pct}%
      </p>
      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
        <div
          className="bg-slate-800 h-2 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      {progress.message && (
        <p className="text-xs text-slate-500 animate-pulse">{progress.message}</p>
      )}
    </div>
  )
}
