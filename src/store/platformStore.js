import {
  defaultTenantFeatures,
  getFeaturesForRole,
  mergeTenantFeatures,
  normalizeRoleFeatures,
  normalizeTenantRole,
  roleFeatureBucket,
  TENANT_ROLES,
} from '../config/features'
import { SEED_TENANTS, SEED_USERS, buildSeedCollections } from '../data/seed'

const STORAGE_KEY = 'sc_platform_v11'
const LEGACY_STORAGE_KEYS = ['sc_platform_v10', 'sc_platform_v9', 'sc_platform_v2']
const EVENT = 'platform-changed'

let storeRevision = 0

export const getPlatformRevision = () => storeRevision

const normalizeTenants = (tenants = []) =>
  (tenants || []).map((t) => ({
    ...t,
    features: normalizeRoleFeatures(t.features),
  }))

const normalizeUsers = (users = []) => {
  const seedById = Object.fromEntries(SEED_USERS.map((u) => [u.id, u]))
  const byEmail = Object.fromEntries(
    SEED_USERS.map((u) => [String(u.email || '').toLowerCase(), u])
  )
  const merged = (users || []).map((u) => {
    const seed = seedById[u.id] || byEmail[String(u.email || '').toLowerCase()]
    if (!seed) {
      return {
        ...u,
        tenant_role: u.tenant_role
          ? normalizeTenantRole(u.tenant_role)
          : normalizeTenantRole(u.role_label),
      }
    }
    return {
      ...seed,
      ...u,
      phone: u.phone || seed.phone,
      tenant_role: normalizeTenantRole(u.tenant_role || seed.tenant_role || u.role_label),
      role_label: u.role_label || seed.role_label,
    }
  })
  const existingIds = new Set(merged.map((u) => u.id))
  const existingEmails = new Set(merged.map((u) => String(u.email || '').toLowerCase()))
  SEED_USERS.forEach((seed) => {
    if (existingIds.has(seed.id) || existingEmails.has(String(seed.email || '').toLowerCase())) {
      return
    }
    merged.push({ ...seed })
  })
  return merged
}

const emptyState = () => {
  const collections = buildSeedCollections()
  return {
    users: SEED_USERS.map((u) => ({ ...u })),
    tenants: SEED_TENANTS.map((t) => ({
      ...t,
      features: normalizeRoleFeatures(t.features),
    })),
    ...collections,
  }
}

const read = () => {
  try {
    let raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      for (const legacyKey of LEGACY_STORAGE_KEYS) {
        const legacyRaw = localStorage.getItem(legacyKey)
        if (legacyRaw) {
          raw = legacyRaw
          break
        }
      }
    }
    if (!raw) {
      const seeded = emptyState()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))
      return seeded
    }
    const state = JSON.parse(raw)
    if (!Array.isArray(state.tenants) || state.tenants.length === 0) {
      state.tenants = emptyState().tenants
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } else {
      state.tenants = normalizeTenants(state.tenants)
    }
    if (Array.isArray(state.users)) {
      state.users = normalizeUsers(state.users)
    } else {
      state.users = SEED_USERS.map((u) => ({ ...u }))
    }
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    }
    return state
  } catch {
    return emptyState()
  }
}

const write = (state) => {
  state.tenants = normalizeTenants(state.tenants)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  storeRevision += 1
  window.dispatchEvent(new Event(EVENT))
}

export const subscribePlatform = (fn) => {
  const onLocalChange = () => fn()
  const onStorage = (event) => {
    if (event.key != null && event.key !== STORAGE_KEY) return
    storeRevision += 1
    fn()
  }
  window.addEventListener(EVENT, onLocalChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT, onLocalChange)
    window.removeEventListener('storage', onStorage)
  }
}

export const getPlatformState = () => read()

export const resetPlatformStore = () => {
  const seeded = emptyState()
  write(seeded)
  return seeded
}

export const listCollection = (name) => {
  const state = read()
  const rows = Array.isArray(state[name]) ? state[name] : []
  if (name === 'tenants') {
    return rows.map((t) => ({ ...t, features: normalizeRoleFeatures(t.features) }))
  }
  return rows
}

export const listByTenant = (name, tenantId) =>
  listCollection(name).filter((row) => String(row.tenantId) === String(tenantId))

export const getTenant = (tenantId) => {
  const tenant = listCollection('tenants').find((t) => String(t.id) === String(tenantId))
  if (!tenant) return null
  return { ...tenant, features: normalizeRoleFeatures(tenant.features) }
}

/** Role-scoped features for a tenant (`ADMIN` | `OPS_ADMIN`). */
export const getTenantFeatures = (tenantId, role = TENANT_ROLES.ADMIN) => {
  const tenant = getTenant(tenantId)
  if (!tenant) return defaultTenantFeatures()
  return getFeaturesForRole(tenant.features, role)
}

