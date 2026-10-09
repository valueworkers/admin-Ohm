/**
 * Tenant feature catalog — Super Admin toggles these per tenant.
 * Core features default ON; add-ons default OFF unless seed overrides.
 * `route` matches current Super Admin / tenant panel paths under /ops.
 */
export const FEATURE_CATALOG = [
  {
    key: 'venues',
    label: 'Venues',
    description: 'Clinics and venue locations (Single / Multi scope).',
    group: 'Catalog',
    core: true,
    route: '/ops/venues',
  },
  {
    key: 'services',
    label: 'Services',
    description: 'Care services catalog (Show to tenant controls).',
    group: 'Catalog',
    core: true,
    route: '/ops/services',
  },
  {
    key: 'packages',
    label: 'Location & Package',
    description: 'Packages for the selected venue.',
    group: 'Catalog',
    core: true,
    route: '/ops/location-packages',
  },
  {
    key: 'resources',
    label: 'Resources',
    description: 'Tenant resources module.',
    group: 'Catalog',
    core: true,
    route: '/ops/resources',
  },
  {
    key: 'emr',
    label: 'EMR',
    description: 'Electronic medical records.',
    group: 'Catalog',
    core: false,
    route: '/ops/emr',
  },
  {
    key: 'analytics',
    label: 'Analytics',
    description: 'Attendance master, reminders, payment analytics.',
    group: 'Insights',
    core: true,
    route: '/ops/analytics',
  },
  {
    key: 'bookings',
    label: 'Bookings',
    description: 'Orders and care subscriptions.',
    group: 'Manage Customer',
    core: true,
    route: '/ops/bookings',
  },
  {
    key: 'patients',
    label: 'Customer Master',
    description: 'Patient / customer profiles.',
    group: 'Manage Customer',
    core: true,
    route: '/ops/customers',
  },
  {
    key: 'customer_lobby',
    label: 'Customer Lobby',
    description: 'Customer onboarding lobby.',
    group: 'Manage Customer',
    core: true,
    route: '/ops/customer-lobby',
  },
  {
    key: 'invoices',
    label: 'Invoices',
    description: 'Customer invoices.',
    group: 'Manage Customer',
    core: true,
    route: '/ops/invoices',
  },
  {
    key: 'payments',
    label: 'Payments',
    description: 'Customer payments.',
    group: 'Manage Customer',
    core: true,
    route: '/ops/payments',
  },
  {
    key: 'employees',
    label: 'Employee Master',
    description: 'Staff directory and HR profile.',
    group: 'Manage Staff',
    core: true,
    route: '/ops/staff/employees',
  },
  {
    key: 'attendance',
    label: 'Attendance',
    description: 'Staff attendance capture and reports.',
    group: 'Manage Staff',
    core: false,
    route: '/ops/staff/attendance',
  },
  {
    key: 'payroll',
    label: 'Payroll',
    description: 'Staff payroll runs.',
    group: 'Manage Staff',
    core: false,
    route: '/ops/staff/payroll',
  },
  {
    key: 'staff_payouts',
    label: 'Staff payouts',
    description: 'Staff payout runs and payment status.',
    group: 'Manage Staff',
    core: false,
    route: '/ops/staff/payouts',
  },
  {
    key: 'staff_for_hire',
    label: 'Staff for hire',
    description: 'Hiring / contractor pool.',
    group: 'Manage Staff',
    core: false,
    route: '/ops/staff/for-hire',
  },
  {
    key: 'vendors',
    label: 'Vendors',
    description: 'Supplier and vendor directory.',
    group: 'Operations',
    core: true,
    route: '/ops/vendors',
  },
  {
    key: 'n8n_templates',
    label: 'N8N Templates',
    description: 'Automation templates for the tenant.',
    group: 'More',
    core: false,
    route: '/ops/n8n-templates',
  },
]

export const FEATURE_KEYS = FEATURE_CATALOG.map((f) => f.key)

