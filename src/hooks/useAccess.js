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
import { getSelectedTenantId } from '../utils/tenants'

export const useAccess = () => {
  const [storeTick, setStoreTick] = useState(0)

  useEffect(() => {
    const sync = () => setStoreTick((n) => n + 1)
    window.addEventListener('auth-changed', sync)
    window.addEventListener('tenant-selection-changed', sync)
    const unsub = subscribePlatform(sync)
    return () => {
      window.removeEventListener('auth-changed', sync)
      window.removeEventListener('tenant-selection-changed', sync)
      unsub()
    }
  }, [])

  void storeTick

  const user = getAuthUser()
  const superAdmin = isSuperAdmin(user)
  const tenantId = superAdmin
    ? getSelectedTenantId() || null
    : user?.tenant_id || null
  const tenant = tenantId ? getTenant(tenantId) : null
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
