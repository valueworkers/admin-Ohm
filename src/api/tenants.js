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

/** GET /tenants/ — list all tenants (excluding public). */
export const fetchTenants = async () => {
  const { data } = await api.get('tenants/')
  return asList(data).map(normalizeTenantRow)
}

/** POST /tenants/ — create a new tenant. */
export const createTenant = async (payload) => {
  const { data } = await api.post('tenants/', payload)
  const row = data?.data || data
  return normalizeTenantRow(row)
}

/** GET /tenants/:id/ — retrieve tenant details. */
export const fetchTenantById = async (tenantId) => {
  const { data } = await api.get(`tenants/${tenantId}/`)
  const row = data?.data || data
  return normalizeTenantRow(row)
}

/** PUT /tenants/:id/ — fully update a tenant. */
export const replaceTenantById = async (tenantId, payload) => {
  const { data } = await api.put(`tenants/${tenantId}/`, payload)
  const row = data?.data || data
  return normalizeTenantRow(row)
}

/** PATCH /tenants/:id/ — partially update a tenant. */
export const updateTenantById = async (tenantId, payload) => {
  const { data } = await api.patch(`tenants/${tenantId}/`, payload)
  const row = data?.data || data
  return normalizeTenantRow(row)
}

/**
 * DELETE /tenants/:id/?confirm={schema_name}
 * Permanently delete a suspended tenant.
 */
export const deleteTenantById = async (tenantId, schemaName) => {
  const { data } = await api.delete(`tenants/${tenantId}/`, {
    params: { confirm: String(schemaName || '').trim() },
  })
  return data?.data || data
}

/** POST /tenants/:id/suspend/ — suspend an active tenant. */
export const suspendTenant = async (tenantId) => {
  const { data } = await api.post(`tenants/${tenantId}/suspend/`)
  return data?.data || data
}

/** POST /tenants/:id/activate/ — activate a suspended tenant. */
export const activateTenant = async (tenantId) => {
  const { data } = await api.post(`tenants/${tenantId}/activate/`)
  return data?.data || data
}
