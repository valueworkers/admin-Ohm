import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FiEdit2, FiFileText, FiPlus, FiTrash2 } from 'react-icons/fi'
import {
  BLOOD_GROUPS,
  GENDERS,
  createPatient,
  fetchPatients,
  patientFullName,
  replacePatient,
  softDeletePatient,
} from '../api/patients'
import {
  createPatientDocument,
  deletePatientDocument,
  fetchPatientDocuments,
} from '../api/patientDocuments'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/PageState'
import { useAccess } from '../hooks/useAccess'
import { apiErrorMessage } from '../utils/errors'
import { resolveCatalogTenantSlug } from '../utils/tenantHeader'
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  fieldClass,
  labelClass,
  tableHeadClass,
  tableWrapClass,
} from '../utils/ui'

const EMPTY = {
  first_name: '',
  last_name: '',
  full_name: '',
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
  gender: 'male',
  blood_group: 'O+',
  preferred_language: 'English',
  education_qualifications: '',
  earlier_occupation: '',
  year_of_retirement: '',
  affiliate: '',
  source: '',
  referred_by: '',
  is_probono: false,
  is_registration_fees_paid: false,
}

const EMPTY_DOC = { title: '', remarks: '', files: [] }

const SORT_OPTIONS = [
  { value: '-registration_date', label: 'Newest registered' },
  { value: 'registration_date', label: 'Oldest registered' },
  { value: 'first_name', label: 'Name A–Z' },
  { value: '-first_name', label: 'Name Z–A' },
  { value: 'patient_id', label: 'Patient ID ↑' },
  { value: '-patient_id', label: 'Patient ID ↓' },
  { value: 'age', label: 'Age low → high' },
  { value: '-age', label: 'Age high → low' },
  { value: '-updated_at', label: 'Recently updated' },
]

const PATIENT_COLUMNS = [
  { id: 'patient_id', label: 'Patient ID' },
  { id: 'full_name', label: 'Full name' },
  { id: 'first_name', label: 'First name' },
  { id: 'last_name', label: 'Last name' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'address', label: 'Address' },
  { id: 'age', label: 'Age' },
  { id: 'gender', label: 'Gender' },
  { id: 'blood_group', label: 'Blood group' },
  { id: 'preferred_language', label: 'Language' },
  { id: 'emergency_contact', label: 'Emergency contact' },
  { id: 'emergency_phone', label: 'Emergency phone' },
  { id: 'emergency_contact_2', label: 'Emergency contact 2' },
  { id: 'emergency_phone_2', label: 'Emergency phone 2' },
  { id: 'medical_conditions', label: 'Medical conditions' },
  { id: 'allergies', label: 'Allergies' },
  { id: 'present_health_condition', label: 'Present health' },
  { id: 'education_qualifications', label: 'Education' },
  { id: 'earlier_occupation', label: 'Earlier occupation' },
  { id: 'year_of_retirement', label: 'Retirement year' },
  { id: 'affiliate', label: 'Affiliate' },
  { id: 'source', label: 'Source' },
  { id: 'referred_by', label: 'Referred by' },
  { id: 'is_probono', label: 'Pro bono' },
  { id: 'is_registration_fees_paid', label: 'Reg. fees' },
  { id: 'is_active', label: 'Active' },
  { id: 'is_deleted', label: 'Deleted' },
  { id: 'registration_date', label: 'Registered' },
  { id: 'updated_at', label: 'Updated' },
  { id: 'registered_by', label: 'Registered by' },
]

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim())

