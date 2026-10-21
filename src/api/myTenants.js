import api from './axiosClient'
import { normalizeTenantRow } from './tenants'

const asList = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.tenants)) return data.tenants
  return []
}

/** GET /api/platform/my/tenants/ — tenants for the signed-in owner. */
export const fetchMyTenants = async () => {
  const { data } = await api.get('api/platform/my/tenants/')
  return asList(data).map(normalizeTenantRow)
}

/** GET /api/platform/my/tenants/:id/ */
export const fetchMyTenantById = async (tenantId) => {
  const { data } = await api.get(`api/platform/my/tenants/${tenantId}/`)
  const row = data?.data || data
  return normalizeTenantRow(row)
}

/** PATCH /api/platform/my/tenants/:id/ — owner edits their tenant. */
export const updateMyTenant = async (tenantId, payload) => {
  const { data } = await api.patch(`api/platform/my/tenants/${tenantId}/`, payload)
  const row = data?.data || data
  return normalizeTenantRow(row)
}

/** POST /api/platform/my/tenants/:id/activate/ */
export const activateMyTenant = async (tenantId) => {
  const { data } = await api.post(`api/platform/my/tenants/${tenantId}/activate/`)
  return data?.data || data
}
