import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiLoader, FiSearch } from 'react-icons/fi'
import { fetchEmployeePayroll, fetchSalaryTransactions } from '../api/payroll'
import ColumnChooser from '../components/ui/ColumnChooser'
import DraggableTh from '../components/ui/DraggableTh'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import { EmptyState, ErrorState, LoadingState, Panel } from '../components/ui/PageState'
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
  tableHeadClass,
} from '../utils/ui'

const PAGE_SIZES = [10, 20, 50]

const PAYOUT_COLUMNS = [
  { id: 'name', label: 'Name' },
  { id: 'empId', label: 'Emp ID' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'status', label: 'Status' },
  { id: 'category', label: 'Category' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'basic', label: 'Basic' },
  { id: 'pf', label: 'PF' },
  { id: 'esi', label: 'ESI' },
  { id: 'recentPayment', label: 'Recent payment' },
  { id: 'payoutMode', label: 'Payout mode' },
  { id: 'effectiveDate', label: 'Effective date' },
]

const PAYOUT_COLUMN_IDS = PAYOUT_COLUMNS.map((c) => c.id)

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
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
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

const renderPayoutCell = (colId, row) => {
  switch (colId) {
    case 'name':
      return (
        <td key={colId} className="px-3 py-2.5 font-medium text-stone-900">
          {row.name}
        </td>
      )
    case 'empId':
      return (
        <td key={colId} className="whitespace-nowrap px-3 py-2.5 text-stone-600">
          {row.employeeId || '—'}
        </td>
      )
    case 'email':
      return (
        <td key={colId} className="max-w-[14rem] truncate px-3 py-2.5 text-stone-600">
          {row.email ? (
            <a className="text-sky-600 hover:underline" href={`mailto:${row.email}`}>
              {row.email}
            </a>
          ) : (
            '—'
          )}
        </td>
      )
    case 'phone':
      return (
        <td key={colId} className="whitespace-nowrap px-3 py-2.5 text-stone-600">
          {row.mobile || '—'}
        </td>
      )
    case 'status':
      return (
        <td key={colId} className="px-3 py-2.5">
          {row.isActive == null ? (
            '—'
          ) : (
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                row.isActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-stone-100 text-stone-500'
              }`}
            >
              {row.isActive ? 'Active' : 'Inactive'}
            </span>
          )}
        </td>
      )
    case 'category':
      return (
        <td key={colId} className="px-3 py-2.5 text-stone-600">
          {row.category || '—'}
        </td>
      )
    case 'vendor':
      return (
        <td key={colId} className="px-3 py-2.5 text-stone-600">
          {row.vendorName || '—'}
        </td>
      )
    case 'basic':
      return (
        <td key={colId} className="whitespace-nowrap px-3 py-2.5 tabular-nums text-stone-700">
          {money(row.basicSalary)}
        </td>
      )
    case 'pf':
      return (
        <td key={colId} className="whitespace-nowrap px-3 py-2.5 tabular-nums text-stone-700">
          {money(row.pfAmount)}
        </td>
      )
    case 'esi':
      return (
        <td key={colId} className="whitespace-nowrap px-3 py-2.5 tabular-nums text-stone-700">
          {money(row.esiAmount)}
        </td>
      )
    case 'recentPayment':
      return (
        <td key={colId} className="whitespace-nowrap px-3 py-2.5 tabular-nums text-stone-700">
          {money(row.recentPayment)}
        </td>
      )
    case 'payoutMode':
      return (
        <td key={colId} className="px-3 py-2.5 text-stone-600">
          {formatLabel(row.payoutMode)}
        </td>
      )
    case 'effectiveDate':
      return (
        <td key={colId} className="whitespace-nowrap px-3 py-2.5 text-stone-600">
          {formatDate(row.effectiveDate)}
        </td>
      )
    default:
      return null
  }
}

const StaffPayoutsPage = () => {
  const access = useAccess()
  const tenantSlug = resolveCatalogTenantSlug(access.tenant)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [searchApplied, setSearchApplied] = useState('')
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)
  const [count, setCount] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [hasPrevious, setHasPrevious] = useState(false)

  const { columnOrder, moveColumn } = useColumnOrder(
    'sc_ops_staff_payouts_col_order_v2',
    PAYOUT_COLUMN_IDS,
  )
  const { visibleIds, toggleColumn, showAll, showDefault } = useColumnVisibility(
    'sc_ops_staff_payouts_col_visible_v2',
    PAYOUT_COLUMN_IDS,
  )
  const visibleColumns = useMemo(
    () =>
      columnOrder
        .filter((id) => visibleIds.includes(id))
        .map((id) => PAYOUT_COLUMNS.find((c) => c.id === id))
        .filter(Boolean),
    [columnOrder, visibleIds],
  )

  const [ledger, setLedger] = useState({
    open: false,
    employee: null,
    rows: [],
    loading: false,
    error: '',
  })

  const load = useCallback(async () => {
    if (!tenantSlug) {
      setRows([])
      setCount(0)
      setHasNext(false)
      setHasPrevious(false)
      setLoadError('')
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      const data = await fetchEmployeePayroll(tenantSlug, {
        page,
        pageSize,
        search: searchApplied,
      })
      setRows(data.results || [])
      setCount(data.count ?? 0)
      setHasNext(Boolean(data.next))
      setHasPrevious(Boolean(data.previous))
    } catch (err) {
      setRows([])
      setCount(0)
      setHasNext(false)
      setHasPrevious(false)
      setLoadError(apiErrorMessage(err, 'Could not load staff for payouts.'))
    } finally {
      setLoading(false)
    }
  }, [tenantSlug, page, pageSize, searchApplied])

  useEffect(() => {
    load()
  }, [load])

  const applySearch = (e) => {
    e?.preventDefault?.()
    setPage(1)
    setSearchApplied(search.trim())
  }

  const openLedger = async (employee) => {
    setLedger({
      open: true,
      employee,
      rows: [],
      loading: true,
      error: '',
    })
    try {
      const list = await fetchSalaryTransactions(tenantSlug, { userId: employee.id })
      const sorted = [...list].sort((a, b) =>
        String(b.paidAt || b.createdAt).localeCompare(String(a.paidAt || a.createdAt)),
      )
      setLedger({
        open: true,
        employee,
        rows: sorted,
        loading: false,
        error: '',
      })
    } catch (err) {
      setLedger({
        open: true,
        employee,
        rows: [],
        loading: false,
        error: apiErrorMessage(err, 'Could not load salary transactions.'),
      })
    }
  }

  const closeLedger = () =>
    setLedger({ open: false, employee: null, rows: [], loading: false, error: '' })

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={access.tenant?.name || 'Manage Staff'}
        title="Staff payouts"
        description="Salary payout transactions for staff in this tenant."
      />

      {!tenantSlug ? (
        <StatusBanner type="warning" message="Select a tenant to load staff payouts." />
      ) : null}
      {!tenantSlug ? (
        <Panel>
          <EmptyState bare title="No tenant selected" hint="Choose a tenant to view payouts." />
        </Panel>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <form onSubmit={applySearch} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <div className="relative min-w-[12rem] flex-1 sm:max-w-sm">
                <FiSearch
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
                  aria-hidden
                />
                <input
                  className={`${fieldClass} pl-9`}
                  placeholder="Search staff…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search staff"
                />
              </div>
              <button type="submit" className={btnSecondary}>
                Search
              </button>
            </form>
            <ColumnChooser
              columns={PAYOUT_COLUMNS}
              visibleIds={visibleIds}
              onToggle={(id) => toggleColumn(id, { minVisible: 1 })}
              onShowAll={showAll}
              onShowDefault={showDefault}
            />
            <label className="flex items-center gap-2 text-sm text-stone-600">
              <span className="sr-only">Rows per page</span>
              <select
                className={`${fieldClass} w-auto`}
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value) || 20)
                  setPage(1)
                }}
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loading ? (
            <Panel>
              <LoadingState label="Loading staff…" />
            </Panel>
          ) : loadError ? (
            <Panel>
              <ErrorState bare message={loadError} onRetry={load} />
            </Panel>
          ) : rows.length === 0 ? (
            <Panel>
              <EmptyState bare title="No staff found" hint="Try another search or check payroll setup." />
            </Panel>
          ) : (
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className={tableHeadClass}>
                    <tr>
                      {visibleColumns.map((col) => (
                        <DraggableTh key={col.id} id={col.id} onReorder={moveColumn}>
                          {col.label}
                        </DraggableTh>
                      ))}
                      <th className="px-3 py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {rows.map((row) => (
                      <tr key={row.id} className="hover:bg-stone-50">
                        {visibleColumns.map((col) => renderPayoutCell(col.id, row))}
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            className={btnGhost}
                            onClick={() => openLedger(row)}
                          >
                            View payouts
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 px-3 py-2.5 text-sm text-stone-600">
                <span>
                  {count ? `${count} staff` : `${rows.length} on this page`}
                  {page ? ` · Page ${page}` : ''}
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
        </>
      )}

      <Modal
        open={ledger.open}
        title={
          ledger.employee
            ? `Payouts · ${ledger.employee.name}`
            : 'Salary transactions'
        }
        onClose={closeLedger}
        wide
        footer={
          <div className="flex justify-end">
            <button type="button" className={btnPrimary} onClick={closeLedger}>
              Close
            </button>
          </div>
        }
      >
        {ledger.employee?.employeeId ? (
          <p className="mb-3 text-sm text-stone-600">Emp ID · {ledger.employee.employeeId}</p>
        ) : null}
        {ledger.error ? <StatusBanner type="error" message={ledger.error} /> : null}
        {ledger.loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-stone-600">
            <FiLoader className="h-4 w-4 animate-spin" aria-hidden />
            Loading salary transactions…
          </div>
        ) : ledger.rows.length === 0 ? (
          <EmptyState
            bare
            title="No payout transactions"
            hint="Record payouts from Payroll history when salary reports are ready."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table className="min-w-full text-left text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Method</th>
                  <th className="px-3 py-2">Reference</th>
                  <th className="px-3 py-2">Report</th>
                  <th className="px-3 py-2">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {ledger.rows.map((txn) => (
                  <tr key={txn.id} className="hover:bg-stone-50">
                    <td className="px-3 py-2 text-stone-700">
                      {formatDateTime(txn.paidAt || txn.createdAt)}
                    </td>
                    <td className="px-3 py-2 font-medium tabular-nums text-stone-900">
                      {money(txn.amountPaid)}
                    </td>
                    <td className="px-3 py-2 text-stone-600">
                      {formatLabel(txn.paymentMethod)}
                    </td>
                    <td className="px-3 py-2 text-stone-600">
                      {txn.paymentReference || '—'}
                    </td>
                    <td className="px-3 py-2 text-stone-600">
                      {txn.salaryReportId || '—'}
                    </td>
                    <td className="max-w-[14rem] truncate px-3 py-2 text-stone-500" title={txn.note}>
                      {txn.note || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default StaffPayoutsPage
