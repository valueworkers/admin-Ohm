import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FiDownload,
  FiEdit2,
  FiLoader,
  FiPlus,
  FiSearch,
  FiTrash2,
} from 'react-icons/fi'
import {
  createSalaryStructure,
  createSalaryTransaction,
  deleteSalaryStructure,
  fetchEmployeePayroll,
  fetchSalaryReportById,
  fetchSalaryStructures,
  updateSalaryStructure,
} from '../api/payroll'
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
} from '../utils/ui'

const PAGE_SIZES = [10, 20, 50, 100]
const CATEGORIES = ['REGULAR', 'CLINICAL', 'ADMIN', 'CONTRACT']
const STATUS_FILTERS = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
]
const ORDERING_OPTIONS = [
  { value: 'first_name', label: 'Name A–Z' },
  { value: '-first_name', label: 'Name Z–A' },
  { value: 'employee_id', label: 'Emp ID A–Z' },
  { value: '-employee_id', label: 'Emp ID Z–A' },
  { value: 'basic_salary', label: 'Basic (low→high)' },
  { value: '-basic_salary', label: 'Basic (high→low)' },
  { value: 'recent_payment', label: 'Recent pay (low→high)' },
  { value: '-recent_payment', label: 'Recent pay (high→low)' },
]

const PAYROLL_COLUMNS = [
  { id: 'name', label: 'Employee name' },
  { id: 'empId', label: 'Emp. ID' },
  { id: 'email', label: 'Email' },
  { id: 'mobile', label: 'Mobile' },
  { id: 'category', label: 'Category' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'basic', label: 'Basic' },
  { id: 'pf', label: 'PF' },
  { id: 'esi', label: 'ESI' },
  { id: 'recentPayment', label: 'Recent payment' },
  { id: 'payoutMode', label: 'Payout mode' },
  { id: 'effectiveDate', label: 'Effective date' },
  { id: 'payoutHistory', label: 'Payout history' },
]

const PAYROLL_COLUMN_IDS = PAYROLL_COLUMNS.map((c) => c.id)

const SALARY_TYPES = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'FORTNIGHTLY', label: 'Fortnightly' },
  { value: 'HOURLY', label: 'Hourly' },
]

const CHANGE_TYPES = [
  { value: 'BASE_SALARY', label: 'Base Salary' },
  { value: 'INCREMENT', label: 'Increment' },
  { value: 'ADVANCE', label: 'Advance' },
  { value: 'LOAN', label: 'Loan' },
]

const PAYMENT_METHODS = [
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CHEQUE', label: 'Cheque' },
]

const PERIODS = [
  { value: 6, label: '6 Months Including Current Month' },
  { value: 12, label: '1 Year Including Current Month' },
]

const emptyStructureForm = () => ({
  salaryType: 'MONTHLY',
  changeType: 'INCREMENT',
  amount: '',
  pfAmount: '0.00',
  esiAmount: '0.00',
  effectiveFrom: new Date().toISOString().slice(0, 10),
})

