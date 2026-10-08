import { findUserByCredentials } from '../store/platformStore'

export const USER_TYPES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  TENANT_OWNER: 'TENANT_OWNER',
  /** Legacy alias from older builds */
  MASTER_ADMIN: 'SUPER_ADMIN',
  VSRE_OWNER: 'TENANT_OWNER',
}

export const getAuthUser = () => {
  try {
    const raw = localStorage.getItem('authUser')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const getUserType = (userOrType) => {
  if (userOrType == null) return ''
  if (typeof userOrType === 'string') return String(userOrType).trim().toUpperCase()
  return String(userOrType?.user_type || userOrType?.userType || '').trim().toUpperCase()
}

export const isSuperAdmin = (userOrType) => {
  const t = getUserType(userOrType)
  return t === USER_TYPES.SUPER_ADMIN || t === 'MASTER_ADMIN'
}

export const isTenantOwner = (userOrType) => {
  const t = getUserType(userOrType)
  return t === USER_TYPES.TENANT_OWNER || t === 'VSRE_OWNER'
}

/** @deprecated use isSuperAdmin */
export const isMasterAdmin = isSuperAdmin
/** @deprecated use isTenantOwner */
export const isVsreOwner = isTenantOwner

/** Platform admin panel is Super Admin only — tenant owners cannot sign in. */
export const canAccessAdminPanel = (userOrType) => isSuperAdmin(userOrType)

export const canManagePlatform = (userOrType) => isSuperAdmin(userOrType)

/** @deprecated use canManagePlatform */
export const canManageAllTenants = canManagePlatform
export const canCreateOwner = canManagePlatform
export const canSwitchTenants = () => false

/** Tenant owners may mutate their org data; Super Admin is read-only on ops. */
export const canWriteTenantData = (userOrType) => isTenantOwner(userOrType)

export const persistAuthSession = ({ user }) => {
  if (user) {
    localStorage.setItem('authUser', JSON.stringify(user))
    localStorage.setItem('user_type', user.user_type || '')
  }
  window.dispatchEvent(new Event('auth-changed'))
}

export const clearAuthSession = () => {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('authTokens')
  localStorage.removeItem('authUser')
  localStorage.removeItem('user_type')
  localStorage.removeItem('selected_tenant_id')
  window.dispatchEvent(new Event('auth-changed'))
}

export const isAuthenticated = () => Boolean(getAuthUser())

export const loginWithDummy = (email, password) => {
  const found = findUserByCredentials(email, password)
  if (!found) {
    return { ok: false, error: 'Invalid email or password.' }
  }
  if (isTenantOwner(found)) {
    return {
      ok: false,
      error: 'Tenant accounts cannot sign in. Only Super Admin can access this panel.',
    }
  }
  if (!isSuperAdmin(found)) {
    return { ok: false, error: 'This account cannot access the admin panel.' }
  }
  const sessionUser = {
    id: found.id,
    email: found.email,
    first_name: 'Super',
    last_name: 'Admin',
    user_type: USER_TYPES.SUPER_ADMIN,
    tenant_id: null,
    organization_name: '',
  }
  persistAuthSession({ user: sessionUser })
  return { ok: true, user: sessionUser }
}
