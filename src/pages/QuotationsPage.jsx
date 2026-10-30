import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiChevronDown, FiChevronRight, FiPlus } from 'react-icons/fi'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import TenantOpsPlaceholder from '../components/TenantOpsPlaceholder'
import { EmptyState, ErrorState, LoadingState, Panel } from '../components/ui/PageState'
import { fetchPlatformQuoteStats, fetchPlatformQuotes } from '../api/quotes'
import { useAccess } from '../hooks/useAccess'
import { apiErrorMessage } from '../utils/errors'
import { btnPrimary, tableHeadClass, tableWrapClass } from '../utils/ui'

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

const STATUS_FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'DRAFT', label: 'Draft' },
  { id: 'SENT', label: 'Sent' },
  { id: 'ACCEPTED', label: 'Accepted' },
  { id: 'EXPIRED', label: 'Expired' },
  { id: 'SUPERSEDED', label: 'Superseded' },
]

const fmtDate = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
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
  if (s === 'EXPIRED' || s === 'SUPERSEDED') return 'bg-stone-100 text-stone-600'
  return 'bg-stone-100 text-stone-700'
}

const QuotationsPage = () => {
  const navigate = useNavigate()
  const { isSuperAdmin, canWrite } = useAccess()
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [rangeDays, setRangeDays] = useState(90)
  const [stats, setStats] = useState(emptyStats)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [moreOpen, setMoreOpen] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' })

  const bounds = useMemo(() => rangeBounds(rangeDays), [rangeDays])
  const startMs = useMemo(() => bounds.fromDate.getTime(), [bounds])
  const endMs = useMemo(() => {
    const d = new Date(bounds.toDate)
    d.setHours(23, 59, 59, 999)
    return d.getTime()
  }, [bounds])

  const loadQuotes = async () => {
    setLoading(true)
    setLoadError('')
    setStatus({ type: '', message: '' })
    try {
      const data = await fetchPlatformQuotes()
      setQuotes(data.results || [])
    } catch (err) {
      setQuotes([])
      setLoadError(apiErrorMessage(err, 'Could not load quotes.'))
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    setStatsLoading(true)
    setStatsError('')
    try {
      const next = await fetchPlatformQuoteStats({
        from: bounds.from,
        to: bounds.to,
      })
      setStats(next)
    } catch (err) {
      setStats(emptyStats())
      setStatsError(apiErrorMessage(err, 'Could not load quote analytics.'))
    } finally {
      setStatsLoading(false)
    }
  }

  useEffect(() => {
    if (!isSuperAdmin) return undefined
    loadQuotes()
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin])

  useEffect(() => {
    if (!isSuperAdmin) return undefined
    loadStats()
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, bounds.from, bounds.to])

  const inRange = useMemo(
    () =>
      quotes.filter((q) => {
        const d = new Date(q.date)
        const t = d.getTime()
        return !Number.isNaN(t) && t >= startMs && t <= endMs
      }),
    [quotes, startMs, endMs],
  )

  const filtered = useMemo(() => {
    if (statusFilter === 'ALL') return inRange
    return inRange.filter((q) => q.status === statusFilter)
  }, [inRange, statusFilter])

  const counts = useMemo(() => {
    const base = { ALL: inRange.length, DRAFT: 0, SENT: 0, ACCEPTED: 0, EXPIRED: 0, SUPERSEDED: 0 }
    inRange.forEach((q) => {
      if (base[q.status] != null) base[q.status] += 1
    })
    return base
  }, [inRange])

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
            : `${inRange.length} quote${inRange.length === 1 ? '' : 's'} as of ${fmtDate(
                new Date(endMs),
              )}${
                stats.open
                  ? ` · ${stats.open} open${
                      stats.pipeline != null ? `, pipeline ${fmtMoney(stats.pipeline)}` : ''
                    }`
                  : ''
              }.`
        }
        actions={
          canWrite !== false ? (
            <Link to="/ops/quotations/new" className={btnPrimary}>
              <FiPlus className="h-4 w-4" aria-hidden />
              New quote
            </Link>
          ) : null
        }
      />

      <StatusBanner type={status.type} message={status.message} />

      {loading ? <LoadingState label="Loading quotes…" /> : null}
      {!loading && loadError ? (
        <ErrorState message={loadError} onRetry={loadQuotes} />
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

          <div role="tablist" aria-label="Quote status" className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => {
              const on = statusFilter === f.id
              const n = counts[f.id] ?? 0
              return (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setStatusFilter(f.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 ${
                    on
                      ? 'bg-ink text-white'
                      : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50'
                  }`}
                >
                  {f.label} ({n})
                </button>
              )
            })}
          </div>

          <div className={tableWrapClass}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className={tableHeadClass}>
                  <tr>
                    <th className="px-4 py-3 font-semibold">Quote</th>
                    <th className="px-4 py-3 font-semibold">For</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Valid until</th>
                    <th className="px-4 py-3 font-semibold text-right">Total incl. GST</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10">
                        <EmptyState
                          bare
                          title="No quotes in this range"
                          hint="Try another period or status, or create a new quote."
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
                    filtered.map((q) => (
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
                        <td className="px-4 py-3 font-medium text-stone-900">{q.number}</td>
                        <td className="px-4 py-3 text-stone-700">{q.forName}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusChip(
                              q.status,
                            )}`}
                          >
                            {q.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-stone-600">{fmtDate(q.date)}</td>
                        <td className="px-4 py-3 text-stone-600">{fmtDate(q.validUntil)}</td>
                        <td className="px-4 py-3 text-right text-stone-800">
                          {q.gstSet && q.totalInclGst != null ? (
                            fmtMoney(q.totalInclGst)
                          ) : (
                            <span className="text-stone-400">GST not set</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

export default QuotationsPage
