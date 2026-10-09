import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiEye, FiRefreshCw, FiTrash2 } from 'react-icons/fi'
import PageHeader from '../../components/ui/PageHeader'
import StatusBanner from '../../components/ui/StatusBanner'
import { EmptyState, Panel } from '../../components/ui/PageState'
import {
  deleteTenant,
  getTenant,
  listCollection,
  listTenantsByStatus,
  platformStats,
  resetPlatformStore,
  subscribePlatform,
  updateTenantStatus,
} from '../../store/platformStore'
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  tableHeadClass,
  tableWrapClass,
} from '../../utils/ui'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

const useLive = (loader) => {
  const ref = useRef(loader)
  ref.current = loader
  const [data, setData] = useState(loader)
  useEffect(() => subscribePlatform(() => setData(ref.current())), [])
  return data
}

const fmtDate = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-IN')
}

const bookingStatusChip = (status) => {
  const s = String(status || '').toUpperCase()
  if (s === 'ACTIVE' || s === 'CONFIRMED') return 'bg-emerald-50 text-emerald-800'
  if (s === 'PENDING') return 'bg-amber-50 text-amber-900'
  if (s === 'EXPIRED' || s === 'CANCELLED') return 'bg-rose-50 text-rose-800'
  if (s === 'COMPLETED') return 'bg-brand-50 text-brand-800'
  return 'bg-slate-100 text-slate-700'
}

const patientDisplayName = (row) =>
  [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || row.name || '—'

const employeeFullName = (row) =>
  [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ') || row.name || '—'

const ReadOnlyTable = ({ columns, rows, emptyTitle, emptyHint }) => (
  <div className={tableWrapClass}>
    {rows.length === 0 ? (
      <EmptyState bare title={emptyTitle} hint={emptyHint} />
    ) : (
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className={tableHeadClass}>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="px-3 py-3 whitespace-nowrap">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-3 text-slate-700 ${c.cellClass || ''}`}>
                    {c.render ? c.render(row) : row[c.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
)

const withTenantName = (rows) =>
  rows.map((r) => ({
    ...r,
    tenant_name: getTenant(r.tenantId)?.name || r.tenantId || '—',
  }))

export const PlatformAnalytics = () => {
  const stats = useLive(() => platformStats(null))
  const tenants = useLive(() => listCollection('tenants'))
  const active = tenants.filter((t) => t.status === 'active')

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Platform"
        title="Platform analytics"
        description="Cross-tenant snapshot. All figures are read-only aggregates from demo data."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Active tenants', stats.tenantsActive],
          ['Lobby pending', stats.tenantsPending],
          ['Booking value', `₹${stats.revenue.toLocaleString('en-IN')}`],
          ['Total bookings', stats.bookings],
          ['Patients', stats.patients],
          ['Employees', stats.employees],
          ['Services', stats.services],
          ['Vendors', stats.vendors],
        ].map(([label, value]) => (
          <Panel key={label} className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          </Panel>
        ))}
      </div>
      <Panel>
        <p className="text-base font-semibold text-slate-900">Active tenants</p>
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {active.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-2">
              <span className="font-medium text-slate-800">{t.name}</span>
              <Link to={`/tenants/${t.id}`} className="text-brand-700 hover:underline">
                Inspect
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}

export const PlatformBookings = () => {
  const rows = useLive(() => withTenantName(listCollection('bookings')))
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Platform · Read only"
        title="All bookings"
        description="Orders across every tenant. Super Admin cannot edit bookings."
      />
      <ReadOnlyTable
        emptyTitle="No bookings"
        emptyHint="Bookings appear from tenant demo data."
        rows={rows}
        columns={[
          {
            key: 'tenant_name',
            label: 'Tenant',
            cellClass: 'whitespace-nowrap font-medium text-slate-900',
          },
          {
            key: 'order_id',
            label: 'Order ID',
            cellClass: 'whitespace-nowrap font-medium text-slate-900',
            render: (r) => r.order_id || r.id,
          },
          {
            key: 'patient_name',
            label: 'Patient name',
            cellClass: 'whitespace-nowrap font-medium text-slate-900',
            render: (r) => r.patient_name || '—',
          },
          {
            key: 'patient_id',
            label: 'Patient ID',
            cellClass: 'whitespace-nowrap',
            render: (r) => r.patient_id || '—',
          },
          {
            key: 'phone',
            label: 'Phone',
            cellClass: 'whitespace-nowrap',
            render: (r) => r.phone || '—',
          },
          { key: 'age', label: 'Age', render: (r) => r.age ?? '—' },
          {
            key: 'package_name',
            label: 'Package name',
            cellClass: 'max-w-[160px]',
            render: (r) => <span className="line-clamp-2">{r.package_name || '—'}</span>,
          },
          {
            key: 'service_name',
            label: 'Service name',
            cellClass: 'max-w-[140px]',
            render: (r) => <span className="line-clamp-2">{r.service_name || '—'}</span>,
          },
          {
            key: 'location_type',
            label: 'Location type',
            cellClass: 'whitespace-nowrap',
            render: (r) => (r.location_type || '—').toString().replace(/_/g, ' '),
          },
          {
            key: 'locality',
            label: 'Locality',
            cellClass: 'whitespace-nowrap',
            render: (r) => r.locality || '—',
          },
          {
            key: 'location',
            label: 'Location',
            cellClass: 'max-w-[160px]',
            render: (r) => <span className="line-clamp-2">{r.location || '—'}</span>,
          },
          {
            key: 'starting_date',
            label: 'Starting date',
            cellClass: 'whitespace-nowrap',
            render: (r) => fmtDate(r.starting_date || r.scheduled_at),
          },
          {
            key: 'ending_date',
            label: 'Ending date',
            cellClass: 'whitespace-nowrap',
            render: (r) => fmtDate(r.ending_date),
          },
          {
            key: 'status',
            label: 'Status',
            cellClass: 'whitespace-nowrap',
            render: (r) => (
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${bookingStatusChip(r.status)}`}
              >
                {r.status || '—'}
              </span>
            ),
          },
          {
            key: 'auto_renew',
            label: 'Auto-renew',
            cellClass: 'whitespace-nowrap',
            render: (r) => (r.auto_renew ? 'Yes' : 'No'),
          },
          {
            key: 'emergency_contact',
            label: 'Emergency contact',
            cellClass: 'whitespace-nowrap',
            render: (r) =>
              r.emergency_contact_name || r.emergency_contact_phone ? (
                <div>
                  <div className="font-medium text-slate-900">
                    {r.emergency_contact_name || '—'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {r.emergency_contact_phone || '—'}
                  </div>
                </div>
              ) : (
                '—'
              ),
          },
        ]}
      />
    </div>
  )
}

