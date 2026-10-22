import { useCallback, useEffect, useState } from 'react'
import { fetchTenants } from '../api/tenants'
import { getAuthUser, isSuperAdmin } from '../utils/auth'
import {
  clearSelectedTenant,
  getSelectedTenant,
  getSelectedTenantId,
  getStoredTenants,
  saveStoredTenants,
  setSelectedTenantId,
} from '../utils/tenants'

const TENANTS_REFRESH_EVENT = 'api-tenants-refreshed'

export const refreshApiTenants = async () => {
  const list = await fetchTenants()
  saveStoredTenants(list)
  window.dispatchEvent(new Event(TENANTS_REFRESH_EVENT))
  return list
}

export const usePlatformTenants = () => {
  const [tenants, setTenants] = useState(() => getStoredTenants())
  const [selectedId, setSelectedId] = useState(() => getSelectedTenantId() || '')
  const [selected, setSelected] = useState(() => getSelectedTenant())
  const [loading, setLoading] = useState(false)

  const syncFromStorage = useCallback(() => {
    const list = getStoredTenants()
    let id = getSelectedTenantId()
    if (id && !list.some((t) => String(t.id) === String(id))) {
      if (id) clearSelectedTenant()
      id = ''
    }
    setTenants(list)
    setSelectedId(id || '')
    setSelected(id ? list.find((t) => String(t.id) === String(id)) || null : null)
  }, [])

  const load = useCallback(async () => {
    // Platform tenants list is Super Admin only — never call it for tenant sessions
    // (401 would force-logout via axios interceptor).
    if (!isSuperAdmin(getAuthUser())) {
      syncFromStorage()
      return
    }
    setLoading(true)
    try {
      const list = await fetchTenants()
      saveStoredTenants(list)
    } catch {
      syncFromStorage()
    } finally {
      setLoading(false)
    }
  }, [syncFromStorage])

  useEffect(() => {
    let mounted = true
    const safeSync = () => {
      if (mounted) syncFromStorage()
    }

    load()
    window.addEventListener('tenant-selection-changed', safeSync)
    window.addEventListener('tenants-changed', safeSync)
    window.addEventListener(TENANTS_REFRESH_EVENT, safeSync)
    window.addEventListener('auth-changed', load)
    return () => {
      mounted = false
      window.removeEventListener('tenant-selection-changed', safeSync)
      window.removeEventListener('tenants-changed', safeSync)
      window.removeEventListener(TENANTS_REFRESH_EVENT, safeSync)
      window.removeEventListener('auth-changed', load)
    }
  }, [load, syncFromStorage])

  const selectTenant = useCallback((id) => {
    if (!id) clearSelectedTenant()
    else setSelectedTenantId(id)
  }, [])

  return {
    tenants,
    selectedId,
    selected,
    loading,
    selectTenant,
    clearSelection: () => clearSelectedTenant(),
    refresh: load,
  }
}
