import EntityCrudPage from '../components/EntityCrudPage'
import { MODULE_CONFIG } from '../config/modules'
import { useAccess } from '../hooks/useAccess'
import BookingsPage from './BookingsPage'
import EmployeesPage from './EmployeesPage'
import PackagesPage from './PackagesPage'
import PatientsPage from './PatientsPage'
import ServicesPage from './ServicesPage'
import VenuesPage from './VenuesPage'

const makePage = (collection) => {
  const Page = () => {
    const { tenantId, canWrite } = useAccess()
    const cfg = MODULE_CONFIG.find((m) => m.collection === collection)
    if (!cfg || !tenantId) return null
    return <EntityCrudPage {...cfg} tenantId={tenantId} canWrite={canWrite} />
  }
  Page.displayName = `${collection}Page`
  return Page
}

export const Services = ServicesPage
export const Venues = VenuesPage
export const Packages = PackagesPage
export const Vendors = makePage('vendors')
export const VendorPayments = makePage('vendorPayments')
export const Bookings = BookingsPage
export const Patients = PatientsPage
export const Employees = EmployeesPage
