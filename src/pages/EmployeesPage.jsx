import { useMemo, useRef, useState } from 'react'
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

const USER_TYPES = ['VSRE_STAFF', 'VSRE_NURSE', 'VSRE_CARE_AIDE', 'VSRE_MANAGER', 'OTHER']
const GENDERS = ['M', 'F', 'O']
const REHIRED = ['NO', 'YES']

const EMPTY_PROFILE = {
  employee_id: '',
  category: '',
  designation: '',
  grade: '',
  cost_center: '',
  department: '',
  rehired_status: 'NO',
  vendor_name: '',
  vendor_phone: '',
  last_working_day: '',
  termination_type: '',
  termination_reason: '',
  order_types: '',
  skills: '',
  target_percent: '',
  qc_required: false,
  pf_applicable: false,
  pf_number: '',
  uan_number: '',
  esi_applicable: false,
  esi_number: '',
  esi_dispensary: '',
  shift_detail: '',
  shift_effective_from: '',
}

const EMPTY = {
  profile_pic: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  email: '',
  mobile_number: '',
  alternate_phone_number: '',
  emergency_contact_name: '',
  emergency_contact_number: '',
  user_type: 'VSRE_STAFF',
  age: '',
  gender: 'M',
  permanent_address: '',
  current_address: '',
  city: '',
  date_joined: '',
  is_active: true,
  employee_profile: { ...EMPTY_PROFILE },
  reports_to_name: '',
  reports_to_level: 0,
  venue_ids: [],
  service_ids: [],
}

const fullName = (row) =>
  [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ').trim() ||
  row.name ||
  '—'

const readFileAsDataUrl = (file) =>
  new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) {
      resolve('')
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => resolve('')
    reader.readAsDataURL(file)
  })

const nextEmpCode = (rows) => {
  const nums = rows
    .map((r) => Number(String(r.employee_profile?.employee_id || '').replace(/\D/g, '')))
    .filter((n) => !Number.isNaN(n) && n > 0)
  const next = (nums.length ? Math.max(...nums) : 20260000) + 1
  return `S${next}`
}

