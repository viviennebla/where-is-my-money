import { create } from 'zustand'

interface FilterState {
  type: string | null
  accountId: string | null
  tagId: string | null
  dateFrom: string | null
  dateTo: string | null
  search: string | null
  sortBy: string
  sortOrder: string
  setType: (t: string | null) => void
  setAccountId: (id: string | null) => void
  setTagId: (id: string | null) => void
  setDateRange: (from: string | null, to: string | null) => void
  setSearch: (q: string | null) => void
  setSortBy: (col: string) => void
  setSortOrder: (order: string) => void
  reset: () => void
}

export const useFilterStore = create<FilterState>((set) => ({
  type: null,
  accountId: null,
  tagId: null,
  dateFrom: null,
  dateTo: null,
  search: null,
  sortBy: 'date',
  sortOrder: 'desc',
  setType: (t) => set({ type: t }),
  setAccountId: (id) => set({ accountId: id }),
  setTagId: (id) => set({ tagId: id }),
  setDateRange: (from, to) => set({ dateFrom: from, dateTo: to }),
  setSearch: (q) => set({ search: q }),
  setSortBy: (col) => set({ sortBy: col }),
  setSortOrder: (order) => set({ sortOrder: order }),
  reset: () => set({
    type: null, accountId: null, tagId: null,
    dateFrom: null, dateTo: null, search: null,
  }),
}))
