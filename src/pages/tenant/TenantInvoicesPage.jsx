import { useCallback, useEffect, useState } from 'react'
import {
  FiCheckCircle,
  FiCreditCard,
  FiEdit2,
  FiMail,
  FiPlus,
  FiRefreshCw,
  FiSlash,
  FiTrash2,
} from 'react-icons/fi'
import {
  BOOKING_ENTITIES,
  INVOICE_LINE_TYPES,
  INVOICE_TYPE_TAGS,
  PAYMENT_METHODS,
  createBillingInvoice,
  deleteBillingInvoice,
  fetchBillingInvoice,
  fetchBillingInvoices,
  issueBillingInvoice,
  recalculateBillingInvoice,
  recordBillingInvoicePayment,
  sendBillingInvoiceEmail,
  updateBillingInvoice,
  voidBillingInvoice,
} from '../../api/tenantBilling'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import StatusBanner from '../../components/ui/StatusBanner'
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/PageState'
import {
  Field,
  LinesEditor,
  RefSelect,
  StateSelect,
  StatusChip,
  XTenantBanner,
  money,
  shortDate,
  useBillingRefs,
} from '../../features/billing/TenantBillingShared'
import { useAccess } from '../../hooks/useAccess'
import { apiErrorMessage } from '../../utils/errors'
import { resolveCatalogTenantSlug } from '../../utils/tenantHeader'
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  fieldClass,
  labelClass,
  tableHeadClass,
  tableWrapClass,
} from '../../utils/ui'

const STATUSES = ['all', 'DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID']

const EMPTY_ITEM = {
  line_type: 'service',
  description: '',
  hsn_sac: '9993',
  quantity: '1',
  uom: 'SET',
  unit_price: '',
  discount_percent: '0',
  gst_rate: '18',
}

const EMPTY = {
  invoice_type_tag: 'STANDARD',
  booking_entity: 'SERVICE',
  service: '',
  patient: '',
  customer_name: '',
  attention: '',
  address: '',
  buyer_email: '',
  gstin: '',
  state: '',
  due_days: 15,
  currency: 'INR',
  notes: '',
  items: [{ ...EMPTY_ITEM, key: 'it-0' }],
}

const ITEM_COLUMNS = [
  { key: 'line_type', label: 'Type', type: 'select', options: INVOICE_LINE_TYPES, className: 'min-w-[110px]' },
  { key: 'description', label: 'Description', className: 'min-w-[200px]' },
  { key: 'hsn_sac', label: 'HSN/SAC', className: 'min-w-[90px]' },
  { key: 'quantity', label: 'Qty', type: 'number', className: 'min-w-[80px]' },
  { key: 'uom', label: 'UOM', type: 'uom', className: 'min-w-[100px]' },
  { key: 'unit_price', label: 'Unit price', type: 'number', className: 'min-w-[110px]' },
  { key: 'discount_percent', label: 'Disc %', type: 'number', className: 'min-w-[80px]' },
  { key: 'gst_rate', label: 'GST %', type: 'number', className: 'min-w-[80px]' },
]

const EMPTY_PAYMENT = { amount: '', method: 'UPI', reference: '' }