const EmployeesPage = ({ tenantId: tenantIdProp, canWrite: canWriteProp, eyebrow } = {}) => {
  const access = useAccess()
  const tenantId = tenantIdProp || access.tenantId
  const canWrite = canWriteProp ?? access.canWrite
  const { rows, save, remove } = usePlatformCollection('employees', tenantId)
  const { rows: venues } = usePlatformCollection('venues', tenantId)
  const { rows: services } = usePlatformCollection('services', tenantId)

  const [status, setStatus] = useState({ type: '', message: '' })
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [activeFilter, setActiveFilter] = useState('ALL')
  const picRef = useRef(null)

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))
  const setProfile = (key, value) =>
    setForm((f) => ({ ...f, employee_profile: { ...f.employee_profile, [key]: value } }))

  const filtered = useMemo(() => {
    if (activeFilter === 'ACTIVE') return rows.filter((r) => r.is_active !== false && !r.is_deleted)
    if (activeFilter === 'INACTIVE') return rows.filter((r) => r.is_active === false || r.is_deleted)
    return rows.filter((r) => !r.is_deleted)
  }, [rows, activeFilter])

  const toggleId = (key, id) => {
    setForm((f) => {
      const list = (f[key] || []).map(String)
      const sid = String(id)
      return {
        ...f,
        [key]: list.includes(sid) ? f[key].filter((x) => String(x) !== sid) : [...f[key], id],
      }
    })
  }

  const openCreate = () => {
    setEditing(null)
    setForm({
      ...EMPTY,
      employee_profile: { ...EMPTY_PROFILE, employee_id: nextEmpCode(rows) },
      date_joined: new Date().toISOString().slice(0, 10),
    })
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    const profile = row.employee_profile || {}
    setForm({
      profile_pic: row.profile_pic || '',
      first_name: row.first_name || (row.name || '').split(' ')[0] || '',
      middle_name: row.middle_name || '',
      last_name: row.last_name || (row.name || '').split(' ').slice(1).join(' ') || '',
      email: row.email || '',
      mobile_number: row.mobile_number || row.phone || '',
      alternate_phone_number: row.alternate_phone_number || '',
      emergency_contact_name: row.emergency_contact_name || '',
      emergency_contact_number: row.emergency_contact_number || '',
      user_type: row.user_type || 'VSRE_STAFF',
      age: row.age ?? '',
      gender: row.gender || 'M',
      permanent_address: row.permanent_address || '',
      current_address: row.current_address || '',
      city: row.city || '',
      date_joined: (row.date_joined || '').toString().slice(0, 10),
      is_active: row.is_active !== false && row.status !== 'inactive',
      employee_profile: {
        ...EMPTY_PROFILE,
        ...profile,
        employee_id: profile.employee_id || '',
        last_working_day: (profile.last_working_day || '').toString().slice(0, 10),
        shift_effective_from: (profile.shift_effective_from || '').toString().slice(0, 10),
        shift_detail: profile.shift_detail || row.shift || '',
        designation: profile.designation || row.role || '',
        skills: Array.isArray(profile.skills) ? profile.skills.join(', ') : profile.skills || '',
        order_types: Array.isArray(profile.order_types)
          ? profile.order_types.join(', ')
          : profile.order_types || '',
      },
      reports_to_name: row.reports_to?.name || '',
      reports_to_level: row.reports_to?.level ?? 0,
      venue_ids: (row.venues || []).map((v) => v.id),
      service_ids: (row.services || []).map((s) => s.id),
    })
    setModalOpen(true)
  }

  const handleSave = (e) => {
    e.preventDefault()
    if (!form.first_name.trim()) {
      setStatus({ type: 'error', message: 'First name is required.' })
      return
    }
    if (!form.mobile_number.trim()) {
      setStatus({ type: 'error', message: 'Mobile number is required.' })
      return
    }

    const linkedVenues = venues
      .filter((v) => form.venue_ids.map(String).includes(String(v.id)))
      .map((v) => ({
        id: v.id,
        name: v.name,
        locality: v.locality || v.area || v.city || '',
        is_active: v.is_active !== false && v.status !== 'inactive',
      }))

    const linkedServices = services
      .filter((s) => form.service_ids.map(String).includes(String(s.id)))
      .map((s) => ({
        id: s.id,
        name: s.name,
        city: s.city || '',
        is_active: s.is_active !== false && s.status !== 'inactive',
      }))

    const name = fullName({
      first_name: form.first_name,
      middle_name: form.middle_name,
      last_name: form.last_name,
    })

    setSaving(true)
    try {
      save({
        id: editing?.id,
        tenantId,
        profile_pic: form.profile_pic || null,
        first_name: form.first_name.trim(),
        middle_name: form.middle_name.trim() || null,
        last_name: form.last_name.trim() || null,
        name,
        email: form.email.trim(),
        mobile_number: form.mobile_number.trim(),
        phone: form.mobile_number.trim(),
        alternate_phone_number: form.alternate_phone_number.trim() || null,
        emergency_contact_name: form.emergency_contact_name.trim() || null,
        emergency_contact_number: form.emergency_contact_number.trim() || null,
        user_type: form.user_type,
        age: form.age === '' ? null : Number(form.age),
        gender: form.gender,
        permanent_address: form.permanent_address.trim() || null,
        current_address: form.current_address.trim() || null,
        city: form.city.trim(),
        date_joined: form.date_joined || null,
        is_active: Boolean(form.is_active),
        is_deleted: false,
        status: form.is_active ? 'active' : 'inactive',
        created_by: editing?.created_by ?? access.user?.id ?? null,
        employee_profile: {
          employee_id: form.employee_profile.employee_id.trim() || nextEmpCode(rows),
          category: form.employee_profile.category.trim() || null,
          designation: form.employee_profile.designation.trim() || null,
          grade: form.employee_profile.grade.trim() || null,
          cost_center: form.employee_profile.cost_center.trim() || null,
          department: form.employee_profile.department.trim() || null,
          rehired_status: form.employee_profile.rehired_status || 'NO',
          vendor_name: form.employee_profile.vendor_name.trim() || null,
          vendor_phone: form.employee_profile.vendor_phone.trim() || null,
          last_working_day: form.employee_profile.last_working_day || null,
          termination_type: form.employee_profile.termination_type.trim() || null,
          termination_reason: form.employee_profile.termination_reason.trim() || null,
          order_types: form.employee_profile.order_types
            ? form.employee_profile.order_types.split(',').map((x) => x.trim()).filter(Boolean)
            : null,
          skills: form.employee_profile.skills
            ? form.employee_profile.skills.split(',').map((x) => x.trim()).filter(Boolean)
            : null,
          target_percent:
            form.employee_profile.target_percent === ''
              ? null
              : Number(form.employee_profile.target_percent),
          qc_required: Boolean(form.employee_profile.qc_required),
          pf_applicable: Boolean(form.employee_profile.pf_applicable),
          pf_number: form.employee_profile.pf_number.trim() || null,
          uan_number: form.employee_profile.uan_number.trim() || null,
          esi_applicable: Boolean(form.employee_profile.esi_applicable),
          esi_number: form.employee_profile.esi_number.trim() || null,
          esi_dispensary: form.employee_profile.esi_dispensary.trim() || null,
          shift_detail: form.employee_profile.shift_detail.trim() || null,
          shift_effective_from: form.employee_profile.shift_effective_from || null,
        },
        role: form.employee_profile.designation.trim() || form.user_type,
        shift: form.employee_profile.shift_detail.trim() || '',
        reports_to: form.reports_to_name.trim()
          ? {
              id: editing?.reports_to?.id || `mgr-${Date.now().toString(36)}`,
              name: form.reports_to_name.trim(),
              level: Number(form.reports_to_level) || 0,
            }
          : null,
        venues: linkedVenues,
        services: linkedServices,
        resources: editing?.resources || [],
      })
      setStatus({
        type: 'success',
        message: editing ? 'Employee updated.' : 'Employee created.',
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
        title="Employees"
        description="Staff profiles with HR details, reporting line, and linked venues/services."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={`${fieldClass} w-auto min-w-[140px]`}
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              aria-label="Filter employees"
            >
              <option value="ALL">All</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            {canWrite ? (
              <button type="button" className={btnPrimary} onClick={openCreate}>
                <FiPlus className="h-4 w-4" aria-hidden />
                Add employee
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
            title="No employees"
            hint={canWrite ? 'Add a staff member to get started.' : 'Nothing on file.'}
            actionLabel={canWrite ? 'Add employee' : undefined}
            onAction={canWrite ? openCreate : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-3 py-3">Employee ID</th>
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Mobile</th>
                  <th className="px-3 py-3">User type</th>
                  <th className="px-3 py-3">Designation</th>
                  <th className="px-3 py-3">City</th>
                  <th className="px-3 py-3">Venues</th>
                  <th className="px-3 py-3">Services</th>
                  <th className="px-3 py-3">Reports to</th>
                  <th className="px-3 py-3">Joined</th>
                  <th className="px-3 py-3">Active</th>
                  {canWrite ? <th className="px-3 py-3 text-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3 font-medium text-slate-900 whitespace-nowrap">
                      {row.employee_profile?.employee_id || row.id}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        {row.profile_pic ? (
                          <img
                            src={row.profile_pic}
                            alt=""
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                            {(row.first_name || 'E').slice(0, 1)}
                          </span>
                        )}
                        <span className="font-semibold text-slate-900 whitespace-nowrap">
                          {fullName(row)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                      {row.mobile_number || row.phone || '—'}
                    </td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                      {row.user_type || '—'}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {row.employee_profile?.designation || row.role || '—'}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{row.city || '—'}</td>
                    <td className="px-3 py-3 text-slate-600">
                      {(row.venues || []).length
                        ? (row.venues || []).map((v) => v.name).join(', ')
                        : '—'}
                    </td>
                    <td className="px-3 py-3 text-slate-600 max-w-[180px]">
                      <span className="line-clamp-2">
                        {(row.services || []).length
                          ? (row.services || []).map((s) => s.name).join(', ')
                          : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                      {row.reports_to?.name || '—'}
                    </td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                      {row.date_joined || '—'}
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
                            aria-label={`Edit ${fullName(row)}`}
                          >
                            <FiEdit2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            className={`${btnGhost} text-rose-600 hover:bg-rose-50`}
                            onClick={() => setDeleteTarget(row)}
                            aria-label={`Delete ${fullName(row)}`}
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
        title={editing ? 'Edit employee' : 'Add employee'}
        onClose={() => setModalOpen(false)}
        xl
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="employee-form" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add employee'}
            </button>
          </div>
        }
      >
        <form id="employee-form" className="space-y-4" onSubmit={handleSave}>
          <section className="space-y-3 rounded-xl border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-900">Identity</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-full border border-slate-200 bg-slate-50">
                  {form.profile_pic ? (
                    <img src={form.profile_pic} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div>
                  <label className={labelClass} htmlFor="emp-pic">
                    Profile picture
                  </label>
                  <input
                    ref={picRef}
                    id="emp-pic"
                    type="file"
                    accept="image/*"
                    className="block text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-sky-800"
                    onChange={async (e) => {
                      const url = await readFileAsDataUrl(e.target.files?.[0])
                      set('profile_pic', url)
                    }}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass} htmlFor="emp-fn">
                  First name <span className="text-rose-600">*</span>
                </label>
                <input
                  id="emp-fn"
                  className={fieldClass}
                  value={form.first_name}
                  onChange={(e) => set('first_name', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="emp-mn">
                  Middle name
                </label>
                <input
                  id="emp-mn"
                  className={fieldClass}
                  value={form.middle_name}
                  onChange={(e) => set('middle_name', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="emp-ln">
                  Last name
                </label>
                <input
                  id="emp-ln"
                  className={fieldClass}
                  value={form.last_name}
                  onChange={(e) => set('last_name', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="emp-type">
                  User type
                </label>
                <select
                  id="emp-type"
                  className={fieldClass}
                  value={form.user_type}
                  onChange={(e) => set('user_type', e.target.value)}
                >
                  {USER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="emp-email">
                  Email
                </label>
                <input
                  id="emp-email"
                  type="email"
                  className={fieldClass}
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="emp-mobile">
                  Mobile number <span className="text-rose-600">*</span>
                </label>
                <input
                  id="emp-mobile"
                  className={fieldClass}
                  value={form.mobile_number}
                  onChange={(e) => set('mobile_number', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="emp-alt">
                  Alternate phone
                </label>
                <input
                  id="emp-alt"
                  className={fieldClass}
                  value={form.alternate_phone_number}
                  onChange={(e) => set('alternate_phone_number', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="emp-gender">
                  Gender
                </label>
                <select
                  id="emp-gender"
                  className={fieldClass}
                  value={form.gender}
                  onChange={(e) => set('gender', e.target.value)}
                >
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="emp-age">
                  Age
                </label>
                <input
                  id="emp-age"
                  type="number"
                  min="0"
                  className={fieldClass}
                  value={form.age}
                  onChange={(e) => set('age', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="emp-city">
                  City
                </label>
                <input
                  id="emp-city"
                  className={fieldClass}
                  value={form.city}
                  onChange={(e) => set('city', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="emp-joined">
                  Date joined
                </label>
                <input
                  id="emp-joined"
                  type="date"
                  className={fieldClass}
                  value={form.date_joined}
                  onChange={(e) => set('date_joined', e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="emp-paddr">
                  Permanent address
                </label>
                <input
                  id="emp-paddr"
                  className={fieldClass}
                  value={form.permanent_address}
                  onChange={(e) => set('permanent_address', e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="emp-caddr">
                  Current address
                </label>
                <input
                  id="emp-caddr"
                  className={fieldClass}
                  value={form.current_address}
                  onChange={(e) => set('current_address', e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-900">Emergency contact</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="emp-ec">
                  Contact name
                </label>
                <input
                  id="emp-ec"
                  className={fieldClass}
                  value={form.emergency_contact_name}
                  onChange={(e) => set('emergency_contact_name', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="emp-ecn">
                  Contact number
                </label>
                <input
                  id="emp-ecn"
                  className={fieldClass}
                  value={form.emergency_contact_number}
                  onChange={(e) => set('emergency_contact_number', e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-900">Employee profile</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['employee_id', 'Employee ID'],
                ['category', 'Category'],
                ['designation', 'Designation'],
                ['grade', 'Grade'],
                ['cost_center', 'Cost center'],
                ['department', 'Department'],
                ['vendor_name', 'Vendor name'],
                ['vendor_phone', 'Vendor phone'],
                ['termination_type', 'Termination type'],
                ['termination_reason', 'Termination reason'],
                ['order_types', 'Order types (comma separated)'],
                ['skills', 'Skills (comma separated)'],
                ['target_percent', 'Target percent', 'number'],
                ['pf_number', 'PF number'],
                ['uan_number', 'UAN number'],
                ['esi_number', 'ESI number'],
                ['esi_dispensary', 'ESI dispensary'],
                ['shift_detail', 'Shift detail'],
              ].map(([key, label, type]) => (
                <div key={key}>
                  <label className={labelClass} htmlFor={`emp-p-${key}`}>
                    {label}
                  </label>
                  <input
                    id={`emp-p-${key}`}
                    type={type || 'text'}
                    className={fieldClass}
                    value={form.employee_profile[key] ?? ''}
                    onChange={(e) => setProfile(key, e.target.value)}
                  />
                </div>
              ))}
              <div>
                <label className={labelClass} htmlFor="emp-rehire">
                  Rehired status
                </label>
                <select
                  id="emp-rehire"
                  className={fieldClass}
                  value={form.employee_profile.rehired_status}
                  onChange={(e) => setProfile('rehired_status', e.target.value)}
                >
                  {REHIRED.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="emp-lwd">
                  Last working day
                </label>
                <input
                  id="emp-lwd"
                  type="date"
                  className={fieldClass}
                  value={form.employee_profile.last_working_day}
                  onChange={(e) => setProfile('last_working_day', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="emp-shift-from">
                  Shift effective from
                </label>
                <input
                  id="emp-shift-from"
                  type="date"
                  className={fieldClass}
                  value={form.employee_profile.shift_effective_from}
                  onChange={(e) => setProfile('shift_effective_from', e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-700">
              {[
                ['qc_required', 'QC required'],
                ['pf_applicable', 'PF applicable'],
                ['esi_applicable', 'ESI applicable'],
              ].map(([key, label]) => (
                <label key={key} className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    checked={Boolean(form.employee_profile[key])}
                    onChange={(e) => setProfile(key, e.target.checked)}
                  />
                  {label}
                </label>
              ))}
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

          <section className="space-y-3 rounded-xl border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-900">Reports to</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="emp-mgr">
                  Manager name
                </label>
                <input
                  id="emp-mgr"
                  className={fieldClass}
                  value={form.reports_to_name}
                  onChange={(e) => set('reports_to_name', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="emp-level">
                  Level
                </label>
                <input
                  id="emp-level"
                  type="number"
                  min="0"
                  className={fieldClass}
                  value={form.reports_to_level}
                  onChange={(e) => set('reports_to_level', e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-900">Linked venues</p>
            {venues.length === 0 ? (
              <p className="text-sm text-slate-500">No venues available.</p>
            ) : (
              <div className="max-h-36 space-y-1 overflow-y-auto">
                {venues.map((v) => (
                  <label key={v.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      checked={form.venue_ids.map(String).includes(String(v.id))}
                      onChange={() => toggleId('venue_ids', v.id)}
                    />
                    {v.name}
                  </label>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-900">Linked services</p>
            {services.length === 0 ? (
              <p className="text-sm text-slate-500">No services available.</p>
            ) : (
              <div className="max-h-36 space-y-1 overflow-y-auto">
                {services.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      checked={form.service_ids.map(String).includes(String(s.id))}
                      onChange={() => toggleId('service_ids', s.id)}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            )}
          </section>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete employee?"
        message="This removes the employee from demo data for this tenant."
        confirmLabel="Delete"
        onConfirm={() => {
          remove(deleteTarget.id)
          setStatus({ type: 'success', message: 'Employee removed.' })
          setDeleteTarget(null)
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export default EmployeesPage
