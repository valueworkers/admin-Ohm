import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import RequireSuperAdmin from './components/RequireSuperAdmin'
import Dashboard from './pages/Dashboard'
import Lobby from './pages/Lobby'
import Login from './pages/Login'
import TenantDetail from './pages/TenantDetail'
import Tenants from './pages/Tenants'
import {
  PlatformAnalytics,
  PlatformBookings,
  PlatformEmployees,
  PlatformOffboarded,
  PlatformOwners,
  PlatformPatients,
  PlatformSettings,
} from './pages/platform/PlatformPages'
import PlatformPermissions from './pages/platform/PlatformPermissions'
import PlatformVendors from './pages/platform/PlatformVendors'

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route element={<RequireSuperAdmin />}>
            <Route index element={<Dashboard />} />
            <Route path="lobby" element={<Lobby />} />
            <Route path="tenants" element={<Tenants />} />
            <Route path="tenants/:tenantId" element={<TenantDetail />} />
            <Route path="platform/analytics" element={<PlatformAnalytics />} />
            <Route path="platform/bookings" element={<PlatformBookings />} />
            <Route path="platform/patients" element={<PlatformPatients />} />
            <Route path="platform/employees" element={<PlatformEmployees />} />
            <Route path="platform/vendors" element={<PlatformVendors />} />
            <Route path="platform/owners" element={<PlatformOwners />} />
            <Route path="platform/offboarded" element={<PlatformOffboarded />} />
            <Route path="platform/permissions" element={<PlatformPermissions />} />
            <Route path="platform/settings" element={<PlatformSettings />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
)

export default App
