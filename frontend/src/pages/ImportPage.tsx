import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import FileUploader from '../components/import/FileUploader'
import AIParseView from '../components/import/AIParseView'
import AccountBindingView from '../components/import/AccountBindingView'
import ImportProgress, { ImportResult } from '../components/import/ImportProgress'

type Step = 'upload' | 'parse' | 'bind-accounts' | 'execute' | 'done'

interface FileData {
  file_id: string
  filename: string
  headers: string[]
  sample_rows: string[][]
  header_row_index: number
  total_rows: number
}

export default function ImportPage() {
  const [step, setStep] = useState<Step>('upload')
  const [fileData, setFileData] = useState<FileData | null>(null)
  const [accountBindings, setAccountBindings] = useState<Record<string, string> | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (step === 'done') {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['account-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    }
  }, [step, queryClient])

  const stepLabels = ['上传文件', 'AI解析', '账户绑定', '执行导入', '完成']
  const stepOrder: Step[] = ['upload', 'parse', 'bind-accounts', 'execute', 'done']

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">导入账单</h2>

      <div className="flex gap-2 mb-6">
        {stepLabels.map((label, i) => {
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
              {i < 4 && <span className="text-gray-300 mx-2">→</span>}
            </div>
          )
        })}
      </div>

      {step === 'upload' && (
        <FileUploader
          onUploaded={(data) => {
            setFileData(data)
            setStep('parse')
          }}
        />
      )}

      {step === 'parse' && fileData && (
        <AIParseView
          fileId={fileData.file_id}
          headers={fileData.headers}
          sampleRows={fileData.sample_rows}
          onConfirmed={async (mapping, platformName) => {
            await api.post('/import/confirm', {
              file_id: fileData.file_id,
              platform_name: platformName,
              field_mapping: mapping,
            })
            setStep('bind-accounts')
          }}
          onBack={() => setStep('upload')}
        />
      )}

      {step === 'bind-accounts' && fileData && (
        <AccountBindingView
          fileId={fileData.file_id}
          onConfirmed={(bindings) => {
            setAccountBindings(bindings)
            setStep('execute')
          }}
          onBack={() => setStep('parse')}
        />
      )}

      {step === 'execute' && fileData && (
        <ImportProgress
          fileId={fileData.file_id}
          accountBindings={accountBindings}
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
            新增 {result.created} 条，更新 {result.updated} 条
          </p>
          {result.matched_refunds != null && (
            <p className="text-gray-500 mb-2">
              匹配退款 {result.matched_refunds} 条
            </p>
          )}
          {result.diffs && result.diffs.length > 0 && (
            <div className="mb-6">
              <p className="text-amber-600 text-sm font-medium mb-2">
                发现 {result.diffs.length} 处字段可补充（新导入数据包含旧记录缺失的信息）
              </p>
              <div className="max-w-md mx-auto text-left">
                <table className="w-full text-sm border border-amber-200 rounded-lg overflow-hidden">
                  <thead className="bg-amber-50">
                    <tr>
                      <th className="px-3 py-1.5 text-left text-xs text-amber-700">字段</th>
                      <th className="px-3 py-1.5 text-left text-xs text-amber-700">当前值</th>
                      <th className="px-3 py-1.5 text-left text-xs text-amber-700">新值</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.diffs.slice(0, 10).map((d, i) => (
                      <tr key={i} className="border-t border-amber-100">
                        <td className="px-3 py-1.5 text-gray-600">{d.field}</td>
                        <td className="px-3 py-1.5 text-gray-400 max-w-[150px] truncate">{d.old || '-'}</td>
                        <td className="px-3 py-1.5 text-gray-800 max-w-[150px] truncate">{d.new}</td>
                      </tr>
                    ))}
                    {result.diffs.length > 10 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-1.5 text-center text-gray-400 text-xs">
                          ...还有 {result.diffs.length - 10} 处差异
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <p className="text-gray-500 mb-6" />
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
