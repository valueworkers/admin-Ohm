import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FiEdit2,
  FiEye,
  FiEyeOff,
  FiFileText,
  FiPlus,
  FiRotateCcw,
  FiSearch,
  FiTrash2,
  FiUpload,
  FiUserX,
} from 'react-icons/fi'
import { fetchServices } from '../api/catalog'
import {
  bulkUploadEmployees,
  createEmployee,
  employeeFullName,
  fetchEmployees,
  revokeEmployeeTermination,
  terminateEmployee,
  updateEmployee,
} from '../api/employees'
import { fetchShifts } from '../api/shifts'
import ShiftsManagerModal from '../components/ShiftsManagerModal'
import ColumnChooser from '../components/ui/ColumnChooser'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import DraggableTh from '../components/ui/DraggableTh'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/PageState'
import { useAccess } from '../hooks/useAccess'
import { useColumnOrder } from '../hooks/useColumnOrder'
import { useColumnVisibility } from '../hooks/useColumnVisibility'
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

const CATEGORIES = ['REGULAR', 'CLINICAL', 'ADMIN', 'CONTRACT']
const ROLES = ['STAFF', 'NURSE', 'CARE_AIDE', 'MANAGER', 'ADMIN']
const STATUSES = ['ACTIVE', 'INACTIVE']
const GENDERS = [
  { value: 'M', label: 'Male' },
  { value: 'F', label: 'Female' },
  { value: 'O', label: 'Other' },
]
const REHIRED = ['NO', 'YES']
const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW']
const TERMINATION_TYPES = ['VOLUNTARY', 'INVOLUNTARY', 'RETIREMENT', 'OTHER']

const EMPTY_SKILL = { service: '', skill: '', priority: '' }

const EMPTY = {
  first_name: '',
  middle_name: '',
  last_name: '',
  email: '',
  mobile_number: '',
  alternate_phone_number: '',
  age: '',
  gender: '',
  city: '',
  address_line1: '',
  address_line2: '',
  emergency_contact_name: '',
  emergency_contact_number: '',
  password: '',
  confirm_password: '',
  role: '',
  category: '',
  status: 'ACTIVE',
  employee_id: '',
  designation: '',
  grade: '',
  cost_center: '',
  department: '',
  shift: '',
  date_joined: '',
  last_working_day: '',
  permanent_address: '',
  current_address: '',
  rehired_status: 'NO',
  target_percent: '',
  qc_required: false,
  pf_applicable: false,
  esi_applicable: false,
  skills: [{ ...EMPTY_SKILL }],
  photo: null,
}

const EMPTY_TERM = {
  termination_type: 'VOLUNTARY',
  reason: '',
  last_working_day: '',
}

const isPhone10 = (v) => /^\d{10}$/.test(String(v || '').trim())
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim())

const EMPLOYEE_COLUMNS = [
  { id: 'employee_id', label: 'Employee ID', defaultOn: true },
  { id: 'name', label: 'Name', defaultOn: true },
  { id: 'email', label: 'Email', defaultOn: true },
  { id: 'mobile', label: 'Mobile', defaultOn: true },
  { id: 'alternate_phone', label: 'Alternate phone', defaultOn: false },
  { id: 'primary_role', label: 'Role', defaultOn: true },
  { id: 'category', label: 'Category', defaultOn: true },
  { id: 'designation', label: 'Designation', defaultOn: true },
  { id: 'department', label: 'Department', defaultOn: true },
  { id: 'grade', label: 'Grade', defaultOn: false },
  { id: 'cost_center', label: 'Cost center', defaultOn: false },
  { id: 'shift', label: 'Shift', defaultOn: true },
  { id: 'city', label: 'City', defaultOn: true },
  { id: 'gender', label: 'Gender', defaultOn: false },
  { id: 'age', label: 'Age', defaultOn: false },
  { id: 'permanent_address', label: 'Permanent address', defaultOn: false },
  { id: 'current_address', label: 'Current address', defaultOn: false },
  { id: 'emergency_name', label: 'Emergency contact', defaultOn: false },
  { id: 'emergency_phone', label: 'Emergency phone', defaultOn: false },
  { id: 'date_joined', label: 'Joined', defaultOn: true },
  { id: 'rehired', label: 'Rehired', defaultOn: false },
  { id: 'pf', label: 'PF', defaultOn: false },
  { id: 'esi', label: 'ESI', defaultOn: false },
  { id: 'termination', label: 'Termination', defaultOn: false },
  { id: 'last_working_day', label: 'Last working day', defaultOn: false },
  { id: 'skills', label: 'Skills', defaultOn: false },
  { id: 'status', label: 'Status', defaultOn: true },
]

const EMPLOYEE_COLUMN_IDS = EMPLOYEE_COLUMNS.map((c) => c.id)
const DEFAULT_VISIBLE = EMPLOYEE_COLUMNS.filter((c) => c.defaultOn).map((c) => c.id)

