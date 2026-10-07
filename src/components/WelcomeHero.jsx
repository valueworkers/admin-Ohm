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
  const name =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() ||
    user?.email?.split('@')[0] ||
    (platform ? 'Super Admin' : 'there')

  const dateLabel = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <section className="overflow-hidden rounded-xl bg-gradient-to-r from-slate-900 to-sky-800 p-6 text-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-white/70">{dateLabel}</p>
          <h1 className="mt-1 text-2xl font-bold">
            {greeting(now.getHours())}, {name}
          </h1>
          <p className="mt-1 text-sm text-white/80">
            {platform
              ? 'Platform console — onboard tenants, approve Lobby requests, inspect orgs read-only.'
              : `Managing ${selectedName || 'your organization'} — full edit access to your catalog and ops.`}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
          <FiShield className="h-3.5 w-3.5" aria-hidden />
          {ROLE_LABEL[role] || (platform ? 'Super Admin' : 'Tenant Admin')}
        </span>
      </div>
    </section>
  )
}

export default WelcomeHero
