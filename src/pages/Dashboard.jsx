import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowRight, FiCalendar, FiInbox, FiLayers, FiMapPin, FiUsers } from 'react-icons/fi'
import WelcomeHero from '../components/WelcomeHero'
import { Panel } from '../components/ui/PageState'
import { fetchOnboardingRequests } from '../api/onboarding'
import { useAccess } from '../hooks/useAccess'
import { usePlatformTenants } from '../hooks/usePlatformTenants'
import { platformStats } from '../store/platformStore'

const formatAmount = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0)

const homeCardClass =
  'group rounded-xl border border-stone-200/90 bg-white px-3.5 py-3 transition-colors duration-150 hover:border-brand-200 hover:bg-brand-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30'

const Stat = ({ label, value }) => (
  <Panel className="!p-3">
    <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">{label}</p>
    <p className="mt-0.5 text-xl font-bold tracking-tight text-stone-900">{value}</p>
  </Panel>
)

const QuickLink = ({ to, icon: Icon, title, hint }) => (
  <Link to={to} className={homeCardClass}>
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-stone-900">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
          {title}
        </p>
        <p className="mt-1 pl-9 text-xs text-stone-500">{hint}</p>
      </div>
      <FiArrowRight className="h-4 w-4 shrink-0 text-stone-300" aria-hidden />
    </div>
  </Link>
)

const isOpenLobby = (status) => {
  const s = String(status || '').toLowerCase()
  return s === 'submitted' || s === 'pending' || !s
}

const Dashboard = () => {
  const { isSuperAdmin, tenantId, tenant } = useAccess()
  const stats = platformStats(isSuperAdmin ? null : tenantId)
  const { tenants, selected, loading: tenantsLoading } = usePlatformTenants()
  const [lobbyPending, setLobbyPending] = useState(null)
  const orgName = tenant?.name || selected?.name

  const tenantCount = useMemo(
    () =>
      tenants.filter((t) => {
        const s = String(t.status || '').toLowerCase()
        return s !== 'suspended' && s !== 'offboarded' && s !== 'failed'
      }).length,
    [tenants]
  )

  useEffect(() => {
    if (!isSuperAdmin) return undefined
    let mounted = true
    fetchOnboardingRequests()
      .then((list) => {
        if (!mounted) return
        setLobbyPending(list.filter((r) => isOpenLobby(r.status)).length)
      })
      .catch(() => {
        if (mounted) setLobbyPending(0)
      })
    return () => {
      mounted = false
    }
  }, [isSuperAdmin])

  if (!isSuperAdmin) {
    return (
      <div className="space-y-3">
        <WelcomeHero selectedName={orgName} />

        <div className="sc-stagger grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="No of Vendors" value={stats.vendors} />
          <Stat label="No of Employees" value={stats.employees} />
          <Stat label="No of Bookings" value={stats.bookings} />
          <Stat label="Amount Collected" value={formatAmount(stats.revenue)} />
        </div>

        <div className="sc-stagger grid gap-2 md:grid-cols-3">
          <QuickLink to="/ops/venues" icon={FiMapPin} title="Venues" hint="Locations for this organization" />
          <QuickLink to="/ops/bookings" icon={FiCalendar} title="Bookings" hint="Orders and schedules" />
          <QuickLink to="/ops/customers" icon={FiUsers} title="Customers" hint="Patient / customer master" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <WelcomeHero selectedName={selected?.name} />

      <div className="sc-stagger grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="No of Tenants" value={tenantsLoading ? '…' : tenantCount} />
        <Stat label="No of Vendors" value={stats.vendors} />
        <Stat label="No of Employees" value={stats.employees} />
        <Stat label="No of Bookings" value={stats.bookings} />
        <Stat label="Amount Collected" value={formatAmount(stats.revenue)} />
      </div>

      <div className="sc-stagger grid gap-2 md:grid-cols-2">
        <QuickLink
          to="/lobby"
          icon={FiInbox}
          title="Tenant Lobby"
          hint={
            lobbyPending == null
              ? 'Approve onboarding requests'
              : lobbyPending
                ? `${lobbyPending} waiting for approval`
                : 'Approve onboarding requests'
          }
        />
        <QuickLink
          to="/tenants"
          icon={FiLayers}
          title="Manage Tenants"
          hint="Add, edit, or delete organizations"
        />
      </div>
    </div>
  )
}

export default Dashboard
