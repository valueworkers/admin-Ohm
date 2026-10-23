import { useEffect, useMemo, useState } from 'react'
import { FiCheck, FiGlobe, FiImage, FiMail, FiPhone, FiSettings } from 'react-icons/fi'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import { useAccess } from '../hooks/useAccess'
import { getPlatformState, updateTenant } from '../store/platformStore'
import { btnPrimary, btnSecondary, fieldClass, labelClass } from '../utils/ui'

const SECTIONS = [
  { id: 'general', label: 'General', icon: FiSettings },
  { id: 'business', label: 'Business info', icon: FiGlobe },
  { id: 'contact', label: 'Contact', icon: FiPhone },
  { id: 'branding', label: 'Branding', icon: FiImage },
  { id: 'notifications', label: 'Notifications', icon: FiMail },
]

const emptySettings = () => ({
  siteName: '',
  siteLanguage: 'en',
  timezone: 'Asia/Kolkata',
  businessName: '',
  legalName: '',
  gstin: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  country: 'India',
  phone: '',
  email: '',
  supportEmail: '',
  logoUrl: '',
  primaryColor: '#F29F67',
  emailNotifications: true,
  smsNotifications: false,
})

const loadTenantSettings = (tenantId) => {
  if (!tenantId) return emptySettings()
  try {
    const state = getPlatformState()
    const tenant = (state.tenants || []).find((t) => String(t.id) === String(tenantId))
    const stored = tenant?.settings?.site || {}
    return { ...emptySettings(), ...stored }
  } catch {
    return emptySettings()
  }
}

