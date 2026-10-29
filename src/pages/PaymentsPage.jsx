import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/ui/PageHeader'
import TenantOpsPlaceholder from '../components/TenantOpsPlaceholder'
import { EmptyState } from '../components/ui/PageState'
import { useAccess } from '../hooks/useAccess'
import {
  fmtDate,
  fmtDateTime,
  fmtMoney,
  loadPayments,
  paymentStatusClass,
} from '../features/payments/store'
import { tableHeadClass, tableWrapClass } from '../utils/ui'

const VIEW_MODES = [
  {
    id: 'invoice',
    label: 'Invoice view',
    hint: 'Payments linked to an invoice',
  },
  {
    id: 'payment',
    label: 'Payment view',
    hint: 'Payments with no invoice linked',
  },
]

const STATUS_FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'SUCCESS', label: 'Success' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'FAILED', label: 'Failed' },
]

const hasInvoice = (p) => Boolean(p?.invoiceId || p?.invoiceNumber)

const PaymentsPage = () => {
  const navigate = useNavigate()
  const { isSuperAdmin, tenant } = useAccess()
  const payments = useMemo(() => loadPayments(), [])
  const [viewMode, setViewMode] = useState('invoice')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const byView = useMemo(() => {
    if (viewMode === 'invoice') return payments.filter(hasInvoice)
    return payments.filter((p) => !hasInvoice(p))
  }, [payments, viewMode])

  const filtered = useMemo(() => {
    if (statusFilter === 'ALL') return byView
    return byView.filter((p) => String(p.status).toUpperCase() === statusFilter)
  }, [byView, statusFilter])

  const invoiceCount = payments.filter(hasInvoice).length
  const paymentOnlyCount = payments.length - invoiceCount

  const successInView = byView.filter((p) => String(p.status).toUpperCase() === 'SUCCESS')
  const successTotal = successInView.reduce((s, p) => s + (Number(p.amount) || 0), 0)

  if (!isSuperAdmin) {
    return (
      <TenantOpsPlaceholder
        title="Payments"
        description="Your organization’s payment history will appear here when tenant payments are enabled."
      />
    )
  }

  return (
    <div className="sc-page-enter space-y-4">
      <PageHeader
        eyebrow="Platform · Billing"
        title="Payments"
        description={
          viewMode === 'invoice'
            ? `${invoiceCount} payment${invoiceCount === 1 ? '' : 's'} linked to an invoice · ${fmtMoney(
                successTotal,
              )} successful in this view.`
            : `${paymentOnlyCount} payment${
                paymentOnlyCount === 1 ? '' : 's'
              } with no invoice · ${fmtMoney(successTotal)} successful in this view.`
        }
      />

      <div
        role="tablist"
        aria-label="Payment list mode"
        className="inline-flex flex-wrap gap-1 rounded-xl border border-stone-200 bg-stone-50 p-1"
      >
        {VIEW_MODES.map((m) => {
          const on = viewMode === m.id
          const n = m.id === 'invoice' ? invoiceCount : paymentOnlyCount
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={on}
              title={m.hint}
              onClick={() => {
                setViewMode(m.id)
                setStatusFilter('ALL')
              }}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 ${
                on
                  ? 'bg-ink text-white shadow-sm'
                  : 'text-stone-500 hover:bg-white hover:text-stone-800'
              }`}
            >
              {m.label} ({n})
            </button>
          )
        })}
      </div>

      <p className="text-xs text-stone-500">
        {viewMode === 'invoice'
          ? 'Invoice view — only receipts that reference a tax invoice.'
          : 'Payment view — standalone receipts (onboarding, fees, etc.) with no invoice linked.'}
      </p>

      <div role="tablist" aria-label="Payment status" className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => {
          const on = statusFilter === f.id
          const n =
            f.id === 'ALL'
              ? byView.length
              : byView.filter((p) => String(p.status).toUpperCase() === f.id).length
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
                <th className="px-4 py-3 font-semibold">Payment</th>
                <th className="px-4 py-3 font-semibold">Tenant</th>
                {viewMode === 'invoice' ? (
                  <th className="px-4 py-3 font-semibold">Invoice</th>
                ) : null}
                <th className="px-4 py-3 font-semibold">Mode</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={viewMode === 'invoice' ? 7 : 6} className="px-4 py-10">
                    <EmptyState
                      bare
                      title={
                        viewMode === 'invoice'
                          ? 'No invoice-linked payments'
                          : 'No unlinked payments'
                      }
                      hint={
                        viewMode === 'invoice'
                          ? 'Payments that clear against a tax invoice will show here.'
                          : 'Standalone payments (no invoice) will show here.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="cursor-pointer hover:bg-slate-50 focus-within:bg-slate-50"
                    onClick={() => navigate(`/ops/payments/${p.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        navigate(`/ops/payments/${p.id}`)
                      }
                    }}
                    tabIndex={0}
                    role="link"
                    aria-label={`Open payment ${p.ref}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-stone-900">{p.ref}</p>
                      <p className="text-xs text-stone-500">{p.purpose}</p>
                    </td>
                    <td className="px-4 py-3 font-medium text-stone-800">{p.tenantName}</td>
                    {viewMode === 'invoice' ? (
                      <td className="px-4 py-3 text-stone-700">{p.invoiceNumber || '—'}</td>
                    ) : null}
                    <td className="px-4 py-3 text-stone-700">
                      <p>{p.mode}</p>
                      {p.modeDetail ? (
                        <p className="text-xs text-stone-500">{p.modeDetail}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${paymentStatusClass(
                          p.status,
                        )}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      <p>{fmtDate(p.paidAt)}</p>
                      <p className="text-xs text-stone-400">{fmtDateTime(p.paidAt)}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-stone-900">
                      {fmtMoney(p.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-stone-100 px-4 py-2.5 text-xs text-stone-500">
          Tenant → O-HM Senior Care. Switch views above to see invoice-linked vs standalone
          payments.
        </p>
      </div>
    </div>
  )
}

export default PaymentsPage
