import { getAuthUser, persistAuthSession } from '../../utils/auth'
import { defaultUserSettings, normalizePdfTemplates } from './defaults'

const STORAGE_KEY = 'sc_user_settings_v1'
const TENANT_STORAGE_KEY = 'sc_tenant_settings_v1'
const PROFILE_EMPTY_MIGRATE = 'sc_settings_profile_empty_v1'

const clearStoredProfileContact = (raw) => {
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return raw
    parsed.profile = {
      ...(parsed.profile || {}),
      first_name: '',
      last_name: '',
      email: '',
      email_verified: false,
      pending_email: '',
    }
    return JSON.stringify(parsed)
  } catch {
    return raw
  }
}

/** One-time: wipe seeded profile name/email so fields start empty. */
const migrateProfileEmpty = () => {
  if (typeof localStorage === 'undefined') return
  if (localStorage.getItem(PROFILE_EMPTY_MIGRATE) === '1') return
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (!key) continue
      if (
        key.startsWith(`${STORAGE_KEY}:`) ||
        key.startsWith(`${TENANT_STORAGE_KEY}:`)
      ) {
        const next = clearStoredProfileContact(localStorage.getItem(key))
        localStorage.setItem(key, next)
      }
    }
    localStorage.setItem(PROFILE_EMPTY_MIGRATE, '1')
  } catch {
    /* ignore */
  }
}

const storageKeyForUser = () => {
  const user = getAuthUser()
  const id = user?.id || user?.email || 'anon'
  return `${STORAGE_KEY}:${id}`
}

const storageKeyForTenant = (tenantId) =>
  `${TENANT_STORAGE_KEY}:${String(tenantId || '').trim() || 'none'}`

const seedFromTenant = (tenant = {}) => {
  const user = getAuthUser() || {}
  const base = defaultUserSettings(user)
  return {
    ...base,
    organization: {
      ...base.organization,
      name: tenant.name || tenant.organization_name || base.organization.name || '',
      email: tenant.contact_email || tenant.email || base.organization.email || '',
      website: tenant.website || tenant.website_url || base.organization.website || '',
      address_line1: tenant.address_line1 || tenant.address || base.organization.address_line1 || '',
      address_line2: tenant.address_line2 || base.organization.address_line2 || '',
      city: tenant.city || base.organization.city || '',
      locality: tenant.locality || base.organization.locality || '',
      country: tenant.country || base.organization.country || 'India',
      logoUrl: tenant.logo || tenant.logoUrl || base.organization.logoUrl || '',
    },
    billing: {
      ...base.billing,
      billingName: tenant.name || base.billing.billingName || '',
      billingEmail: tenant.contact_email || base.billing.billingEmail || '',
      gstin: tenant.gstin || tenant.gst_number || base.billing.gstin || '',
      address: tenant.address || base.billing.address || '',
    },
  }
}

const deepMerge = (base, patch) => {
  if (!patch || typeof patch !== 'object') return base
  const out = { ...base }
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = deepMerge(base[k] || {}, v)
    } else {
      out[k] = v
    }
  }
  return out
}

export const loadUserSettings = () => {
  migrateProfileEmpty()
  const user = getAuthUser() || {}
  const defaults = defaultUserSettings(user)
  try {
    const raw = localStorage.getItem(storageKeyForUser())
    if (!raw) return defaults
    const parsed = JSON.parse(raw)
    const merged = deepMerge(defaults, parsed)
    merged.pdfTemplates = normalizePdfTemplates(merged.pdfTemplates)
    merged.profile = {
      ...merged.profile,
      first_name: parsed?.profile?.first_name || '',
      last_name: parsed?.profile?.last_name || '',
      email: parsed?.profile?.email || '',
      email_verified: Boolean(parsed?.profile?.email_verified),
      pending_email: parsed?.profile?.pending_email || '',
    }
    return merged
  } catch {
    return defaults
  }
}

