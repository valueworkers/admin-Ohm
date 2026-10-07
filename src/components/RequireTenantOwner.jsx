import { Navigate, Outlet } from 'react-router-dom'
import { getAuthUser, isTenantOwner } from '../utils/auth'

const RequireTenantOwner = () => {
  const user = getAuthUser()
  if (!isTenantOwner(user)) {
    return <Navigate to="/" replace />
  }
  if (!user?.tenant_id) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}

export default RequireTenantOwner
