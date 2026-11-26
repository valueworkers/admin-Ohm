import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiCheckCircle, FiDownload, FiEdit2, FiPlus, FiTrash2, FiXCircle } from 'react-icons/fi'
import {
  MAPPING_STATUSES,
  PAYMENT_METHODS,
  createBillingPayment,
  deleteBillingPayment,
  fetchBillingInvoices,
  fetchBillingPayments,
  updateBillingPayment,
  verifyBillingPayment,
} from '../../api/tenantBilling'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import StatusBanner from '../../components/ui/StatusBanner'
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/PageState'
import {
  Field,
  RefSelect,
  XTenantBanner,
  money,
  shortDate,
  useBillingRefs,
} from '../../features/billing/TenantBillingShared'
import { useAccess } from '../../hooks/useAccess'
import { apiErrorMessage } from '../../utils/errors'
import { downloadExcelTable } from '../../utils/exportExcel'
import { resolveCatalogTenantSlug } from '../../utils/tenantHeader'
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  fieldClass,
  tableHeadClass,
  tableWrapClass,
} from '../../utils/ui'

const GATEWAYS = ['razorpay', 'manual', 'bank']

const EMPTY = {
  invoice: '',
  patient: '',
  amount: '',
  currency: 'INR',
  method: 'UPI',
  gateway: 'razorpay',
  mapping_status: '',
}

