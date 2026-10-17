import axios from 'axios'

const baseURL = String(import.meta.env.VITE_BASEURL_CARE || '').replace(/\/?$/, '/')

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    // Let the browser set multipart boundary.
    if (config.headers && typeof config.headers.delete === 'function') {
      config.headers.delete('Content-Type')
    } else if (config.headers) {
      delete config.headers['Content-Type']
    }
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
    if (hasSession && !isLoginRequest(error?.config) && isAuthFailure(error)) {
      forceLogoutToLogin()
    }
    return Promise.reject(error)
  }
)

export default api
