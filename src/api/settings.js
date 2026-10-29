import api from './axiosClient'

/** Normalize GET /api/settings/profile/ payload. */
export const normalizeSettingsProfile = (row = {}) => ({
  id: row.id ?? row.pk ?? null,
  first_name: row.first_name || '',
  last_name: row.last_name || '',
  email: row.email || '',
  email_verified: Boolean(row.email_verified),
  email_verified_at: row.email_verified_at || null,
  pending_email: row.pending_email || '',
})

/** GET /api/settings/profile/ — Super Admin account profile. */
export const fetchSettingsProfile = async () => {
  const { data } = await api.get('api/settings/profile/')
  const row = data?.data || data?.profile || data
  return normalizeSettingsProfile(row)
}

/** PATCH /api/settings/profile/ — update Super Admin name fields. */
export const updateSettingsProfile = async (payload) => {
  const { data } = await api.patch('api/settings/profile/', payload)
  const row = data?.data || data?.profile || data
  return normalizeSettingsProfile(row)
}
