import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiPlus,
  FiSearch,
} from 'react-icons/fi'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import TenantOpsPlaceholder from '../components/TenantOpsPlaceholder'
import { EmptyState, ErrorState, LoadingState, Panel } from '../components/ui/PageState'
import { fetchPlatformQuoteStats, fetchPlatformQuotes } from '../api/quotes'
import { useAccess } from '../hooks/useAccess'
import { apiErrorMessage } from '../utils/errors'
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  fieldClass,
  labelClass,
  tableHeadClass,
  tableWrapClass,
} from '../utils/ui'

const RANGE_OPTIONS = [
  { id: 30, label: '30 days' },
  { id: 90, label: '90 days' },
  { id: 180, label: '180 days' },
  { id: 365, label: '1 year' },
]

const toYmd = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** from = today − N days, to = today (matches range chips). */
const rangeBounds = (days) => {
  const to = new Date()
  to.setHours(0, 0, 0, 0)
  const from = new Date(to)
  from.setDate(from.getDate() - Number(days || 30))
  return { from: toYmd(from), to: toYmd(to), fromDate: from, toDate: to }
}

const emptyStats = () => ({
  open: 0,
  accepted: 0,
  rejected: 0,
  expired: 0,
  pipeline: null,
  winRate: 0,
})

const winRatePercent = (winRate) => {
  const n = Number(winRate) || 0
  if (n <= 1) return Math.round(n * 100)
  return Math.round(n)
}

/** Matches backend Quote.status TextChoices — value sent as API `status`. */
const STATUS_FILTERS = [
  { id: '', label: 'All statuses' },
  { id: 'draft', label: 'Draft' },
  { id: 'sent', label: 'Sent' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'expired', label: 'Expired' },
  { id: 'superseded', label: 'Superseded' },
]

const SUPPLY_TYPE_FILTERS = [
  { id: '', label: 'All supply types' },
  { id: 'intra_state', label: 'Intra-state' },
  { id: 'inter_state', label: 'Inter-state' },
  { id: 'unknown', label: 'Unknown' },
]

/**
 * UI column id → API `ordering` field.
 * Only columns used for sort (matches backend ordering whitelist).
 */
const ORDERING_FIELDS = {
  number: 'number',
  customer: 'company',
  status: 'status',
  quoteDate: 'quote_date',
  validUntil: 'valid_until',
  sentAt: 'sent_at',
  lastModifiedAt: 'updated_at',
  totalInclGst: 'total',
}

const toOrdering = (sortKey, sortDir) => {
  const field = ORDERING_FIELDS[sortKey] || 'quote_date'
  return sortDir === 'asc' ? field : `-${field}`
}

const PAGE_SIZE = 20

const fmtDate = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const fmtDateTime = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const fmtMoney = (n) => {
  if (n == null || Number.isNaN(Number(n))) return null
  return Number(n).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  })
}

const statusChip = (status) => {
  const s = String(status || '').toUpperCase()
  if (s === 'SENT') return 'border border-stone-300 bg-white text-stone-800'
  if (s === 'ACCEPTED') return 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100'
  if (s === 'REJECTED') return 'bg-rose-50 text-rose-800 ring-1 ring-rose-100'
  if (s === 'EXPIRED' || s === 'SUPERSEDED') return 'bg-stone-100 text-stone-600'
  if (s === 'DRAFT') return 'bg-brand-50 text-brand-800 ring-1 ring-brand-100'
  return 'bg-stone-100 text-stone-700'
}

const TABLE_COLUMNS = [
  { id: 'number', label: 'Quote', sortable: true },
  { id: 'customer', label: 'Customer', sortable: true },
  { id: 'status', label: 'Status', sortable: true },
  { id: 'buyerEmail', label: 'Buyer email', sortable: false },
  { id: 'yourRef', label: 'Your ref', sortable: false },
  { id: 'quoteDate', label: 'Quote date', sortable: true },
  { id: 'validUntil', label: 'Valid until', sortable: true },
  { id: 'sentAt', label: 'Sent', sortable: true },
  { id: 'lastModifiedAt', label: 'Modified', sortable: true },
  { id: 'subtotal', label: 'Subtotal', align: 'right', sortable: false },
  { id: 'totalInclGst', label: 'Total', align: 'right', sortable: true },
]

