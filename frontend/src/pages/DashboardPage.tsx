import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import {
  StatSummary, MonthlyTrendItem, CategoryItem,
  MerchantItem, AccountBalanceItem,
} from '../lib/types'
import StatCards from '../components/dashboard/StatCards'
import TimePeriodSelector from '../components/dashboard/TimePeriodSelector'
import MonthlyTrendChart from '../components/dashboard/MonthlyTrendChart'
import CategoryPieChart from '../components/dashboard/CategoryPieChart'
import MerchantRanking from '../components/dashboard/MerchantRanking'
import AccountBalances from '../components/dashboard/AccountBalances'
import TransactionList from '../components/transactions/TransactionList'

const THIS_YEAR = new Date().getFullYear()

export default function DashboardPage() {
  const [year, setYear] = useState<number | null>(THIS_YEAR)
  const [month, setMonth] = useState<number | null>(null)
  const [showTxList, setShowTxList] = useState(false)

  const commonParams = { year, month }

  const summary = useQuery<StatSummary>({
    queryKey: ['stats', 'summary', commonParams],
    queryFn: () => api.get('/stats/summary', { params: commonParams }).then((r) => r.data),
    staleTime: 30_000,
  })

  const trend = useQuery<MonthlyTrendItem[]>({
    queryKey: ['stats', 'monthly-trend'],
    queryFn: () => api.get('/stats/monthly-trend', { params: { months: 12 } }).then((r) => r.data),
    staleTime: 30_000,
  })

  const expenseCategories = useQuery<CategoryItem[]>({
    queryKey: ['stats', 'category-breakdown', { ...commonParams, type: 'expense' }],
    queryFn: () => api.get('/stats/category-breakdown', { params: { ...commonParams, type: 'expense' } }).then((r) => r.data),
    staleTime: 30_000,
  })

  const incomeCategories = useQuery<CategoryItem[]>({
    queryKey: ['stats', 'category-breakdown', { ...commonParams, type: 'income' }],
    queryFn: () => api.get('/stats/category-breakdown', { params: { ...commonParams, type: 'income' } }).then((r) => r.data),
    staleTime: 30_000,
  })

  const merchants = useQuery<MerchantItem[]>({
    queryKey: ['stats', 'merchant-ranking', commonParams],
    queryFn: () => api.get('/stats/merchant-ranking', { params: commonParams }).then((r) => r.data),
    staleTime: 30_000,
  })

  const accounts = useQuery<AccountBalanceItem[]>({
    queryKey: ['stats', 'account-balances'],
    queryFn: () => api.get('/stats/account-balances').then((r) => r.data),
    staleTime: 30_000,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">看板</h1>
        <TimePeriodSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />
      </div>

      <StatCards data={summary.data} isLoading={summary.isLoading} error={summary.error as Error | null} />

      <div className="bg-white rounded-xl shadow-sm p-5">
        <MonthlyTrendChart data={trend.data} isLoading={trend.isLoading} error={trend.error as Error | null} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <CategoryPieChart
            data={expenseCategories.data}
            title="支出类别占比"
            isLoading={expenseCategories.isLoading}
            error={expenseCategories.error as Error | null}
          />
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <CategoryPieChart
            data={incomeCategories.data}
            title="收入来源占比"
            isLoading={incomeCategories.isLoading}
            error={incomeCategories.error as Error | null}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <MerchantRanking data={merchants.data} isLoading={merchants.isLoading} error={merchants.error as Error | null} />
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <AccountBalances data={accounts.data} isLoading={accounts.isLoading} error={accounts.error as Error | null} />
      </div>

      {/* Collapsible Transaction List */}
      <div className="bg-white rounded-xl shadow-sm">
        <button
          onClick={() => setShowTxList(!showTxList)}
          className="w-full px-5 py-3 flex items-center justify-between text-left"
        >
          <span className="text-sm font-medium text-gray-600">交易流水</span>
          <span className="text-gray-400 text-xs">{showTxList ? '收起 ▲' : '展开 ▼'}</span>
        </button>
        {showTxList && (
          <div className="px-5 pb-5">
            <TransactionList />
          </div>
        )}
      </div>
    </div>
  )
}
