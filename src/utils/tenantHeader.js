/** Decode JWT payload (no verify) — backend puts schema on the access token. */
export const schemaFromAccessToken = () => {
  try {
    const token = localStorage.getItem('access_token') || ''
    const part = token.split('.')[1]
    if (!part) return ''
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(json)
    return String(payload.schema || payload.schema_name || '').trim()
  } catch {
    return ''
  }
}

const slugFromTenantRow = (row) => {
  if (!row || typeof row !== 'object') return ''
  return String(row.schema_name || row.slug || row.schema || row.tenant_slug || '').trim()
}

export const isSuperAdminSession = () => {
  try {
    const userType = String(localStorage.getItem('user_type') || '')
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_')
    const rawUser = localStorage.getItem('authUser')
    const user = rawUser ? JSON.parse(rawUser) : null
    const roleKey = String(user?.role || '')
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_')
    return (
      userType === 'SUPER_ADMIN' ||
      userType === 'MASTER_ADMIN' ||
      roleKey === 'SUPER_ADMIN' ||
      roleKey === 'MASTER_ADMIN'
    )
  } catch {
    return false
  }
}

/**
 * Value for X-Tenant on roles APIs (Tenant Admin only).
 * Super Admin must not send X-Tenant — returns ''.
 */
export const resolveRolesTenantSlug = () => {
  if (isSuperAdminSession()) return ''

  const fromJwt = schemaFromAccessToken()
  if (fromJwt && fromJwt !== 'public') return fromJwt

  try {
    const selectedId = localStorage.getItem('admin_selected_tenant_id') || ''
    const rawTenants = localStorage.getItem('admin_tenants')
    const tenants = rawTenants ? JSON.parse(rawTenants) : []
    if (selectedId && Array.isArray(tenants)) {
      const row = tenants.find((t) => String(t.id) === String(selectedId))
      const slug = slugFromTenantRow(row)
      if (slug) return slug
    }
    if (Array.isArray(tenants) && tenants.length === 1) {
      const slug = slugFromTenantRow(tenants[0])
      if (slug) return slug
    }
    const rawUser = localStorage.getItem('authUser')
    const user = rawUser ? JSON.parse(rawUser) : null
    const fromUser = String(user?.tenant_slug || user?.schema_name || '').trim()
    if (fromUser && fromUser !== 'public') return fromUser
  } catch {
    // ignore
  }

  return fromJwt && fromJwt !== 'public' ? fromJwt : ''
}
