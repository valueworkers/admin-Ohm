import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiEdit2, FiFileText, FiPlus, FiTrash2 } from 'react-icons/fi'
import {
  convertPlatformBookingToInvoice,
  createPlatformBooking,
  deletePlatformBooking,
  fetchPlatformBookings,
  updatePlatformBooking,
} from '../api/platformBookings'
import { fetchTenants } from '../api/tenants'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import TenantOpsPlaceholder from '../components/TenantOpsPlaceholder'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/PageState'
import { useAccess } from '../hooks/useAccess'
import { apiErrorMessage } from '../utils/errors'
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  fieldClass,
  labelClass,
  tableHeadClass,
  tableWrapClass,
} from '../utils/ui'

const BOOKING_TYPES = [
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'consultation', label: 'Consultation' },
  { value: 'training', label: 'Training' },
  { value: 'support', label: 'Support' },
  { value: 'other', label: 'Other' },
]

const BOOKING_STATUSES = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const emptyForm = () => ({
  tenant: '',
  title: '',
  bookingType: 'onboarding',
  status: 'confirmed',
  startDatetime: '',
  endDatetime: '',
  location: 'Virtual / Online',
  totalAmount: '',
  notes: '',
})

const statusChip = (status) => {
  const s = String(status || '').toLowerCase()
  if (s === 'confirmed' || s === 'completed') return 'bg-emerald-50 text-emerald-800'
  if (s === 'in_progress' || s === 'pending') return 'bg-amber-50 text-amber-900'
  if (s === 'cancelled') return 'bg-rose-50 text-rose-800'
  return 'bg-stone-100 text-stone-700'
}

const fmtDateTime = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const fmtMoney = (n) => {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  })
}

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

