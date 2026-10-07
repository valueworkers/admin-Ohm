import { useMemo, useState } from 'react'
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import { EmptyState } from '../components/ui/PageState'
import { useAccess } from '../hooks/useAccess'
import { usePlatformCollection } from '../hooks/usePlatformCollection'
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  fieldClass,
  labelClass,
  tableHeadClass,
  tableWrapClass,
} from '../utils/ui'

const GENDERS = ['female', 'male', 'other', 'prefer_not_to_say']
const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const LOCATION_TYPES = ['CLIENT_SIDE', 'IN_HOUSE', 'AT_HOME', 'CLINIC', 'HOSPITAL', 'OTHER']

const EMPTY = {
  patient_id: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  address: '',
  age: '',
  emergency_contact: '',
  emergency_phone: '',
  emergency_contact_2: '',
  emergency_phone_2: '',
  medical_conditions: '',
  allergies: '',
  present_health_condition: '',
  gender: 'female',
  blood_group: '',
  preferred_language: '',
  education_qualifications: '',
  earlier_occupation: '',
  year_of_retirement: '',
  location_type: 'CLIENT_SIDE',
  onboading_date: '',
  booking_locality: '',
  emr_count: 0,
  affiliate: '',
  source: '',
  referred_by: '',
  is_probono: false,
  is_registration_fees_paid: false,
  is_active: true,
  name_registered_by: '',
}

