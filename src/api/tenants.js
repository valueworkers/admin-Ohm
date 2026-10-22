import api from './axiosClient'

const asList = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.data)) return data.data
  return []
}

const primaryDomain = (domains) => {
  if (!Array.isArray(domains) || domains.length === 0) return ''
  const primary = domains.find((d) => d.is_primary) || domains[0]
  return primary?.domain || ''
}

const resolveStatus = (row = {}) => {
  if (row.status) return row.status
  if (row.is_active === false || row.active === false) return 'suspended'
  if (row.is_active === true || row.active === true) return 'active'
  return '—'
}

/** Normalize API tenant row for the admin table. */
export const normalizeTenantRow = (row = {}) => ({
  ...row,
  id: row.id,
  name: row.name || row.organization_name || '—',
  schema_name: row.schema_name || '',
  status: resolveStatus(row),
  owner: row.owner ?? null,
  modules: Array.isArray(row.modules) ? row.modules : [],
  logo: row.logo || null,
  contact_email: row.contact_email || '',
  contact_phone: row.contact_phone || '',
  timezone: row.timezone || '',
  default_currency: row.default_currency || '',
  tags: Array.isArray(row.tags)
    ? row.tags.map(String).filter(Boolean)
    : typeof row.tags === 'string' && row.tags
      ? row.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : Array.isArray(row.tag)
        ? row.tag.map(String).filter(Boolean)
        : typeof row.tag === 'string' && row.tag
          ? row.tag.split(',').map((t) => t.trim()).filter(Boolean)
          : [],
  domains: Array.isArray(row.domains) ? row.domains : [],
  primary_domain: primaryDomain(row.domains),
  subscriptions: Array.isArray(row.subscriptions) ? row.subscriptions : [],
  created_at: row.created_at || null,
  // aliases used by existing edit/view UI
  owner_email: row.contact_email || '',
  owner_phone: row.contact_phone || '',
  phone: row.contact_phone || '',
  slug: row.schema_name || '',
})

/** GET /api/platform/tenants/ — list all tenants (excluding public). */
export const fetchTenants = async () => {
  const { data } = await api.get('api/platform/tenants/')
  return asList(data).map(normalizeTenantRow)
}

/** POST /api/platform/tenants/ — create a new tenant. */
export const createTenant = async (payload) => {
  const { data } = await api.post('api/platform/tenants/', payload)
  const row = data?.data || data
  return normalizeTenantRow(row)
}

/** GET /api/platform/tenants/:id/ — retrieve tenant details. */
export const fetchTenantById = async (tenantId) => {
  const { data } = await api.get(`api/platform/tenants/${tenantId}/`)
  const row = data?.data || data
  return normalizeTenantRow(row)
}

/** PUT /api/platform/tenants/:id/ — fully update a tenant. */
export const replaceTenantById = async (tenantId, payload) => {
  const { data } = await api.put(`api/platform/tenants/${tenantId}/`, payload)
  const row = data?.data || data
  return normalizeTenantRow(row)
}

/** PATCH /api/platform/tenants/:id/ — partially update / edit a tenant. */
export const updateTenantById = async (tenantId, payload) => {
  const { data } = await api.patch(`api/platform/tenants/${tenantId}/`, payload)
  const row = data?.data || data
  return normalizeTenantRow(row)
}

/**
 * DELETE /api/platform/tenants/:id/?confirm={schema_name}
 * Permanently delete a suspended tenant.
 */
export const deleteTenantById = async (tenantId, schemaName) => {
  const { data } = await api.delete(`api/platform/tenants/${tenantId}/`, {
    params: { confirm: String(schemaName || '').trim() },
  })
  return data?.data || data
}

/** POST /api/platform/tenants/:id/suspend/ — suspend an active tenant. */
export const suspendTenant = async (tenantId) => {
  const { data } = await api.post(`api/platform/tenants/${tenantId}/suspend/`)
  return data?.data || data
}

/** POST /api/platform/tenants/:id/activate/ — activate a suspended tenant. */
export const activateTenant = async (tenantId) => {
  const { data } = await api.post(`api/platform/tenants/${tenantId}/activate/`)
  return data?.data || data
}

const asStringList = (value) => {
  if (!Array.isArray(value)) return []
  return value.map((v) => String(v || '').trim()).filter(Boolean)
}

/**
 * GET /api/platform/tenants/:id/permissions/
 * Supports enabled_modules[] and/or a permissions list.
 */
export const fetchTenantPermissions = async (tenantId) => {
  const { data } = await api.get(`api/platform/tenants/${tenantId}/permissions/`)
  const root = data?.data || data || {}

  const enabledModules = asStringList(
    root.enabled_modules || root.enabledModules || root.modules,
  )

  let raw = []
  if (Array.isArray(root)) raw = root
  else if (Array.isArray(root.permissions)) raw = root.permissions
  else if (Array.isArray(root.results)) raw = root.results
  else if (Array.isArray(root.available_modules)) {
    raw = root.available_modules
  } else if (root.permissions && typeof root.permissions === 'object') {
    raw = Object.entries(root.permissions).map(([code, value]) => {
      if (typeof value === 'boolean') return { code, name: code, enabled: value }
      if (value && typeof value === 'object') return { code, ...value }
      return { code, name: String(value) }
    })
  }

  const items = raw.map((item) => {
    if (typeof item === 'string') {
      return {
        code: item,
        name: item,
        description: '',
        enabled: enabledModules.length ? enabledModules.includes(item) : true,
      }
    }
    const code = String(item.code || item.codename || item.key || item.id || '').trim()
    return {
      code,
      name: item.name || item.label || code || '—',
      description: item.description || '',
      enabled:
        item.enabled != null
          ? Boolean(item.enabled)
          : item.is_enabled != null
            ? Boolean(item.is_enabled)
            : item.granted != null
              ? Boolean(item.granted)
              : enabledModules.length
                ? enabledModules.includes(code)
                : true,
    }
  })

  // If API only returned enabled_modules, surface those as enabled items
  if (!items.length && enabledModules.length) {
    enabledModules.forEach((code) => {
      items.push({ code, name: code, description: '', enabled: true })
    })
  }

  const fromItems = items.filter((i) => i.enabled).map((i) => i.code).filter(Boolean)

  return {
    raw: root,
    items,
    enabledModules: enabledModules.length ? enabledModules : fromItems,
  }
}

/** PATCH /api/platform/tenants/:id/permissions/ — { enabled_modules: string[] } */
export const updateTenantPermissions = async (tenantId, enabledModules) => {
  const payload = {
    enabled_modules: asStringList(enabledModules),
  }
  const { data } = await api.patch(
    `api/platform/tenants/${tenantId}/permissions/`,
    payload,
  )
  return data?.data || data
}
