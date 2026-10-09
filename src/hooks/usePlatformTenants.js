import { useCallback, useEffect, useState } from 'react'
import {
  getTenant,
  listTenantsByStatus,
  subscribePlatform,
} from '../store/platformStore'
import {
  clearSelectedTenant,
  getSelectedTenantId,
  setSelectedTenantId,
} from '../utils/tenants'

export const usePlatformTenants = () => {
  const sync = useCallback(() => {
    const active = listTenantsByStatus('active')
    let selectedId = getSelectedTenantId()
    if (selectedId && !active.some((t) => String(t.id) === String(selectedId))) {
      clearSelectedTenant()
      selectedId = ''
    }
    return {
      tenants: active,
      selectedId: selectedId || '',
      selected: selectedId ? getTenant(selectedId) : null,
    }
  }, [])

  const [state, setState] = useState(sync)

  useEffect(() => {
    const refresh = () => setState(sync())
    refresh()
    const unsub = subscribePlatform(refresh)
    window.addEventListener('tenant-selection-changed', refresh)
    return () => {
      unsub()
      window.removeEventListener('tenant-selection-changed', refresh)
    }
  }, [sync])

  const selectTenant = useCallback((id) => {
    if (!id) clearSelectedTenant()
    else setSelectedTenantId(id)
  }, [])

  return {
    tenants: state.tenants,
    selectedId: state.selectedId,
    selected: state.selected,
    selectTenant,
    clearSelection: () => clearSelectedTenant(),
  }
}
