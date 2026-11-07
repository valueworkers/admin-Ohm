import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiPlus } from 'react-icons/fi'
import { fetchInvoices } from '../api/invoices'
import PageHeader from '../components/ui/PageHeader'
import TenantOpsPlaceholder from '../components/TenantOpsPlaceholder'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/PageState'
import { useAccess } from '../hooks/useAccess'
import {
  displayPayer,
  fmtDate,
  fmtDateTime,
  fmtMoney,
  invoiceAgeDays,
} from '../features/invoices/store'
import { apiErrorMessage } from '../utils/errors'
import { btnPrimary, tableHeadClass, tableWrapClass } from '../utils/ui'

const statusChip = (status) => {
  const s = String(status || '').toUpperCase()
  if (s === 'PAID') return 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100'
  if (s === 'PARTIAL' || s === 'SENT') {
    return 'border border-stone-300 bg-white text-stone-800'
  }
  if (s === 'OVERDUE') return 'bg-rose-50 text-rose-800 ring-1 ring-rose-100'
  if (s === 'DRAFT') return 'bg-brand-50 text-brand-800 ring-1 ring-brand-100'
  if (s === 'VOID' || s === 'CANCELLED') return 'bg-stone-100 text-stone-600'
  return 'bg-stone-100 text-stone-700'
}

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
  const { isSuperAdmin, canWrite } = useAccess()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!isSuperAdmin) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      setInvoices(await fetchInvoices())
    } catch (err) {
      setInvoices([])
      setError(apiErrorMessage(err, 'Could not load invoices.'))
    } finally {
      setLoading(false)
    }
  }, [isSuperAdmin])

  useEffect(() => {
    load()
  }, [load])

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
        description={`Platform invoices across tenants, as of ${asOf}. Raise invoices directly to a customer or tenant org.`}
        actions={
          canWrite !== false ? (
            <Link to="/ops/invoices/new" className={btnPrimary}>
              <FiPlus className="h-4 w-4" aria-hidden />
              Create invoice
            </Link>
          ) : null
        }
      />

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
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Tenant</th>
                  <th className="px-4 py-3 font-semibold">Issue date</th>
                  <th className="px-4 py-3 font-semibold">Due date</th>
                  <th className="px-4 py-3 font-semibold">Your ref</th>
                  <th className="px-4 py-3 font-semibold text-right">Amount</th>
                  <th className="px-4 py-3 font-semibold text-right">Received</th>
                  <th className="px-4 py-3 font-semibold text-right">Owed</th>
                  <th className="px-4 py-3 font-semibold text-right">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-10">
                      <LoadingState label="Loading invoices…" />
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-10">
                      <ErrorState bare message={error} onRetry={load} />
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-10">
                      <EmptyState
                        bare
                        title="No invoices yet"
                        hint="Create an invoice to get started."
                        actionLabel={canWrite !== false ? 'Create invoice' : undefined}
                        onAction={
                          canWrite !== false
                            ? () => navigate('/ops/invoices/new')
                            : undefined
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const owed = owedLabel(inv)
                    const age = invoiceAgeDays(inv.issueDate || inv.date)
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
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-medium text-stone-900">{inv.number}</p>
                          {inv.createdAt ? (
                            <p className="text-xs text-stone-500">
                              Created {fmtDateTime(inv.createdAt)}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 min-w-[10rem]">
                          <p className="font-medium text-stone-800">{displayPayer(inv)}</p>
                          {inv.buyerEmail ? (
                            <p
                              className="max-w-[12rem] truncate text-xs text-stone-500"
                              title={inv.buyerEmail}
                            >
                              {inv.buyerEmail}
                            </p>
                          ) : null}
                          {inv.gstin ? (
                            <p className="text-xs text-stone-400">GSTIN {inv.gstin}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusChip(
                              inv.status,
                            )}`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-stone-700">
                          {inv.tenantName || '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-stone-600">
                          {fmtDate(inv.issueDate || inv.date)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-stone-600">
                          {fmtDate(inv.dueDate)}
                        </td>
                        <td className="px-4 py-3 text-stone-700">{inv.yourRef || '—'}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap text-stone-800">
                          {inv.amount != null ? fmtMoney(inv.amount) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap text-stone-800">
                          {fmtMoney(inv.received)}
                        </td>
                        <td className={`px-4 py-3 text-right whitespace-nowrap ${owed.className}`}>
                          {owed.text}
                        </td>
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
            Age counts from the issue date while a balance remains.
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
