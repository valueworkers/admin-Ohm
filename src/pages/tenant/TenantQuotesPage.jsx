import { useCallback, useEffect, useState } from 'react'
import {
  FiCopy,
  FiEdit2,
  FiFileText,
  FiMail,
  FiPlus,
  FiRefreshCw,
  FiSend,
  FiTrash2,
} from 'react-icons/fi'
import {
  BOOKING_ENTITIES,
  QUOTE_LINE_KINDS,
  convertBillingQuoteToInvoice,
  createBillingQuote,
  deleteBillingQuote,
  fetchBillingQuote,
  fetchBillingQuotes,
  recalculateBillingQuote,
  reviseBillingQuote,
  sendBillingQuote,
  sendBillingQuoteTest,
  updateBillingQuote,
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

const STATUSES = ['all', 'draft', 'sent', 'accepted', 'rejected', 'expired']

const EMPTY_LINE = {
  kind: 'service',
  item: '',
  specification: '',
  hsn_sac: '9993',
  uom: 'VST',
  qty: '1',
  unit_price: '',
  discount_percent: '0',
  gst_rate: '18',
}

const EMPTY = {
  booking_entity: 'SERVICE',
  service: '',
  patient: '',
  company: '',
  attention: '',
  address: '',
  gstin: '',
  state: '',
  buyer_email: '',
  valid_days: 30,
  freight: '0',
  packing: '0',
  charges_gst_rate: '18',
  notes: '',
  lines: [{ ...EMPTY_LINE, key: 'ln-0' }],
}

const LINE_COLUMNS = [
  { key: 'kind', label: 'Kind', type: 'select', options: QUOTE_LINE_KINDS, className: 'min-w-[110px]' },
  { key: 'item', label: 'Item', className: 'min-w-[180px]' },
  { key: 'specification', label: 'Specification', className: 'min-w-[140px]' },
  { key: 'hsn_sac', label: 'HSN/SAC', className: 'min-w-[90px]' },
  { key: 'uom', label: 'UOM', type: 'uom', className: 'min-w-[100px]' },
  { key: 'qty', label: 'Qty', type: 'number', className: 'min-w-[80px]' },
  { key: 'unit_price', label: 'Unit price', type: 'number', className: 'min-w-[110px]' },
  { key: 'discount_percent', label: 'Disc %', type: 'number', className: 'min-w-[80px]' },
  { key: 'gst_rate', label: 'GST %', type: 'number', className: 'min-w-[80px]' },
]

const TenantQuotesPage = () => {
  const access = useAccess()
  const canWrite = access.canWrite
  const tenantSlug = resolveCatalogTenantSlug(access.tenant)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [bookingEntity, setBookingEntity] = useState('')
  const [sortBy, setSortBy] = useState('-updated_at')
  const [status, setStatus] = useState({ type: '', message: '' })

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [testTarget, setTestTarget] = useState(null)
  const [testEmails, setTestEmails] = useState('')

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
      const { results } = await fetchBillingQuotes(tenantSlug, {
        status: statusFilter,
        search,
        bookingEntity: bookingEntity || undefined,
        ordering: sortBy || undefined,
      })
      setRows(results)
    } catch (err) {
      setRows([])
      setLoadError(apiErrorMessage(err, 'Could not load quotations.'))
    } finally {
      setLoading(false)
    }
  }, [tenantSlug, statusFilter, search, bookingEntity, sortBy])

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
      const full = await fetchBillingQuote(tenantSlug, row.id).catch(() => row)
      setEditing(full)
      setForm({
        ...EMPTY,
        ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, full[k] ?? EMPTY[k]])),
        lines: full.lines.length ? full.lines : EMPTY.lines,
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
    if (!form.lines.some((ln) => ln.item.trim())) {
      setStatus({ type: 'error', message: 'Add at least one line item.' })
      return
    }
    setSaving(true)
    try {
      if (editing) await updateBillingQuote(tenantSlug, editing.id, form)
      else await createBillingQuote(tenantSlug, form)
      setStatus({ type: 'success', message: editing ? 'Quotation updated.' : 'Quotation created.' })
      setModalOpen(false)
      await load()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not save quotation.') })
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

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteBillingQuote(tenantSlug, deleteTarget.id)
      setStatus({ type: 'success', message: 'Quotation deleted.' })
      await load()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not delete quotation.') })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const handleSendTest = async (e) => {
    e.preventDefault()
    const row = testTarget
    setTestTarget(null)
    await runAction(row, () => sendBillingQuoteTest(tenantSlug, row.id, testEmails), 'Test email sent.')
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={access.tenant?.name || 'Operations'}
        title="Quotations"
        description="Patient quotations with GST line items for this tenant."
        actions={
          canWrite ? (
            <button type="button" className={btnPrimary} onClick={openCreate} disabled={!tenantSlug}>
              <FiPlus className="h-4 w-4" aria-hidden />
              New quotation
            </button>
          ) : null
        }
      />

      <XTenantBanner slug={tenantSlug} />
      <StatusBanner type={status.type} message={status.message} />

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <input
          className={`${fieldClass} sm:max-w-xs`}
          placeholder="Search number or company"
          aria-label="Search quotations"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={`${fieldClass} sm:w-44`}
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All statuses' : s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <select
          className={`${fieldClass} sm:w-44`}
          aria-label="Filter by booking entity"
          value={bookingEntity}
          onChange={(e) => setBookingEntity(e.target.value)}
        >
          <option value="">All entities</option>
          {BOOKING_ENTITIES.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <select
          className={`${fieldClass} sm:w-48`}
          aria-label="Sort quotations"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="-updated_at">Newest updated</option>
          <option value="updated_at">Oldest updated</option>
          <option value="-created_at">Newest created</option>
          <option value="number">Number A–Z</option>
          <option value="-number">Number Z–A</option>
          <option value="status">Status A–Z</option>
          <option value="-status">Status Z–A</option>
          <option value="company">Company A–Z</option>
          <option value="-company">Company Z–A</option>
        </select>
      </div>

      <div className={tableWrapClass}>
        {!tenantSlug ? (
          <EmptyState bare title="No tenant selected" hint="Quotations load once a tenant is selected." />
        ) : loading ? (
          <LoadingState label="Loading quotations…" />
        ) : loadError ? (
          <ErrorState bare message={loadError} onRetry={load} />
        ) : rows.length === 0 ? (
          <EmptyState
            bare
            title="No quotations yet"
            hint={canWrite ? 'Create a quotation for a patient.' : 'Nothing on file.'}
            actionLabel={canWrite ? 'New quotation' : undefined}
            onAction={canWrite ? openCreate : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-4 py-3">Number</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Created</th>
                  {canWrite ? <th className="px-4 py-3 text-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((row) => {
                  const draft = row.status === 'DRAFT'
                  const busy = busyId === row.id
                  return (
                    <tr key={row.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3 font-semibold text-stone-900">{row.number}</td>
                      <td className="px-4 py-3 text-stone-700">{row.company || '—'}</td>
                      <td className="px-4 py-3 text-stone-600">{row.patient_name || row.patient || '—'}</td>
                      <td className="px-4 py-3 text-stone-600">{row.booking_entity}</td>
                      <td className="px-4 py-3">
                        <StatusChip status={row.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{money(row.total)}</td>
                      <td className="px-4 py-3 text-stone-600">{shortDate(row.created_at)}</td>
                      {canWrite ? (
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            {draft ? (
                              <>
                                <button type="button" className={btnGhost} disabled={busy} onClick={() => openEdit(row)} aria-label={`Edit ${row.number}`} title="Edit">
                                  <FiEdit2 className="h-3.5 w-3.5" aria-hidden />
                                </button>
                                <button type="button" className={btnGhost} disabled={busy} onClick={() => runAction(row, () => sendBillingQuote(tenantSlug, row.id), 'Quotation sent.')} aria-label={`Send ${row.number}`} title="Send">
                                  <FiSend className="h-3.5 w-3.5" aria-hidden />
                                </button>
                              </>
                            ) : (
                              <button type="button" className={btnGhost} disabled={busy} onClick={() => runAction(row, () => reviseBillingQuote(tenantSlug, row.id), 'Revision created.')} aria-label={`Revise ${row.number}`} title="Revise">
                                <FiCopy className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            )}
                            <button type="button" className={btnGhost} disabled={busy} onClick={() => { setTestEmails(row.buyer_email || ''); setTestTarget(row) }} aria-label={`Send test for ${row.number}`} title="Send test">
                              <FiMail className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            <button type="button" className={btnGhost} disabled={busy} onClick={() => runAction(row, () => recalculateBillingQuote(tenantSlug, row.id), 'Totals recalculated.')} aria-label={`Recalculate ${row.number}`} title="Recalculate">
                              <FiRefreshCw className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            <button type="button" className={btnGhost} disabled={busy} onClick={() => runAction(row, () => convertBillingQuoteToInvoice(tenantSlug, row.id), 'Converted to draft invoice.')} aria-label={`Convert ${row.number} to invoice`} title="Convert to invoice">
                              <FiFileText className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            {draft ? (
                              <button type="button" className={`${btnGhost} text-rose-600 hover:bg-rose-50`} disabled={busy} onClick={() => setDeleteTarget(row)} aria-label={`Delete ${row.number}`} title="Delete">
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
        title={editing ? `Edit ${editing.number}` : 'New quotation'}
        onClose={() => setModalOpen(false)}
        xl
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="tenant-quote-form" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create quotation'}
            </button>
          </div>
        }
      >
        <form id="tenant-quote-form" className="space-y-4" onSubmit={handleSave}>
          {refs.error ? <StatusBanner type="warning" message={refs.error} /> : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field id="tq-patient" label="Patient" required>
              <RefSelect id="tq-patient" value={form.patient} onChange={(v) => set('patient', v)} rows={refs.patients} placeholder="Select patient" required />
            </Field>
            <Field id="tq-entity" label="Booking entity" required>
              <select id="tq-entity" className={fieldClass} value={form.booking_entity} onChange={(e) => set('booking_entity', e.target.value)}>
                {BOOKING_ENTITIES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </Field>
            <Field id="tq-service" label="Service" required>
              <RefSelect id="tq-service" value={form.service} onChange={(v) => set('service', v)} rows={refs.services} placeholder="Select service" required />
            </Field>
            <Field id="tq-company" label="Company" required>
              <input id="tq-company" className={fieldClass} value={form.company} onChange={(e) => set('company', e.target.value)} required />
            </Field>
            <Field id="tq-attention" label="Attention" required>
              <input id="tq-attention" className={fieldClass} value={form.attention} onChange={(e) => set('attention', e.target.value)} required />
            </Field>
            <Field id="tq-email" label="Buyer email" required>
              <input id="tq-email" type="email" autoComplete="email" className={fieldClass} value={form.buyer_email} onChange={(e) => set('buyer_email', e.target.value)} required />
            </Field>
            <Field id="tq-address" label="Address" required className="sm:col-span-2">
              <input id="tq-address" className={fieldClass} value={form.address} onChange={(e) => set('address', e.target.value)} required />
            </Field>
            <Field id="tq-state" label="State" required>
              <StateSelect id="tq-state" value={form.state} onChange={(v) => set('state', v)} />
            </Field>
            <Field id="tq-gstin" label="GSTIN">
              <input id="tq-gstin" className={`${fieldClass} uppercase`} maxLength={15} value={form.gstin} onChange={(e) => set('gstin', e.target.value.toUpperCase())} />
            </Field>
            <Field id="tq-valid" label="Valid days" required>
              <input id="tq-valid" type="number" min="1" className={fieldClass} value={form.valid_days} onChange={(e) => set('valid_days', e.target.value)} required />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field id="tq-freight" label="Freight">
                <input id="tq-freight" type="number" min="0" step="0.01" className={fieldClass} value={form.freight} onChange={(e) => set('freight', e.target.value)} />
              </Field>
              <Field id="tq-packing" label="Packing">
                <input id="tq-packing" type="number" min="0" step="0.01" className={fieldClass} value={form.packing} onChange={(e) => set('packing', e.target.value)} />
              </Field>
              <Field id="tq-cgst" label="Chg GST %">
                <input id="tq-cgst" type="number" min="0" step="0.01" className={fieldClass} value={form.charges_gst_rate} onChange={(e) => set('charges_gst_rate', e.target.value)} />
              </Field>
            </div>
          </div>

          <div>
            <p className={labelClass}>Line items</p>
            <LinesEditor
              lines={form.lines}
              onChange={(lines) => set('lines', lines)}
              columns={LINE_COLUMNS}
              emptyLine={EMPTY_LINE}
              qtyKey="qty"
            />
          </div>

          <Field id="tq-notes" label="Notes">
            <textarea id="tq-notes" rows={2} className={fieldClass} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </form>
      </Modal>

      <Modal
        open={Boolean(testTarget)}
        title="Send test quotation"
        onClose={() => setTestTarget(null)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setTestTarget(null)}>
              Cancel
            </button>
            <button type="submit" form="tq-test-form" className={btnPrimary} disabled={!testEmails.trim()}>
              Send test
            </button>
          </div>
        }
      >
        <form id="tq-test-form" onSubmit={handleSendTest}>
          <Field id="tq-test-emails" label="Recipients" required>
            <input id="tq-test-emails" className={fieldClass} placeholder="qa@example.com, ops@example.com" value={testEmails} onChange={(e) => setTestEmails(e.target.value)} />
          </Field>
          <p className="mt-1 text-xs text-stone-500">Comma separated.</p>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete quotation?"
        message={`${deleteTarget?.number || 'This quotation'} will be permanently removed.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export default TenantQuotesPage
