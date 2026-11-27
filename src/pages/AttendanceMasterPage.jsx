import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiChevronLeft, FiChevronRight, FiDownload, FiLoader, FiRefreshCw } from 'react-icons/fi'
import {
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
import { btnPrimary, btnSecondary, tableHeadClass } from '../utils/ui'

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
  const [count, setCount] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [hasPrevious, setHasPrevious] = useState(false)

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
      const [attendance, salary] = await Promise.all([
        fetchAttendanceAnalysis(tenantSlug, { month: monthKey, page }),
        fetchSalaryAnalysis(tenantSlug, { month: monthKey, page }),
      ])
      const merged = mergeAttendanceSalaryRows(
        attendance.rows,
        salary.rows,
        attendance.daysInMonth || salary.daysInMonth,
      )
      setDaysInMonth(attendance.daysInMonth || salary.daysInMonth)
      setRows(merged)
      setCount(salary.count || attendance.count || merged.length)
      setHasNext(Boolean(salary.next || attendance.next))
      setHasPrevious(Boolean(salary.previous || attendance.previous) || page > 1)
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
  }, [tenantSlug, monthKey, page])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [monthKey, tenantSlug])

  const allChecked = rows.length > 0 && rows.every((r) => selected[r.id || r.employeeId])
  const toggleAll = () => {
    if (allChecked) {
      setSelected({})
      return
    }
    const next = {}
    for (const r of rows) next[r.id || r.employeeId] = true
    setSelected(next)
  }

  const selectMonth = (key) => {
    setMonthKey(key)
    setWindowAnchor(key)
    setPage(1)
  }

  const dayCols = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => i + 1),
    [daysInMonth],
  )

  const selectedRows = useMemo(
    () => rows.filter((r) => selected[r.id || r.employeeId]),
    [rows, selected],
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
                {rows.map((row) => {
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
                  {count ? `${count} employees` : `${rows.length} on this page`}
                  {` · Page ${page}`}
                  {` · ${monthLabel(monthKey)}`}
                </>
              )}
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
  )
}

export default AttendanceMasterPage