const TenantPaymentsPage = () => {
  const access = useAccess()
  const canWrite = access.canWrite
  const tenantSlug = resolveCatalogTenantSlug(access.tenant)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [filters, setFilters] = useState({ method: '', isVerified: '', mappingStatus: '' })
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('-paid_at')
  const [status, setStatus] = useState({ type: '', message: '' })

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [invoices, setInvoices] = useState([])

  const refs = useBillingRefs(tenantSlug, modalOpen)
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))
  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }))

  const load = useCallback(async () => {
    if (!tenantSlug) {
      setRows([])
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      const { results } = await fetchBillingPayments(tenantSlug, filters)
      setRows(results)
    } catch (err) {
      setRows([])
      setLoadError(apiErrorMessage(err, 'Could not load payments.'))
    } finally {
      setLoading(false)
    }
  }, [tenantSlug, filters])

  useEffect(() => {
    load()
  }, [load])

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = !q
      ? rows
      : rows.filter((row) => {
          const hay = [
            row.id,
            row.invoice,
            row.invoice_number,
            row.patient,
            row.patient_name,
            row.method,
            row.gateway,
            row.mapping_status,
            row.amount,
          ]
            .map((v) => String(v || '').toLowerCase())
            .join(' ')
          return hay.includes(q)
        })

    const cmpStr = (a, b) =>
      String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base' })
    const cmpNum = (a, b) => (Number(a) || 0) - (Number(b) || 0)
    const cmpDate = (a, b) => new Date(a || 0).getTime() - new Date(b || 0).getTime()
    const desc = sortBy.startsWith('-')
    const field = desc ? sortBy.slice(1) : sortBy
    const sorted = [...filtered]
    sorted.sort((a, b) => {
      let diff = 0
      if (field === 'amount') diff = cmpNum(a.amount, b.amount)
      else if (field === 'method') diff = cmpStr(a.method, b.method)
      else if (field === 'mapping_status') diff = cmpStr(a.mapping_status, b.mapping_status)
      else diff = cmpDate(a.paid_at || a.created_at, b.paid_at || b.created_at)
      return desc ? -diff : diff
    })
    return sorted
  }, [rows, search, sortBy])

  useEffect(() => {
    if (!modalOpen || !tenantSlug) return
    fetchBillingInvoices(tenantSlug, { pageSize: 100 })
      .then(({ results }) =>
        setInvoices(
          results.map((inv) => ({
            id: inv.id,
            name: `${inv.number}${inv.customer_name ? ` · ${inv.customer_name}` : ''}`,
            patient: inv.patient,
            balance: inv.balance_due,
          })),
        ),
      )
      .catch(() => setInvoices([]))
  }, [modalOpen, tenantSlug])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm(Object.fromEntries(Object.keys(EMPTY).map((k) => [k, row[k] ?? EMPTY[k]])))
    setModalOpen(true)
  }

  const pickInvoice = (id) => {
    const inv = invoices.find((i) => String(i.id) === String(id))
    setForm((f) => ({
      ...f,
      invoice: id,
      patient: f.patient || inv?.patient || '',
      amount: f.amount || (inv?.balance != null ? String(inv.balance) : ''),
    }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.invoice || !form.patient) {
      setStatus({ type: 'error', message: 'Invoice and patient are required.' })
      return
    }
    if (!(Number(form.amount) > 0)) {
      setStatus({ type: 'error', message: 'Enter a payment amount.' })
      return
    }
    setSaving(true)
    try {
      if (editing) await updateBillingPayment(tenantSlug, editing.id, form)
      else await createBillingPayment(tenantSlug, form)
      setStatus({ type: 'success', message: editing ? 'Payment updated.' : 'Payment recorded.' })
      setModalOpen(false)
      await load()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not save payment.') })
    } finally {
      setSaving(false)
    }
  }

  const toggleVerify = async (row) => {
    setBusyId(row.id)
    try {
      await verifyBillingPayment(tenantSlug, row.id, !row.is_verified)
      setStatus({ type: 'success', message: row.is_verified ? 'Payment unverified.' : 'Payment verified.' })
      await load()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not update verification.') })
    } finally {
      setBusyId('')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteBillingPayment(tenantSlug, deleteTarget.id)
      setStatus({ type: 'success', message: 'Payment deleted.' })
      await load()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not delete payment.') })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={access.tenant?.name || 'Operations'}
        title="Collections"
        description="Patient payments against invoices for this tenant."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnSecondary}
              disabled={!visibleRows.length}
              onClick={() => {
                try {
                  downloadExcelTable(
                    'tenant-collections',
                    [
                      'Invoice',
                      'Patient',
                      'Method',
                      'Gateway',
                      'Amount',
                      'Currency',
                      'Paid at',
                      'Verified',
                      'Mapping status',
                    ],
                    visibleRows.map((row) => [
                      row.invoice_number || row.invoice || '',
                      row.patient_name || row.patient || '',
                      row.method,
                      row.gateway,
                      row.amount ?? '',
                      row.currency || 'INR',
                      shortDate(row.paid_at),
                      row.is_verified ? 'Yes' : 'No',
                      row.mapping_status,
                    ]),
                  )
                  setStatus({
                    type: 'success',
                    message: `Exported ${visibleRows.length} payment${visibleRows.length === 1 ? '' : 's'} to Excel.`,
                  })
                } catch (err) {
                  setStatus({
                    type: 'error',
                    message: err?.message || 'Could not export collections.',
                  })
                }
              }}
            >
              <FiDownload className="h-4 w-4" aria-hidden />
              Export to Excel
            </button>
            {canWrite ? (
              <button type="button" className={btnPrimary} onClick={openCreate} disabled={!tenantSlug}>
                <FiPlus className="h-4 w-4" aria-hidden />
                Record payment
              </button>
            ) : null}
          </div>
        }
      />

      <XTenantBanner slug={tenantSlug} />
      <StatusBanner type={status.type} message={status.message} />

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <input
          className={`${fieldClass} sm:max-w-xs`}
          type="search"
          placeholder="Search invoice, patient, method…"
          aria-label="Search payments"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={`${fieldClass} sm:w-44`} aria-label="Filter by method" value={filters.method} onChange={(e) => setFilter('method', e.target.value)}>
          <option value="">All methods</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select className={`${fieldClass} sm:w-44`} aria-label="Filter by verification" value={filters.isVerified} onChange={(e) => setFilter('isVerified', e.target.value)}>
          <option value="">Any verification</option>
          <option value="true">Verified</option>
          <option value="false">Unverified</option>
        </select>
        <select className={`${fieldClass} sm:w-48`} aria-label="Filter by mapping status" value={filters.mappingStatus} onChange={(e) => setFilter('mappingStatus', e.target.value)}>
          <option value="">Any mapping</option>
          {MAPPING_STATUSES.map((m) => (
            <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          className={`${fieldClass} sm:w-48`}
          aria-label="Sort payments"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="-paid_at">Paid date (newest)</option>
          <option value="paid_at">Paid date (oldest)</option>
          <option value="-amount">Amount high → low</option>
          <option value="amount">Amount low → high</option>
          <option value="method">Method A–Z</option>
          <option value="-method">Method Z–A</option>
          <option value="mapping_status">Mapping A–Z</option>
          <option value="-mapping_status">Mapping Z–A</option>
        </select>
      </div>

      <div className={tableWrapClass}>
        {!tenantSlug ? (
          <EmptyState bare title="No tenant selected" hint="Collections load once a tenant is selected." />
        ) : loading ? (
          <LoadingState label="Loading payments…" />
        ) : loadError ? (
          <ErrorState bare message={loadError} onRetry={load} />
        ) : visibleRows.length === 0 ? (
          <EmptyState
            bare
            title={
              search || filters.method || filters.isVerified || filters.mappingStatus
                ? 'No matching payments'
                : 'No payments yet'
            }
            hint={
              search || filters.method || filters.isVerified || filters.mappingStatus
                ? 'Try another search or clear filters.'
                : canWrite
                  ? 'Record a payment against an invoice.'
                  : 'Nothing on file.'
            }
            actionLabel={
              !(search || filters.method || filters.isVerified || filters.mappingStatus) && canWrite
                ? 'Record payment'
                : undefined
            }
            onAction={
              !(search || filters.method || filters.isVerified || filters.mappingStatus) && canWrite
                ? openCreate
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-4 py-3">Paid on</th>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Gateway</th>
                  <th className="px-4 py-3">Mapping</th>
                  <th className="px-4 py-3">Verified</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  {canWrite ? <th className="px-4 py-3 text-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {visibleRows.map((row) => {
                  const busy = busyId === row.id
                  return (
                    <tr key={row.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3 text-stone-600">{shortDate(row.paid_at)}</td>
                      <td className="px-4 py-3 font-semibold text-stone-900">{row.invoice_number || row.invoice || '—'}</td>
                      <td className="px-4 py-3 text-stone-600">{row.patient_name || row.patient || '—'}</td>
                      <td className="px-4 py-3 text-stone-600">{row.method.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 text-stone-600">{row.gateway || '—'}</td>
                      <td className="px-4 py-3 text-stone-600">{row.mapping_status ? row.mapping_status.replace(/_/g, ' ') : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${row.is_verified ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                          {row.is_verified ? 'Verified' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{money(row.amount, row.currency)}</td>
                      {canWrite ? (
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button type="button" className={btnGhost} disabled={busy} onClick={() => toggleVerify(row)} aria-label={row.is_verified ? 'Unverify payment' : 'Verify payment'} title={row.is_verified ? 'Unverify' : 'Verify'}>
                              {row.is_verified ? <FiXCircle className="h-3.5 w-3.5" aria-hidden /> : <FiCheckCircle className="h-3.5 w-3.5" aria-hidden />}
                            </button>
                            <button type="button" className={btnGhost} disabled={busy} onClick={() => openEdit(row)} aria-label="Edit payment" title="Edit">
                              <FiEdit2 className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            <button type="button" className={`${btnGhost} text-rose-600 hover:bg-rose-50`} disabled={busy} onClick={() => setDeleteTarget(row)} aria-label="Delete payment" title="Delete">
                              <FiTrash2 className="h-3.5 w-3.5" aria-hidden />
                            </button>
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
        title={editing ? 'Edit payment' : 'Record payment'}
        onClose={() => setModalOpen(false)}
        wide
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="tenant-payment-form" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Record payment'}
            </button>
          </div>
        }
      >
        <form id="tenant-payment-form" className="grid gap-3 sm:grid-cols-2" onSubmit={handleSave}>
          {refs.error ? (
            <div className="sm:col-span-2">
              <StatusBanner type="warning" message={refs.error} />
            </div>
          ) : null}
          <Field id="tp-invoice" label="Invoice" required>
            <RefSelect id="tp-invoice" value={form.invoice} onChange={pickInvoice} rows={invoices} placeholder="Select invoice" required />
          </Field>
          <Field id="tp-patient" label="Patient" required>
            <RefSelect id="tp-patient" value={form.patient} onChange={(v) => set('patient', v)} rows={refs.patients} placeholder="Select patient" required />
          </Field>
          <Field id="tp-amount" label="Amount" required>
            <input id="tp-amount" type="number" min="0" step="0.01" className={fieldClass} value={form.amount} onChange={(e) => set('amount', e.target.value)} required />
          </Field>
          <Field id="tp-currency" label="Currency" required>
            <input id="tp-currency" className={`${fieldClass} uppercase`} maxLength={3} value={form.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())} required />
          </Field>
          <Field id="tp-method" label="Method" required>
            <select id="tp-method" className={fieldClass} value={form.method} onChange={(e) => set('method', e.target.value)}>
              {(PAYMENT_METHODS.includes(form.method) ? PAYMENT_METHODS : [form.method, ...PAYMENT_METHODS]).map((m) => (
                <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </Field>
          <Field id="tp-gateway" label="Gateway" required>
            <select id="tp-gateway" className={fieldClass} value={form.gateway} onChange={(e) => set('gateway', e.target.value)}>
              {(GATEWAYS.includes(form.gateway) || !form.gateway ? GATEWAYS : [form.gateway, ...GATEWAYS]).map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </Field>
          {editing ? (
            <Field id="tp-mapping" label="Mapping status">
              <select id="tp-mapping" className={fieldClass} value={form.mapping_status} onChange={(e) => set('mapping_status', e.target.value)}>
                <option value="">Unchanged</option>
                {MAPPING_STATUSES.map((m) => (
                  <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </Field>
          ) : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete payment?"
        message="This payment record will be permanently removed."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export default TenantPaymentsPage
