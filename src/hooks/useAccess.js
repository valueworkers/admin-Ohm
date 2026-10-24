import { useEffect, useState } from 'react'
import {
  defaultTenantFeatures,
  normalizeTenantRole,
  TENANT_ROLES,
} from '../config/features'
import {
  canSwitchTenants,
  canWriteTenantData,
  getAuthUser,
  getTenantRole,
  isOpsAdmin,
  isSuperAdmin,
  isTenantAdmin,
  isTenantOwner,
} from '../utils/auth'
import { getTenant, getTenantFeatures, subscribePlatform } from '../store/platformStore'
import { getSelectedTenant, getSelectedTenantId, getStoredTenants } from '../utils/tenants'

export const useAccess = () => {
  const [storeTick, setStoreTick] = useState(0)

  useEffect(() => {
    const sync = () => setStoreTick((n) => n + 1)
    window.addEventListener('auth-changed', sync)
    window.addEventListener('tenant-selection-changed', sync)
    window.addEventListener('tenants-changed', sync)
    window.addEventListener('api-tenants-refreshed', sync)
    const unsub = subscribePlatform(sync)
    return () => {
      window.removeEventListener('auth-changed', sync)
      window.removeEventListener('tenant-selection-changed', sync)
      window.removeEventListener('tenants-changed', sync)
      window.removeEventListener('api-tenants-refreshed', sync)
      unsub()
    }
  }, [])

  void storeTick

  const user = getAuthUser()
  const superAdmin = isSuperAdmin(user)

  useEffect(() => {
    // Heal stale sessions where role is Super Admin but user_type was wrong (once).
    if (!user || !superAdmin) return
    if (String(user.user_type || '').toUpperCase().replace(/[\s-]+/g, '_') === 'SUPER_ADMIN') {
      return
    }
    try {
      const healed = { ...user, user_type: 'SUPER_ADMIN', tenant_id: null }
      localStorage.setItem('authUser', JSON.stringify(healed))
      localStorage.setItem('user_type', 'SUPER_ADMIN')
      // Defer event so we don't re-enter effects in the same tick
      window.setTimeout(() => window.dispatchEvent(new Event('auth-changed')), 0)
    } catch {
      // ignore
    }
  }, [superAdmin, user?.id, user?.user_type, user?.role, user?.primary_role])

  const tenantId = superAdmin
    ? getSelectedTenantId() || null
    : user?.tenant_id || null
  const tenant = tenantId
    ? getSelectedTenant() ||
      getStoredTenants().find((t) => String(t.id) === String(tenantId)) ||
      getTenant(tenantId)
    : null
  const tenantRole = superAdmin ? TENANT_ROLES.ADMIN : getTenantRole(user)
  const features = tenantId
    ? getTenantFeatures(tenantId, tenantRole)
    : defaultTenantFeatures()

  return {
    user,
    isSuperAdmin: superAdmin,
    isTenantOwner: isTenantOwner(user),
    isTenantAdmin: isTenantAdmin(user),
    isOpsAdmin: isOpsAdmin(user),
    tenantRole: normalizeTenantRole(tenantRole),
    tenantId: tenant ? String(tenant.id) : null,
    tenant,
    features,
    hasFeature: (key) => Boolean(features?.[key]),
    canWrite: canWriteTenantData(user),
    canSwitch: canSwitchTenants(user),
    hasTenantSelected: Boolean(tenant),
  }
}
