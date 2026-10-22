import axios from 'axios'
import { isSuperAdminSession, resolveRolesTenantSlug } from '../utils/tenantHeader'

const baseURL = String(import.meta.env.VITE_BASEURL_CARE || '').replace(/\/?$/, '/')

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

const clearHeader = (headers, key) => {
  if (!headers) return
  if (typeof headers.delete === 'function') headers.delete(key)
  else {
    delete headers[key]
    delete headers[key.toLowerCase()]
  }
}

const setHeader = (headers, key, value) => {
  if (!headers) return
  if (typeof headers.set === 'function') headers.set(key, value)
  else headers[key] = value
}

const isRolesApiRequest = (config) => {
  const url = String(config?.url || '')
  return url.includes('api/roles') || url.includes('api/role-assignments')
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    setHeader(config.headers, 'Authorization', `Bearer ${token}`)
  }
  setHeader(config.headers, 'Accept', 'application/json')

  // X-Tenant only on roles / role-assignments, and only for Tenant Admin (never Super Admin).
  clearHeader(config.headers, 'X-Tenant')
  if (isRolesApiRequest(config) && !isSuperAdminSession()) {
    const slug = resolveRolesTenantSlug()
    if (slug) setHeader(config.headers, 'X-Tenant', slug)
  }

  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    clearHeader(config.headers, 'Content-Type')
  }
  return config
})

const errorText = (error) => {
  const data = error?.response?.data
  if (!data) return String(error?.message || '')
  if (typeof data === 'string') return data
  return [data.detail, data.message, data.error, JSON.stringify(data)]
    .filter(Boolean)
    .join(' ')
}

const isAuthFailure = (error) => {
  const status = error?.response?.status
  const text = errorText(error).toLowerCase()
  // Only token / auth failures — not generic 403/404 or business errors.
  if (status === 401) return true
  if (text.includes('given token not valid for any token type')) return true
  if (text.includes('token not valid') || text.includes('token is invalid')) return true
  if (text.includes('token has expired') || text.includes('expired token')) return true
  if (text.includes('authentication credentials were not provided')) return true
  if (text.includes('not authenticated') || text.includes('authentication failed')) return true
  if (text.includes('authorization header') && text.includes('token')) return true
  return false
}

const isLoginRequest = (config) => {
  const url = String(config?.url || '')
  return (
    url.includes('auth/login') ||
    url.includes('auth/otp') ||
    url.includes('auth/password-reset')
  )
}

let redirectingToLogin = false

const forceLogoutToLogin = () => {
  if (redirectingToLogin) return
  if (window.location.pathname.startsWith('/login')) return

  redirectingToLogin = true
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('authTokens')
  localStorage.removeItem('authUser')
  localStorage.removeItem('user_type')
  localStorage.removeItem('selected_tenant_id')
  window.dispatchEvent(new Event('auth-changed'))
  window.location.assign('/login')
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const hasSession = Boolean(localStorage.getItem('access_token'))
    const url = String(error?.config?.url || '')
    // Roles APIs may 401/403 for missing X-Tenant — show page error, don't kick session.
    const isRolesUrl =
      url.includes('api/roles') || url.includes('api/role-assignments')
    if (
      hasSession &&
      !isLoginRequest(error?.config) &&
      !isRolesUrl &&
      isAuthFailure(error)
    ) {
      forceLogoutToLogin()
    }
    return Promise.reject(error)
  }
)

export default api
