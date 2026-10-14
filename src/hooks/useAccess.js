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
