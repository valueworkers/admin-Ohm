import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiChevronDown, FiChevronRight, FiPlus } from 'react-icons/fi'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import TenantOpsPlaceholder from '../components/TenantOpsPlaceholder'
import { EmptyState, Panel } from '../components/ui/PageState'
import { useAccess } from '../hooks/useAccess'
import { loadQuotes } from '../features/quotes/store'
import { btnPrimary, tableHeadClass, tableWrapClass } from '../utils/ui'

const RANGE_OPTIONS = [
  { id: 30, label: '30 days' },
  { id: 90, label: '90 days' },
  { id: 180, label: '180 days' },
  { id: 365, label: '1 year' },
]

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

const rangeStart = (days) => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - (days - 1))
  return d
}

const QuotationsPage = () => {
  const navigate = useNavigate()
  const { isSuperAdmin, tenant, canWrite } = useAccess()
  const [quotes] = useState(loadQuotes)
  const [rangeDays, setRangeDays] = useState(90)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [moreOpen, setMoreOpen] = useState(false)
  const [status] = useState({ type: '', message: '' })

  const startMs = useMemo(() => rangeStart(rangeDays).getTime(), [rangeDays])
  const endMs = useMemo(() => {
    const d = new Date()
    d.setHours(23, 59, 59, 999)
    return d.getTime()
  }, [rangeDays])

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

  const openValue = inRange
    .filter((q) => q.status === 'SENT' && q.gstSet)
    .reduce((sum, q) => sum + (Number(q.totalInclGst) || 0), 0)
  const waiting = inRange.filter((q) => q.status === 'SENT')
  const waitingValue = waiting.reduce((sum, q) => sum + (Number(q.totalInclGst) || 0), 0)
  const accepted = inRange.filter((q) => q.status === 'ACCEPTED').length
  const decided = accepted + inRange.filter((q) => q.status === 'EXPIRED').length

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
        description={`${inRange.length} quote${inRange.length === 1 ? '' : 's'} as of ${fmtDate(
          new Date(endMs),
        )}${
          waiting.length
            ? ` · ${waiting.length} waiting on the customer${
                waitingValue ? `, worth ${fmtMoney(waitingValue)} incl. GST` : ''
              }`
            : ''
        }.`}
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

      <Panel className="space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-stone-900">Last {rangeDays} days</p>
            <p className="text-xs text-stone-500">
              {fmtDate(new Date(startMs))} – {fmtDate(new Date(endMs))}
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

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-stone-200 bg-white p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Open</p>
            <p className="mt-1 text-sm font-semibold text-stone-900">
              {waiting.length} quote{waiting.length === 1 ? '' : 's'}
            </p>
            <p className="mt-0.5 text-sm text-stone-600">
              {waitingValue ? fmtMoney(waitingValue) : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Win rate
            </p>
            <p className="mt-1 text-sm font-semibold text-stone-900">
              {accepted} of {decided || 1}
            </p>
            <p className="mt-0.5 text-sm text-stone-500">
              {decided < 2 ? 'Not enough yet.' : `${Math.round((accepted / decided) * 100)}%`}
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Sent → accepted
            </p>
            <p className="mt-1 text-sm font-semibold text-stone-900">
              {accepted ? `${accepted} accepted` : 'None yet.'}
            </p>
            <p className="mt-0.5 text-sm text-stone-500">
              {openValue ? `Pipeline ${fmtMoney(openValue)}` : 'No open valued quotes.'}
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
          <p className="rounded-lg bg-stone-50 px-3 py-2 text-xs leading-relaxed text-stone-500">
            Stage breakdown and win/loss reasons will appear here when quote analytics are wired to
            the API.
          </p>
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
                        canWrite !== false ? () => navigate('/ops/quotations/new') : undefined
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
    </div>
  )
}

export default QuotationsPage
