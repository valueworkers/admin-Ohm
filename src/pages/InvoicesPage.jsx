import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiChevronRight, FiPlus } from 'react-icons/fi'
import PageHeader from '../components/ui/PageHeader'
import TenantOpsPlaceholder from '../components/TenantOpsPlaceholder'
import { EmptyState, Panel } from '../components/ui/PageState'
import { useAccess } from '../hooks/useAccess'
import {
  displayPayer,
  fmtDate,
  fmtMoney,
  invoiceAgeDays,
  loadDue,
  loadInvoices,
} from '../features/invoices/store'
import { btnPrimary, tableHeadClass, tableWrapClass } from '../utils/ui'

const owedLabel = (inv) => {
  if (inv.status === 'PAID' || Number(inv.owed) <= 0) {
    return { text: 'Paid', className: 'font-semibold text-emerald-700' }
  }
  if (inv.status === 'PARTIAL') {
    return { text: fmtMoney(inv.owed), className: 'font-semibold text-amber-800' }
  }
  return { text: fmtMoney(inv.owed), className: 'font-semibold text-rose-700' }
}

const InvoicesPage = () => {
  const navigate = useNavigate()
  const { isSuperAdmin, tenant, canWrite } = useAccess()
  const due = useMemo(() => loadDue(), [])
  const invoices = useMemo(() => loadInvoices(), [])

  const owedCount = invoices.filter((i) => Number(i.owed) > 0).length
  const asOf = fmtDate(new Date())

  if (!isSuperAdmin) {
    return (
      <TenantOpsPlaceholder
        title="Invoices"
        description="Your organization’s invoices will appear here when tenant billing is enabled."
      />
    )
  }

  return (
    <div className="sc-page-enter space-y-5">
      <PageHeader
        eyebrow="Platform · Billing"
        title="Invoices"
        description={`Platform invoices for care bookings across tenants, as of ${asOf}. As O-HM Senior Care you can also raise invoices directly to a tenant.`}
        actions={
          canWrite !== false ? (
            <Link to="/ops/invoices/new" className={btnPrimary}>
              <FiPlus className="h-4 w-4" aria-hidden />
              Invoice tenant
            </Link>
          ) : null
        }
      />

      <Panel className="space-y-3 p-4 md:p-5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">
          Due an invoice · {due.length}
        </p>
        {due.length === 0 ? (
          <EmptyState
            bare
            title="Nothing waiting"
            hint="Bookings that finished care and still need a platform invoice will show up here."
          />
        ) : (
          <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
            {due.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/ops/invoices/${row.id}`)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/30"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-stone-900">
                      {displayPayer(row)}
                      <span className="ml-2 font-normal text-stone-500">{row.bookingRef}</span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-stone-500">
                      {row.patientName ? `Resident ${row.patientName} · ` : ''}
                      {row.service}
                      {row.tenantName ? ` · ${row.tenantName}` : ''}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm text-stone-600">
                    Raise invoice · {row.daysWaiting} day
                    {row.daysWaiting === 1 ? '' : 's'}
                    <FiChevronRight className="h-4 w-4 text-stone-400" aria-hidden />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-stone-400">
          Invoices · {invoices.length}
          {owedCount === 0 ? ' · nothing owed' : ` · ${owedCount} with balance`}
        </p>
        <div className={tableWrapClass}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-4 py-3 font-semibold">Invoice</th>
                  <th className="px-4 py-3 font-semibold">Payer</th>
                  <th className="px-4 py-3 font-semibold">Tenant</th>
                  <th className="px-4 py-3 font-semibold text-right">Amount</th>
                  <th className="px-4 py-3 font-semibold text-right">Received</th>
                  <th className="px-4 py-3 font-semibold text-right">Owed</th>
                  <th className="px-4 py-3 font-semibold text-right">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10">
                      <EmptyState
                        bare
                        title="No invoices yet"
                        hint="Raised platform invoices for care bookings will appear here."
                      />
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const owed = owedLabel(inv)
                    const age = invoiceAgeDays(inv.date)
                    return (
                      <tr
                        key={inv.id}
                        className="cursor-pointer hover:bg-slate-50 focus-within:bg-slate-50"
                        onClick={() => navigate(`/ops/invoices/${inv.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            navigate(`/ops/invoices/${inv.id}`)
                          }
                        }}
                        tabIndex={0}
                        role="link"
                        aria-label={`Open invoice ${inv.number}`}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-stone-900">{inv.number}</p>
                          <p className="text-xs text-stone-500">
                            {fmtDate(inv.date)} · {inv.bookingRef}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-stone-800">{displayPayer(inv)}</p>
                          {inv.patientName && inv.patientName !== '— (tenant package)' ? (
                            <p className="text-xs text-stone-500">Resident {inv.patientName}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-stone-700">{inv.tenantName || inv.venue || '—'}</td>
                        <td className="px-4 py-3 text-right text-stone-800">
                          {fmtMoney(inv.amount)}
                        </td>
                        <td className="px-4 py-3 text-right text-stone-800">
                          {fmtMoney(inv.received)}
                        </td>
                        <td className={`px-4 py-3 text-right ${owed.className}`}>{owed.text}</td>
                        <td className="px-4 py-3 text-right text-stone-600">
                          {inv.status === 'PAID' || Number(inv.owed) <= 0
                            ? '—'
                            : age != null
                              ? `${age}d`
                              : '—'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="border-t border-stone-100 px-4 py-2.5 text-xs text-stone-500">
            Payer may be a family member or a tenant org. Age counts from the invoice date while a
            balance remains.
          </p>
        </div>
      </div>

      <p className="text-xs text-stone-500">
        Billing and GST defaults live in{' '}
        <Link to="/settings" className="font-medium text-brand-800 hover:underline">
          Settings
        </Link>
        .
      </p>
    </div>
  )
}

export default InvoicesPage
