import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import { useFilterStore } from '../stores/filterStore'
import {
  StatSummary, TrendItem, CalendarDay, CategoryItem,
  MerchantItem, AccountBalanceItem,
} from '../lib/types'
import StatCards from '../components/dashboard/StatCards'
import TimePeriodSelector from '../components/dashboard/TimePeriodSelector'
import GranularitySwitcher, { Granularity } from '../components/dashboard/GranularitySwitcher'
import TrendChart from '../components/dashboard/TrendChart'
import CategoryPieChart from '../components/dashboard/CategoryPieChart'
import MerchantRanking from '../components/dashboard/MerchantRanking'
import AccountBalances from '../components/dashboard/AccountBalances'
import CalendarView from '../components/dashboard/CalendarView'
import TransactionList from '../components/transactions/TransactionList'

const THIS_YEAR = new Date().getFullYear()
const THIS_MONTH = new Date().getMonth() + 1

export default function DashboardPage() {
  const [granularity, setGranularity] = useState<Granularity>('month')
  const [year, setYear] = useState<number | null>(THIS_YEAR)
  const [month, setMonth] = useState<number | null>(THIS_MONTH)
  const [calendarDate, setCalendarDate] = useState<string | null>(null)
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null)
  const [showTxList, setShowTxList] = useState(false)

  const setDateRange = useFilterStore((s) => s.setDateRange)

  const effYear = year ?? THIS_YEAR
  const effMonth = month ?? THIS_MONTH
  const isDayMode = granularity === 'day'

  const handleCalendarSelect = useCallback((date: string | null) => {
    setCalendarDate(date)
    if (date) {
      setDateRange(date, date)
      setShowTxList(true)
    } else {
      setDateRange(null, null)
    }
  }, [setDateRange])

  const handleWeekSelect = useCallback((week: string | null) => {
    setSelectedWeek(week)
    if (week) {
      const [, wn] = week.split('-W').map(Number)
      const jan1 = new Date(effYear, 0, 1)
      const monday = new Date(jan1)
      monday.setDate(jan1.getDate() + (wn - 1) * 7 - jan1.getDay() + 1)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      const fmt = (d: Date) => d.toISOString().slice(0, 10)
      setDateRange(fmt(monday), fmt(sunday))
    } else {
      setDateRange(null, null)
    }
  }, [effYear, setDateRange])

  const commonParams: Record<string, string | number | null> = { year, month }

  const summary = useQuery<StatSummary>({
    queryKey: ['stats', 'summary', commonParams],
    queryFn: () => api.get('/stats/summary', { params: commonParams }).then((r) => r.data),
    staleTime: 30_000,
  })

  const trendParams: Record<string, string | number> = { granularity }
  if (year !== null) trendParams.year = year
  if (month !== null) trendParams.month = month
  if (granularity === 'month') trendParams.months = 12

  const trend = useQuery<TrendItem[]>({
    queryKey: ['stats', 'trend', trendParams],
    queryFn: () => api.get('/stats/trend', { params: trendParams }).then((r) => r.data),
    staleTime: 30_000,
  })

  const calendar = useQuery<CalendarDay[]>({
    queryKey: ['stats', 'calendar', { year: effYear, month: effMonth }],
    queryFn: () => api.get('/stats/calendar', { params: { year: effYear, month: effMonth } }).then((r) => r.data),
    staleTime: 30_000,
    enabled: isDayMode,
  })

  const expenseCategories = useQuery<CategoryItem[]>({
    queryKey: ['stats', 'category-breakdown', { ...commonParams, type: 'expense' }],
    queryFn: () => api.get('/stats/category-breakdown', { params: { ...commonParams, type: 'expense' } }).then((r) => r.data),
    staleTime: 30_000,
    enabled: !isDayMode,
  })

  const incomeCategories = useQuery<CategoryItem[]>({
    queryKey: ['stats', 'category-breakdown', { ...commonParams, type: 'income' }],
    queryFn: () => api.get('/stats/category-breakdown', { params: { ...commonParams, type: 'income' } }).then((r) => r.data),
    staleTime: 30_000,
    enabled: !isDayMode,
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

  const weekOptions = (granularity === 'week' && trend.data)
    ? trend.data.map((d) => d.period).slice(-12)
    : []

  return (
    <div className="space-y-6">
      {/* Header: title + granularity */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">看板</h1>
        <GranularitySwitcher value={granularity} onChange={(g) => { setGranularity(g); setSelectedWeek(null) }} />
      </div>

      {/* Time selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <TimePeriodSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />
        {granularity === 'week' && weekOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">选择周:</span>
            <select
              value={selectedWeek ?? ''}
              onChange={(e) => handleWeekSelect(e.target.value || null)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
            >
              <option value="">全部</option>
              {weekOptions.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Top section: Calendar + Stats side by side in day mode, Stats full-width otherwise */}
      {isDayMode ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-5">
            <div className="text-sm font-medium text-gray-600 mb-3">
              {effYear}年{effMonth}月 收支日历
            </div>
            <CalendarView
              year={effYear}
              month={effMonth}
              data={calendar.data}
              isLoading={calendar.isLoading}
              error={calendar.error as Error | null}
              selectedDate={calendarDate}
              onSelectDate={handleCalendarSelect}
            />
          </div>
          <div className="lg:col-span-1">
            <StatCards data={summary.data} isLoading={summary.isLoading} error={summary.error as Error | null} compact />
          </div>
        </div>
      ) : (
        <StatCards data={summary.data} isLoading={summary.isLoading} error={summary.error as Error | null} />
      )}

      {/* Trend chart — hidden in day mode */}
      {!isDayMode && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="text-sm font-medium text-gray-600 mb-2">收支趋势</div>
          <TrendChart
            data={trend.data}
            granularity={granularity}
            isLoading={trend.isLoading}
            error={trend.error as Error | null}
          />
        </div>
      )}

      {/* Pie charts — hidden in day mode */}
      {!isDayMode && (
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
      )}

      {/* Merchant ranking */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <MerchantRanking data={merchants.data} isLoading={merchants.isLoading} error={merchants.error as Error | null} />
      </div>

      {/* Account balances */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <AccountBalances data={accounts.data} isLoading={accounts.isLoading} error={accounts.error as Error | null} />
      </div>

      {/* Collapsible Transaction List */}
      <div className="bg-white rounded-xl shadow-sm">
        <button
          onClick={() => setShowTxList(!showTxList)}
          className="w-full px-5 py-3 flex items-center justify-between text-left"
        >
          <span className="text-sm font-medium text-gray-600">
            交易流水
            {calendarDate && <span className="text-blue-500 ml-2">({calendarDate})</span>}
          </span>
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
