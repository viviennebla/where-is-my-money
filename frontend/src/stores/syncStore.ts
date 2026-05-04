import { create } from 'zustand'

interface SyncState {
  lastLocalUpdate: string | null
  lastSyncSuccess: string | null
  pendingCount: number
  setLocalUpdate: (ts: string) => void
  setSyncSuccess: (ts: string) => void
  setPendingCount: (n: number) => void
}

export const useSyncStore = create<SyncState>((set) => ({
  lastLocalUpdate: null,
  lastSyncSuccess: null,
  pendingCount: 0,
  setLocalUpdate: (ts) => set({ lastLocalUpdate: ts }),
  setSyncSuccess: (ts) => set({ lastSyncSuccess: ts }),
  setPendingCount: (n) => set({ pendingCount: n }),
}))