export const PlatformPatients = () => {
  const rows = useLive(() => withTenantName(listCollection('patients')))
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Platform · Read only"
        title="All patients"
        description="Patient directory across tenants (read-only)."
      />
      <ReadOnlyTable
        emptyTitle="No patients"
        emptyHint="Patients appear from tenant demo data."
        rows={rows}
        columns={[
          {
            key: 'tenant_name',
            label: 'Tenant',
            cellClass: 'whitespace-nowrap font-medium text-slate-900',
          },
          {
            key: 'patient_id',
            label: 'Patient ID',
            cellClass: 'whitespace-nowrap font-medium text-slate-900',
            render: (r) => r.patient_id || r.id,
          },
          {
            key: 'full_name',
            label: 'Full name',
            cellClass: 'whitespace-nowrap font-semibold text-slate-900',
            render: (r) => patientDisplayName(r),
          },
          {
            key: 'phone',
            label: 'Phone',
            cellClass: 'whitespace-nowrap',
            render: (r) => r.phone || '—',
          },
          { key: 'age', label: 'Age', render: (r) => r.age ?? '—' },
          {
            key: 'gender',
            label: 'Gender',
            cellClass: 'capitalize',
            render: (r) => r.gender || '—',
          },
          {
            key: 'location_type',
            label: 'Location type',
            cellClass: 'whitespace-nowrap',
            render: (r) => (r.location_type || '—').toString().replace(/_/g, ' '),
          },
          {
            key: 'locality',
            label: 'Locality',
            cellClass: 'whitespace-nowrap',
            render: (r) => r.booking_locality || r.city || '—',
          },
          {
            key: 'emergency_contact',
            label: 'Emergency contact',
            cellClass: 'whitespace-nowrap',
            render: (r) =>
              r.emergency_contact || r.emergency_phone ? (
                <div>
                  <div className="font-medium text-slate-900">{r.emergency_contact || '—'}</div>
                  <div className="text-xs text-slate-500">{r.emergency_phone || '—'}</div>
                </div>
              ) : (
                '—'
              ),
          },
          {
            key: 'onboarding',
            label: 'Onboarding',
            cellClass: 'whitespace-nowrap',
            render: (r) => fmtDate(r.onboading_date || r.onboarding_date),
          },
          {
            key: 'emr_count',
            label: 'EMR',
            render: (r) => r.emr_count ?? 0,
          },
          {
            key: 'flags',
            label: 'Flags',
            render: (r) => (
              <div className="flex flex-wrap gap-1">
                {r.is_probono ? (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                    Pro bono
                  </span>
                ) : null}
                {r.is_registration_fees_paid ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                    Reg paid
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    Reg unpaid
                  </span>
                )}
              </div>
            ),
          },
          {
            key: 'is_active',
            label: 'Active',
            render: (r) => (
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  r.is_active !== false
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {r.is_active !== false ? 'Yes' : 'No'}
              </span>
            ),
          },
        ]}
      />
    </div>
  )
}

