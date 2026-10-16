import api from './axiosClient'

const asList = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.data)) return data.data
  return []
}

export const normalizePlan = (row = {}) => ({
  ...row,
  id: row.id,
  code: row.code || '',
  name: row.name || '',
  description: row.description || '',
  features: Array.isArray(row.features) ? row.features : [],
  max_employees: row.max_employees ?? null,
  max_branches: row.max_branches ?? null,
})

/** GET /api/platform/plans/ */
export const fetchPlans = async () => {
  const { data } = await api.get('api/platform/plans/')
  return asList(data).map(normalizePlan)
}

/** GET /api/platform/plans/:id/ */
export const fetchPlanById = async (planId) => {
  const { data } = await api.get(`api/platform/plans/${planId}/`)
  const row = data?.data || data
  return normalizePlan(row)
}

/** POST /api/platform/plans/ */
export const createPlan = async (payload) => {
  const { data } = await api.post('api/platform/plans/', payload)
  const row = data?.data || data
  return normalizePlan(row)
}

/** PATCH /api/platform/plans/:id/ */
export const updatePlan = async (planId, payload) => {
  const { data } = await api.patch(`api/platform/plans/${planId}/`, payload)
  const row = data?.data || data
  return normalizePlan(row)
}

/** DELETE /api/platform/plans/:id/ */
export const deletePlan = async (planId) => {
  const { data } = await api.delete(`api/platform/plans/${planId}/`)
  return data?.data || data
}
