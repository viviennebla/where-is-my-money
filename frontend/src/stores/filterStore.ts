import { create } from 'zustand'

const PAGE_SIZES = [20, 50, 100] as const

interface FilterState {
  type: string | null
  accountId: string | null
  tagId: string | null
  dateFrom: string | null
  dateTo: string | null
  search: string | null
  sortBy: string
  sortOrder: string
  page: number
  pageSize: number
  setType: (t: string | null) => void
  setAccountId: (id: string | null) => void
  setTagId: (id: string | null) => void
  setDateRange: (from: string | null, to: string | null) => void
  setSearch: (q: string | null) => void
  setSortBy: (col: string) => void
  setSortOrder: (order: string) => void
  setPage: (p: number) => void
  setPageSize: (s: number) => void
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
  page: 1,
  pageSize: 50,
  setType: (t) => set({ type: t, page: 1 }),
  setAccountId: (id) => set({ accountId: id, page: 1 }),
  setTagId: (id) => set({ tagId: id, page: 1 }),
  setDateRange: (from, to) => set({ dateFrom: from, dateTo: to, page: 1 }),
  setSearch: (q) => set({ search: q, page: 1 }),
  setSortBy: (col) => set({ sortBy: col }),
  setSortOrder: (order) => set({ sortOrder: order }),
  setPage: (p) => set({ page: p }),
  setPageSize: (s) => set({ pageSize: s }),
  reset: () => set({
    type: null, accountId: null, tagId: null,
    dateFrom: null, dateTo: null, search: null, page: 1,
  }),
}))

export { PAGE_SIZES }
