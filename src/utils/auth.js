import { normalizeTenantRole, TENANT_ROLES } from '../config/features'
import {
  findUserByCredentials,
  findUserByEmailOrPhone,
  getTenant,
  updateUserPassword,
} from '../store/platformStore'
import { setSelectedTenantId } from './tenants'

/** Demo OTP for sign-in / password reset (no SMS/email backend). */
export const DEMO_OTP = '123456'

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

/** Super Admin and active tenant owners can use this panel. */
export const canAccessAdminPanel = (userOrType) =>
  isSuperAdmin(userOrType) || isTenantOwner(userOrType)

export const canManagePlatform = (userOrType) => isSuperAdmin(userOrType)

/** @deprecated use canManagePlatform */
export const canManageAllTenants = canManagePlatform
export const canCreateOwner = canManagePlatform
export const canSwitchTenants = (userOrType) => isSuperAdmin(userOrType)

/** Tenant owners and Super Admin may mutate org ops data (venues, services, etc.). */
export const canWriteTenantData = (userOrType) =>
  isTenantOwner(userOrType) || isSuperAdmin(userOrType)

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

const sessionFromUser = (found) => {
  if (isSuperAdmin(found)) {
    return {
      id: found.id,
      email: found.email,
      first_name: found.first_name || 'Super',
      last_name: found.last_name || 'Admin',
      user_type: USER_TYPES.SUPER_ADMIN,
      tenant_id: null,
      organization_name: '',
      phone: found.phone || '',
    }
  }
  const tenant = found.tenant_id ? getTenant(found.tenant_id) : null
  const tenantRole = normalizeTenantRole(found.tenant_role || found.role_label)
  return {
    id: found.id,
    email: found.email,
    first_name: found.first_name || '',
    last_name: found.last_name || '',
    user_type: USER_TYPES.TENANT_OWNER,
    tenant_role: tenantRole,
    role_label:
      found.role_label ||
      (tenantRole === TENANT_ROLES.OPS_ADMIN ? 'Ops Admin' : 'Tenant Admin'),
    tenant_id: found.tenant_id || null,
    organization_name: tenant?.name || '',
    phone: found.phone || '',
  }
}

export const getTenantRole = (userOrRole) => {
  if (userOrRole == null) return TENANT_ROLES.ADMIN
  if (typeof userOrRole === 'string') return normalizeTenantRole(userOrRole)
  return normalizeTenantRole(userOrRole.tenant_role || userOrRole.role_label)
}

export const isTenantAdmin = (userOrRole) => getTenantRole(userOrRole) === TENANT_ROLES.ADMIN

export const isOpsAdmin = (userOrRole) => getTenantRole(userOrRole) === TENANT_ROLES.OPS_ADMIN

const assertTenantAllowed = (found) => {
  if (!found.tenant_id) {
    return { ok: false, error: 'This tenant account is not linked to an organization.' }
  }
  const tenant = getTenant(found.tenant_id)
  if (!tenant) {
    return { ok: false, error: 'Organization not found for this account.' }
  }
  if (tenant.status === 'pending') {
    return {
      ok: false,
      error: 'This organization is still in Lobby. Sign in after Super Admin approval.',
    }
  }
  if (tenant.status === 'offboarded') {
    return { ok: false, error: 'This organization has been offboarded. Contact platform support.' }
  }
  if (tenant.status !== 'active') {
    return { ok: false, error: 'This organization cannot access the panel right now.' }
  }
  return { ok: true, tenant }
}

const assertPanelUser = (found, notFoundMessage) => {
  if (!found) {
    return { ok: false, error: notFoundMessage }
  }
  if (isSuperAdmin(found)) {
    return { ok: true, user: found }
  }
  if (isTenantOwner(found)) {
    const tenantCheck = assertTenantAllowed(found)
    if (!tenantCheck.ok) return tenantCheck
    return { ok: true, user: found }
  }
  return { ok: false, error: 'This account cannot access the admin panel.' }
}

const assertPanelIdentifier = (emailOrPhone) =>
  assertPanelUser(
    findUserByEmailOrPhone(emailOrPhone),
    'No account found for this email or phone.'
  )

const channelForIdentifier = (emailOrPhone, user) => {
  const raw = String(emailOrPhone || '').trim()
  if (raw.includes('@')) return { channel: 'email', destination: user.email }
  return { channel: 'phone', destination: user.phone || raw }
}

const finishLogin = (found) => {
  const sessionUser = sessionFromUser(found)
  if (sessionUser.tenant_id) {
    setSelectedTenantId(sessionUser.tenant_id)
  }
  persistAuthSession({ user: sessionUser })
  return { ok: true, user: sessionUser }
}

export const loginWithDummy = (emailOrPhone, password) => {
  const found = findUserByCredentials(emailOrPhone, password)
  if (!found) {
    return { ok: false, error: 'Invalid email/phone or password.' }
  }
  const check = assertPanelUser(found, 'Invalid email/phone or password.')
  if (!check.ok) return check
  return finishLogin(found)
}

/** Demo OTP delivery — email or phone (no SMS/email backend). */
export const sendDemoOtp = (emailOrPhone) => {
  const check = assertPanelIdentifier(emailOrPhone)
  if (!check.ok) return check
  const { channel, destination } = channelForIdentifier(emailOrPhone, check.user)
  return {
    ok: true,
    message: `Demo OTP sent to ${destination} via ${channel}. Use code ${DEMO_OTP}.`,
  }
}

/** OTP sign-in for Super Admin or active tenant owners. */
export const loginWithDummyOtp = (emailOrPhone, otp) => {
  const check = assertPanelIdentifier(emailOrPhone)
  if (!check.ok) return check
  if (String(otp || '').trim() !== DEMO_OTP) {
    return { ok: false, error: 'Invalid OTP. Check the code and try again.' }
  }
  return finishLogin(check.user)
}

/** Step 1 — send 6-digit OTP to email or phone (demo). */
export const sendPasswordResetOtp = (emailOrPhone) => {
  const check = assertPanelIdentifier(emailOrPhone)
  if (!check.ok) return check
  const { channel, destination } = channelForIdentifier(emailOrPhone, check.user)
  return {
    ok: true,
    channel,
    destination,
    message: `Demo OTP sent to ${destination} via ${channel}. Use code ${DEMO_OTP}.`,
  }
}

/** Step 2 — verify 6-digit OTP. */
export const verifyPasswordResetOtp = (emailOrPhone, otp) => {
  const check = assertPanelIdentifier(emailOrPhone)
  if (!check.ok) return check
  if (String(otp || '').trim() !== DEMO_OTP) {
    return { ok: false, error: 'Invalid OTP. Check the code and try again.' }
  }
  return { ok: true, user: check.user }
}

/** Step 3 — set new password after OTP verification. */
export const completePasswordReset = (emailOrPhone, otp, newPassword, confirmPassword) => {
  const verified = verifyPasswordResetOtp(emailOrPhone, otp)
  if (!verified.ok) return verified
  const next = String(newPassword || '')
  const confirm = String(confirmPassword || '')
  if (next.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters.' }
  }
  if (next !== confirm) {
    return { ok: false, error: 'New password and confirm password do not match.' }
  }
  const updated = updateUserPassword(verified.user.id, next)
  if (!updated) {
    return { ok: false, error: 'Could not update password. Try again.' }
  }
  return {
    ok: true,
    email: updated.email,
    message: 'Password updated. Sign in with your new password.',
  }
}
