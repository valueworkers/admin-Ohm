import { useCallback, useEffect, useState } from 'react'
import { canSwitchTenants, getAuthUser, isVsreOwner } from '../utils/auth'
import {
  applyRoleTenantScope,
  clearSelectedTenant,
  getSelectedTenant,
  getSelectedTenantId,
  getVisibleTenants,
  setSelectedTenantId,
  tenantFromOwnerUser,
} from '../utils/tenants'

export const useTenants = () => {
  const syncFromStorage = useCallback(() => {
    const user = getAuthUser()
    applyRoleTenantScope(user)
    return {
      tenants: getVisibleTenants(user),
      selectedId: getSelectedTenantId(),
      selected: getSelectedTenant(),
    }
  }, [])

  const initial = syncFromStorage()
  const [tenants, setTenants] = useState(initial.tenants)
  const [selectedId, setSelectedId] = useState(initial.selectedId)
  const [selected, setSelected] = useState(initial.selected)

  const refresh = useCallback(() => {
    const next = syncFromStorage()
    setTenants(next.tenants)
    setSelectedId(next.selectedId)
    setSelected(next.selected)
  }, [syncFromStorage])

  useEffect(() => {
    refresh()
    const sync = () => refresh()
    window.addEventListener('tenants-changed', sync)
    window.addEventListener('tenant-selection-changed', sync)
    window.addEventListener('auth-changed', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('tenants-changed', sync)
      window.removeEventListener('tenant-selection-changed', sync)
      window.removeEventListener('auth-changed', sync)
      window.removeEventListener('storage', sync)
    }
  }, [refresh])

  const selectTenant = useCallback((id) => {
    const user = getAuthUser()
    if (!canSwitchTenants(user)) {
      const mine = tenantFromOwnerUser(user)
      if (mine) setSelectedTenantId(mine.id)
      return
    }
    setSelectedTenantId(id)
  }, [])

  const clearSelection = useCallback(() => {
    if (isVsreOwner(getAuthUser())) return
    clearSelectedTenant()
  }, [])

  return {
    tenants,
    selectedId,
    selected,
    selectTenant,
    clearSelection,
    refresh,
    canSwitch: canSwitchTenants(getAuthUser()),
  }
}