export const getTenantRoleFeatures = (tenantId) => {
  const tenant = getTenant(tenantId)
  return tenant ? tenant.features : normalizeRoleFeatures(null)
}

export const tenantHasFeature = (tenantId, featureKey, role = TENANT_ROLES.ADMIN) =>
  Boolean(getTenantFeatures(tenantId, role)?.[featureKey])

/** Super Admin: enable/disable a feature for one tenant role. */
export const setTenantFeature = (
  tenantId,
  featureKey,
  enabled,
  role = TENANT_ROLES.ADMIN
) => {
  const state = read()
  const roleKey = roleFeatureBucket(role)
  state.tenants = state.tenants.map((t) => {
    if (String(t.id) !== String(tenantId)) return t
    const features = normalizeRoleFeatures(t.features)
    features[roleKey] = {
      ...features[roleKey],
      [featureKey]: Boolean(enabled),
    }
    return { ...t, features }
  })
  write(state)
  return getTenant(tenantId)
}

export const setTenantFeatures = (tenantId, nextFeatures, role = TENANT_ROLES.ADMIN) => {
  const state = read()
  const roleKey = roleFeatureBucket(role)
  state.tenants = state.tenants.map((t) => {
    if (String(t.id) !== String(tenantId)) return t
    const features = normalizeRoleFeatures(t.features)
    features[roleKey] = mergeTenantFeatures(nextFeatures)
    return { ...t, features }
  })
  write(state)
  return getTenant(tenantId)
}

export const listTenantsByStatus = (status) =>
  listCollection('tenants').filter((t) => t.status === status)

export const findUserByCredentials = (emailOrPhone, password) => {
  const user = findUserByEmailOrPhone(emailOrPhone)
  if (!user) return null
  if (String(user.password) !== String(password)) return null
  return user
}

export const findUserByEmail = (email) => {
  const normalized = String(email || '')
    .trim()
    .toLowerCase()
  return listCollection('users').find((u) => String(u.email).toLowerCase() === normalized) || null
}

const digitsOnly = (value) => String(value || '').replace(/\D/g, '')

export const findUserByEmailOrPhone = (emailOrPhone) => {
  const raw = String(emailOrPhone || '').trim()
  if (!raw) return null
  if (raw.includes('@')) return findUserByEmail(raw)
  const phoneDigits = digitsOnly(raw)
  if (phoneDigits.length < 8) return null
  return (
    listCollection('users').find((u) => {
      const userDigits = digitsOnly(u.phone || u.mobile_number || '')
      if (!userDigits) return false
      return userDigits === phoneDigits || userDigits.endsWith(phoneDigits) || phoneDigits.endsWith(userDigits)
    }) || null
  )
}

export const updateUserPassword = (userId, password) => {
  const state = read()
  const list = Array.isArray(state.users) ? [...state.users] : []
  const idx = list.findIndex((u) => String(u.id) === String(userId))
  if (idx < 0) return null
  list[idx] = { ...list[idx], password: String(password) }
  state.users = list
  write(state)
  return list[idx]
}

const newId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

export const upsertRow = (collection, row) => {
  const state = read()
  const list = Array.isArray(state[collection]) ? [...state[collection]] : []
  const id = row.id || newId(collection.slice(0, 3))
  const next = { ...row, id }
  const idx = list.findIndex((r) => String(r.id) === String(id))
  if (idx >= 0) list[idx] = next
  else list.unshift(next)
  state[collection] = list
  write(state)
  return next
}

export const removeRow = (collection, id) => {
  const state = read()
  state[collection] = (state[collection] || []).filter((r) => String(r.id) !== String(id))
  write(state)
}

export const updateTenantStatus = (tenantId, status, extra = {}) => {
  const state = read()
  state.tenants = state.tenants.map((t) =>
    String(t.id) === String(tenantId)
      ? {
          ...t,
          ...extra,
          status,
          approved_at:
            status === 'active' ? extra.approved_at || new Date().toISOString() : t.approved_at,
        }
      : t
  )
  write(state)
  return getTenant(tenantId)
}

export const updateTenant = (tenantId, patch = {}) => {
  const state = read()
  const idx = state.tenants.findIndex((t) => String(t.id) === String(tenantId))
  if (idx < 0) throw new Error('Tenant not found.')
  const allowed = [
    'name',
    'type',
    'domain',
    'company_code',
    'logo_url',
    'city',
    'address',
    'phone',
    'owner_name',
    'owner_email',
    'owner_phone',
  ]
  const next = { ...state.tenants[idx] }
  allowed.forEach((key) => {
    if (patch[key] !== undefined) next[key] = String(patch[key] ?? '').trim()
  })
  if (!next.name) throw new Error('Organization name is required.')
  state.tenants[idx] = next
  write(state)
  return getTenant(tenantId)
}

