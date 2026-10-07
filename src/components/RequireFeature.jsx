import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { FEATURE_CATALOG, featureByRoute } from '../config/features'
import { useAccess } from '../hooks/useAccess'

/** Tenant routes: allow only if Super Admin enabled the matching feature. */
const RequireFeature = () => {
  const { tenantId, features, hasFeature } = useAccess()
  const { pathname } = useLocation()
  const feature = featureByRoute(pathname)

  if (!tenantId) return <Navigate to="/" replace />
  if (!feature) return <Outlet />
  if (hasFeature(feature.key)) return <Outlet />

  const firstOn = FEATURE_CATALOG.find((f) => features?.[f.key])
  return <Navigate to={firstOn?.route || '/'} replace />
}

export default RequireFeature
