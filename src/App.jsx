import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import RequireFeature from './components/RequireFeature'
import RequireSelectedTenant from './components/RequireSelectedTenant'
import RequireSuperAdmin from './components/RequireSuperAdmin'
import RequireTenantOwner from './components/RequireTenantOwner'
import AttendancePage from './pages/AttendancePage'
import BookingsPage from './pages/BookingsPage'
import Dashboard from './pages/Dashboard'
import EmployeesPage from './pages/EmployeesPage'
import LocationPackagesPage from './pages/LocationPackagesPage'
import Lobby from './pages/Lobby'
import Login from './pages/Login'
import ModulePlaceholder from './pages/ModulePlaceholder'
import MyTenants from './pages/MyTenants'
import PatientsPage from './pages/PatientsPage'
import Profile from './pages/Profile'
import ResourcesPage from './pages/ResourcesPage'
import Roles from './pages/Roles'
import ServicesPage from './pages/ServicesPage'
import SettingsPage from './pages/SettingsPage'
import StaffPayoutsPage from './pages/StaffPayoutsPage'
import TenantDetail from './pages/TenantDetail'
import Tenants from './pages/Tenants'
import VenuesPage from './pages/VenuesPage'
import { PlatformAnalytics, PlatformOffboarded } from './pages/platform/PlatformPages'
import PlatformPermissions from './pages/platform/PlatformPermissions'
import SubscriptionPlans from './pages/platform/SubscriptionPlans'
import TenantSubscriptions from './pages/platform/TenantSubscriptions'

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />

          <Route element={<RequireTenantOwner />}>
            <Route path="my-tenants" element={<MyTenants />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          <Route element={<RequireSuperAdmin />}>
            <Route path="roles" element={<Roles />} />
            <Route path="lobby" element={<Lobby />} />
            <Route path="tenants" element={<Tenants />} />
            <Route path="tenants/offboarded" element={<PlatformOffboarded />} />
            <Route path="tenants/:tenantId" element={<TenantDetail />} />
            <Route path="platform/analytics" element={<PlatformAnalytics />} />
            <Route path="platform/permissions" element={<PlatformPermissions />} />
            <Route path="platform/roles" element={<Navigate to="/roles" replace />} />
            <Route path="platform/subscription-plans" element={<SubscriptionPlans />} />
            <Route path="platform/tenant-subscriptions" element={<TenantSubscriptions />} />
          </Route>

          <Route path="settings" element={<SettingsPage mode="account" />} />

          <Route element={<RequireSelectedTenant />}>
            <Route path="ops/settings" element={<SettingsPage mode="tenant" />} />
            <Route element={<RequireFeature />}>
              <Route path="ops/venues" element={<VenuesPage />} />
              <Route path="ops/services" element={<ServicesPage />} />
              <Route path="ops/resources" element={<ResourcesPage />} />
              <Route path="ops/emr" element={<ModulePlaceholder />} />
              <Route path="ops/analytics/attendance-master" element={<ModulePlaceholder />} />
              <Route path="ops/analytics/reminders" element={<ModulePlaceholder />} />
              <Route path="ops/analytics/payment-master" element={<ModulePlaceholder />} />
              <Route path="ops/analytics/unmapped-payments" element={<ModulePlaceholder />} />
              <Route path="ops/staff/employees" element={<EmployeesPage />} />
              <Route path="ops/staff/attendance" element={<AttendancePage />} />
              <Route path="ops/staff/payroll" element={<ModulePlaceholder />} />
              <Route path="ops/staff/payouts" element={<StaffPayoutsPage />} />
              <Route path="ops/staff/for-hire" element={<ModulePlaceholder />} />
              <Route path="ops/customers" element={<PatientsPage />} />
              <Route path="ops/bookings" element={<BookingsPage />} />
              <Route path="ops/customer-lobby" element={<ModulePlaceholder />} />
              <Route path="ops/location-packages" element={<LocationPackagesPage />} />
              <Route path="ops/n8n-templates" element={<ModulePlaceholder />} />
            </Route>
            <Route element={<RequireSuperAdmin />}>
              <Route path="ops/leads" element={<ModulePlaceholder />} />
              <Route path="ops/quotations" element={<ModulePlaceholder />} />
              <Route path="ops/invoices" element={<ModulePlaceholder />} />
              <Route path="ops/payments" element={<ModulePlaceholder />} />
            </Route>
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
)

export default App
