import api from './axiosClient'

const asList = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.data)) return data.data
  return []
}

const idFrom = (value) => {
  if (value == null) return null
  if (typeof value === 'object') return value.id ?? null
  return value
}

export const normalizeSubscription = (row = {}) => ({
  ...row,
  id: row.id,
  tenant: idFrom(row.tenant ?? row.tenant_id),
  tenant_name:
    row.tenant_name ||
    (typeof row.tenant === 'object' ? row.tenant?.name : '') ||
    '',
  plan: idFrom(row.plan ?? row.plan_id),
  plan_name:
    row.plan_name || (typeof row.plan === 'object' ? row.plan?.name : '') || '',
  status: row.status || '',
  starts_at: row.starts_at || null,
  ends_at: row.ends_at || null,
  trial_ends_at: row.trial_ends_at || null,
  billing_email: row.billing_email || '',
  features: Array.isArray(row.features) ? row.features : [],
})

/** GET /api/platform/subscriptions/ */
export const fetchSubscriptions = async () => {
  const { data } = await api.get('api/platform/subscriptions/')
  return asList(data).map(normalizeSubscription)
}

/** POST /api/platform/subscriptions/ */
export const createSubscription = async (payload) => {
  const { data } = await api.post('api/platform/subscriptions/', payload)
  const row = data?.data || data
  return normalizeSubscription(row)
}

/** PATCH /api/platform/subscriptions/:id/ */
export const updateSubscription = async (subscriptionId, payload) => {
  const { data } = await api.patch(`api/platform/subscriptions/${subscriptionId}/`, payload)
  const row = data?.data || data
  return normalizeSubscription(row)
}

/** DELETE /api/platform/subscriptions/:id/ */
export const deleteSubscription = async (subscriptionId) => {
  const { data } = await api.delete(`api/platform/subscriptions/${subscriptionId}/`)
  return data?.data || data
}
