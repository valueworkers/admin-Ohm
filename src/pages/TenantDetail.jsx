import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import PageHeader from '../components/ui/PageHeader'
import { Panel } from '../components/ui/PageState'
import EntityCrudPage from '../components/EntityCrudPage'
import BookingsPage from './BookingsPage'
import EmployeesPage from './EmployeesPage'
import PackagesPage from './PackagesPage'
import PatientsPage from './PatientsPage'
import ServicesPage from './ServicesPage'
import VenuesPage from './VenuesPage'
import AttendancePage from './AttendancePage'
import StaffPayoutsPage from './StaffPayoutsPage'
import { FEATURE_CATALOG } from '../config/features'
import { getTenant, platformStats } from '../store/platformStore'
import { btnPrimary, btnSecondary } from '../utils/ui'
import {
  BOOKINGS_TAB,
  EMPLOYEES_TAB,
  MODULE_CONFIG,
  PACKAGES_TAB,
  PATIENTS_TAB,
  SERVICES_TAB,
  VENUES_TAB,
} from '../config/modules'

const ADDON_TABS = [
  { id: 'attendance', label: 'Attendance', feature: 'attendance' },
  { id: 'staff-payouts', label: 'Staff payouts', feature: 'staff_payouts' },
]

const buildTabs = (tenant) => {
  const features = tenant?.features || {}
  return [
    { id: 'overview', label: 'Overview' },
    { id: SERVICES_TAB.collection, label: SERVICES_TAB.title },
    { id: VENUES_TAB.collection, label: VENUES_TAB.title },
    { id: PACKAGES_TAB.collection, label: PACKAGES_TAB.title },
    { id: BOOKINGS_TAB.collection, label: BOOKINGS_TAB.title },
    { id: PATIENTS_TAB.collection, label: PATIENTS_TAB.title },
    { id: EMPLOYEES_TAB.collection, label: EMPLOYEES_TAB.title },
    ...MODULE_CONFIG.map((m) => ({ id: m.collection, label: m.title })),
    ...ADDON_TABS.filter((t) => features[t.feature]),
  ]
}

const OFFBOARD_LABEL = {
  soft_delete: 'Soft delete (reversible)',
  hard_delete: 'Hard delete',
  archive: 'Archive',
}

const SIGNIN_LABEL = {
  email: 'Email only',
  phone: 'Phone only',
  both: 'Email or phone',
}

