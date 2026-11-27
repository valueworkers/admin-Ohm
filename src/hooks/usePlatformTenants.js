import { useCallback, useEffect, useState } from 'react'
import { fetchMyTenants } from '../api/myTenants'
import { fetchTenants } from '../api/tenants'
import { getAuthUser, isSuperAdmin, isTenantOwner, persistAuthSession } from '../utils/auth'
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
  const user = getAuthUser()
  const list = isSuperAdmin(user) ? await fetchTenants() : await fetchMyTenants()
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
    // Tenant sessions without an explicit selection: keep auth user tenant if present.
    if (!id && !isSuperAdmin(getAuthUser())) {
      const authTenantId = getAuthUser()?.tenant_id
      if (authTenantId && list.some((t) => String(t.id) === String(authTenantId))) {
        id = String(authTenantId)
      }
    }
    setTenants(list)
    setSelectedId(id || '')
    setSelected(id ? list.find((t) => String(t.id) === String(id)) || null : null)
  }, [])

  const load = useCallback(async () => {
    const user = getAuthUser()
    if (!user) {
      setTenants([])
      setSelectedId('')
      setSelected(null)
      return
    }

    setLoading(true)
    try {
      const list = isSuperAdmin(user)
        ? await fetchTenants()
        : isTenantOwner(user)
          ? await fetchMyTenants()
          : []
      saveStoredTenants(list)

      // Ensure a selection exists for tenant owners when the API returns orgs.
      if (!isSuperAdmin(user) && list.length) {
        const current = getSelectedTenantId()
        const authId = user?.tenant_id
        const stillValid =
          current && list.some((t) => String(t.id) === String(current))
        if (!stillValid) {
          const preferred =
            list.find((t) => String(t.id) === String(authId)) ||
            list.find((t) => String(t.status).toLowerCase() === 'active') ||
            list[0]
          if (preferred?.id != null) setSelectedTenantId(preferred.id)
        }
      }
    } catch {
      syncFromStorage()
    } finally {
      setLoading(false)
      syncFromStorage()
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
    if (!id) {
      clearSelectedTenant()
      return
    }
    setSelectedTenantId(id)
    const user = getAuthUser()
    if (!user || isSuperAdmin(user)) return
    const row = getStoredTenants().find((t) => String(t.id) === String(id))
    if (!row) return
    const slug = row.schema_name || row.slug || ''
    persistAuthSession({
      user: {
        ...user,
        tenant_id: row.id,
        tenant_slug: slug,
        schema_name: slug,
        organization_name: row.name || user.organization_name || '',
      },
    })
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
