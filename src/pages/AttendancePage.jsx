import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FiChevronLeft,
  FiChevronRight,
  FiMoreVertical,
  FiPlus,
  FiSearch,
  FiSettings,
  FiTrash2,
  FiUser,
} from 'react-icons/fi'
import {
  createAttendanceStatus,
  deleteAttendanceStatus,
  fetchAttendanceRecords,
  fetchAttendanceStatuses,
  updateAttendanceStatus,
  upsertAttendanceRecord,
} from '../api/attendance'
import { employeeFullName, fetchEmployees } from '../api/employees'
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
} from '../utils/ui'

const STATUS_TONE = {
  present: {
    chip: 'text-emerald-700',
    btn: 'bg-emerald-600 text-white border-emerald-600',
    soft: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  absent: {
    chip: 'text-rose-600',
    btn: 'bg-rose-600 text-white border-rose-600',
    soft: 'bg-rose-50 text-rose-800 border-rose-200',
  },
  half: {
    chip: 'text-amber-600',
    btn: 'bg-amber-500 text-white border-amber-500',
    soft: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  paid: {
    chip: 'text-sky-600',
    btn: 'bg-sky-600 text-white border-sky-600',
    soft: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  unpaid: {
    chip: 'text-orange-600',
    btn: 'bg-orange-500 text-white border-orange-500',
    soft: 'bg-orange-50 text-orange-800 border-orange-200',
  },
  weekly: {
    chip: 'text-violet-600',
    btn: 'bg-violet-600 text-white border-violet-600',
    soft: 'bg-violet-50 text-violet-800 border-violet-200',
  },
  other: {
    chip: 'text-stone-600',
    btn: 'bg-ink text-white border-ink',
    soft: 'bg-stone-100 text-stone-700 border-stone-200',
  },
}

const statusKind = (status) => {
  const key = `${status?.code || ''} ${status?.label || ''}`.toLowerCase()
  if (/present|\bp\b/.test(key) && !/half/.test(key)) return 'present'
  if (/absent|\ba\b/.test(key)) return 'absent'
  if (/half/.test(key)) return 'half'
  if (/paid.?leave|pl\b/.test(key)) return 'paid'
  if (/unpaid.?leave|lwp|ul\b/.test(key)) return 'unpaid'
  if (/weekly|wo\b|week.?off|off/.test(key)) return 'weekly'
  return 'other'
}

const pad = (n) => String(n).padStart(2, '0')

const monthKeyFromDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`

const parseMonthKey = (key) => {
  const [y, m] = String(key || '').split('-').map(Number)
  if (!y || !m) return new Date()
  return new Date(y, m - 1, 1)
}

const shiftMonth = (key, delta) => {
  const d = parseMonthKey(key)
  d.setMonth(d.getMonth() + delta)
  return monthKeyFromDate(d)
}

const monthLabel = (key) =>
  parseMonthKey(key).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

const daysInMonth = (key) => {
  const d = parseMonthKey(key)
  const y = d.getFullYear()
  const m = d.getMonth()
  const total = new Date(y, m + 1, 0).getDate()
  const rows = []
  for (let day = 1; day <= total; day += 1) {
    const date = new Date(y, m, day)
    rows.push({
      date: `${y}-${pad(m + 1)}-${pad(day)}`,
      label: date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    })
  }
  return rows
}

const emptyStatusForm = () => ({ code: '', label: '', isActive: true })

const AttendancePage = () => {
  const access = useAccess()
  const canWrite = access.canWrite !== false
  const tenantSlug = resolveCatalogTenantSlug(access.tenant)

  const [monthKey, setMonthKey] = useState(() => monthKeyFromDate(new Date()))
  const [employees, setEmployees] = useState([])
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [employeeSearchApplied, setEmployeeSearchApplied] = useState('')
  const [employeePage, setEmployeePage] = useState(1)
  const [employeePageSize] = useState(20)
  const [employeeCount, setEmployeeCount] = useState(0)
  const [hasEmployeeNext, setHasEmployeeNext] = useState(false)
  const [hasEmployeePrevious, setHasEmployeePrevious] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [statuses, setStatuses] = useState([])
  const [records, setRecords] = useState([])
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [status, setStatus] = useState({ type: '', message: '' })
  const [markingDate, setMarkingDate] = useState('')
  const [menuDate, setMenuDate] = useState('')
  const menuRef = useRef(null)
  const searchTimer = useRef(null)

  const [statusModal, setStatusModal] = useState(false)
  const [statusForm, setStatusForm] = useState(emptyStatusForm())
  const [editingStatus, setEditingStatus] = useState(null)
  const [statusSaving, setStatusSaving] = useState(false)
  const [statusFormError, setStatusFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const selected = useMemo(
    () => employees.find((e) => e.id === selectedId) || null,
    [employees, selectedId],
  )

  const activeStatuses = useMemo(
    () => statuses.filter((s) => s.isActive),
    [statuses],
  )

  const presentStatus = useMemo(
    () => activeStatuses.find((s) => statusKind(s) === 'present') || null,
    [activeStatuses],
  )
  const absentStatus = useMemo(
    () => activeStatuses.find((s) => statusKind(s) === 'absent') || null,
    [activeStatuses],
  )
  const moreStatuses = useMemo(
    () =>
      activeStatuses.filter(
        (s) => s.id !== presentStatus?.id && s.id !== absentStatus?.id,
      ),
    [activeStatuses, presentStatus, absentStatus],
  )

  const recordByDate = useMemo(() => {
    const map = {}
    records.forEach((r) => {
      if (r.date) map[r.date] = r
    })
    return map
  }, [records])

  const summary = useMemo(() => {
    const counts = {
      absent: 0,
      half: 0,
      paid: 0,
      present: 0,
      unpaid: 0,
      weekly: 0,
    }
    records.forEach((r) => {
      const match =
        statuses.find((s) => s.id === r.statusId) ||
        statuses.find((s) => s.code === r.statusCode) ||
        { code: r.statusCode, label: r.statusLabel }
      const kind = statusKind(match)
      if (kind in counts) counts[kind] += 1
    })
    return counts
  }, [records, statuses])

  const dayRows = useMemo(() => daysInMonth(monthKey), [monthKey])

  const loadStatuses = useCallback(async () => {
    if (!tenantSlug) {
      setStatuses([])
      return
    }
    try {
      const list = await fetchAttendanceStatuses(tenantSlug)
      setStatuses(list)
    } catch (err) {
      setStatuses([])
      setStatus({
        type: 'error',
        message: apiErrorMessage(err, 'Could not load attendance statuses.'),
      })
    }
  }, [tenantSlug])

  const employeeTotalPages = Math.max(
    1,
    Math.ceil((employeeCount || 0) / employeePageSize) || 1,
  )

  const loadEmployees = useCallback(async () => {
    if (!tenantSlug) {
      setEmployees([])
      setEmployeeCount(0)
      setHasEmployeeNext(false)
      setHasEmployeePrevious(false)
      setSelectedId('')
      return
    }
    setLoadingEmployees(true)
    setLoadError('')
    try {
      const q = employeeSearchApplied.trim()
      const data = await fetchEmployees(tenantSlug, {
        page: employeePage,
        pageSize: employeePageSize,
        ordering: 'first_name',
        search: q || undefined,
        q: q || undefined,
      })
      setEmployees(data.results)
      setEmployeeCount(data.count)
      setHasEmployeeNext(Boolean(data.next))
      setHasEmployeePrevious(Boolean(data.previous) || employeePage > 1)
      setSelectedId((prev) => {
        if (prev && data.results.some((e) => e.id === prev)) return prev
        return data.results[0]?.id || ''
      })
    } catch (err) {
      setEmployees([])
      setEmployeeCount(0)
      setHasEmployeeNext(false)
      setHasEmployeePrevious(false)
      setSelectedId('')
      setLoadError(apiErrorMessage(err, 'Could not load employees.'))
    } finally {
      setLoadingEmployees(false)
    }
  }, [tenantSlug, employeeSearchApplied, employeePage, employeePageSize])

  const onEmployeeSearchChange = (value) => {
    setEmployeeSearch(value)
    if (searchTimer.current) window.clearTimeout(searchTimer.current)
    searchTimer.current = window.setTimeout(() => {
      setEmployeePage(1)
      setEmployeeSearchApplied(value.trim())
    }, 300)
  }

  const loadRecords = useCallback(async () => {
    if (!tenantSlug || !selectedId) {
      setRecords([])
      return
    }
    setLoadingRecords(true)
    try {
      const d = parseMonthKey(monthKey)
      const y = d.getFullYear()
      const m = d.getMonth()
      const dateFrom = `${y}-${pad(m + 1)}-01`
      const dateTo = `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`
      const data = await fetchAttendanceRecords(tenantSlug, {
        userId: selectedId,
        dateFrom,
        dateTo,
        year: y,
        month: m + 1,
        pageSize: 100,
      })
      setRecords(data.results.filter((r) => !r.userId || r.userId === selectedId))
    } catch (err) {
      setRecords([])
      setStatus({
        type: 'error',
        message: apiErrorMessage(err, 'Could not load attendance records.'),
      })
    } finally {
      setLoadingRecords(false)
    }
  }, [tenantSlug, selectedId, monthKey])

  useEffect(() => {
    loadEmployees()
    loadStatuses()
  }, [loadEmployees, loadStatuses])

  useEffect(
    () => () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current)
    },
    [],
  )

  useEffect(() => {
    loadRecords()
  }, [loadRecords])

  useEffect(() => {
    if (!menuDate) return undefined
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuDate('')
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuDate])

  const markDay = async (date, statusRow, reason = '') => {
    if (!canWrite || !tenantSlug || !selectedId || !statusRow?.id) return
    if (selected?.is_terminated) {
      setStatus({ type: 'error', message: 'Cannot mark attendance for a terminated employee.' })
      return
    }
    setMarkingDate(date)
    setMenuDate('')
    setStatus({ type: '', message: '' })
    try {
      const saved = await upsertAttendanceRecord(tenantSlug, {
        userId: selectedId,
        date,
        statusId: statusRow.id,
        duration: statusKind(statusRow) === 'half' ? '04:00:00' : '08:00:00',
        reason: reason || statusRow.label || 'Attendance marked',
      })
      setRecords((prev) => {
        const next = prev.filter((r) => r.date !== date)
        next.push(saved.date ? saved : { ...saved, date, statusId: statusRow.id })
        return next
      })
      // Refresh to pick up server-normalized status labels
      loadRecords()
    } catch (err) {
      setStatus({
        type: 'error',
        message: apiErrorMessage(err, 'Could not save attendance.'),
      })
    } finally {
      setMarkingDate('')
    }
  }

  const openStatusModal = () => {
    setStatusForm(emptyStatusForm())
    setEditingStatus(null)
    setStatusFormError('')
    setStatusModal(true)
  }

  const startEditStatus = (row) => {
    setEditingStatus(row)
    setStatusForm({
      code: row.code,
      label: row.label,
      isActive: row.isActive,
    })
    setStatusFormError('')
  }

  const saveStatus = async (e) => {
    e?.preventDefault?.()
    if (!tenantSlug || !canWrite) return
    const code = String(statusForm.code || '').trim()
    const label = String(statusForm.label || '').trim()
    if (!editingStatus && !code) {
      setStatusFormError('Code is required.')
      return
    }
    if (!label) {
      setStatusFormError('Label is required.')
      return
    }
    setStatusSaving(true)
    setStatusFormError('')
    try {
      if (editingStatus) {
        await updateAttendanceStatus(tenantSlug, editingStatus.id, {
          label,
          isActive: statusForm.isActive,
          code,
        })
        setStatus({ type: 'success', message: 'Status updated.' })
      } else {
        await createAttendanceStatus(tenantSlug, {
          code,
          label,
          isActive: statusForm.isActive,
        })
        setStatus({ type: 'success', message: 'Status created.' })
      }
      setStatusForm(emptyStatusForm())
      setEditingStatus(null)
      await loadStatuses()
    } catch (err) {
      setStatusFormError(apiErrorMessage(err, 'Could not save status.'))
    } finally {
      setStatusSaving(false)
    }
  }

  const confirmDeleteStatus = async () => {
    if (!deleteTarget || !tenantSlug) return
    setDeleting(true)
    try {
      await deleteAttendanceStatus(tenantSlug, deleteTarget.id)
      setDeleteTarget(null)
      if (editingStatus?.id === deleteTarget.id) {
        setEditingStatus(null)
        setStatusForm(emptyStatusForm())
      }
      setStatus({ type: 'success', message: 'Status deleted.' })
      await loadStatuses()
    } catch (err) {
      setStatus({
        type: 'error',
        message: apiErrorMessage(err, 'Could not delete status.'),
      })
    } finally {
      setDeleting(false)
    }
  }

  const summaryItems = [
    { key: 'absent', label: 'Absent', value: summary.absent },
    { key: 'half', label: 'Half-Day', value: summary.half },
    { key: 'paid', label: 'Paid-Leave', value: summary.paid },
    { key: 'present', label: 'Present', value: summary.present },
    { key: 'unpaid', label: 'Unpaid-Leave', value: summary.unpaid },
    { key: 'weekly', label: 'Weekly-Off', value: summary.weekly },
  ]

  return (
    <div className="space-y-4 min-w-0">
      <PageHeader
        eyebrow="Manage Staff"
        title="Attendance"
        description={`Mark daily attendance for ${access.tenant?.name || 'this tenant'}.`}
        actions={
          canWrite ? (
            <button type="button" className={btnSecondary} onClick={openStatusModal}>
              <FiSettings className="h-4 w-4" aria-hidden />
              Status codes
            </button>
          ) : null
        }
      />

      {!tenantSlug ? (
        <StatusBanner type="warning" message="Select a tenant to load attendance." />
      ) : null}
      {status.message ? (
        <StatusBanner type={status.type || 'info'} message={status.message} />
      ) : null}
      {loadError ? (
        <ErrorState
          title="Could not load employees"
          message={loadError}
          onRetry={loadEmployees}
        />
      ) : null}

      {tenantSlug && !loadError ? (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-stone-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`${btnGhost} !px-2`}
                aria-label="Previous month"
                onClick={() => setMonthKey((k) => shiftMonth(k, -1))}
              >
                <FiChevronLeft className="h-4 w-4" />
              </button>
              <p className="min-w-[7.5rem] text-center text-sm font-semibold text-ink">
                {monthLabel(monthKey)}
              </p>
              <button
                type="button"
                className={`${btnGhost} !px-2`}
                aria-label="Next month"
                onClick={() => setMonthKey((k) => shiftMonth(k, 1))}
              >
                <FiChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium">
              {summaryItems.map((item) => (
                <span key={item.key} className={STATUS_TONE[item.key].chip}>
                  {item.label}:{' '}
                  <span className="tabular-nums font-semibold">{item.value}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="grid min-h-[28rem] lg:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)]">
            <aside className="border-b border-stone-200 lg:border-b-0 lg:border-r">
              <div className="space-y-2 border-b border-stone-100 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">
                  Employees
                </p>
                <label className="relative block">
                  <span className="sr-only">Search employees</span>
                  <FiSearch
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400"
                    aria-hidden
                  />
                  <input
                    type="search"
                    className={`${fieldClass} !py-1.5 !pl-8 !text-sm`}
                    placeholder="Search name, ID, phone…"
                    value={employeeSearch}
                    onChange={(e) => onEmployeeSearchChange(e.target.value)}
                    aria-label="Search employees"
                  />
                </label>
              </div>
              {loadingEmployees ? (
                <div className="p-4">
                  <LoadingState label="Loading employees…" />
                </div>
              ) : employees.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    bare
                    title={employeeSearch.trim() ? 'No matches' : 'No employees'}
                    hint={
                      employeeSearch.trim()
                        ? 'Try another name, employee ID, or phone.'
                        : 'Add staff first, then mark attendance.'
                    }
                  />
                </div>
              ) : (
                <>
                  <ul className="max-h-[28rem] overflow-y-auto py-1">
                    {employees.map((emp) => {
                      const name = employeeFullName(emp)
                      const active = emp.id === selectedId
                      const terminated = Boolean(emp.is_terminated)
                      return (
                        <li key={emp.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(emp.id)}
                            className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                              active
                                ? 'border-l-[3px] border-brand-500 bg-brand-50'
                                : 'border-l-[3px] border-transparent hover:bg-stone-50'
                            }`}
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100 text-stone-500">
                              {emp.profile_pic ? (
                                <img
                                  src={emp.profile_pic}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <FiUser className="h-4 w-4" aria-hidden />
                              )}
                            </span>
                            <span className="min-w-0">
                              <span
                                className={`block truncate text-sm font-medium ${
                                  terminated ? 'text-stone-400' : 'text-ink'
                                }`}
                              >
                                {name}
                              </span>
                              {terminated ? (
                                <span className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
                                  Terminated
                                </span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  <div className="space-y-2 border-t border-stone-100 px-3 py-2">
                    <p className="text-[11px] text-stone-500">
                      {employeeCount} employee{employeeCount === 1 ? '' : 's'} · page{' '}
                      {employeePage} of {employeeTotalPages}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={`${btnSecondary} !min-h-0 flex-1 !px-2 !py-1.5 !text-xs`}
                        disabled={!hasEmployeePrevious || loadingEmployees}
                        onClick={() => setEmployeePage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        className={`${btnSecondary} !min-h-0 flex-1 !px-2 !py-1.5 !text-xs`}
                        disabled={!hasEmployeeNext || loadingEmployees}
                        onClick={() => setEmployeePage((p) => p + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </aside>

            <section className="min-w-0">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)] gap-3 border-b border-stone-100 bg-stone-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-stone-500">
                <span>Date</span>
                <span>Attendance</span>
              </div>
              {!selectedId ? (
                <div className="p-6">
                  <EmptyState bare title="Select an employee" hint="Pick someone from the list to view the month." />
                </div>
              ) : loadingRecords ? (
                <div className="p-6">
                  <LoadingState label="Loading attendance…" />
                </div>
              ) : (
                <ul className="max-h-[32rem] divide-y divide-stone-100 overflow-y-auto">
                  {dayRows.map((day) => {
                    const rec = recordByDate[day.date]
                    const matched =
                      statuses.find((s) => s.id === rec?.statusId) ||
                      statuses.find((s) => s.code === rec?.statusCode) ||
                      null
                    const kind = matched ? statusKind(matched) : ''
                    const isPresent = kind === 'present'
                    const isAbsent = kind === 'absent'
                    const busy = markingDate === day.date
                    const otherActive =
                      matched && matched.id !== presentStatus?.id && matched.id !== absentStatus?.id
                    return (
                      <li
                        key={day.date}
                        className="grid grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)] items-center gap-3 px-4 py-2.5"
                      >
                        <p className="text-sm text-stone-700">{day.label}</p>
                        <div className="relative flex items-center gap-1.5" ref={menuDate === day.date ? menuRef : null}>
                          <button
                            type="button"
                            disabled={!canWrite || busy || !absentStatus || selected?.is_terminated}
                            onClick={() => markDay(day.date, absentStatus)}
                            className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                              isAbsent
                                ? STATUS_TONE.absent.btn
                                : 'border-stone-200 bg-white text-stone-500 hover:bg-stone-50'
                            }`}
                          >
                            {absentStatus?.label || 'Absent'}
                          </button>
                          <button
                            type="button"
                            disabled={!canWrite || busy || !presentStatus || selected?.is_terminated}
                            onClick={() => markDay(day.date, presentStatus)}
                            className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                              isPresent
                                ? STATUS_TONE.present.btn
                                : 'border-stone-200 bg-white text-stone-500 hover:bg-stone-50'
                            }`}
                          >
                            {presentStatus?.label || 'Present'}
                          </button>
                          {otherActive ? (
                            <span
                              className={`hidden rounded-md border px-2 py-1 text-[11px] font-semibold sm:inline ${
                                STATUS_TONE[kind || 'other'].soft
                              }`}
                            >
                              {matched.label}
                            </span>
                          ) : null}
                          <button
                            type="button"
                            className={`${btnGhost} !px-2`}
                            aria-label={`More statuses for ${day.label}`}
                            disabled={!canWrite || busy || selected?.is_terminated || !moreStatuses.length}
                            onClick={() =>
                              setMenuDate((prev) => (prev === day.date ? '' : day.date))
                            }
                          >
                            <FiMoreVertical className="h-4 w-4" />
                          </button>
                          {menuDate === day.date ? (
                            <div className="absolute right-0 top-full z-20 mt-1 min-w-[10rem] overflow-hidden rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
                              {moreStatuses.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-50"
                                  onClick={() => markDay(day.date, s)}
                                >
                                  {s.label}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      ) : null}

      <Modal
        open={statusModal}
        title="Attendance status codes"
        onClose={() => !statusSaving && setStatusModal(false)}
        wide
        footer={
          <button
            type="button"
            className={btnSecondary}
            onClick={() => setStatusModal(false)}
            disabled={statusSaving}
          >
            Close
          </button>
        }
      >
        <div className="space-y-4">
          {statusFormError ? (
            <StatusBanner type="error" message={statusFormError} />
          ) : null}
          <form onSubmit={saveStatus} className="grid gap-3 rounded-xl border border-stone-200 p-4 sm:grid-cols-[7rem_1fr_auto_auto]">
            <div>
              <label className={labelClass} htmlFor="att-status-code">
                Code
              </label>
              <input
                id="att-status-code"
                className={fieldClass}
                value={statusForm.code}
                disabled={Boolean(editingStatus) || statusSaving}
                onChange={(e) =>
                  setStatusForm((f) => ({
                    ...f,
                    code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
                  }))
                }
                placeholder="P"
                maxLength={16}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="att-status-label">
                Label
              </label>
              <input
                id="att-status-label"
                className={fieldClass}
                value={statusForm.label}
                disabled={statusSaving}
                onChange={(e) => setStatusForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Present"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="inline-flex items-center gap-2 text-sm text-stone-600">
                <input
                  type="checkbox"
                  checked={statusForm.isActive}
                  disabled={statusSaving}
                  onChange={(e) =>
                    setStatusForm((f) => ({ ...f, isActive: e.target.checked }))
                  }
                />
                Active
              </label>
            </div>
            <div className="flex items-end gap-2">
              {editingStatus ? (
                <button
                  type="button"
                  className={btnGhost}
                  disabled={statusSaving}
                  onClick={() => {
                    setEditingStatus(null)
                    setStatusForm(emptyStatusForm())
                  }}
                >
                  Cancel
                </button>
              ) : null}
              <button type="submit" className={btnPrimary} disabled={statusSaving || !canWrite}>
                <FiPlus className="h-4 w-4" aria-hidden />
                {editingStatus ? 'Update' : 'Add'}
              </button>
            </div>
          </form>

          {statuses.length === 0 ? (
            <EmptyState
              bare
              title="No status codes"
              hint="Add Present, Absent, and leave codes used when marking days."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-stone-200">
              <table className="min-w-full text-sm">
                <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Code</th>
                    <th className="px-3 py-2 font-semibold">Label</th>
                    <th className="px-3 py-2 font-semibold">Active</th>
                    <th className="px-3 py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {statuses.map((row) => (
                    <tr key={row.id} className="hover:bg-stone-50">
                      <td className="px-3 py-2 font-medium text-ink">{row.code || '—'}</td>
                      <td className="px-3 py-2 text-stone-700">{row.label || '—'}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            row.isActive
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-stone-100 text-stone-500'
                          }`}
                        >
                          {row.isActive ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className={btnGhost}
                            disabled={!canWrite}
                            onClick={() => startEditStatus(row)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`${btnGhost} text-rose-600`}
                            disabled={!canWrite}
                            aria-label={`Delete ${row.label}`}
                            onClick={() => setDeleteTarget(row)}
                          >
                            <FiTrash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete status code?"
        message={
          deleteTarget
            ? `Remove “${deleteTarget.label || deleteTarget.code}”? Days already marked with it may keep the old value.`
            : ''
        }
        confirmLabel="Delete"
        loading={deleting}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={confirmDeleteStatus}
      />
    </div>
  )
}

export default AttendancePage
