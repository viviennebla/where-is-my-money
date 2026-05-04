import { useState } from 'react'
import api from '../../api/client'

interface Props {
  templateId: string
  onDone: (result: { created: number; updated: number; total: number }) => void
}

export default function ImportProgress({ templateId, onDone }: Props) {
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  const execute = async () => {
    setRunning(true)
    setError('')
    try {
      const res = await api.post('/import/execute', { template_id: templateId })
      onDone(res.data)
    } catch {
      setError('导入执行失败，请重试')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="text-center py-8">
      {error ? (
        <div>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={execute}
            className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
          >
            重试
          </button>
        </div>
      ) : (
        <div>
          <p className="text-gray-500 mb-4">模板已保存，点击下方按钮开始解析全量文件并导入</p>
          <button
            onClick={execute}
            disabled={running}
            className="px-6 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
          >
            {running ? '导入中...' : '开始导入'}
          </button>
        </div>
      )}
    </div>
  )
}
