import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { FiLogOut, FiMenu, FiMinus, FiPlus, FiSidebar } from 'react-icons/fi'
import ConfirmDialog from './ui/ConfirmDialog'
import { NAV_ITEMS } from '../config/nav'
import { useAccess } from '../hooks/useAccess'
import { usePlatformTenants } from '../hooks/usePlatformTenants'
import { clearAuthSession } from '../utils/auth'
import { brandChipClass, fieldClass } from '../utils/ui'

const SIDEBAR_KEY = 'admin_sidebar_collapsed'
const NAV_OPEN_KEY = 'admin_nav_open_groups'

const navClass =
  ({ collapsed }) =>
  ({ isActive }) =>
    `sc-nav-item relative flex items-center gap-3 rounded-r-lg py-2.5 text-sm font-medium ${
      collapsed ? 'justify-center px-0' : 'px-3'
    } ${
      isActive
        ? 'is-active text-stone-900'
        : 'text-stone-500 hover:bg-stone-50 hover:text-stone-800'
    }`

const loadOpenGroups = () => {
  try {
    const raw = localStorage.getItem(NAV_OPEN_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const Layout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    hasTenantSelected,
    isSuperAdmin,
    isTenantOwner,
    isOpsAdmin,
    tenant,
    user,
    hasFeature,
  } = useAccess()
  const { tenants, selectedId, selectTenant } = usePlatformTenants()
  const displayName =
    user?.full_name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() ||
    user?.email ||
    (isSuperAdmin ? 'Super Admin' : 'Tenant Admin')
  const roleLabel = isSuperAdmin
    ? `Platform · ${user?.role || 'Super Admin'}`
    : `${tenant?.name || 'Organization'} · ${user?.role || (isOpsAdmin ? 'Ops Admin' : 'Tenant Admin')}`
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState(loadOpenGroups)
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

  useEffect(() => {
    try {
      localStorage.setItem(NAV_OPEN_KEY, JSON.stringify(openGroups))
    } catch {
      // ignore
    }
  }, [openGroups])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const pathMatchesEntry = (entry, pathname) => {
    if (!entry) return false
    if (entry.type === 'group') {
      return (entry.children || []).some((c) => pathMatchesEntry(c, pathname))
    }
    if (!entry.to) return false
    return pathname === entry.to || pathname.startsWith(`${entry.to}/`)
  }

  useEffect(() => {
    const toOpen = []
    const walk = (entries, parents = []) => {
      for (const entry of entries || []) {
        if (entry.type !== 'group') continue
        const chain = [...parents, entry.id]
        if (pathMatchesEntry(entry, location.pathname)) {
          toOpen.push(...chain)
        }
        walk(entry.children, chain)
      }
    }
    walk(NAV_ITEMS)
    if (!toOpen.length) return
    setOpenGroups((prev) => {
      const next = new Set(prev)
      toOpen.forEach((id) => next.add(id))
      return [...next]
    })
  }, [location.pathname])

  const closeMobile = () => setMobileOpen(false)
  const linkClass = navClass({ collapsed: collapsed && !mobileOpen })
  const rail = collapsed && !mobileOpen

  const handleLogout = () => {
    clearAuthSession()
    setLogoutOpen(false)
    navigate('/login', { replace: true })
  }

  const toggleGroup = (id) => {
    setOpenGroups((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const allowedForRole = (entry) => {
    if (entry.superOnly && !isSuperAdmin) return false
    if (entry.ownerOnly && !isTenantOwner) return false
    if (isSuperAdmin) return !entry.ownerOnly
    if (!entry.featureKey) return true
    return hasFeature(entry.featureKey)
  }

  const filterNavTree = (entry) => {
    if (!allowedForRole(entry)) return null
    if (entry.type === 'group') {
      const children = (entry.children || []).map(filterNavTree).filter(Boolean)
      if (!children.length) return null
      return { ...entry, children }
    }
    return entry
  }

  const items = useMemo(
    () => NAV_ITEMS.map(filterNavTree).filter(Boolean),
    [isSuperAdmin, isTenantOwner, hasFeature]
  )

  const renderLink = (item, { nested = false, deep = false } = {}) => {
    const locked = isSuperAdmin && item.needsTenant && !hasTenantSelected
    const pad = deep ? 'pl-12' : nested ? 'pl-9' : ''
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        className={({ isActive }) =>
          `${linkClass({ isActive })} ${pad && !rail ? pad : ''} ${
            locked && !isActive ? 'opacity-55' : ''
          }`
        }
        onClick={closeMobile}
        title={locked ? `${item.title} (select a tenant first)` : item.title}
      >
        <item.icon className="h-4 w-4 shrink-0" aria-hidden />
        {!rail ? (
          <span className="min-w-0 truncate">
            {item.title}
            {locked ? (
              <span className="ml-1 text-[10px] font-normal text-stone-400">tenant</span>
            ) : null}
          </span>
        ) : null}
      </NavLink>
    )
  }

  const renderGroup = (item, { nested = false } = {}) => {
    const expanded = openGroups.includes(item.id)
    const groupActive = pathMatchesEntry(item, location.pathname)
    const locked = isSuperAdmin && item.needsTenant && !hasTenantSelected

    if (rail && !nested) {
      return (
        <button
          key={item.id}
          type="button"
          className={`sc-nav-item relative flex w-full items-center justify-center rounded-r-lg py-2.5 text-stone-500 hover:bg-stone-50 hover:text-stone-800 ${
            groupActive ? 'is-active text-stone-900' : ''
          }`}
          title={item.title}
          onClick={() => {
            setCollapsed(false)
            if (!expanded) toggleGroup(item.id)
          }}
        >
          <item.icon className="h-4 w-4" aria-hidden />
        </button>
      )
    }

    return (
      <div key={item.id} className="space-y-0.5">
        <div
          className={`flex items-center gap-1 rounded-r-lg ${
            groupActive && !expanded ? 'is-active sc-nav-item relative bg-brand-50' : ''
          } ${nested && !rail ? 'pl-3' : ''}`}
        >
          <button
            type="button"
            className={`relative flex min-w-0 flex-1 items-center gap-3 rounded-r-lg px-3 py-2.5 text-left text-sm font-medium ${
              groupActive ? 'text-stone-900' : 'text-stone-500 hover:text-stone-800'
            } ${locked ? 'opacity-55' : ''}`}
            onClick={() => toggleGroup(item.id)}
            aria-expanded={expanded}
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{item.title}</span>
          </button>
          <button
            type="button"
            className="mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
            onClick={() => toggleGroup(item.id)}
            aria-label={expanded ? `Collapse ${item.title}` : `Expand ${item.title}`}
          >
            {expanded ? (
              <FiMinus className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <FiPlus className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
        </div>
        {expanded
          ? item.children.map((child) =>
              child.type === 'group'
                ? renderGroup(child, { nested: true })
                : renderLink(child, { nested: true, deep: nested }),
            )
          : null}
      </div>
    )
  }

  const nav = (
    <nav className={`flex-1 space-y-0.5 overflow-y-auto pb-4 pt-2 ${rail ? 'px-2' : 'px-3'}`}>
      {items.map((item) =>
        item.type === 'link' ? renderLink(item) : renderGroup(item),
      )}
    </nav>
  )

  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-canvas">
      {mobileOpen ? (
        <button
          type="button"
          className="sc-fade-in fixed inset-0 z-30 bg-stone-900/45 md:hidden"
          aria-label="Close menu"
          onClick={closeMobile}
        />
      ) : null}

      <aside
        className={`sc-sidebar-sheen fixed inset-y-0 left-0 z-40 flex h-dvh w-60 flex-col overflow-hidden transition-all duration-300 ease-out md:static md:h-full md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'md:w-16' : 'md:w-60'}`}
      >
        <div
          className={`flex h-14 shrink-0 items-center border-b border-stone-100 ${
            rail ? 'justify-center px-0' : 'gap-2 px-4'
          }`}
        >
          <span
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-600"
            aria-hidden
          >
            O
          </span>
          {!rail ? (
            <span className="text-sm font-bold tracking-tight text-stone-900">O-hm Admin</span>
          ) : null}
        </div>
        {nav}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sc-glass-header z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-stone-200 px-3 md:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="rounded-lg p-2 text-stone-500 transition-colors duration-150 hover:bg-stone-100 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30 md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <FiMenu className="h-[18px] w-[18px]" aria-hidden />
            </button>
            <button
              type="button"
              className="hidden rounded-lg p-2 text-stone-500 transition-colors duration-150 hover:bg-stone-100 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30 md:inline-flex"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <FiSidebar className="h-[18px] w-[18px]" aria-hidden />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-stone-900">{displayName}</p>
              <p className="truncate text-xs text-stone-500">{roleLabel}</p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            {isSuperAdmin ? (
              <>
                <label className="sr-only" htmlFor="tenant-switcher">
                  Select tenant
                </label>
                <select
                  id="tenant-switcher"
                  className={`${fieldClass} max-w-[10rem] py-1.5 text-sm sm:max-w-[14rem]`}
                  value={selectedId}
                  onChange={(e) => selectTenant(e.target.value)}
                >
                  <option value="">Select tenant…</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <span className="hidden max-w-[12rem] truncate rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 sm:inline">
                {tenant?.name || 'Organization'}
              </span>
            )}
            <span className={`hidden sm:inline ${brandChipClass}`}>
              {user?.role || (isSuperAdmin ? 'Super Admin' : 'Tenant Admin')}
            </span>
            <button
              type="button"
              onClick={() => setLogoutOpen(true)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm text-stone-500 transition-colors duration-150 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600/30 sm:min-h-0"
              aria-label="Logout"
            >
              <FiLogOut className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {isSuperAdmin && !hasTenantSelected ? (
          <div className="shrink-0 border-b border-amber-100 bg-amber-50 px-4 py-2 text-sm text-amber-900 md:px-6">
            No tenant selected. Manage Tenants and Lobby work anytime; other modules need a tenant
            from the switcher above.
          </div>
        ) : null}

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-4 md:p-6">
          <div key={location.pathname} className="sc-page-enter mx-auto max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>

      <ConfirmDialog
        open={logoutOpen}
        title="Log out?"
        message="You will need to sign in again to access the panel."
        confirmLabel="Logout"
        onConfirm={handleLogout}
        onClose={() => setLogoutOpen(false)}
      />
    </div>
  )
}

export default Layout
