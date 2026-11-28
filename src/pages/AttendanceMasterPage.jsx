import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiLoader,
  FiRefreshCw,
  FiSearch,
} from 'react-icons/fi'
import {
  ATTENDANCE_PAGE_SIZES,
  fetchAttendanceAnalysis,
  fetchSalaryAnalysis,
  mergeAttendanceSalaryRows,
  monthBounds,
} from '../api/attendanceAnalytics'
import ColumnChooser from '../components/ui/ColumnChooser'
import DraggableTh from '../components/ui/DraggableTh'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import { EmptyState, ErrorState, LoadingState, Panel } from '../components/ui/PageState'
import { useAccess } from '../hooks/useAccess'
import { useColumnOrder } from '../hooks/useColumnOrder'
import { useColumnVisibility } from '../hooks/useColumnVisibility'
import { apiErrorMessage } from '../utils/errors'
import { downloadExcelTable } from '../utils/exportExcel'
import { resolveCatalogTenantSlug } from '../utils/tenantHeader'
import { btnPrimary, btnSecondary, fieldClass, tableHeadClass } from '../utils/ui'

const STATUS_FILTERS = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'TERMINATED', label: 'Terminated' },
]

const ORDERING_OPTIONS = [
  { value: 'name', label: 'Name A–Z' },
  { value: '-name', label: 'Name Z–A' },
  { value: 'empId', label: 'Emp ID A–Z' },
  { value: '-empId', label: 'Emp ID Z–A' },
  { value: 'present', label: 'Present (low→high)' },
  { value: '-present', label: 'Present (high→low)' },
  { value: 'absent', label: 'Absent (low→high)' },
  { value: '-absent', label: 'Absent (high→low)' },
  { value: 'baseSalary', label: 'Base salary (low→high)' },
  { value: '-baseSalary', label: 'Base salary (high→low)' },
  { value: 'salary', label: 'Salary (low→high)' },
  { value: '-salary', label: 'Salary (high→low)' },
  { value: 'paid', label: 'Paid (low→high)' },
  { value: '-paid', label: 'Paid (high→low)' },
  { value: 'balance', label: 'Balance (low→high)' },
  { value: '-balance', label: 'Balance (high→low)' },
]

const sortValue = (row, key) => {
  switch (key) {
    case 'name':
      return String(row.name || '').toLowerCase()
    case 'empId':
      return String(row.employeeId || '').toLowerCase()
    case 'present':
      return Number(row.presentDays) || 0
    case 'absent':
      return Number(row.absentDays) || 0
    case 'baseSalary':
      return Number(row.baseSalary) || 0
    case 'salary':
      return Number(row.salary) || 0
    case 'paid':
      return Number(row.paid) || 0
    case 'balance':
      return Number(row.balance) || 0
    default:
      return ''
  }
}

const ATT_COLUMNS = [
  { id: 'empId', label: 'Emp ID' },
  { id: 'name', label: 'Name' },
  { id: 'mobile', label: 'Mobile' },
  { id: 'baseSalary', label: 'Base Salary' },
  { id: 'present', label: 'Days Present' },
  { id: 'absent', label: 'Days Absent' },
  { id: 'salary', label: 'Salary' },
  { id: 'paid', label: 'Paid' },
  { id: 'status', label: 'Current status' },
  { id: 'balance', label: 'Balance' },
  { id: 'days', label: 'Daily marks' },
]

const ATT_COLUMN_IDS = ATT_COLUMNS.map((c) => c.id)