export const PlatformEmployees = () => {
  const rows = useLive(() => withTenantName(listCollection('employees')))
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Platform · Read only"
        title="All employees"
        description="Staff roster across tenants (read-only)."
      />
      <ReadOnlyTable
        emptyTitle="No employees"
        emptyHint="Employees appear from tenant demo data."
        rows={rows}
        columns={[
          {
            key: 'tenant_name',
            label: 'Tenant',
            cellClass: 'whitespace-nowrap font-medium text-slate-900',
          },
          {
            key: 'employee_id',
            label: 'Employee ID',
            cellClass: 'whitespace-nowrap font-medium text-slate-900',
            render: (r) => r.employee_profile?.employee_id || r.id,
          },
          {
            key: 'name',
            label: 'Name',
            render: (r) => (
              <div className="flex items-center gap-2">
                {r.profile_pic ? (
                  <img
                    src={r.profile_pic}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                    {(r.first_name || 'E').slice(0, 1)}
                  </span>
                )}
                <span className="font-semibold whitespace-nowrap text-slate-900">
                  {employeeFullName(r)}
                </span>
              </div>
            ),
          },
          {
            key: 'mobile_number',
            label: 'Mobile',
            cellClass: 'whitespace-nowrap',
            render: (r) => r.mobile_number || r.phone || '—',
          },
          {
            key: 'user_type',
            label: 'User type',
            cellClass: 'whitespace-nowrap',
            render: (r) => r.user_type || '—',
          },
          {
            key: 'designation',
            label: 'Designation',
            render: (r) => r.employee_profile?.designation || r.role || '—',
          },
          { key: 'city', label: 'City', render: (r) => r.city || '—' },
          {
            key: 'venues',
            label: 'Venues',
            render: (r) =>
              (r.venues || []).length
                ? (r.venues || []).map((v) => v.name).join(', ')
                : '—',
          },
          {
            key: 'services',
            label: 'Services',
            cellClass: 'max-w-[180px]',
            render: (r) => (
              <span className="line-clamp-2">
                {(r.services || []).length
                  ? (r.services || []).map((s) => s.name).join(', ')
                  : '—'}
              </span>
            ),
          },
          {
            key: 'reports_to',
            label: 'Reports to',
            cellClass: 'whitespace-nowrap',
            render: (r) => r.reports_to?.name || '—',
          },
          {
            key: 'date_joined',
            label: 'Joined',
            cellClass: 'whitespace-nowrap',
            render: (r) => r.date_joined || '—',
          },
          {
            key: 'is_active',
            label: 'Active',
            render: (r) => (
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  r.is_active !== false
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {r.is_active !== false ? 'Yes' : 'No'}
              </span>
            ),
          },
        ]}
      />
    </div>
  )
}

export const PlatformOwners = () => {
  const users = useLive(() =>
    listCollection('users')
      .filter((u) => u.user_type === 'TENANT_OWNER' || u.user_type === 'VSRE_OWNER')
      .map((u) => ({
        ...u,
        tenant_name: getTenant(u.tenant_id)?.name || '—',
        tenant_status: getTenant(u.tenant_id)?.status || '—',
      }))
  )

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Platform"
        title="Tenant owners"
        description="Owner accounts linked to organizations. Passwords are demo-only."
      />
      <ReadOnlyTable
        emptyTitle="No owners"
        emptyHint="Onboard a tenant to create an owner login."
        rows={users}
        columns={[
          {
            key: 'name',
            label: 'Owner',
            render: (r) => (
              <span className="font-medium text-slate-900">
                {[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}
              </span>
            ),
          },
          { key: 'email', label: 'Email' },
          { key: 'tenant_name', label: 'Organization' },
          { key: 'tenant_status', label: 'Tenant status' },
        ]}
      />
    </div>
  )
}

