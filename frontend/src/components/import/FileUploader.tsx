import { useState, useRef } from 'react'
import api from '../../api/client'

interface Props {
  onUploaded: (data: { file_id: string; filename: string; preview: string[][] }) => void
}

export default function FileUploader({ onUploaded }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
      setError('仅支持 CSV 和 Excel 文件')
      return
    }

    setError('')
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post('/import/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onUploaded(res.data)
    } catch {
      setError('上传失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
      <p className="text-gray-500 mb-4">上传微信、支付宝或银行导出的 CSV/Excel 账单文件</p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleFile}
        className="hidden"
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="px-6 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
      >
        {uploading ? '上传中...' : '选择文件'}
      </button>
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  )
}
