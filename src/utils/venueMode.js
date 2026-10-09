const modeKey = (tenantId) => `sc_venue_mode_${tenantId || 'none'}`
const selectedKey = (tenantId) => `sc_venue_selected_${tenantId || 'none'}`

/** @returns {'single' | 'multi'} */
export const getVenueMode = (tenantId) => {
  try {
    const v = localStorage.getItem(modeKey(tenantId))
    return v === 'multi' ? 'multi' : 'single'
  } catch {
    return 'single'
  }
}

export const setVenueMode = (tenantId, mode) => {
  const next = mode === 'multi' ? 'multi' : 'single'
  try {
    localStorage.setItem(modeKey(tenantId), next)
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event('venue-mode-changed'))
  return next
}

export const getSelectedVenueId = (tenantId) => {
  try {
    return localStorage.getItem(selectedKey(tenantId)) || ''
  } catch {
    return ''
  }
}

export const setSelectedVenueId = (tenantId, venueId) => {
  const id = venueId == null || venueId === '' ? '' : String(venueId)
  try {
    if (!id) localStorage.removeItem(selectedKey(tenantId))
    else localStorage.setItem(selectedKey(tenantId), id)
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event('venue-mode-changed'))
  return id
}

/**
 * Keep selection valid for the tenant venue list.
 * In single mode, ensures one venue is selected when any exist.
 */
export const ensureVenueSelection = (tenantId, venues = []) => {
  const list = Array.isArray(venues) ? venues : []
  const mode = getVenueMode(tenantId)
  let selectedId = getSelectedVenueId(tenantId)
  const stillValid = selectedId && list.some((v) => String(v.id) === String(selectedId))

  if (!stillValid) {
    selectedId = list[0]?.id ? String(list[0].id) : ''
    if (selectedId) setSelectedVenueId(tenantId, selectedId)
    else setSelectedVenueId(tenantId, '')
  }

  if (mode === 'single' && !selectedId && list[0]?.id) {
    selectedId = String(list[0].id)
    setSelectedVenueId(tenantId, selectedId)
  }

  return { mode, selectedId }
}

/** Venues available in the current mode. */
export const getVisibleVenues = (tenantId, venues = []) => {
  const list = Array.isArray(venues) ? venues : []
  const { mode, selectedId } = ensureVenueSelection(tenantId, list)
  if (mode === 'multi' || !selectedId) return list
  return list.filter((v) => String(v.id) === String(selectedId))
}
