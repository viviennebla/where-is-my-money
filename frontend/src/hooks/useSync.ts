import { useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSyncStore } from '../stores/syncStore'
import { syncToLocal } from './useLocalDB'
import api from '../api/client'

export function useSync() {
  const queryClient = useQueryClient()
  const { setSyncSuccess, setPendingCount } = useSyncStore()

  const pullFromServer = useCallback(async () => {
    try {
      const [txRes, accRes, tagRes] = await Promise.all([
        api.get('/transactions', { params: { page_size: 200 } }),
        api.get('/accounts'),
        api.get('/tags'),
      ])

      await Promise.all([
        syncToLocal('transactions', txRes.data.items),
        syncToLocal('accounts', accRes.data),
        syncToLocal('tags', tagRes.data),
      ])

      const now = new Date().toISOString()
      setSyncSuccess(now)
      localStorage.setItem('wimm_last_sync', now)
    } catch {
      // 离线或网络错误，静默处理
    }
  }, [setSyncSuccess])

  useEffect(() => {
    const saved = localStorage.getItem('wimm_last_sync')
    if (saved) {
      setSyncSuccess(saved)
    }

    pullFromServer()

    const interval = setInterval(pullFromServer, 60_000)
    return () => clearInterval(interval)
  }, [pullFromServer, setSyncSuccess])

  return { refresh: pullFromServer }
}
