import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  FiActivity,
  FiCalendar,
  FiHome,
  FiInbox,
  FiLayers,
  FiLogOut,
  FiMenu,
  FiSettings,
  FiShield,
  FiSidebar,
  FiUserCheck,
  FiUserX,
  FiUsers,
} from 'react-icons/fi'
import ConfirmDialog from './ui/ConfirmDialog'
import { useAccess } from '../hooks/useAccess'
import { clearAuthSession } from '../utils/auth'
import { brandChipClass } from '../utils/ui'

const SIDEBAR_KEY = 'admin_sidebar_collapsed'

const navClass =
  ({ collapsed }) =>
  ({ isActive }) =>
    `flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors ${
      collapsed ? 'justify-center px-0' : 'px-3'
    } ${
      isActive
        ? 'bg-sky-600 text-white'
        : 'text-white/70 hover:bg-white/10 hover:text-white'
    }`

const SectionLabel = ({ collapsed, children }) =>
  collapsed ? null : (
    <p className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-white/35">
      {children}
    </p>
  )

const NavItem = ({ to, end, title, icon: Icon, collapsed, mobileOpen, linkClass, onClick }) => (
  <NavLink to={to} end={end} className={linkClass} onClick={onClick} title={title}>
    <Icon className="h-4 w-4 shrink-0" aria-hidden />
    {!(collapsed && !mobileOpen) ? title : null}
  </NavLink>
)

const Layout = () => {
  const navigate = useNavigate()
  const { user } = useAccess()
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
    } catch {
      // ignore
    }
  }, [collapsed])

  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() ||
    user?.email ||
    'Super Admin'

  const closeMobile = () => setMobileOpen(false)
  const linkClass = navClass({ collapsed: collapsed && !mobileOpen })
  const rail = collapsed && !mobileOpen

  const handleLogout = () => {
    clearAuthSession()
    setLogoutOpen(false)
    navigate('/login', { replace: true })
  }

  const item = (props) => (
    <NavItem
      {...props}
      collapsed={collapsed}
      mobileOpen={mobileOpen}
      linkClass={linkClass}
      onClick={closeMobile}
    />
  )

  const nav = (
    <nav className={`flex-1 space-y-1 overflow-y-auto pb-4 ${rail ? 'px-2' : 'px-3'}`}>
      <SectionLabel collapsed={rail}>Platform</SectionLabel>
      {item({ to: '/', end: true, title: 'Dashboard', icon: FiHome })}
      {item({ to: '/lobby', title: 'Lobby', icon: FiInbox })}
      {item({ to: '/tenants', title: 'Tenants', icon: FiLayers })}
      {item({ to: '/platform/offboarded', title: 'Offboarded', icon: FiUserX })}

      <SectionLabel collapsed={rail}>Insights</SectionLabel>
      {item({ to: '/platform/analytics', title: 'Analytics', icon: FiActivity })}
      {item({ to: '/platform/bookings', title: 'All bookings', icon: FiCalendar })}
      {item({ to: '/platform/patients', title: 'All patients', icon: FiUsers })}
      {item({ to: '/platform/employees', title: 'All employees', icon: FiUserCheck })}

      <SectionLabel collapsed={rail}>Directory</SectionLabel>
      {item({ to: '/platform/owners', title: 'Owners', icon: FiUsers })}
      {item({ to: '/platform/permissions', title: 'Permissions', icon: FiShield })}
      {item({ to: '/platform/settings', title: 'Settings', icon: FiSettings })}
    </nav>
  )

  return (
    <div className="flex min-h-screen bg-slate-100">
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-900/50 md:hidden"
          aria-label="Close menu"
          onClick={closeMobile}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-slate-900 transition-transform duration-200 md:static md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'md:w-16' : 'md:w-60'}`}
      >
        <div
          className={`flex h-14 items-center border-b border-white/10 ${
            rail ? 'justify-center px-0' : 'px-4'
          }`}
        >
          <span className="text-sm font-bold tracking-tight text-white">
            {rail ? 'SC' : 'Senior Care'}
          </span>
        </div>
        {nav}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 md:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <FiMenu className="h-[18px] w-[18px]" aria-hidden />
            </button>
            <button
              type="button"
              className="hidden rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 md:inline-flex"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <FiSidebar className="h-[18px] w-[18px]" aria-hidden />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
              <p className="truncate text-xs text-slate-500">Platform · Super Admin</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`hidden sm:inline ${brandChipClass}`}>SUPER_ADMIN</span>
            <button
              type="button"
              onClick={() => setLogoutOpen(true)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm text-slate-500 transition-colors hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30 sm:min-h-0"
              aria-label="Logout"
            >
              <FiLogOut className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-6">
          <div className="mx-auto max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>

      <ConfirmDialog
        open={logoutOpen}
        title="Log out?"
        message="You will need to sign in again with the Super Admin account."
        confirmLabel="Logout"
        onConfirm={handleLogout}
        onClose={() => setLogoutOpen(false)}
      />
    </div>
  )
}

export default Layout
