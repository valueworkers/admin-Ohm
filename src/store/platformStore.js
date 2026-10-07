import { defaultTenantFeatures, mergeTenantFeatures } from '../config/features'
import { SEED_TENANTS, SEED_USERS, buildSeedCollections } from '../data/seed'

const STORAGE_KEY = 'sc_platform_v10'
const LEGACY_STORAGE_KEYS = ['sc_platform_v9', 'sc_platform_v2']
const EVENT = 'platform-changed'

let storeRevision = 0

export const getPlatformRevision = () => storeRevision

const normalizeTenants = (tenants = []) =>
  (tenants || []).map((t) => ({
    ...t,
    features: mergeTenantFeatures(t.features),
  }))

const emptyState = () => {
  const collections = buildSeedCollections()
  return {
    users: SEED_USERS.map((u) => ({ ...u })),
    tenants: SEED_TENANTS.map((t) => ({
      ...t,
      features: mergeTenantFeatures(t.features),
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
    return rows.map((t) => ({ ...t, features: mergeTenantFeatures(t.features) }))
  }
  return rows
}

export const listByTenant = (name, tenantId) =>
  listCollection(name).filter((row) => String(row.tenantId) === String(tenantId))

export const getTenant = (tenantId) => {
  const tenant = listCollection('tenants').find((t) => String(t.id) === String(tenantId))
  if (!tenant) return null
  return { ...tenant, features: mergeTenantFeatures(tenant.features) }
}

export const getTenantFeatures = (tenantId) => {
  const tenant = getTenant(tenantId)
  return tenant ? tenant.features : defaultTenantFeatures()
}

export const tenantHasFeature = (tenantId, featureKey) =>
  Boolean(getTenantFeatures(tenantId)?.[featureKey])

/** Super Admin: enable/disable a feature for one tenant. */
export const setTenantFeature = (tenantId, featureKey, enabled) => {
  const state = read()
  state.tenants = state.tenants.map((t) => {
    if (String(t.id) !== String(tenantId)) return t
    const features = mergeTenantFeatures(t.features)
    features[featureKey] = Boolean(enabled)
    return { ...t, features }
  })
  write(state)
  return getTenant(tenantId)
}

export const setTenantFeatures = (tenantId, nextFeatures) => {
  const state = read()
  state.tenants = state.tenants.map((t) =>
    String(t.id) === String(tenantId)
      ? { ...t, features: mergeTenantFeatures(nextFeatures) }
      : t
  )
  write(state)
  return getTenant(tenantId)
}

export const listTenantsByStatus = (status) =>
  listCollection('tenants').filter((t) => t.status === status)

export const findUserByCredentials = (email, password) => {
  const normalized = String(email || '')
    .trim()
    .toLowerCase()
  return (
    listCollection('users').find(
      (u) =>
        String(u.email).toLowerCase() === normalized && String(u.password) === String(password)
    ) || null
  )
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
    features: defaultTenantFeatures(),
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
