import { useMemo, useState } from 'react'
import { FiCalendar, FiDownload, FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import { EmptyState } from '../components/ui/PageState'
import { useAccess } from '../hooks/useAccess'
import { usePlatformCollection } from '../hooks/usePlatformCollection'
import { downloadExcelTable } from '../utils/exportExcel'
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  fieldClass,
  labelClass,
  tableHeadClass,
  tableWrapClass,
} from '../utils/ui'

const STATUSES = ['ACTIVE', 'PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED', 'COMPLETED']
const LOCATION_TYPES = ['IN_HOUSE', 'AT_HOME', 'CLINIC', 'HOSPITAL', 'OTHER']

const EMPTY = {
  order_id: '',
  patient_name: '',
  patient_id: '',
  phone: '',
  email: '',
  age: '',
  package_name: '',
  package_id: '',
  service_name: '',
  service_id: '',
  location_type: 'AT_HOME',
  locality: '',
  location: '',
  starting_date: '',
  ending_date: '',
  status: 'ACTIVE',
  auto_renew: false,
  emergency_contact_name: '',
  emergency_contact_phone: '',
}

const partyName = (row) =>
  row.patient_name || row.customer_name || row.tenant_name || '—'

const partyId = (row) => row.patient_id || row.customer_id || row.tenant_id || '—'

const statusChip = (status) => {
  const s = String(status || '').toUpperCase()
  if (s === 'ACTIVE' || s === 'CONFIRMED') return 'bg-emerald-50 text-emerald-800'
  if (s === 'PENDING') return 'bg-amber-50 text-amber-900'
  if (s === 'EXPIRED' || s === 'CANCELLED') return 'bg-rose-50 text-rose-800'
  if (s === 'COMPLETED') return 'bg-brand-50 text-brand-800'
  return 'bg-slate-100 text-slate-700'
}

const fmtDate = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const nextOrderId = () =>
  `ORD-${new Date().getFullYear()}${String(Date.now()).slice(-6)}`

