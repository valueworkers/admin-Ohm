import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchInvoices } from '../api/invoices'
import {
  deletePlatformPayment,
  fetchPlatformPaymentById,
  methodForApi,
  updatePlatformPayment,
} from '../api/platformPayments'
import { fetchTenants } from '../api/tenants'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Modal from '../components/ui/Modal'
import StatusBanner from '../components/ui/StatusBanner'
import TenantOpsPlaceholder from '../components/TenantOpsPlaceholder'
import { ErrorState, LoadingState } from '../components/ui/PageState'
import { useAccess } from '../hooks/useAccess'
import {
  fmtDate,
  fmtDateTime,
  fmtMoney,
  paymentStatusClass,
} from '../features/payments/store'
import { apiErrorMessage } from '../utils/errors'
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  fieldClass,
  labelClass,
} from '../utils/ui'

const sectionLabel = 'text-[11px] font-bold uppercase tracking-wide text-brand-700'

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'neft', label: 'NEFT' },
  { value: 'imps', label: 'IMPS' },
  { value: 'card', label: 'Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
]

const emptyEditForm = () => ({
  tenantId: '',
  invoiceId: '',
  amount: '',
  currency: 'INR',
  method: 'bank_transfer',
  status: 'SUCCEEDED',
  reference: '',
  paidAt: '',
})

