import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiDownload, FiLoader, FiRefreshCw } from 'react-icons/fi'
import {
  fetchDailyCollection,
  fetchMonthWisePerformance,
  fetchPaymentModeAnalytics,
  monthKeyToYearMonth,
} from '../api/paymentMaster'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import { EmptyState, ErrorState, LoadingState, Panel } from '../components/ui/PageState'
import { useAccess } from '../hooks/useAccess'
import { apiErrorMessage } from '../utils/errors'
import { resolveCatalogTenantSlug } from '../utils/tenantHeader'
import {
  btnGhost,
  btnSecondary,
  fieldClass,
  labelClass,
  tableHeadClass,
  tableWrapClass,
} from '../utils/ui'

const TABS = [
  { id: 'monthly', label: 'Month-wise' },
  { id: 'daily', label: 'Daily collection' },
  { id: 'modes', label: 'Payment modes' },
]

const METHOD_META = {
  UPI: { label: 'UPI', color: 'bg-blue-600' },
  CARD: { label: 'Card', color: 'bg-emerald-600' },
  BANK: { label: 'Bank', color: 'bg-violet-600' },
  CASH: { label: 'Cash', color: 'bg-amber-600' },
  CHEQUE: { label: 'Cheque', color: 'bg-rose-700' },
  RAZORPAY: { label: 'Razorpay', color: 'bg-sky-600' },
  WALLET: { label: 'Wallet', color: 'bg-teal-600' },
}

