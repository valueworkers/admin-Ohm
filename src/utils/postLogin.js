import { fetchMyTenants } from '../api/myTenants'
import { getAuthUser, isTenantOwner, persistAuthSession } from './auth'
import { saveStoredTenants, setSelectedTenantId } from './tenants'

/** After owner login: load my tenants and select an active one when possible. */
export const syncOwnerTenantsAfterLogin = async () => {
  const user = getAuthUser()
  if (!isTenantOwner(user)) return { tenants: [] }

  try {
    const tenants = await fetchMyTenants()
    saveStoredTenants(tenants)

    const preferred =
      tenants.find((t) => String(t.status).toLowerCase() === 'active') ||
      tenants.find((t) => t.is_active === true) ||
      tenants[0] ||
      null

    if (preferred?.id != null) {
      const slug = preferred.schema_name || preferred.slug || ''
      setSelectedTenantId(preferred.id)
      persistAuthSession({
        user: {
          ...user,
          tenant_id: preferred.id,
          tenant_slug: slug,
          schema_name: slug,
          organization_name: preferred.name || user.organization_name || '',
        },
      })
    }

    return { tenants }
  } catch {
    return { tenants: [] }
  }
}
