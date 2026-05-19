import { useState, useCallback, useMemo } from 'react'
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

function pad(n: number) { return String(n).padStart(2, '0') }

function weekToRange(weekStr: string): { date_from: string; date_to: string } | null {
  const m = weekStr.match(/^(\d{4})-W(\d{1,2})$/)
  if (!m) return null
  const y = Number(m[1])
  const wn = Number(m[2])
  const jan1 = new Date(y, 0, 1)
  const monday = new Date(jan1)
  monday.setDate(jan1.getDate() + (wn - 1) * 7 - jan1.getDay() + 1)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { date_from: fmt(monday), date_to: fmt(sunday) }
}

function quarterToRange(year: number, q: number): { date_from: string; date_to: string } {
  const startMonth = (q - 1) * 3 + 1
  const endMonth = startMonth + 2
  const lastDay = new Date(year, endMonth, 0).getDate()
  return {
    date_from: `${year}-${pad(startMonth)}-01`,
    date_to: `${year}-${pad(endMonth)}-${pad(lastDay)}`,
  }
}

export default function DashboardPage() {
  const [granularity, setGranularity] = useState<Granularity>('month')
  const [year, setYear] = useState<number | null>(THIS_YEAR)
  const [month, setMonth] = useState<number | null>(THIS_MONTH)
  const [selectedQuarter, setSelectedQuarter] = useState<number>(Math.ceil(THIS_MONTH / 3))
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
      const r = weekToRange(week)
      if (r) setDateRange(r.date_from, r.date_to)
    } else {
      setDateRange(null, null)
    }
  }, [setDateRange])

  // Computed date ranges
  const weekRange = useMemo(() => selectedWeek ? weekToRange(selectedWeek) : null, [selectedWeek])
  const quarterRange = useMemo(() => quarterToRange(effYear, selectedQuarter), [effYear, selectedQuarter])

  // Params for category-breakdown and merchant-ranking (support date range filtering)
  const filterParams: Record<string, string | number | null> = useMemo(() => {
    if (granularity === 'week' && weekRange) {
      return { date_from: weekRange.date_from, date_to: weekRange.date_to }
    }
    if (granularity === 'quarter') {
      return { date_from: quarterRange.date_from, date_to: quarterRange.date_to }
    }
    return { year, month }
  }, [granularity, year, month, weekRange, quarterRange])

  // Trend params — varies significantly by granularity
  const trendParams: Record<string, string | number> = useMemo(() => {
    if (granularity === 'week' && weekRange) {
      return { granularity: 'day', date_from: weekRange.date_from, date_to: weekRange.date_to }
    }
    if (granularity === 'month') {
      return { granularity: 'day', year: effYear, month: effMonth }
    }
    if (granularity === 'quarter') {
      return { granularity: 'quarter', year: effYear, quarter: selectedQuarter }
    }
    if (granularity === 'year') {
      return { granularity: 'month', year: effYear }
    }
    // day mode: not really used but keep valid
    const p: Record<string, string | number> = { granularity }
    if (year !== null) p.year = year
    if (month !== null) p.month = month
    return p
  }, [granularity, effYear, effMonth, selectedQuarter, weekRange, year, month])

  // Second trend for year view — quarterly
  const yearQuarterTrendParams = useMemo(() => {
    if (granularity !== 'year') return null
    return { granularity: 'quarter' as const, year: effYear }
  }, [granularity, effYear])

  // Week options for the week selector (from trend data, used when no week selected)
  const weekListQuery = useQuery<TrendItem[]>({
    queryKey: ['stats', 'trend', { granularity: 'week', year: effYear }],
    queryFn: () => api.get('/stats/trend', { params: { granularity: 'week', year: effYear } }).then((r) => r.data),
    staleTime: 30_000,
    enabled: granularity === 'week',
  })

  // Queries
  const summary = useQuery<StatSummary>({
    queryKey: ['stats', 'summary', { year, month }],
    queryFn: () => api.get('/stats/summary', { params: { year, month } }).then((r) => r.data),
    staleTime: 30_000,
  })

  const trend = useQuery<TrendItem[]>({
    queryKey: ['stats', 'trend', trendParams],
    queryFn: () => api.get('/stats/trend', { params: trendParams as Record<string, string | number> }).then((r) => r.data),
    staleTime: 30_000,
    enabled: !isDayMode,
  })

  const yearQuarterTrend = useQuery<TrendItem[]>({
    queryKey: ['stats', 'trend', yearQuarterTrendParams],
    queryFn: () => api.get('/stats/trend', { params: yearQuarterTrendParams as Record<string, string | number> }).then((r) => r.data),
    staleTime: 30_000,
    enabled: granularity === 'year',
  })

  const calendar = useQuery<CalendarDay[]>({
    queryKey: ['stats', 'calendar', { year: effYear, month: effMonth }],
    queryFn: () => api.get('/stats/calendar', { params: { year: effYear, month: effMonth } }).then((r) => r.data),
    staleTime: 30_000,
  })

  const expenseCategories = useQuery<CategoryItem[]>({
    queryKey: ['stats', 'category-breakdown', { ...filterParams, type: 'expense' }],
    queryFn: () => api.get('/stats/category-breakdown', { params: { ...filterParams, type: 'expense' } }).then((r) => r.data),
    staleTime: 30_000,
    enabled: !isDayMode,
  })

  const incomeCategories = useQuery<CategoryItem[]>({
    queryKey: ['stats', 'category-breakdown', { ...filterParams, type: 'income' }],
    queryFn: () => api.get('/stats/category-breakdown', { params: { ...filterParams, type: 'income' } }).then((r) => r.data),
    staleTime: 30_000,
    enabled: !isDayMode,
  })

  const merchants = useQuery<MerchantItem[]>({
    queryKey: ['stats', 'merchant-ranking', filterParams],
    queryFn: () => api.get('/stats/merchant-ranking', { params: filterParams }).then((r) => r.data),
    staleTime: 30_000,
    enabled: !isDayMode,
  })

  const accounts = useQuery<AccountBalanceItem[]>({
    queryKey: ['stats', 'account-balances'],
    queryFn: () => api.get('/stats/account-balances').then((r) => r.data),
    staleTime: 30_000,
  })

  // Navigation helpers
  const navMonth = (delta: number) => {
    let m = effMonth + delta
    let y = effYear
    if (m > 12) { m = 1; y++ }
    if (m < 1) { m = 12; y-- }
    setYear(y)
    setMonth(m)
  }

  const navQuarter = (delta: number) => {
    let q = selectedQuarter + delta
    let y = effYear
    if (q > 4) { q = 1; y++ }
    if (q < 1) { q = 4; y-- }
    setYear(y)
    setSelectedQuarter(q)
  }

  const navYear = (delta: number) => {
    setYear(effYear + delta)
  }

  // Compute trend chart display props
  const trendGranularity: Granularity =
    granularity === 'quarter' ? 'month' :
    granularity === 'year' ? 'day' :
    granularity === 'month' ? 'day' :
    granularity === 'week' && selectedWeek ? 'day' :
    granularity

  const trendTitle =
    granularity === 'week' && selectedWeek ? `${selectedWeek} 每日收支` :
    granularity === 'month' ? `${effYear}年${effMonth}月 每日收支` :
    granularity === 'quarter' ? `${effYear}年 Q${selectedQuarter} 月度收支` :
    granularity === 'year' ? `${effYear}年 月度收支` :
    '收支趋势'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">看板</h1>
        <GranularitySwitcher value={granularity} onChange={(g) => { setGranularity(g); setSelectedWeek(null) }} />
      </div>

      {/* Time controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Month arrows (day mode and month mode) */}
          {(granularity === 'month' || granularity === 'day') && (
            <div className="flex items-center gap-1 mr-2">
              <button onClick={() => navMonth(-1)} className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">&lt; 上月</button>
              <span className="text-sm font-medium text-gray-700 min-w-[80px] text-center">{effYear}年{effMonth}月</span>
              <button onClick={() => navMonth(1)} className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">下月 &gt;</button>
            </div>
          )}
          {/* Quarter navigation arrows */}
          {granularity === 'quarter' && (
            <div className="flex items-center gap-1 mr-2">
              <button onClick={() => navQuarter(-1)} className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">&lt; 上季</button>
              <span className="text-sm font-medium text-gray-700 min-w-[80px] text-center">{effYear}年 Q{selectedQuarter}</span>
              <button onClick={() => navQuarter(1)} className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">下季 &gt;</button>
            </div>
          )}
          {/* Year navigation arrows */}
          {granularity === 'year' && (
            <div className="flex items-center gap-1 mr-2">
              <button onClick={() => navYear(-1)} className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">&lt; 上年</button>
              <span className="text-sm font-medium text-gray-700 min-w-[70px] text-center">{effYear}年</span>
              <button onClick={() => navYear(1)} className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">下年 &gt;</button>
            </div>
          )}
          {/* Year/Month dropdowns for week view */}
          {granularity === 'week' && (
            <TimePeriodSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />
          )}
        </div>

        {/* Week selector */}
        {granularity === 'week' && weekListQuery.data && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">选择周:</span>
            <select
              value={selectedWeek ?? ''}
              onChange={(e) => handleWeekSelect(e.target.value || null)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
            >
              <option value="">全部</option>
              {weekListQuery.data.map((w) => (
                <option key={w.period} value={w.period}>{w.period}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main layout: sidebar (1/4) + content (3/4) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left sidebar: Calendar + StatCards */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-3">
            <div className="text-xs font-medium text-gray-500 mb-2">
              {effYear}年{effMonth}月
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
          <StatCards data={summary.data} isLoading={summary.isLoading} error={summary.error as Error | null} compact />
        </div>

        {/* Right content: Charts */}
        <div className="lg:col-span-3 space-y-6">
          {/* Trend chart — hidden in day mode */}
          {!isDayMode && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="text-sm font-medium text-gray-600 mb-2">{trendTitle}</div>
              <TrendChart
                data={trend.data}
                granularity={trendGranularity}
                isLoading={trend.isLoading}
                error={trend.error as Error | null}
              />
            </div>
          )}

          {/* Year view: additional quarterly chart */}
          {granularity === 'year' && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="text-sm font-medium text-gray-600 mb-2">{effYear}年 季度收支</div>
              <TrendChart
                data={yearQuarterTrend.data}
                granularity="quarter"
                isLoading={yearQuarterTrend.isLoading}
                error={yearQuarterTrend.error as Error | null}
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

          {/* Merchant ranking — hidden in day mode */}
          {!isDayMode && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <MerchantRanking data={merchants.data} isLoading={merchants.isLoading} error={merchants.error as Error | null} />
            </div>
          )}

          {/* Account balances — hidden in day mode */}
          {!isDayMode && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <AccountBalances data={accounts.data} isLoading={accounts.isLoading} error={accounts.error as Error | null} />
            </div>
          )}
        </div>
      </div>

      {/* Transaction list — always available */}
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
