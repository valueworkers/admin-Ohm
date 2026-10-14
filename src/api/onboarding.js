import api from './axiosClient'

const asList = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.data)) return data.data
  return []
}

/** GET /onboarding/requests/ — Super Admin lobby queue. */
export const fetchOnboardingRequests = async () => {
  const { data } = await api.get('onboarding/requests/')
  return asList(data)
}

/** POST /onboarding/requests/:id/approve/ */
export const approveOnboardingRequest = async (provisioningId, reviewNotes = 'Approved') => {
  const { data } = await api.post(`onboarding/requests/${provisioningId}/approve/`, {
    review_notes: reviewNotes,
  })
  return data
}

/** POST /onboarding/requests/:id/reject/ */
export const rejectOnboardingRequest = async (provisioningId, reviewNotes = 'Rejected') => {
  const { data } = await api.post(`onboarding/requests/${provisioningId}/reject/`, {
    review_notes: reviewNotes,
  })
  return data
}

/** PATCH /onboarding/requests/:id/ — edit lobby request before approve/reject. */
export const updateOnboardingRequest = async (provisioningId, payload) => {
  const { data } = await api.patch(`onboarding/requests/${provisioningId}/`, payload)
  return data?.data || data
}

/** DELETE /onboarding/requests/:id/ — remove a lobby request. */
export const deleteOnboardingRequest = async (provisioningId) => {
  const { data } = await api.delete(`onboarding/requests/${provisioningId}/`)
  return data?.data || data
}