/** Per-tenant login roles that can receive separate module entitlements. */
export const TENANT_ROLES = {
  ADMIN: 'ADMIN',
  OPS_ADMIN: 'OPS_ADMIN',
}

/** Role columns for Permissions (add entries here to expose new login roles). */
export const TENANT_ROLE_OPTIONS = [
  {
    id: TENANT_ROLES.ADMIN,
    label: 'Tenant Admin',
    shortLabel: 'Admin',
    featureKey: 'admin',
    hint: 'Organization admin login',
  },
  {
    id: TENANT_ROLES.OPS_ADMIN,
    label: 'Ops Admin',
    shortLabel: 'Ops Admin',
    featureKey: 'ops_admin',
    hint: 'Operations admin login',
  },
]

export const normalizeTenantRole = (role) => {
  const r = String(role || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
  if (
    r === TENANT_ROLES.OPS_ADMIN ||
    r === 'OPS' ||
    r === 'OPSADMIN' ||
    r.includes('OPS_ADMIN') ||
    r.includes('OPS')
  ) {
    return TENANT_ROLES.OPS_ADMIN
  }
  return TENANT_ROLES.ADMIN
}

/** Default map for one role (Admin or Ops Admin). */
export const defaultTenantFeatures = () =>
  Object.fromEntries(FEATURE_CATALOG.map((f) => [f.key, Boolean(f.core)]))

/** Flat boolean map → merged with catalog defaults. */
export const mergeTenantFeatures = (features) => {
  const base = defaultTenantFeatures()
  if (!features || typeof features !== 'object') return base
  FEATURE_KEYS.forEach((key) => {
    if (typeof features[key] === 'boolean') base[key] = features[key]
  })
  return base
}

const ROLE_FEATURE_KEYS = TENANT_ROLE_OPTIONS.map((r) => r.featureKey)

const isFlatFeatureMap = (features) =>
  features &&
  typeof features === 'object' &&
  !ROLE_FEATURE_KEYS.some((key) => features[key] && typeof features[key] === 'object') &&
  FEATURE_KEYS.some((key) => typeof features[key] === 'boolean')

/** Storage bucket for a login role (`admin`, `ops_admin`, …). */
export const roleFeatureBucket = (role) => {
  const id = normalizeTenantRole(role)
  const opt = TENANT_ROLE_OPTIONS.find((r) => r.id === id)
  return opt?.featureKey || TENANT_ROLE_OPTIONS[0]?.featureKey || 'admin'
}

/**
 * Normalized role-scoped features keyed by `featureKey` from TENANT_ROLE_OPTIONS.
 * Legacy flat maps become Admin entitlements; other roles get catalog defaults.
 */
export const normalizeRoleFeatures = (features) => {
  const next = {}
  if (isFlatFeatureMap(features)) {
    TENANT_ROLE_OPTIONS.forEach((role, index) => {
      next[role.featureKey] =
        index === 0 ? mergeTenantFeatures(features) : defaultTenantFeatures()
    })
    return next
  }
  TENANT_ROLE_OPTIONS.forEach((role, index) => {
    const raw = features?.[role.featureKey]
    next[role.featureKey] =
      index === 0 && !raw ? mergeTenantFeatures(features) : mergeTenantFeatures(raw)
  })
  return next
}

export const getFeaturesForRole = (features, role) => {
  const normalized = normalizeRoleFeatures(features)
  return normalized[roleFeatureBucket(role)] || defaultTenantFeatures()
}

export const featureByKey = (key) => FEATURE_CATALOG.find((f) => f.key === key) || null

export const featureByRoute = (pathname) =>
  FEATURE_CATALOG.find(
    (f) => pathname === f.route || pathname.startsWith(`${f.route}/`)
  ) || null

export const FEATURE_GROUPS = [...new Set(FEATURE_CATALOG.map((f) => f.group))]