const displayName = (row) =>
  row.full_name ||
  [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
  row.name ||
  '—'

const nextPatientCode = (rows) => {
  const nums = rows
    .map((r) => Number(String(r.patient_id || '').replace(/\D/g, '')))
    .filter((n) => !Number.isNaN(n))
  const next = (nums.length ? Math.max(...nums) : 100) + 1
  return String(next).padStart(5, '0')
}

const fmtDate = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const PatientsPage = ({ tenantId: tenantIdProp, canWrite: canWriteProp, eyebrow } = {}) => {
  const access = useAccess()
  const tenantId = tenantIdProp || access.tenantId
  const canWrite = canWriteProp ?? access.canWrite
  const { rows, save, remove } = usePlatformCollection('patients', tenantId)

  const [status, setStatus] = useState({ type: '', message: '' })
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [activeFilter, setActiveFilter] = useState('ALL')

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const filtered = useMemo(() => {
    if (activeFilter === 'ACTIVE') return rows.filter((r) => r.is_active !== false && !r.is_deleted)
    if (activeFilter === 'INACTIVE') return rows.filter((r) => r.is_active === false || r.is_deleted)
    return rows.filter((r) => !r.is_deleted)
  }, [rows, activeFilter])

  const openCreate = () => {
    setEditing(null)
    setForm({
      ...EMPTY,
      patient_id: nextPatientCode(rows),
      onboading_date: new Date().toISOString().slice(0, 10),
      name_registered_by: access.user
        ? [access.user.first_name, access.user.last_name].filter(Boolean).join(' ') ||
          access.user.email ||
          ''
        : '',
    })
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    const first =
      row.first_name ||
      (row.full_name || row.name || '').split(' ').slice(0, -1).join(' ') ||
      row.name ||
      ''
    const last =
      row.last_name ||
      (row.full_name || row.name || '').split(' ').slice(-1).join(' ') ||
      ''
    setForm({
      patient_id: row.patient_id || '',
      first_name: first,
      last_name: last,
      email: row.email || '',
      phone: row.phone || '',
      address: row.address || '',
      age: row.age ?? '',
      emergency_contact: row.emergency_contact || '',
      emergency_phone: row.emergency_phone || '',
      emergency_contact_2: row.emergency_contact_2 || '',
      emergency_phone_2: row.emergency_phone_2 || '',
      medical_conditions: row.medical_conditions || row.condition || '',
      allergies: row.allergies || '',
      present_health_condition: row.present_health_condition || '',
      gender: row.gender || 'female',
      blood_group: row.blood_group || '',
      preferred_language: row.preferred_language || '',
      education_qualifications: row.education_qualifications || '',
      earlier_occupation: row.earlier_occupation || '',
      year_of_retirement: row.year_of_retirement ?? '',
      location_type: row.location_type || 'CLIENT_SIDE',
      onboading_date: (row.onboading_date || row.onboarding_date || '').toString().slice(0, 10),
      booking_locality: row.booking_locality || row.city || '',
      emr_count: row.emr_count ?? 0,
      affiliate: row.affiliate || '',
      source: row.source || '',
      referred_by: row.referred_by || '',
      is_probono: Boolean(row.is_probono),
      is_registration_fees_paid: Boolean(row.is_registration_fees_paid),
      is_active: row.is_active !== false && row.status !== 'inactive',
      name_registered_by: row.name_registered_by || '',
    })
    setModalOpen(true)
  }

  const handleSave = (e) => {
    e.preventDefault()
    if (!form.first_name.trim() && !form.last_name.trim()) {
      setStatus({ type: 'error', message: 'First name or last name is required.' })
      return
    }
    if (!form.phone.trim()) {
      setStatus({ type: 'error', message: 'Phone is required.' })
      return
    }

    const full_name = [form.first_name, form.last_name].filter(Boolean).join(' ').trim()
    setSaving(true)
    try {
      save({
        id: editing?.id,
        tenantId,
        patient_id: form.patient_id.trim() || nextPatientCode(rows),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        full_name,
        name: full_name, // legacy alias for bookings picker
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        age: form.age === '' ? null : Number(form.age),
        emergency_contact: form.emergency_contact.trim(),
        emergency_phone: form.emergency_phone.trim(),
        emergency_contact_2: form.emergency_contact_2.trim() || null,
        emergency_phone_2: form.emergency_phone_2.trim() || null,
        medical_conditions: form.medical_conditions.trim(),
        allergies: form.allergies.trim(),
        present_health_condition: form.present_health_condition.trim(),
        gender: form.gender,
        blood_group: form.blood_group,
        preferred_language: form.preferred_language.trim(),
        education_qualifications: form.education_qualifications.trim(),
        earlier_occupation: form.earlier_occupation.trim(),
        year_of_retirement:
          form.year_of_retirement === '' ? null : Number(form.year_of_retirement),
        location_type: form.location_type,
        onboading_date: form.onboading_date
          ? new Date(`${form.onboading_date}T00:00:00`).toISOString()
          : null,
        booking_locality: form.booking_locality.trim(),
        emr_count: Number(form.emr_count) || 0,
        affiliate: form.affiliate.trim() || null,
        source: form.source.trim() || null,
        referred_by: form.referred_by.trim() || null,
        is_probono: Boolean(form.is_probono),
        is_registration_fees_paid: Boolean(form.is_registration_fees_paid),
        is_deleted: false,
        is_active: Boolean(form.is_active),
        status: form.is_active ? 'active' : 'inactive',
        registered_by: editing?.registered_by ?? access.user?.id ?? null,
        name_registered_by: form.name_registered_by.trim(),
        updated_at: new Date().toISOString(),
        city: form.booking_locality.trim(),
        condition: form.medical_conditions.trim() || form.present_health_condition.trim(),
      })
      setStatus({
        type: 'success',
        message: editing ? 'Patient updated.' : 'Patient created.',
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
        title="Patients"
        description="Patient profiles with demographics, emergency contacts, medical notes, and onboarding flags."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={`${fieldClass} w-auto min-w-[140px]`}
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              aria-label="Filter patients"
            >
              <option value="ALL">All</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            {canWrite ? (
              <button type="button" className={btnPrimary} onClick={openCreate}>
                <FiPlus className="h-4 w-4" aria-hidden />
                Add patient
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
        {filtered.length === 0 ? (
          <EmptyState
            bare
            title="No patients"
            hint={canWrite ? 'Add a patient profile to get started.' : 'Nothing on file.'}
            actionLabel={canWrite ? 'Add patient' : undefined}
            onAction={canWrite ? openCreate : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-3 py-3">Patient ID</th>
                  <th className="px-3 py-3">Full name</th>
                  <th className="px-3 py-3">Phone</th>
                  <th className="px-3 py-3">Age</th>
                  <th className="px-3 py-3">Gender</th>
                  <th className="px-3 py-3">Location type</th>
                  <th className="px-3 py-3">Locality</th>
                  <th className="px-3 py-3">Emergency contact</th>
                  <th className="px-3 py-3">Onboarding</th>
                  <th className="px-3 py-3">EMR</th>
                  <th className="px-3 py-3">Flags</th>
                  <th className="px-3 py-3">Active</th>
                  {canWrite ? <th className="px-3 py-3 text-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3 font-medium text-slate-900 whitespace-nowrap">
                      {row.patient_id || row.id}
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-900 whitespace-nowrap">
                      {displayName(row)}
                    </td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{row.phone || '—'}</td>
                    <td className="px-3 py-3 text-slate-600">{row.age ?? '—'}</td>
                    <td className="px-3 py-3 text-slate-600 capitalize">{row.gender || '—'}</td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                      {(row.location_type || '—').toString().replace(/_/g, ' ')}
                    </td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                      {row.booking_locality || row.city || '—'}
                    </td>
                    <td className="px-3 py-3 text-slate-700 whitespace-nowrap">
                      {row.emergency_contact || row.emergency_phone ? (
                        <div>
                          <div className="font-medium text-slate-900">
                            {row.emergency_contact || '—'}
                          </div>
                          <div className="text-xs text-slate-500">{row.emergency_phone || '—'}</div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                      {fmtDate(row.onboading_date || row.onboarding_date)}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{row.emr_count ?? 0}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {row.is_probono ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                            Pro bono
                          </span>
                        ) : null}
                        {row.is_registration_fees_paid ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                            Reg paid
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            Reg unpaid
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          row.is_active !== false
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {row.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canWrite ? (
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            className={btnGhost}
                            onClick={() => openEdit(row)}
                            aria-label={`Edit ${displayName(row)}`}
                          >
                            <FiEdit2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            className={`${btnGhost} text-rose-600 hover:bg-rose-50`}
                            onClick={() => setDeleteTarget(row)}
                            aria-label={`Delete ${displayName(row)}`}
                          >
                            <FiTrash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit patient' : 'Add patient'}
        onClose={() => setModalOpen(false)}
        xl
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="patient-form" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add patient'}
            </button>
          </div>
        }
      >
        <form id="patient-form" className="space-y-4" onSubmit={handleSave}>
          <section className="space-y-3 rounded-xl border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-900">Identity</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="pt-code">
                  Patient ID
                </label>
                <input
                  id="pt-code"
                  className={fieldClass}
                  value={form.patient_id}
                  onChange={(e) => set('patient_id', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pt-gender">
                  Gender
                </label>
                <select
                  id="pt-gender"
                  className={fieldClass}
                  value={form.gender}
                  onChange={(e) => set('gender', e.target.value)}
                >
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {g.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="pt-fn">
                  First name <span className="text-rose-600">*</span>
                </label>
                <input
                  id="pt-fn"
                  className={fieldClass}
                  value={form.first_name}
                  onChange={(e) => set('first_name', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pt-ln">
                  Last name
                </label>
                <input
                  id="pt-ln"
                  className={fieldClass}
                  value={form.last_name}
                  onChange={(e) => set('last_name', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pt-phone">
                  Phone <span className="text-rose-600">*</span>
                </label>
                <input
                  id="pt-phone"
                  className={fieldClass}
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pt-email">
                  Email
                </label>
                <input
                  id="pt-email"
                  type="email"
                  className={fieldClass}
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pt-age">
                  Age
                </label>
                <input
                  id="pt-age"
                  type="number"
                  min="0"
                  className={fieldClass}
                  value={form.age}
                  onChange={(e) => set('age', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pt-blood">
                  Blood group
                </label>
                <select
                  id="pt-blood"
                  className={fieldClass}
                  value={form.blood_group}
                  onChange={(e) => set('blood_group', e.target.value)}
                >
                  {BLOOD_GROUPS.map((b) => (
                    <option key={b || 'none'} value={b}>
                      {b || 'Select'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="pt-address">
                  Address
                </label>
                <input
                  id="pt-address"
                  className={fieldClass}
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-900">Emergency contacts</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="pt-ec1">
                  Emergency contact
                </label>
                <input
                  id="pt-ec1"
                  className={fieldClass}
                  value={form.emergency_contact}
                  onChange={(e) => set('emergency_contact', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pt-ep1">
                  Emergency phone
                </label>
                <input
                  id="pt-ep1"
                  className={fieldClass}
                  value={form.emergency_phone}
                  onChange={(e) => set('emergency_phone', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pt-ec2">
                  Emergency contact 2
                </label>
                <input
                  id="pt-ec2"
                  className={fieldClass}
                  value={form.emergency_contact_2}
                  onChange={(e) => set('emergency_contact_2', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pt-ep2">
                  Emergency phone 2
                </label>
                <input
                  id="pt-ep2"
                  className={fieldClass}
                  value={form.emergency_phone_2}
                  onChange={(e) => set('emergency_phone_2', e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-900">Medical</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="pt-mc">
                  Medical conditions
                </label>
                <textarea
                  id="pt-mc"
                  rows={2}
                  className={fieldClass}
                  value={form.medical_conditions}
                  onChange={(e) => set('medical_conditions', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pt-all">
                  Allergies
                </label>
                <input
                  id="pt-all"
                  className={fieldClass}
                  value={form.allergies}
                  onChange={(e) => set('allergies', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pt-phc">
                  Present health condition
                </label>
                <input
                  id="pt-phc"
                  className={fieldClass}
                  value={form.present_health_condition}
                  onChange={(e) => set('present_health_condition', e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-900">Background & placement</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="pt-lang">
                  Preferred language
                </label>
                <input
                  id="pt-lang"
                  className={fieldClass}
                  value={form.preferred_language}
                  onChange={(e) => set('preferred_language', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pt-edu">
                  Education qualifications
                </label>
                <input
                  id="pt-edu"
                  className={fieldClass}
                  value={form.education_qualifications}
                  onChange={(e) => set('education_qualifications', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pt-occ">
                  Earlier occupation
                </label>
                <input
                  id="pt-occ"
                  className={fieldClass}
                  value={form.earlier_occupation}
                  onChange={(e) => set('earlier_occupation', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pt-retire">
                  Year of retirement
                </label>
                <input
                  id="pt-retire"
                  type="number"
                  min="1900"
                  max="2100"
                  className={fieldClass}
                  value={form.year_of_retirement}
                  onChange={(e) => set('year_of_retirement', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pt-loctype">
                  Location type
                </label>
                <select
                  id="pt-loctype"
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
                <label className={labelClass} htmlFor="pt-locality">
                  Booking locality
                </label>
                <input
                  id="pt-locality"
                  className={fieldClass}
                  value={form.booking_locality}
                  onChange={(e) => set('booking_locality', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pt-onboard">
                  Onboarding date
                </label>
                <input
                  id="pt-onboard"
                  type="date"
                  className={fieldClass}
                  value={form.onboading_date}
                  onChange={(e) => set('onboading_date', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pt-emr">
                  EMR count
                </label>
                <input
                  id="pt-emr"
                  type="number"
                  min="0"
                  className={fieldClass}
                  value={form.emr_count}
                  onChange={(e) => set('emr_count', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pt-aff">
                  Affiliate
                </label>
                <input
                  id="pt-aff"
                  className={fieldClass}
                  value={form.affiliate}
                  onChange={(e) => set('affiliate', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pt-src">
                  Source
                </label>
                <input
                  id="pt-src"
                  className={fieldClass}
                  value={form.source}
                  onChange={(e) => set('source', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pt-ref">
                  Referred by
                </label>
                <input
                  id="pt-ref"
                  className={fieldClass}
                  value={form.referred_by}
                  onChange={(e) => set('referred_by', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pt-regby">
                  Registered by (name)
                </label>
                <input
                  id="pt-regby"
                  className={fieldClass}
                  value={form.name_registered_by}
                  onChange={(e) => set('name_registered_by', e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 pt-1 text-sm text-slate-700">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  checked={form.is_probono}
                  onChange={(e) => set('is_probono', e.target.checked)}
                />
                Pro bono
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  checked={form.is_registration_fees_paid}
                  onChange={(e) => set('is_registration_fees_paid', e.target.checked)}
                />
                Registration fees paid
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  checked={form.is_active}
                  onChange={(e) => set('is_active', e.target.checked)}
                />
                Active
              </label>
            </div>
          </section>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete patient?"
        message="This removes the patient from demo data for this tenant."
        confirmLabel="Delete"
        onConfirm={() => {
          remove(deleteTarget.id)
          setStatus({ type: 'success', message: 'Patient removed.' })
          setDeleteTarget(null)
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export default PatientsPage
