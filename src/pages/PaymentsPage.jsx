import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiPlus } from 'react-icons/fi'
import DraggableTh from '../components/ui/DraggableTh'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import TenantOpsPlaceholder from '../components/TenantOpsPlaceholder'
import { EmptyState } from '../components/ui/PageState'
import { loadInvoices } from '../features/invoices/store'
import {
  createPayment,
  fmtDate,
  fmtDateTime,
  fmtMoney,
  loadPayments,
  paymentStatusClass,
} from '../features/payments/store'
import { useAccess } from '../hooks/useAccess'
import { useColumnOrder } from '../hooks/useColumnOrder'
import { listTenantsByStatus } from '../store/platformStore'
import {
  btnPrimary,
  btnSecondary,
  fieldClass,
  labelClass,
  tableHeadClass,
  tableWrapClass,
} from '../utils/ui'

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

const PAYMENT_MODES = ['UPI', 'NEFT', 'IMPS', 'Card', 'Bank transfer', 'Cash', 'Cheque']

const PAYMENT_COLUMNS = [
  { id: 'payment', label: 'Payment' },
  { id: 'customer', label: 'Customer' },
  { id: 'invoice', label: 'Invoice', invoiceOnly: true },
  { id: 'mode', label: 'Mode' },
  { id: 'status', label: 'Status' },
  { id: 'date', label: 'Date' },
  { id: 'amount', label: 'Amount', align: 'right' },
]

const PAYMENT_COLUMN_IDS = PAYMENT_COLUMNS.map((c) => c.id)

const emptyForm = () => ({
  tagType: 'tenant',
  tenantId: '',
  invoiceId: '',
  amount: '',
  status: 'SUCCESS',
  mode: 'UPI',
  modeDetail: '',
  purpose: '',
  paidAt: new Date().toISOString().slice(0, 16),
  payerName: '',
  payerEmail: '',
  bankRef: '',
  notes: '',
})

const hasInvoice = (p) => Boolean(p?.invoiceId || p?.invoiceNumber)

