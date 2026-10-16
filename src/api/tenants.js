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

/** Normalize API tenant row for the admin table. */
export const normalizeTenantRow = (row = {}) => ({
  ...row,
  id: row.id,
  name: row.name || row.organization_name || '—',
  schema_name: row.schema_name || '',
  status: row.status || '—',
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

/** GET /tenants/ */
export const fetchTenants = async () => {
  const { data } = await api.get('tenants/')
  return asList(data).map(normalizeTenantRow)
}

/** GET /tenants/:id/ */
export const fetchTenantById = async (tenantId) => {
  const { data } = await api.get(`tenants/${tenantId}/`)
  const row = data?.data || data
  return normalizeTenantRow(row)
}

/** PATCH /tenants/:id/ — update tenant from Tenants tab. */
export const updateTenantById = async (tenantId, payload) => {
  const { data } = await api.patch(`tenants/${tenantId}/`, payload)
  const row = data?.data || data
  return normalizeTenantRow(row)
}

/** POST /tenants/:id/suspend/ — suspend / remove tenant from active list. */
export const suspendTenant = async (tenantId) => {
  const { data } = await api.post(`tenants/${tenantId}/suspend/`)
  return data?.data || data
}

/** POST /tenants/:id/activate/ — activate a suspended tenant. */
export const activateTenant = async (tenantId) => {
  const { data } = await api.post(`tenants/${tenantId}/activate/`)
  return data?.data || data
}