const SettingsPage = () => {
  const { tenant, tenantId, canWrite } = useAccess()
  const [section, setSection] = useState('general')
  const [form, setForm] = useState(() => loadTenantSettings(tenantId))
  const [status, setStatus] = useState({ type: '', message: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm(loadTenantSettings(tenantId))
    setStatus({ type: '', message: '' })
  }, [tenantId])

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const sectionTitle = useMemo(
    () => SECTIONS.find((s) => s.id === section)?.label || 'Settings',
    [section],
  )

  const save = () => {
    if (!tenantId || !canWrite) {
      setStatus({ type: 'error', message: 'Select a tenant and ensure you have write access.' })
      return
    }
    setSaving(true)
    setStatus({ type: '', message: '' })
    try {
      const state = getPlatformState()
      const current = (state.tenants || []).find((t) => String(t.id) === String(tenantId))
      updateTenant(tenantId, {
        settings: {
          ...(current?.settings || {}),
          site: { ...form },
        },
        name: form.siteName || form.businessName || current?.name,
      })
      setStatus({ type: 'success', message: 'Settings saved.' })
    } catch {
      setStatus({ type: 'error', message: 'Could not save settings.' })
    } finally {
      setSaving(false)
    }
  }

  const resetSection = () => {
    setForm(loadTenantSettings(tenantId))
    setStatus({ type: '', message: '' })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={tenant?.name || 'Tenant'}
        title="Settings"
        description="Configure site, business, and contact details for this tenant (Wix-style sections)."
      />

      <StatusBanner type={status.type} message={status.message} />

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-stone-200 bg-white p-2">
          <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-stone-400">
            Settings
          </p>
          <nav className="space-y-0.5">
            {SECTIONS.map((s) => {
              const active = section === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSection(s.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors ${
                    active
                      ? 'bg-brand-50 text-brand-800'
                      : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                  }`}
                >
                  <s.icon className="h-4 w-4 shrink-0" aria-hidden />
                  {s.label}
                </button>
              )
            })}
          </nav>
        </aside>

        <section className="rounded-xl border border-stone-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
            <h3 className="text-base font-semibold text-stone-900">{sectionTitle}</h3>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnSecondary} onClick={resetSection} disabled={saving}>
                Discard
              </button>
              <button
                type="button"
                className={btnPrimary}
                onClick={save}
                disabled={saving || !canWrite || !tenantId}
              >
                <FiCheck className="h-4 w-4" aria-hidden />
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>

          <div className="space-y-4 p-4 md:p-5">
            {section === 'general' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className={labelClass}>Site name</span>
                  <input
                    className={fieldClass}
                    value={form.siteName}
                    onChange={(e) => setField('siteName', e.target.value)}
                    disabled={!canWrite}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Language</span>
                  <select
                    className={fieldClass}
                    value={form.siteLanguage}
                    onChange={(e) => setField('siteLanguage', e.target.value)}
                    disabled={!canWrite}
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                  </select>
                </label>
                <label className="block">
                  <span className={labelClass}>Timezone</span>
                  <select
                    className={fieldClass}
                    value={form.timezone}
                    onChange={(e) => setField('timezone', e.target.value)}
                    disabled={!canWrite}
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </label>
              </div>
            ) : null}

            {section === 'business' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className={labelClass}>Business name</span>
                  <input
                    className={fieldClass}
                    value={form.businessName}
                    onChange={(e) => setField('businessName', e.target.value)}
                    disabled={!canWrite}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className={labelClass}>Legal name</span>
                  <input
                    className={fieldClass}
                    value={form.legalName}
                    onChange={(e) => setField('legalName', e.target.value)}
                    disabled={!canWrite}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>GSTIN</span>
                  <input
                    className={fieldClass}
                    value={form.gstin}
                    onChange={(e) => setField('gstin', e.target.value.toUpperCase())}
                    disabled={!canWrite}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Country</span>
                  <input
                    className={fieldClass}
                    value={form.country}
                    onChange={(e) => setField('country', e.target.value)}
                    disabled={!canWrite}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className={labelClass}>Address</span>
                  <textarea
                    className={`${fieldClass} min-h-[80px] resize-y`}
                    value={form.address}
                    onChange={(e) => setField('address', e.target.value)}
                    disabled={!canWrite}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>City</span>
                  <input
                    className={fieldClass}
                    value={form.city}
                    onChange={(e) => setField('city', e.target.value)}
                    disabled={!canWrite}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>State</span>
                  <input
                    className={fieldClass}
                    value={form.state}
                    onChange={(e) => setField('state', e.target.value)}
                    disabled={!canWrite}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Pincode</span>
                  <input
                    className={fieldClass}
                    value={form.pincode}
                    onChange={(e) => setField('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                    disabled={!canWrite}
                    inputMode="numeric"
                  />
                </label>
              </div>
            ) : null}

            {section === 'contact' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>Phone</span>
                  <input
                    className={fieldClass}
                    value={form.phone}
                    onChange={(e) => setField('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    disabled={!canWrite}
                    inputMode="tel"
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Email</span>
                  <input
                    className={fieldClass}
                    type="email"
                    value={form.email}
                    onChange={(e) => setField('email', e.target.value)}
                    disabled={!canWrite}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className={labelClass}>Support email</span>
                  <input
                    className={fieldClass}
                    type="email"
                    value={form.supportEmail}
                    onChange={(e) => setField('supportEmail', e.target.value)}
                    disabled={!canWrite}
                  />
                </label>
              </div>
            ) : null}

            {section === 'branding' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className={labelClass}>Logo URL</span>
                  <input
                    className={fieldClass}
                    value={form.logoUrl}
                    onChange={(e) => setField('logoUrl', e.target.value)}
                    disabled={!canWrite}
                    placeholder="https://…"
                  />
                </label>
                {form.logoUrl ? (
                  <div className="sm:col-span-2">
                    <img
                      src={form.logoUrl}
                      alt="Logo preview"
                      className="h-16 w-16 rounded-lg object-cover ring-1 ring-stone-200"
                    />
                  </div>
                ) : null}
                <label className="block">
                  <span className={labelClass}>Primary color</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      className="h-10 w-12 cursor-pointer rounded-lg border border-stone-300 bg-white p-1"
                      value={form.primaryColor || '#F29F67'}
                      onChange={(e) => setField('primaryColor', e.target.value)}
                      disabled={!canWrite}
                      aria-label="Primary color"
                    />
                    <input
                      className={fieldClass}
                      value={form.primaryColor}
                      onChange={(e) => setField('primaryColor', e.target.value)}
                      disabled={!canWrite}
                    />
                  </div>
                </label>
              </div>
            ) : null}

            {section === 'notifications' ? (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-stone-300 accent-brand-500"
                    checked={form.emailNotifications}
                    onChange={(e) => setField('emailNotifications', e.target.checked)}
                    disabled={!canWrite}
                  />
                  Email notifications
                </label>
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-stone-300 accent-brand-500"
                    checked={form.smsNotifications}
                    onChange={(e) => setField('smsNotifications', e.target.checked)}
                    disabled={!canWrite}
                  />
                  SMS notifications
                </label>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  )
}

export default SettingsPage
