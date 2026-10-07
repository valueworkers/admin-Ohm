import { Navigate, Outlet, useLocation } from 'react-router-dom'
import {
  canAccessAdminPanel,
  clearAuthSession,
  getAuthUser,
  isAuthenticated,
} from '../utils/auth'

const ProtectedRoute = () => {
  const location = useLocation()
  const user = getAuthUser()

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!canAccessAdminPanel(user)) {
    clearAuthSession()
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