const shortDate = (v) => {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const genderLabel = (g) =>
  ({ M: 'Male', F: 'Female', O: 'Other' })[String(g || '').toUpperCase()] || g || '—'

const yesNo = (v) => (v ? 'Yes' : 'No')

const cellText = (v) => {
  if (v == null || v === '') return '—'
  return String(v)
}

const renderEmployeeCell = (colId, row) => {
  const p = row.employee_profile || {}
  switch (colId) {
    case 'employee_id':
      return (
        <td key={colId} className="whitespace-nowrap px-3 py-3 font-medium text-stone-900">
          {cellText(p.employee_id || row.id)}
        </td>
      )
    case 'name':
      return (
        <td key={colId} className="whitespace-nowrap px-3 py-3">
          <div className="flex items-center gap-2">
            {row.profile_pic ? (
              <img
                src={row.profile_pic}
                alt=""
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-stone-100 text-xs font-semibold text-stone-500">
                {(row.first_name || 'E').slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="font-semibold text-stone-900">{employeeFullName(row)}</span>
          </div>
        </td>
      )
    case 'email':
      return (
        <td key={colId} className="px-3 py-3 text-stone-600">
          {cellText(row.email)}
        </td>
      )
    case 'mobile':
      return (
        <td key={colId} className="whitespace-nowrap px-3 py-3 text-stone-600">
          {cellText(row.mobile_number)}
        </td>
      )
    case 'alternate_phone':
      return (
        <td key={colId} className="whitespace-nowrap px-3 py-3 text-stone-600">
          {cellText(row.alternate_phone_number)}
        </td>
      )
    case 'primary_role':
      return (
        <td key={colId} className="px-3 py-3 text-stone-600">
          {cellText(row.primary_role || row.role)}
        </td>
      )
    case 'category':
      return (
        <td key={colId} className="px-3 py-3 text-stone-600">
          {cellText(p.category)}
        </td>
      )
    case 'designation':
      return (
        <td key={colId} className="px-3 py-3 text-stone-600">
          {cellText(p.designation)}
        </td>
      )
    case 'department':
      return (
        <td key={colId} className="px-3 py-3 text-stone-600">
          {cellText(p.department)}
        </td>
      )
    case 'grade':
      return (
        <td key={colId} className="px-3 py-3 text-stone-600">
          {cellText(p.grade)}
        </td>
      )
    case 'cost_center':
      return (
        <td key={colId} className="px-3 py-3 text-stone-600">
          {cellText(p.cost_center)}
        </td>
      )
    case 'shift':
      return (
        <td key={colId} className="px-3 py-3 text-stone-600">
          {cellText(p.shift_detail || p.shift_name)}
        </td>
      )
    case 'city':
      return (
        <td key={colId} className="px-3 py-3 text-stone-600">
          {cellText(row.city)}
        </td>
      )
    case 'gender':
      return (
        <td key={colId} className="px-3 py-3 text-stone-600">
          {genderLabel(row.gender)}
        </td>
      )
    case 'age':
      return (
        <td key={colId} className="px-3 py-3 text-stone-600">
          {cellText(row.age)}
        </td>
      )
    case 'permanent_address':
      return (
        <td key={colId} className="max-w-[220px] px-3 py-3 text-stone-600">
          <span className="line-clamp-2">{cellText(row.permanent_address)}</span>
        </td>
      )
    case 'current_address':
      return (
        <td key={colId} className="max-w-[220px] px-3 py-3 text-stone-600">
          <span className="line-clamp-2">{cellText(row.current_address)}</span>
        </td>
      )
    case 'emergency_name':
      return (
        <td key={colId} className="px-3 py-3 text-stone-600">
          {cellText(row.emergency_contact_name)}
        </td>
      )
    case 'emergency_phone':
      return (
        <td key={colId} className="whitespace-nowrap px-3 py-3 text-stone-600">
          {cellText(row.emergency_contact_number)}
        </td>
      )
    case 'date_joined':
      return (
        <td key={colId} className="whitespace-nowrap px-3 py-3 text-stone-600">
          {shortDate(row.date_joined)}
        </td>
      )
    case 'rehired':
      return (
        <td key={colId} className="px-3 py-3 text-stone-600">
          {cellText(p.rehired_status)}
        </td>
      )
    case 'pf':
      return (
        <td key={colId} className="px-3 py-3 text-stone-600">
          {yesNo(p.pf_applicable)}
          {p.pf_number ? ` (${p.pf_number})` : ''}
        </td>
      )
    case 'esi':
      return (
        <td key={colId} className="px-3 py-3 text-stone-600">
          {yesNo(p.esi_applicable)}
          {p.esi_number ? ` (${p.esi_number})` : ''}
        </td>
      )
    case 'termination':
      return (
        <td key={colId} className="px-3 py-3 text-stone-600">
          {p.termination_type
            ? `${p.termination_type}${p.termination_reason ? ` · ${p.termination_reason}` : ''}`
            : '—'}
        </td>
      )
    case 'last_working_day':
      return (
        <td key={colId} className="whitespace-nowrap px-3 py-3 text-stone-600">
          {shortDate(p.last_working_day)}
        </td>
      )
    case 'skills':
      return (
        <td key={colId} className="max-w-[180px] px-3 py-3 text-stone-600">
          <span className="line-clamp-2">
            {(p.skills || []).length
              ? (p.skills || [])
                  .map((s) => (typeof s === 'string' ? s : s.skill || s.name || ''))
                  .filter(Boolean)
                  .join(', ')
              : '—'}
          </span>
        </td>
      )
    case 'status':
      return (
        <td key={colId} className="px-3 py-3">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              row.is_terminated
                ? 'bg-rose-50 text-rose-700'
                : row.is_deleted
                  ? 'bg-stone-200 text-stone-700'
                  : row.is_active
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'bg-stone-100 text-stone-600'
            }`}
          >
            {row.is_terminated
              ? 'Terminated'
              : row.is_deleted
                ? 'Deleted'
                : row.is_active
                  ? 'Active'
                  : 'Inactive'}
          </span>
        </td>
      )
    default:
      return null
  }
}

const EmployeesPage = ({ canWrite: canWriteProp, eyebrow } = {}) => {
  const access = useAccess()
  const canWrite = canWriteProp ?? access.canWrite
  const tenantSlug = resolveCatalogTenantSlug(access.tenant)

  const [rows, setRows] = useState([])
  const [shifts, setShifts] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)
  const [count, setCount] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [hasPrevious, setHasPrevious] = useState(false)
  const [activeFilter, setActiveFilter] = useState('ALL')
  const [status, setStatus] = useState({ type: '', message: '' })
  const [selectedIds, setSelectedIds] = useState([])

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [showPass2, setShowPass2] = useState(false)

  const [termTarget, setTermTarget] = useState(null)
  const [termForm, setTermForm] = useState(EMPTY_TERM)
  const [terminating, setTerminating] = useState(false)

  const [revokeTarget, setRevokeTarget] = useState(null)
  const [revoking, setRevoking] = useState(false)

  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkFile, setBulkFile] = useState(null)
  const [bulkSaving, setBulkSaving] = useState(false)
  const bulkRef = useRef(null)
  const [shiftsOpen, setShiftsOpen] = useState(false)

  const { columnOrder, moveColumn } = useColumnOrder(
    'sc_ops_employees_col_order_v1',
    EMPLOYEE_COLUMN_IDS,
  )
  const { visibleIds, toggleColumn, showAll, showDefault } = useColumnVisibility(
    'sc_ops_employees_visible_cols_v1',
    EMPLOYEE_COLUMN_IDS,
    DEFAULT_VISIBLE,
  )
  const visibleColumns = useMemo(
    () =>
      columnOrder
        .filter((id) => visibleIds.includes(id))
        .map((id) => EMPLOYEE_COLUMNS.find((c) => c.id === id))
        .filter(Boolean),
    [columnOrder, visibleIds],
  )

  const reloadShifts = useCallback(async () => {
    if (!tenantSlug) {
      setShifts([])
      return
    }
    try {
      setShifts(await fetchShifts(tenantSlug))
    } catch {
      setShifts([])
    }
  }, [tenantSlug])

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const setSkill = (index, key, value) =>
    setForm((f) => ({
      ...f,
      skills: f.skills.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    }))

  const addSkill = () => setForm((f) => ({ ...f, skills: [...f.skills, { ...EMPTY_SKILL }] }))

  const removeSkill = (index) =>
    setForm((f) => ({
      ...f,
      skills: f.skills.length <= 1 ? [{ ...EMPTY_SKILL }] : f.skills.filter((_, i) => i !== index),
    }))

  const totalPages = Math.max(1, Math.ceil((count || 0) / pageSize) || 1)

  const load = useCallback(async () => {
    if (!tenantSlug) {
      setRows([])
      setCount(0)
      setHasNext(false)
      setHasPrevious(false)
      setSelectedIds([])
      setLoadError('')
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      const isActive =
        activeFilter === 'ACTIVE' ? 'true' : activeFilter === 'INACTIVE' ? 'false' : undefined
      const data = await fetchEmployees(tenantSlug, {
        search: search || undefined,
        q: search || undefined,
        isActive,
        ordering: 'last_name',
        page,
        pageSize,
      })
      setRows(data.results)
      setCount(data.count)
      setHasNext(Boolean(data.next))
      setHasPrevious(Boolean(data.previous) || page > 1)
      setSelectedIds((prev) =>
        prev.filter((id) => data.results.some((r) => String(r.id) === String(id))),
      )
    } catch (err) {
      setRows([])
      setCount(0)
      setHasNext(false)
      setHasPrevious(false)
      setLoadError(apiErrorMessage(err, 'Could not load employees.'))
    } finally {
      setLoading(false)
    }
  }, [tenantSlug, search, activeFilter, page, pageSize])

  useEffect(() => {
    load()
  }, [load])

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.includes(String(r.id))),
    [rows, selectedIds],
  )
  const selectedTerminated = useMemo(
    () => selectedRows.filter((r) => r.is_terminated),
    [selectedRows],
  )

  const toggleSelect = (id) => {
    const sid = String(id)
    setSelectedIds((prev) => (prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]))
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === rows.length) setSelectedIds([])
    else setSelectedIds(rows.map((r) => String(r.id)))
  }

  const exportValue = (colId, row) => {
    const p = row.employee_profile || {}
    switch (colId) {
      case 'employee_id':
        return p.employee_id || row.id
      case 'name':
        return employeeFullName(row)
      case 'email':
        return row.email || ''
      case 'mobile':
        return row.mobile_number || ''
      case 'alternate_phone':
        return row.alternate_phone_number || ''
      case 'primary_role':
        return row.primary_role || row.role || ''
      case 'category':
        return p.category || ''
      case 'designation':
        return p.designation || ''
      case 'department':
        return p.department || ''
      case 'grade':
        return p.grade || ''
      case 'cost_center':
        return p.cost_center || ''
      case 'shift':
        return p.shift_detail || p.shift_name || ''
      case 'city':
        return row.city || ''
      case 'gender':
        return genderLabel(row.gender)
      case 'age':
        return row.age ?? ''
      case 'permanent_address':
        return row.permanent_address || ''
      case 'current_address':
        return row.current_address || ''
      case 'emergency_name':
        return row.emergency_contact_name || ''
      case 'emergency_phone':
        return row.emergency_contact_number || ''
      case 'date_joined':
        return shortDate(row.date_joined)
      case 'rehired':
        return p.rehired_status || ''
      case 'pf':
        return p.pf_applicable ? `Yes${p.pf_number ? ` (${p.pf_number})` : ''}` : 'No'
      case 'esi':
        return p.esi_applicable ? `Yes${p.esi_number ? ` (${p.esi_number})` : ''}` : 'No'
      case 'termination':
        return p.termination_type || ''
      case 'last_working_day':
        return shortDate(p.last_working_day)
      case 'skills':
        return (p.skills || [])
          .map((s) => (typeof s === 'string' ? s : s.skill || s.name || ''))
          .filter(Boolean)
          .join('; ')
      case 'status':
        return row.is_terminated
          ? 'Terminated'
          : row.is_deleted
            ? 'Deleted'
            : row.is_active
              ? 'Active'
              : 'Inactive'
      default:
        return ''
    }
  }

  const downloadCsv = () => {
    const cols = visibleColumns
    const header = cols.map((c) => c.label)
    const lines = [
      header.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(','),
      ...rows.map((row) =>
        cols
          .map((c) => `"${String(exportValue(c.id, row) ?? '').replace(/"/g, '""')}"`)
          .join(','),
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `employees-${tenantSlug || 'export'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPdf = () => {
    const cols = visibleColumns
    const w = window.open('', '_blank', 'noopener,noreferrer,width=1024,height=768')
    if (!w) {
      setStatus({ type: 'error', message: 'Allow pop-ups to export PDF.' })
      return
    }
    const head = cols.map((c) => `<th>${c.label}</th>`).join('')
    const body = rows
      .map(
        (row) =>
          `<tr>${cols.map((c) => `<td>${String(exportValue(c.id, row) || '—')}</td>`).join('')}</tr>`,
      )
      .join('')
    w.document.write(`<!doctype html><html><head><title>Employees</title>
      <style>
        body{font-family:Segoe UI,system-ui,sans-serif;padding:24px;color:#1e1e2c}
        h1{font-size:18px;margin:0 0 12px}
        table{border-collapse:collapse;width:100%;font-size:11px}
        th,td{border:1px solid #e7e5e4;padding:6px 8px;text-align:left}
        th{background:#fafaf9}
      </style></head><body>
      <h1>Employees${tenantSlug ? ` · ${tenantSlug}` : ''}</h1>
      <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
      </body></html>`)
    w.document.close()
    w.focus()
    w.print()
  }

  const handleBulkRevoke = async () => {
    if (!tenantSlug || !selectedTerminated.length) return
    setRevoking(true)
    try {
      for (const row of selectedTerminated) {
        await revokeEmployeeTermination(tenantSlug, row.id, { rehired: true })
      }
      setStatus({
        type: 'success',
        message: `Revoked termination for ${selectedTerminated.length} employee(s).`,
      })
      setSelectedIds([])
      await load()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not revoke termination.') })
    } finally {
      setRevoking(false)
    }
  }

  useEffect(() => {
    if (!tenantSlug) {
      setShifts([])
      setServices([])
      return undefined
    }
    let alive = true
    reloadShifts()
    fetchServices(tenantSlug)
      .then((list) => {
        if (alive) setServices(list)
      })
      .catch(() => {
        if (alive) setServices([])
      })
    return () => {
      alive = false
    }
  }, [tenantSlug, reloadShifts])

  const closeModal = () => {
    setModalOpen(false)
    setShowPass(false)
    setShowPass2(false)
  }

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setModalOpen(true)
  }

  const openEdit = (row) => {
    const p = row.employee_profile || {}
    const skills = Array.isArray(p.skills) && p.skills.length
      ? p.skills.map((s) =>
          typeof s === 'string'
            ? { service: '', skill: s, priority: '' }
            : {
                service: String(s.service || s.service_id || ''),
                skill: String(s.skill || s.name || ''),
                priority: String(s.priority || ''),
              },
        )
      : [{ ...EMPTY_SKILL }]
    setEditing(row)
    setForm({
      ...EMPTY,
      first_name: row.first_name || '',
      middle_name: row.middle_name || '',
      last_name: row.last_name || '',
      email: row.email || '',
      mobile_number: row.mobile_number || '',
      alternate_phone_number: row.alternate_phone_number || '',
      age: row.age ?? '',
      gender: row.gender || '',
      city: row.city || '',
      address_line1: row.address_line1 || '',
      address_line2: row.address_line2 || '',
      emergency_contact_name: row.emergency_contact_name || '',
      emergency_contact_number: row.emergency_contact_number || '',
      role: row.role || row.primary_role || '',
      category: p.category || '',
      status: row.is_active === false ? 'INACTIVE' : 'ACTIVE',
      employee_id: p.employee_id || '',
      designation: p.designation || '',
      grade: p.grade || '',
      cost_center: p.cost_center || '',
      department: p.department || '',
      shift: p.shift || '',
      date_joined: String(row.date_joined || '').slice(0, 10),
      last_working_day: String(p.last_working_day || '').slice(0, 10),
      permanent_address: row.permanent_address || '',
      current_address: row.current_address || '',
      rehired_status: p.rehired_status || 'NO',
      target_percent: p.target_percent ?? '',
      qc_required: Boolean(p.qc_required),
      pf_applicable: Boolean(p.pf_applicable),
      esi_applicable: Boolean(p.esi_applicable),
      skills,
    })
    setModalOpen(true)
  }

  const validateForm = () => {
    if (!form.first_name.trim()) return 'First name is required.'
    if (!form.last_name.trim()) return 'Last name is required.'
    if (!editing) {
      if (!form.email.trim() || !isEmail(form.email)) return 'Valid email is required.'
      if (!form.password) return 'Password is required.'
      if (form.password !== form.confirm_password) return 'Passwords do not match.'
    }
    if (!isPhone10(form.mobile_number)) return 'Mobile must be a 10-digit number.'
    if (!isPhone10(form.alternate_phone_number)) {
      return 'Alternate phone must be a 10-digit number.'
    }
    if (!form.emergency_contact_name.trim()) return 'Emergency contact name is required.'
    if (!isPhone10(form.emergency_contact_number)) {
      return 'Emergency contact number must be a 10-digit number.'
    }
    if (!form.gender) return 'Gender is required.'
    if (!form.city.trim()) return 'Base location / city is required.'
    if (!form.address_line1.trim()) return 'Address line 1 is required.'
    if (!form.permanent_address.trim()) return 'Permanent address is required.'
    if (!form.current_address.trim()) return 'Current address is required.'
    if (!form.role) return 'User role is required.'
    if (!form.category) return 'Category is required.'
    if (!form.status) return 'Status is required.'
    if (!editing && !form.employee_id.trim()) return 'Employee ID is required.'
    if (!form.designation.trim()) return 'Designation is required.'
    if (!form.department.trim()) return 'Department is required.'
    if (!editing && !form.shift) return 'Shift is required.'
    return ''
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!tenantSlug) return
    const errMsg = validateForm()
    if (errMsg) {
      setStatus({ type: 'error', message: errMsg })
      return
    }
    setSaving(true)
    try {
      if (editing) await updateEmployee(tenantSlug, editing.id, form)
      else await createEmployee(tenantSlug, form)
      setStatus({
        type: 'success',
        message: editing ? 'Employee updated.' : 'Employee created.',
      })
      closeModal()
      await load()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not save employee.') })
    } finally {
      setSaving(false)
    }
  }

  const handleTerminate = async (e) => {
    e.preventDefault()
    if (!tenantSlug || !termTarget) return
    if (!termForm.termination_type || !termForm.reason.trim() || !termForm.last_working_day) {
      setStatus({
        type: 'error',
        message: 'Termination type, reason, and last working day are required.',
      })
      return
    }
    setTerminating(true)
    try {
      await terminateEmployee(tenantSlug, termTarget.id, termForm)
      setStatus({ type: 'success', message: 'Employee terminated.' })
      setTermTarget(null)
      await load()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not terminate employee.') })
    } finally {
      setTerminating(false)
    }
  }

  const handleRevoke = async () => {
    if (!tenantSlug || !revokeTarget) return
    setRevoking(true)
    try {
      await revokeEmployeeTermination(tenantSlug, revokeTarget.id, { rehired: true })
      setStatus({ type: 'success', message: 'Termination revoked (rehired).' })
      setRevokeTarget(null)
      await load()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not revoke termination.') })
    } finally {
      setRevoking(false)
    }
  }

  const handleBulk = async (e) => {
    e.preventDefault()
    if (!tenantSlug) return
    if (!bulkFile) {
      setStatus({ type: 'error', message: 'Choose an .xlsx or .xlsm file.' })
      return
    }
    setBulkSaving(true)
    try {
      const result = await bulkUploadEmployees(tenantSlug, bulkFile)
      const created = result?.created ?? result?.success_count
      setStatus({
        type: 'success',
        message:
          created != null ? `Bulk upload finished (${created} created).` : 'Bulk upload finished.',
      })
      setBulkOpen(false)
      setBulkFile(null)
      await load()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Bulk upload failed.') })
    } finally {
      setBulkSaving(false)
    }
  }

  const shiftOptions =
    form.shift && !shifts.some((s) => String(s.id) === String(form.shift))
      ? [...shifts, { id: form.shift, name: `Shift #${form.shift}` }]
      : shifts

  const roleOptions = form.role && !ROLES.includes(form.role) ? [form.role, ...ROLES] : ROLES
  const categoryOptions =
    form.category && !CATEGORIES.includes(form.category)
      ? [form.category, ...CATEGORIES]
      : CATEGORIES

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={eyebrow || access.tenant?.name || 'Organization'}
        title="Employee Master"
        description="Tenant staff accounts."
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

      <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          {canWrite ? (
            <button
              type="button"
              className={btnPrimary}
              onClick={openCreate}
              disabled={!tenantSlug}
            >
              <FiPlus className="h-4 w-4" aria-hidden />
              Add employee
            </button>
          ) : null}
          {canWrite ? (
            <button
              type="button"
              className={btnSecondary}
              onClick={() => {
                setBulkFile(null)
                setBulkOpen(true)
              }}
              disabled={!tenantSlug}
            >
              <FiUpload className="h-4 w-4" aria-hidden />
              Bulk upload
            </button>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:min-w-[240px]">
            <input
              className={`${fieldClass} min-w-0 flex-1 sm:max-w-xs`}
              placeholder="Search employees by name, ID, or city…"
              aria-label="Search employees"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1)
                  setSearch(searchInput.trim())
                }
              }}
            />
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                setPage(1)
                setSearch(searchInput.trim())
              }}
              disabled={!tenantSlug}
            >
              <FiSearch className="h-4 w-4" aria-hidden />
              Search
            </button>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-stone-600">
            <span className="whitespace-nowrap">Rows</span>
            <select
              className={`${fieldClass} w-auto min-w-[72px]`}
              value={pageSize}
              onChange={(e) => {
                setPage(1)
                setPageSize(Number(e.target.value) || 20)
              }}
              aria-label="Rows per page"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <select
            className={`${fieldClass} w-auto min-w-[120px]`}
            value={activeFilter}
            onChange={(e) => {
              setPage(1)
              setActiveFilter(e.target.value)
            }}
            aria-label="Filter employees"
          >
            <option value="ALL">All</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <button
            type="button"
            className={btnPrimary}
            onClick={exportPdf}
            disabled={!rows.length}
          >
            <FiFileText className="h-4 w-4" aria-hidden />
            Export PDF
          </button>
          <button
            type="button"
            className="sc-btn inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/35 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0"
            onClick={downloadCsv}
            disabled={!rows.length}
          >
            Export Excel
          </button>
          <ColumnChooser
            columns={EMPLOYEE_COLUMNS}
            visibleIds={visibleIds}
            onToggle={(id) => toggleColumn(id, { minVisible: 2 })}
            onShowAll={showAll}
            onShowDefault={showDefault}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
          <button
            type="button"
            className={btnSecondary}
            onClick={() => setShiftsOpen(true)}
            disabled={!tenantSlug}
          >
            Shifts
          </button>
          <button
            type="button"
            className={btnSecondary}
            disabled
            title="Select employees to assign (coming soon)"
          >
            Assign selected
          </button>
          <button
            type="button"
            className={btnSecondary}
            disabled={!canWrite || !selectedTerminated.length || revoking}
            onClick={handleBulkRevoke}
            title={
              selectedTerminated.length
                ? `Revoke termination for ${selectedTerminated.length} selected`
                : 'Select terminated employees first'
            }
          >
            <FiRotateCcw className="h-4 w-4" aria-hidden />
            {revoking ? 'Working…' : 'Revoke termination'}
          </button>
        </div>
      </div>

      <div className={tableWrapClass}>
        {!tenantSlug ? (
          <EmptyState bare title="No tenant selected" hint="Employees load once a tenant is selected." />
        ) : loading ? (
          <LoadingState label="Loading employees…" />
        ) : loadError ? (
          <ErrorState bare message={loadError} onRetry={load} />
        ) : rows.length === 0 ? (
          <EmptyState
            bare
            title="No employees"
            hint={canWrite ? 'Add a staff member or bulk-upload an Excel file.' : 'Nothing on file.'}
            actionLabel={canWrite ? 'Add employee' : undefined}
            onAction={canWrite ? openCreate : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-3 py-3">
                    <input
                      type="checkbox"
                      className="rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                      checked={rows.length > 0 && selectedIds.length === rows.length}
                      onChange={toggleSelectAll}
                      aria-label="Select all employees"
                    />
                  </th>
                  {visibleColumns.map((col) => (
                    <DraggableTh
                      key={col.id}
                      id={col.id}
                      onReorder={moveColumn}
                      className="whitespace-nowrap px-3 py-3"
                    >
                      {col.label}
                    </DraggableTh>
                  ))}
                  {canWrite ? <th className="px-3 py-3 text-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-stone-50">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        className="rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                        checked={selectedIds.includes(String(row.id))}
                        onChange={() => toggleSelect(row.id)}
                        aria-label={`Select ${employeeFullName(row)}`}
                      />
                    </td>
                    {visibleColumns.map((col) => renderEmployeeCell(col.id, row))}
                    {canWrite ? (
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            className={btnGhost}
                            onClick={() => openEdit(row)}
                            aria-label={`Edit ${employeeFullName(row)}`}
                          >
                            <FiEdit2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          {row.is_terminated ? (
                            <button
                              type="button"
                              className={btnGhost}
                              onClick={() => setRevokeTarget(row)}
                              aria-label={`Revoke termination for ${employeeFullName(row)}`}
                            >
                              <FiRotateCcw className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={`${btnGhost} text-rose-600 hover:bg-rose-50`}
                              onClick={() => {
                                setTermForm({
                                  ...EMPTY_TERM,
                                  last_working_day: new Date().toISOString().slice(0, 10),
                                })
                                setTermTarget(row)
                              }}
                              aria-label={`Terminate ${employeeFullName(row)}`}
                            >
                              <FiUserX className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          )}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 px-4 py-3 text-sm text-stone-600">
              <span>
                {count} employee{count === 1 ? '' : 's'} · page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={!hasPrevious || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={!hasNext || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit employee' : 'Add new employee'}
        onClose={closeModal}
        xl
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" form="employee-form" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add employee'}
            </button>
          </div>
        }
      >
          <form id="employee-form" className="space-y-4" onSubmit={handleSave}>
            <section className="space-y-3 rounded-xl border border-stone-200 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">
                Basic details
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                    Middle name <span className="font-normal text-stone-400">(optional)</span>
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
                    Last name <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="emp-ln"
                    className={fieldClass}
                    value={form.last_name}
                    onChange={(e) => set('last_name', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="emp-email">
                    Email <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="emp-email"
                    type="email"
                    className={fieldClass}
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    required={!editing}
                    disabled={Boolean(editing)}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="emp-mobile">
                    Mobile <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="emp-mobile"
                    className={fieldClass}
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="10-digit number"
                    value={form.mobile_number}
                    onChange={(e) => set('mobile_number', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="emp-alt">
                    Alternate phone <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="emp-alt"
                    className={fieldClass}
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="10-digit number"
                    value={form.alternate_phone_number}
                    onChange={(e) =>
                      set('alternate_phone_number', e.target.value.replace(/\D/g, '').slice(0, 10))
                    }
                    required
                  />
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
                  <label className={labelClass} htmlFor="emp-gender">
                    Gender <span className="text-rose-600">*</span>
                  </label>
                  <select
                    id="emp-gender"
                    className={fieldClass}
                    value={form.gender}
                    onChange={(e) => set('gender', e.target.value)}
                    required
                  >
                    <option value="">Select gender</option>
                    {GENDERS.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="emp-city">
                    Base location <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="emp-city"
                    className={fieldClass}
                    value={form.city}
                    onChange={(e) => set('city', e.target.value)}
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="emp-a1">
                    Address line 1 <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="emp-a1"
                    className={fieldClass}
                    value={form.address_line1}
                    onChange={(e) => set('address_line1', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="emp-a2">
                    Address line 2 <span className="font-normal text-stone-400">(optional)</span>
                  </label>
                  <input
                    id="emp-a2"
                    className={fieldClass}
                    value={form.address_line2}
                    onChange={(e) => set('address_line2', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="emp-ec">
                    Emergency contact name <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="emp-ec"
                    className={fieldClass}
                    value={form.emergency_contact_name}
                    onChange={(e) => set('emergency_contact_name', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="emp-ecn">
                    Emergency contact number <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="emp-ecn"
                    className={fieldClass}
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="10-digit number"
                    value={form.emergency_contact_number}
                    onChange={(e) =>
                      set('emergency_contact_number', e.target.value.replace(/\D/g, '').slice(0, 10))
                    }
                    required
                  />
                </div>
                {!editing ? (
                  <>
                    <div>
                      <label className={labelClass} htmlFor="emp-pass">
                        Password <span className="text-rose-600">*</span>
                      </label>
                      <div className="relative">
                        <input
                          id="emp-pass"
                          type={showPass ? 'text' : 'password'}
                          className={`${fieldClass} pr-10`}
                          value={form.password}
                          onChange={(e) => set('password', e.target.value)}
                          required
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-stone-400 hover:text-stone-700"
                          onClick={() => setShowPass((v) => !v)}
                          aria-label={showPass ? 'Hide password' : 'Show password'}
                        >
                          {showPass ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="emp-pass2">
                        Confirm password <span className="text-rose-600">*</span>
                      </label>
                      <div className="relative">
                        <input
                          id="emp-pass2"
                          type={showPass2 ? 'text' : 'password'}
                          className={`${fieldClass} pr-10`}
                          value={form.confirm_password}
                          onChange={(e) => set('confirm_password', e.target.value)}
                          required
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-stone-400 hover:text-stone-700"
                          onClick={() => setShowPass2((v) => !v)}
                          aria-label={showPass2 ? 'Hide password' : 'Show password'}
                        >
                          {showPass2 ? (
                            <FiEyeOff className="h-4 w-4" />
                          ) : (
                            <FiEye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-stone-200 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">
                Employee profile
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className={labelClass} htmlFor="emp-role">
                    User role <span className="text-rose-600">*</span>
                  </label>
                  <select
                    id="emp-role"
                    className={fieldClass}
                    value={form.role}
                    onChange={(e) => set('role', e.target.value)}
                    required
                  >
                    <option value="">Select user role</option>
                    {roleOptions.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="emp-cat">
                    Category <span className="text-rose-600">*</span>
                  </label>
                  <select
                    id="emp-cat"
                    className={fieldClass}
                    value={form.category}
                    onChange={(e) => set('category', e.target.value)}
                    required
                  >
                    <option value="">Select category</option>
                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="emp-status">
                    Status <span className="text-rose-600">*</span>
                  </label>
                  <select
                    id="emp-status"
                    className={fieldClass}
                    value={form.status}
                    onChange={(e) => set('status', e.target.value)}
                    required
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="emp-code">
                    Employee ID {!editing ? <span className="text-rose-600">*</span> : null}
                  </label>
                  <input
                    id="emp-code"
                    className={fieldClass}
                    value={form.employee_id}
                    onChange={(e) => set('employee_id', e.target.value)}
                    required={!editing}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="emp-desig">
                    Designation <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="emp-desig"
                    className={fieldClass}
                    value={form.designation}
                    onChange={(e) => set('designation', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="emp-grade">
                    Grade
                  </label>
                  <input
                    id="emp-grade"
                    className={fieldClass}
                    value={form.grade}
                    onChange={(e) => set('grade', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="emp-cc">
                    Cost center
                  </label>
                  <input
                    id="emp-cc"
                    className={fieldClass}
                    value={form.cost_center}
                    onChange={(e) => set('cost_center', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="emp-dept">
                    Department <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="emp-dept"
                    className={fieldClass}
                    value={form.department}
                    onChange={(e) => set('department', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="emp-shift">
                    Shift {!editing ? <span className="text-rose-600">*</span> : null}
                  </label>
                  <select
                    id="emp-shift"
                    className={fieldClass}
                    value={form.shift}
                    onChange={(e) => set('shift', e.target.value)}
                    required={!editing}
                  >
                    <option value="">Select shift</option>
                    {shiftOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.start_hhmm || s.start_time
                          ? ` (${String(s.start_hhmm || s.start_time).slice(0, 5)}–${String(s.end_hhmm || s.end_time).slice(0, 5)})`
                          : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-stone-500">
                    Loaded from GET /api/shifts/. Manage via the Shifts button.
                  </p>
                </div>
                <div>
                  <label className={labelClass} htmlFor="emp-joined">
                    Joining date
                  </label>
                  <input
                    id="emp-joined"
                    type="date"
                    className={fieldClass}
                    value={form.date_joined}
                    onChange={(e) => set('date_joined', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="emp-lwd">
                    Last working day
                  </label>
                  <input
                    id="emp-lwd"
                    type="date"
                    className={fieldClass}
                    value={form.last_working_day}
                    onChange={(e) => set('last_working_day', e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className={labelClass} htmlFor="emp-paddr">
                    Permanent address <span className="text-rose-600">*</span>
                  </label>
                  <textarea
                    id="emp-paddr"
                    rows={2}
                    className={fieldClass}
                    value={form.permanent_address}
                    onChange={(e) => set('permanent_address', e.target.value)}
                    required
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className={labelClass} htmlFor="emp-caddr">
                    Current address <span className="text-rose-600">*</span>
                  </label>
                  <textarea
                    id="emp-caddr"
                    rows={2}
                    className={fieldClass}
                    value={form.current_address}
                    onChange={(e) => set('current_address', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="emp-rehire">
                    Rehired status
                  </label>
                  <select
                    id="emp-rehire"
                    className={fieldClass}
                    value={form.rehired_status}
                    onChange={(e) => set('rehired_status', e.target.value)}
                  >
                    {REHIRED.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="emp-target">
                    Target %
                  </label>
                  <input
                    id="emp-target"
                    className={fieldClass}
                    placeholder="Target percent"
                    value={form.target_percent}
                    onChange={(e) => set('target_percent', e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-end gap-4 pb-2 text-sm text-stone-700">
                  {[
                    ['qc_required', 'QC required'],
                    ['pf_applicable', 'PF applicable'],
                    ['esi_applicable', 'ESI applicable'],
                  ].map(([key, label]) => (
                    <label key={key} className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                        checked={Boolean(form[key])}
                        onChange={(e) => set(key, e.target.checked)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-stone-200 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">Skills</p>
              <p className="text-xs font-medium text-stone-600">Top skill</p>
              {form.skills.map((row, index) => (
                <div key={`skill-${index}`} className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className={labelClass} htmlFor={`skill-svc-${index}`}>
                      Service
                    </label>
                    <select
                      id={`skill-svc-${index}`}
                      className={fieldClass}
                      value={row.service}
                      onChange={(e) => setSkill(index, 'service', e.target.value)}
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
                    <label className={labelClass} htmlFor={`skill-name-${index}`}>
                      Skill
                    </label>
                    <input
                      id={`skill-name-${index}`}
                      className={fieldClass}
                      placeholder={row.service ? 'Skill name' : 'Select service first'}
                      value={row.skill}
                      onChange={(e) => setSkill(index, 'skill', e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <label className={labelClass} htmlFor={`skill-pri-${index}`}>
                        Priority
                      </label>
                      <select
                        id={`skill-pri-${index}`}
                        className={fieldClass}
                        value={row.priority}
                        onChange={(e) => setSkill(index, 'priority', e.target.value)}
                      >
                        <option value="">Select priority</option>
                        {PRIORITIES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                    {form.skills.length > 1 ? (
                      <button
                        type="button"
                        className={`${btnGhost} mt-6 text-rose-600`}
                        onClick={() => removeSkill(index)}
                        aria-label="Remove skill"
                      >
                        <FiTrash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              <button type="button" className={btnSecondary} onClick={addSkill}>
                <FiPlus className="h-4 w-4" aria-hidden />
                Add new skill
              </button>
              <div>
                <label className={labelClass} htmlFor="emp-photo">
                  Photo <span className="font-normal text-stone-400">(optional)</span>
                </label>
                <input
                  id="emp-photo"
                  type="file"
                  accept="image/*"
                  className={`${fieldClass} file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-stone-700`}
                  onChange={(e) => set('photo', e.target.files?.[0] || null)}
                />
              </div>
            </section>
          </form>
      </Modal>

      <Modal
        open={Boolean(termTarget)}
        title="Terminate employee"
        onClose={() => setTermTarget(null)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setTermTarget(null)}>
              Cancel
            </button>
            <button type="submit" form="terminate-form" className={btnPrimary} disabled={terminating}>
              {terminating ? 'Working…' : 'Terminate'}
            </button>
          </div>
        }
      >
        <form id="terminate-form" className="space-y-3" onSubmit={handleTerminate}>
          <p className="text-sm text-stone-600">
            Terminate <strong>{employeeFullName(termTarget || {})}</strong>.
          </p>
          <div>
            <label className={labelClass} htmlFor="term-type">
              Termination type <span className="text-rose-600">*</span>
            </label>
            <select
              id="term-type"
              className={fieldClass}
              value={termForm.termination_type}
              onChange={(e) => setTermForm((f) => ({ ...f, termination_type: e.target.value }))}
              required
            >
              {TERMINATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="term-reason">
              Reason <span className="text-rose-600">*</span>
            </label>
            <textarea
              id="term-reason"
              rows={3}
              className={fieldClass}
              value={termForm.reason}
              onChange={(e) => setTermForm((f) => ({ ...f, reason: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="term-lwd">
              Last working day <span className="text-rose-600">*</span>
            </label>
            <input
              id="term-lwd"
              type="date"
              className={fieldClass}
              value={termForm.last_working_day}
              onChange={(e) => setTermForm((f) => ({ ...f, last_working_day: e.target.value }))}
              required
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={bulkOpen}
        title="Bulk employee upload"
        onClose={() => setBulkOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setBulkOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="bulk-form" className={btnPrimary} disabled={bulkSaving}>
              {bulkSaving ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        }
      >
        <form id="bulk-form" className="space-y-3" onSubmit={handleBulk}>
          <p className="text-sm text-stone-600">
            Upload an <strong>.xlsx</strong> or <strong>.xlsm</strong> file (max 10 MB, up to 1,000
            employees).
          </p>
          <div>
            <label className={labelClass} htmlFor="bulk-file">
              Excel file <span className="text-rose-600">*</span>
            </label>
            <input
              ref={bulkRef}
              id="bulk-file"
              type="file"
              accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"
              className={`${fieldClass} file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-stone-700`}
              onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
              required
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title="Revoke termination?"
        message={`${employeeFullName(revokeTarget || {})} will be marked rehired.`}
        confirmLabel="Revoke & rehire"
        loading={revoking}
        onConfirm={handleRevoke}
        onClose={() => setRevokeTarget(null)}
      />

      <ShiftsManagerModal
        open={shiftsOpen}
        tenantSlug={tenantSlug}
        canWrite={canWrite}
        onClose={() => setShiftsOpen(false)}
        onChanged={reloadShifts}
      />
    </div>
  )
}

export default EmployeesPage
