import { Link } from 'react-router-dom'
import {
  FiActivity,
  FiArrowRight,
  FiCalendar,
  FiInbox,
  FiLayers,
  FiSettings,
  FiShield,
  FiUsers,
} from 'react-icons/fi'
import WelcomeHero from '../components/WelcomeHero'
import { Panel } from '../components/ui/PageState'
import { listTenantsByStatus, platformStats } from '../store/platformStore'
import { cardLinkClass } from '../utils/ui'

const Stat = ({ label, value }) => (
  <Panel className="p-4">
    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
  </Panel>
)

const Dashboard = () => {
  const stats = platformStats(null)
  const pending = listTenantsByStatus('pending')

  const cards = [
    ['/lobby', FiInbox, 'Lobby', pending.length ? `${pending.length} waiting` : 'Approve onboarding requests'],
    ['/tenants', FiLayers, 'Tenants', 'Active orgs · read-only inspect'],
    ['/platform/analytics', FiActivity, 'Analytics', 'Cross-tenant KPIs'],
    ['/platform/bookings', FiCalendar, 'All bookings', 'Platform-wide orders'],
    ['/platform/owners', FiUsers, 'Owners', 'Tenant owner directory'],
    ['/platform/permissions', FiShield, 'Permissions', 'Toggle tenant module access'],
    ['/platform/settings', FiSettings, 'Settings', 'Reset demo data'],
  ]

  return (
    <div className="space-y-5">
      <WelcomeHero />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active tenants" value={stats.tenantsActive} />
        <Stat label="Lobby pending" value={stats.tenantsPending} />
        <Stat label="Bookings (all)" value={stats.bookings} />
        <Stat label="Patients (all)" value={stats.patients} />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(([to, Icon, title, hint]) => (
          <Link key={to} to={to} className={cardLinkClass}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="inline-flex items-center gap-2 text-base font-semibold text-slate-900">
                  <Icon className="h-4 w-4 text-sky-600" aria-hidden />
                  {title}
                </p>
                <p className="mt-1 text-sm text-slate-500">{hint}</p>
              </div>
              <FiArrowRight className="mt-1 h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default Dashboard
