import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiPlus, FiRefreshCw, FiSend } from 'react-icons/fi'
import { fetchInvoices } from '../api/invoices'
import {
  createPlatformPayment,
  fetchPlatformPayments,
} from '../api/platformPayments'
import { fetchTenants } from '../api/tenants'
import DraggableTh from '../components/ui/DraggableTh'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import TenantOpsPlaceholder from '../components/TenantOpsPlaceholder'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/PageState'
import {
  fmtDate,
  fmtDateTime,
  fmtMoney,
  paymentStatusClass,
} from '../features/payments/store'
import { useAccess } from '../hooks/useAccess'
import { useColumnOrder } from '../hooks/useColumnOrder'
import { apiErrorMessage } from '../utils/errors'
import {
  btnPrimary,
  btnSecondary,
  fieldClass,
  labelClass,
  tableHeadClass,
  tableWrapClass,
} from '../utils/ui'

const STATUS_FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'SUCCEEDED', label: 'Succeeded' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'FAILED', label: 'Failed' },
]

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'neft', label: 'NEFT' },
  { value: 'imps', label: 'IMPS' },
  { value: 'card', label: 'Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
]

const PAYMENT_COLUMNS = [
  { id: 'payment', label: 'Payment' },
  { id: 'customer', label: 'Tenant' },
  { id: 'invoice', label: 'Invoice' },
  { id: 'mode', label: 'Method' },
  { id: 'status', label: 'Status' },
  { id: 'date', label: 'Paid at' },
  { id: 'amount', label: 'Amount', align: 'right' },
]

const PAYMENT_COLUMN_IDS = PAYMENT_COLUMNS.map((c) => c.id)

const SOURCE_TABS = [
  { id: 'platform', label: 'Platform' },
  { id: 'razorpay', label: 'Razorpay' },
]

const RAZORPAY_COLUMNS = [
  { id: 'rzpId', label: 'Razorpay ID' },
  { id: 'customer', label: 'Customer' },
  { id: 'email', label: 'Email' },
  { id: 'method', label: 'Method' },
  { id: 'status', label: 'Status' },
  { id: 'created', label: 'Created' },
  { id: 'amount', label: 'Amount', align: 'right' },
]

const emptyRazorpayRequest = () => ({
  tenantId: '',
  amount: '',
  currency: 'INR',
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  description: '',
  notes: '',
})

