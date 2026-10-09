import { Link } from 'react-router-dom'
import { FiArrowRight, FiCalendar, FiInbox, FiLayers, FiMapPin, FiUsers } from 'react-icons/fi'
import WelcomeHero from '../components/WelcomeHero'
import { Panel } from '../components/ui/PageState'
import { useAccess } from '../hooks/useAccess'
import { usePlatformTenants } from '../hooks/usePlatformTenants'
import { listTenantsByStatus, platformStats } from '../store/platformStore'
import { cardLinkClass } from '../utils/ui'

const formatAmount = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0)

const Stat = ({ label, value }) => (
  <Panel className="p-4">
    <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">{label}</p>
    <p className="mt-1 text-2xl font-bold tracking-tight text-stone-900">{value}</p>
  </Panel>
)

const Dashboard = () => {
  const { isSuperAdmin, tenantId, tenant } = useAccess()
  const stats = platformStats(isSuperAdmin ? null : tenantId)
  const pending = listTenantsByStatus('pending')
  const { selected } = usePlatformTenants()
  const orgName = tenant?.name || selected?.name

  if (!isSuperAdmin) {
    return (
      <div className="space-y-5">
        <WelcomeHero selectedName={orgName} />

        <div className="sc-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="No of Vendors" value={stats.vendors} />
          <Stat label="No of Employees" value={stats.employees} />
          <Stat label="No of Bookings" value={stats.bookings} />
          <Stat label="Amount Collected" value={formatAmount(stats.revenue)} />
        </div>

        <div className="sc-stagger grid gap-3 md:grid-cols-3">
          {[
            ['/ops/venues', FiMapPin, 'Venues', 'Locations for this organization'],
            ['/ops/bookings', FiCalendar, 'Bookings', 'Orders and schedules'],
            ['/ops/customers', FiUsers, 'Customers', 'Patient / customer master'],
          ].map(([to, Icon, title, hint]) => (
            <Link key={to} to={to} className={cardLinkClass}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="inline-flex items-center gap-2 text-base font-semibold text-stone-900">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    {title}
                  </p>
                  <p className="mt-2 text-sm text-stone-500">{hint}</p>
                </div>
                <FiArrowRight className="mt-1 h-4 w-4 text-stone-300" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <WelcomeHero selectedName={selected?.name} />

      <div className="sc-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="No of Tenants" value={stats.tenantsActive} />
        <Stat label="No of Vendors" value={stats.vendors} />
        <Stat label="No of Employees" value={stats.employees} />
        <Stat label="No of Bookings" value={stats.bookings} />
        <Stat label="Amount Collected" value={formatAmount(stats.revenue)} />
      </div>

      <div className="sc-stagger grid gap-3 md:grid-cols-2">
        <Link to="/lobby" className={cardLinkClass}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-2 text-base font-semibold text-stone-900">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                  <FiInbox className="h-4 w-4" aria-hidden />
                </span>
                Tenant Lobby
              </p>
              <p className="mt-2 text-sm text-stone-500">
                {pending.length
                  ? `${pending.length} waiting for approval`
                  : 'Approve onboarding requests'}
              </p>
            </div>
            <FiArrowRight className="mt-1 h-4 w-4 text-stone-300" />
          </div>
        </Link>
        <Link to="/tenants" className={cardLinkClass}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-2 text-base font-semibold text-stone-900">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                  <FiLayers className="h-4 w-4" aria-hidden />
                </span>
                Manage Tenants
              </p>
              <p className="mt-2 text-sm text-stone-500">Add, edit, or delete organizations</p>
            </div>
            <FiArrowRight className="mt-1 h-4 w-4 text-stone-300" />
          </div>
        </Link>
      </div>
    </div>
  )
}

export default Dashboard