const PlatformBookingsPage = () => {
  const { isSuperAdmin, canWrite } = useAccess()
  const [rows, setRows] = useState([])
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [banner, setBanner] = useState({ type: '', message: '' })
  const [tenantFilter, setTenantFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [busyId, setBusyId] = useState('')

  const tenantNameById = useMemo(() => {
    return Object.fromEntries(tenants.map((t) => [String(t.id), t.name || t.id]))
  }, [tenants])

  const loadTenants = useCallback(async () => {
    if (!isSuperAdmin) return
    try {
      setTenants(await fetchTenants())
    } catch {
      setTenants([])
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
      const { results } = await fetchPlatformBookings({
        tenant: tenantFilter || undefined,
        status: statusFilter || undefined,
        page: 1,
        pageSize: 100,
      })
      setRows(results)
    } catch (err) {
      setRows([])
      setError(apiErrorMessage(err, 'Could not load platform bookings.'))
    } finally {
      setLoading(false)
    }
  }, [isSuperAdmin, tenantFilter, statusFilter])

  useEffect(() => {
    loadTenants()
  }, [loadTenants])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!banner.message) return undefined
    const t = window.setTimeout(() => setBanner({ type: '', message: '' }), 4000)
    return () => window.clearTimeout(t)
  }, [banner])

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      tenant: row.tenantId || '',
      title: row.title || '',
      bookingType: row.bookingType || 'onboarding',
      status: row.status || 'confirmed',
      startDatetime: toLocalInput(row.startDatetime),
      endDatetime: toLocalInput(row.endDatetime),
      location: row.location || 'Virtual / Online',
      totalAmount: row.totalAmount != null ? String(row.totalAmount) : '',
      notes: row.notes || '',
    })
    setFormError('')
    setModalOpen(true)
  }

  const closeModal = () => {
    if (saving) return
    setModalOpen(false)
    setEditing(null)
    setFormError('')
  }

  const validateForm = () => {
    if (!form.tenant) return 'Select a tenant.'
    if (!String(form.title || '').trim()) return 'Title is required.'
    if (!form.bookingType) return 'Booking type is required.'
    if (!form.status) return 'Status is required.'
    if (!form.startDatetime) return 'Start date/time is required.'
    if (!form.endDatetime) return 'End date/time is required.'
    if (!String(form.location || '').trim()) return 'Location is required.'
    if (form.totalAmount === '' || Number.isNaN(Number(form.totalAmount))) {
      return 'Enter a valid total amount.'
    }
    return ''
  }

  const bookingPayload = () => ({
    tenant: form.tenant,
    title: form.title,
    bookingType: form.bookingType,
    status: form.status,
    startDatetime: fromLocalInput(form.startDatetime),
    endDatetime: fromLocalInput(form.endDatetime),
    location: form.location,
    totalAmount: Number(form.totalAmount).toFixed(2),
    notes: form.notes,
  })

  const handleSubmit = async (event) => {
    event.preventDefault()
    const message = validateForm()
    if (message) {
      setFormError(message)
      return
    }

    setSaving(true)
    setFormError('')
    try {
      const payload = bookingPayload()
      if (editing) {
        await updatePlatformBooking(editing.id, payload)
        setBanner({ type: 'success', message: 'Booking updated.' })
      } else {
        await createPlatformBooking(payload)
        setBanner({ type: 'success', message: 'Booking created.' })
      }
      setModalOpen(false)
      setEditing(null)
      await load()
    } catch (err) {
      setFormError(
        apiErrorMessage(err, editing ? 'Could not update booking.' : 'Could not create booking.'),
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget?.id) return
    setSaving(true)
    try {
      await deletePlatformBooking(deleteTarget.id)
      setBanner({ type: 'success', message: 'Booking deleted.' })
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setBanner({
        type: 'error',
        message: apiErrorMessage(err, 'Could not delete booking.'),
      })
    } finally {
      setSaving(false)
    }
  }

  const handleConvert = async (row) => {
    setBusyId(row.id)
    try {
      await convertPlatformBookingToInvoice(row.id)
      setBanner({ type: 'success', message: `Invoice created from “${row.title || row.id}”.` })
      await load()
    } catch (err) {
      setBanner({
        type: 'error',
        message: apiErrorMessage(err, 'Could not convert booking to invoice.'),
      })
    } finally {
      setBusyId('')
    }
  }

  if (!isSuperAdmin) {
    return (
      <TenantOpsPlaceholder
        title="Bookings"
        description="Platform bookings for Super Admin operations appear here."
      />
    )
  }

  const colCount = canWrite !== false ? 9 : 8

  return (
    <div className="sc-page-enter space-y-4">
      <PageHeader
        eyebrow="Operations"
        title="Bookings"
        description="Platform bookings with tenants (onboarding, consultation, training)."
        actions={
          canWrite !== false ? (
            <button type="button" className={btnPrimary} onClick={openCreate}>
              <FiPlus className="h-4 w-4" aria-hidden />
              Add booking
            </button>
          ) : null
        }
      />

      <StatusBanner type={banner.type} message={banner.message} />

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
        <label className="block sm:w-44">
          <span className={labelClass}>Status</span>
          <select
            className={fieldClass}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {BOOKING_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={tableWrapClass}>
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full text-left text-sm">
            <thead className={tableHeadClass}>
              <tr>
                <th className="px-4 py-3 font-semibold">Booking ID</th>
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Tenant</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Schedule</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Amount</th>
                {canWrite !== false ? (
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-10">
                    <LoadingState label="Loading bookings…" />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-10">
                    <ErrorState bare message={error} onRetry={load} />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-10">
                    <EmptyState
                      bare
                      title="No platform bookings"
                      hint="Create a booking for a tenant (onboarding, consultation, training)."
                      actionLabel={canWrite !== false ? 'Add booking' : undefined}
                      onAction={canWrite !== false ? openCreate : undefined}
                    />
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className="font-medium text-stone-900">
                        {row.bookingCode || `ID ${row.id}`}
                      </p>
                      <p className="text-xs text-stone-400">#{row.id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-stone-900">{row.title || '—'}</p>
                      {row.createdAt ? (
                        <p className="mt-0.5 text-xs text-stone-400">
                          Created {fmtDateTime(row.createdAt)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-stone-700">
                      {row.tenantName || tenantNameById[row.tenantId] || row.tenantId || '—'}
                    </td>
                    <td className="px-4 py-3 text-stone-700">
                      {row.planName || (row.planId ? `Plan ${row.planId}` : '—')}
                    </td>
                    <td className="px-4 py-3 capitalize text-stone-700">
                      {row.bookingType?.replace(/_/g, ' ') || '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-stone-600">
                      <p>{fmtDateTime(row.startDatetime)}</p>
                      <p className="text-xs text-stone-400">→ {fmtDateTime(row.endDatetime)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${statusChip(
                          row.status,
                        )}`}
                      >
                        {String(row.status || '—').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-stone-900">
                      {fmtMoney(row.totalAmount)}
                    </td>
                    {canWrite !== false ? (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            className={btnGhost}
                            onClick={() => openEdit(row)}
                            aria-label={`Edit ${row.title || row.id}`}
                          >
                            <FiEdit2 className="h-3.5 w-3.5" aria-hidden />
                            Edit
                          </button>
                          <button
                            type="button"
                            className={btnGhost}
                            disabled={Boolean(busyId) || Boolean(row.invoiceId)}
                            onClick={() => handleConvert(row)}
                            aria-label={`Convert ${row.title || row.id} to invoice`}
                            title={row.invoiceId ? 'Already converted' : 'Convert to invoice'}
                          >
                            <FiFileText className="h-3.5 w-3.5" aria-hidden />
                            {busyId === row.id ? '…' : 'Invoice'}
                          </button>
                          <button
                            type="button"
                            className={btnGhost}
                            onClick={() => setDeleteTarget(row)}
                            aria-label={`Delete ${row.title || row.id}`}
                          >
                            <FiTrash2 className="h-3.5 w-3.5" aria-hidden />
                            Delete
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Update booking' : 'Add booking'}
        wide
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          {formError ? (
            <p
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
              role="alert"
            >
              {formError}
            </p>
          ) : null}

          {editing ? (
            <p className="text-xs text-stone-500">
              {editing.bookingCode || `Booking #${editing.id}`}
              {editing.planName ? ` · Plan: ${editing.planName}` : ''}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={labelClass}>
                Tenant <span className="text-rose-600">*</span>
              </span>
              <select
                className={fieldClass}
                value={form.tenant}
                onChange={(e) => setField('tenant', e.target.value)}
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
                Title <span className="text-rose-600">*</span>
              </span>
              <input
                className={fieldClass}
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                disabled={saving}
                placeholder="Tenant Onboarding & System Setup"
                required
              />
            </label>

            <label className="block">
              <span className={labelClass}>
                Booking type <span className="text-rose-600">*</span>
              </span>
              <select
                className={fieldClass}
                value={form.bookingType}
                onChange={(e) => setField('bookingType', e.target.value)}
                disabled={saving}
                required
              >
                {BOOKING_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
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
                {BOOKING_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>
                Start <span className="text-rose-600">*</span>
              </span>
              <input
                className={fieldClass}
                type="datetime-local"
                value={form.startDatetime}
                onChange={(e) => setField('startDatetime', e.target.value)}
                disabled={saving}
                required
              />
            </label>

            <label className="block">
              <span className={labelClass}>
                End <span className="text-rose-600">*</span>
              </span>
              <input
                className={fieldClass}
                type="datetime-local"
                value={form.endDatetime}
                onChange={(e) => setField('endDatetime', e.target.value)}
                disabled={saving}
                required
              />
            </label>

            <label className="block">
              <span className={labelClass}>
                Location <span className="text-rose-600">*</span>
              </span>
              <input
                className={fieldClass}
                value={form.location}
                onChange={(e) => setField('location', e.target.value)}
                disabled={saving}
                required
              />
            </label>

            <label className="block">
              <span className={labelClass}>
                Total amount (₹) <span className="text-rose-600">*</span>
              </span>
              <input
                className={fieldClass}
                type="number"
                min="0"
                step="0.01"
                value={form.totalAmount}
                onChange={(e) => setField('totalAmount', e.target.value)}
                disabled={saving}
                required
              />
            </label>

            <label className="block sm:col-span-2">
              <span className={labelClass}>Notes</span>
              <textarea
                className={`${fieldClass} min-h-[80px] resize-y`}
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                disabled={saving}
                placeholder="Initial platform orientation and domain setup…"
              />
            </label>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-stone-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" className={btnSecondary} onClick={closeModal} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create booking'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete booking?"
        message={
          deleteTarget
            ? `Delete “${deleteTarget.title || deleteTarget.bookingCode || deleteTarget.id}”? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        loading={saving}
        onClose={() => !saving && setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}

export default PlatformBookingsPage