const toLocalInput = (iso) => {
  if (!iso) {
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 16)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const fromLocalInput = (local) => {
  if (!local) return ''
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return local
  return d.toISOString()
}

const emptyForm = () => ({
  tenantId: '',
  invoiceId: '',
  amount: '',
  currency: 'INR',
  status: 'SUCCEEDED',
  method: 'bank_transfer',
  reference: '',
  paidAt: toLocalInput(),
})

const renderPaymentCell = (colId, p) => {
  switch (colId) {
    case 'payment':
      return (
        <td key={colId} className="px-4 py-3">
          <p className="font-medium text-stone-900">{p.ref || `PAY-${p.id}`}</p>
          <p className="text-xs text-stone-500">#{p.id}</p>
        </td>
      )
    case 'customer':
      return (
        <td key={colId} className="px-4 py-3 font-medium text-stone-800">
          {p.tenantName || p.tenantId || '—'}
        </td>
      )
    case 'invoice':
      return (
        <td key={colId} className="px-4 py-3 text-stone-700">
          {p.invoiceNumber || (p.invoiceId ? `#${p.invoiceId}` : '—')}
        </td>
      )
    case 'mode':
      return (
        <td key={colId} className="px-4 py-3 text-stone-700">
          {p.mode || '—'}
        </td>
      )
    case 'status':
      return (
        <td key={colId} className="px-4 py-3">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${paymentStatusClass(
              p.status,
            )}`}
          >
            {p.status}
          </span>
        </td>
      )
    case 'date':
      return (
        <td key={colId} className="px-4 py-3 text-stone-600">
          <p>{fmtDate(p.paidAt)}</p>
          <p className="text-xs text-stone-400">{fmtDateTime(p.paidAt)}</p>
        </td>
      )
    case 'amount':
      return (
        <td key={colId} className="px-4 py-3 text-right font-medium text-stone-900">
          {fmtMoney(p.amount)}
        </td>
      )
    default:
      return null
  }
}

const PaymentsPage = () => {
  const navigate = useNavigate()
  const { isSuperAdmin, canWrite } = useAccess()
  const [payments, setPayments] = useState([])
  const [tenants, setTenants] = useState([])
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tenantFilter, setTenantFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [sourceTab, setSourceTab] = useState('platform')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [banner, setBanner] = useState({ type: '', message: '' })
  const [saving, setSaving] = useState(false)
  const [razorpayRows] = useState([])
  const [rzpModalOpen, setRzpModalOpen] = useState(false)
  const [rzpForm, setRzpForm] = useState(emptyRazorpayRequest)
  const [rzpFormError, setRzpFormError] = useState('')
  const { columnOrder, moveColumn } = useColumnOrder(
    'sc_ops_payments_col_order_v1',
    PAYMENT_COLUMN_IDS,
  )

  const visibleColumns = useMemo(
    () => columnOrder.map((id) => PAYMENT_COLUMNS.find((c) => c.id === id)).filter(Boolean),
    [columnOrder],
  )

  const loadTenants = useCallback(async () => {
    if (!isSuperAdmin) return
    try {
      setTenants(await fetchTenants())
    } catch {
      setTenants([])
    }
  }, [isSuperAdmin])

  const loadInvoicesList = useCallback(async () => {
    if (!isSuperAdmin) return
    try {
      setInvoices(await fetchInvoices({ page: 1, pageSize: 100 }))
    } catch {
      setInvoices([])
    }
  }, [isSuperAdmin])

  const load = useCallback(async () => {
    if (!isSuperAdmin) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const { results } = await fetchPlatformPayments({
        tenant: tenantFilter || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        page: 1,
        pageSize: 100,
      })
      setPayments(results)
    } catch (err) {
      setPayments([])
      setError(apiErrorMessage(err, 'Could not load platform payments.'))
    } finally {
      setLoading(false)
    }
  }, [isSuperAdmin, tenantFilter, statusFilter])

  useEffect(() => {
    loadTenants()
    loadInvoicesList()
  }, [loadTenants, loadInvoicesList])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!banner.message) return undefined
    const t = window.setTimeout(() => setBanner({ type: '', message: '' }), 4000)
    return () => window.clearTimeout(t)
  }, [banner])

  const filtered = payments

  const successInView = filtered.filter((p) => {
    const s = String(p.status).toUpperCase()
    return s === 'SUCCEEDED' || s === 'SUCCESS'
  })
  const successTotal = successInView.reduce((s, p) => s + (Number(p.amount) || 0), 0)

  const invoicesForTenant = useMemo(() => {
    if (!form.tenantId) return invoices
    return invoices.filter(
      (inv) => !inv.tenantId || String(inv.tenantId) === String(form.tenantId),
    )
  }, [invoices, form.tenantId])

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const openCreate = () => {
    setForm(emptyForm())
    setFormError('')
    setBanner({ type: '', message: '' })
    setModalOpen(true)
  }

  const closeCreate = () => {
    if (saving) return
    setModalOpen(false)
    setFormError('')
  }

  const onTenantChange = (tenantId) => {
    setForm((f) => ({
      ...f,
      tenantId,
      invoiceId:
        f.invoiceId &&
        invoices.some(
          (inv) =>
            String(inv.id) === String(f.invoiceId) &&
            (!inv.tenantId || String(inv.tenantId) === String(tenantId)),
        )
          ? f.invoiceId
          : '',
    }))
  }

  const onInvoiceChange = (invoiceId) => {
    const inv = invoices.find((i) => String(i.id) === String(invoiceId))
    if (!inv) {
      setField('invoiceId', '')
      return
    }
    setForm((f) => ({
      ...f,
      invoiceId,
      tenantId: inv.tenantId || f.tenantId,
      amount:
        f.amount ||
        (inv.owed != null && Number(inv.owed) > 0
          ? String(inv.owed)
          : inv.amount != null
            ? String(inv.amount)
            : f.amount),
      reference: f.reference || `INV-${inv.number || inv.id}`,
    }))
  }

  const validate = () => {
    if (!form.tenantId) return 'Select a tenant.'
    if (!form.invoiceId) return 'Select an invoice.'
    const amount = Number(form.amount)
    if (!form.amount || Number.isNaN(amount) || amount <= 0) return 'Enter a valid amount.'
    if (!String(form.reference || '').trim()) return 'Enter a payment reference (UTR / txn id).'
    if (!form.paidAt) return 'Paid at is required.'
    if (!form.method) return 'Select a payment method.'
    if (!form.status) return 'Select a status.'
    return ''
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const message = validate()
    if (message) {
      setFormError(message)
      return
    }

    setSaving(true)
    setFormError('')
    try {
      const row = await createPlatformPayment({
        tenantId: form.tenantId,
        invoiceId: form.invoiceId,
        amount: form.amount,
        currency: form.currency,
        method: form.method,
        status: form.status,
        reference: form.reference,
        paidAt: fromLocalInput(form.paidAt),
      })
      setModalOpen(false)
      setForm(emptyForm())
      setBanner({
        type: 'success',
        message: `Payment ${row.ref || row.id} recorded.`,
      })
      await load()
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not save payment.'))
    } finally {
      setSaving(false)
    }
  }

  const openRzpRequest = () => {
    setRzpForm(emptyRazorpayRequest())
    setRzpFormError('')
    setRzpModalOpen(true)
  }

  const closeRzpRequest = () => {
    if (saving) return
    setRzpModalOpen(false)
    setRzpFormError('')
  }

  const handleRzpRequest = (event) => {
    event.preventDefault()
    if (!String(rzpForm.amount || '').trim() || Number(rzpForm.amount) <= 0) {
      setRzpFormError('Enter a valid amount.')
      return
    }
    if (!String(rzpForm.customerEmail || '').trim() && !String(rzpForm.customerPhone || '').trim()) {
      setRzpFormError('Add customer email or phone.')
      return
    }
    setRzpFormError('')
    setBanner({
      type: 'info',
      message: 'Razorpay is not connected yet. Add your Razorpay account ID to enable requests.',
    })
    setRzpModalOpen(false)
  }

  if (!isSuperAdmin) {
    return (
      <TenantOpsPlaceholder
        title="Payments"
        description="Your organization’s payment history will appear here when tenant payments are enabled."
      />
    )
  }

  const isRazorpay = sourceTab === 'razorpay'

  return (
    <div className="sc-page-enter space-y-4">
      <PageHeader
        eyebrow="Platform · Billing"
        title="Payments"
        description={
          isRazorpay
            ? 'Razorpay payments and payment requests. Connect your Razorpay account ID to sync live data.'
            : `${filtered.length} platform payment${
                filtered.length === 1 ? '' : 's'
              } · ${fmtMoney(successTotal)} succeeded in this view.`
        }
        actions={
          canWrite !== false ? (
            isRazorpay ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={btnSecondary}
                  disabled
                  title="Connect Razorpay account ID to refresh"
                >
                  <FiRefreshCw className="h-4 w-4" aria-hidden />
                  Refresh
                </button>
                <button type="button" className={btnPrimary} onClick={openRzpRequest}>
                  <FiSend className="h-4 w-4" aria-hidden />
                  Request payment
                </button>
              </div>
            ) : (
              <button type="button" className={btnPrimary} onClick={openCreate}>
                <FiPlus className="h-4 w-4" aria-hidden />
                Add payment
              </button>
            )
          ) : null
        }
      />

      <StatusBanner type={banner.type} message={banner.message} />

      <div
        role="tablist"
        aria-label="Payment source"
        className="inline-flex flex-wrap gap-1 rounded-xl border border-stone-200 bg-stone-50 p-1"
      >
        {SOURCE_TABS.map((tab) => {
          const on = sourceTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setSourceTab(tab.id)}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 ${
                on
                  ? 'bg-ink text-white shadow-sm'
                  : 'text-stone-500 hover:bg-white hover:text-stone-800'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {isRazorpay ? (
        <>
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
            Razorpay account ID not configured yet. List and request actions will work once you add
            it.
          </p>

          <div className={tableWrapClass}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className={tableHeadClass}>
                  <tr>
                    {RAZORPAY_COLUMNS.map((col) => (
                      <th
                        key={col.id}
                        className={`px-4 py-3 font-semibold ${
                          col.align === 'right' ? 'text-right' : 'text-left'
                        }`}
                      >
                        <span className="text-stone-500">{col.label}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {razorpayRows.length === 0 ? (
                    <tr>
                      <td colSpan={RAZORPAY_COLUMNS.length} className="px-4 py-10">
                        <EmptyState
                          bare
                          title="No Razorpay payments yet"
                          hint="Connect Razorpay to fetch payments, or send a payment request."
                          actionLabel={
                            canWrite !== false ? 'Request payment' : undefined
                          }
                          onAction={canWrite !== false ? openRzpRequest : undefined}
                        />
                      </td>
                    </tr>
                  ) : (
                    razorpayRows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-stone-900">{row.id}</td>
                        <td className="px-4 py-3 text-stone-800">{row.customer || '—'}</td>
                        <td className="px-4 py-3 text-stone-600">{row.email || '—'}</td>
                        <td className="px-4 py-3 text-stone-700">{row.method || '—'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${paymentStatusClass(
                              row.status,
                            )}`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-stone-600">{fmtDateTime(row.createdAt)}</td>
                        <td className="px-4 py-3 text-right font-medium text-stone-900">
                          {fmtMoney(row.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="border-t border-stone-100 px-4 py-2.5 text-xs text-stone-500">
              Razorpay settlement feed — syncs after account ID is added.
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="block sm:w-56">
              <span className={labelClass}>Tenant</span>
              <select
                className={fieldClass}
                value={tenantFilter}
                onChange={(e) => setTenantFilter(e.target.value)}
              >
                <option value="">All tenants</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div role="tablist" aria-label="Payment status" className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => {
              const on = statusFilter === f.id
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
                  {f.label}
                </button>
              )
            })}
          </div>

          <div className={tableWrapClass}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className={tableHeadClass}>
                  <tr>
                    {visibleColumns.map((col) => (
                      <DraggableTh
                        key={col.id}
                        id={col.id}
                        onReorder={moveColumn}
                        align={col.align === 'right' ? 'right' : 'left'}
                        className="font-semibold"
                      >
                        <span className="text-stone-500">{col.label}</span>
                      </DraggableTh>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    <tr>
                      <td colSpan={visibleColumns.length} className="px-4 py-10">
                        <LoadingState label="Loading payments…" />
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={visibleColumns.length} className="px-4 py-10">
                        <ErrorState bare message={error} onRetry={load} />
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={visibleColumns.length} className="px-4 py-10">
                        <EmptyState
                          bare
                          title="No platform payments"
                          hint="Record a payment against a tenant invoice to see it here."
                          actionLabel={canWrite !== false ? 'Add payment' : undefined}
                          onAction={canWrite !== false ? openCreate : undefined}
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
                        aria-label={`Open payment ${p.ref || p.id}`}
                      >
                        {visibleColumns.map((col) => renderPaymentCell(col.id, p))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="border-t border-stone-100 px-4 py-2.5 text-xs text-stone-500">
              Platform payments against tenant invoices (list / create / update / delete).
            </p>
          </div>
        </>
      )}

      <Modal open={modalOpen} onClose={closeCreate} title="Record payment" wide>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {formError ? (
            <p
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
              role="alert"
            >
              {formError}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={labelClass}>
                Tenant <span className="text-rose-600">*</span>
              </span>
              <select
                className={fieldClass}
                value={form.tenantId}
                onChange={(e) => onTenantChange(e.target.value)}
                disabled={saving}
                required
              >
                <option value="">Select tenant</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block sm:col-span-2">
              <span className={labelClass}>
                Invoice <span className="text-rose-600">*</span>
              </span>
              <select
                className={fieldClass}
                value={form.invoiceId}
                onChange={(e) => onInvoiceChange(e.target.value)}
                disabled={saving}
                required
              >
                <option value="">Select invoice</option>
                {invoicesForTenant.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.number} · {inv.tenantName || inv.customerName || '—'}
                    {inv.owed != null ? ` · owed ${fmtMoney(inv.owed)}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>
                Amount (₹) <span className="text-rose-600">*</span>
              </span>
              <input
                className={fieldClass}
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setField('amount', e.target.value)}
                disabled={saving}
                required
              />
            </label>

            <label className="block">
              <span className={labelClass}>Currency</span>
              <input className={fieldClass} value={form.currency} disabled readOnly />
            </label>

            <label className="block">
              <span className={labelClass}>
                Method <span className="text-rose-600">*</span>
              </span>
              <select
                className={fieldClass}
                value={form.method}
                onChange={(e) => setField('method', e.target.value)}
                disabled={saving}
                required
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>
                Status <span className="text-rose-600">*</span>
              </span>
              <select
                className={fieldClass}
                value={form.status}
                onChange={(e) => setField('status', e.target.value)}
                disabled={saving}
                required
              >
                <option value="SUCCEEDED">Succeeded</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>
                Reference <span className="text-rose-600">*</span>
              </span>
              <input
                className={fieldClass}
                value={form.reference}
                onChange={(e) => setField('reference', e.target.value)}
                disabled={saving}
                placeholder="UTR123456789"
                required
              />
            </label>

            <label className="block">
              <span className={labelClass}>
                Paid at <span className="text-rose-600">*</span>
              </span>
              <input
                className={fieldClass}
                type="datetime-local"
                value={form.paidAt}
                onChange={(e) => setField('paidAt', e.target.value)}
                disabled={saving}
                required
              />
            </label>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-stone-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" className={btnSecondary} onClick={closeCreate} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : 'Record payment'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={rzpModalOpen} onClose={closeRzpRequest} title="Request Razorpay payment" wide>
        <form className="space-y-4" onSubmit={handleRzpRequest}>
          {rzpFormError ? (
            <p
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
              role="alert"
            >
              {rzpFormError}
            </p>
          ) : null}

          <p className="text-xs text-stone-500">
            Creates a Razorpay payment request once your account ID is connected. UI only for now.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={labelClass}>Tenant (optional)</span>
              <select
                className={fieldClass}
                value={rzpForm.tenantId}
                onChange={(e) => setRzpForm((f) => ({ ...f, tenantId: e.target.value }))}
              >
                <option value="">No tenant link</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>
                Amount (₹) <span className="text-rose-600">*</span>
              </span>
              <input
                className={fieldClass}
                type="number"
                min="0"
                step="0.01"
                value={rzpForm.amount}
                onChange={(e) => setRzpForm((f) => ({ ...f, amount: e.target.value }))}
                required
              />
            </label>

            <label className="block">
              <span className={labelClass}>Currency</span>
              <input className={fieldClass} value={rzpForm.currency} readOnly disabled />
            </label>

            <label className="block">
              <span className={labelClass}>Customer name</span>
              <input
                className={fieldClass}
                value={rzpForm.customerName}
                onChange={(e) => setRzpForm((f) => ({ ...f, customerName: e.target.value }))}
                placeholder="Dr. Ramesh"
              />
            </label>

            <label className="block">
              <span className={labelClass}>Customer phone</span>
              <input
                className={fieldClass}
                value={rzpForm.customerPhone}
                onChange={(e) => setRzpForm((f) => ({ ...f, customerPhone: e.target.value }))}
                placeholder="+91…"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className={labelClass}>Customer email</span>
              <input
                className={fieldClass}
                type="email"
                value={rzpForm.customerEmail}
                onChange={(e) => setRzpForm((f) => ({ ...f, customerEmail: e.target.value }))}
                placeholder="accounts@example.com"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className={labelClass}>Description</span>
              <input
                className={fieldClass}
                value={rzpForm.description}
                onChange={(e) => setRzpForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Platform subscription · Nov 2026"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className={labelClass}>Notes</span>
              <textarea
                className={`${fieldClass} min-h-[72px] resize-y`}
                value={rzpForm.notes}
                onChange={(e) => setRzpForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional note for the payer"
              />
            </label>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-stone-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" className={btnSecondary} onClick={closeRzpRequest}>
              Cancel
            </button>
            <button type="submit" className={btnPrimary}>
              <FiSend className="h-4 w-4" aria-hidden />
              Send request
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default PaymentsPage
