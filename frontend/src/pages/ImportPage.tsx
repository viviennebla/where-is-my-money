import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import FileUploader from '../components/import/FileUploader'
import ColumnMappingView from '../components/import/ColumnMappingView'
import ImportProgress from '../components/import/ImportProgress'

type Step = 'upload' | 'mapping' | 'execute' | 'done'

export default function ImportPage() {
  const [step, setStep] = useState<Step>('upload')
  const [fileData, setFileData] = useState<{ file_id: string; filename: string; preview: string[][] } | null>(null)
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [result, setResult] = useState<{ created: number; updated: number; total: number } | null>(null)
  const navigate = useNavigate()

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">导入账单</h2>

      <div className="flex gap-2 mb-6">
        {['上传文件', '确认映射', '执行导入', '完成'].map((label, i) => {
          const stepOrder: Step[] = ['upload', 'mapping', 'execute', 'done']
          const currentIdx = stepOrder.indexOf(step)
          const isActive = i === currentIdx
          const isPast = i < currentIdx
          return (
            <div key={i} className="flex items-center gap-2">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  isActive ? 'bg-slate-800 text-white' : isPast ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {isPast ? '✓' : i + 1}
              </span>
              <span className={`text-sm ${isActive ? 'font-medium text-gray-900' : 'text-gray-400'}`}>
                {label}
              </span>
              {i < 3 && <span className="text-gray-300 mx-2">→</span>}
            </div>
          )
        })}
      </div>

      {step === 'upload' && (
        <FileUploader
          onUploaded={(data) => {
            setFileData(data)
            setStep('mapping')
          }}
        />
      )}

      {step === 'mapping' && fileData && (
        <ColumnMappingView
          fileId={fileData.file_id}
          preview={fileData.preview}
          onConfirmed={async (platformName, mapping) => {
            const res = await api.post('/import/confirm', {
              platform_name: platformName,
              field_mapping: mapping,
            })
            setTemplateId(res.data.template_id)
            setStep('execute')
          }}
        />
      )}

      {step === 'execute' && templateId && (
        <ImportProgress
          templateId={templateId}
          onDone={(r) => {
            setResult(r)
            setStep('done')
          }}
        />
      )}

      {step === 'done' && result && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🎉</div>
          <h3 className="text-xl font-semibold mb-2">导入完成</h3>
          <p className="text-gray-500 mb-2">
            共处理 {result.total} 条记录
          </p>
          <p className="text-gray-500 mb-6">
            新增 {result.created} 条，更新 {result.updated} 条
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
          >
            查看交易流水
          </button>
        </div>
      )}
    </div>
  )
}
