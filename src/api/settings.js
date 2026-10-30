import api from './axiosClient'

const THEME_VALUES = new Set(['light', 'dark', 'system'])
const FONT_SIZE_VALUES = new Set(['small', 'medium', 'large'])
const FONT_FAMILY_VALUES = new Set([
  'system',
  'inter',
  'roboto',
  'open_sans',
  'lato',
])

const CHANNEL_KEYS = ['email', 'in_app', 'browser_push', 'mobile_push', 'sms']
const CATEGORY_KEYS = [
  'product_updates',
  'marketing_emails',
  'security_alerts',
  'billing_alerts',
]

/** Axios config: pass X-Tenant only when tenantSlug is set (tenant settings). */
const withTenant = (tenantSlug) => {
  const slug = String(tenantSlug || '').trim()
  return slug ? { xTenant: slug } : {}
}

/** Normalize GET /api/settings/profile/ payload. */
export const normalizeSettingsProfile = (row = {}) => ({
  id: row.id ?? row.pk ?? null,
  first_name: row.first_name || '',
  last_name: row.last_name || '',
  email: row.email || '',
  email_verified: Boolean(row.email_verified),
  email_verified_at: row.email_verified_at || null,
  pending_email: row.pending_email || '',
})

/** Map API appearance → UI shape ({ theme, fontSize, fontFamily }). */
export const normalizeSettingsAppearance = (row = {}) => {
  const themeRaw = String(row.theme || 'system').toLowerCase()
  const sizeRaw = String(row.font_size || row.fontSize || 'medium').toLowerCase()
  const familyRaw = String(row.font_family || row.fontFamily || 'system')
    .trim()
    .toLowerCase()
  return {
    theme: THEME_VALUES.has(themeRaw) ? themeRaw : 'system',
    fontSize: FONT_SIZE_VALUES.has(sizeRaw) ? sizeRaw : 'medium',
    fontFamily: FONT_FAMILY_VALUES.has(familyRaw) ? familyRaw : 'system',
  }
}

/** Map API notifications → UI shape. */
export const normalizeSettingsNotifications = (row = {}) => {
  const channelsIn = row.channels || {}
  const categoriesIn = row.categories || {}
  const channels = Object.fromEntries(
    CHANNEL_KEYS.map((key) => [key, Boolean(channelsIn[key])]),
  )
  const categories = Object.fromEntries(
    CATEGORY_KEYS.map((key) => {
      if (key === 'security_alerts' || key === 'billing_alerts') return [key, true]
      return [key, Boolean(categoriesIn[key])]
    }),
  )
  return {
    channels,
    categories,
    marketingConsentAt:
      row.marketing_consent_at ?? row.marketingConsentAt ?? null,
  }
}

/** GET /api/settings/profile/ — account (no X-Tenant) or tenant (with slug). */
export const fetchSettingsProfile = async (tenantSlug) => {
  const { data } = await api.get('api/settings/profile/', withTenant(tenantSlug))
  const row = data?.data || data?.profile || data
  return normalizeSettingsProfile(row)
}

/** PATCH /api/settings/profile/ */
export const updateSettingsProfile = async (payload, tenantSlug) => {
  const { data } = await api.patch(
    'api/settings/profile/',
    payload,
    withTenant(tenantSlug),
  )
  const row = data?.data || data?.profile || data
  return normalizeSettingsProfile(row)
}

/** GET /api/settings/appearance/ */
export const fetchSettingsAppearance = async (tenantSlug) => {
  const { data } = await api.get('api/settings/appearance/', withTenant(tenantSlug))
  const row = data?.data || data?.appearance || data
  return normalizeSettingsAppearance(row)
}

/** PATCH /api/settings/appearance/ */
export const updateSettingsAppearance = async (payload, tenantSlug) => {
  const body = {
    theme: payload.theme,
    font_size: payload.font_size ?? payload.fontSize,
    font_family: payload.font_family ?? payload.fontFamily,
  }
  const { data } = await api.patch(
    'api/settings/appearance/',
    body,
    withTenant(tenantSlug),
  )
  const row = data?.data || data?.appearance || data
  return normalizeSettingsAppearance(row)
}

/** GET /api/settings/notifications/ */
export const fetchSettingsNotifications = async (tenantSlug) => {
  const { data } = await api.get(
    'api/settings/notifications/',
    withTenant(tenantSlug),
  )
  const row = data?.data || data?.notifications || data
  return normalizeSettingsNotifications(row)
}

/** PATCH /api/settings/notifications/ */
export const updateSettingsNotifications = async (payload = {}, tenantSlug) => {
  const normalized = normalizeSettingsNotifications(payload)
  const body = {
    channels: normalized.channels,
    categories: {
      ...normalized.categories,
      security_alerts: true,
      billing_alerts: true,
    },
  }
  const { data } = await api.patch(
    'api/settings/notifications/',
    body,
    withTenant(tenantSlug),
  )
  const row = data?.data || data?.notifications || data
  return normalizeSettingsNotifications({
    ...row,
    marketing_consent_at:
      row.marketing_consent_at ??
      payload.marketingConsentAt ??
      payload.marketing_consent_at ??
      null,
  })
}
