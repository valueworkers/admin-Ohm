import api from '../api/axiosClient'
import { normalizeTenantRole, TENANT_ROLES } from '../config/features'
import {
  findUserByCredentials,
  findUserByEmailOrPhone,
  getTenant,
} from '../store/platformStore'
import { apiErrorMessage } from './errors'
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

export const persistAuthSession = ({ user, tokens } = {}) => {
  if (user) {
    localStorage.setItem('authUser', JSON.stringify(user))
    localStorage.setItem('user_type', user.user_type || '')
  }
  if (tokens?.access) {
    localStorage.setItem('access_token', tokens.access)
  }
  if (tokens?.refresh) {
    localStorage.setItem('refresh_token', tokens.refresh)
  }
  if (tokens?.access || tokens?.refresh) {
    localStorage.setItem(
      'authTokens',
      JSON.stringify({ access: tokens.access || '', refresh: tokens.refresh || '' })
    )
  }
  window.dispatchEvent(new Event('auth-changed'))
}

export const getAccessToken = () => localStorage.getItem('access_token') || ''

export const getRefreshToken = () => localStorage.getItem('refresh_token') || ''

/** Pull access/refresh from common API response shapes. */
export const extractAuthTokens = (data) => {
  const root = data?.data || data || {}
  const nested = root.tokens || root.token || {}
  const access =
    nested.access ||
    nested.access_token ||
    root.access ||
    root.access_token ||
    data?.access ||
    data?.access_token ||
    ''
  const refresh =
    nested.refresh ||
    nested.refresh_token ||
    root.refresh ||
    root.refresh_token ||
    data?.refresh ||
    data?.refresh_token ||
    ''
  return {
    access: String(access || '').trim(),
    refresh: String(refresh || '').trim(),
  }
}

const normalizeApiUserType = (raw) => {
  if (raw == null || raw === '') return USER_TYPES.SUPER_ADMIN
  const t = String(raw).trim().toUpperCase()
  if (!t || t === 'NULL' || t === 'NONE') return USER_TYPES.SUPER_ADMIN
  if (t === 'MASTER_ADMIN' || t === 'SUPER_ADMIN' || t === 'ADMIN') {
    return USER_TYPES.SUPER_ADMIN
  }
  if (t === 'VSRE_OWNER' || t === 'TENANT_OWNER' || t === 'OWNER') {
    return USER_TYPES.TENANT_OWNER
  }
  return t
}

const splitFullName = (fullName = '') => {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return { first_name: '', last_name: '' }
  if (parts.length === 1) return { first_name: parts[0], last_name: '' }
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') }
}

const sessionFromApiUser = (apiUser, data = {}, usernameFallback = '') => {
  const fromFull = splitFullName(apiUser.full_name)
  const userType = normalizeApiUserType(
    apiUser.user_type || apiUser.userType || apiUser.role
  )
  const base = {
    id: apiUser.id ?? apiUser.pk ?? (usernameFallback || 'api-user'),
    email: apiUser.email || apiUser.username || usernameFallback || '',
    full_name: apiUser.full_name || '',
    first_name: apiUser.first_name || fromFull.first_name || '',
    last_name: apiUser.last_name || fromFull.last_name || '',
    phone: apiUser.mobile_number || apiUser.phone || '',
    is_active: apiUser.is_active !== false,
    date_joined: apiUser.date_joined || null,
    role: apiUser.role ?? null,
    user_type: userType || USER_TYPES.SUPER_ADMIN,
    organization_name:
      apiUser.organization_name ||
      apiUser.tenant_name ||
      apiUser.company_name ||
      data.organization_name ||
      data.tenant_name ||
      '',
    tenant_id: apiUser.tenant_id || apiUser.organization_id || data.tenant_id || null,
  }
  if (isSuperAdmin(base.user_type)) {
    return {
      ...base,
      user_type: USER_TYPES.SUPER_ADMIN,
      first_name: base.first_name || 'Super',
      last_name: base.last_name || 'Admin',
      tenant_id: null,
      organization_name: '',
    }
  }
  const tenantRole = normalizeTenantRole(apiUser.tenant_role || apiUser.role_label)
  return {
    ...base,
    user_type: USER_TYPES.TENANT_OWNER,
    tenant_role: tenantRole,
    role_label:
      apiUser.role_label ||
      (tenantRole === TENANT_ROLES.OPS_ADMIN ? 'Ops Admin' : 'Tenant Admin'),
  }
}

/**
 * Finish login from API body:
 * { message, user: {...}, tokens: { access, refresh } }
 */
