/**
 * Tenant feature catalog — Super Admin toggles these per tenant.
 * Core features default ON; add-ons default OFF unless seed overrides.
 */
export const FEATURE_CATALOG = [
  {
    key: 'analytics',
    label: 'Analytics',
    description: 'Organization KPIs and operational snapshot.',
    group: 'Core',
    core: true,
    route: '/analytics',
    nav: { section: 'My organization', title: 'Analytics', icon: 'FiActivity' },
  },
  {
    key: 'services',
    label: 'Services',
    description: 'Care services catalog.',
    group: 'Catalog',
    core: true,
    route: '/services',
    nav: { section: 'Catalog', title: 'Services', icon: 'FiBriefcase' },
  },
  {
    key: 'venues',
    label: 'Venues',
    description: 'Clinics and venue locations.',
    group: 'Catalog',
    core: true,
    route: '/venues',
    nav: { section: 'Catalog', title: 'Venues', icon: 'FiMapPin' },
  },
  {
    key: 'packages',
    label: 'Packages',
    description: 'Service pricing packages.',
    group: 'Catalog',
    core: true,
    route: '/packages',
    nav: { section: 'Catalog', title: 'Packages', icon: 'FiPackage' },
  },
  {
    key: 'bookings',
    label: 'Bookings',
    description: 'Orders and care subscriptions.',
    group: 'Operations',
    core: true,
    route: '/bookings',
    nav: { section: 'Operations', title: 'Bookings', icon: 'FiCalendar' },
  },
  {
    key: 'patients',
    label: 'Patients',
    description: 'Patient profiles and medical notes.',
    group: 'Operations',
    core: true,
    route: '/patients',
    nav: { section: 'Operations', title: 'Patients', icon: 'FiUsers' },
  },
  {
    key: 'employees',
    label: 'Employees',
    description: 'Staff directory and HR profile.',
    group: 'Operations',
    core: true,
    route: '/employees',
    nav: { section: 'Operations', title: 'Employees', icon: 'FiUserCheck' },
  },
  {
    key: 'vendors',
    label: 'Vendors',
    description: 'Supplier and vendor directory.',
    group: 'Operations',
    core: true,
    route: '/vendors',
    nav: { section: 'Operations', title: 'Vendors', icon: 'FiTruck' },
  },
  {
    key: 'vendor_payments',
    label: 'Vendor payments',
    description: 'Payments issued to vendors.',
    group: 'Operations',
    core: true,
    route: '/vendor-payments',
    nav: { section: 'Operations', title: 'Vendor payments', icon: 'FiCreditCard' },
  },
  {
    key: 'attendance',
    label: 'Attendance',
    description: 'Staff attendance capture and reports for this tenant.',
    group: 'Add-ons',
    core: false,
    route: '/attendance',
    nav: { section: 'Workforce', title: 'Attendance', icon: 'FiClipboard' },
  },
  {
    key: 'staff_payouts',
    label: 'Staff payouts',
    description: 'Staff payout runs, adjustments, and payment status.',
    group: 'Add-ons',
    core: false,
    route: '/staff-payouts',
    nav: { section: 'Workforce', title: 'Staff payouts', icon: 'FiDollarSign' },
  },
]

export const FEATURE_KEYS = FEATURE_CATALOG.map((f) => f.key)

/** Default map for a newly onboarded tenant. */
export const defaultTenantFeatures = () =>
  Object.fromEntries(FEATURE_CATALOG.map((f) => [f.key, Boolean(f.core)]))

export const mergeTenantFeatures = (features) => {
  const base = defaultTenantFeatures()
  if (!features || typeof features !== 'object') return base
  FEATURE_KEYS.forEach((key) => {
    if (typeof features[key] === 'boolean') base[key] = features[key]
  })
  return base
}

export const featureByKey = (key) => FEATURE_CATALOG.find((f) => f.key === key) || null

export const featureByRoute = (pathname) =>
  FEATURE_CATALOG.find((f) => f.route === pathname) || null

export const FEATURE_GROUPS = [...new Set(FEATURE_CATALOG.map((f) => f.group))]