const shortDate = (v) => {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const shortDateTime = (v) => {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 16)
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const yesNoChip = (on, yes = 'Yes', no = 'No', yesClass = 'bg-brand-50 text-brand-800') => (
  <span
    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
      on ? yesClass : 'bg-stone-100 text-stone-600'
    }`}
  >
    {on ? yes : no}
  </span>
)

const cellText = (v, { capitalize = false, mono = false, clamp = false } = {}) => {
  const text = v == null || v === '' ? '—' : String(v)
  return (
    <td
      className={`px-3 py-3 text-stone-600 ${mono ? 'font-mono text-xs' : ''} ${
        capitalize ? 'capitalize' : ''
      } ${clamp ? 'max-w-[14rem] truncate' : 'whitespace-nowrap'}`}
      title={clamp && text !== '—' ? text : undefined}
    >
      {capitalize && text !== '—' ? text.replace(/-/g, ' ') : text}
    </td>
  )
}

const renderPatientCell = (colId, row) => {
  switch (colId) {
    case 'patient_id':
      return cellText(row.patient_id || row.id, { mono: true })
    case 'full_name':
      return (
        <td className="whitespace-nowrap px-3 py-3 font-semibold text-stone-900">
          {patientFullName(row)}
        </td>
      )
    case 'first_name':
    case 'last_name':
    case 'email':
    case 'phone':
    case 'preferred_language':
    case 'emergency_contact':
    case 'emergency_phone':
    case 'emergency_contact_2':
    case 'emergency_phone_2':
    case 'education_qualifications':
    case 'earlier_occupation':
    case 'affiliate':
    case 'source':
    case 'referred_by':
    case 'blood_group':
      return cellText(row[colId])
    case 'address':
    case 'medical_conditions':
    case 'allergies':
    case 'present_health_condition':
      return cellText(row[colId], { clamp: true })
    case 'age':
    case 'year_of_retirement':
      return cellText(row[colId] ?? '—')
    case 'gender':
      return cellText(row.gender, { capitalize: true })
    case 'is_probono':
      return <td className="px-3 py-3">{yesNoChip(row.is_probono)}</td>
    case 'is_registration_fees_paid':
      return (
        <td className="px-3 py-3">
          {yesNoChip(row.is_registration_fees_paid, 'Paid', 'Unpaid', 'bg-emerald-50 text-emerald-800')}
        </td>
      )
    case 'is_active':
      return (
        <td className="px-3 py-3">
          {yesNoChip(row.is_active, 'Active', 'Inactive', 'bg-emerald-50 text-emerald-800')}
        </td>
      )
    case 'is_deleted':
      return (
        <td className="px-3 py-3">
          {yesNoChip(row.is_deleted, 'Yes', 'No', 'bg-rose-50 text-rose-700')}
        </td>
      )
    case 'registration_date':
      return cellText(shortDate(row.registration_date))
    case 'updated_at':
      return cellText(shortDateTime(row.updated_at))
    case 'registered_by':
      return cellText(
        row.registered_by == null
          ? '—'
          : typeof row.registered_by === 'object'
            ? row.registered_by.name ||
              row.registered_by.email ||
              row.registered_by.id ||
              '—'
            : row.registered_by,
      )
    default:
      return cellText(row[colId])
  }
}

const formFromRow = (row = {}) => ({
  first_name: row.first_name || '',
  last_name: row.last_name || '',
  full_name: row.full_name || '',
  email: row.email || '',
  phone: row.phone || '',
  address: row.address || '',
  age: row.age != null ? String(row.age) : '',
  emergency_contact: row.emergency_contact || '',
  emergency_phone: row.emergency_phone || '',
  emergency_contact_2: row.emergency_contact_2 || '',
  emergency_phone_2: row.emergency_phone_2 || '',
  medical_conditions: row.medical_conditions || '',
  allergies: row.allergies || '',
  present_health_condition: row.present_health_condition || '',
  gender: row.gender || 'male',
  blood_group: row.blood_group || 'O+',
  preferred_language: row.preferred_language || 'English',
  education_qualifications: row.education_qualifications || '',
  earlier_occupation: row.earlier_occupation || '',
  year_of_retirement: row.year_of_retirement != null ? String(row.year_of_retirement) : '',
  affiliate: row.affiliate || '',
  source: row.source || '',
  referred_by: row.referred_by || '',
  is_probono: Boolean(row.is_probono),
  is_registration_fees_paid: Boolean(row.is_registration_fees_paid),
})

const sortPatients = (list, sortBy) => {
  const desc = sortBy.startsWith('-')
  const field = desc ? sortBy.slice(1) : sortBy
  const cmpStr = (a, b) =>
    String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base' })
  const cmpNum = (a, b) => (Number(a) || 0) - (Number(b) || 0)
  const cmpDate = (a, b) => new Date(a || 0).getTime() - new Date(b || 0).getTime()
  const sorted = [...list]
  sorted.sort((a, b) => {
    let diff = 0
    if (field === 'age') diff = cmpNum(a.age, b.age)
    else if (field === 'registration_date' || field === 'updated_at') {
      diff = cmpDate(a[field], b[field])
    } else if (field === 'patient_id') diff = cmpStr(a.patient_id, b.patient_id)
    else if (field === 'first_name') {
      diff = cmpStr(patientFullName(a), patientFullName(b))
    } else diff = cmpStr(a[field], b[field])
    return desc ? -diff : diff
  })
  return sorted
}

const PatientsPage = ({ canWrite: canWriteProp, eyebrow } = {}) => {
  const access = useAccess()
  const canWrite = canWriteProp ?? access.canWrite
  const tenantSlug = resolveCatalogTenantSlug(access.tenant)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [genderFilter, setGenderFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('true')
  const [probonoFilter, setProbonoFilter] = useState('')
  const [bloodFilter, setBloodFilter] = useState('')
  const [feesFilter, setFeesFilter] = useState('')
  const [sortBy, setSortBy] = useState('-registration_date')
  const [status, setStatus] = useState({ type: '', message: '' })

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [docsPatient, setDocsPatient] = useState(null)
  const [docs, setDocs] = useState([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [docForm, setDocForm] = useState(EMPTY_DOC)
  const [docSaving, setDocSaving] = useState(false)
  const [docDeleteTarget, setDocDeleteTarget] = useState(null)
  const [docDeleting, setDocDeleting] = useState(false)
  const docFileRef = useRef(null)

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const load = useCallback(async () => {
    if (!tenantSlug) {
      setRows([])
      setLoadError('')
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      const { results } = await fetchPatients(tenantSlug, {
        search: search || undefined,
        gender: genderFilter || undefined,
        isActive: activeFilter === '' ? undefined : activeFilter,
        isProbono: probonoFilter === '' ? undefined : probonoFilter,
        ordering: sortBy || undefined,
      })
      setRows(results)
    } catch (err) {
      setRows([])
      setLoadError(apiErrorMessage(err, 'Could not load patients.'))
    } finally {
      setLoading(false)
    }
  }, [tenantSlug, search, genderFilter, activeFilter, probonoFilter, sortBy])

  useEffect(() => {
    load()
  }, [load])

  const visibleRows = useMemo(() => {
    let list = rows
    if (bloodFilter) list = list.filter((r) => r.blood_group === bloodFilter)
    if (feesFilter === 'true') list = list.filter((r) => r.is_registration_fees_paid)
    if (feesFilter === 'false') list = list.filter((r) => !r.is_registration_fees_paid)
    return sortPatients(list, sortBy)
  }, [rows, bloodFilter, feesFilter, sortBy])

  const filtering = Boolean(
    search ||
      genderFilter ||
      activeFilter !== 'true' ||
      probonoFilter ||
      bloodFilter ||
      feesFilter,
  )

  const clearFilters = () => {
    setSearchInput('')
    setSearch('')
    setGenderFilter('')
    setActiveFilter('true')
    setProbonoFilter('')
    setBloodFilter('')
    setFeesFilter('')
  }

  const loadDocs = useCallback(
    async (patientId) => {
      if (!tenantSlug || !patientId) {
        setDocs([])
        return
      }
      setDocsLoading(true)
      try {
        const { results } = await fetchPatientDocuments(tenantSlug, { patient: patientId })
        setDocs(results)
      } catch {
        setDocs([])
      } finally {
        setDocsLoading(false)
      }
    },
    [tenantSlug],
  )

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
  }

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm(formFromRow(row))
    setModalOpen(true)
  }

  const openDocs = async (row) => {
    setDocsPatient(row)
    setDocForm(EMPTY_DOC)
    await loadDocs(row.id)
  }

  const closeDocs = () => {
    setDocsPatient(null)
    setDocs([])
    setDocForm(EMPTY_DOC)
  }

  const validate = () => {
    if (!form.first_name.trim()) return 'First name is required.'
    if (!form.last_name.trim()) return 'Last name is required.'
    if (!form.email.trim() || !isEmail(form.email)) return 'Valid email is required.'
    if (!form.phone.trim()) return 'Phone is required.'
    if (!form.address.trim()) return 'Address is required.'
    if (form.age === '' || Number(form.age) < 0 || Number.isNaN(Number(form.age))) {
      return 'Enter a valid age.'
    }
    if (!form.emergency_contact.trim()) return 'Emergency contact is required.'
    if (!form.emergency_phone.trim()) return 'Emergency phone is required.'
    if (!form.gender) return 'Gender is required.'
    if (!form.blood_group) return 'Blood group is required.'
    if (!form.preferred_language.trim()) return 'Preferred language is required.'
    if (
      form.year_of_retirement !== '' &&
      (Number.isNaN(Number(form.year_of_retirement)) ||
        Number(form.year_of_retirement) < 1900 ||
        Number(form.year_of_retirement) > 2100)
    ) {
      return 'Enter a valid year of retirement.'
    }
    return ''
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!tenantSlug) return
    const message = validate()
    if (message) {
      setStatus({ type: 'error', message })
      return
    }
    setSaving(true)
    try {
      if (editing) await replacePatient(tenantSlug, editing.id, form)
      else await createPatient(tenantSlug, form)
      setStatus({
        type: 'success',
        message: editing ? 'Patient updated.' : 'Patient created.',
      })
      closeModal()
      await load()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not save patient.') })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!tenantSlug || !deleteTarget) return
    setDeleting(true)
    try {
      await softDeletePatient(tenantSlug, deleteTarget.id)
      setStatus({ type: 'success', message: 'Patient removed.' })
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not remove patient.') })
    } finally {
      setDeleting(false)
    }
  }

  const handleUploadDoc = async (e) => {
    e.preventDefault()
    if (!tenantSlug || !docsPatient) return
    if (!docForm.title.trim() || !docForm.remarks.trim() || !docForm.files?.length) {
      setStatus({ type: 'error', message: 'Title, remarks, and at least one file are required.' })
      return
    }
    setDocSaving(true)
    try {
      await createPatientDocument(tenantSlug, {
        patient: docsPatient.id,
        title: docForm.title,
        remarks: docForm.remarks,
        files: docForm.files,
      })
      setDocForm(EMPTY_DOC)
      if (docFileRef.current) docFileRef.current.value = ''
      setStatus({ type: 'success', message: 'Document uploaded.' })
      await loadDocs(docsPatient.id)
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not upload document.') })
    } finally {
      setDocSaving(false)
    }
  }

  const handleDeleteDoc = async () => {
    if (!tenantSlug || !docDeleteTarget || !docsPatient) return
    setDocDeleting(true)
    try {
      await deletePatientDocument(tenantSlug, docDeleteTarget.id)
      setStatus({ type: 'success', message: 'Document deleted.' })
      setDocDeleteTarget(null)
      await loadDocs(docsPatient.id)
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not delete document.') })
    } finally {
      setDocDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={eyebrow || access.tenant?.name || 'Organization'}
        title="Customer Master"
        description="Billing patients and their documents for this tenant."
        actions={
          canWrite ? (
            <button
              type="button"
              className={btnPrimary}
              onClick={openCreate}
              disabled={!tenantSlug}
            >
              <FiPlus className="h-4 w-4" aria-hidden />
              Add patient
            </button>
          ) : (
            <span className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600">
              Read only
            </span>
          )
        }
      />

      {tenantSlug ? (
        <StatusBanner type="info" message={`X-Tenant: ${tenantSlug}`} />
      ) : (
        <StatusBanner
          type="warning"
          message="Select or activate a tenant first so X-Tenant can be sent."
        />
      )}
      <StatusBanner type={status.type} message={status.message} />

      <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-end md:p-4">
        <label className="block min-w-0 flex-1 sm:min-w-[12rem]">
          <span className={labelClass}>Search</span>
          <input
            type="search"
            className={fieldClass}
            placeholder="Name, email, phone, ID…"
            aria-label="Search patients"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setSearch(searchInput.trim())
            }}
          />
        </label>
        <label className="block sm:w-36">
          <span className={labelClass}>Gender</span>
          <select
            className={fieldClass}
            aria-label="Filter by gender"
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
          >
            <option value="">All</option>
            {GENDERS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:w-36">
          <span className={labelClass}>Status</span>
          <select
            className={fieldClass}
            aria-label="Filter by active status"
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>
        <label className="block sm:w-36">
          <span className={labelClass}>Pro bono</span>
          <select
            className={fieldClass}
            aria-label="Filter by pro bono"
            value={probonoFilter}
            onChange={(e) => setProbonoFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
        <label className="block sm:w-32">
          <span className={labelClass}>Blood</span>
          <select
            className={fieldClass}
            aria-label="Filter by blood group"
            value={bloodFilter}
            onChange={(e) => setBloodFilter(e.target.value)}
          >
            <option value="">All</option>
            {BLOOD_GROUPS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:w-40">
          <span className={labelClass}>Reg. fees</span>
          <select
            className={fieldClass}
            aria-label="Filter by registration fees"
            value={feesFilter}
            onChange={(e) => setFeesFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="true">Paid</option>
            <option value="false">Unpaid</option>
          </select>
        </label>
        <label className="block sm:w-48">
          <span className={labelClass}>Sort</span>
          <select
            className={fieldClass}
            aria-label="Sort patients"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={btnSecondary}
          onClick={() => setSearch(searchInput.trim())}
          disabled={!tenantSlug}
        >
          Search
        </button>
        {filtering ? (
          <button type="button" className={btnGhost} onClick={clearFilters}>
            Clear filters
          </button>
        ) : null}
      </div>

      <div className={tableWrapClass}>
        {!tenantSlug ? (
          <EmptyState bare title="No tenant selected" hint="Patients load once a tenant is selected." />
        ) : loading ? (
          <LoadingState label="Loading patients…" />
        ) : loadError ? (
          <ErrorState bare message={loadError} onRetry={load} />
        ) : visibleRows.length === 0 ? (
          <EmptyState
            bare
            title={filtering ? 'No matching patients' : 'No patients'}
            hint={
              filtering
                ? 'Try another search or clear filters.'
                : canWrite
                  ? 'Add a patient to get started.'
                  : 'Nothing on file.'
            }
            actionLabel={!filtering && canWrite ? 'Add patient' : undefined}
            onAction={!filtering && canWrite ? openCreate : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  {PATIENT_COLUMNS.map((col) => (
                    <th key={col.id} className="whitespace-nowrap px-3 py-3">
                      {col.label}
                    </th>
                  ))}
                  <th className="sticky right-0 bg-stone-50 px-3 py-3 text-right shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {visibleRows.map((row) => (
                  <tr key={row.id} className="hover:bg-stone-50">
                    {PATIENT_COLUMNS.map((col) => (
                      <Fragment key={col.id}>{renderPatientCell(col.id, row)}</Fragment>
                    ))}
                    <td className="sticky right-0 bg-white px-3 py-3 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)]">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className={btnGhost}
                          onClick={() => openDocs(row)}
                          aria-label={`Documents for ${patientFullName(row)}`}
                        >
                          <FiFileText className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        {canWrite ? (
                          <>
                            <button
                              type="button"
                              className={btnGhost}
                              onClick={() => openEdit(row)}
                              aria-label={`Edit ${patientFullName(row)}`}
                            >
                              <FiEdit2 className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            <button
                              type="button"
                              className={`${btnGhost} text-rose-600 hover:bg-rose-50`}
                              onClick={() => setDeleteTarget(row)}
                              aria-label={`Remove ${patientFullName(row)}`}
                            >
                              <FiTrash2 className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
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
        onClose={closeModal}
        wide
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" form="patient-form" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add patient'}
            </button>
          </div>
        }
      >
        <form id="patient-form" className="space-y-4" onSubmit={handleSave}>
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-stone-400">
              Identity
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="pat-fn">
                  First name <span className="text-rose-600">*</span>
                </label>
                <input
                  id="pat-fn"
                  className={fieldClass}
                  value={form.first_name}
                  onChange={(e) => set('first_name', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pat-ln">
                  Last name <span className="text-rose-600">*</span>
                </label>
                <input
                  id="pat-ln"
                  className={fieldClass}
                  value={form.last_name}
                  onChange={(e) => set('last_name', e.target.value)}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="pat-full">
                  Full name
                </label>
                <input
                  id="pat-full"
                  className={fieldClass}
                  placeholder="Auto from first + last if blank"
                  value={form.full_name}
                  onChange={(e) => set('full_name', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pat-email">
                  Email <span className="text-rose-600">*</span>
                </label>
                <input
                  id="pat-email"
                  type="email"
                  className={fieldClass}
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pat-phone">
                  Phone <span className="text-rose-600">*</span>
                </label>
                <input
                  id="pat-phone"
                  className={fieldClass}
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="pat-address">
                  Address <span className="text-rose-600">*</span>
                </label>
                <textarea
                  id="pat-address"
                  rows={2}
                  className={fieldClass}
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pat-age">
                  Age <span className="text-rose-600">*</span>
                </label>
                <input
                  id="pat-age"
                  type="number"
                  min={0}
                  className={fieldClass}
                  value={form.age}
                  onChange={(e) => set('age', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pat-gender">
                  Gender <span className="text-rose-600">*</span>
                </label>
                <select
                  id="pat-gender"
                  className={fieldClass}
                  value={form.gender}
                  onChange={(e) => set('gender', e.target.value)}
                  required
                >
                  {GENDERS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="pat-blood">
                  Blood group <span className="text-rose-600">*</span>
                </label>
                <select
                  id="pat-blood"
                  className={fieldClass}
                  value={form.blood_group}
                  onChange={(e) => set('blood_group', e.target.value)}
                  required
                >
                  {BLOOD_GROUPS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="pat-lang">
                  Preferred language <span className="text-rose-600">*</span>
                </label>
                <input
                  id="pat-lang"
                  className={fieldClass}
                  value={form.preferred_language}
                  onChange={(e) => set('preferred_language', e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-stone-400">
              Emergency contacts
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="pat-ec">
                  Contact 1 <span className="text-rose-600">*</span>
                </label>
                <input
                  id="pat-ec"
                  className={fieldClass}
                  value={form.emergency_contact}
                  onChange={(e) => set('emergency_contact', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pat-ep">
                  Phone 1 <span className="text-rose-600">*</span>
                </label>
                <input
                  id="pat-ep"
                  className={fieldClass}
                  value={form.emergency_phone}
                  onChange={(e) => set('emergency_phone', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pat-ec2">
                  Contact 2
                </label>
                <input
                  id="pat-ec2"
                  className={fieldClass}
                  value={form.emergency_contact_2}
                  onChange={(e) => set('emergency_contact_2', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pat-ep2">
                  Phone 2
                </label>
                <input
                  id="pat-ep2"
                  className={fieldClass}
                  value={form.emergency_phone_2}
                  onChange={(e) => set('emergency_phone_2', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-stone-400">
              Medical
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="pat-med">
                  Medical conditions
                </label>
                <textarea
                  id="pat-med"
                  rows={2}
                  className={fieldClass}
                  value={form.medical_conditions}
                  onChange={(e) => set('medical_conditions', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pat-all">
                  Allergies
                </label>
                <textarea
                  id="pat-all"
                  rows={2}
                  className={fieldClass}
                  value={form.allergies}
                  onChange={(e) => set('allergies', e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="pat-health">
                  Present health condition
                </label>
                <textarea
                  id="pat-health"
                  rows={2}
                  className={fieldClass}
                  value={form.present_health_condition}
                  onChange={(e) => set('present_health_condition', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-stone-400">
              Background & source
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="pat-edu">
                  Education
                </label>
                <input
                  id="pat-edu"
                  className={fieldClass}
                  value={form.education_qualifications}
                  onChange={(e) => set('education_qualifications', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pat-occ">
                  Earlier occupation
                </label>
                <input
                  id="pat-occ"
                  className={fieldClass}
                  value={form.earlier_occupation}
                  onChange={(e) => set('earlier_occupation', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pat-retire">
                  Year of retirement
                </label>
                <input
                  id="pat-retire"
                  type="number"
                  min={1900}
                  max={2100}
                  className={fieldClass}
                  value={form.year_of_retirement}
                  onChange={(e) => set('year_of_retirement', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pat-aff">
                  Affiliate
                </label>
                <input
                  id="pat-aff"
                  className={fieldClass}
                  value={form.affiliate}
                  onChange={(e) => set('affiliate', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pat-src">
                  Source
                </label>
                <input
                  id="pat-src"
                  className={fieldClass}
                  value={form.source}
                  onChange={(e) => set('source', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pat-ref">
                  Referred by
                </label>
                <input
                  id="pat-ref"
                  className={fieldClass}
                  value={form.referred_by}
                  onChange={(e) => set('referred_by', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-stone-300 text-ink focus:ring-brand-500/30"
                checked={form.is_probono}
                onChange={(e) => set('is_probono', e.target.checked)}
              />
              Pro bono
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-stone-300 text-ink focus:ring-brand-500/30"
                checked={form.is_registration_fees_paid}
                onChange={(e) => set('is_registration_fees_paid', e.target.checked)}
              />
              Registration fees paid
            </label>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(docsPatient)}
        title={`Documents · ${patientFullName(docsPatient || {})}`}
        onClose={closeDocs}
        wide
        footer={
          <div className="flex justify-end">
            <button type="button" className={btnSecondary} onClick={closeDocs}>
              Close
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {canWrite ? (
            <form className="space-y-3 rounded-xl border border-stone-200 p-3" onSubmit={handleUploadDoc}>
              <p className="text-sm font-semibold text-stone-900">Upload document</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="pdoc-title">
                    Title <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="pdoc-title"
                    className={fieldClass}
                    placeholder="e.g. Discharge Summary"
                    value={docForm.title}
                    onChange={(e) => setDocForm((f) => ({ ...f, title: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="pdoc-files">
                    Files <span className="text-rose-600">*</span>
                  </label>
                  <input
                    ref={docFileRef}
                    id="pdoc-files"
                    type="file"
                    multiple
                    className={`${fieldClass} file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-stone-700`}
                    onChange={(e) =>
                      setDocForm((f) => ({ ...f, files: Array.from(e.target.files || []) }))
                    }
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="pdoc-remarks">
                    Remarks <span className="text-rose-600">*</span>
                  </label>
                  <textarea
                    id="pdoc-remarks"
                    rows={2}
                    className={fieldClass}
                    placeholder="e.g. Initial report"
                    value={docForm.remarks}
                    onChange={(e) => setDocForm((f) => ({ ...f, remarks: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className={btnPrimary} disabled={docSaving}>
                  {docSaving ? 'Uploading…' : 'Upload document'}
                </button>
              </div>
            </form>
          ) : null}

          <div className={tableWrapClass}>
            {docsLoading ? (
              <LoadingState label="Loading documents…" />
            ) : docs.length === 0 ? (
              <EmptyState
                bare
                title="No documents yet"
                hint={canWrite ? 'Upload a document for this patient.' : 'Nothing on file.'}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className={tableHeadClass}>
                    <tr>
                      <th className="px-3 py-3">Title</th>
                      <th className="px-3 py-3">Remarks</th>
                      <th className="px-3 py-3">Files</th>
                      {canWrite ? <th className="px-3 py-3 text-right">Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {docs.map((d) => (
                      <tr key={d.id} className="hover:bg-stone-50">
                        <td className="px-3 py-3 font-medium text-stone-900">{d.title || '—'}</td>
                        <td className="px-3 py-3 text-stone-600">{d.remarks || '—'}</td>
                        <td className="px-3 py-3 text-stone-600">
                          {d.file_count ? `${d.file_count}` : '—'}
                        </td>
                        {canWrite ? (
                          <td className="px-3 py-3">
                            <div className="flex justify-end">
                              <button
                                type="button"
                                className={`${btnGhost} text-rose-600 hover:bg-rose-50`}
                                onClick={() => setDocDeleteTarget(d)}
                                aria-label={`Delete ${d.title || 'document'}`}
                              >
                                <FiTrash2 className="h-3.5 w-3.5" />
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
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove patient?"
        message={`${patientFullName(deleteTarget || {})} will be soft-deleted from this tenant.`}
        confirmLabel="Remove"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(docDeleteTarget)}
        title="Delete document?"
        message={`${docDeleteTarget?.title || 'This document'} will be permanently removed.`}
        confirmLabel="Delete"
        loading={docDeleting}
        onConfirm={handleDeleteDoc}
        onClose={() => setDocDeleteTarget(null)}
      />
    </div>
  )
}

export default PatientsPage