const TenantInvoicesPage = () => {
  const access = useAccess()
  const canWrite = access.canWrite
  const tenantSlug = resolveCatalogTenantSlug(access.tenant)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState({ type: '', message: '' })

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [payTarget, setPayTarget] = useState(null)
  const [payForm, setPayForm] = useState(EMPTY_PAYMENT)
  const [emailTarget, setEmailTarget] = useState(null)
  const [emails, setEmails] = useState('')

  const refs = useBillingRefs(tenantSlug, modalOpen)
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const load = useCallback(async () => {
    if (!tenantSlug) {
      setRows([])
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      const { results } = await fetchBillingInvoices(tenantSlug, { status: statusFilter, search })
      setRows(results)
    } catch (err) {
      setRows([])
      setLoadError(apiErrorMessage(err, 'Could not load invoices.'))
    } finally {
      setLoading(false)
    }
  }, [tenantSlug, statusFilter, search])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setModalOpen(true)
  }

  const openEdit = async (row) => {
    setBusyId(row.id)
    try {
      const full = await fetchBillingInvoice(tenantSlug, row.id).catch(() => row)
      setEditing(full)
      setForm({
        ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, full[k] ?? EMPTY[k]])),
        items: full.items.length ? full.items : EMPTY.items,
      })
      setModalOpen(true)
    } finally {
      setBusyId('')
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.patient || !form.service) {
      setStatus({ type: 'error', message: 'Patient and service are required.' })
      return
    }
    if (!form.items.some((it) => it.description.trim())) {
      setStatus({ type: 'error', message: 'Add at least one line item.' })
      return
    }
    setSaving(true)
    try {
      if (editing) await updateBillingInvoice(tenantSlug, editing.id, form)
      else await createBillingInvoice(tenantSlug, form)
      setStatus({ type: 'success', message: editing ? 'Invoice updated.' : 'Draft invoice created.' })
      setModalOpen(false)
      await load()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not save invoice.') })
    } finally {
      setSaving(false)
    }
  }

  const runAction = async (row, fn, success) => {
    setBusyId(row.id)
    try {
      await fn()
      setStatus({ type: 'success', message: success })
      await load()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Action failed.') })
    } finally {
      setBusyId('')
    }
  }

  const handleConfirm = async () => {
    if (!confirm) return
    setConfirmBusy(true)
    const { row, kind } = confirm
    try {
      if (kind === 'delete') await deleteBillingInvoice(tenantSlug, row.id)
      else await voidBillingInvoice(tenantSlug, row.id)
      setStatus({ type: 'success', message: kind === 'delete' ? 'Invoice deleted.' : 'Invoice voided.' })
      await load()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Action failed.') })
    } finally {
      setConfirmBusy(false)
      setConfirm(null)
    }
  }

  const handleRecordPayment = async (e) => {
    e.preventDefault()
    const row = payTarget
    if (!(Number(payForm.amount) > 0)) {
      setStatus({ type: 'error', message: 'Enter a payment amount.' })
      return
    }
    setPayTarget(null)
    await runAction(row, () => recordBillingInvoicePayment(tenantSlug, row.id, payForm), 'Payment recorded.')
  }

  const handleSendEmail = async (e) => {
    e.preventDefault()
    const row = emailTarget
    setEmailTarget(null)
    await runAction(row, () => sendBillingInvoiceEmail(tenantSlug, row.id, emails), 'Invoice emailed.')
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={access.tenant?.name || 'Operations'}
        title="Invoices"
        description="Patient invoices with itemized GST for this tenant."
        actions={
          canWrite ? (
            <button type="button" className={btnPrimary} onClick={openCreate} disabled={!tenantSlug}>
              <FiPlus className="h-4 w-4" aria-hidden />
              New invoice
            </button>
          ) : null
        }
      />

      <XTenantBanner slug={tenantSlug} />
      <StatusBanner type={status.type} message={status.message} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className={`${fieldClass} sm:max-w-xs`}
          placeholder="Search customer or number"
          aria-label="Search invoices"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={`${fieldClass} sm:w-48`}
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All statuses' : s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      <div className={tableWrapClass}>
        {!tenantSlug ? (
          <EmptyState bare title="No tenant selected" hint="Invoices load once a tenant is selected." />
        ) : loading ? (
          <LoadingState label="Loading invoices…" />
        ) : loadError ? (
          <ErrorState bare message={loadError} onRetry={load} />
        ) : rows.length === 0 ? (
          <EmptyState
            bare
            title="No invoices yet"
            hint={canWrite ? 'Create a draft invoice or convert a quotation.' : 'Nothing on file.'}
            actionLabel={canWrite ? 'New invoice' : undefined}
            onAction={canWrite ? openCreate : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-4 py-3">Number</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3">Created</th>
                  {canWrite ? <th className="px-4 py-3 text-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((row) => {
                  const draft = row.status === 'DRAFT'
                  const voided = row.status.startsWith('VOID')
                  const payable = !draft && !voided && row.status !== 'PAID'
                  const busy = busyId === row.id
                  return (
                    <tr key={row.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3 font-semibold text-stone-900">{row.number}</td>
                      <td className="px-4 py-3 text-stone-700">{row.customer_name || '—'}</td>
                      <td className="px-4 py-3 text-stone-600">{row.patient_name || row.patient || '—'}</td>
                      <td className="px-4 py-3 text-stone-600">{row.invoice_type_tag}</td>
                      <td className="px-4 py-3">
                        <StatusChip status={row.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{money(row.total, row.currency)}</td>
                      <td className="px-4 py-3 text-right text-stone-600">{money(row.balance_due, row.currency)}</td>
                      <td className="px-4 py-3 text-stone-600">{shortDate(row.created_at)}</td>
                      {canWrite ? (
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            {draft ? (
                              <>
                                <button type="button" className={btnGhost} disabled={busy} onClick={() => openEdit(row)} aria-label={`Edit ${row.number}`} title="Edit draft">
                                  <FiEdit2 className="h-3.5 w-3.5" aria-hidden />
                                </button>
                                <button type="button" className={btnGhost} disabled={busy} onClick={() => runAction(row, () => issueBillingInvoice(tenantSlug, row.id), 'Invoice issued.')} aria-label={`Issue ${row.number}`} title="Issue">
                                  <FiCheckCircle className="h-3.5 w-3.5" aria-hidden />
                                </button>
                              </>
                            ) : null}
                            {payable ? (
                              <button type="button" className={btnGhost} disabled={busy} onClick={() => { setPayForm({ ...EMPTY_PAYMENT, amount: row.balance_due ?? '' }); setPayTarget(row) }} aria-label={`Record payment for ${row.number}`} title="Record payment">
                                <FiCreditCard className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            ) : null}
                            <button type="button" className={btnGhost} disabled={busy} onClick={() => { setEmails(row.buyer_email || ''); setEmailTarget(row) }} aria-label={`Email ${row.number}`} title="Send email">
                              <FiMail className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            <button type="button" className={btnGhost} disabled={busy} onClick={() => runAction(row, () => recalculateBillingInvoice(tenantSlug, row.id), 'Totals recalculated.')} aria-label={`Recalculate ${row.number}`} title="Recalculate">
                              <FiRefreshCw className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            {!draft && !voided ? (
                              <button type="button" className={`${btnGhost} text-rose-600 hover:bg-rose-50`} disabled={busy} onClick={() => setConfirm({ row, kind: 'void' })} aria-label={`Void ${row.number}`} title="Void">
                                <FiSlash className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            ) : null}
                            {draft ? (
                              <button type="button" className={`${btnGhost} text-rose-600 hover:bg-rose-50`} disabled={busy} onClick={() => setConfirm({ row, kind: 'delete' })} aria-label={`Delete ${row.number}`} title="Delete draft">
                                <FiTrash2 className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        title={editing ? `Edit ${editing.number}` : 'New invoice'}
        onClose={() => setModalOpen(false)}
        xl
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="tenant-invoice-form" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create draft'}
            </button>
          </div>
        }
      >
        <form id="tenant-invoice-form" className="space-y-4" onSubmit={handleSave}>
          {refs.error ? <StatusBanner type="warning" message={refs.error} /> : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field id="ti-patient" label="Patient" required>
              <RefSelect id="ti-patient" value={form.patient} onChange={(v) => set('patient', v)} rows={refs.patients} placeholder="Select patient" required />
            </Field>
            <Field id="ti-entity" label="Booking entity" required>
              <select id="ti-entity" className={fieldClass} value={form.booking_entity} onChange={(e) => set('booking_entity', e.target.value)}>
                {BOOKING_ENTITIES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </Field>
            <Field id="ti-service" label="Service" required>
              <RefSelect id="ti-service" value={form.service} onChange={(v) => set('service', v)} rows={refs.services} placeholder="Select service" required />
            </Field>
            <Field id="ti-type" label="Invoice type" required>
              <select id="ti-type" className={fieldClass} value={form.invoice_type_tag} onChange={(e) => set('invoice_type_tag', e.target.value)}>
                {(INVOICE_TYPE_TAGS.includes(form.invoice_type_tag) ? INVOICE_TYPE_TAGS : [form.invoice_type_tag, ...INVOICE_TYPE_TAGS]).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field id="ti-customer" label="Customer name" required>
              <input id="ti-customer" className={fieldClass} value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)} required />
            </Field>
            <Field id="ti-attention" label="Attention" required>
              <input id="ti-attention" className={fieldClass} value={form.attention} onChange={(e) => set('attention', e.target.value)} required />
            </Field>
            <Field id="ti-address" label="Address" required className="sm:col-span-2">
              <input id="ti-address" className={fieldClass} value={form.address} onChange={(e) => set('address', e.target.value)} required />
            </Field>
            <Field id="ti-email" label="Buyer email" required>
              <input id="ti-email" type="email" autoComplete="email" className={fieldClass} value={form.buyer_email} onChange={(e) => set('buyer_email', e.target.value)} required />
            </Field>
            <Field id="ti-state" label="State" required>
              <StateSelect id="ti-state" value={form.state} onChange={(v) => set('state', v)} />
            </Field>
            <Field id="ti-gstin" label="GSTIN">
              <input id="ti-gstin" className={`${fieldClass} uppercase`} maxLength={15} value={form.gstin} onChange={(e) => set('gstin', e.target.value.toUpperCase())} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field id="ti-due" label="Due days" required>
                <input id="ti-due" type="number" min="0" className={fieldClass} value={form.due_days} onChange={(e) => set('due_days', e.target.value)} required />
              </Field>
              <Field id="ti-currency" label="Currency" required>
                <input id="ti-currency" className={`${fieldClass} uppercase`} maxLength={3} value={form.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())} required />
              </Field>
            </div>
          </div>

          <div>
            <p className={labelClass}>Line items</p>
            <LinesEditor
              lines={form.items}
              onChange={(items) => set('items', items)}
              columns={ITEM_COLUMNS}
              emptyLine={EMPTY_ITEM}
              qtyKey="quantity"
            />
          </div>

          <Field id="ti-notes" label="Notes">
            <textarea id="ti-notes" rows={2} className={fieldClass} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </form>
      </Modal>

      <Modal
        open={Boolean(payTarget)}
        title={`Record payment · ${payTarget?.number || ''}`}
        onClose={() => setPayTarget(null)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setPayTarget(null)}>
              Cancel
            </button>
            <button type="submit" form="ti-pay-form" className={btnPrimary}>
              Record payment
            </button>
          </div>
        }
      >
        <form id="ti-pay-form" className="space-y-3" onSubmit={handleRecordPayment}>
          <Field id="ti-pay-amount" label="Amount" required>
            <input id="ti-pay-amount" type="number" min="0" step="0.01" className={fieldClass} value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} required />
          </Field>
          <Field id="ti-pay-method" label="Method" required>
            <select id="ti-pay-method" className={fieldClass} value={payForm.method} onChange={(e) => setPayForm((f) => ({ ...f, method: e.target.value }))}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </Field>
          <Field id="ti-pay-ref" label="Reference" required>
            <input id="ti-pay-ref" className={fieldClass} placeholder="UPI-TXN-12345" value={payForm.reference} onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))} required />
          </Field>
        </form>
      </Modal>

      <Modal
        open={Boolean(emailTarget)}
        title={`Email invoice · ${emailTarget?.number || ''}`}
        onClose={() => setEmailTarget(null)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setEmailTarget(null)}>
              Cancel
            </button>
            <button type="submit" form="ti-email-form" className={btnPrimary} disabled={!emails.trim()}>
              Send email
            </button>
          </div>
        }
      >
        <form id="ti-email-form" onSubmit={handleSendEmail}>
          <Field id="ti-email-to" label="Recipients" required>
            <input id="ti-email-to" className={fieldClass} placeholder="accounts@example.com" value={emails} onChange={(e) => setEmails(e.target.value)} />
          </Field>
          <p className="mt-1 text-xs text-stone-500">Comma separated.</p>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.kind === 'delete' ? 'Delete draft invoice?' : 'Void invoice?'}
        message={
          confirm?.kind === 'delete'
            ? `${confirm?.row.number} will be permanently removed.`
            : `${confirm?.row.number} will be marked void and can no longer be paid.`
        }
        confirmLabel={confirm?.kind === 'delete' ? 'Delete' : 'Void'}
        loading={confirmBusy}
        onConfirm={handleConfirm}
        onClose={() => setConfirm(null)}
      />
    </div>
  )
}

export default TenantInvoicesPage
