import { useEffect, useMemo, useState } from 'react'
import {
  FiBell,
  FiBriefcase,
  FiCheck,
  FiCreditCard,
  FiDatabase,
  FiDollarSign,
  FiEye,
  FiFileText,
  FiInfo,
  FiLoader,
  FiLock,
  FiPlus,
  FiShield,
  FiSidebar,
  FiUser,
} from 'react-icons/fi'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { LoadingState, ErrorState } from '../components/ui/PageState'
import {
  fetchSettingsAppearance,
  fetchSettingsNotifications,
  fetchSettingsProfile,
  updateSettingsAppearance,
  updateSettingsNotifications,
  updateSettingsProfile,
} from '../api/settings'
import { apiErrorMessage } from '../utils/errors'
import {
  EXPORT_FORMATS,
  APPEARANCE_FONT_FAMILIES,
  FONT_SIZES,
  NOTIFY_CATEGORIES,
  NOTIFY_CHANNELS,
  THEMES,
  defaultPdfStyle,
  defaultPdfTemplates,
  defaultUserSettings,
  normalizePdfTemplates,
} from '../features/settings/defaults'
import PdfTemplatesEditor from '../features/settings/PdfTemplatesEditor'
import {
  applyAppearance,
  isValidEmail,
  loadSettingsForMode,
  saveSettingsForMode,
  syncProfileToSession,
  trimName,
} from '../features/settings/store'
import { useAccess } from '../hooks/useAccess'
import {
  SectionCard,
  Segmented,
  SettingsNavIcon,
  SoftBadge,
  StatTile,
  ToggleRow,
  settingsNavBtn,
} from '../features/settings/SettingsChrome'
import { getAuthUser } from '../utils/auth'
import { resolveSettingsTenantSlug } from '../utils/tenantHeader'
import {
  btnDanger,
  btnGhost,
  btnPrimary,
  btnSecondary,
  fieldClass,
  labelClass,
} from '../utils/ui'

const SECTIONS = [
  { id: 'profile', label: 'Profile', hint: 'Name & email', icon: FiUser },
  { id: 'organization', label: 'Organization', hint: 'Org details', icon: FiBriefcase },
  { id: 'appearance', label: 'Appearance', hint: 'Theme & type', icon: FiEye },
  { id: 'notifications', label: 'Notifications', hint: 'Channels', icon: FiBell },
  { id: 'security', label: 'Security', hint: 'Password & 2FA', icon: FiLock },
  { id: 'billing', label: 'Billing', hint: 'Plan & tax', icon: FiCreditCard },
  { id: 'payments', label: 'Payments', hint: 'Gateways & COD', icon: FiDollarSign },
  { id: 'data', label: 'Data', hint: 'Export & storage', icon: FiDatabase },
  { id: 'pdf', label: 'PDF templates', hint: 'Layout & fonts', icon: FiFileText },
]

const PAYMENT_MODES = [
  { id: 'razorpay', label: 'Razorpay', hint: 'Cards, UPI, netbanking' },
  { id: 'cashfree', label: 'Cashfree', hint: 'UPI & payouts' },
  { id: 'cod', label: 'COD', hint: 'Cash on delivery' },
  { id: 'manual', label: 'Manual', hint: 'Offline / bank' },
]

const SECTION_META = {
  profile: {
    title: 'Profile',
    description: 'Your personal name and email. Email changes stay unverified until you confirm the code.',
  },
  organization: {
    title: 'Organization',
    description: 'Organization name, contact email, website, address, and logo for this tenant.',
  },
  appearance: {
    title: 'Appearance',
    description: 'Personalize theme and typography. Prefs apply immediately and save per account.',
  },
  notifications: {
    title: 'Notifications',
    description: 'Choose channels and categories. Security and billing alerts stay required.',
  },
  security: {
    title: 'Security & privacy',
    description: 'Password, two-factor auth, sessions, and recent sign-ins.',
  },
  billing: {
    title: 'Billing & subscription',
    description: 'Plan, seats, tax details, and renewal. Gateways live under Payments.',
  },
  payments: {
    title: 'Payments',
    description: 'Connect Razorpay or Cashfree, and enable COD or manual collection.',
  },
  data: {
    title: 'Data management',
    description: 'Exports, imports, retention, backups, and storage quota.',
  },
  pdf: {
    title: 'PDF templates',
    description: 'Template 1–3 with exact A4/Letter PDF layout, margins, type, and borders.',
  },
}