const csvEscape = (value) => {
  const text = String(value ?? '')
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

const downloadQuotesExcel = (rows) => {
  const headers = [
    'Quote',
    'Customer',
    'GSTIN',
    'State',
    'Status',
    'Buyer email',
    'Your ref',
    'Quote date',
    'Valid until',
    'Sent',
    'Modified',
    'Subtotal',
    'CGST',
    'SGST',
    'IGST',
    'Total',
    'Created',
  ]
  const lines = [
    headers.join(','),
    ...rows.map((q) =>
      [
        q.number,
        q.customer || q.forName || '',
        q.gstin || '',
        q.state || '',
        q.status,
        q.buyerEmail || '',
        q.yourRef || '',
        fmtDate(q.quoteDate || q.date),
        fmtDate(q.validUntil),
        fmtDateTime(q.sentAt),
        fmtDateTime(q.lastModifiedAt),
        q.subtotal != null ? q.subtotal : '',
        q.cgst != null ? q.cgst : '',
        q.sgst != null ? q.sgst : '',
        q.igst != null ? q.igst : '',
        q.totalInclGst != null ? q.totalInclGst : '',
        fmtDateTime(q.createdAt),
      ]
        .map(csvEscape)
        .join(','),
    ),
  ]
  const bom = '\uFEFF'
  const blob = new Blob([bom + lines.join('\n')], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `quotes-${toYmd(new Date())}.xls`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const QuotationsPage = () => {
  const navigate = useNavigate()
  const { isSuperAdmin, canWrite } = useAccess()
  const [quotes, setQuotes] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [hasPrevious, setHasPrevious] = useState(false)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [rangeDays, setRangeDays] = useState(90)
  const [stats, setStats] = useState(emptyStats)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortKey, setSortKey] = useState('quoteDate')
  const [sortDir, setSortDir] = useState('desc')
  const [moreOpen, setMoreOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [supplyType, setSupplyType] = useState('')
  const [totalMin, setTotalMin] = useState('')
  const [totalMax, setTotalMax] = useState('')
  const [lineItem, setLineItem] = useState('')
  const [hsnSac, setHsnSac] = useState('')
  const [latestOnly, setLatestOnly] = useState(true)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [reloadKey, setReloadKey] = useState(0)

  const bounds = useMemo(() => rangeBounds(rangeDays), [rangeDays])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 350)
    return () => window.clearTimeout(t)
  }, [search])

  const filterParams = useMemo(
    () => ({
      status: statusFilter,
      supplyType,
      quoteDateAfter: bounds.from,
      quoteDateBefore: bounds.to,
      totalMin,
      totalMax,
      lineItem,
      hsnSac,
      // Show older revisions when filtering superseded
      latestOnly: statusFilter === 'superseded' ? false : latestOnly,
      search: debouncedSearch,
      ordering: toOrdering(sortKey, sortDir),
      pageSize: PAGE_SIZE,
    }),
    [
      statusFilter,
      supplyType,
      bounds.from,
      bounds.to,
      totalMin,
      totalMax,
      lineItem,
      hsnSac,
      latestOnly,
      debouncedSearch,
      sortKey,
      sortDir,
    ],
  )

  // Reset to first page whenever filters / sort change
  useEffect(() => {
    setPage(1)
  }, [filterParams])

  useEffect(() => {
    if (!isSuperAdmin) return undefined
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadError('')
      try {
        const data = await fetchPlatformQuotes({ ...filterParams, page })
        if (cancelled) return
        setQuotes(data.results || [])
        setTotalCount(Number(data.count) || (data.results || []).length)
        setHasNext(Boolean(data.next))
        setHasPrevious(Boolean(data.previous))
      } catch (err) {
        if (cancelled) return
        setQuotes([])
        setTotalCount(0)
        setHasNext(false)
        setHasPrevious(false)
        setLoadError(apiErrorMessage(err, 'Could not load quotes.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isSuperAdmin, filterParams, page, reloadKey])

  useEffect(() => {
    if (!isSuperAdmin) return undefined
    let cancelled = false
    ;(async () => {
      setStatsLoading(true)
      setStatsError('')
      try {
        const next = await fetchPlatformQuoteStats({
          from: bounds.from,
          to: bounds.to,
        })
        if (cancelled) return
        setStats(next)
      } catch (err) {
        if (cancelled) return
        setStats(emptyStats())
        setStatsError(apiErrorMessage(err, 'Could not load quote analytics.'))
      } finally {
        if (!cancelled) setStatsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isSuperAdmin, bounds.from, bounds.to])

  const toggleSort = (key) => {
    if (!ORDERING_FIELDS[key]) return
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir(key === 'number' || key === 'customer' ? 'asc' : 'desc')
  }

  const clearExtraFilters = () => {
    setSupplyType('')
    setTotalMin('')
    setTotalMax('')
    setLineItem('')
    setHsnSac('')
    setLatestOnly(true)
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE) || 1)
  const rangeFrom = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeTo = Math.min(page * PAGE_SIZE, totalCount)

  const handleExport = () => {
    if (!quotes.length) {
      setStatus({ type: 'error', message: 'Nothing to export for the current filters.' })
      return
    }
    downloadQuotesExcel(quotes)
    setStatus({
      type: 'success',
      message: `Exported ${quotes.length} quote${quotes.length === 1 ? '' : 's'} to Excel.`,
    })
  }

  const decided = stats.accepted + stats.rejected + stats.expired
  const winPct = winRatePercent(stats.winRate)

  if (!isSuperAdmin) {
    return (
      <TenantOpsPlaceholder
        title="Quotes"
        description="Your organization’s quotes will appear here when tenant quoting is enabled."
      />
    )
  }

  return (
    <div className="sc-page-enter space-y-4">
      <PageHeader
        eyebrow="Platform · Sales"
        title="Quotes"
        description={
          loading
            ? 'Loading quotes…'
            : `${totalCount} quote${totalCount === 1 ? '' : 's'} · ${fmtDate(
                bounds.fromDate,
              )} – ${fmtDate(bounds.toDate)}${
                stats.open
                  ? ` · ${stats.open} open${
                      stats.pipeline != null ? `, pipeline ${fmtMoney(stats.pipeline)}` : ''
                    }`
                  : ''
              }.`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={btnSecondary}
              disabled={loading || Boolean(loadError)}
              onClick={handleExport}
            >
              <FiDownload className="h-4 w-4" aria-hidden />
              Export to Excel
            </button>
            {canWrite !== false ? (
              <Link to="/ops/quotations/new" className={btnPrimary}>
                <FiPlus className="h-4 w-4" aria-hidden />
                New quote
              </Link>
            ) : null}
          </div>
        }
      />

      <StatusBanner type={status.type} message={status.message} />

      {loading ? <LoadingState label="Loading quotes…" /> : null}
      {!loading && loadError ? (
        <ErrorState message={loadError} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : null}

      {!loading && !loadError ? (
        <>
          <Panel className="space-y-4 p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-stone-900">
                  Last {rangeDays === 365 ? 'year' : `${rangeDays} days`}
                </p>
                <p className="text-xs text-stone-500">
                  {fmtDate(bounds.fromDate)} – {fmtDate(bounds.toDate)}
                </p>
              </div>
              <div
                role="group"
                aria-label="Date range"
                className="inline-flex flex-wrap gap-1 rounded-xl border border-stone-200 bg-stone-50 p-1"
              >
                {RANGE_OPTIONS.map((r) => {
                  const on = rangeDays === r.id
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRangeDays(r.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 ${
                        on
                          ? 'bg-ink text-white shadow-sm'
                          : 'text-stone-500 hover:bg-white hover:text-stone-800'
                      }`}
                    >
                      {r.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {statsError ? (
              <StatusBanner type="error" message={statsError} />
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-stone-200 bg-white p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Open</p>
                <p className="mt-1 text-sm font-semibold text-stone-900">
                  {statsLoading ? '…' : `${stats.open} quote${stats.open === 1 ? '' : 's'}`}
                </p>
                <p className="mt-0.5 text-sm text-stone-600">
                  {stats.pipeline != null ? fmtMoney(stats.pipeline) : '—'}
                </p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Win rate
                </p>
                <p className="mt-1 text-sm font-semibold text-stone-900">
                  {statsLoading ? '…' : `${stats.accepted} of ${decided || 1}`}
                </p>
                <p className="mt-0.5 text-sm text-stone-500">
                  {statsLoading
                    ? '…'
                    : decided < 2
                      ? 'Not enough yet.'
                      : `${winPct}%`}
                </p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Sent → accepted
                </p>
                <p className="mt-1 text-sm font-semibold text-stone-900">
                  {statsLoading
                    ? '…'
                    : stats.accepted
                      ? `${stats.accepted} accepted`
                      : 'None yet.'}
                </p>
                <p className="mt-0.5 text-sm text-stone-500">
                  {stats.pipeline != null
                    ? `Pipeline ${fmtMoney(stats.pipeline)}`
                    : 'No open valued quotes.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
            >
              {moreOpen ? (
                <FiChevronDown className="h-4 w-4" aria-hidden />
              ) : (
                <FiChevronRight className="h-4 w-4" aria-hidden />
              )}
              See more: value by stage, why we win and lose
            </button>
            {moreOpen ? (
              <div className="grid gap-2 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600 sm:grid-cols-4">
                <p>
                  <span className="font-semibold text-stone-800">Open</span> · {stats.open}
                </p>
                <p>
                  <span className="font-semibold text-stone-800">Accepted</span> · {stats.accepted}
                </p>
                <p>
                  <span className="font-semibold text-stone-800">Rejected</span> · {stats.rejected}
                </p>
                <p>
                  <span className="font-semibold text-stone-800">Expired</span> · {stats.expired}
                </p>
              </div>
            ) : null}
          </Panel>

          <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-3 shadow-sm md:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
              <label className="block min-w-[10rem] sm:w-44">
                <span className={labelClass}>Status</span>
                <select
                  className={fieldClass}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {STATUS_FILTERS.map((f) => (
                    <option key={f.id || 'all'} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="relative block min-w-[12rem] flex-1">
                <span className={labelClass}>Search</span>
                <span className="relative block">
                  <FiSearch
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
                    aria-hidden
                  />
                  <input
                    type="search"
                    className={`${fieldClass} pl-9`}
                    placeholder="Quote no., customer, email, GSTIN, ref…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </span>
              </label>
              <label className="inline-flex items-center gap-2 pb-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-stone-300 text-ink focus:ring-brand-500/30"
                  checked={latestOnly}
                  onChange={(e) => setLatestOnly(e.target.checked)}
                />
                Latest revision only
              </label>
              <button
                type="button"
                className={btnGhost}
                onClick={() => setFiltersOpen((v) => !v)}
                aria-expanded={filtersOpen}
              >
                {filtersOpen ? (
                  <FiChevronDown className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <FiChevronRight className="h-3.5 w-3.5" aria-hidden />
                )}
                More filters
              </button>
            </div>

            {filtersOpen ? (
              <div className="grid gap-3 border-t border-stone-100 pt-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block">
                  <span className={labelClass}>Supply type</span>
                  <select
                    className={fieldClass}
                    value={supplyType}
                    onChange={(e) => setSupplyType(e.target.value)}
                  >
                    {SUPPLY_TYPE_FILTERS.map((f) => (
                      <option key={f.id || 'all-supply'} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={labelClass}>Total min (₹)</span>
                  <input
                    type="number"
                    min={0}
                    className={fieldClass}
                    placeholder="e.g. 1000"
                    value={totalMin}
                    onChange={(e) => setTotalMin(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Total max (₹)</span>
                  <input
                    type="number"
                    min={0}
                    className={fieldClass}
                    placeholder="e.g. 25000"
                    value={totalMax}
                    onChange={(e) => setTotalMax(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Line item</span>
                  <input
                    type="search"
                    className={fieldClass}
                    placeholder="e.g. clinic"
                    value={lineItem}
                    onChange={(e) => setLineItem(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>HSN/SAC</span>
                  <input
                    type="search"
                    className={fieldClass}
                    placeholder="e.g. 9993"
                    value={hsnSac}
                    onChange={(e) => setHsnSac(e.target.value)}
                  />
                </label>
                <div className="flex items-end sm:col-span-2 lg:col-span-3">
                  <button type="button" className={btnSecondary} onClick={clearExtraFilters}>
                    Clear extra filters
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className={tableWrapClass}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className={tableHeadClass}>
                  <tr>
                    {TABLE_COLUMNS.map((col) => {
                      const active = sortKey === col.id
                      return (
                        <th
                          key={col.id}
                          className={`px-4 py-3 font-semibold ${
                            col.align === 'right' ? 'text-right' : ''
                          }`}
                        >
                          {col.sortable ? (
                            <button
                              type="button"
                              className={`inline-flex items-center gap-1 rounded-md transition-colors hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 ${
                                active ? 'text-stone-900' : 'text-stone-500'
                              } ${col.align === 'right' ? 'ml-auto' : ''}`}
                              onClick={() => toggleSort(col.id)}
                              aria-label={`Sort by ${col.label}`}
                            >
                              {col.label}
                              <span className="text-[10px] tabular-nums" aria-hidden>
                                {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                              </span>
                            </button>
                          ) : (
                            <span
                              className={`text-stone-500 ${
                                col.align === 'right' ? 'block text-right' : ''
                              }`}
                            >
                              {col.label}
                            </span>
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {quotes.length === 0 ? (
                    <tr>
                      <td colSpan={TABLE_COLUMNS.length} className="px-4 py-10">
                        <EmptyState
                          bare
                          title={
                            search.trim() || statusFilter || supplyType || lineItem || hsnSac
                              ? 'No matching quotes'
                              : 'No quotes in this range'
                          }
                          hint={
                            search.trim() || statusFilter || supplyType || lineItem || hsnSac
                              ? 'Try another search, status, or filter.'
                              : 'Try another period or status, or create a new quote.'
                          }
                          actionLabel={canWrite !== false ? 'New quote' : undefined}
                          onAction={
                            canWrite !== false
                              ? () => navigate('/ops/quotations/new')
                              : undefined
                          }
                        />
                      </td>
                    </tr>
                  ) : (
                    quotes.map((q) => (
                      <tr
                        key={q.id}
                        className="cursor-pointer hover:bg-slate-50 focus-within:bg-slate-50"
                        onClick={() => navigate(`/ops/quotations/${q.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            navigate(`/ops/quotations/${q.id}`)
                          }
                        }}
                        tabIndex={0}
                        role="link"
                        aria-label={`Open quote ${q.number}`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-medium text-stone-900">{q.number}</p>
                          {q.quoteDate ? (
                            <p className="text-xs text-stone-500">
                              Created {fmtDate(q.createdAt)}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 min-w-[10rem]">
                          <p className="font-medium text-stone-800">
                            {q.customer || q.forName}
                          </p>
                          {q.gstin ? (
                            <p className="text-xs text-stone-500">GSTIN {q.gstin}</p>
                          ) : null}
                          {q.state ? (
                            <p className="text-xs text-stone-400">{q.state}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusChip(
                              q.status,
                            )}`}
                          >
                            {q.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-stone-700">
                          <p className="max-w-[12rem] truncate" title={q.buyerEmail || ''}>
                            {q.buyerEmail || '—'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-stone-700">{q.yourRef || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-stone-600">
                          {fmtDate(q.quoteDate || q.date)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-stone-600">
                          {fmtDate(q.validUntil)}
                          {q.validDays ? (
                            <span className="block text-xs text-stone-400">
                              {q.validDays}d
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-stone-600">
                          {q.sentAt ? fmtDateTime(q.sentAt) : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-stone-600">
                          {q.lastModifiedAt ? fmtDateTime(q.lastModifiedAt) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap text-stone-700">
                          {q.subtotal != null ? fmtMoney(q.subtotal) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {q.totalInclGst != null ? (
                            <>
                              <p className="font-medium text-stone-900">
                                {fmtMoney(q.totalInclGst)}
                              </p>
                              {(Number(q.cgst) > 0 || Number(q.sgst) > 0) && (
                                <p className="text-[11px] text-stone-500">
                                  CGST {fmtMoney(q.cgst)} · SGST {fmtMoney(q.sgst)}
                                </p>
                              )}
                              {Number(q.igst) > 0 ? (
                                <p className="text-[11px] text-stone-500">
                                  IGST {fmtMoney(q.igst)}
                                </p>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-stone-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-stone-500">
                {totalCount === 0
                  ? 'No quotes'
                  : `Showing ${rangeFrom}–${rangeTo} of ${totalCount} · page ${page} of ${totalPages}`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={loading || !hasPrevious || page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <FiChevronLeft className="h-4 w-4" aria-hidden />
                  Previous
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={loading || !hasNext}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Next page"
                >
                  Next
                  <FiChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

export default QuotationsPage