export const PlatformOffboarded = () => {
  const rows = useLive(() => listTenantsByStatus('offboarded'))
  const [reactivate, setReactivate] = useState(null)
  const [purgeTarget, setPurgeTarget] = useState(null)
  const [status, setStatus] = useState({ type: '', message: '' })

  const restore = () => {
    if (!reactivate) return
    updateTenantStatus(reactivate.id, 'active', { approved_at: new Date().toISOString() })
    setStatus({ type: 'success', message: `${reactivate.name} restored to active tenants.` })
    setReactivate(null)
  }

  const purge = () => {
    if (!purgeTarget) return
    deleteTenant(purgeTarget.id)
    setStatus({ type: 'success', message: `${purgeTarget.name} permanently removed.` })
    setPurgeTarget(null)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Manage Tenants"
        title="Offboarded"
        description="Tenants deleted from the active list appear here. Restore them, or permanently remove demo data."
        actions={
          <Link to="/tenants" className={btnSecondary}>
            Back to Tenants
          </Link>
        }
      />
      <StatusBanner type={status.type} message={status.message} />
      <div className={tableWrapClass}>
        {rows.length === 0 ? (
          <EmptyState
            bare
            title="No offboarded tenants"
            hint="Deleted or rejected organizations show up here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-4 py-3">Tenant</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 font-medium text-stone-900">{row.name}</td>
                    <td className="px-4 py-3 text-stone-600">
                      <div>{row.owner_name}</div>
                      <div className="text-xs text-stone-400">{row.owner_email}</div>
                    </td>
                    <td className="px-4 py-3 text-stone-600">{row.city}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Link to={`/tenants/${row.id}`} className={btnGhost}>
                          <FiEye className="h-3.5 w-3.5" aria-hidden />
                          View
                        </Link>
                        <button
                          type="button"
                          className={btnPrimary}
                          onClick={() => setReactivate(row)}
                        >
                          Restore
                        </button>
                        <button
                          type="button"
                          className={`${btnGhost} text-rose-600 hover:bg-rose-50`}
                          onClick={() => setPurgeTarget(row)}
                        >
                          <FiTrash2 className="h-3.5 w-3.5" aria-hidden />
                          Remove forever
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
      <ConfirmDialog
        open={Boolean(reactivate)}
        title="Restore tenant?"
        message="This sets the organization back to active so the owner can sign in again."
        confirmLabel="Restore"
        onConfirm={restore}
        onClose={() => setReactivate(null)}
      />
      <ConfirmDialog
        open={Boolean(purgeTarget)}
        title="Remove forever?"
        message="This permanently deletes the tenant and related demo records. This cannot be undone."
        confirmLabel="Remove forever"
        onConfirm={purge}
        onClose={() => setPurgeTarget(null)}
      />
    </div>
  )
}

export const PlatformSettings = () => {
  const navigate = useNavigate()
  const [confirmReset, setConfirmReset] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' })
  const seedInfo = useMemo(
    () => [
        ['Theme', 'Sky + slate (ops admin)'],
      ['Data mode', 'Dummy seed + localStorage (sc_platform_v10)'],
      ['Super Admin', 'super@seniorcare.com / admin123'],
    ],
    []
  )

  const doReset = () => {
    resetPlatformStore()
    setConfirmReset(false)
    setStatus({ type: 'success', message: 'Demo data reset to seed.' })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Platform"
        title="Settings"
        description="Demo controls for this admin panel. No live API is configured."
      />
      <StatusBanner type={status.type} message={status.message} />
      <Panel>
        <p className="text-base font-semibold text-slate-900">Environment</p>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          {seedInfo.map(([k, v]) => (
            <li key={k} className="flex justify-between gap-4 border-b border-slate-100 py-2 last:border-0">
              <span>{k}</span>
              <span className="text-right font-medium text-slate-900">{v}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel>
        <p className="text-base font-semibold text-slate-900">Tenant permissions</p>
        <p className="mt-1 text-sm text-slate-500">
          Enable or disable modules (Attendance, Staff payouts, catalog, etc.) per organization.
        </p>
        <div className="mt-4">
          <button
            type="button"
            className={btnPrimary}
            onClick={() => navigate('/platform/permissions')}
          >
            Open Permissions
          </button>
        </div>
      </Panel>
      <Panel>
        <p className="text-base font-semibold text-slate-900">Demo data</p>
        <p className="mt-1 text-sm text-slate-500">
          Reset clears tenants, lobby, permissions, and all ops collections back to the original seed.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={btnPrimary} onClick={() => setConfirmReset(true)}>
            <FiRefreshCw className="h-4 w-4" aria-hidden />
            Reset demo data
          </button>
          <button type="button" className={btnSecondary} onClick={() => navigate('/lobby')}>
            Open Lobby
          </button>
        </div>
      </Panel>
      <ConfirmDialog
        open={confirmReset}
        title="Reset all demo data?"
        message="This cannot be undone. Your current onboarding changes will be lost."
        confirmLabel="Reset"
        onConfirm={doReset}
        onClose={() => setConfirmReset(false)}
      />
    </div>
  )
}