const formatWhen = (value) => {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

const SETTINGS_NAV_KEY = 'sc_settings_nav_collapsed'

const SettingsPage = ({ mode = 'account' } = {}) => {
  const isTenantMode = mode === 'tenant'
  const { tenant, tenantId, canWrite, isSuperAdmin } = useAccess()
  // Account (SA): APIs without X-Tenant. Tenant settings: same APIs + X-Tenant slug.
  const settingsTenantSlug = isTenantMode ? resolveSettingsTenantSlug(tenant) : ''
  const useApiSettings =
    (!isTenantMode && isSuperAdmin) || (isTenantMode && Boolean(settingsTenantSlug))
  const [section, setSection] = useState(isTenantMode ? 'organization' : 'profile')
  const [navCollapsed, setNavCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SETTINGS_NAV_KEY) === '1'
    } catch {
      return false
    }
  })
  const [settings, setSettings] = useState(() =>
    loadSettingsForMode(mode, { tenantId, tenant }),
  )
  const [status, setStatus] = useState({ type: '', message: '' })
  const [saving, setSaving] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [appearanceLoading, setAppearanceLoading] = useState(false)
  const [appearanceError, setAppearanceError] = useState('')
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState('')
  const [emailDraft, setEmailDraft] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    next: '',
    confirm: '',
  })
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [activeTemplateId, setActiveTemplateId] = useState('template-1')
  const [recoveryCodes, setRecoveryCodes] = useState([])
  const [payMode, setPayMode] = useState('razorpay')
  const [razorConnecting, setRazorConnecting] = useState(false)
  const [razorManageOpen, setRazorManageOpen] = useState(false)
  const [cashManageOpen, setCashManageOpen] = useState(false)

  const maskAccount = (value) => {
    const s = String(value || '').trim()
    if (!s) return '******'
    if (s.length <= 4) return '******'
    return `******${s.slice(-4)}`
  }

  const applyApiProfile = (profile) => {
    setSettings((s) => ({
      ...s,
      profile: {
        ...s.profile,
        id: profile.id ?? null,
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        email: profile.email || '',
        email_verified: Boolean(profile.email_verified),
        email_verified_at: profile.email_verified_at || null,
        pending_email: profile.pending_email || '',
      },
    }))
    syncProfileToSession(profile)
  }

  const applyApiAppearance = (appearance) => {
    setSettings((s) => ({ ...s, appearance: { ...s.appearance, ...appearance } }))
    applyAppearance(appearance)
  }

  const loadSaProfile = async () => {
    if (!useApiSettings) return
    setProfileLoading(true)
    setProfileError('')
    try {
      const profile = await fetchSettingsProfile(settingsTenantSlug)
      applyApiProfile(profile)
    } catch (err) {
      setProfileError(apiErrorMessage(err, 'Could not load profile.'))
    } finally {
      setProfileLoading(false)
    }
  }

  const loadSaAppearance = async () => {
    if (!useApiSettings) return
    setAppearanceLoading(true)
    setAppearanceError('')
    try {
      const appearance = await fetchSettingsAppearance(settingsTenantSlug)
      applyApiAppearance(appearance)
    } catch (err) {
      setAppearanceError(apiErrorMessage(err, 'Could not load appearance.'))
    } finally {
      setAppearanceLoading(false)
    }
  }

  const loadSaNotifications = async () => {
    if (!useApiSettings) return
    setNotificationsLoading(true)
    setNotificationsError('')
    try {
      const notifications = await fetchSettingsNotifications(settingsTenantSlug)
      setSettings((s) => ({
        ...s,
        notifications: { ...s.notifications, ...notifications },
      }))
    } catch (err) {
      setNotificationsError(apiErrorMessage(err, 'Could not load notifications.'))
    } finally {
      setNotificationsLoading(false)
    }
  }

  const reload = () => {
    const next = loadSettingsForMode(mode, { tenantId, tenant })
    next.pdfTemplates = normalizePdfTemplates(next.pdfTemplates)
    setSettings(next)
    setEmailDraft('')
    setVerifyCode('')
    setActiveTemplateId(next.pdfTemplates?.[0]?.id || 'template-1')
    setStatus({ type: '', message: '' })
    setProfileError('')
    setAppearanceError('')
    setNotificationsError('')
    if (useApiSettings) {
      loadSaProfile()
      loadSaAppearance()
      loadSaNotifications()
    }
  }

  useEffect(() => {
    const next = loadSettingsForMode(mode, { tenantId, tenant })
    next.pdfTemplates = normalizePdfTemplates(next.pdfTemplates)
    setSettings(next)
    setEmailDraft('')
    setVerifyCode('')
    setActiveTemplateId(next.pdfTemplates?.[0]?.id || 'template-1')
    setStatus({ type: '', message: '' })
    setProfileError('')
    setAppearanceError('')
    setNotificationsError('')
    if (isTenantMode) setSection('organization')

    if (!useApiSettings) {
      setProfileLoading(false)
      setAppearanceLoading(false)
      setNotificationsLoading(false)
      return undefined
    }

    let cancelled = false
    ;(async () => {
      setProfileLoading(true)
      setAppearanceLoading(true)
      setNotificationsLoading(true)
      const [profileResult, appearanceResult, notificationsResult] =
        await Promise.allSettled([
          fetchSettingsProfile(settingsTenantSlug),
          fetchSettingsAppearance(settingsTenantSlug),
          fetchSettingsNotifications(settingsTenantSlug),
        ])
      if (cancelled) return

      if (profileResult.status === 'fulfilled') {
        const profile = profileResult.value
        setSettings((s) => ({
          ...s,
          profile: {
            ...s.profile,
            id: profile.id ?? null,
            first_name: profile.first_name || '',
            last_name: profile.last_name || '',
            email: profile.email || '',
            email_verified: Boolean(profile.email_verified),
            email_verified_at: profile.email_verified_at || null,
            pending_email: profile.pending_email || '',
          },
        }))
        syncProfileToSession(profile)
        setProfileError('')
      } else {
        setProfileError(
          apiErrorMessage(profileResult.reason, 'Could not load profile.'),
        )
      }

      if (appearanceResult.status === 'fulfilled') {
        const appearance = appearanceResult.value
        setSettings((s) => ({
          ...s,
          appearance: { ...s.appearance, ...appearance },
        }))
        applyAppearance(appearance)
        setAppearanceError('')
      } else {
        setAppearanceError(
          apiErrorMessage(appearanceResult.reason, 'Could not load appearance.'),
        )
      }

      if (notificationsResult.status === 'fulfilled') {
        const notifications = notificationsResult.value
        setSettings((s) => ({
          ...s,
          notifications: { ...s.notifications, ...notifications },
        }))
        setNotificationsError('')
      } else {
        setNotificationsError(
          apiErrorMessage(notificationsResult.reason, 'Could not load notifications.'),
        )
      }

      setProfileLoading(false)
      setAppearanceLoading(false)
      setNotificationsLoading(false)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, tenantId, useApiSettings, settingsTenantSlug])

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_NAV_KEY, navCollapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [navCollapsed])

  const sectionTitle = useMemo(
    () => SECTIONS.find((s) => s.id === section)?.label || 'Settings',
    [section],
  )

  const patch = (key, value) => setSettings((s) => ({ ...s, [key]: value }))

  const patchNested = (key, nestedKey, value) => {
    setSettings((s) => ({
      ...s,
      [key]: { ...s[key], [nestedKey]: value },
    }))
  }

  const persist = (next, message = 'Settings saved.') => {
    if (isTenantMode && !tenantId) {
      setStatus({ type: 'error', message: 'Select a tenant first.' })
      return
    }
    if (isTenantMode && canWrite === false) {
      setStatus({ type: 'error', message: 'You do not have permission to edit tenant settings.' })
      return
    }
    setSaving(true)
    setStatus({ type: '', message: '' })
    try {
      saveSettingsForMode(mode, next, { tenantId })
      setSettings(next)
      setStatus({ type: 'success', message })
    } catch (err) {
      setStatus({
        type: 'error',
        message: err?.message || 'Could not save settings.',
      })
    } finally {
      setSaving(false)
    }
  }

  const discard = () => {
    reload()
    setPasswordForm({ current: '', next: '', confirm: '' })
    setRecoveryCodes([])
  }

  /* —— Profile —— */
  const saveProfile = async () => {
    const first = trimName(settings.profile.first_name)
    const last = trimName(settings.profile.last_name)
    if (!first) {
      setStatus({ type: 'error', message: 'First name is required.' })
      return
    }
    if (first.length < 1 || first.length > 60 || last.length > 60) {
      setStatus({ type: 'error', message: 'Names must be 1–60 characters.' })
      return
    }

    if (useApiSettings) {
      setSaving(true)
      setStatus({ type: '', message: '' })
      try {
        const profile = await updateSettingsProfile(
          {
            first_name: first,
            last_name: last,
          },
          settingsTenantSlug,
        )
        const next = {
          ...settings,
          profile: {
            ...settings.profile,
            ...profile,
            first_name: profile.first_name || first,
            last_name: profile.last_name || last,
          },
        }
        saveSettingsForMode(mode, next, { tenantId })
        setSettings(next)
        syncProfileToSession(next.profile)
        setStatus({ type: 'success', message: 'Profile updated.' })
      } catch (err) {
        setStatus({
          type: 'error',
          message: apiErrorMessage(err, 'Could not update profile.'),
        })
      } finally {
        setSaving(false)
      }
      return
    }

    const next = {
      ...settings,
      profile: { ...settings.profile, first_name: first, last_name: last },
    }
    persist(next, 'Profile updated.')
    if (!isTenantMode) syncProfileToSession(next.profile)
  }

  const startEmailChange = () => {
    const email = String(emailDraft || '').trim().toLowerCase()
    if (!isValidEmail(email)) {
      setStatus({ type: 'error', message: 'Enter a valid email address.' })
      return
    }
    if (email === String(settings.profile.email || '').toLowerCase()) {
      setStatus({ type: 'error', message: 'That is already your current email.' })
      return
    }
    const next = {
      ...settings,
      profile: {
        ...settings.profile,
        pending_email: email,
        email_verified: settings.profile.email_verified,
      },
    }
    persist(
      next,
      `Verification sent to ${email}. Enter the demo code 123456 to confirm.`,
    )
    setVerifyCode('')
  }

  const resendVerification = () => {
    const target = settings.profile.pending_email || settings.profile.email
    if (!target) {
      setStatus({ type: 'error', message: 'No email to verify.' })
      return
    }
    setStatus({
      type: 'success',
      message: `Verification email resent to ${target}. Demo code: 123456.`,
    })
  }

  const confirmEmailVerification = () => {
    if (String(verifyCode || '').trim() !== '123456') {
      setStatus({ type: 'error', message: 'Invalid or expired verification code.' })
      return
    }
    const pending = settings.profile.pending_email
    const nextProfile = pending
      ? {
          ...settings.profile,
          email: pending,
          pending_email: '',
          email_verified: true,
        }
      : { ...settings.profile, email_verified: true, pending_email: '' }
    const next = { ...settings, profile: nextProfile }
    persist(next, 'Email verified.')
    if (!isTenantMode) syncProfileToSession(next.profile)
    setVerifyCode('')
    setEmailDraft('')
  }

  /* —— Appearance —— */
  const resolveAppearance = (source = settings.appearance) => {
    const theme = THEMES.some((t) => t.value === source.theme) ? source.theme : 'light'
    const fontSize = FONT_SIZES.some((t) => t.value === source.fontSize)
      ? source.fontSize
      : 'medium'
    const fontFamily = APPEARANCE_FONT_FAMILIES.some((t) => t.value === source.fontFamily)
      ? source.fontFamily
      : 'system'
    return { theme, fontSize, fontFamily }
  }

  const saveAppearance = async (sourceAppearance) => {
    const appearance = resolveAppearance(sourceAppearance || settings.appearance)

    if (useApiSettings) {
      setSaving(true)
      setStatus({ type: '', message: '' })
      try {
        const saved = await updateSettingsAppearance(
          {
            theme: appearance.theme,
            font_size: appearance.fontSize,
            font_family: appearance.fontFamily,
          },
          settingsTenantSlug,
        )
        const next = { ...settings, appearance: { ...settings.appearance, ...saved } }
        saveSettingsForMode(mode, next, { tenantId })
        setSettings(next)
        applyAppearance(saved)
        setStatus({ type: 'success', message: 'Appearance saved.' })
      } catch (err) {
        setStatus({
          type: 'error',
          message: apiErrorMessage(err, 'Could not save appearance.'),
        })
      } finally {
        setSaving(false)
      }
      return
    }

    const next = { ...settings, appearance }
    persist(next, 'Appearance saved.')
    applyAppearance(appearance)
  }

  const resetAppearance = async () => {
    const appearance = resolveAppearance(
      defaultUserSettings(getAuthUser() || {}).appearance,
    )
    setSettings((s) => ({ ...s, appearance }))
    applyAppearance(appearance)

    if (useApiSettings) {
      setSaving(true)
      setStatus({ type: '', message: '' })
      try {
        const saved = await updateSettingsAppearance(
          {
            theme: appearance.theme,
            font_size: appearance.fontSize,
            font_family: appearance.fontFamily,
          },
          settingsTenantSlug,
        )
        const next = { ...settings, appearance: { ...settings.appearance, ...saved } }
        saveSettingsForMode(mode, next, { tenantId })
        setSettings(next)
        applyAppearance(saved)
        setStatus({ type: 'success', message: 'Appearance reset to defaults.' })
      } catch (err) {
        setStatus({
          type: 'error',
          message: apiErrorMessage(err, 'Could not reset appearance.'),
        })
      } finally {
        setSaving(false)
      }
      return
    }

    const next = { ...settings, appearance }
    persist(next, 'Appearance reset to defaults.')
  }

  /* —— Notifications —— */
  const saveNotifications = async () => {
    const categories = { ...settings.notifications.categories }
    NOTIFY_CATEGORIES.forEach((c) => {
      if (c.mandatory) categories[c.key] = true
    })
    const marketingOn = Boolean(categories.marketing_emails)
    const marketingConsentAt = marketingOn
      ? settings.notifications.marketingConsentAt || new Date().toISOString()
      : null
    const notifications = {
      ...settings.notifications,
      channels: { ...settings.notifications.channels },
      categories,
      marketingConsentAt,
    }

    if (useApiSettings) {
      setSaving(true)
      setStatus({ type: '', message: '' })
      try {
        const saved = await updateSettingsNotifications(
          {
            channels: notifications.channels,
            categories: notifications.categories,
            marketingConsentAt,
          },
          settingsTenantSlug,
        )
        const next = {
          ...settings,
          notifications: {
            ...settings.notifications,
            ...saved,
            marketingConsentAt: saved.marketingConsentAt ?? marketingConsentAt,
          },
        }
        saveSettingsForMode(mode, next, { tenantId })
        setSettings(next)
        setStatus({ type: 'success', message: 'Notification preferences saved.' })
      } catch (err) {
        setStatus({
          type: 'error',
          message: apiErrorMessage(err, 'Could not save notifications.'),
        })
      } finally {
        setSaving(false)
      }
      return
    }

    persist({ ...settings, notifications }, 'Notification preferences saved.')
  }

  /* —— Security —— */
  const changePassword = () => {
    const { current, next, confirm } = passwordForm
    if (!current || !next) {
      setStatus({ type: 'error', message: 'Current and new password are required.' })
      return
    }
    if (next.length < 8) {
      setStatus({ type: 'error', message: 'Password must be at least 8 characters.' })
      return
    }
    if (next !== confirm) {
      setStatus({ type: 'error', message: 'New password and confirm do not match.' })
      return
    }
    setPasswordForm({ current: '', next: '', confirm: '' })
    setStatus({
      type: 'success',
      message: 'Password updated (demo). Use the live auth API when wired.',
    })
  }

  const enable2fa = () => {
    const codes = Array.from({ length: 8 }, () =>
      Math.random().toString(36).slice(2, 6).toUpperCase() +
      '-' +
      Math.random().toString(36).slice(2, 6).toUpperCase(),
    )
    setRecoveryCodes(codes)
    const next = {
      ...settings,
      security: {
        ...settings.security,
        twoFactorEnabled: true,
        recoveryCodesRemaining: codes.length,
      },
    }
    persist(next, 'Two-factor authentication enabled. Store recovery codes securely.')
  }

  const disable2fa = () => {
    setRecoveryCodes([])
    const next = {
      ...settings,
      security: {
        ...settings.security,
        twoFactorEnabled: false,
        recoveryCodesRemaining: 0,
      },
    }
    persist(next, 'Two-factor authentication disabled.')
  }

  const signOutAllDevices = () => {
    setSignOutOpen(false)
    setStatus({
      type: 'success',
      message: 'All other sessions revoked (demo). Refresh tokens will be cleared when API is live.',
    })
  }

  /* —— Billing —— */
  const saveBillingDetails = () => {
    const email = String(settings.billing.billingEmail || '').trim()
    if (email && !isValidEmail(email)) {
      setStatus({ type: 'error', message: 'Billing email is invalid.' })
      return
    }
    persist(settings, 'Billing details saved.')
  }

  const payments = settings.payments || {}

  const patchPaymentMode = (modeId, patch) => {
    setSettings((s) => ({
      ...s,
      payments: {
        ...s.payments,
        [modeId]: { ...(s.payments?.[modeId] || {}), ...patch },
      },
    }))
  }

  const savePayments = () => {
    const rp = payments.razorpay || {}
    if (rp.enabled && rp.connected) {
      if (!String(rp.keyId || '').trim()) {
        setStatus({ type: 'error', message: 'Razorpay Key ID is required when connected.' })
        setPayMode('razorpay')
        return
      }
    }
    const cf = payments.cashfree || {}
    if (cf.enabled && cf.connected) {
      if (!String(cf.appId || '').trim() || !String(cf.secretKey || '').trim()) {
        setStatus({ type: 'error', message: 'Cashfree App ID and Secret Key are required when connected.' })
        setPayMode('cashfree')
        return
      }
    }
    persist(
      {
        ...settings,
        payments: {
          ...payments,
          defaultMode: payments.defaultMode || 'razorpay',
        },
      },
      'Payment settings saved.',
    )
  }

  const connectRazorpay = () => {
    const rp = payments.razorpay || {}
    const keyId = String(rp.keyId || '').trim()
    const keySecret = String(rp.keySecret || '').trim()
    if (!keyId || !keySecret) {
      setStatus({
        type: 'error',
        message: 'Enter Razorpay Key ID and Key Secret, then connect.',
      })
      return
    }
    setRazorConnecting(true)
    window.setTimeout(() => {
      setSettings((s) => ({
        ...s,
        payments: {
          ...s.payments,
          defaultMode: s.payments?.defaultMode || 'razorpay',
          razorpay: {
            ...(s.payments?.razorpay || {}),
            enabled: true,
            connected: true,
            keyId,
            keySecret,
            accountId: keyId.startsWith('rzp_') ? keyId : `rzp_live_${keyId.slice(0, 8)}`,
            connectedAt: new Date().toISOString(),
          },
        },
      }))
      setRazorConnecting(false)
      setRazorManageOpen(false)
      setStatus({
        type: 'success',
        message: 'Razorpay connected (demo). Save changes to keep credentials locally.',
      })
    }, 700)
  }

  const disconnectRazorpay = () => {
    patchPaymentMode('razorpay', {
      connected: false,
      accountId: '',
      connectedAt: null,
    })
    setStatus({ type: 'success', message: 'Razorpay disconnected. Save to confirm.' })
  }

  const connectCashfree = () => {
    const cf = payments.cashfree || {}
    if (!String(cf.appId || '').trim() || !String(cf.secretKey || '').trim()) {
      setStatus({ type: 'error', message: 'Enter Cashfree App ID and Secret Key first.' })
      return
    }
    patchPaymentMode('cashfree', {
      enabled: true,
      connected: true,
      connectedAt: new Date().toISOString(),
    })
    setCashManageOpen(false)
    setStatus({ type: 'success', message: 'Cashfree connected (demo). Save changes to keep.' })
  }

  const disconnectCashfree = () => {
    patchPaymentMode('cashfree', {
      connected: false,
      connectedAt: null,
    })
    setStatus({ type: 'success', message: 'Cashfree disconnected. Save to confirm.' })
  }

  /* —— Data —— */
  const saveDataPrefs = () => {
    persist(settings, 'Data preferences saved.')
  }

  const requestExport = () => {
    const job = {
      id: `exp-${Date.now()}`,
      format: settings.data.preferredExportFormat || 'csv',
      status: 'ready',
      createdAt: new Date().toISOString(),
      downloadExpiresAt: new Date(Date.now() + 86400000).toISOString(),
    }
    const next = {
      ...settings,
      data: {
        ...settings.data,
        exportJobs: [job, ...(settings.data.exportJobs || [])].slice(0, 10),
      },
    }
    persist(next, `Export ready (${job.format.toUpperCase()}). Link expires in 24h.`)
  }

  /* —— PDF templates —— */
  const templates = normalizePdfTemplates(settings.pdfTemplates)

  const updateTemplateStyle = (templateId, keyOrPatch, value) => {
    const patch =
      keyOrPatch && typeof keyOrPatch === 'object'
        ? keyOrPatch
        : { [keyOrPatch]: value }
    setSettings((s) => ({
      ...s,
      pdfTemplates: normalizePdfTemplates(s.pdfTemplates).map((t) =>
        t.id === templateId ? { ...t, style: { ...t.style, ...patch } } : t,
      ),
    }))
  }

  const updateTemplateMeta = (templateId, key, value) => {
    setSettings((s) => ({
      ...s,
      pdfTemplates: normalizePdfTemplates(s.pdfTemplates).map((t) =>
        t.id === templateId ? { ...t, [key]: value } : t,
      ),
    }))
  }

  const savePdfTemplates = () => {
    const next = {
      ...settings,
      pdfTemplates: normalizePdfTemplates(settings.pdfTemplates),
    }
    persist(next, 'PDF templates saved.')
  }

  const resetActiveTemplate = () => {
    const defaults = defaultPdfTemplates()
    const fallback = defaults.find((t) => t.id === activeTemplateId)
    setSettings((s) => ({
      ...s,
      pdfTemplates: normalizePdfTemplates(s.pdfTemplates).map((t) =>
        t.id === activeTemplateId
          ? {
              ...t,
              label: fallback?.label || t.label,
              style: { ...(fallback?.style || defaultPdfStyle()) },
            }
          : t,
      ),
    }))
  }

  const meta = SECTION_META[section] || { title: sectionTitle, description: '' }

  const saveOrganization = () => {
    const org = settings.organization || {}
    const name = trimName(org.name, 120)
    const email = String(org.email || '').trim().toLowerCase()
    const website = String(org.website || '').trim().slice(0, 200)
    if (!name) {
      setStatus({ type: 'error', message: 'Organization name is required.' })
      return
    }
    if (email && !isValidEmail(email)) {
      setStatus({ type: 'error', message: 'Enter a valid organization email.' })
      return
    }
    if (website) {
      try {
        const parsed = new URL(website.startsWith('http') ? website : `https://${website}`)
        if (!parsed.hostname) throw new Error('invalid')
      } catch {
        setStatus({ type: 'error', message: 'Enter a valid website URL.' })
        return
      }
    }
    const next = {
      ...settings,
      organization: {
        name,
        email,
        website,
        address_line1: String(org.address_line1 || '').trim().slice(0, 120),
        address_line2: String(org.address_line2 || '').trim().slice(0, 120),
        city: String(org.city || '').trim().slice(0, 80),
        locality: String(org.locality || '').trim().slice(0, 80),
        country: String(org.country || '').trim().slice(0, 80) || 'India',
        logoUrl: String(org.logoUrl || '').trim(),
      },
    }
    persist(next, 'Organization details saved.')
  }

  const onLogoFile = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) {
      setStatus({ type: 'error', message: 'Logo must be JPEG, PNG, WebP, or GIF.' })
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setStatus({ type: 'error', message: 'Logo must be 2MB or smaller.' })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      patchNested('organization', 'logoUrl', String(reader.result || ''))
      setStatus({ type: 'success', message: 'Logo ready — click Save changes to keep it.' })
    }
    reader.onerror = () => setStatus({ type: 'error', message: 'Could not read logo file.' })
    reader.readAsDataURL(file)
  }

  const runSave = () => {
    if (section === 'profile') saveProfile()
    else if (section === 'organization') saveOrganization()
    else if (section === 'appearance') saveAppearance()
    else if (section === 'notifications') saveNotifications()
    else if (section === 'billing') saveBillingDetails()
    else if (section === 'payments') savePayments()
    else if (section === 'data') saveDataPrefs()
    else if (section === 'pdf') savePdfTemplates()
    else if (section === 'security')
      setStatus({ type: 'success', message: 'Use the actions below for security changes.' })
  }

  return (
    <div className="sc-page-enter space-y-5">
      <PageHeader
        eyebrow={isTenantMode ? tenant?.name || 'Tenant' : 'Account'}
        title={isTenantMode ? 'Settings (tenant)' : 'Settings'}
        description={
          isTenantMode
            ? 'Profile, organization, appearance, notifications, security, billing, data, and PDF templates for this tenant.'
            : 'Manage your profile, preferences, security, billing, and document templates.'
        }
      />

      <StatusBanner type={status.type} message={status.message} />

      {isTenantMode && !tenantId ? (
        <StatusBanner type="warning" message="Select a tenant in the header to edit tenant settings." />
      ) : null}

      <div
        className={`grid gap-5 ${
          navCollapsed
            ? 'lg:grid-cols-[72px_minmax(0,1fr)]'
            : 'lg:grid-cols-[260px_minmax(0,1fr)]'
        }`}
      >
        <aside
          className={`h-fit rounded-2xl border border-stone-200/90 bg-white p-2 shadow-sm transition-all duration-200 lg:sticky lg:top-4 ${
            navCollapsed ? 'lg:w-[72px]' : ''
          }`}
        >
          <div
            className={`mb-1 flex items-center gap-1 ${
              navCollapsed ? 'justify-center' : 'justify-between px-1'
            }`}
          >
            {!navCollapsed ? (
              <p className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                {isTenantMode ? 'Tenant settings' : 'Preferences'}
              </p>
            ) : null}
            <button
              type="button"
              className="rounded-lg p-2 text-stone-500 transition-colors duration-150 hover:bg-stone-100 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
              onClick={() => setNavCollapsed((v) => !v)}
              aria-label={navCollapsed ? 'Expand settings menu' : 'Collapse settings menu'}
              title={navCollapsed ? 'Expand' : 'Collapse'}
            >
              <FiSidebar className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <nav className="space-y-1" aria-label="Settings sections">
            {SECTIONS.map((s) => {
              const active = section === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSection(s.id)}
                  className={settingsNavBtn(active, navCollapsed)}
                  aria-current={active ? 'page' : undefined}
                  aria-label={navCollapsed ? s.label : undefined}
                  title={navCollapsed ? `${s.label} — ${s.hint}` : undefined}
                >
                  {active ? (
                    <span
                      className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-brand-500"
                      aria-hidden
                    />
                  ) : null}
                  <SettingsNavIcon active={active}>
                    <s.icon className="h-4 w-4" />
                  </SettingsNavIcon>
                  {!navCollapsed ? (
                    <span className="min-w-0">
                      <span className="block leading-tight">{s.label}</span>
                      <span
                        className={`block text-[11px] font-normal ${
                          active ? 'text-brand-700/80' : 'text-stone-400'
                        }`}
                      >
                        {s.hint}
                      </span>
                    </span>
                  ) : null}
                </button>
              )
            })}
          </nav>
        </aside>

        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-stone-200/90 bg-white px-4 py-3.5 shadow-sm md:px-5">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold tracking-tight text-stone-900">{meta.title}</h3>
              <p className="mt-0.5 max-w-xl text-sm text-stone-500">{meta.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnSecondary} onClick={discard} disabled={saving}>
                Discard
              </button>
              {section === 'appearance' ? (
                <button
                  type="button"
                  className={btnGhost}
                  onClick={resetAppearance}
                  disabled={saving}
                >
                  Reset defaults
                </button>
              ) : null}
              {section === 'pdf' ? (
                <button
                  type="button"
                  className={btnGhost}
                  onClick={resetActiveTemplate}
                  disabled={saving}
                >
                  Reset template
                </button>
              ) : null}
              <button type="button" className={btnPrimary} disabled={saving} onClick={runSave}>
                {saving ? (
                  <>
                    <FiLoader className="h-4 w-4 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : (
                  <>
                    <FiCheck className="h-4 w-4" aria-hidden />
                    Save changes
                  </>
                )}
              </button>
            </div>
          </div>

          <div key={section} className="sc-fade-in space-y-4">
            {/* PROFILE */}
            {section === 'profile' ? (
              <>
                {useApiSettings && profileLoading ? (
                  <LoadingState label="Loading profile…" />
                ) : null}
                {useApiSettings && profileError && !profileLoading ? (
                  <ErrorState message={profileError} onRetry={loadSaProfile} />
                ) : null}
                {!(useApiSettings && profileLoading) && !(useApiSettings && profileError) ? (
                <SectionCard
                  title="Personal details"
                  description="Displayed across the admin panel. Names are trimmed and limited to 60 characters."
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className={labelClass}>First name</span>
                      <input
                        className={fieldClass}
                        value={settings.profile.first_name}
                        onChange={(e) => patchNested('profile', 'first_name', e.target.value)}
                        maxLength={60}
                        required
                        autoComplete="given-name"
                      />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Last name</span>
                      <input
                        className={fieldClass}
                        value={settings.profile.last_name}
                        onChange={(e) => patchNested('profile', 'last_name', e.target.value)}
                        maxLength={60}
                        autoComplete="family-name"
                      />
                    </label>
                    <div className="sm:col-span-2">
                      <p className={labelClass}>Email address</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm font-medium text-stone-800">
                          {settings.profile.email || '—'}
                        </p>
                        <SoftBadge
                          tone={settings.profile.email_verified ? 'success' : 'warn'}
                        >
                          {settings.profile.email_verified ? 'Verified' : 'Unverified'}
                        </SoftBadge>
                      </div>
                      {settings.profile.pending_email ? (
                        <p className="mt-2 text-xs text-amber-800">
                          Pending change to{' '}
                          <span className="font-medium">{settings.profile.pending_email}</span>{' '}
                          — not verified yet.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </SectionCard>
                ) : null}

                {!(useApiSettings && profileLoading) && !(useApiSettings && profileError) ? (
                <SectionCard
                  title="Change email"
                  description="We send a one-time code to the new address. Demo code: 123456."
                >
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <input
                      type="email"
                      className={fieldClass}
                      placeholder="new@email.com"
                      value={emailDraft}
                      onChange={(e) => setEmailDraft(e.target.value)}
                      autoComplete="email"
                    />
                    <button type="button" className={btnSecondary} onClick={startEmailChange}>
                      Send verification
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                    <input
                      className={fieldClass}
                      placeholder="Verification code"
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value)}
                      inputMode="numeric"
                    />
                    <button type="button" className={btnGhost} onClick={resendVerification}>
                      Resend
                    </button>
                    <button type="button" className={btnPrimary} onClick={confirmEmailVerification}>
                      Verify
                    </button>
                  </div>
                </SectionCard>
                ) : null}
              </>
            ) : null}

            {/* ORGANIZATION */}
            {section === 'organization' ? (
              <SectionCard
                title="Organization details"
                description="Shown on invoices, quotes, and the tenant switcher where applicable."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className={labelClass}>Organization name</span>
                    <input
                      className={fieldClass}
                      value={settings.organization?.name || ''}
                      onChange={(e) => patchNested('organization', 'name', e.target.value)}
                      maxLength={120}
                      required
                      autoComplete="organization"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className={labelClass}>Organization email</span>
                    <input
                      type="email"
                      className={fieldClass}
                      value={settings.organization?.email || ''}
                      onChange={(e) => patchNested('organization', 'email', e.target.value)}
                      autoComplete="email"
                      placeholder="ops@organization.com"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className={labelClass}>Website</span>
                    <input
                      type="url"
                      className={fieldClass}
                      value={settings.organization?.website || ''}
                      onChange={(e) => patchNested('organization', 'website', e.target.value)}
                      autoComplete="url"
                      placeholder="https://www.example.com"
                      maxLength={200}
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className={labelClass}>Address line 1</span>
                    <input
                      className={fieldClass}
                      value={settings.organization?.address_line1 || ''}
                      onChange={(e) =>
                        patchNested('organization', 'address_line1', e.target.value)
                      }
                      autoComplete="address-line1"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className={labelClass}>Address line 2</span>
                    <input
                      className={fieldClass}
                      value={settings.organization?.address_line2 || ''}
                      onChange={(e) =>
                        patchNested('organization', 'address_line2', e.target.value)
                      }
                      autoComplete="address-line2"
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Locality</span>
                    <input
                      className={fieldClass}
                      value={settings.organization?.locality || ''}
                      onChange={(e) => patchNested('organization', 'locality', e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>City</span>
                    <input
                      className={fieldClass}
                      value={settings.organization?.city || ''}
                      onChange={(e) => patchNested('organization', 'city', e.target.value)}
                      autoComplete="address-level2"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className={labelClass}>Country</span>
                    <input
                      className={fieldClass}
                      value={settings.organization?.country || ''}
                      onChange={(e) => patchNested('organization', 'country', e.target.value)}
                      autoComplete="country-name"
                    />
                  </label>
                  <div className="sm:col-span-2">
                    <p className={labelClass}>Logo</p>
                    <div className="flex flex-wrap items-start gap-4">
                      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                        {settings.organization?.logoUrl ? (
                          <img
                            src={settings.organization.logoUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-stone-400">No logo</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <label className={`${btnSecondary} inline-flex cursor-pointer`}>
                          Upload logo
                          <input
                            type="file"
                            className="hidden"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            onChange={onLogoFile}
                          />
                        </label>
                        <input
                          className={fieldClass}
                          value={settings.organization?.logoUrl?.startsWith('data:') ? '' : (settings.organization?.logoUrl || '')}
                          onChange={(e) => patchNested('organization', 'logoUrl', e.target.value)}
                          placeholder="Or paste logo URL (https://…)"
                        />
                        {settings.organization?.logoUrl ? (
                          <button
                            type="button"
                            className={`${btnGhost} text-rose-600`}
                            onClick={() => patchNested('organization', 'logoUrl', '')}
                          >
                            Remove logo
                          </button>
                        ) : null}
                        <p className="text-xs text-stone-400">JPEG, PNG, WebP, or GIF · max 2MB</p>
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>
            ) : null}

            {/* APPEARANCE */}
            {section === 'appearance' ? (
              <>
                {useApiSettings && appearanceLoading ? (
                  <LoadingState label="Loading appearance…" />
                ) : null}
                {useApiSettings && appearanceError && !appearanceLoading ? (
                  <ErrorState message={appearanceError} onRetry={loadSaAppearance} />
                ) : null}
                {!(useApiSettings && appearanceLoading) &&
                !(useApiSettings && appearanceError) ? (
                  <SectionCard
                    title="Look & feel"
                    description="Updates apply live. Click Save to persist across sessions."
                  >
                    <div className="space-y-5">
                      <div>
                        <p className={labelClass}>Theme</p>
                        <Segmented
                          options={THEMES}
                          value={settings.appearance.theme}
                          onChange={(value) => {
                            patchNested('appearance', 'theme', value)
                            applyAppearance({ ...settings.appearance, theme: value })
                          }}
                        />
                      </div>
                      <div>
                        <p className={labelClass}>Font size</p>
                        <Segmented
                          options={FONT_SIZES}
                          value={settings.appearance.fontSize}
                          onChange={(value) => {
                            patchNested('appearance', 'fontSize', value)
                            applyAppearance({ ...settings.appearance, fontSize: value })
                          }}
                        />
                      </div>
                      <label className="block max-w-sm">
                        <span className={labelClass}>Font family</span>
                        <select
                          className={fieldClass}
                          value={settings.appearance.fontFamily}
                          onChange={(e) => {
                            patchNested('appearance', 'fontFamily', e.target.value)
                            applyAppearance({
                              ...settings.appearance,
                              fontFamily: e.target.value,
                            })
                          }}
                        >
                          {APPEARANCE_FONT_FAMILIES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </SectionCard>
                ) : null}
              </>
            ) : null}

            {/* NOTIFICATIONS */}
            {section === 'notifications' ? (
              <>
                {useApiSettings && notificationsLoading ? (
                  <LoadingState label="Loading notifications…" />
                ) : null}
                {useApiSettings && notificationsError && !notificationsLoading ? (
                  <ErrorState
                    message={notificationsError}
                    onRetry={loadSaNotifications}
                  />
                ) : null}
                {!(useApiSettings && notificationsLoading) &&
                !(useApiSettings && notificationsError) ? (
                  <>
                    <SectionCard
                      title="Delivery channels"
                      description="Where we can reach you. You can combine multiple channels."
                    >
                      <div className="grid gap-2 sm:grid-cols-2">
                        {NOTIFY_CHANNELS.map((ch) => (
                          <ToggleRow
                            key={ch.key}
                            label={ch.label}
                            checked={Boolean(settings.notifications.channels?.[ch.key])}
                            onChange={(on) =>
                              patch('notifications', {
                                ...settings.notifications,
                                channels: {
                                  ...settings.notifications.channels,
                                  [ch.key]: on,
                                },
                              })
                            }
                          />
                        ))}
                      </div>
                    </SectionCard>
                    <SectionCard
                      title="Categories"
                      description="Security and billing alerts cannot be turned off."
                    >
                      <div className="space-y-2">
                        {NOTIFY_CATEGORIES.map((cat) => (
                          <ToggleRow
                            key={cat.key}
                            label={cat.label}
                            badge={cat.mandatory ? 'Required' : undefined}
                            disabled={cat.mandatory}
                            description={
                              cat.key === 'marketing_emails' &&
                              settings.notifications.marketingConsentAt
                                ? `Consent recorded ${formatWhen(settings.notifications.marketingConsentAt)}`
                                : undefined
                            }
                            checked={Boolean(
                              settings.notifications.categories?.[cat.key],
                            )}
                            onChange={(on) =>
                              patch('notifications', {
                                ...settings.notifications,
                                categories: {
                                  ...settings.notifications.categories,
                                  [cat.key]: on,
                                },
                              })
                            }
                          />
                        ))}
                      </div>
                    </SectionCard>
                  </>
                ) : null}
              </>
            ) : null}

            {/* SECURITY */}
            {section === 'security' ? (
              <div className="space-y-4">
                <SectionCard
                  title="Change password"
                  description="Requires your current password. Minimum 8 characters."
                >
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block">
                      <span className={labelClass}>Current password</span>
                      <input
                        type="password"
                        className={fieldClass}
                        value={passwordForm.current}
                        onChange={(e) =>
                          setPasswordForm((f) => ({ ...f, current: e.target.value }))
                        }
                        autoComplete="current-password"
                      />
                    </label>
                    <label className="block">
                      <span className={labelClass}>New password</span>
                      <input
                        type="password"
                        className={fieldClass}
                        value={passwordForm.next}
                        onChange={(e) => setPasswordForm((f) => ({ ...f, next: e.target.value }))}
                        autoComplete="new-password"
                      />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Confirm</span>
                      <input
                        type="password"
                        className={fieldClass}
                        value={passwordForm.confirm}
                        onChange={(e) =>
                          setPasswordForm((f) => ({ ...f, confirm: e.target.value }))
                        }
                        autoComplete="new-password"
                      />
                    </label>
                  </div>
                  <button type="button" className={`${btnPrimary} mt-4`} onClick={changePassword}>
                    Update password
                  </button>
                </SectionCard>

                <SectionCard
                  title="Two-factor authentication"
                  description={
                    settings.security.twoFactorEnabled
                      ? `Enabled · ${settings.security.recoveryCodesRemaining} recovery codes left`
                      : 'Add a second step at sign-in for stronger account protection.'
                  }
                  action={
                    settings.security.twoFactorEnabled ? (
                      <button type="button" className={btnDanger} onClick={disable2fa}>
                        Disable 2FA
                      </button>
                    ) : (
                      <button type="button" className={btnPrimary} onClick={enable2fa}>
                        <FiShield className="h-4 w-4" aria-hidden />
                        Enable 2FA
                      </button>
                    )
                  }
                >
                  {recoveryCodes.length ? (
                    <div className="rounded-xl bg-stone-50 p-3 font-mono text-xs text-stone-700 ring-1 ring-stone-200">
                      {recoveryCodes.map((c) => (
                        <div key={c}>{c}</div>
                      ))}
                      <p className="mt-2 font-sans text-[11px] text-amber-800">
                        Shown once. Store offline — codes are hashed server-side when API is live.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-stone-500">
                      Recovery codes appear here after you enable 2FA.
                    </p>
                  )}
                </SectionCard>

                <SectionCard
                  title="Sessions"
                  description="Revoke refresh tokens on other devices. You stay signed in here."
                  action={
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={() => setSignOutOpen(true)}
                    >
                      Sign out all devices
                    </button>
                  }
                >
                  <p className="text-sm text-stone-500">
                    Sensitive actions are rate-limited and audited when the live API is connected.
                  </p>
                </SectionCard>

                <SectionCard title="Login history" description="Recent successful and failed sign-ins.">
                  <ul className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200">
                    {(settings.security.loginHistory || []).map((row) => (
                      <li
                        key={row.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-3 text-sm transition-colors hover:bg-stone-50/80"
                      >
                        <div>
                          <p className="font-medium text-stone-800">{row.device}</p>
                          <p className="text-xs text-stone-500">
                            {row.location} · {row.ip}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-stone-500">{formatWhen(row.at)}</p>
                          <SoftBadge tone={row.status === 'success' ? 'success' : 'warn'}>
                            {row.status}
                          </SoftBadge>
                        </div>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              </div>
            ) : null}

            {/* BILLING */}
            {section === 'billing' ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatTile label="Plan" value={settings.billing.planName} />
                  <StatTile label="Status" value={settings.billing.status} />
                  <StatTile label="Billing cycle" value={settings.billing.billingCycle} />
                  <StatTile label="Renewal" value={settings.billing.renewalDate} />
                </div>

                <ToggleRow
                  label="Auto-renewal enabled"
                  description="Renew the subscription automatically at the end of each billing cycle."
                  checked={Boolean(settings.billing.autoRenew)}
                  onChange={(v) => patchNested('billing', 'autoRenew', v)}
                />

                <SectionCard
                  title="Plan usage"
                  description="Limits included with your subscription."
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                        User seats
                      </p>
                      <p className="mt-1 text-base font-semibold text-stone-900">
                        {settings.billing.usage.seats} / {settings.billing.usage.seatsLimit}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-stone-500">
                        A seat is one licensed user who can sign in (admins, staff, ops). Unused seats can be
                        invited later; upgrading the plan raises this limit.
                      </p>
                    </div>
                    <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                        Storage
                      </p>
                      <p className="mt-1 text-base font-semibold text-stone-900">
                        {settings.billing.usage.storageGb} / {settings.billing.usage.storageLimitGb} GB
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        Files, exports, and media stored for this organization.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <select
                      className={fieldClass}
                      style={{ maxWidth: 180 }}
                      value={settings.billing.billingCycle}
                      onChange={(e) => patchNested('billing', 'billingCycle', e.target.value)}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="annual">Annual</option>
                    </select>
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={() =>
                        setStatus({
                          type: 'success',
                          message:
                            'Upgrade/downgrade request recorded (provider confirmation pending).',
                        })
                      }
                    >
                      Request plan change
                    </button>
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() =>
                        setStatus({
                          type: 'success',
                          message: 'Refund request created · status: submitted.',
                        })
                      }
                    >
                      Request refund
                    </button>
                  </div>
                </SectionCard>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>Billing name</span>
                    <input
                      className={fieldClass}
                      value={settings.billing.billingName}
                      onChange={(e) => patchNested('billing', 'billingName', e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Billing email</span>
                    <input
                      type="email"
                      className={fieldClass}
                      value={settings.billing.billingEmail}
                      onChange={(e) => patchNested('billing', 'billingEmail', e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>GSTIN</span>
                    <input
                      className={fieldClass}
                      value={settings.billing.gstin}
                      onChange={(e) =>
                        patchNested('billing', 'gstin', e.target.value.toUpperCase())
                      }
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className={labelClass}>Billing address</span>
                    <textarea
                      className={`${fieldClass} min-h-[72px] resize-y`}
                      value={settings.billing.address}
                      onChange={(e) => patchNested('billing', 'address', e.target.value)}
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {/* PAYMENTS */}
            {section === 'payments' ? (
              <div className="space-y-4">
                <SectionCard
                  title="Payment modes"
                  description="Enable gateways customers can pay with. Razorpay and Cashfree need API keys; COD and Manual stay offline."
                >
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {PAYMENT_MODES.map((m) => {
                      const cfg = payments[m.id] || {}
                      const on = payMode === m.id
                      const live =
                        m.id === 'razorpay' || m.id === 'cashfree'
                          ? Boolean(cfg.connected)
                          : Boolean(cfg.enabled)
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPayMode(m.id)}
                          className={`rounded-2xl border p-3.5 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 ${
                            on
                              ? 'border-brand-300 bg-brand-50 shadow-sm ring-1 ring-brand-100'
                              : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-stone-900">{m.label}</span>
                            <SoftBadge tone={live ? 'success' : 'neutral'}>
                              {live ? (m.id === 'cod' || m.id === 'manual' ? 'On' : 'Connected') : 'Off'}
                            </SoftBadge>
                          </div>
                          <p className="mt-1 text-[11px] text-stone-500">{m.hint}</p>
                        </button>
                      )
                    })}
                  </div>
                  <div className="mt-4">
                    <span className={labelClass}>Default checkout mode</span>
                    <select
                      className={fieldClass}
                      value={payments.defaultMode || 'razorpay'}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          payments: { ...s.payments, defaultMode: e.target.value },
                        }))
                      }
                    >
                      {PAYMENT_MODES.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </SectionCard>

                {payMode === 'razorpay' ? (
                  <div className="space-y-3">
                    {payments.razorpay?.connected ? (
                      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                        <div className="flex items-start justify-between gap-3 p-4">
                          <div className="flex min-w-0 items-start gap-3">
                            <span
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#072654] text-[11px] font-bold tracking-tight text-white"
                              aria-hidden
                            >
                              rzp
                            </span>
                            <div className="min-w-0">
                              <p className="text-base font-semibold text-stone-900">Razorpay</p>
                              <p className="mt-0.5 text-sm text-stone-500">
                                You are accepting Razorpay
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <button
                              type="button"
                              className="text-sm font-medium text-sky-600 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
                              onClick={() => setRazorManageOpen((v) => !v)}
                            >
                              Manage
                            </button>
                            <p className="mt-2 text-[11px] text-stone-400">Checkout</p>
                            <span className="mt-0.5 inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                              Active
                            </span>
                          </div>
                        </div>
                        <div className="border-t border-stone-100 px-4 py-3 text-sm text-stone-600">
                          Provider: Razorpay{' '}
                          <span className="mx-2 text-stone-300">·</span>
                          Account:{' '}
                          <span className="font-medium tracking-wide text-stone-800">
                            {maskAccount(
                              payments.razorpay.accountId || payments.razorpay.keyId,
                            )}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-2xl border border-dashed border-stone-300 bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#072654] text-[11px] font-bold tracking-tight text-white"
                              aria-hidden
                            >
                              rzp
                            </span>
                            <div>
                              <p className="text-base font-semibold text-stone-900">Razorpay</p>
                              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-stone-500">
                                Not Connected
                                <FiInfo className="h-3.5 w-3.5 text-stone-400" aria-hidden />
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            className={btnPrimary}
                            onClick={() => setRazorManageOpen(true)}
                          >
                            Connect
                          </button>
                        </div>
                      </div>
                    )}

                    {razorManageOpen || !payments.razorpay?.connected ? (
                      <SectionCard
                        title={payments.razorpay?.connected ? 'Manage Razorpay' : 'Connect Razorpay'}
                        description="Keys from the Razorpay dashboard. Stored locally until the live API is wired."
                      >
                        <div className="space-y-3">
                          <ToggleRow
                            label="Enable Razorpay at checkout"
                            description="Customers can pay with cards, UPI, and netbanking."
                            checked={Boolean(payments.razorpay?.enabled)}
                            onChange={(v) => patchPaymentMode('razorpay', { enabled: v })}
                          />
                          <label className="block">
                            <span className={labelClass}>Key ID</span>
                            <input
                              className={fieldClass}
                              placeholder="rzp_live_••••••••"
                              value={payments.razorpay?.keyId || ''}
                              onChange={(e) =>
                                patchPaymentMode('razorpay', { keyId: e.target.value })
                              }
                              autoComplete="off"
                            />
                          </label>
                          <label className="block">
                            <span className={labelClass}>Key Secret</span>
                            <input
                              type="password"
                              className={fieldClass}
                              placeholder="••••••••••••••••"
                              value={payments.razorpay?.keySecret || ''}
                              onChange={(e) =>
                                patchPaymentMode('razorpay', { keySecret: e.target.value })
                              }
                              autoComplete="new-password"
                            />
                          </label>
                          <label className="block">
                            <span className={labelClass}>Webhook secret (optional)</span>
                            <input
                              type="password"
                              className={fieldClass}
                              placeholder="whsec_••••"
                              value={payments.razorpay?.webhookSecret || ''}
                              onChange={(e) =>
                                patchPaymentMode('razorpay', { webhookSecret: e.target.value })
                              }
                              autoComplete="new-password"
                            />
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {payments.razorpay?.connected ? (
                              <>
                                <a
                                  className={btnSecondary}
                                  href="https://dashboard.razorpay.com/"
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Open dashboard
                                </a>
                                <button
                                  type="button"
                                  className={btnGhost}
                                  onClick={() => {
                                    disconnectRazorpay()
                                    setRazorManageOpen(false)
                                  }}
                                >
                                  Disconnect
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className={btnPrimary}
                                  disabled={razorConnecting}
                                  onClick={connectRazorpay}
                                >
                                  {razorConnecting ? (
                                    <>
                                      <FiLoader className="h-4 w-4 animate-spin" aria-hidden />
                                      Connecting…
                                    </>
                                  ) : (
                                    'Connect Razorpay'
                                  )}
                                </button>
                                <a
                                  className={btnSecondary}
                                  href="https://dashboard.razorpay.com/app/keys"
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Get API keys
                                </a>
                              </>
                            )}
                          </div>
                        </div>
                      </SectionCard>
                    ) : null}
                  </div>
                ) : null}

                {payMode === 'cashfree' ? (
                  <div className="space-y-3">
                    {payments.cashfree?.connected ? (
                      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                        <div className="flex items-start justify-between gap-3 p-4">
                          <div className="flex min-w-0 items-start gap-3">
                            <span
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#ff7a45] text-[10px] font-bold text-white"
                              aria-hidden
                            >
                              CF
                            </span>
                            <div className="min-w-0">
                              <p className="text-base font-semibold text-stone-900">Cashfree</p>
                              <p className="mt-0.5 text-sm text-stone-500">
                                You are accepting Cashfree
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <button
                              type="button"
                              className="text-sm font-medium text-sky-600 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
                              onClick={() => setCashManageOpen((v) => !v)}
                            >
                              Manage
                            </button>
                            <p className="mt-2 text-[11px] text-stone-400">Checkout</p>
                            <span className="mt-0.5 inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                              Active
                            </span>
                          </div>
                        </div>
                        <div className="border-t border-stone-100 px-4 py-3 text-sm text-stone-600">
                          Provider: Cashfree{' '}
                          <span className="mx-2 text-stone-300">·</span>
                          Account:{' '}
                          <span className="font-medium tracking-wide text-stone-800">
                            {maskAccount(payments.cashfree.appId)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-2xl border border-dashed border-stone-300 bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#ff7a45] text-[10px] font-bold text-white"
                              aria-hidden
                            >
                              CF
                            </span>
                            <div>
                              <p className="text-base font-semibold text-stone-900">Cashfree</p>
                              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-stone-500">
                                Not Connected
                                <FiInfo className="h-3.5 w-3.5 text-stone-400" aria-hidden />
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            className={btnPrimary}
                            onClick={() => setCashManageOpen(true)}
                          >
                            Connect
                          </button>
                        </div>
                      </div>
                    )}

                    {cashManageOpen || !payments.cashfree?.connected ? (
                      <SectionCard
                        title={
                          payments.cashfree?.connected ? 'Manage Cashfree' : 'Connect Cashfree'
                        }
                        description="App ID and Secret Key from the Cashfree merchant dashboard."
                      >
                        <div className="space-y-3">
                          <ToggleRow
                            label="Enable Cashfree at checkout"
                            description="UPI and gateway checkout via Cashfree."
                            checked={Boolean(payments.cashfree?.enabled)}
                            onChange={(v) => patchPaymentMode('cashfree', { enabled: v })}
                          />
                          <label className="block">
                            <span className={labelClass}>Environment</span>
                            <select
                              className={fieldClass}
                              value={payments.cashfree?.environment || 'sandbox'}
                              onChange={(e) =>
                                patchPaymentMode('cashfree', { environment: e.target.value })
                              }
                            >
                              <option value="sandbox">Sandbox</option>
                              <option value="production">Production</option>
                            </select>
                          </label>
                          <label className="block">
                            <span className={labelClass}>App ID</span>
                            <input
                              className={fieldClass}
                              value={payments.cashfree?.appId || ''}
                              onChange={(e) =>
                                patchPaymentMode('cashfree', { appId: e.target.value })
                              }
                              autoComplete="off"
                            />
                          </label>
                          <label className="block">
                            <span className={labelClass}>Secret Key</span>
                            <input
                              type="password"
                              className={fieldClass}
                              value={payments.cashfree?.secretKey || ''}
                              onChange={(e) =>
                                patchPaymentMode('cashfree', { secretKey: e.target.value })
                              }
                              autoComplete="new-password"
                            />
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {payments.cashfree?.connected ? (
                              <button
                                type="button"
                                className={btnGhost}
                                onClick={() => {
                                  disconnectCashfree()
                                  setCashManageOpen(false)
                                }}
                              >
                                Disconnect
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={btnPrimary}
                                onClick={connectCashfree}
                              >
                                Connect Cashfree
                              </button>
                            )}
                          </div>
                        </div>
                      </SectionCard>
                    ) : null}
                  </div>
                ) : null}

                {payMode === 'cod' ? (
                  <SectionCard
                    title="Cash on delivery (COD)"
                    description="Collect cash at the venue or during a home visit."
                  >
                    <div className="space-y-3">
                      <ToggleRow
                        label="Enable COD"
                        description="Customers can choose pay-on-delivery / pay-on-visit."
                        checked={Boolean(payments.cod?.enabled)}
                        onChange={(v) => patchPaymentMode('cod', { enabled: v })}
                      />
                      <label className="block">
                        <span className={labelClass}>Instructions shown to customer</span>
                        <textarea
                          className={`${fieldClass} min-h-[88px]`}
                          value={payments.cod?.instructions || ''}
                          onChange={(e) =>
                            patchPaymentMode('cod', { instructions: e.target.value })
                          }
                          maxLength={500}
                        />
                      </label>
                    </div>
                  </SectionCard>
                ) : null}

                {payMode === 'manual' ? (
                  <SectionCard
                    title="Manual payment"
                    description="Offline UPI or bank transfer — staff marks the booking paid."
                  >
                    <div className="space-y-3">
                      <ToggleRow
                        label="Enable manual payments"
                        description="Show bank / UPI details for offline settlement."
                        checked={Boolean(payments.manual?.enabled)}
                        onChange={(v) => patchPaymentMode('manual', { enabled: v })}
                      />
                      <label className="block">
                        <span className={labelClass}>Instructions</span>
                        <textarea
                          className={`${fieldClass} min-h-[72px]`}
                          value={payments.manual?.instructions || ''}
                          onChange={(e) =>
                            patchPaymentMode('manual', { instructions: e.target.value })
                          }
                          maxLength={500}
                        />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className={labelClass}>Bank name</span>
                          <input
                            className={fieldClass}
                            value={payments.manual?.bankName || ''}
                            onChange={(e) =>
                              patchPaymentMode('manual', { bankName: e.target.value })
                            }
                          />
                        </label>
                        <label className="block">
                          <span className={labelClass}>Account name</span>
                          <input
                            className={fieldClass}
                            value={payments.manual?.accountName || ''}
                            onChange={(e) =>
                              patchPaymentMode('manual', { accountName: e.target.value })
                            }
                          />
                        </label>
                        <label className="block">
                          <span className={labelClass}>Account number</span>
                          <input
                            className={fieldClass}
                            value={payments.manual?.accountNumber || ''}
                            onChange={(e) =>
                              patchPaymentMode('manual', { accountNumber: e.target.value })
                            }
                          />
                        </label>
                        <label className="block">
                          <span className={labelClass}>IFSC</span>
                          <input
                            className={fieldClass}
                            value={payments.manual?.ifsc || ''}
                            onChange={(e) => patchPaymentMode('manual', { ifsc: e.target.value })}
                          />
                        </label>
                        <label className="block sm:col-span-2">
                          <span className={labelClass}>UPI ID</span>
                          <input
                            className={fieldClass}
                            placeholder="org@upi"
                            value={payments.manual?.upiId || ''}
                            onChange={(e) => patchPaymentMode('manual', { upiId: e.target.value })}
                          />
                        </label>
                      </div>
                    </div>
                  </SectionCard>
                ) : null}
              </div>
            ) : null}

            {/* DATA */}
            {section === 'data' ? (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>Default export format</span>
                    <select
                      className={fieldClass}
                      value={settings.data.preferredExportFormat}
                      onChange={(e) =>
                        patchNested('data', 'preferredExportFormat', e.target.value)
                      }
                    >
                      {EXPORT_FORMATS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className={labelClass}>Retention (days)</span>
                    <input
                      type="number"
                      className={fieldClass}
                      min={30}
                      max={2555}
                      value={settings.data.retentionDays}
                      onChange={(e) =>
                        patchNested('data', 'retentionDays', Number(e.target.value) || 365)
                      }
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-stone-700 sm:col-span-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-500"
                      checked={settings.data.autoSave}
                      onChange={(e) => patchNested('data', 'autoSave', e.target.checked)}
                    />
                    Auto-save drafts where supported
                  </label>
                  <label className="flex items-center gap-2 text-sm text-stone-700 sm:col-span-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-500"
                      checked={settings.data.backupsEnabled}
                      onChange={(e) => patchNested('data', 'backupsEnabled', e.target.checked)}
                    />
                    Automatic backups
                    {settings.data.lastBackupAt ? (
                      <span className="text-xs text-stone-400">
                        Last: {formatWhen(settings.data.lastBackupAt)}
                      </span>
                    ) : null}
                  </label>
                </div>

                <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 text-sm text-stone-700">
                  Storage used {settings.data.storageUsedGb} GB of {settings.data.storageLimitGb} GB
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" className={btnPrimary} onClick={requestExport}>
                    Request export
                  </button>
                  <label className={`${btnSecondary} cursor-pointer`}>
                    <FiPlus className="h-3.5 w-3.5" aria-hidden />
                    Import file
                    <input
                      type="file"
                      className="hidden"
                      accept=".csv,.json,.xlsx"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        e.target.value = ''
                        if (!file) return
                        if (file.size > 5 * 1024 * 1024) {
                          setStatus({ type: 'error', message: 'File must be 5MB or smaller.' })
                          return
                        }
                        setStatus({
                          type: 'success',
                          message: `Import accepted for validation: ${file.name} (demo — row errors reported when API is live).`,
                        })
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() =>
                      setStatus({
                        type: 'success',
                        message: 'Restore requires confirmation and audit when backup API is live.',
                      })
                    }
                  >
                    Restore from backup
                  </button>
                </div>

                {(settings.data.exportJobs || []).length ? (
                  <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
                    {settings.data.exportJobs.map((job) => (
                      <li
                        key={job.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                      >
                        <span>
                          {job.id} · {String(job.format).toUpperCase()} · {job.status}
                        </span>
                        <span className="text-xs text-stone-500">
                          Expires {formatWhen(job.downloadExpiresAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {/* PDF TEMPLATES */}
            {section === 'pdf' ? (
              <PdfTemplatesEditor
                templates={templates}
                activeId={activeTemplateId}
                onSelect={setActiveTemplateId}
                onStyleChange={updateTemplateStyle}
                onMetaChange={updateTemplateMeta}
                organization={settings.organization}
              />
            ) : null}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={signOutOpen}
        title="Sign out all devices?"
        message="This revokes refresh tokens/sessions on other devices. You stay signed in here."
        confirmLabel="Sign out others"
        onConfirm={signOutAllDevices}
        onClose={() => setSignOutOpen(false)}
      />

    </div>
  )
}

export default SettingsPage
