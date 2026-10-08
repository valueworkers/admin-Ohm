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
      user?.email?.split('@')[0] ||
      'there'

  const dateLabel = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <section className="relative overflow-hidden rounded-2xl bg-slate-900 p-6 text-white shadow-lg shadow-slate-900/10 sm:p-7">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        aria-hidden
        style={{
          background:
            'radial-gradient(80% 120% at 100% 0%, rgba(14,165,233,0.35), transparent 55%), radial-gradient(60% 80% at 0% 100%, rgba(56,189,248,0.12), transparent 50%)',
        }}
      />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-sky-100/70">{dateLabel}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-[1.65rem]">
            {greeting(now.getHours())}, {name}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-white/75">
            {platform
              ? 'Platform console — onboard tenants, approve Lobby requests, set permissions, inspect orgs read-only.'
              : `Managing ${selectedName || 'your organization'} — full edit access to your catalog and ops.`}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
          <FiShield className="h-3.5 w-3.5 text-sky-200" aria-hidden />
          {ROLE_LABEL[role] || (platform ? 'Super Admin' : 'Tenant Admin')}
        </span>
      </div>
    </section>
  )
}

export default WelcomeHero
