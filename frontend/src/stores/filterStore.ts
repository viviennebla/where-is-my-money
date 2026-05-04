import { create } from 'zustand'

interface FilterState {
  type: string | null
  accountId: string | null
  tagId: string | null
  dateFrom: string | null
  dateTo: string | null
  setType: (t: string | null) => void
  setAccountId: (id: string | null) => void
  setTagId: (id: string | null) => void
  setDateRange: (from: string | null, to: string | null) => void
  reset: () => void
}

export const useFilterStore = create<FilterState>((set) => ({
  type: null,
  accountId: null,
  tagId: null,
  dateFrom: null,
  dateTo: null,
  setType: (t) => set({ type: t }),
  setAccountId: (id) => set({ accountId: id }),
  setTagId: (id) => set({ tagId: id }),
  setDateRange: (from, to) => set({ dateFrom: from, dateTo: to }),
  reset: () => set({ type: null, accountId: null, tagId: null, dateFrom: null, dateTo: null }),
}))
