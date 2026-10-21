import api from './axiosClient'

const asList = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.owners)) return data.owners
  return []
}

const normalizeOwner = (row = {}) => ({
  ...row,
  id: row.id ?? row.pk ?? null,
  email: row.email || '',
  full_name: row.full_name || '',
  phone: row.phone || row.mobile_number || '',
  is_active: row.is_active !== false,
})

/** GET /api/owner/me/ — current owner profile. */
export const fetchOwnerMe = async () => {
  const { data } = await api.get('api/owner/me/')
  const row = data?.data || data?.user || data
  return normalizeOwner(row)
}

/** PATCH /api/owner/me/ — update current owner profile. */
export const updateOwnerMe = async (payload) => {
  const { data } = await api.patch('api/owner/me/', payload)
  const row = data?.data || data?.user || data
  return normalizeOwner(row)
}

/** GET /api/owner/ — list co-owners. */
export const fetchCoOwners = async () => {
  const { data } = await api.get('api/owner/')
  return asList(data).map(normalizeOwner)
}

/** POST /api/owner/ — add a co-owner. */
export const createCoOwner = async (payload) => {
  const { data } = await api.post('api/owner/', payload)
  const row = data?.data || data
  return normalizeOwner(row)
}

/** PATCH /api/owner/:id/ — edit a co-owner. */
export const updateCoOwner = async (ownerId, payload) => {
  const { data } = await api.patch(`api/owner/${ownerId}/`, payload)
  const row = data?.data || data
  return normalizeOwner(row)
}

/** DELETE /api/owner/:id/ — remove a co-owner. */
export const deleteCoOwner = async (ownerId) => {
  const { data } = await api.delete(`api/owner/${ownerId}/`)
  return data?.data || data
}