const finishApiLogin = (data, usernameFallback = '') => {
  const payload = data?.data && (data.data.user || data.data.tokens) ? data.data : data || {}
  const tokens = extractAuthTokens(payload)

  if (!tokens.access || !tokens.refresh) {
    return {
      ok: false,
      error: !tokens.access
        ? 'Login failed. Access token missing from response.'
        : 'Login failed. Refresh token missing from response.',
    }
  }

  const apiUser = payload.user || payload.profile
  if (!apiUser) {
    return { ok: false, error: 'Login failed. User missing from response.' }
  }

  const sessionUser = sessionFromApiUser(apiUser, payload, usernameFallback)
  if (!canAccessAdminPanel(sessionUser)) {
    return {
      ok: false,
      error: 'This account cannot access the admin panel.',
    }
  }

  if (sessionUser.tenant_id) {
    setSelectedTenantId(sessionUser.tenant_id)
  }

  persistAuthSession({
    user: sessionUser,
    tokens: { access: tokens.access, refresh: tokens.refresh },
  })

  return { ok: true, user: sessionUser, tokens, message: payload.message || data?.message || '' }
}

const loginApiError = (error, fallback) => {
  const status = error?.response?.status
  if (status === 401) {
    return { ok: false, error: 'Invalid credentials. Please try again.' }
  }
  if (status === 400) {
    return {
      ok: false,
      error: apiErrorMessage(error, 'Please check your details and try again.'),
    }
  }
  if (!error?.response) {
    return { ok: false, error: 'Network error. Check your connection and API URL.' }
  }
  return { ok: false, error: apiErrorMessage(error, fallback) }
}

/**
 * Live admin login — POST /api/auth/login/
 * Body: { username, method: "password", password }
 */
export const loginWithPasswordApi = async (username, password) => {
  const user = String(username || '').trim()
  try {
    const { data } = await api.post('api/auth/login/', {
      username: user,
      method: 'password',
      password,
    })
    return finishApiLogin(data, user)
  } catch (error) {
    return loginApiError(error, 'Login failed. Please try again.')
  }
}

/**
 * Step 1 — request OTP for login.
 * POST /api/auth/otp/  { username, purpose: "login" }
 */
export const sendLoginOtpApi = async (username) => {
  try {
    const { data } = await api.post('api/auth/otp/', {
      username: String(username || '').trim(),
      purpose: 'login',
    })
    const payload = data?.data || data || {}
    const message =
      payload.message ||
      data?.message ||
      'OTP sent. Enter the code to sign in.'
    return { ok: true, message }
  } catch (error) {
    return loginApiError(error, 'Could not send OTP. Please try again.')
  }
}

/**
 * Step 2 — verify OTP and sign in.
 * POST /api/auth/login/  { username, method: "otp", otp }
 */
export const loginWithOtpApi = async (username, otp) => {
  const user = String(username || '').trim()
  try {
    const { data } = await api.post('api/auth/login/', {
      username: user,
      method: 'otp',
      otp: String(otp || '').trim(),
    })
    return finishApiLogin(data, user)
  } catch (error) {
    return loginApiError(error, 'OTP login failed. Please try again.')
  }
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

export const isAuthenticated = () => Boolean(getAuthUser() && getAccessToken())

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

/**
 * Forgot password step 1 — request OTP.
 * POST /api/auth/otp/  { username, purpose: "password_reset" }
 */
export const sendPasswordResetOtpApi = async (username) => {
  const user = String(username || '').trim()
  if (!user) {
    return { ok: false, error: 'Email or phone is required.' }
  }
  try {
    const { data } = await api.post('api/auth/otp/', {
      username: user,
      purpose: 'password_reset',
    })
    const payload = data?.data || data || {}
    const message =
      payload.message ||
      data?.message ||
      'OTP sent. Check your email or phone, then set a new password.'
    return { ok: true, message }
  } catch (error) {
    return loginApiError(error, 'Could not send reset OTP. Please try again.')
  }
}

/**
 * Forgot password step 2 — confirm OTP and set new password.
 * POST /api/auth/password-reset/  { username, otp, new_password }
 */
export const resetPasswordApi = async (username, otp, newPassword, confirmPassword) => {
  const user = String(username || '').trim()
  const code = String(otp || '').trim()
  const next = String(newPassword || '')
  const confirm = String(confirmPassword || '')

  if (!user) {
    return { ok: false, error: 'Email or phone is required.' }
  }
  if (!code) {
    return { ok: false, error: 'Enter the OTP code.' }
  }
  if (next.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters.' }
  }
  if (next !== confirm) {
    return { ok: false, error: 'New password and confirm password do not match.' }
  }

  try {
    const { data } = await api.post('api/auth/password-reset/', {
      username: user,
      otp: code,
      new_password: next,
    })
    const payload = data?.data || data || {}
    const message =
      payload.message ||
      data?.message ||
      'Password updated. Sign in with your new password.'
    return { ok: true, username: user, message }
  } catch (error) {
    return loginApiError(error, 'Could not reset password. Please try again.')
  }
}
