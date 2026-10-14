import { FiShield } from 'react-icons/fi'
import { getAuthUser, getUserType, isSuperAdmin } from '../utils/auth'

const greeting = (hour) => {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const ROLE_LABEL = {
  SUPER_ADMIN: 'Super Admin',
  TENANT_OWNER: 'Tenant Admin',
  MASTER_ADMIN: 'Super Admin',
  VSRE_OWNER: 'Tenant Admin',
}

const WelcomeHero = ({ selectedName }) => {
  const user = getAuthUser()
  const role = getUserType(user)
  const platform = isSuperAdmin(user)
  const now = new Date()
  const name = platform
    ? 'Super Admin'
    : [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() ||
      user?.organization_name ||
      user?.email?.split('@')[0] ||
      'there'

  const dateLabel = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <section className="relative overflow-hidden rounded-xl border border-stone-200 bg-white px-4 py-3.5 sm:px-5">
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-stone-500">{dateLabel}</p>
          <h1 className="mt-0.5 text-xl font-bold tracking-tight text-stone-900 sm:text-2xl">
            {greeting(now.getHours())}, {name}
          </h1>
          <p className="mt-0.5 max-w-xl text-sm text-stone-600">
            {platform
              ? 'Platform console — onboard tenants, approve Lobby requests, set permissions, inspect orgs.'
              : `Managing ${selectedName || 'your organization'} — full edit access to your catalog and ops.`}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-semibold text-stone-700">
          <FiShield className="h-3.5 w-3.5 text-stone-500" aria-hidden />
          {ROLE_LABEL[role] || (platform ? 'Super Admin' : 'Tenant Admin')}
        </span>
      </div>
    </section>
  )
}

export default WelcomeHero
