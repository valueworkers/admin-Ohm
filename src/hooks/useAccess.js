import { useEffect, useState } from 'react'
import { defaultTenantFeatures } from '../config/features'
import {
  canWriteTenantData,
  getAuthUser,
  isSuperAdmin,
  isTenantOwner,
} from '../utils/auth'
import { getTenant, getTenantFeatures, subscribePlatform } from '../store/platformStore'

export const useAccess = () => {
  const [storeTick, setStoreTick] = useState(0)

  useEffect(() => {
    const sync = () => setStoreTick((n) => n + 1)
    window.addEventListener('auth-changed', sync)
    const unsub = subscribePlatform(sync)
    return () => {
      window.removeEventListener('auth-changed', sync)
      unsub()
    }
  }, [])

  void storeTick

  const user = getAuthUser()
  const tenantId = user?.tenant_id || null
  const tenant = tenantId ? getTenant(tenantId) : null
  const features = tenantId ? getTenantFeatures(tenantId) : defaultTenantFeatures()

  return {
    user,
    isSuperAdmin: isSuperAdmin(user),
    isTenantOwner: isTenantOwner(user),
    tenantId,
    tenant,
    features,
    hasFeature: (key) => Boolean(features?.[key]),
    canWrite: canWriteTenantData(user),
  }
}
