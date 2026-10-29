import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { FEATURE_CATALOG, featureByRoute } from '../config/features'
import { useAccess } from '../hooks/useAccess'
import { EmptyState, Panel } from './ui/PageState'

/**
 * Operations (leads / quotations / invoices / payments).
 * Super Admin: no tenant required; sees platform billing content.
 * Tenant Admin: needs an organization + feature flag; sees tenant-scoped placeholders
 * (not the Super Admin quotes / invoices / payments UI).
 */
const RequireOpsAccess = () => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { hasTenantSelected, isSuperAdmin, tenant, features, hasFeature } = useAccess()
  const feature = featureByRoute(pathname)

  if (isSuperAdmin) return <Outlet context={{ tenant }} />

  if (!hasTenantSelected) {
    return (
      <Panel>
        <EmptyState
          bare
          title="No organization selected"
          hint="Activate or select one of your tenants first."
          actionLabel="My tenants"
          onAction={() => navigate('/my-tenants')}
        />
      </Panel>
    )
  }

  if (feature && !hasFeature(feature.key)) {
    const firstOn = FEATURE_CATALOG.find((f) => features?.[f.key])
    return <Navigate to={firstOn?.route || '/'} replace />
  }

  return <Outlet context={{ tenant }} />
}

export default RequireOpsAccess
