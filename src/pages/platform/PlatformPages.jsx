import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiEye, FiRefreshCw } from 'react-icons/fi'
import PageHeader from '../../components/ui/PageHeader'
import StatusBanner from '../../components/ui/StatusBanner'
import { EmptyState, Panel } from '../../components/ui/PageState'
import {
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
                <th key={c.key} className="px-4 py-3">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-3 text-slate-700">
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
              <Link to={`/tenants/${t.id}`} className="text-sky-700 hover:underline">
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
        emptyHint="Tenant owners create bookings inside their organizations."
        rows={rows}
        columns={[
          { key: 'tenant_name', label: 'Tenant' },
          {
            key: 'patient_name',
            label: 'Patient',
            render: (r) => <span className="font-medium text-slate-900">{r.patient_name}</span>,
          },
          { key: 'service_name', label: 'Service' },
          {
            key: 'scheduled_at',
            label: 'When',
            render: (r) =>
              r.scheduled_at ? new Date(r.scheduled_at).toLocaleString('en-IN') : '—',
          },
          {
            key: 'amount',
            label: 'Amount',
            render: (r) => `₹${Number(r.amount || 0).toLocaleString('en-IN')}`,
          },
          { key: 'status', label: 'Status' },
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
        emptyHint="Patients appear when tenant owners add them."
        rows={rows}
        columns={[
          { key: 'tenant_name', label: 'Tenant' },
          {
            key: 'name',
            label: 'Name',
            render: (r) => <span className="font-medium text-slate-900">{r.name}</span>,
          },
          { key: 'age', label: 'Age' },
          { key: 'phone', label: 'Phone' },
          { key: 'city', label: 'City' },
          { key: 'condition', label: 'Condition' },
          { key: 'status', label: 'Status' },
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
        emptyHint="Tenant owners manage their own staff lists."
        rows={rows}
        columns={[
          { key: 'tenant_name', label: 'Tenant' },
          {
            key: 'name',
            label: 'Name',
            render: (r) => (
              <span className="font-medium text-slate-900">
                {[r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' ') ||
                  r.name ||
                  '—'}
              </span>
            ),
          },
          {
            key: 'employee_id',
            label: 'Employee ID',
            render: (r) => r.employee_profile?.employee_id || r.id,
          },
          { key: 'mobile_number', label: 'Mobile', render: (r) => r.mobile_number || r.phone || '—' },
          {
            key: 'designation',
            label: 'Designation',
            render: (r) => r.employee_profile?.designation || r.role || '—',
          },
          { key: 'user_type', label: 'User type' },
          {
            key: 'is_active',
            label: 'Active',
            render: (r) => (r.is_active !== false ? 'Yes' : 'No'),
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
  const [status, setStatus] = useState({ type: '', message: '' })

  const restore = () => {
    if (!reactivate) return
    updateTenantStatus(reactivate.id, 'active', { approved_at: new Date().toISOString() })
    setStatus({ type: 'success', message: `${reactivate.name} restored to active tenants.` })
    setReactivate(null)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Platform"
        title="Offboarded"
        description="Organizations removed from active service. You can restore them to Tenants."
      />
      <StatusBanner type={status.type} message={status.message} />
      <div className={tableWrapClass}>
        {rows.length === 0 ? (
          <EmptyState bare title="No offboarded tenants" hint="Rejected or offboarded orgs show up here." />
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
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{row.owner_name}</div>
                      <div className="text-xs text-slate-400">{row.owner_email}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.city}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link to={`/tenants/${row.id}`} className={btnGhost}>
                          <FiEye className="h-3.5 w-3.5" aria-hidden />
                          View
                        </Link>
                        <button type="button" className={btnPrimary} onClick={() => setReactivate(row)}>
                          Restore
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