export const deleteTenant = (tenantId) => {
  const state = read()
  const id = String(tenantId)
  state.tenants = (state.tenants || []).filter((t) => String(t.id) !== id)
  state.users = (state.users || []).filter((u) => String(u.tenant_id) !== id)
  ;[
    'services',
    'venues',
    'packages',
    'vendors',
    'vendorPayments',
    'bookings',
    'patients',
    'employees',
    'attendance',
    'staffPayouts',
  ].forEach((name) => {
    state[name] = (state[name] || []).filter((row) => String(row.tenantId) !== id)
  })
  write(state)
  return true
}

/**
 * Super Admin onboards a new org → Lobby (pending).
 * Optionally creates an Ops Admin login (TENANT_OWNER) when enable_ops_admin is true.
 */
export const onboardTenant = (payload) => {
  const {
    name,
    type = 'Home care',
    domain = '',
    company_code = '',
    logo_url = '',
    city = '',
    address = '',
    phone = '',
    enable_ops_admin = true,
    ops_admin_name = '',
    ops_admin_email = '',
    ops_admin_password = 'tenant123',
    ops_admin_phone = '',
    ops_admin_role_label = 'Ops Admin',
    ops_can_create_vendors = true,
    ops_can_activate_vendors = false,
    employee_offboarding = 'soft_delete',
    employee_signin = 'both',
  } = payload || {}

  if (!String(name || '').trim()) throw new Error('Organization name is required.')

  const state = read()
  const tenantId = newId('tenant')
  let user = null

  if (enable_ops_admin) {
    const email = String(ops_admin_email || '').trim().toLowerCase()
    const adminName = String(ops_admin_name || '').trim()
    if (!adminName) throw new Error('Ops admin name is required.')
    if (!email) throw new Error('Ops admin email is required.')
    if (!String(ops_admin_password || '').trim()) throw new Error('Ops admin password is required.')
    if (!String(ops_admin_phone || '').trim()) throw new Error('Ops admin phone is required.')
    if (state.users.some((u) => String(u.email).toLowerCase() === email)) {
      throw new Error('An account with this ops admin email already exists.')
    }
    user = {
      id: newId('user'),
      email,
      password: String(ops_admin_password),
      first_name: adminName.split(' ')[0] || 'Ops',
      last_name: adminName.split(' ').slice(1).join(' ') || 'Admin',
      user_type: 'TENANT_OWNER',
      tenant_role: TENANT_ROLES.OPS_ADMIN,
      tenant_id: tenantId,
      phone: String(ops_admin_phone).trim(),
      role_label: String(ops_admin_role_label || 'Ops Admin').trim() || 'Ops Admin',
    }
    state.users = [user, ...state.users]
  }

  const tenant = {
    id: tenantId,
    name: String(name).trim(),
    type: String(type || 'Home care').trim(),
    domain: String(domain || '').trim(),
    company_code: String(company_code || '').trim(),
    logo_url: String(logo_url || '').trim(),
    city: String(city || '').trim(),
    address: String(address || '').trim(),
    phone: String(phone || '').trim(),
    owner_email: user?.email || '',
    owner_name: enable_ops_admin ? String(ops_admin_name).trim() : '',
    owner_phone: enable_ops_admin ? String(ops_admin_phone).trim() : '',
    has_ops_admin: Boolean(enable_ops_admin),
    ops_admin_role_label: enable_ops_admin
      ? String(ops_admin_role_label || 'Ops Admin').trim() || 'Ops Admin'
      : '',
    settings: {
      ops_can_create_vendors: Boolean(ops_can_create_vendors),
      ops_can_activate_vendors: Boolean(ops_can_activate_vendors),
      employee_offboarding: employee_offboarding || 'soft_delete',
      employee_signin: employee_signin || 'both',
    },
    features: normalizeRoleFeatures(null),
    status: 'pending',
    onboarded_at: new Date().toISOString(),
    approved_at: null,
  }

  state.tenants = [tenant, ...state.tenants]
  write(state)
  return { tenant, user }
}

export const platformStats = (tenantId = null) => {
  const scope = (name) => (tenantId ? listByTenant(name, tenantId) : listCollection(name))
  return {
    tenantsActive: listTenantsByStatus('active').length,
    tenantsPending: listTenantsByStatus('pending').length,
    services: scope('services').length,
    venues: scope('venues').length,
    packages: scope('packages').length,
    vendors: scope('vendors').length,
    bookings: scope('bookings').length,
    patients: scope('patients').length,
    employees: scope('employees').length,
    revenue: scope('bookings').reduce((sum, b) => sum + Number(b.amount || 0), 0),
  }
}