const toLocalInput = (iso) => {
  if (!iso) return ''
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

const Row = ({ label, children }) => (
  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-stone-100 py-2.5 last:border-0">
    <dt className="text-sm text-stone-500">{label}</dt>
    <dd className="max-w-[65%] text-right text-sm font-medium text-stone-900">{children}</dd>
  </div>
)

const PaymentDetailPage = () => {
  const { paymentId } = useParams()
  const navigate = useNavigate()
  const { isSuperAdmin, canWrite } = useAccess()
  const [payment, setPayment] = useState(null)
  const [tenants, setTenants] = useState([])
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [banner, setBanner] = useState({ type: '', message: '' })
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState(emptyEditForm)
  const [editError, setEditError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = useCallback(async () => {
    if (!isSuperAdmin) {
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      setPayment(await fetchPlatformPaymentById(paymentId))
    } catch (err) {
      setPayment(null)
      setLoadError(apiErrorMessage(err, 'Could not load payment.'))
    } finally {
      setLoading(false)
    }
  }, [isSuperAdmin, paymentId, reloadKey])

  const loadLookups = useCallback(async () => {
    if (!isSuperAdmin) return
    try {
      const [tenantRows, invoiceRows] = await Promise.all([
        fetchTenants().catch(() => []),
        fetchInvoices({ page: 1, pageSize: 100 }).catch(() => []),
      ])
      setTenants(Array.isArray(tenantRows) ? tenantRows : [])
      setInvoices(Array.isArray(invoiceRows) ? invoiceRows : [])
    } catch {
      setTenants([])
      setInvoices([])
    }
  }, [isSuperAdmin])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    loadLookups()
  }, [loadLookups])

  useEffect(() => {
    if (!banner.message) return undefined
    const t = window.setTimeout(() => setBanner({ type: '', message: '' }), 4000)
    return () => window.clearTimeout(t)
  }, [banner])

  const invoicesForTenant = useMemo(() => {
    if (!editForm.tenantId) return invoices
    return invoices.filter(
      (inv) => !inv.tenantId || String(inv.tenantId) === String(editForm.tenantId),
    )
  }, [invoices, editForm.tenantId])

  const setEditField = (key, value) => setEditForm((f) => ({ ...f, [key]: value }))

  const openEdit = () => {
    if (!payment) return
    setEditForm({
      tenantId: payment.tenantId || '',
      invoiceId: payment.invoiceId || '',
      amount: payment.amount != null ? String(payment.amount) : '',
      currency: payment.currency || 'INR',
      method: methodForApi(payment.method || payment.mode) || 'bank_transfer',
      status: payment.status || 'SUCCEEDED',
      reference: payment.ref || '',
      paidAt: toLocalInput(payment.paidAt),
    })
    setEditError('')
    setEditOpen(true)
  }

  const validateEdit = () => {
    if (!editForm.tenantId) return 'Select a tenant.'
    if (!editForm.invoiceId) return 'Select an invoice.'
    const amount = Number(editForm.amount)
    if (!editForm.amount || Number.isNaN(amount) || amount <= 0) return 'Enter a valid amount.'
    if (!editForm.method) return 'Select a payment method.'
    if (!editForm.status) return 'Select a status.'
    if (!String(editForm.reference || '').trim()) return 'Reference is required.'
    if (!editForm.paidAt) return 'Paid at is required.'
    return ''
  }

  const handleUpdate = async (event) => {
    event.preventDefault()
    const message = validateEdit()
    if (message) {
      setEditError(message)
      return
    }
    setSaving(true)
    setEditError('')
    try {
      const updated = await updatePlatformPayment(payment.id || paymentId, {
        tenantId: editForm.tenantId,
        invoiceId: editForm.invoiceId,
        amount: editForm.amount,
        currency: editForm.currency,
        method: editForm.method,
        status: editForm.status,
        reference: editForm.reference,
        paidAt: fromLocalInput(editForm.paidAt),
      })
      setPayment(updated)
      setEditOpen(false)
      setBanner({ type: 'success', message: 'Payment updated.' })
    } catch (err) {
      setEditError(apiErrorMessage(err, 'Could not update payment.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!payment?.id) return
    setSaving(true)
    try {
      await deletePlatformPayment(payment.id)
      setConfirmDelete(false)
      navigate('/ops/payments')
    } catch (err) {
      setBanner({
        type: 'error',
        message: apiErrorMessage(err, 'Could not delete payment.'),
      })
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

  if (loading) {
    return <LoadingState label="Loading payment…" />
  }

  if (loadError && !payment) {
    return (
      <div className="sc-page-enter space-y-4">
        <ErrorState message={loadError} onRetry={() => setReloadKey((k) => k + 1)} />
        <div className="text-center">
          <Link to="/ops/payments" className={btnSecondary}>
            Back to payments
          </Link>
        </div>
      </div>
    )
  }

  if (!payment) {
    return (
      <div className="sc-page-enter space-y-4">
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-10 text-center">
          <p className="font-medium text-rose-800">Payment not found</p>
          <p className="mt-1 text-sm text-rose-700">
            It may have been removed, or the link is wrong.
          </p>
          <Link to="/ops/payments" className={`${btnPrimary} mt-4 inline-flex`}>
            Back to payments
          </Link>
        </div>
      </div>
    )
  }

  const ok =
    String(payment.status).toUpperCase() === 'SUCCEEDED' ||
    String(payment.status).toUpperCase() === 'SUCCESS'

  return (
    <div className="sc-page-enter space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-brand-700">
            <Link to="/ops/payments" className="hover:underline">
              Payments
            </Link>
            <span className="text-stone-300"> / </span>
            {payment.ref || payment.id}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${paymentStatusClass(
                payment.status,
              )}`}
            >
              {payment.status}
            </span>
            <span className="inline-flex rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-semibold text-stone-700">
              Tenant → O-HM
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
            {fmtMoney(payment.amount)}
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            {payment.tenantName || payment.tenantId || '—'}
            <span className="text-stone-400"> · </span>
            {payment.mode || payment.method || '—'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite !== false ? (
            <>
              <button type="button" className={btnSecondary} onClick={openEdit}>
                Edit
              </button>
              <button
                type="button"
                className={btnDanger}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </button>
            </>
          ) : null}
          <Link to="/ops/payments" className={btnSecondary}>
            Back
          </Link>
        </div>
      </div>

      <StatusBanner type={banner.type} message={banner.message} />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete payment?"
        message={`Delete ${payment.ref || payment.id}? This cannot be undone.`}
        confirmLabel="Delete payment"
        loading={saving}
        onConfirm={handleDelete}
        onClose={() => {
          if (!saving) setConfirmDelete(false)
        }}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
          <h2 className={sectionLabel}>Payment</h2>
          <dl className="mt-2">
            <Row label="Reference">{payment.ref || '—'}</Row>
            <Row label="Amount">{fmtMoney(payment.amount)}</Row>
            <Row label="Currency">{payment.currency || 'INR'}</Row>
            <Row label="Status">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${paymentStatusClass(
                  payment.status,
                )}`}
              >
                {payment.status}
              </span>
            </Row>
            <Row label="Paid at">{fmtDateTime(payment.paidAt)}</Row>
            <Row label="Method">{payment.mode || payment.method || '—'}</Row>
          </dl>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
          <h2 className={sectionLabel}>Tenant & invoice</h2>
          <dl className="mt-2">
            <Row label="Tenant">{payment.tenantName || payment.tenantId || '—'}</Row>
            <Row label="Invoice">
              {payment.invoiceId ? (
                <button
                  type="button"
                  className="font-medium text-brand-800 hover:underline"
                  onClick={() => navigate(`/ops/invoices/${payment.invoiceId}`)}
                >
                  {payment.invoiceNumber || `#${payment.invoiceId}`}
                </button>
              ) : (
                '—'
              )}
            </Row>
            <Row label="Date">{fmtDate(payment.paidAt)}</Row>
            <Row label="Settlement">{ok ? 'Applied to platform books' : 'Not settled'}</Row>
          </dl>
          {payment.invoiceId ? (
            <button
              type="button"
              className={`${btnSecondary} mt-3`}
              onClick={() => navigate(`/ops/invoices/${payment.invoiceId}`)}
            >
              Open invoice
            </button>
          ) : null}
        </section>
      </div>

      <Modal
        open={editOpen}
        onClose={() => {
          if (!saving) setEditOpen(false)
        }}
        title="Update payment"
        wide
      >
        <form className="space-y-4" onSubmit={handleUpdate}>
          {editError ? (
            <p
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
              role="alert"
            >
              {editError}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={labelClass}>
                Tenant <span className="text-rose-600">*</span>
              </span>
              <select
                className={fieldClass}
                value={editForm.tenantId}
                onChange={(e) => {
                  const tenantId = e.target.value
                  setEditForm((f) => ({
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
                }}
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
                value={editForm.invoiceId}
                onChange={(e) => {
                  const invoiceId = e.target.value
                  const inv = invoices.find((i) => String(i.id) === String(invoiceId))
                  setEditForm((f) => ({
                    ...f,
                    invoiceId,
                    tenantId: inv?.tenantId || f.tenantId,
                  }))
                }}
                disabled={saving}
                required
              >
                <option value="">Select invoice</option>
                {invoicesForTenant.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.number} · {inv.tenantName || inv.customerName || '—'}
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
                value={editForm.amount}
                onChange={(e) => setEditField('amount', e.target.value)}
                disabled={saving}
                required
              />
            </label>

            <label className="block">
              <span className={labelClass}>Currency</span>
              <input
                className={fieldClass}
                value={editForm.currency}
                onChange={(e) => setEditField('currency', e.target.value.toUpperCase())}
                disabled={saving}
              />
            </label>

            <label className="block">
              <span className={labelClass}>
                Method <span className="text-rose-600">*</span>
              </span>
              <select
                className={fieldClass}
                value={editForm.method}
                onChange={(e) => setEditField('method', e.target.value)}
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
                value={editForm.status}
                onChange={(e) => setEditField('status', e.target.value)}
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
                value={editForm.reference}
                onChange={(e) => setEditField('reference', e.target.value)}
                disabled={saving}
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
                value={editForm.paidAt}
                onChange={(e) => setEditField('paidAt', e.target.value)}
                disabled={saving}
                required
              />
            </label>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-stone-100 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setEditOpen(false)}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default PaymentDetailPage