export const saveUserSettings = (settings) => {
  localStorage.setItem(storageKeyForUser(), JSON.stringify(settings))
  window.dispatchEvent(new Event('user-settings-changed'))
  return settings
}

/** Load settings for the selected tenant (Tenant Info → Settings). */
export const loadTenantSettings = (tenantId, tenant = {}) => {
  migrateProfileEmpty()
  const defaults = seedFromTenant(tenant)
  const id = String(tenantId || '').trim()
  if (!id) return defaults
  try {
    const raw = localStorage.getItem(storageKeyForTenant(id))
    if (!raw) return defaults
    const parsed = JSON.parse(raw)
    const merged = deepMerge(defaults, parsed)
    merged.pdfTemplates = normalizePdfTemplates(merged.pdfTemplates)
    merged.profile = {
      ...merged.profile,
      first_name: parsed?.profile?.first_name || '',
      last_name: parsed?.profile?.last_name || '',
      email: parsed?.profile?.email || '',
      email_verified: Boolean(parsed?.profile?.email_verified),
      pending_email: parsed?.profile?.pending_email || '',
    }
    return merged
  } catch {
    return defaults
  }
}

export const saveTenantSettings = (tenantId, settings) => {
  const id = String(tenantId || '').trim()
  if (!id) throw new Error('No tenant selected.')
  localStorage.setItem(storageKeyForTenant(id), JSON.stringify(settings))
  window.dispatchEvent(new Event('tenant-settings-changed'))
  return settings
}

export const loadSettingsForMode = (mode, { tenantId, tenant } = {}) => {
  if (mode === 'tenant') return loadTenantSettings(tenantId, tenant)
  return loadUserSettings()
}

export const saveSettingsForMode = (mode, settings, { tenantId } = {}) => {
  if (mode === 'tenant') return saveTenantSettings(tenantId, settings)
  return saveUserSettings(settings)
}

export const updateUserSettingsSection = (sectionKey, sectionValue) => {
  const current = loadUserSettings()
  const next = { ...current, [sectionKey]: sectionValue }
  return saveUserSettings(next)
}

const APPEARANCE_FONT_STACKS = {
  system: 'system-ui, "Segoe UI", sans-serif',
  inter: '"Inter", system-ui, sans-serif',
  roboto: '"Roboto", system-ui, sans-serif',
  open_sans: '"Open Sans", system-ui, sans-serif',
  lato: '"Lato", system-ui, sans-serif',
}

const GOOGLE_FONT_HREFS = {
  inter:
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  roboto:
    'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
  open_sans:
    'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap',
  lato: 'https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap',
}

const ensureAppearanceFont = (key) => {
  const href = GOOGLE_FONT_HREFS[key]
  if (!href || typeof document === 'undefined') return
  const id = `sc-font-${key}`
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}

export const applyAppearance = (appearance = {}) => {
  const root = document.documentElement
  const theme = appearance.theme || 'light'
  const fontSize = appearance.fontSize || 'medium'
  const fontKey = appearance.fontFamily || 'system'
  const stack = APPEARANCE_FONT_STACKS[fontKey] || APPEARANCE_FONT_STACKS.system

  if (theme === 'system') {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.dataset.theme = dark ? 'dark' : 'light'
  } else {
    root.dataset.theme = theme
  }
  root.dataset.fontSize = fontSize
  root.dataset.fontFamily = fontKey
  ensureAppearanceFont(fontKey)
  root.style.setProperty('--sc-font-family', stack)
  root.style.fontFamily = stack
}

export const syncProfileToSession = (profile) => {
  const user = getAuthUser()
  if (!user || !profile) return
  persistAuthSession({
    user: {
      ...user,
      first_name: profile.first_name || user.first_name,
      last_name: profile.last_name || user.last_name,
      email: profile.email || user.email,
      email_verified: Boolean(profile.email_verified),
      full_name: [profile.first_name, profile.last_name].filter(Boolean).join(' '),
    },
  })
}

export const isValidEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())

export const trimName = (value, max = 60) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max)