const renderPaymentCell = (colId, p) => {
  switch (colId) {
    case 'payment':
      return (
        <td key={colId} className="px-4 py-3">
          <p className="font-medium text-stone-900">{p.ref}</p>
          <p className="text-xs text-stone-500">{p.purpose}</p>
        </td>
      )
    case 'customer':
      return (
        <td key={colId} className="px-4 py-3 font-medium text-stone-800">
          {p.tenantName}
        </td>
      )
    case 'invoice':
      return (
        <td key={colId} className="px-4 py-3 text-stone-700">
          {p.invoiceNumber || '—'}
        </td>
      )
    case 'mode':
      return (
        <td key={colId} className="px-4 py-3 text-stone-700">
          <p>{p.mode}</p>
          {p.modeDetail ? <p className="text-xs text-stone-500">{p.modeDetail}</p> : null}
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
  const { isSuperAdmin } = useAccess()
  const [payments, setPayments] = useState(() => loadPayments())
  const [viewMode, setViewMode] = useState('invoice')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [banner, setBanner] = useState({ type: '', message: '' })
  const [saving, setSaving] = useState(false)
  const { columnOrder, moveColumn } = useColumnOrder(
    'sc_ops_payments_col_order_v1',
    PAYMENT_COLUMN_IDS,
  )

  const tenants = useMemo(() => listTenantsByStatus('active'), [])
  const invoices = useMemo(() => loadInvoices(), [])

  const visibleColumns = useMemo(
    () =>
      columnOrder
        .map((id) => PAYMENT_COLUMNS.find((c) => c.id === id))
        .filter(Boolean)
        .filter((c) => !(c.invoiceOnly && viewMode !== 'invoice')),
    [columnOrder, viewMode],
  )

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

  const selectedInvoice = useMemo(
    () => invoices.find((inv) => String(inv.id) === String(form.invoiceId)) || null,
    [invoices, form.invoiceId],
  )

  const invoicesForTenant = useMemo(() => {
    if (!form.tenantId) return invoices
    const tenant = tenants.find((t) => String(t.id) === String(form.tenantId))
    const tenantName = String(tenant?.name || '').toLowerCase()
    const matched = invoices.filter((inv) => {
      if (inv.tenantId && String(inv.tenantId) === String(form.tenantId)) return true
      const invName = String(inv.tenantName || '').toLowerCase()
      if (tenantName && invName && (invName === tenantName || invName.includes(tenantName) || tenantName.includes(invName))) {
        return true
      }
      return !inv.tenantId && !inv.tenantName
    })
    return matched.length ? matched : invoices
  }, [invoices, form.tenantId, tenants])

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

  const onTagTypeChange = (tagType) => {
    setForm((f) => ({
      ...f,
      tagType,
      invoiceId: tagType === 'tenant' ? '' : f.invoiceId,
    }))
  }

  const onTenantChange = (tenantId) => {
    const tenant = tenants.find((t) => String(t.id) === String(tenantId))
    setForm((f) => ({
      ...f,
      tenantId,
      payerName: f.payerName || tenant?.owner_name || '',
      payerEmail: f.payerEmail || tenant?.owner_email || tenant?.email || '',
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
    const matchedTenant =
      tenants.find((t) => String(t.id) === String(inv.tenantId)) ||
      tenants.find(
        (t) =>
          String(t.name || '').toLowerCase() === String(inv.tenantName || '').toLowerCase(),
      )
    setForm((f) => ({
      ...f,
      tagType: 'invoice',
      invoiceId,
      tenantId: matchedTenant?.id || f.tenantId,
      amount:
        f.amount ||
        (inv.owed != null && Number(inv.owed) > 0
          ? String(inv.owed)
          : inv.amount != null
            ? String(inv.amount)
            : f.amount),
      purpose: f.purpose || `Payment · invoice ${inv.number}`,
      payerName: f.payerName || inv.payerName || matchedTenant?.owner_name || '',
      payerEmail: f.payerEmail || inv.email || matchedTenant?.owner_email || '',
    }))
  }

  const validate = () => {
    if (!form.tenantId) return 'Select a tenant.'
    if (form.tagType === 'invoice' && !form.invoiceId) return 'Select an invoice to tag.'
    const amount = Number(form.amount)
    if (!form.amount || Number.isNaN(amount) || amount <= 0) return 'Enter a valid amount.'
    if (!String(form.purpose || '').trim()) return 'Enter a purpose.'
    return ''
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const message = validate()
    if (message) {
      setFormError(message)
      return
    }
    const tenant = tenants.find((t) => String(t.id) === String(form.tenantId))
    if (!tenant) {
      setFormError('Select a valid tenant.')
      return
    }

    setSaving(true)
    setFormError('')
    try {
      const inv = form.tagType === 'invoice' ? selectedInvoice : null
      createPayment({
        tenantId: tenant.id,
        tenantName: tenant.name,
        invoiceId: inv?.id || null,
        invoiceNumber: inv?.number || null,
        amount: form.amount,
        status: form.status,
        mode: form.mode,
        modeDetail: form.modeDetail,
        purpose: form.purpose,
        paidAt: form.paidAt,
        payerName: form.payerName,
        payerEmail: form.payerEmail,
        bankRef: form.bankRef,
        notes: form.notes,
        gateway: form.mode === 'UPI' || form.mode === 'Card' ? 'Razorpay' : 'Manual bank',
      })
      setPayments(loadPayments())
      setViewMode(inv ? 'invoice' : 'payment')
      setStatusFilter('ALL')
      setModalOpen(false)
      setForm(emptyForm())
      setBanner({
        type: 'success',
        message: inv
          ? `Payment saved and tagged to invoice ${inv.number}.`
          : `Payment saved and tagged to ${tenant.name}.`,
      })
    } catch (err) {
      setFormError(err?.message || 'Could not save payment.')
    } finally {
      setSaving(false)
    }
  }

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
        actions={
          <button type="button" className={btnPrimary} onClick={openCreate}>
            <FiPlus className="h-4 w-4" aria-hidden />
            Add payment
          </button>
        }
      />

      <StatusBanner type={banner.type} message={banner.message} />

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
          : 'Payment view — standalone receipts (onboarding, fees, etc.) with no invoice linked.'}{' '}
        Drag column handles to reorder.
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
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-4 py-10">
                    <EmptyState
                      bare
                      title={
                        viewMode === 'invoice'
                          ? 'No invoice-linked payments'
                          : 'No unlinked payments'
                      }
                      hint={
                        viewMode === 'invoice'
                          ? 'Add a payment and tag an invoice to see it here.'
                          : 'Add a payment tagged to a tenant (no invoice) to see it here.'
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
                    {visibleColumns.map((col) => renderPaymentCell(col.id, p))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-stone-100 px-4 py-2.5 text-xs text-stone-500">
          Customer → O-HM Senior Care. Switch views above to see invoice-linked vs standalone
          payments.
        </p>
      </div>

      <Modal open={modalOpen} onClose={closeCreate} title="Add payment" wide>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {formError ? (
            <p
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
              role="alert"
            >
              {formError}
            </p>
          ) : null}

          <div>
            <p className={labelClass}>Tag payment to</p>
            <div className="flex flex-wrap gap-4">
              {[
                { id: 'tenant', label: 'Tenant only' },
                { id: 'invoice', label: 'Invoice' },
              ].map((opt) => (
                <label key={opt.id} className="inline-flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="radio"
                    name="tagType"
                    value={opt.id}
                    checked={form.tagType === opt.id}
                    onChange={() => onTagTypeChange(opt.id)}
                    disabled={saving}
                    className="accent-brand-500"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

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

            {form.tagType === 'invoice' ? (
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
                      {inv.number} · {inv.tenantName || inv.payerName || '—'}
                      {inv.owed != null ? ` · owed ${fmtMoney(inv.owed)}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

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
              <span className={labelClass}>Status</span>
              <select
                className={fieldClass}
                value={form.status}
                onChange={(e) => setField('status', e.target.value)}
                disabled={saving}
              >
                <option value="SUCCESS">Success</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>Mode</span>
              <select
                className={fieldClass}
                value={form.mode}
                onChange={(e) => setField('mode', e.target.value)}
                disabled={saving}
              >
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>Paid at</span>
              <input
                className={fieldClass}
                type="datetime-local"
                value={form.paidAt}
                onChange={(e) => setField('paidAt', e.target.value)}
                disabled={saving}
              />
            </label>

            <label className="block sm:col-span-2">
              <span className={labelClass}>
                Purpose <span className="text-rose-600">*</span>
              </span>
              <input
                className={fieldClass}
                value={form.purpose}
                onChange={(e) => setField('purpose', e.target.value)}
                disabled={saving}
                placeholder="Platform subscription · Oct 2026"
                required
              />
            </label>

            <label className="block">
              <span className={labelClass}>Mode detail</span>
              <input
                className={fieldClass}
                value={form.modeDetail}
                onChange={(e) => setField('modeDetail', e.target.value)}
                disabled={saving}
                placeholder="UPI · name@okaxis"
              />
            </label>

            <label className="block">
              <span className={labelClass}>Bank / UTR ref</span>
              <input
                className={fieldClass}
                value={form.bankRef}
                onChange={(e) => setField('bankRef', e.target.value)}
                disabled={saving}
                placeholder="Optional"
              />
            </label>

            <label className="block">
              <span className={labelClass}>Payer name</span>
              <input
                className={fieldClass}
                value={form.payerName}
                onChange={(e) => setField('payerName', e.target.value)}
                disabled={saving}
              />
            </label>

            <label className="block">
              <span className={labelClass}>Payer email</span>
              <input
                className={fieldClass}
                type="email"
                value={form.payerEmail}
                onChange={(e) => setField('payerEmail', e.target.value)}
                disabled={saving}
              />
            </label>

            <label className="block sm:col-span-2">
              <span className={labelClass}>Notes</span>
              <textarea
                className={`${fieldClass} min-h-[72px] resize-y`}
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                disabled={saving}
                placeholder="Optional reconciliation note"
              />
            </label>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-stone-100 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              className={btnSecondary}
              onClick={closeCreate}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : 'Save payment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default PaymentsPage
