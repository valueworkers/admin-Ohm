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

export const slugFromTenantRow = (row) => {
  if (!row || typeof row !== 'object') return ''
  return String(row.schema_name || row.slug || row.schema || row.tenant_slug || '').trim()
}

export const SUPER_ADMIN_ROLE_KEYS = new Set([
  'SUPER_ADMIN',
  'SUPERADMIN',
  'SUPER_USER',
  'SUPERUSER',
  'MASTER_ADMIN',
  'ADMIN',
])

export const isSuperAdminSession = () => {
  try {
    const userType = String(localStorage.getItem('user_type') || '')
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_')
    const rawUser = localStorage.getItem('authUser')
    const user = rawUser ? JSON.parse(rawUser) : null
    const roleKey = String(user?.primary_role || user?.role || '')
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_')
    return SUPER_ADMIN_ROLE_KEYS.has(userType) || SUPER_ADMIN_ROLE_KEYS.has(roleKey)
  } catch {
    return false
  }
}

/**
 * Value for X-Tenant on Accounts → Groups / Permissions (Roles UI).
 * Super Admin (public schema): '' → omit X-Tenant.
 * Tenant Admin: JWT schema / stored tenant slug.
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
      if (slug && slug !== 'public') return slug
    }
    if (Array.isArray(tenants) && tenants.length === 1) {
      const slug = slugFromTenantRow(tenants[0])
      if (slug && slug !== 'public') return slug
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

/**
 * Tenant slug for settings APIs (X-Tenant).
 * Account / Super Admin platform settings → leave empty.
 * Tenant settings → selected tenant slug, else JWT schema for tenant users.
 */
export const resolveSettingsTenantSlug = (tenant) => {
  const fromRow = slugFromTenantRow(tenant)
  if (fromRow && fromRow !== 'public') return fromRow
  if (isSuperAdminSession()) return ''
  return resolveRolesTenantSlug()
}

/**
 * Tenant slug for catalog APIs (venues/services) — always requires X-Tenant.
 * Super Admin → selected tenant schema/slug. Tenant Admin → JWT / stored slug.
 */
export const resolveCatalogTenantSlug = (tenant) => {
  const fromRow = slugFromTenantRow(tenant)
  if (fromRow && fromRow !== 'public') return fromRow

  try {
    const selectedId = localStorage.getItem('admin_selected_tenant_id') || ''
    const rawTenants = localStorage.getItem('admin_tenants')
    const tenants = rawTenants ? JSON.parse(rawTenants) : []
    if (selectedId && Array.isArray(tenants)) {
      const row = tenants.find((t) => String(t.id) === String(selectedId))
      const slug = slugFromTenantRow(row)
      if (slug && slug !== 'public') return slug
    }
  } catch {
    // ignore
  }

  if (!isSuperAdminSession()) {
    const slug = resolveRolesTenantSlug()
    if (slug && slug !== 'public') return slug
  }

  return ''
}