const money = (value) => {
  if (value == null || value === '') return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const formatDate = (value) => {
  if (!value) return '—'
  const raw = String(value).trim()
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`
  return raw
}

const formatDateTime = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatLabel = (value) => {
  if (!value) return '—'
  return String(value).replace(/_/g, ' ')
}

const monthLabel = (monthKey) => {
  if (!monthKey) return '—'
  const d = new Date(`${monthKey}-01T00:00:00`)
  if (Number.isNaN(d.getTime())) return monthKey
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

const periodRange = (months) => {
  const end = new Date()
  const start = new Date(end.getFullYear(), end.getMonth() - (months - 1), 1)
  const pad = (n) => String(n).padStart(2, '0')
  return {
    startDate: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`,
    endDate: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(
      new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate(),
    )}`,
  }
}

const downloadCsv = (filename, headers, rows) => {
  const esc = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const body = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n')
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const PayrollPage = () => {
  const access = useAccess()
  const canWrite = access.canWrite
  const tenantSlug = resolveCatalogTenantSlug(access.tenant)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [status, setStatus] = useState({ type: '', message: '' })
  const [search, setSearch] = useState('')
  const [searchApplied, setSearchApplied] = useState('')
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)
  const [count, setCount] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [hasPrevious, setHasPrevious] = useState(false)
  const [statusFilter, setStatusFilter] = useState('ACTIVE')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [ordering, setOrdering] = useState('first_name')

  const [history, setHistory] = useState({
    open: false,
    employee: null,
    rows: [],
    loading: false,
    error: '',
  })

  const [structureModal, setStructureModal] = useState({
    open: false,
    mode: 'add',
    employee: null,
    form: emptyStructureForm(),
    structureId: null,
    saving: false,
    error: '',
  })

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const { columnOrder, moveColumn } = useColumnOrder(
    'sc_ops_payroll_col_order_v1',
    PAYROLL_COLUMN_IDS,
  )
  const { visibleIds, toggleColumn, showAll, showDefault } = useColumnVisibility(
    'sc_ops_payroll_col_visible_v1',
    PAYROLL_COLUMN_IDS,
  )
  const visibleColumns = useMemo(
    () =>
      columnOrder
        .filter((id) => visibleIds.includes(id))
        .map((id) => PAYROLL_COLUMNS.find((c) => c.id === id))
        .filter(Boolean),
    [columnOrder, visibleIds],
  )

  const [payout, setPayout] = useState({
    open: false,
    employee: null,
    months: 6,
    rows: [],
    loading: false,
    error: '',
    selected: {},
  })

  const [payModal, setPayModal] = useState({
    open: false,
    report: null,
    amount: '',
    method: 'BANK_TRANSFER',
    saving: false,
    error: '',
  })

  const totalPages = Math.max(1, Math.ceil((count || 0) / pageSize) || 1)

  const load = useCallback(async () => {
    if (!tenantSlug) {
      setRows([])
      setCount(0)
      setHasNext(false)
      setHasPrevious(false)
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      const isActive =
        statusFilter === 'ACTIVE' ? true : statusFilter === 'INACTIVE' ? false : undefined
      const data = await fetchEmployeePayroll(tenantSlug, {
        page,
        pageSize,
        search: searchApplied,
        ordering,
        isActive,
        category: categoryFilter || undefined,
      })
      let list = data.results
      if (statusFilter === 'ACTIVE') list = list.filter((r) => r.isActive !== false)
      if (statusFilter === 'INACTIVE') list = list.filter((r) => r.isActive === false)
      if (categoryFilter) {
        list = list.filter(
          (r) => String(r.category || '').toUpperCase() === categoryFilter.toUpperCase(),
        )
      }
      setRows(list)
      setCount(statusFilter === 'ALL' && !categoryFilter ? data.count : list.length || data.count)
      setHasNext(Boolean(data.next))
      setHasPrevious(Boolean(data.previous) || page > 1)
    } catch (err) {
      setRows([])
      setCount(0)
      setHasNext(false)
      setHasPrevious(false)
      setLoadError(apiErrorMessage(err, 'Could not load employee payroll.'))
    } finally {
      setLoading(false)
    }
  }, [tenantSlug, page, pageSize, searchApplied, statusFilter, categoryFilter, ordering])

  useEffect(() => {
    load()
  }, [load])

  const runSearch = () => {
    setPage(1)
    setSearchApplied(search.trim())
  }

  const payrollExportRaw = (colId, r) => {
    switch (colId) {
      case 'name':
        return r.name
      case 'empId':
        return r.employeeId
      case 'email':
        return r.email
      case 'mobile':
        return r.mobile
      case 'category':
        return r.category
      case 'vendor':
        return r.vendorName
      case 'basic':
        return r.basicSalary ?? ''
      case 'pf':
        return r.pfAmount ?? ''
      case 'esi':
        return r.esiAmount ?? ''
      case 'recentPayment':
        return r.recentPayment ?? ''
      case 'payoutMode':
        return formatLabel(r.payoutMode)
      case 'effectiveDate':
        return formatDate(r.effectiveDate)
      case 'payoutHistory':
        return 'Payroll History'
      default:
        return ''
    }
  }

  const renderPayrollCell = (colId, row) => {
    switch (colId) {
      case 'name':
        return (
          <td
            key={colId}
            className="max-w-[9rem] truncate px-2 py-1.5 align-middle font-semibold uppercase tracking-wide text-stone-900"
          >
            {row.name}
          </td>
        )
      case 'empId':
        return (
          <td key={colId} className="whitespace-nowrap px-2 py-1.5 align-middle text-stone-600">
            {row.employeeId || '—'}
          </td>
        )
      case 'email':
        return (
          <td key={colId} className="max-w-[11rem] truncate px-2 py-1.5 align-middle">
            {row.email ? (
              <a className="text-sky-600 hover:underline" href={`mailto:${row.email}`}>
                {row.email}
              </a>
            ) : (
              '—'
            )}
          </td>
        )
      case 'mobile':
        return (
          <td key={colId} className="whitespace-nowrap px-2 py-1.5 align-middle text-stone-600">
            {row.mobile || '—'}
          </td>
        )
      case 'category':
        return (
          <td key={colId} className="px-2 py-1.5 align-middle text-stone-600">
            {row.category || '—'}
          </td>
        )
      case 'vendor':
        return (
          <td key={colId} className="px-2 py-1.5 align-middle text-stone-600">
            {row.vendorName || '—'}
          </td>
        )
      case 'basic':
        return (
          <td key={colId} className="whitespace-nowrap px-2 py-1.5 align-middle tabular-nums text-stone-800">
            {money(row.basicSalary)}
          </td>
        )
      case 'pf':
        return (
          <td key={colId} className="whitespace-nowrap px-2 py-1.5 align-middle tabular-nums text-stone-800">
            {money(row.pfAmount)}
          </td>
        )
      case 'esi':
        return (
          <td key={colId} className="whitespace-nowrap px-2 py-1.5 align-middle tabular-nums text-stone-800">
            {money(row.esiAmount)}
          </td>
        )
      case 'recentPayment':
        return (
          <td key={colId} className="whitespace-nowrap px-2 py-1.5 align-middle tabular-nums text-stone-800">
            {money(row.recentPayment)}
          </td>
        )
      case 'payoutMode':
        return (
          <td key={colId} className="whitespace-nowrap px-2 py-1.5 align-middle text-stone-600">
            {formatLabel(row.payoutMode)}
          </td>
        )
      case 'effectiveDate':
        return (
          <td key={colId} className="whitespace-nowrap px-2 py-1.5 align-middle text-stone-600">
            {formatDate(row.effectiveDate)}
          </td>
        )
      case 'payoutHistory':
        return (
          <td key={colId} className="px-2 py-1.5 align-middle">
            <button
              type="button"
              className="inline-flex w-full items-center justify-center rounded border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 transition-colors hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30"
              onClick={() => loadPayout(row, 6)}
            >
              Payroll History
            </button>
          </td>
        )
      default:
        return null
    }
  }

  const exportOverview = () => {
    if (!rows.length) {
      setStatus({ type: 'error', message: 'No employees to export on this page.' })
      return
    }
    const cols = visibleColumns.filter((c) => c.id !== 'payoutHistory')
    downloadCsv(
      `employee-payroll-${new Date().toISOString().slice(0, 10)}.csv`,
      cols.map((c) => c.label),
      rows.map((r) => cols.map((c) => payrollExportRaw(c.id, r))),
    )
  }

  const openHistory = async (employee) => {
    setHistory({ open: true, employee, rows: [], loading: true, error: '' })
    try {
      const list = await fetchSalaryStructures(tenantSlug, { userId: employee.id })
      setHistory({ open: true, employee, rows: list, loading: false, error: '' })
    } catch (err) {
      setHistory({
        open: true,
        employee,
        rows: [],
        loading: false,
        error: apiErrorMessage(err, 'Could not load salary structure history.'),
      })
    }
  }

  const openAddStructure = (employee) => {
    setStructureModal({
      open: true,
      mode: 'add',
      employee,
      form: emptyStructureForm(),
      structureId: null,
      saving: false,
      error: '',
    })
  }

  const openEditStructure = async (employee) => {
    setStructureModal({
      open: true,
      mode: 'edit',
      employee,
      form: emptyStructureForm(),
      structureId: null,
      saving: false,
      error: '',
    })
    try {
      const list = await fetchSalaryStructures(tenantSlug, { userId: employee.id })
      if (!list.length) {
        setStructureModal((s) => ({
          ...s,
          error: 'No salary structures found to edit.',
        }))
        return
      }
      const latest = list[0]
      setStructureModal({
        open: true,
        mode: 'edit',
        employee,
        structureId: latest.id,
        form: {
          salaryType: latest.salaryType || 'MONTHLY',
          changeType: latest.changeType || 'INCREMENT',
          amount: latest.amount != null ? Number(latest.amount).toFixed(2) : '',
          pfAmount: Number(latest.pfAmount || 0).toFixed(2),
          esiAmount: Number(latest.esiAmount || 0).toFixed(2),
          effectiveFrom: String(latest.effectiveFrom || '').slice(0, 10) || emptyStructureForm().effectiveFrom,
        },
        saving: false,
        error: '',
      })
    } catch (err) {
      setStructureModal((s) => ({
        ...s,
        error: apiErrorMessage(err, 'Could not load salary structures.'),
      }))
    }
  }

  const submitStructure = async (e) => {
    e.preventDefault()
    const { employee, mode, form, structureId } = structureModal
    if (!employee?.id) return
    const amountNum = Number(form.amount)
    if (!Number.isFinite(amountNum)) {
      setStructureModal((s) => ({ ...s, error: 'Enter a valid amount.' }))
      return
    }
    if (!form.effectiveFrom) {
      setStructureModal((s) => ({ ...s, error: 'Effective from is required.' }))
      return
    }

    setStructureModal((s) => ({ ...s, saving: true, error: '' }))
    const payload = {
      user: employee.id,
      salary_type: form.salaryType,
      change_type: form.changeType,
      amount: amountNum.toFixed(2),
      pf_amount: Number(form.pfAmount || 0).toFixed(2),
      esi_amount: Number(form.esiAmount || 0).toFixed(2),
      salary_mode: 'BANK_TRANSFER',
      effective_from: form.effectiveFrom,
    }

    try {
      if (mode === 'add') {
        await createSalaryStructure(tenantSlug, payload)
        setStatus({ type: 'success', message: 'Salary structure added.' })
      } else {
        await updateSalaryStructure(tenantSlug, structureId, payload)
        setStatus({ type: 'success', message: 'Salary structure updated.' })
      }
      setStructureModal({
        open: false,
        mode: 'add',
        employee: null,
        form: emptyStructureForm(),
        structureId: null,
        saving: false,
        error: '',
      })
      load()
    } catch (err) {
      const data = err?.response?.data
      const changeMsg = Array.isArray(data?.change_type) ? data.change_type[0] : ''
      setStructureModal((s) => ({
        ...s,
        saving: false,
        error: changeMsg || apiErrorMessage(err, 'Could not save salary structure.'),
      }))
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget?.structureId) return
    setDeleting(true)
    try {
      await deleteSalaryStructure(tenantSlug, deleteTarget.structureId)
      setStatus({ type: 'success', message: 'Salary structure deleted.' })
      setDeleteTarget(null)
      load()
    } catch (err) {
      setStatus({
        type: 'error',
        message: apiErrorMessage(err, 'Could not delete salary structure.'),
      })
    } finally {
      setDeleting(false)
    }
  }

  const openDeleteStructure = async (employee) => {
    try {
      const list = await fetchSalaryStructures(tenantSlug, { userId: employee.id })
      if (!list.length) {
        setStatus({ type: 'error', message: 'No salary structures found to delete.' })
        return
      }
      setDeleteTarget({ employee, structureId: list[0].id, label: list[0] })
    } catch (err) {
      setStatus({
        type: 'error',
        message: apiErrorMessage(err, 'Could not load salary structures.'),
      })
    }
  }

  const loadPayout = async (employee, months = 6) => {
    setPayout({
      open: true,
      employee,
      months,
      rows: [],
      loading: true,
      error: '',
      selected: {},
    })
    try {
      const reports = await fetchSalaryReportById(tenantSlug, employee.id)
      const { startDate, endDate } = periodRange(months)
      const inRange = reports.filter((r) => {
        const key = r.monthKey || (r.startDate || '').slice(0, 7)
        if (!key) return true
        return key >= startDate.slice(0, 7) && key <= endDate.slice(0, 7)
      })
      const sorted = [...inRange].sort((a, b) =>
        String(b.monthKey).localeCompare(String(a.monthKey)),
      )
      setPayout({
        open: true,
        employee,
        months,
        rows: sorted,
        loading: false,
        error: '',
        selected: {},
      })
    } catch (err) {
      setPayout({
        open: true,
        employee,
        months,
        rows: [],
        loading: false,
        error: apiErrorMessage(err, 'Could not load payout history.'),
        selected: {},
      })
    }
  }

  const exportPayoutSelected = () => {
    const selectedRows = payout.rows.filter((r) => payout.selected[r.id || r.monthKey])
    if (!selectedRows.length) {
      setPayout((p) => ({ ...p, error: 'Select one or more months to export.' }))
      return
    }
    downloadCsv(
      `payout-history-${(payout.employee?.name || 'employee').replace(/\W+/g, '-')}.csv`,
      [
        'Month',
        'Present',
        'Absent',
        'Half Day',
        'Paid Leave',
        'Payable Days',
        'Advance',
        'Loan',
        'Total Payable',
        'Paid Amount',
        'Monthly Balance',
      ],
      selectedRows.map((r) => {
        const balance = (r.totalPayable || 0) - (r.paidAmount || 0)
        return [
          monthLabel(r.monthKey),
          r.present,
          r.absent,
          r.halfDay,
          r.paidLeave,
          r.payableDays,
          r.advance,
          r.loan,
          r.totalPayable,
          r.paidAmount,
          balance,
        ]
      }),
    )
  }

  const openPay = (report) => {
    const due = Math.max(0, (report.totalPayable || 0) - (report.paidAmount || 0))
    setPayModal({
      open: true,
      report,
      amount: due.toFixed(2),
      method: 'BANK_TRANSFER',
      saving: false,
      error: '',
    })
  }

  const submitPay = async (e) => {
    e.preventDefault()
    const amountNum = Number(payModal.amount)
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      setPayModal((p) => ({ ...p, error: 'Enter a valid amount.' }))
      return
    }
    if (!payModal.report?.id) {
      setPayModal((p) => ({ ...p, error: 'Salary report id is missing for this month.' }))
      return
    }
    setPayModal((p) => ({ ...p, saving: true, error: '' }))
    try {
      await createSalaryTransaction(tenantSlug, {
        salary_report_id: Number(payModal.report.id) || payModal.report.id,
        amount_paid: amountNum.toFixed(2),
        payment_method: payModal.method,
      })
      setPayModal({
        open: false,
        report: null,
        amount: '',
        method: 'BANK_TRANSFER',
        saving: false,
        error: '',
      })
      setStatus({ type: 'success', message: 'Payout recorded.' })
      if (payout.employee) await loadPayout(payout.employee, payout.months)
      load()
    } catch (err) {
      setPayModal((p) => ({
        ...p,
        saving: false,
        error: apiErrorMessage(err, 'Could not record payout.'),
      }))
    }
  }

  const setForm = (key, value) =>
    setStructureModal((s) => ({ ...s, form: { ...s.form, [key]: value } }))

  const cumulativeBalances = useMemo(() => {
    let running = 0
    // oldest → newest for cumulative, then map back
    const chronological = [...payout.rows].sort((a, b) =>
      String(a.monthKey).localeCompare(String(b.monthKey)),
    )
    const map = {}
    chronological.forEach((r) => {
      const monthly = (r.totalPayable || 0) - (r.paidAmount || 0)
      running += monthly
      map[r.id || r.monthKey] = running
    })
    return map
  }, [payout.rows])

  return (
    <div className="space-y-4">
      <PageHeader title="Employee Payroll" />

      {!tenantSlug ? (
        <StatusBanner type="warning" message="Select a tenant to load payroll." />
      ) : null}

      {status.message ? <StatusBanner type={status.type || 'info'} message={status.message} /> : null}

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="space-y-2 border-b border-stone-100 px-4 py-3">
          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
            <div className="relative shrink-0">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                className={`${fieldClass} !w-[220px] !py-1.5 pl-9 sm:!w-[260px]`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    runSearch()
                  }
                }}
                placeholder="Search by name, ID, or mobile..."
                aria-label="Search payroll"
                disabled={!tenantSlug || loading}
              />
            </div>
            <button
              type="button"
              className={`${btnPrimary} !min-h-0 shrink-0 !bg-violet-600 !px-3 !py-1.5 hover:!bg-violet-700 focus-visible:!ring-violet-600/30`}
              onClick={runSearch}
              disabled={!tenantSlug || loading}
            >
              Search
            </button>
            <label className="inline-flex shrink-0 items-center gap-2 text-sm text-stone-600">
              <span className="whitespace-nowrap">Rows</span>
              <select
                className={`${fieldClass} !w-auto !py-1.5`}
                value={pageSize}
                onChange={(e) => {
                  setPage(1)
                  setPageSize(Number(e.target.value))
                }}
                aria-label="Rows per page"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <div className="shrink-0">
              <ColumnChooser
                columns={PAYROLL_COLUMNS}
                visibleIds={visibleIds}
                onToggle={(id) => toggleColumn(id, { minVisible: 2 })}
                onShowAll={showAll}
                onShowDefault={showDefault}
              />
            </div>
            <button
              type="button"
              className="sc-btn inline-flex min-h-0 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/35 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={exportOverview}
              disabled={!rows.length}
            >
              Export Excel
            </button>
          </div>
          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
            <select
              className={`${fieldClass} !w-auto min-w-[130px] shrink-0 !py-1.5`}
              value={statusFilter}
              onChange={(e) => {
                setPage(1)
                setStatusFilter(e.target.value)
              }}
              aria-label="Filter by status"
              disabled={!tenantSlug || loading}
            >
              {STATUS_FILTERS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              className={`${fieldClass} !w-auto min-w-[140px] shrink-0 !py-1.5`}
              value={categoryFilter}
              onChange={(e) => {
                setPage(1)
                setCategoryFilter(e.target.value)
              }}
              aria-label="Filter by category"
              disabled={!tenantSlug || loading}
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className={`${fieldClass} !w-auto min-w-[180px] shrink-0 !py-1.5`}
              value={ordering}
              onChange={(e) => {
                setPage(1)
                setOrdering(e.target.value)
              }}
              aria-label="Sort payroll"
              disabled={!tenantSlug || loading}
            >
              {ORDERING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  Sort · {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loadError ? (
          <div className="p-4">
            <ErrorState bare message={loadError} onRetry={load} />
          </div>
        ) : null}
        {loading ? (
          <div className="p-6">
            <LoadingState label="Loading payroll…" />
          </div>
        ) : null}

        {!loading && !loadError && tenantSlug ? (
          rows.length === 0 ? (
            <div className="p-6">
              <EmptyState bare title="No employees found" hint="Try another search, or add staff first." />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-[13px] leading-tight">
                  <thead className={tableHeadClass}>
                    <tr>
                      <th className="w-8 px-2 py-2" />
                      {visibleColumns.map((col) => (
                        <DraggableTh
                          key={col.id}
                          id={col.id}
                          onReorder={moveColumn}
                          className="px-2 py-2"
                        >
                          {col.label}
                        </DraggableTh>
                      ))}
                      <th className="px-2 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {rows.map((row) => (
                      <tr key={row.id} className="hover:bg-stone-50/80">
                        <td className="px-2 py-1.5 align-middle">
                          <button
                            type="button"
                            className={`${btnGhost} !px-1 !py-0.5`}
                            aria-label={`Salary structure history for ${row.name}`}
                            onClick={() => openHistory(row)}
                          >
                            <FiPlus className="h-3.5 w-3.5" />
                          </button>
                        </td>
                        {visibleColumns.map((col) => renderPayrollCell(col.id, row))}
                        <td className="px-2 py-1.5 align-middle">
                          {canWrite ? (
                            <div className="flex min-w-[6.5rem] flex-col gap-1">
                              <button
                                type="button"
                                className="inline-flex w-full items-center justify-center rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 transition-colors hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
                                onClick={() => openAddStructure(row)}
                              >
                                Add Structure
                              </button>
                              <button
                                type="button"
                                className={`${btnGhost} !w-full !justify-center !px-2 !py-0.5 !text-[11px]`}
                                onClick={() => openEditStructure(row)}
                                aria-label={`Edit structure for ${row.name}`}
                              >
                                <FiEdit2 className="h-3 w-3" />
                                Edit
                              </button>
                              <button
                                type="button"
                                className="inline-flex w-full items-center justify-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30"
                                onClick={() => openDeleteStructure(row)}
                                aria-label={`Delete structure for ${row.name}`}
                              >
                                <FiTrash2 className="h-3 w-3" />
                                Delete
                              </button>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
            </>
          )
        ) : null}
      </div>

      <Modal
        open={history.open}
        title="Salary Structure History"
        onClose={() =>
          setHistory({ open: false, employee: null, rows: [], loading: false, error: '' })
        }
        xl
        footer={
          <button
            type="button"
            className={btnSecondary}
            onClick={() =>
              setHistory({ open: false, employee: null, rows: [], loading: false, error: '' })
            }
          >
            Close
          </button>
        }
      >
        <p className="mb-3 text-sm text-stone-500">
          {history.employee?.name}
          {history.employee?.employeeId ? ` · ${history.employee.employeeId}` : ''}
        </p>
        {history.error ? <StatusBanner type="error" message={history.error} /> : null}
        {history.loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-stone-500">
            <FiLoader className="h-4 w-4 animate-spin" /> Loading history…
          </div>
        ) : history.rows.length === 0 ? (
          <EmptyState bare title="No salary structures" hint="Use Add Structure on the overview row." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table className="min-w-full text-left text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Change</th>
                  <th className="px-3 py-2.5">Amount</th>
                  <th className="px-3 py-2.5">PF</th>
                  <th className="px-3 py-2.5">ESI</th>
                  <th className="px-3 py-2.5">Final salary</th>
                  <th className="px-3 py-2.5">Effective from</th>
                  <th className="px-3 py-2.5">Updated</th>
                </tr>
              </thead>
              <tbody>
                {history.rows.map((r) => (
                  <tr key={r.id} className="border-t border-stone-100">
                    <td className="px-3 py-2.5">{formatLabel(r.salaryType)}</td>
                    <td className="px-3 py-2.5">{formatLabel(r.changeType)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{money(r.amount)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{money(r.pfAmount)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{money(r.esiAmount)}</td>
                    <td className="px-3 py-2.5 font-semibold tabular-nums">{money(r.finalSalary)}</td>
                    <td className="px-3 py-2.5">{formatDate(r.effectiveFrom)}</td>
                    <td className="px-3 py-2.5">{formatDateTime(r.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal
        open={structureModal.open}
        title={structureModal.mode === 'add' ? 'Add Salary Structure' : 'Edit Salary Structure'}
        onClose={() =>
          !structureModal.saving &&
          setStructureModal({
            open: false,
            mode: 'add',
            employee: null,
            form: emptyStructureForm(),
            structureId: null,
            saving: false,
            error: '',
          })
        }
        wide
        footer={
          <>
            <button
              type="button"
              className={btnSecondary}
              disabled={structureModal.saving}
              onClick={() =>
                setStructureModal({
                  open: false,
                  mode: 'add',
                  employee: null,
                  form: emptyStructureForm(),
                  structureId: null,
                  saving: false,
                  error: '',
                })
              }
            >
              Cancel
            </button>
            <button
              type="submit"
              form="salary-structure-form"
              className={btnPrimary}
              disabled={structureModal.saving || !canWrite}
            >
              {structureModal.saving ? (
                <>
                  <FiLoader className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : structureModal.mode === 'add' ? (
                'Add Structure'
              ) : (
                'Save changes'
              )}
            </button>
          </>
        }
      >
        <p className="mb-3 text-sm text-stone-500">{structureModal.employee?.name}</p>
        {structureModal.error ? (
          <div className="mb-3">
            <StatusBanner type="error" message={structureModal.error} />
          </div>
        ) : null}
        <form id="salary-structure-form" className="grid gap-4 sm:grid-cols-2" onSubmit={submitStructure}>
          <div>
            <label className={labelClass} htmlFor="salary-type">
              Salary type
            </label>
            <select
              id="salary-type"
              className={fieldClass}
              value={structureModal.form.salaryType}
              onChange={(e) => setForm('salaryType', e.target.value)}
            >
              {SALARY_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="change-type">
              Change type
            </label>
            <select
              id="change-type"
              className={fieldClass}
              value={structureModal.form.changeType}
              onChange={(e) => setForm('changeType', e.target.value)}
            >
              {CHANGE_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="amount">
              Amount <span className="text-rose-600">*</span>
            </label>
            <input
              id="amount"
              className={fieldClass}
              value={structureModal.form.amount}
              onChange={(e) => setForm('amount', e.target.value)}
              inputMode="decimal"
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="effective-from">
              Effective from <span className="text-rose-600">*</span>
            </label>
            <input
              id="effective-from"
              type="date"
              className={fieldClass}
              value={structureModal.form.effectiveFrom}
              onChange={(e) => setForm('effectiveFrom', e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="pf-amount">
              PF amount
            </label>
            <input
              id="pf-amount"
              className={fieldClass}
              value={structureModal.form.pfAmount}
              onChange={(e) => setForm('pfAmount', e.target.value)}
              inputMode="decimal"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="esi-amount">
              ESI amount
            </label>
            <input
              id="esi-amount"
              className={fieldClass}
              value={structureModal.form.esiAmount}
              onChange={(e) => setForm('esiAmount', e.target.value)}
              inputMode="decimal"
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={payout.open}
        title={payout.employee ? `Payroll - ${payout.employee.name}` : 'Payroll'}
        onClose={() =>
          setPayout({
            open: false,
            employee: null,
            months: 6,
            rows: [],
            loading: false,
            error: '',
            selected: {},
          })
        }
        xl
        footer={
          <button
            type="button"
            className={btnSecondary}
            onClick={() =>
              setPayout({
                open: false,
                employee: null,
                months: 6,
                rows: [],
                loading: false,
                error: '',
                selected: {},
              })
            }
          >
            Close
          </button>
        }
      >
        <p className="mb-3 text-sm font-medium text-stone-700">Payout History</p>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm text-stone-600">
            Period:
            <select
              className={`${fieldClass} w-auto`}
              value={payout.months}
              onChange={(e) => {
                const months = Number(e.target.value)
                if (payout.employee) loadPayout(payout.employee, months)
              }}
            >
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={`${btnSecondary} border-emerald-200 bg-emerald-50 text-emerald-800`}
            onClick={exportPayoutSelected}
          >
            <FiDownload className="h-4 w-4" />
            Export Excel
          </button>
        </div>
        <div className="mb-3 rounded-lg border border-accent-blue/20 bg-sky-50 px-3 py-2 text-sm text-stone-700">
          Tip: Click the paid-amount control to process payment for that month. Select months with
          checkboxes, then use Export Excel.
        </div>
        {payout.error ? (
          <div className="mb-3">
            <StatusBanner type="error" message={payout.error} />
          </div>
        ) : null}
        {payout.loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-stone-500">
            <FiLoader className="h-4 w-4 animate-spin" /> Loading payout history…
          </div>
        ) : payout.rows.length === 0 ? (
          <EmptyState bare title="No salary reports" hint="Reports appear after attendance and structures are set." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table className="min-w-full text-left text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-3 py-2.5" />
                  <th className="px-3 py-2.5">Month</th>
                  <th className="px-3 py-2.5">Present</th>
                  <th className="px-3 py-2.5">Absent</th>
                  <th className="px-3 py-2.5">Half day</th>
                  <th className="px-3 py-2.5">Paid leave</th>
                  <th className="px-3 py-2.5">Payable days</th>
                  <th className="px-3 py-2.5">Advance</th>
                  <th className="px-3 py-2.5">Loan</th>
                  <th className="px-3 py-2.5">Total payable</th>
                  <th className="px-3 py-2.5">Paid amount</th>
                  <th className="px-3 py-2.5">Monthly balance</th>
                  <th className="px-3 py-2.5">Cumulative</th>
                </tr>
              </thead>
              <tbody>
                {payout.rows.map((r) => {
                  const key = r.id || r.monthKey
                  const monthly = (r.totalPayable || 0) - (r.paidAmount || 0)
                  const cumulative = cumulativeBalances[key] ?? monthly
                  return (
                    <tr key={key} className="border-t border-stone-100">
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={Boolean(payout.selected[key])}
                          onChange={(e) =>
                            setPayout((p) => ({
                              ...p,
                              selected: { ...p.selected, [key]: e.target.checked },
                            }))
                          }
                          aria-label={`Select ${monthLabel(r.monthKey)}`}
                        />
                      </td>
                      <td className="px-3 py-2.5 font-medium">{monthLabel(r.monthKey)}</td>
                      <td className="px-3 py-2.5 text-emerald-700">{r.present}</td>
                      <td className="px-3 py-2.5 text-rose-700">{r.absent}</td>
                      <td className="px-3 py-2.5">{r.halfDay}</td>
                      <td className="px-3 py-2.5">{r.paidLeave}</td>
                      <td className="px-3 py-2.5">{r.payableDays}</td>
                      <td className="px-3 py-2.5">{r.advance ? money(r.advance) : '—'}</td>
                      <td className="px-3 py-2.5">{r.loan ? money(r.loan) : '—'}</td>
                      <td className="px-3 py-2.5 tabular-nums">{money(r.totalPayable)}</td>
                      <td className="px-3 py-2.5">
                        {canWrite ? (
                          <button
                            type="button"
                            className={`${btnGhost} text-accent-blue`}
                            onClick={() => openPay(r)}
                          >
                            {money(r.paidAmount)} Pay
                          </button>
                        ) : (
                          money(r.paidAmount)
                        )}
                      </td>
                      <td
                        className={`px-3 py-2.5 tabular-nums ${
                          monthly > 0.009 ? 'text-rose-700' : 'text-stone-600'
                        }`}
                      >
                        {money(monthly)}
                      </td>
                      <td
                        className={`px-3 py-2.5 tabular-nums ${
                          cumulative >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {cumulative >= 0 ? '+' : ''}
                        {money(cumulative)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal
        open={payModal.open}
        title="Record payout"
        onClose={() =>
          !payModal.saving &&
          setPayModal({
            open: false,
            report: null,
            amount: '',
            method: 'BANK_TRANSFER',
            saving: false,
            error: '',
          })
        }
        footer={
          <>
            <button
              type="button"
              className={btnSecondary}
              disabled={payModal.saving}
              onClick={() =>
                setPayModal({
                  open: false,
                  report: null,
                  amount: '',
                  method: 'BANK_TRANSFER',
                  saving: false,
                  error: '',
                })
              }
            >
              Cancel
            </button>
            <button
              type="submit"
              form="payout-form"
              className={btnPrimary}
              disabled={payModal.saving}
            >
              {payModal.saving ? (
                <>
                  <FiLoader className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                'Pay'
              )}
            </button>
          </>
        }
      >
        <p className="mb-3 text-sm text-stone-500">
          {monthLabel(payModal.report?.monthKey)} · due{' '}
          {money(
            Math.max(
              0,
              (payModal.report?.totalPayable || 0) - (payModal.report?.paidAmount || 0),
            ),
          )}
        </p>
        {payModal.error ? (
          <div className="mb-3">
            <StatusBanner type="error" message={payModal.error} />
          </div>
        ) : null}
        <form id="payout-form" className="space-y-3" onSubmit={submitPay}>
          <div>
            <label className={labelClass} htmlFor="pay-amount">
              Amount paid
            </label>
            <input
              id="pay-amount"
              className={fieldClass}
              value={payModal.amount}
              onChange={(e) => setPayModal((p) => ({ ...p, amount: e.target.value }))}
              inputMode="decimal"
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="pay-method">
              Payment method
            </label>
            <select
              id="pay-method"
              className={fieldClass}
              value={payModal.method}
              onChange={(e) => setPayModal((p) => ({ ...p, method: e.target.value }))}
            >
              {PAYMENT_METHODS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete salary structure?"
        message={
          deleteTarget
            ? `Delete the latest structure for ${deleteTarget.employee?.name} (${formatLabel(
                deleteTarget.label?.changeType,
              )} · ${money(deleteTarget.label?.amount)})?`
            : ''
        }
        confirmLabel="Delete"
        loading={deleting}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

export default PayrollPage