const money = (value) => {
  if (value == null || value === '') return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

const daysLabel = (value) => {
  if (value == null || value === '') return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}

const monthLabel = (monthKey) => {
  const b = monthBounds(monthKey)
  const d = new Date(b.year, b.month - 1, 1)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

const shiftMonth = (monthKey, delta) => {
  const b = monthBounds(monthKey)
  const d = new Date(b.year, b.month - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const buildMonthWindow = (selectedKey, count = 8) => {
  const list = []
  for (let i = 0; i < count; i += 1) list.push(shiftMonth(selectedKey, -i))
  return list
}

const dayTone = (code) => {
  const c = String(code || '').toUpperCase()
  if (c === 'P') return 'font-semibold text-emerald-600'
  if (c === 'A') return 'font-semibold text-rose-600'
  if (c === 'H' || c === 'PL') return 'font-semibold text-amber-600'
  if (!c) return 'text-stone-300'
  return 'font-medium text-stone-600'
}

const statusTone = (status) => {
  const s = String(status || '').toLowerCase()
  if (s.includes('termin')) return 'text-stone-400'
  if (s.includes('active')) return 'font-medium text-stone-800'
  return 'text-stone-600'
}

const cellValue = (colId, row, dayCols, terminated) => {
  switch (colId) {
    case 'empId':
      return row.employeeId || '—'
    case 'name':
      return row.name || '—'
    case 'mobile':
      return row.mobile || '—'
    case 'baseSalary':
      return money(row.baseSalary)
    case 'present':
      return daysLabel(row.presentDays)
    case 'absent':
      return daysLabel(row.absentDays)
    case 'salary':
      return money(row.salary)
    case 'paid':
      return money(row.paid)
    case 'status':
      return row.status || '—'
    case 'balance':
      return row.balance == null ? '—' : `${money(row.balance)} (B)`
    case 'days':
      return dayCols.map((d) => row.daily?.[d] || (terminated ? '--' : '—')).join(' ')
    default:
      return ''
  }
}

const renderAttCell = (colId, row, dayCols, terminated) => {
  switch (colId) {
    case 'empId':
      return (
        <td key={colId} className="sticky left-10 z-10 bg-white px-3 py-2 font-mono text-xs text-stone-600">
          {row.employeeId || '—'}
        </td>
      )
    case 'name':
      return (
        <td key={colId} className="px-3 py-2 font-medium text-stone-900">
          {row.name}
        </td>
      )
    case 'mobile':
      return (
        <td key={colId} className="px-3 py-2 text-stone-600">
          {row.mobile || '—'}
        </td>
      )
    case 'baseSalary':
      return (
        <td key={colId} className="px-3 py-2 tabular-nums text-stone-700">
          {money(row.baseSalary)}
        </td>
      )
    case 'present':
      return (
        <td key={colId} className="px-3 py-2 font-semibold tabular-nums text-emerald-600">
          {daysLabel(row.presentDays)}
        </td>
      )
    case 'absent':
      return (
        <td key={colId} className="px-3 py-2 font-semibold tabular-nums text-rose-600">
          {daysLabel(row.absentDays)}
        </td>
      )
    case 'salary':
      return (
        <td key={colId} className="px-3 py-2 font-semibold tabular-nums text-brand-700">
          {money(row.salary)}
        </td>
      )
    case 'paid':
      return (
        <td key={colId} className="px-3 py-2 font-semibold tabular-nums text-emerald-600">
          {money(row.paid)}
        </td>
      )
    case 'status':
      return (
        <td key={colId} className={`px-3 py-2 ${statusTone(row.status)}`}>
          {row.status || '—'}
        </td>
      )
    case 'balance':
      return (
        <td key={colId} className="px-3 py-2 font-semibold tabular-nums text-rose-600">
          {row.balance == null ? '—' : `${money(row.balance)} (B)`}
        </td>
      )
    case 'days':
      return dayCols.map((d) => {
        const code = row.daily?.[d] || ''
        return (
          <td key={`d-${d}`} className={`px-2 py-2 text-center text-xs tabular-nums ${dayTone(code)}`}>
            {code || (terminated ? '--' : '—')}
          </td>
        )
      })
    default:
      return null
  }
}

const AttendanceMasterPage = () => {
  const access = useAccess()
  const tenantSlug = resolveCatalogTenantSlug(access.tenant)

  const [monthKey, setMonthKey] = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })
  const [windowAnchor, setWindowAnchor] = useState(monthKey)
  const [rows, setRows] = useState([])
  const [daysInMonth, setDaysInMonth] = useState(() => monthBounds(monthKey).daysInMonth)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [count, setCount] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [hasPrevious, setHasPrevious] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [ordering, setOrdering] = useState('name')
  const showPager = pageSize !== 'all'

  const { columnOrder, moveColumn } = useColumnOrder(
    'sc_att_analysis_col_order_v1',
    ATT_COLUMN_IDS,
  )
  const { visibleIds, toggleColumn, showAll, showDefault } = useColumnVisibility(
    'sc_att_analysis_col_visible_v1',
    ATT_COLUMN_IDS,
  )

  const visibleColumns = useMemo(
    () =>
      columnOrder
        .filter((id) => visibleIds.includes(id))
        .map((id) => ATT_COLUMNS.find((c) => c.id === id))
        .filter(Boolean),
    [columnOrder, visibleIds],
  )

  const monthTabs = useMemo(() => buildMonthWindow(windowAnchor, 8), [windowAnchor])

  const isActiveParam =
    statusFilter === 'ACTIVE' ? true : statusFilter === 'TERMINATED' ? false : undefined

  const matchesStatusFilter = useCallback(
    (row) => {
      if (statusFilter === 'ALL') return true
      const terminated =
        row.isActive === false ||
        String(row.status || '').toLowerCase().includes('termin') ||
        String(row.status || '').toLowerCase().includes('inactive')
      if (statusFilter === 'ACTIVE') return !terminated
      if (statusFilter === 'TERMINATED') return terminated
      return true
    },
    [statusFilter],
  )

  const load = useCallback(async () => {
    if (!tenantSlug) {
      setRows([])
      setCount(0)
      setHasNext(false)
      setHasPrevious(false)
      setError('')
      return
    }
    setLoading(true)
    setError('')
    try {
      const opts = {
        month: monthKey,
        page: pageSize === 'all' ? 1 : page,
        pageSize,
        isActive: isActiveParam,
      }
      const [attendance, salary] = await Promise.all([
        fetchAttendanceAnalysis(tenantSlug, opts),
        fetchSalaryAnalysis(tenantSlug, opts),
      ])
      let merged = mergeAttendanceSalaryRows(
        attendance.rows,
        salary.rows,
        attendance.daysInMonth || salary.daysInMonth,
      )
      // Enforce Active / Terminated against Current status even if API ignores is_active.
      if (statusFilter !== 'ALL') {
        merged = merged.filter((row) => {
          const terminated =
            row.isActive === false ||
            String(row.status || '').toLowerCase().includes('termin') ||
            String(row.status || '').toLowerCase().includes('inactive')
          return statusFilter === 'ACTIVE' ? !terminated : terminated
        })
      }
      setDaysInMonth(attendance.daysInMonth || salary.daysInMonth)
      setRows(merged)
      setCount(
        statusFilter === 'ALL'
          ? salary.count || attendance.count || merged.length
          : merged.length,
      )
      setHasNext(pageSize !== 'all' && Boolean(salary.next || attendance.next))
      setHasPrevious(
        pageSize !== 'all' &&
          (Boolean(salary.previous || attendance.previous) || page > 1),
      )
      setSelected({})
    } catch (err) {
      setRows([])
      setCount(0)
      setHasNext(false)
      setHasPrevious(false)
      setError(apiErrorMessage(err, 'Could not load attendance analysis.'))
    } finally {
      setLoading(false)
    }
  }, [tenantSlug, monthKey, page, pageSize, isActiveParam, statusFilter])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [monthKey, tenantSlug, statusFilter, pageSize])

  const displayRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = rows.filter(matchesStatusFilter)
    if (q) {
      list = list.filter((r) => {
        const hay = `${r.name || ''} ${r.employeeId || ''} ${r.mobile || ''}`.toLowerCase()
        return hay.includes(q)
      })
    }

    const desc = ordering.startsWith('-')
    const key = desc ? ordering.slice(1) : ordering
    return [...list].sort((a, b) => {
      const av = sortValue(a, key)
      const bv = sortValue(b, key)
      if (typeof av === 'number' && typeof bv === 'number') {
        return desc ? bv - av : av - bv
      }
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
      return desc ? -cmp : cmp
    })
  }, [rows, search, ordering, matchesStatusFilter])

  const allChecked =
    displayRows.length > 0 && displayRows.every((r) => selected[r.id || r.employeeId])
  const toggleAll = () => {
    if (allChecked) {
      setSelected({})
      return
    }
    const next = {}
    for (const r of displayRows) next[r.id || r.employeeId] = true
    setSelected(next)
  }

  const selectMonth = (key) => {
    setMonthKey(key)
    setWindowAnchor(key)
    setPage(1)
  }

  const applySearch = () => setSearch(searchInput.trim())

  const dayCols = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => i + 1),
    [daysInMonth],
  )

  const selectedRows = useMemo(
    () => displayRows.filter((r) => selected[r.id || r.employeeId]),
    [displayRows, selected],
  )
  const selectedCount = selectedRows.length

  const exportSelected = () => {
    if (!selectedRows.length) return
    const headers = []
    for (const col of visibleColumns) {
      if (col.id === 'days') {
        headers.push(...dayCols.map((d) => String(d)))
      } else {
        headers.push(col.label)
      }
    }
    const exportRows = selectedRows.map((row) => {
      const terminated = String(row.status || '').toLowerCase().includes('termin')
      const cells = []
      for (const col of visibleColumns) {
        if (col.id === 'days') {
          cells.push(...dayCols.map((d) => row.daily?.[d] || (terminated ? '--' : '')))
        } else {
          const raw =
            col.id === 'baseSalary'
              ? row.baseSalary ?? ''
              : col.id === 'present'
                ? row.presentDays ?? ''
                : col.id === 'absent'
                  ? row.absentDays ?? ''
                  : col.id === 'salary'
                    ? row.salary ?? ''
                    : col.id === 'paid'
                      ? row.paid ?? ''
                      : col.id === 'balance'
                        ? row.balance ?? ''
                        : cellValue(col.id, row, dayCols, terminated)
          cells.push(raw === '—' ? '' : raw)
        }
      }
      return cells
    })
    downloadExcelTable(`attendance-analysis-${monthKey}`, headers, exportRows)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={access.tenant?.name || 'Analytics'}
        title="Attendance Analysis"
        description="Staff attendance and salary compensation for the selected month."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ColumnChooser
              columns={ATT_COLUMNS}
              visibleIds={visibleIds}
              onToggle={(id) => toggleColumn(id, { minVisible: 2 })}
              onShowAll={showAll}
              onShowDefault={showDefault}
            />
            <button
              type="button"
              className={btnPrimary}
              onClick={exportSelected}
              disabled={!selectedCount || loading}
            >
              <FiDownload className="h-4 w-4" aria-hidden />
              Export to Excel{selectedCount ? ` (${selectedCount})` : ''}
            </button>
            <button type="button" className={btnSecondary} onClick={load} disabled={loading || !tenantSlug}>
              <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
              Refresh
            </button>
          </div>
        }
      />

      {!tenantSlug ? (
        <StatusBanner type="warning" message="Select a tenant to load attendance analysis." />
      ) : null}

      <Panel className="!p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50"
            aria-label="Earlier months"
            onClick={() => setWindowAnchor((k) => shiftMonth(k, 1))}
          >
            <FiChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
            {monthTabs.map((key) => {
              const active = key === monthKey
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectMonth(key)}
                  className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-brand-500 text-white shadow-sm'
                      : 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  {monthLabel(key)}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50"
            aria-label="Later months"
            onClick={() => setWindowAnchor((k) => shiftMonth(k, -1))}
          >
            <FiChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="mt-3 flex flex-nowrap items-center gap-2 overflow-x-auto border-t border-stone-100 pt-3">
          <input
            className={`${fieldClass} !w-[220px] shrink-0 sm:!w-[240px]`}
            placeholder="Search name, emp ID, or mobile…"
            aria-label="Search attendance rows"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applySearch()
            }}
            disabled={!tenantSlug || loading}
          />
          <button
            type="button"
            className={`${btnPrimary} shrink-0`}
            onClick={applySearch}
            disabled={!tenantSlug || loading}
          >
            <FiSearch className="h-4 w-4" aria-hidden />
            Search
          </button>
          <select
            className={`${fieldClass} !w-auto min-w-[140px] shrink-0`}
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
            className={`${fieldClass} !w-auto min-w-[180px] shrink-0`}
            value={ordering}
            onChange={(e) => setOrdering(e.target.value)}
            aria-label="Sort attendance rows"
            disabled={!tenantSlug || loading}
          >
            {ORDERING_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Sort · {opt.label}
              </option>
            ))}
          </select>
          <label className="inline-flex shrink-0 items-center gap-2 text-sm text-stone-600">
            <span className="whitespace-nowrap">Rows</span>
            <select
              className={`${fieldClass} !w-auto min-w-[72px]`}
              value={pageSize}
              onChange={(e) => {
                const v = e.target.value
                setPage(1)
                setPageSize(v === 'all' ? 'all' : Number(v) || 20)
              }}
              aria-label="Rows per page"
              disabled={!tenantSlug || loading}
            >
              {ATTENDANCE_PAGE_SIZES.map((n) => (
                <option key={String(n)} value={n}>
                  {n === 'all' ? 'All' : n}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Panel>

      {!tenantSlug ? (
        <Panel>
          <EmptyState bare title="No tenant selected" hint="Choose a tenant to view analysis." />
        </Panel>
      ) : loading ? (
        <Panel>
          <LoadingState label="Loading attendance analysis…" />
        </Panel>
      ) : error ? (
        <Panel>
          <ErrorState bare message={error} onRetry={load} />
        </Panel>
      ) : rows.length === 0 ? (
        <Panel>
          <EmptyState
            bare
            title="No attendance data"
            hint={`Nothing returned for ${monthLabel(monthKey)}.`}
          />
        </Panel>
      ) : displayRows.length === 0 ? (
        <Panel>
          <EmptyState
            bare
            title="No matches"
            hint="Try a different search, status filter, or clear filters."
          />
        </Panel>
      ) : (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="overflow-auto">
            <table className="min-w-max text-left text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="sticky left-0 z-20 bg-[#fafaf9] px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                      aria-label="Select all"
                    />
                  </th>
                  {visibleColumns.flatMap((col) => {
                    if (col.id === 'days') {
                      return dayCols.map((d, idx) =>
                        idx === 0 ? (
                          <DraggableTh
                            key="days"
                            id="days"
                            onReorder={moveColumn}
                            align="center"
                            className="bg-brand-500 px-2 py-2.5 text-white"
                          >
                            {d}
                          </DraggableTh>
                        ) : (
                          <th key={`d-${d}`} className="px-2 py-2.5 text-center tabular-nums">
                            {d}
                          </th>
                        ),
                      )
                    }
                    return (
                      <DraggableTh
                        key={col.id}
                        id={col.id}
                        onReorder={moveColumn}
                        className={
                          col.id === 'empId'
                            ? 'sticky left-10 z-20 bg-[#fafaf9] px-3 py-2.5'
                            : 'px-3 py-2.5'
                        }
                      >
                        {col.label}
                      </DraggableTh>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {displayRows.map((row) => {
                  const key = row.id || row.employeeId
                  const terminated = String(row.status || '').toLowerCase().includes('termin')
                  return (
                    <tr key={key} className={`hover:bg-stone-50 ${terminated ? 'opacity-70' : ''}`}>
                      <td className="sticky left-0 z-10 bg-white px-3 py-2">
                        <input
                          type="checkbox"
                          checked={Boolean(selected[key])}
                          onChange={() =>
                            setSelected((s) => ({ ...s, [key]: !s[key] }))
                          }
                          aria-label={`Select ${row.name}`}
                        />
                      </td>
                      {visibleColumns.flatMap((col) =>
                        renderAttCell(col.id, row, dayCols, terminated),
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 px-3 py-2.5 text-sm text-stone-600">
            <span>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <FiLoader className="h-4 w-4 animate-spin" aria-hidden />
                  Updating…
                </span>
              ) : (
                <>
                  {pageSize === 'all'
                    ? `${displayRows.length} employees`
                    : `Showing ${displayRows.length} of ${rows.length} on this page`}
                  {count && pageSize !== 'all' ? ` · ${count} total` : ''}
                  {showPager ? ` · Page ${page}` : ' · All rows'}
                  {` · ${monthLabel(monthKey)}`}
                </>
              )}
            </span>
            {showPager ? (
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
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

export default AttendanceMasterPage