const TenantDetail = () => {
  const { tenantId } = useParams()
  const tenant = getTenant(tenantId)
  const [tab, setTab] = useState('overview')
  const stats = useMemo(() => (tenant ? platformStats(tenant.id) : null), [tenant])
  const tabs = useMemo(() => buildTabs(tenant), [tenant])

  if (!tenant) {
    return <Navigate to="/tenants" replace />
  }

  const module = MODULE_CONFIG.find((m) => m.collection === tab)
  const settings = tenant.settings || {}

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Platform · Read only"
        title={tenant.name}
        description={[tenant.type, tenant.city, tenant.owner_email].filter(Boolean).join(' · ')}
        actions={
          <>
            <Link to={`/platform/permissions?tenantId=${tenant.id}`} className={btnPrimary}>
              Permissions
            </Link>
            <Link to="/tenants" className={btnSecondary}>
              Back to tenants
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="space-y-3">
          <Panel className="flex flex-wrap items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400">
              {tenant.logo_url ? (
                <img src={tenant.logo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                'No logo'
              )}
            </div>
            <div className="min-w-0 text-sm text-slate-600">
              <p className="text-base font-semibold text-slate-900">{tenant.name}</p>
              <p>
                {tenant.type || '—'}
                {tenant.company_code ? ` · ${tenant.company_code}` : ''}
                {tenant.domain ? ` · ${tenant.domain}` : ''}
              </p>
              <p className="mt-1">{tenant.address || '—'}</p>
            </div>
          </Panel>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Status', tenant.status],
              ['Services', stats.services],
              ['Bookings', stats.bookings],
              ['Patients', stats.patients],
              ['Employees', stats.employees],
              ['Vendors', stats.vendors],
              ['Packages', stats.packages],
              ['Booking value', `₹${stats.revenue.toLocaleString('en-IN')}`],
            ].map(([label, value]) => (
              <Panel key={label} className="p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  {label}
                </p>
                <p className="mt-1 text-lg font-semibold capitalize text-slate-900">{value}</p>
              </Panel>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel>
              <p className="text-base font-semibold text-slate-900">Ops Admin</p>
              {tenant.has_ops_admin === false ? (
                <p className="mt-2 text-sm text-amber-800">No Ops Admin login was created.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  <li>
                    <span className="font-medium text-slate-900">Name:</span> {tenant.owner_name || '—'}
                  </li>
                  <li>
                    <span className="font-medium text-slate-900">Email:</span> {tenant.owner_email || '—'}
                  </li>
                  <li>
                    <span className="font-medium text-slate-900">Phone:</span>{' '}
                    {tenant.owner_phone || tenant.phone || '—'}
                  </li>
                  <li>
                    <span className="font-medium text-slate-900">Role:</span>{' '}
                    {tenant.ops_admin_role_label || 'Ops Admin'}
                  </li>
                </ul>
              )}
            </Panel>
            <Panel>
              <p className="text-base font-semibold text-slate-900">Tenant settings</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                <li>
                  Ops can create vendors:{' '}
                  <span className="font-medium text-slate-900">
                    {settings.ops_can_create_vendors ? 'Yes' : 'No'}
                  </span>
                </li>
                <li>
                  Ops can activate vendors:{' '}
                  <span className="font-medium text-slate-900">
                    {settings.ops_can_activate_vendors ? 'Yes' : 'No'}
                  </span>
                </li>
                <li>
                  Employee offboarding:{' '}
                  <span className="font-medium text-slate-900">
                    {OFFBOARD_LABEL[settings.employee_offboarding] || '—'}
                  </span>
                </li>
                <li>
                  Employee sign-in:{' '}
                  <span className="font-medium text-slate-900">
                    {SIGNIN_LABEL[settings.employee_signin] || '—'}
                  </span>
                </li>
              </ul>
            </Panel>
          </div>

          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-base font-semibold text-slate-900">Feature access</p>
              <Link
                to={`/platform/permissions?tenantId=${tenant.id}`}
                className="text-sm font-medium text-sky-700 hover:underline"
              >
                Manage permissions
              </Link>
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {FEATURE_CATALOG.map((f) => {
                const on = Boolean(tenant.features?.[f.key])
                return (
                  <li
                    key={f.key}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      on ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {f.label}
                    {on ? '' : ' · off'}
                  </li>
                )
              })}
            </ul>
          </Panel>
        </div>
      ) : tab === 'services' ? (
        <ServicesPage
          tenantId={tenant.id}
          canWrite={false}
          eyebrow="Tenant inspection"
        />
      ) : tab === 'venues' ? (
        <VenuesPage
          tenantId={tenant.id}
          canWrite={false}
          eyebrow="Tenant inspection"
        />
      ) : tab === 'packages' ? (
        <PackagesPage
          tenantId={tenant.id}
          canWrite={false}
          eyebrow="Tenant inspection"
        />
      ) : tab === 'bookings' ? (
        <BookingsPage
          tenantId={tenant.id}
          canWrite={false}
          eyebrow="Tenant inspection"
        />
      ) : tab === 'patients' ? (
        <PatientsPage
          tenantId={tenant.id}
          canWrite={false}
          eyebrow="Tenant inspection"
        />
      ) : tab === 'employees' ? (
        <EmployeesPage
          tenantId={tenant.id}
          canWrite={false}
          eyebrow="Tenant inspection"
        />
      ) : tab === 'attendance' ? (
        <AttendancePage />
      ) : tab === 'staff-payouts' ? (
        <StaffPayoutsPage />
      ) : module?.collection === 'vendors' ? (
        <EntityCrudPage
          key={module.collection}
          {...module}
          tenantId={tenant.id}
          canWrite
          eyebrow="Assign to tenant"
          emptyTitle="No vendors assigned"
          emptyHint="Assign a supplier or partner vendor to this organization."
        />
      ) : module ? (
        <EntityCrudPage
          key={module.collection}
          {...module}
          tenantId={tenant.id}
          canWrite={false}
          eyebrow="Tenant inspection"
        />
      ) : null}
    </div>
  )
}

export default TenantDetail
