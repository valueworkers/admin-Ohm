import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAccess } from './useAccess'
import {
  ensureVenueSelection,
  getSelectedVenueId,
  getVisibleVenues,
  setSelectedVenueId,
  setVenueMode,
} from '../utils/venueMode'

/**
 * Single / Multi venue scope is configured by Super Admin per tenant.
 * Super Admin always sees and can manage all venues/services.
 * Tenants only see the selected venue when mode is Single.
 */
export const useVenueScope = (tenantId, venues = []) => {
  const { isSuperAdmin } = useAccess()
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const sync = () => setTick((n) => n + 1)
    window.addEventListener('venue-mode-changed', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('venue-mode-changed', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  void tick

  const { mode, selectedId } = useMemo(
    () => ensureVenueSelection(tenantId, venues),
    [tenantId, venues, tick]
  )

  const scopedVenues = useMemo(
    () => getVisibleVenues(tenantId, venues),
    [tenantId, venues, tick]
  )

  /** What the current user sees in lists / pickers. */
  const displayVenues = isSuperAdmin ? venues : scopedVenues

  const switchMode = useCallback(
    (next) => {
      if (!isSuperAdmin) return
      setVenueMode(tenantId, next)
      if (next === 'single' && venues[0]?.id && !getSelectedVenueId(tenantId)) {
        setSelectedVenueId(tenantId, venues[0].id)
      }
    },
    [tenantId, venues, isSuperAdmin]
  )

  const selectVenue = useCallback(
    (id) => {
      if (!isSuperAdmin) return
      setSelectedVenueId(tenantId, id)
    },
    [tenantId, isSuperAdmin]
  )

  return {
    mode,
    selectedId,
    /** Filtered for tenant in Single; all for Super Admin */
    displayVenues,
    scopedVenues,
    allVenues: venues,
    switchMode,
    selectVenue,
    isSingle: mode === 'single',
    isMulti: mode === 'multi',
    /** Only Super Admin configures Single / Multi */
    canConfigureMode: isSuperAdmin,
    /** Tenant is limited to selected venue when Single */
    tenantRestricted: !isSuperAdmin && mode === 'single',
  }
}