const money = (v) => {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

const pct = (v) => {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `${n.toFixed(1)}%`
}

const downloadCsv = (filename, headers, rows) => {
  const esc = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const blob = new Blob([[headers, ...rows].map((r) => r.map(esc).join(',')).join('\n')], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const monthRange = (year, month) => {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const last = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  return { startDate: start, endDate: end }
}

const yearRange = (apiYear, yearType) => {
  if (yearType === 'FY') {
    // apiYear is ending year (e.g. 2027 for FY 2026-27)
    const startY = apiYear - 1
    return { startDate: `${startY}-04-01`, endDate: `${apiYear}-03-31` }
  }
  return { startDate: `${apiYear}-01-01`, endDate: `${apiYear}-12-31` }
}

const PaymentMasterPage = () => {
  const access = useAccess()
  const tenantSlug = resolveCatalogTenantSlug(access.tenant)

  const [tab, setTab] = useState('monthly')
  const [yearType, setYearType] = useState('CY')
  const [year, setYear] = useState(() => String(new Date().getFullYear()))
  const [selectedMonth, setSelectedMonth] = useState('')
  const [showAllMonths, setShowAllMonths] = useState(true)

  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [monthlyLoading, setMonthlyLoading] = useState(false)
  const [monthlyError, setMonthlyError] = useState('')

  const [dailyByDay, setDailyByDay] = useState({})
  const [dailyLoading, setDailyLoading] = useState(false)
  const [dailyError, setDailyError] = useState('')

  const [modes, setModes] = useState(null)
  const [modesLoading, setModesLoading] = useState(false)
  const [modesError, setModesError] = useState('')

  const selectedYear = Number(year) || new Date().getFullYear()
  const apiYear = yearType === 'FY' ? selectedYear + 1 : selectedYear
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear()
    return [current, current - 1, current - 2, current - 3]
  }, [])

  const yearLabel =
    yearType === 'FY'
      ? `FY ${selectedYear}-${String((selectedYear + 1) % 100).padStart(2, '0')}`
      : `CY ${selectedYear}`

  const loadMonthly = useCallback(async () => {
    if (!tenantSlug) {
      setRows([])
      setSummary(null)
      return
    }
    setMonthlyLoading(true)
    setMonthlyError('')
    try {
      const data = await fetchMonthWisePerformance(tenantSlug, {
        year: apiYear,
        yearType,
      })
      setRows(data.rows)
      setSummary(data.summary)
      setSelectedMonth((prev) => {
        if (data.rows.some((r) => r.month === prev)) return prev
        const now = new Date()
        const prefer = `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][now.getMonth()]}'${now.getFullYear()}`
        return data.rows.find((r) => r.month === prefer)?.month || data.rows[0]?.month || ''
      })
    } catch (err) {
      setRows([])
      setSummary(null)
      setMonthlyError(apiErrorMessage(err, 'Could not load month-wise performance.'))
    } finally {
      setMonthlyLoading(false)
    }
  }, [tenantSlug, apiYear, yearType])

  const loadDaily = useCallback(async () => {
    const parsed = monthKeyToYearMonth(selectedMonth)
    if (!tenantSlug || !parsed) {
      setDailyByDay({})
      return
    }
    setDailyLoading(true)
    setDailyError('')
    try {
      const map = await fetchDailyCollection(tenantSlug, parsed)
      setDailyByDay(map)
    } catch (err) {
      setDailyByDay({})
      setDailyError(apiErrorMessage(err, 'Could not load daily collection.'))
    } finally {
      setDailyLoading(false)
    }
  }, [tenantSlug, selectedMonth])

  const loadModes = useCallback(async () => {
    if (!tenantSlug) {
      setModes(null)
      return
    }
    setModesLoading(true)
    setModesError('')
    try {
      let params
      if (showAllMonths) {
        const range = yearRange(apiYear, yearType)
        params = { year: apiYear, yearType, ...range }
      } else {
        const parsed = monthKeyToYearMonth(selectedMonth)
        if (!parsed) {
          setModesError('Invalid month selection.')
          setModes(null)
          return
        }
        params = { year: parsed.year, month: parsed.month, ...monthRange(parsed.year, parsed.month) }
      }
      const data = await fetchPaymentModeAnalytics(tenantSlug, params)
      setModes(data)
    } catch (err) {
      setModes(null)
      setModesError(apiErrorMessage(err, 'Could not load payment mode analytics.'))
    } finally {
      setModesLoading(false)
    }
  }, [tenantSlug, showAllMonths, apiYear, yearType, selectedMonth])

  useEffect(() => {
    loadMonthly()
  }, [loadMonthly])

  useEffect(() => {
    if (tab !== 'daily') return
    loadDaily()
  }, [tab, loadDaily])

  useEffect(() => {
    if (tab !== 'modes') return
    loadModes()
  }, [tab, loadModes])

  useEffect(() => {
    setShowAllMonths(true)
  }, [selectedYear, yearType])

  const visibleRows = showAllMonths
    ? rows
    : rows.filter((r) => r.month === selectedMonth)

  const calendar = useMemo(() => {
    const parsed = monthKeyToYearMonth(selectedMonth)
    if (!parsed) return { startDay: 0, days: 30, year: 0, month: 0 }
    const first = new Date(parsed.year, parsed.month - 1, 1)
    return {
      startDay: first.getDay(),
      days: new Date(parsed.year, parsed.month, 0).getDate(),
      year: parsed.year,
      month: parsed.month,
    }
  }, [selectedMonth])

  const modeSplit = Array.isArray(modes?.mode_split) ? modes.mode_split : []
  const modeTrend = Array.isArray(modes?.monthly_trend) ? modes.monthly_trend : []
  const cards = modes?.summary_cards || {}

  const exportMonthly = () => {
    if (!visibleRows.length) return
    downloadCsv(
      `payment-master-monthly-${yearLabel.replace(/\s+/g, '-')}.csv`,
      [
        'Month',
        'Bookings start',
        'Bookings end',
        'Invoice value',
        'Collected',
        'Balance',
        'Generated inv',
        'Paid',
        'Partial',
        'Unpaid',
        'Unmapped count',
        'Unmapped amount',
        'Collection %',
      ],
      visibleRows.map((r) => [
        r.month,
        r.bookingsStarting,
        r.bookingsEnding,
        r.invoiceValue,
        r.amtCollected,
        r.balance ?? '',
        r.generatedInvoices,
        r.paidInvoices,
        r.partiallyPaidInvoices,
        r.unpaidInvoices,
        r.unmappedCount,
        r.unmappedAmount,
        r.collectionPct ?? '',
      ]),
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Analytics"
        title="Payment Master"
        description={`Collection breakdowns for ${access.tenant?.name || 'your organization'}.`}
      />

      {!tenantSlug ? (
        <StatusBanner type="warning" message="Select a tenant to load payment analytics." />
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-3">
          <div>
            <label className={labelClass} htmlFor="pm-year-type">
              Year type
            </label>
            <select
              id="pm-year-type"
              className={`${fieldClass} w-auto`}
              value={yearType}
              onChange={(e) => setYearType(e.target.value)}
            >
              <option value="CY">Calendar year</option>
              <option value="FY">Financial year</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="pm-year">
              Year
            </label>
            <select
              id="pm-year"
              className={`${fieldClass} w-auto`}
              value={year}
              onChange={(e) => setYear(e.target.value)}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {yearType === 'FY' ? `FY ${y}-${String((y + 1) % 100).padStart(2, '0')}` : y}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button type="button" className={btnSecondary} onClick={loadMonthly} disabled={!tenantSlug}>
              <FiRefreshCw className="h-4 w-4" />
              Refresh
            </button>
            {tab === 'monthly' ? (
              <button
                type="button"
                className={btnSecondary}
                onClick={exportMonthly}
                disabled={!visibleRows.length}
              >
                <FiDownload className="h-4 w-4" />
                Export
              </button>
            ) : null}
          </div>
        </div>
        <p className="text-sm text-stone-500">{yearLabel}</p>
      </div>

      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-stone-200 bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-brand-500 text-white'
                : 'text-stone-600 hover:bg-stone-50'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {rows.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`${btnGhost} ${showAllMonths ? 'border-brand-300 bg-brand-50 text-brand-800' : ''}`}
            onClick={() => setShowAllMonths(true)}
          >
            All months
          </button>
          {rows.map((r) => (
            <button
              key={r.month}
              type="button"
              className={`${btnGhost} ${
                !showAllMonths && selectedMonth === r.month
                  ? 'border-brand-300 bg-brand-50 text-brand-800'
                  : ''
              }`}
              onClick={() => {
                setShowAllMonths(false)
                setSelectedMonth(r.month)
              }}
            >
              {r.month}
            </button>
          ))}
        </div>
      ) : null}

      {tab === 'monthly' ? (
        <>
          {summary ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Invoice value', money(summary.totalInvoiceValue)],
                ['Collected', money(summary.totalAmtCollected)],
                ['Balance', money(summary.totalBalance)],
                ['Collection %', pct(summary.collectionPct)],
              ].map(([label, value]) => (
                <Panel key={label} className="p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">{label}</p>
                  <p className="mt-1 text-xl font-bold text-stone-900">{value}</p>
                </Panel>
              ))}
            </div>
          ) : null}

          {monthlyError ? <ErrorState message={monthlyError} onRetry={loadMonthly} /> : null}
          {monthlyLoading ? <LoadingState label="Loading month-wise performance…" /> : null}
          {!monthlyLoading && !monthlyError && tenantSlug ? (
            visibleRows.length === 0 ? (
              <EmptyState title="No performance data" hint="Try another year or refresh." />
            ) : (
              <div className={tableWrapClass}>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className={tableHeadClass}>
                      <tr>
                        <th className="px-3 py-3">Month</th>
                        <th className="px-3 py-3">Bookings start</th>
                        <th className="px-3 py-3">Bookings end</th>
                        <th className="px-3 py-3">Invoice value</th>
                        <th className="px-3 py-3">Collected</th>
                        <th className="px-3 py-3">Balance</th>
                        <th className="px-3 py-3">Generated</th>
                        <th className="px-3 py-3">Paid</th>
                        <th className="px-3 py-3">Partial</th>
                        <th className="px-3 py-3">Unpaid</th>
                        <th className="px-3 py-3">Unmapped</th>
                        <th className="px-3 py-3">Collection %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((r) => (
                        <tr key={r.month} className="border-t border-stone-100 hover:bg-stone-50/80">
                          <td className="px-3 py-2.5 font-medium text-stone-900">{r.month}</td>
                          <td className="px-3 py-2.5">{r.bookingsStarting}</td>
                          <td className="px-3 py-2.5">{r.bookingsEnding}</td>
                          <td className="px-3 py-2.5 tabular-nums">{money(r.invoiceValue)}</td>
                          <td className="px-3 py-2.5 tabular-nums">{money(r.amtCollected)}</td>
                          <td className="px-3 py-2.5 tabular-nums">{money(r.balance)}</td>
                          <td className="px-3 py-2.5">{r.generatedInvoices}</td>
                          <td className="px-3 py-2.5">{r.paidInvoices}</td>
                          <td className="px-3 py-2.5">{r.partiallyPaidInvoices}</td>
                          <td className="px-3 py-2.5">{r.unpaidInvoices}</td>
                          <td className="px-3 py-2.5">
                            {r.unmappedCount} · {money(r.unmappedAmount)}
                          </td>
                          <td className="px-3 py-2.5">{pct(r.collectionPct)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : null}
        </>
      ) : null}

      {tab === 'daily' ? (
        <Panel className="p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
            <p className="text-sm font-semibold text-stone-900">Daily collection calendar</p>
            <button type="button" className={btnGhost} onClick={loadDaily} disabled={dailyLoading}>
              {dailyLoading ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiRefreshCw className="h-4 w-4" />}
              Retry
            </button>
          </div>
          {dailyError ? (
            <div className="p-4">
              <StatusBanner type="error" message={dailyError} />
            </div>
          ) : null}
          {dailyLoading ? (
            <div className="flex items-center gap-2 p-8 text-sm text-stone-500">
              <FiLoader className="h-4 w-4 animate-spin" /> Loading daily collection…
            </div>
          ) : (
            <div className="p-4">
              <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: calendar.startDay }).map((_, i) => (
                  <div key={`e-${i}`} />
                ))}
                {Array.from({ length: calendar.days }, (_, i) => i + 1).map((day) => {
                  const amount = dailyByDay[day]
                  const positive = Number(amount) > 0
                  return (
                    <div
                      key={day}
                      className={`rounded-lg border px-1 py-2 text-center ${
                        positive
                          ? 'border-brand-200 bg-brand-50'
                          : 'border-stone-100 bg-stone-50'
                      }`}
                    >
                      <div className="text-xs font-semibold text-stone-700">{day}</div>
                      <div className="mt-1 text-[11px] tabular-nums text-stone-600">
                        {amount == null ? '·' : money(amount)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </Panel>
      ) : null}

      {tab === 'modes' ? (
        <>
          {modesError ? <ErrorState message={modesError} onRetry={loadModes} /> : null}
          {modesLoading ? <LoadingState label="Loading payment modes…" /> : null}
          {!modesLoading && !modesError ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['Total collected', money(cards.total_collected?.amount), cards.total_collected?.period],
                  [
                    'Digital',
                    money(cards.digital_payments?.amount),
                    pct(cards.digital_payments?.pct_of_total),
                  ],
                  ['Cash', money(cards.cash_payments?.amount), pct(cards.cash_payments?.pct_of_total)],
                  [
                    'Cheque',
                    money(cards.cheque_payments?.amount),
                    pct(cards.cheque_payments?.pct_of_total),
                  ],
                ].map(([label, value, sub]) => (
                  <Panel key={label} className="p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">{label}</p>
                    <p className="mt-1 text-xl font-bold text-stone-900">{value}</p>
                    {sub ? <p className="mt-1 text-xs text-stone-500">{sub}</p> : null}
                  </Panel>
                ))}
              </div>

              {!modeSplit.length && !modeTrend.length ? (
                <EmptyState title="No payment mode data" hint="Try another period." />
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className={tableWrapClass}>
                    <div className="border-b border-stone-100 px-4 py-3 text-sm font-semibold">Mode split</div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className={tableHeadClass}>
                          <tr>
                            <th className="px-3 py-2.5">Mode</th>
                            <th className="px-3 py-2.5">Amount</th>
                            <th className="px-3 py-2.5">Share</th>
                          </tr>
                        </thead>
                        <tbody>
                          {modeSplit.map((m) => (
                            <tr key={m.method} className="border-t border-stone-100">
                              <td className="px-3 py-2.5">
                                <span className="inline-flex items-center gap-2">
                                  <span
                                    className={`h-2 w-2 rounded-full ${
                                      METHOD_META[String(m.method || '').toUpperCase()]?.color ||
                                      'bg-stone-400'
                                    }`}
                                  />
                                  {METHOD_META[String(m.method || '').toUpperCase()]?.label ||
                                    m.method}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 tabular-nums">{money(m.amount)}</td>
                              <td className="px-3 py-2.5">{pct(m.pct)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className={tableWrapClass}>
                    <div className="border-b border-stone-100 px-4 py-3 text-sm font-semibold">
                      Monthly trend
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className={tableHeadClass}>
                          <tr>
                            <th className="px-3 py-2.5">Month</th>
                            <th className="px-3 py-2.5">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {modeTrend.map((tr) => (
                            <tr key={tr.month} className="border-t border-stone-100">
                              <td className="px-3 py-2.5 font-medium">{tr.month || '—'}</td>
                              <td className="px-3 py-2.5 tabular-nums">{money(tr.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </>
      ) : null}

    </div>
  )
}

export default PaymentMasterPage