const BookingsPage = ({ tenantId: tenantIdProp, canWrite: canWriteProp, eyebrow } = {}) => {
  const access = useAccess()
  const tenantId = tenantIdProp || access.tenantId
  const canWrite = canWriteProp ?? access.canWrite
  const { rows, save, remove } = usePlatformCollection('bookings', tenantId)
  const { rows: services } = usePlatformCollection('services', tenantId)
  const { rows: packages } = usePlatformCollection('packages', tenantId)
  const { rows: patients } = usePlatformCollection('patients', tenantId)

  const [status, setStatus] = useState({ type: '', message: '' })
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [statusFilter, setStatusFilter] = useState('ALL')

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const filtered = useMemo(() => {
    if (statusFilter === 'ALL') return rows
    return rows.filter((r) => String(r.status || '').toUpperCase() === statusFilter)
  }, [rows, statusFilter])

  const openCreate = () => {
    setEditing(null)
    setForm({
      ...EMPTY,
      order_id: nextOrderId(),
      starting_date: new Date().toISOString().slice(0, 10),
    })
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      order_id: row.order_id || row.id || '',
      patient_name: row.patient_name || row.customer_name || row.tenant_name || '',
      patient_id: row.patient_id || row.customer_id || row.tenant_id || '',
      phone: row.phone || row.phone_number || '',
      email: row.email || row.patient_email || '',
      age: row.age ?? '',
      package_name: row.package_name || '',
      package_id: row.package_id || '',
      service_name: row.service_name || '',
      service_id: row.service_id || '',
      location_type: row.location_type || 'AT_HOME',
      locality: row.locality || '',
      location: row.location || '',
      starting_date: (row.starting_date || row.scheduled_at || '').toString().slice(0, 10),
      ending_date: (row.ending_date || '').toString().slice(0, 10),
      status: String(row.status || 'ACTIVE').toUpperCase(),
      auto_renew: Boolean(row.auto_renew),
      emergency_contact_name: row.emergency_contact_name || '',
      emergency_contact_phone: row.emergency_contact_phone || '',
    })
    setModalOpen(true)
  }

  const applyPatient = (patientId) => {
    const p = patients.find((x) => String(x.id) === String(patientId))
    if (!p) {
      set('patient_id', patientId)
      return
    }
    setForm((f) => ({
      ...f,
      patient_id: p.patient_id || p.id,
      patient_name: p.full_name || p.name || '',
      phone: p.phone || '',
      email: p.email || '',
      age: p.age ?? '',
    }))
  }

  const applyPackage = (packageId) => {
    const pkg = packages.find((x) => String(x.id) === String(packageId))
    if (!pkg) {
      set('package_id', packageId)
      return
    }
    const svc = services.find((s) => String(s.id) === String(pkg.service_id))
    setForm((f) => ({
      ...f,
      package_id: pkg.id,
      package_name: pkg.name || '',
      service_id: pkg.service_id || svc?.id || '',
      service_name: pkg.service_name || svc?.name || '',
      location_type: pkg.service_type || f.location_type,
    }))
  }

  const applyService = (serviceId) => {
    const svc = services.find((x) => String(x.id) === String(serviceId))
    if (!svc) {
      set('service_id', serviceId)
      return
    }
    setForm((f) => ({
      ...f,
      service_id: svc.id,
      service_name: svc.name || '',
    }))
  }

  const handleSave = (e) => {
    e.preventDefault()
    if (!form.patient_name.trim()) {
      setStatus({ type: 'error', message: 'Patient / customer / tenant name is required.' })
      return
    }
    if (!form.starting_date) {
      setStatus({ type: 'error', message: 'Starting date is required.' })
      return
    }

    setSaving(true)
    try {
      save({
        id: editing?.id,
        tenantId,
        order_id: form.order_id.trim() || nextOrderId(),
        patient_name: form.patient_name.trim(),
        patient_id: form.patient_id.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        age: form.age === '' ? '' : Number(form.age),
        package_name: form.package_name.trim(),
        package_id: form.package_id,
        service_name: form.service_name.trim(),
        service_id: form.service_id,
        location_type: form.location_type,
        locality: form.locality.trim(),
        location: form.location.trim(),
        starting_date: form.starting_date,
        ending_date: form.ending_date,
        scheduled_at: form.starting_date
          ? new Date(`${form.starting_date}T09:00:00`).toISOString()
          : null,
        status: form.status,
        auto_renew: Boolean(form.auto_renew),
        emergency_contact_name: form.emergency_contact_name.trim(),
        emergency_contact_phone: form.emergency_contact_phone.trim(),
        amount: editing?.amount ?? 0,
      })
      setStatus({
        type: 'success',
        message: editing ? 'Booking updated.' : 'Booking created.',
      })
      setModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={eyebrow || 'Organization'}
        title="Bookings"
        description="Orders and care subscriptions — patient, package, location, dates, and renewals."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={`${fieldClass} w-auto min-w-[140px]`}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="ALL">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={btnSecondary}
              disabled={!filtered.length}
              onClick={() => {
                try {
                  downloadExcelTable(
                    'bookings',
                    [
                      'Order ID',
                      'Patient / tenant name',
                      'Patient / tenant ID',
                      'Phone number',
                      'Age',
                      'Package name',
                      'Service name',
                      'Location type',
                      'Locality',
                      'Location',
                      'Starting date',
                      'Ending date',
                      'Status',
                      'Auto renew',
                      'Emergency contact',
                      'Emergency phone',
                    ],
                    filtered.map((row) => [
                      row.order_id || row.id,
                      partyName(row) === '—' ? '' : partyName(row),
                      partyId(row) === '—' ? '' : partyId(row),
                      row.phone || row.phone_number || '',
                      row.age ?? '',
                      row.package_name || '',
                      row.service_name || '',
                      (row.location_type || '').toString().replace(/_/g, ' '),
                      row.locality || '',
                      row.location || '',
                      row.starting_date || row.scheduled_at || '',
                      row.ending_date || '',
                      row.status || '',
                      row.auto_renew ? 'Yes' : 'No',
                      row.emergency_contact_name || '',
                      row.emergency_contact_phone || '',
                    ]),
                  )
                  setStatus({
                    type: 'success',
                    message: `Exported ${filtered.length} booking${filtered.length === 1 ? '' : 's'} to Excel.`,
                  })
                } catch (err) {
                  setStatus({
                    type: 'error',
                    message: err?.message || 'Could not export bookings.',
                  })
                }
              }}
            >
              <FiDownload className="h-4 w-4" aria-hidden />
              Export to Excel
            </button>
            {canWrite ? (
              <button type="button" className={btnPrimary} onClick={openCreate}>
                <FiPlus className="h-4 w-4" aria-hidden />
                Add booking
              </button>
            ) : (
              <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                Read only
              </span>
            )}
          </div>
        }
      />

      <StatusBanner type={status.type} message={status.message} />

      <div className={tableWrapClass}>
        <div className="overflow-x-auto">
          <table className="min-w-[1600px] w-full text-left text-sm">
            <thead className={tableHeadClass}>
              <tr>
                <th className="px-3 py-3 font-semibold">Order ID</th>
                <th className="px-3 py-3 font-semibold">Patient / tenant name</th>
                <th className="px-3 py-3 font-semibold">Patient / tenant ID</th>
                <th className="px-3 py-3 font-semibold">Phone number</th>
                <th className="px-3 py-3 font-semibold">Age</th>
                <th className="px-3 py-3 font-semibold">Package name</th>
                <th className="px-3 py-3 font-semibold">Service name</th>
                <th className="px-3 py-3 font-semibold">Location type</th>
                <th className="px-3 py-3 font-semibold">Locality</th>
                <th className="px-3 py-3 font-semibold">Location</th>
                <th className="px-3 py-3 font-semibold">
                  <span className="inline-flex items-center gap-1">
                    <FiCalendar className="h-3.5 w-3.5" aria-hidden />
                    Starting date
                  </span>
                </th>
                <th className="px-3 py-3 font-semibold">
                  <span className="inline-flex items-center gap-1">
                    <FiCalendar className="h-3.5 w-3.5" aria-hidden />
                    Ending date
                  </span>
                </th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Auto renew</th>
                <th className="px-3 py-3 font-semibold">Emergency contact</th>
                {canWrite ? <th className="px-3 py-3 text-right font-semibold">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={canWrite ? 16 : 15} className="px-3 py-10">
                    <EmptyState
                      bare
                      title="No bookings"
                      hint={
                        canWrite
                          ? 'Create a booking for a patient and package.'
                          : 'Nothing on file.'
                      }
                      actionLabel={canWrite ? 'Add booking' : undefined}
                      onAction={canWrite ? openCreate : undefined}
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-3 font-medium tabular-nums text-slate-900">
                      {row.order_id || row.id}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-900">
                      {partyName(row)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600">{partyId(row)}</td>
                    <td className="whitespace-nowrap px-3 py-3 tabular-nums text-slate-600">
                      {row.phone || row.phone_number || '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 tabular-nums text-slate-600">
                      {row.age != null && row.age !== '' ? row.age : '—'}
                    </td>
                    <td className="max-w-[160px] px-3 py-3 text-slate-700">
                      <span className="line-clamp-2">{row.package_name || '—'}</span>
                    </td>
                    <td className="max-w-[160px] px-3 py-3 text-slate-700">
                      <span className="line-clamp-2">{row.service_name || '—'}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                      {(row.location_type || '—').toString().replace(/_/g, ' ')}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                      {row.locality || '—'}
                    </td>
                    <td className="max-w-[160px] px-3 py-3 text-slate-600">
                      <span className="line-clamp-2">{row.location || '—'}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                      {fmtDate(row.starting_date || row.scheduled_at)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                      {fmtDate(row.ending_date)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${statusChip(row.status)}`}
                      >
                        {row.status || '—'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                      {row.auto_renew ? 'Yes' : 'No'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                      {row.emergency_contact_name || row.emergency_contact_phone ? (
                        <div>
                          <div className="font-medium text-slate-900">
                            {row.emergency_contact_name || '—'}
                          </div>
                          <div className="text-xs tabular-nums text-slate-500">
                            {row.emergency_contact_phone || '—'}
                          </div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    {canWrite ? (
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            className={btnGhost}
                            onClick={() => openEdit(row)}
                            aria-label={`Edit ${row.order_id || row.id}`}
                          >
                            <FiEdit2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            className={`${btnGhost} text-rose-600 hover:bg-rose-50`}
                            onClick={() => setDeleteTarget(row)}
                            aria-label={`Delete ${row.order_id || row.id}`}
                          >
                            <FiTrash2 className="h-3.5 w-3.5" aria-hidden />
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
        <p className="border-t border-stone-100 px-3 py-2 text-xs text-stone-500">
          Scroll horizontally to see all columns.
        </p>
      </div>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit booking' : 'Add booking'}
        onClose={() => setModalOpen(false)}
        xl
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="booking-form" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add booking'}
            </button>
          </div>
        }
      >
        <form id="booking-form" className="space-y-3" onSubmit={handleSave}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="bk-order">
                Order ID
              </label>
              <input
                id="bk-order"
                className={fieldClass}
                value={form.order_id}
                onChange={(e) => set('order_id', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="bk-patient-pick">
                Link patient (optional)
              </label>
              <select
                id="bk-patient-pick"
                className={fieldClass}
                value={form.patient_id}
                onChange={(e) => applyPatient(e.target.value)}
              >
                <option value="">Select patient</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.name || p.patient_id || p.id} ({p.patient_id || p.id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="bk-pname">
                Patient / customer / tenant <span className="text-rose-600">*</span>
              </label>
              <input
                id="bk-pname"
                className={fieldClass}
                value={form.patient_name}
                onChange={(e) => set('patient_name', e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="bk-pid">
                Patient / customer / tenant ID
              </label>
              <input
                id="bk-pid"
                className={fieldClass}
                value={form.patient_id}
                onChange={(e) => set('patient_id', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="bk-phone">
                Phone number
              </label>
              <input
                id="bk-phone"
                className={fieldClass}
                type="tel"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="bk-email">
                Email
              </label>
              <input
                id="bk-email"
                className={fieldClass}
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="bk-age">
                Age
              </label>
              <input
                id="bk-age"
                type="number"
                min="0"
                className={fieldClass}
                value={form.age}
                onChange={(e) => set('age', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="bk-pkg">
                Package
              </label>
              <select
                id="bk-pkg"
                className={fieldClass}
                value={form.package_id}
                onChange={(e) => applyPackage(e.target.value)}
              >
                <option value="">Select package</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="bk-svc">
                Service
              </label>
              <select
                id="bk-svc"
                className={fieldClass}
                value={form.service_id}
                onChange={(e) => applyService(e.target.value)}
              >
                <option value="">Select service</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="bk-loctype">
                Location type
              </label>
              <select
                id="bk-loctype"
                className={fieldClass}
                value={form.location_type}
                onChange={(e) => set('location_type', e.target.value)}
              >
                {LOCATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="bk-locality">
                Locality
              </label>
              <input
                id="bk-locality"
                className={fieldClass}
                placeholder="# subramanyanagar"
                value={form.locality}
                onChange={(e) => set('locality', e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="bk-location">
                Location
              </label>
              <input
                id="bk-location"
                className={fieldClass}
                placeholder="Full address / landmark"
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="bk-start">
                Starting date <span className="text-rose-600">*</span>
              </label>
              <input
                id="bk-start"
                type="date"
                className={fieldClass}
                value={form.starting_date}
                onChange={(e) => set('starting_date', e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="bk-end">
                Ending date
              </label>
              <input
                id="bk-end"
                type="date"
                className={fieldClass}
                value={form.ending_date}
                onChange={(e) => set('ending_date', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="bk-status">
                Status
              </label>
              <select
                id="bk-status"
                className={fieldClass}
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  checked={form.auto_renew}
                  onChange={(e) => set('auto_renew', e.target.checked)}
                />
                Auto-renew
              </label>
            </div>
            <div>
              <label className={labelClass} htmlFor="bk-ec-name">
                Emergency contact name
              </label>
              <input
                id="bk-ec-name"
                className={fieldClass}
                value={form.emergency_contact_name}
                onChange={(e) => set('emergency_contact_name', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="bk-ec-phone">
                Emergency contact phone
              </label>
              <input
                id="bk-ec-phone"
                className={fieldClass}
                value={form.emergency_contact_phone}
                onChange={(e) => set('emergency_contact_phone', e.target.value)}
              />
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete booking?"
        message="This removes the booking from demo data for this tenant."
        confirmLabel="Delete"
        onConfirm={() => {
          remove(deleteTarget.id)
          setStatus({ type: 'success', message: 'Booking removed.' })
          setDeleteTarget(null)
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export default BookingsPage
