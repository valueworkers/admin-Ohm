import { Navigate, Outlet } from 'react-router-dom'
import { getAuthUser, isSuperAdmin } from '../utils/auth'

const RequireSuperAdmin = () => {
  const user = getAuthUser()
  if (!isSuperAdmin(user)) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}

export default RequireSuperAdmin
