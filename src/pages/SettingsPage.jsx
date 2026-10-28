import { useEffect, useMemo, useState } from 'react'
import {
  FiBell,
  FiBriefcase,
  FiCheck,
  FiCreditCard,
  FiDatabase,
  FiEdit2,
  FiEye,
  FiFileText,
  FiLoader,
  FiLock,
  FiPlus,
  FiShield,
  FiSidebar,
  FiTrash2,
  FiUser,
} from 'react-icons/fi'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Modal from '../components/ui/Modal'
import {
  EXPORT_FORMATS,
  FONT_FAMILIES,
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
  { id: 'billing', label: 'Billing', hint: 'Plan & invoices', icon: FiCreditCard },
  { id: 'data', label: 'Data', hint: 'Export & storage', icon: FiDatabase },
  { id: 'pdf', label: 'PDF templates', hint: 'Layout & fonts', icon: FiFileText },
]

const SECTION_META = {
  profile: {
    title: 'Profile',
    description: 'Your personal name and email. Email changes stay unverified until you confirm the code.',
  },
  organization: {
    title: 'Organization',
    description: 'Organization name, contact email, address, and logo for this tenant.',
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
    description: 'Plan, payment methods, tax details, and invoices.',
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

const CARD_BRANDS = ['Visa', 'Mastercard', 'RuPay', 'American Express', 'Other']

const emptyPaymentForm = () => ({
  id: '',
  brand: 'Visa',
  cardNumber: '',
  last4: '',
  expMonth: '',
  expYear: '',
  isDefault: false,
})

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
  const { tenant, tenantId, canWrite } = useAccess()
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
  const [paymentModal, setPaymentModal] = useState(null) // 'create' | 'edit' | null
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm)
  const [paymentDelete, setPaymentDelete] = useState(null)
  const [paymentSaving, setPaymentSaving] = useState(false)

  const reload = () => {
    const next = loadSettingsForMode(mode, { tenantId, tenant })
    next.pdfTemplates = normalizePdfTemplates(next.pdfTemplates)
    setSettings(next)
    setEmailDraft('')
    setVerifyCode('')
    setActiveTemplateId(next.pdfTemplates?.[0]?.id || 'template-1')
    setStatus({ type: '', message: '' })
  }

  useEffect(() => {
    reload()
    if (isTenantMode) setSection('organization')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, tenantId])

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
  const saveProfile = () => {
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
  const saveAppearance = () => {
    const theme = THEMES.some((t) => t.value === settings.appearance.theme)
      ? settings.appearance.theme
      : 'light'
    const fontSize = FONT_SIZES.some((t) => t.value === settings.appearance.fontSize)
      ? settings.appearance.fontSize
      : 'medium'
    const fontFamily = FONT_FAMILIES.some((t) => t.value === settings.appearance.fontFamily)
      ? settings.appearance.fontFamily
      : 'Segoe UI'
    const appearance = { theme, fontSize, fontFamily }
    const next = { ...settings, appearance }
    persist(next, 'Appearance saved.')
    applyAppearance(appearance)
  }

  const resetAppearance = () => {
    const appearance = defaultUserSettings(getAuthUser() || {}).appearance
    const next = { ...settings, appearance }
    setSettings(next)
    applyAppearance(appearance)
    persist(next, 'Appearance reset to defaults.')
  }

  /* —— Notifications —— */
  const saveNotifications = () => {
    const categories = { ...settings.notifications.categories }
    NOTIFY_CATEGORIES.forEach((c) => {
      if (c.mandatory) categories[c.key] = true
    })
    const marketingOn = Boolean(categories.marketing)
    const next = {
      ...settings,
      notifications: {
        ...settings.notifications,
        categories,
        marketingConsentAt: marketingOn
          ? settings.notifications.marketingConsentAt || new Date().toISOString()
          : null,
      },
    }
    persist(next, 'Notification preferences saved.')
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

  const openAddPayment = () => {
    setPaymentForm({ ...emptyPaymentForm(), isDefault: !(settings.billing.paymentMethods || []).length })
    setPaymentModal('create')
  }

  const openEditPayment = (pm) => {
    setPaymentForm({
      id: pm.id,
      brand: pm.brand || 'Visa',
      cardNumber: '',
      last4: pm.last4 || '',
      expMonth: String(pm.expMonth || ''),
      expYear: String(pm.expYear || ''),
      isDefault: Boolean(pm.isDefault),
    })
    setPaymentModal('edit')
  }

  const closePaymentModal = () => {
    if (paymentSaving) return
    setPaymentModal(null)
    setPaymentForm(emptyPaymentForm())
  }

  const savePaymentMethod = (event) => {
    event.preventDefault()
    const brand = String(paymentForm.brand || '').trim() || 'Other'
    const digits = String(paymentForm.cardNumber || '').replace(/\D/g, '')
    let last4 = String(paymentForm.last4 || '').replace(/\D/g, '').slice(-4)
    if (paymentModal === 'create') {
      if (digits.length < 12 || digits.length > 19) {
        setStatus({ type: 'error', message: 'Enter a valid card number (12–19 digits).' })
        return
      }
      last4 = digits.slice(-4)
    } else if (last4.length !== 4) {
      setStatus({ type: 'error', message: 'Last 4 digits must be 4 numbers.' })
      return
    }
    const expMonth = Number(paymentForm.expMonth)
    const expYear = Number(paymentForm.expYear)
    if (!Number.isFinite(expMonth) || expMonth < 1 || expMonth > 12) {
      setStatus({ type: 'error', message: 'Expiry month must be 1–12.' })
      return
    }
    if (!Number.isFinite(expYear) || expYear < new Date().getFullYear()) {
      setStatus({ type: 'error', message: 'Enter a valid expiry year.' })
      return
    }

    setPaymentSaving(true)
    try {
      const list = [...(settings.billing.paymentMethods || [])]
      const makeDefault = Boolean(paymentForm.isDefault) || list.length === 0
      let nextList
      if (paymentModal === 'create') {
        const row = {
          id: `pm-${Date.now()}`,
          brand,
          last4,
          expMonth,
          expYear,
          isDefault: makeDefault,
        }
        nextList = makeDefault
          ? [row, ...list.map((p) => ({ ...p, isDefault: false }))]
          : [...list, row]
      } else {
        nextList = list.map((p) => {
          if (String(p.id) !== String(paymentForm.id)) {
            return makeDefault ? { ...p, isDefault: false } : p
          }
          return {
            ...p,
            brand,
            last4,
            expMonth,
            expYear,
            isDefault: makeDefault,
          }
        })
        if (makeDefault && !nextList.some((p) => p.isDefault)) {
          nextList = nextList.map((p, i) => ({ ...p, isDefault: i === 0 }))
        }
      }
      const next = {
        ...settings,
        billing: { ...settings.billing, paymentMethods: nextList },
      }
      persist(
        next,
        paymentModal === 'create'
          ? 'Payment method added (tokenized — full card/CVV not stored).'
          : 'Payment method updated.',
      )
      setPaymentModal(null)
      setPaymentForm(emptyPaymentForm())
    } finally {
      setPaymentSaving(false)
    }
  }

  const confirmDeletePayment = () => {
    if (!paymentDelete?.id) return
    const list = (settings.billing.paymentMethods || []).filter(
      (p) => String(p.id) !== String(paymentDelete.id),
    )
    if (list.length && !list.some((p) => p.isDefault)) {
      list[0] = { ...list[0], isDefault: true }
    }
    const next = {
      ...settings,
      billing: { ...settings.billing, paymentMethods: list },
    }
    persist(next, 'Payment method removed.')
    setPaymentDelete(null)
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
    if (!name) {
      setStatus({ type: 'error', message: 'Organization name is required.' })
      return
    }
    if (email && !isValidEmail(email)) {
      setStatus({ type: 'error', message: 'Enter a valid organization email.' })
      return
    }
    const next = {
      ...settings,
      organization: {
        name,
        email,
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
                      {FONT_FAMILIES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </SectionCard>
            ) : null}

            {/* NOTIFICATIONS */}
            {section === 'notifications' ? (
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
                          cat.key === 'marketing' && settings.notifications.marketingConsentAt
                            ? `Consent recorded ${formatWhen(settings.notifications.marketingConsentAt)}`
                            : undefined
                        }
                        checked={Boolean(settings.notifications.categories?.[cat.key])}
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
                  <label className="mt-4 flex items-center gap-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-500"
                      checked={settings.billing.autoRenew}
                      onChange={(e) => patchNested('billing', 'autoRenew', e.target.checked)}
                    />
                    Auto-renewal enabled
                  </label>
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

                <SectionCard
                  title="Payment methods"
                  description="Only brand, last four digits, and expiry are kept. Full card number and CVV are never stored."
                  action={
                    <button type="button" className={btnPrimary} onClick={openAddPayment}>
                      <FiPlus className="h-3.5 w-3.5" aria-hidden />
                      Add method
                    </button>
                  }
                >
                  {(settings.billing.paymentMethods || []).length === 0 ? (
                    <p className="text-sm text-stone-500">
                      No payment methods yet. Add a card to enable auto-renewal charges.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {(settings.billing.paymentMethods || []).map((pm) => (
                        <li
                          key={pm.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 px-3.5 py-3 text-sm transition-colors hover:bg-stone-50/80"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                              <FiCreditCard className="h-4 w-4" aria-hidden />
                            </span>
                            <div>
                              <p className="flex flex-wrap items-center gap-2 font-medium text-stone-900">
                                <span>
                                  {pm.brand} ···· {pm.last4}
                                </span>
                                {pm.isDefault ? (
                                  <SoftBadge tone="brand">Default</SoftBadge>
                                ) : null}
                              </p>
                              <p className="text-xs text-stone-500">
                                Expires {String(pm.expMonth).padStart(2, '0')}/{pm.expYear}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              className={btnGhost}
                              onClick={() => openEditPayment(pm)}
                              aria-label={`Edit ${pm.brand} ending ${pm.last4}`}
                            >
                              <FiEdit2 className="h-3.5 w-3.5" aria-hidden />
                              Edit
                            </button>
                            <button
                              type="button"
                              className={`${btnGhost} text-rose-600`}
                              onClick={() => setPaymentDelete(pm)}
                              aria-label={`Delete ${pm.brand} ending ${pm.last4}`}
                            >
                              <FiTrash2 className="h-3.5 w-3.5" aria-hidden />
                              Delete
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </SectionCard>

                <div>
                  <p className="mb-2 text-sm font-semibold text-stone-900">Invoices</p>
                  <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
                    {(settings.billing.invoices || []).map((inv) => (
                      <li
                        key={inv.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                      >
                        <span>
                          {inv.id} · {inv.date}
                        </span>
                        <span className="flex items-center gap-2">
                          ₹{inv.amount} · {inv.status}
                          <button type="button" className={btnGhost}>
                            Download PDF
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
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

      <ConfirmDialog
        open={Boolean(paymentDelete)}
        title="Remove payment method?"
        message={
          paymentDelete
            ? `Remove ${paymentDelete.brand} ending in ${paymentDelete.last4}? If it was default, another card becomes default.`
            : 'Remove this payment method?'
        }
        confirmLabel="Delete"
        onConfirm={confirmDeletePayment}
        onClose={() => setPaymentDelete(null)}
      />

      <Modal
        open={Boolean(paymentModal)}
        title={paymentModal === 'edit' ? 'Edit payment method' : 'Add payment method'}
        onClose={closePaymentModal}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={closePaymentModal}
              disabled={paymentSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="payment-method-form"
              className={btnPrimary}
              disabled={paymentSaving}
            >
              {paymentSaving ? (
                <>
                  <FiLoader className="h-4 w-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : paymentModal === 'edit' ? (
                'Save changes'
              ) : (
                'Add card'
              )}
            </button>
          </div>
        }
      >
        <form id="payment-method-form" className="space-y-4" onSubmit={savePaymentMethod}>
          <p className="text-xs leading-relaxed text-stone-500">
            Demo form — in production the card is tokenized by the payment provider. We only keep
            brand, last 4, and expiry.
          </p>
          <label className="block">
            <span className={labelClass}>Card brand</span>
            <select
              className={fieldClass}
              value={paymentForm.brand}
              onChange={(e) => setPaymentForm((f) => ({ ...f, brand: e.target.value }))}
              disabled={paymentSaving}
            >
              {CARD_BRANDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
          {paymentModal === 'create' ? (
            <label className="block">
              <span className={labelClass}>Card number</span>
              <input
                className={fieldClass}
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="•••• •••• •••• ••••"
                value={paymentForm.cardNumber}
                onChange={(e) =>
                  setPaymentForm((f) => ({
                    ...f,
                    cardNumber: e.target.value.replace(/[^\d\s]/g, '').slice(0, 23),
                  }))
                }
                disabled={paymentSaving}
                required
              />
            </label>
          ) : (
            <label className="block">
              <span className={labelClass}>Last 4 digits</span>
              <input
                className={fieldClass}
                inputMode="numeric"
                value={paymentForm.last4}
                onChange={(e) =>
                  setPaymentForm((f) => ({
                    ...f,
                    last4: e.target.value.replace(/\D/g, '').slice(0, 4),
                  }))
                }
                disabled={paymentSaving}
                required
              />
            </label>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Expiry month</span>
              <input
                className={fieldClass}
                type="number"
                min={1}
                max={12}
                placeholder="MM"
                value={paymentForm.expMonth}
                onChange={(e) => setPaymentForm((f) => ({ ...f, expMonth: e.target.value }))}
                disabled={paymentSaving}
                required
              />
            </label>
            <label className="block">
              <span className={labelClass}>Expiry year</span>
              <input
                className={fieldClass}
                type="number"
                min={new Date().getFullYear()}
                placeholder="YYYY"
                value={paymentForm.expYear}
                onChange={(e) => setPaymentForm((f) => ({ ...f, expYear: e.target.value }))}
                disabled={paymentSaving}
                required
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-500"
              checked={paymentForm.isDefault}
              onChange={(e) => setPaymentForm((f) => ({ ...f, isDefault: e.target.checked }))}
              disabled={paymentSaving}
            />
            Set as default payment method
          </label>
        </form>
      </Modal>
    </div>
  )
}

export default SettingsPage
