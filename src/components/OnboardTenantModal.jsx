import { useEffect, useMemo, useState } from 'react'
import { FiChevronDown, FiLoader, FiPlus, FiTrash2 } from 'react-icons/fi'
import { checkSlugAvailability } from '../api/onboarding'
import { compressLogo } from '../utils/image'
import { apiErrorMessage } from '../utils/errors'
import Modal from './ui/Modal'
import { btnGhost, btnPrimary, btnSecondary, fieldClass, labelClass } from '../utils/ui'

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const SLUG_RE = /^[a-z0-9-]{3,}$/
const PINCODE_RE = /^\d{6}$/
const PHONE_RE = /^\d{10}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const emptyBranch = () => ({
  name: '',
  addressLine1: '',
  addressLine2: '',
  locality: '',
  city: '',
  pincode: '',
})

const ERP_OPTIONS = [
  'Tally Prime',
  'Zoho',
  'SAP',
  'Microsoft Dynamics 365',
  'ERPNext',
  'Marg',
  'Busy',
  'Oracle NetSuite',
  'Odoo',
  'Sage',
  'Infor',
  'Workday',
  'Epicor',
  'IFS',
  'Acumatica',
  'Ramco',
  'Focus ERP',
  'Others',
  'None',
]

export const EMPTY_ONBOARD = {
  tenantName: '',
  tenantLogo: null,
  email: '',
  phone: '',
  secondaryEmail: '',
  secondaryPhone: '',
  tertiaryEmail: '',
  tertiaryPhone: '',
  gst: '',
  opsAdminEmail: '',
  wantsCoOwners: 'no',
  coOwnerEmails: [''],
  branches: [emptyBranch()],
  existingWebsite: '',
  needWebsite: 'no',
  domain: '',
  slug: '',
  needErp: 'no',
  currentErp: '',
  connectRazorpay: 'no',
  razorpayAccountId: '',
  razorpayKeyId: '',
  requestedPlan: null,
}

const normalizeSlug = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')

const slugFromOrgName = (name) =>
  normalizeSlug(
    String(name || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-'),
  )

const isBranchComplete = (b) =>
  Boolean(
    String(b.name || '').trim() &&
      String(b.addressLine1 || '').trim() &&
      String(b.locality || '').trim() &&
      String(b.city || '').trim() &&
      PINCODE_RE.test(String(b.pincode || '').trim()),
  )

const YesNo = ({ name, value, onChange, disabled }) => (
  <div className="flex gap-4">
    {['yes', 'no'].map((opt) => (
      <label key={opt} className="inline-flex items-center gap-2 text-sm text-slate-700">
        <input
          type="radio"
          name={name}
          value={opt}
          checked={value === opt}
          disabled={disabled}
          onChange={() => onChange(opt)}
          className="accent-brand-500"
        />
        {opt === 'yes' ? 'Yes' : 'No'}
      </label>
    ))}
  </div>
)

const OnboardTenantModal = ({ open, onClose, onSubmit, saving }) => {
  const [form, setForm] = useState(EMPTY_ONBOARD)
  const [error, setError] = useState('')
  const [logoBusy, setLogoBusy] = useState(false)
  const [logoPreview, setLogoPreview] = useState('')
  const [showExtraContacts, setShowExtraContacts] = useState(false)
  const [slugStatus, setSlugStatus] = useState({
    checking: false,
    available: null,
    reason: '',
    checkedSlug: '',
  })

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const derivedSlug = useMemo(() => {
    const typed = normalizeSlug(form.slug)
    if (typed) return typed
    return slugFromOrgName(form.tenantName)
  }, [form.tenantName, form.slug])

  const reset = () => {
    setForm(EMPTY_ONBOARD)
    setError('')
    setLogoBusy(false)
    setLogoPreview('')
    setShowExtraContacts(false)
    setSlugStatus({ checking: false, available: null, reason: '', checkedSlug: '' })
  }

  const handleClose = () => {
    if (saving || logoBusy) return
    reset()
    onClose?.()
  }

  useEffect(() => {
    if (!open) return undefined
    const slug = derivedSlug
    if (!slug || slug.length < 3) {
      setSlugStatus({ checking: false, available: null, reason: '', checkedSlug: '' })
      return undefined
    }
    if (!SLUG_RE.test(slug)) {
      setSlugStatus({
        checking: false,
        available: false,
        reason: 'Use lowercase letters, numbers, and hyphens (min 3).',
        checkedSlug: slug,
      })
      return undefined
    }

    let cancelled = false
    setSlugStatus((prev) => ({ ...prev, checking: true, reason: '' }))
    const timer = window.setTimeout(async () => {
      try {
        const result = await checkSlugAvailability(slug)
        if (cancelled) return
        setSlugStatus({
          checking: false,
          available: result.available,
          reason: result.reason || '',
          checkedSlug: result.slug || slug,
        })
      } catch (err) {
        if (cancelled) return
        setSlugStatus({
          checking: false,
          available: false,
          reason: apiErrorMessage(err, 'Could not check slug availability.'),
          checkedSlug: slug,
        })
      }
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [open, derivedSlug])

  useEffect(() => {
    if (!form.tenantLogo) {
      setLogoPreview('')
      return undefined
    }
    const url = URL.createObjectURL(form.tenantLogo)
    setLogoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [form.tenantLogo])

  const updateBranch = (index, key, value) => {
    setForm((f) => ({
      ...f,
      branches: f.branches.map((b, i) => (i === index ? { ...b, [key]: value } : b)),
    }))
  }

  const addBranch = () => setForm((f) => ({ ...f, branches: [...f.branches, emptyBranch()] }))

  const removeBranch = (index) => {
    setForm((f) => ({
      ...f,
      branches: f.branches.length <= 1 ? f.branches : f.branches.filter((_, i) => i !== index),
    }))
  }

  const updateCoOwner = (index, value) => {
    setForm((f) => ({
      ...f,
      coOwnerEmails: f.coOwnerEmails.map((e, i) => (i === index ? value : e)),
    }))
  }

  const addCoOwner = () => {
    setForm((f) => {
      if (f.coOwnerEmails.length >= 3) return f
      return { ...f, coOwnerEmails: [...f.coOwnerEmails, ''] }
    })
  }

  const removeCoOwner = (index) => {
    setForm((f) => ({
      ...f,
      coOwnerEmails:
        f.coOwnerEmails.length <= 1 ? f.coOwnerEmails : f.coOwnerEmails.filter((_, i) => i !== index),
    }))
  }

  const onLogoChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setLogoBusy(true)
    setError('')
    try {
      const compressed = await compressLogo(file)
      set('tenantLogo', compressed)
    } catch (err) {
      set('tenantLogo', null)
      setError(err?.message || 'Could not process logo.')
    } finally {
      setLogoBusy(false)
    }
  }

  const validate = () => {
    if (!String(form.tenantName || '').trim()) return 'Organization name is required.'
    if (!EMAIL_RE.test(String(form.email || '').trim())) return 'Enter a valid email.'
    if (!PHONE_RE.test(String(form.phone || '').trim())) return 'Phone must be 10 digits.'

    const secondaryEmail = String(form.secondaryEmail || '').trim()
    const secondaryPhone = String(form.secondaryPhone || '').trim()
    const tertiaryEmail = String(form.tertiaryEmail || '').trim()
    const tertiaryPhone = String(form.tertiaryPhone || '').trim()
    if (secondaryEmail && !EMAIL_RE.test(secondaryEmail)) {
      return 'Enter a valid secondary contact email (or leave blank).'
    }
    if (secondaryPhone && !PHONE_RE.test(secondaryPhone)) {
      return 'Secondary phone must be 10 digits (or leave blank).'
    }
    if (tertiaryEmail && !EMAIL_RE.test(tertiaryEmail)) {
      return 'Enter a valid tertiary contact email (or leave blank).'
    }
    if (tertiaryPhone && !PHONE_RE.test(tertiaryPhone)) {
      return 'Tertiary phone must be 10 digits (or leave blank).'
    }

    const opsAdmin = String(form.opsAdminEmail || '').trim()
    if (opsAdmin && !EMAIL_RE.test(opsAdmin)) return 'Enter a valid ops admin email.'

    const gst = String(form.gst || '').trim().toUpperCase()
    if (gst && !GSTIN_RE.test(gst)) return 'Enter a valid GSTIN (or leave blank).'

    if (form.wantsCoOwners === 'yes') {
      const emails = form.coOwnerEmails.map((e) => String(e || '').trim()).filter(Boolean)
      if (!emails.length) return 'Add at least one co-owner email, or choose No.'
      if (emails.length > 3) return 'Maximum 3 co-owner emails.'
      if (emails.some((e) => !EMAIL_RE.test(e))) return 'Co-owner emails must be valid.'
    }

    if (!form.branches.some(isBranchComplete)) {
      return 'Add at least one complete branch (name, address line 1, locality, city, 6-digit pincode).'
    }
    if (form.branches.some((b) => String(b.pincode || '').trim() && !PINCODE_RE.test(String(b.pincode).trim()))) {
      return 'Pincode must be 6 digits.'
    }

    const slug = derivedSlug
    if (!SLUG_RE.test(slug)) return 'Slug must be at least 3 characters (a-z, 0-9, hyphen).'
    if (slugStatus.checking) return 'Still checking slug availability…'
    if (slugStatus.available === false) {
      return slugStatus.reason || 'This slug is not available.'
    }
    if (slugStatus.checkedSlug !== slug || slugStatus.available !== true) {
      return 'Wait for slug availability to confirm.'
    }

    if (form.needWebsite === 'yes' && !String(form.domain || '').trim()) {
      return 'Enter the customized website / domain.'
    }

    const erp = String(form.currentErp || '').trim()
    if (!erp || erp === 'Others') {
      return 'Select an existing ERP (or choose Others and enter the name).'
    }

    if (form.connectRazorpay === 'yes') {
      if (!String(form.razorpayAccountId || '').trim()) {
        return 'Enter the Razorpay account ID to connect.'
      }
      if (!String(form.razorpayKeyId || '').trim()) {
        return 'Enter the Razorpay key ID to connect.'
      }
    }

    return ''
  }

  const buildFormData = () => {
    const gst = String(form.gst || '').trim().toUpperCase()
    const slug = derivedSlug
    const branches = form.branches.filter(isBranchComplete).map((b) => ({
      name: String(b.name || '').trim(),
      line1: String(b.addressLine1 || '').trim(),
      line2: String(b.addressLine2 || '').trim(),
      locality: String(b.locality || '').trim(),
      city: String(b.city || '').trim(),
      pincode: String(b.pincode || '').trim(),
    }))

    const coOwnerEmails =
      form.wantsCoOwners === 'yes'
        ? form.coOwnerEmails.map((e) => String(e || '').trim()).filter(Boolean).slice(0, 3)
        : null

    const fd = new FormData()
    fd.append('organization_name', String(form.tenantName || '').trim())
    fd.append('email', String(form.email || '').trim())
    fd.append('contact_phone', String(form.phone || '').trim())
    fd.append('secondary_contact_email', String(form.secondaryEmail || '').trim())
    fd.append('secondary_contact_phone', String(form.secondaryPhone || '').trim())
    fd.append('tertiary_contact_email', String(form.tertiaryEmail || '').trim())
    fd.append('tertiary_contact_phone', String(form.tertiaryPhone || '').trim())
    fd.append('gst_number', gst)
    fd.append('branches', JSON.stringify(branches))
    fd.append('ops_admin_email', String(form.opsAdminEmail || '').trim())
    // JSON array string, e.g. ["test@test.com"] — empty → null
    fd.append(
      'co_owner_emails',
      coOwnerEmails?.length ? JSON.stringify(coOwnerEmails) : 'null',
    )
    fd.append('slug', slug)
    const wantsCustom = form.needWebsite === 'yes'
    const existingWebsite = wantsCustom ? '' : String(form.existingWebsite || '').trim()
    const customDomain = wantsCustom ? String(form.domain || '').trim() : ''
    fd.append('existing_website', existingWebsite)
    fd.append('domain', customDomain || existingWebsite)
    fd.append('custom_domain', customDomain)
    fd.append('needs_website', wantsCustom ? 'true' : 'false')
    fd.append('wants_custom_website', wantsCustom ? 'true' : 'false')
    fd.append('needs_erp', form.needErp === 'yes' ? 'true' : 'false')
    fd.append('current_erp', String(form.currentErp || '').trim())
    const connectRazorpay = form.connectRazorpay === 'yes'
    fd.append('connect_razorpay', connectRazorpay ? 'true' : 'false')
    fd.append(
      'razorpay_account_id',
      connectRazorpay ? String(form.razorpayAccountId || '').trim() : '',
    )
    fd.append(
      'razorpay_key_id',
      connectRazorpay ? String(form.razorpayKeyId || '').trim() : '',
    )
    fd.append('requested_plan', form.requestedPlan != null ? String(form.requestedPlan) : '')
    if (form.tenantLogo) fd.append('logo', form.tenantLogo)
    return fd
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const message = validate()
    if (message) {
      setError(message)
      return
    }
    setError('')
    try {
      const formData = buildFormData()
      await onSubmit?.(formData, {
        organization_name: String(form.tenantName || '').trim(),
      })
      reset()
    } catch (err) {
      setError(err?.message || 'Could not create tenant request.')
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Create tenant" xl>
      <form className="space-y-5" onSubmit={handleSubmit}>
        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
            {error}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={labelClass}>Organization name</span>
            <input
              className={fieldClass}
              value={form.tenantName}
              onChange={(e) => set('tenantName', e.target.value)}
              disabled={saving}
              required
              autoFocus
            />
          </label>

          <label className="block sm:col-span-2">
            <span className={labelClass}>Logo (optional)</span>
            <input
              type="file"
              accept="image/*"
              className={`${fieldClass} file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm`}
              onChange={onLogoChange}
              disabled={saving || logoBusy}
            />
            <span className="mt-1 block text-xs text-slate-500">
              Compressed to max 800×800, ~200KB before upload.
            </span>
            {logoBusy ? (
              <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500">
                <FiLoader className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Compressing…
              </span>
            ) : null}
            {logoPreview ? (
              <div className="mt-2 flex items-center gap-3">
                <img src={logoPreview} alt="" className="h-14 w-14 rounded-lg border border-stone-200 object-cover" />
                <button
                  type="button"
                  className={btnGhost}
                  disabled={saving || logoBusy}
                  onClick={() => set('tenantLogo', null)}
                >
                  Remove
                </button>
              </div>
            ) : null}
          </label>

          <label className="block">
            <span className={labelClass}>Email</span>
            <input
              type="email"
              className={fieldClass}
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              disabled={saving}
              required
            />
          </label>

          <label className="block">
            <span className={labelClass}>Phone</span>
            <input
              className={fieldClass}
              value={form.phone}
              onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
              disabled={saving}
              required
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit mobile"
            />
          </label>

          <div className="sm:col-span-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
              onClick={() => setShowExtraContacts((v) => !v)}
              disabled={saving}
              aria-expanded={showExtraContacts}
            >
              <FiChevronDown
                className={`h-4 w-4 transition-transform ${showExtraContacts ? 'rotate-180' : ''}`}
                aria-hidden
              />
              {showExtraContacts
                ? 'Hide secondary & tertiary contacts'
                : 'Secondary & tertiary contacts (optional)'}
            </button>
          </div>

          {showExtraContacts ? (
            <>
              <label className="block">
                <span className={labelClass}>Secondary contact email</span>
                <input
                  type="email"
                  className={fieldClass}
                  value={form.secondaryEmail}
                  onChange={(e) => set('secondaryEmail', e.target.value)}
                  disabled={saving}
                  placeholder="secondary@example.com"
                  autoComplete="email"
                />
              </label>

              <label className="block">
                <span className={labelClass}>Secondary contact phone</span>
                <input
                  className={fieldClass}
                  value={form.secondaryPhone}
                  onChange={(e) =>
                    set('secondaryPhone', e.target.value.replace(/\D/g, '').slice(0, 10))
                  }
                  disabled={saving}
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10-digit mobile"
                />
              </label>

              <label className="block">
                <span className={labelClass}>Tertiary contact email</span>
                <input
                  type="email"
                  className={fieldClass}
                  value={form.tertiaryEmail}
                  onChange={(e) => set('tertiaryEmail', e.target.value)}
                  disabled={saving}
                  placeholder="tertiary@example.com"
                  autoComplete="email"
                />
              </label>

              <label className="block">
                <span className={labelClass}>Tertiary contact phone</span>
                <input
                  className={fieldClass}
                  value={form.tertiaryPhone}
                  onChange={(e) =>
                    set('tertiaryPhone', e.target.value.replace(/\D/g, '').slice(0, 10))
                  }
                  disabled={saving}
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10-digit mobile"
                />
              </label>
            </>
          ) : null}

          <label className="block">
            <span className={labelClass}>Ops admin email (optional)</span>
            <input
              type="email"
              className={fieldClass}
              value={form.opsAdminEmail}
              onChange={(e) => set('opsAdminEmail', e.target.value)}
              disabled={saving}
              placeholder="ops@example.com"
            />
          </label>

          <label className="block">
            <span className={labelClass}>GSTIN (optional)</span>
            <input
              className={fieldClass}
              value={form.gst}
              onChange={(e) => set('gst', e.target.value.toUpperCase())}
              disabled={saving}
              placeholder="22AAAAA0000A1Z5"
              autoCapitalize="characters"
            />
          </label>
        </div>

        <div className="space-y-3 rounded-xl border border-stone-200 p-4">
          <div>
            <p className={labelClass}>Co-owners?</p>
            <YesNo
              name="wantsCoOwners"
              value={form.wantsCoOwners}
              onChange={(v) => set('wantsCoOwners', v)}
              disabled={saving}
            />
          </div>
          {form.wantsCoOwners === 'yes' ? (
            <div className="space-y-2">
              {form.coOwnerEmails.map((email, index) => (
                <div key={`co-${index}`} className="flex gap-2">
                  <input
                    type="email"
                    className={fieldClass}
                    value={email}
                    onChange={(e) => updateCoOwner(index, e.target.value)}
                    disabled={saving}
                    placeholder={`Co-owner email ${index + 1}`}
                  />
                  <button
                    type="button"
                    className={btnGhost}
                    disabled={saving || form.coOwnerEmails.length <= 1}
                    onClick={() => removeCoOwner(index)}
                    aria-label="Remove co-owner"
                  >
                    <FiTrash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {form.coOwnerEmails.length < 3 ? (
                <button type="button" className={btnGhost} disabled={saving} onClick={addCoOwner}>
                  <FiPlus className="h-4 w-4" />
                  Add co-owner
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Branches <span className="text-rose-600">*</span>
              </p>
              <p className="text-xs text-stone-500">At least one complete branch is required.</p>
            </div>
            <button type="button" className={btnGhost} disabled={saving} onClick={addBranch}>
              <FiPlus className="h-4 w-4" />
              Add branch
            </button>
          </div>
          {form.branches.map((branch, index) => (
            <div key={`branch-${index}`} className="space-y-3 rounded-xl border border-stone-200 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Branch {index + 1}
                </p>
                <button
                  type="button"
                  className={btnGhost}
                  disabled={saving || form.branches.length <= 1}
                  onClick={() => removeBranch(index)}
                  aria-label={`Remove branch ${index + 1}`}
                >
                  <FiTrash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className={labelClass}>
                    Name <span className="text-rose-600">*</span>
                  </span>
                  <input
                    className={fieldClass}
                    value={branch.name}
                    onChange={(e) => updateBranch(index, 'name', e.target.value)}
                    disabled={saving}
                    required={index === 0}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className={labelClass}>
                    Address line 1 <span className="text-rose-600">*</span>
                  </span>
                  <input
                    className={fieldClass}
                    value={branch.addressLine1}
                    onChange={(e) => updateBranch(index, 'addressLine1', e.target.value)}
                    disabled={saving}
                    required={index === 0}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className={labelClass}>Address line 2</span>
                  <input
                    className={fieldClass}
                    value={branch.addressLine2}
                    onChange={(e) => updateBranch(index, 'addressLine2', e.target.value)}
                    disabled={saving}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>
                    Locality <span className="text-rose-600">*</span>
                  </span>
                  <input
                    className={fieldClass}
                    value={branch.locality}
                    onChange={(e) => updateBranch(index, 'locality', e.target.value)}
                    disabled={saving}
                    required={index === 0}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>
                    City <span className="text-rose-600">*</span>
                  </span>
                  <input
                    className={fieldClass}
                    value={branch.city}
                    onChange={(e) => updateBranch(index, 'city', e.target.value)}
                    disabled={saving}
                    required={index === 0}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>
                    Pincode <span className="text-rose-600">*</span>
                  </span>
                  <input
                    className={fieldClass}
                    value={branch.pincode}
                    onChange={(e) =>
                      updateBranch(index, 'pincode', e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    disabled={saving}
                    inputMode="numeric"
                    maxLength={6}
                    required={index === 0}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4 rounded-xl border border-stone-200 p-4">
          <p className="text-sm font-semibold text-ink">Website &amp; ERP</p>

          <div className="grid gap-4 sm:grid-cols-2">
            {form.needWebsite === 'yes' ? (
              <label className="block sm:col-span-2">
                <span className={labelClass}>
                  Customized website / domain <span className="text-rose-600">*</span>
                </span>
                <input
                  className={fieldClass}
                  value={form.domain}
                  onChange={(e) => set('domain', e.target.value)}
                  disabled={saving}
                  placeholder="care.example.com"
                  autoComplete="url"
                  required
                />
                <span className="mt-1 block text-xs text-stone-500">
                  Domain for the new customized website.
                </span>
              </label>
            ) : (
              <label className="block sm:col-span-2">
                <span className={labelClass}>Existing website / domain (optional)</span>
                <input
                  className={fieldClass}
                  value={form.existingWebsite}
                  onChange={(e) => set('existingWebsite', e.target.value)}
                  disabled={saving}
                  placeholder="https://www.example.com"
                  autoComplete="url"
                />
                <span className="mt-1 block text-xs text-stone-500">
                  Leave blank if they do not have a website yet.
                </span>
              </label>
            )}

            <div>
              <p className={labelClass}>Do you need a customized website?</p>
              <YesNo
                name="needWebsite"
                value={form.needWebsite}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    needWebsite: v,
                    domain: v === 'yes' ? f.domain : '',
                  }))
                }
                disabled={saving}
              />
            </div>

            <label className="block">
              <span className={labelClass}>Free subdomain (slug)</span>
              <input
                className={fieldClass}
                value={form.slug}
                onChange={(e) => set('slug', normalizeSlug(e.target.value))}
                disabled={saving}
                placeholder="vaishnavi-medicare"
              />
              <p className="mt-1 text-xs text-slate-500">
                Slug used:{' '}
                <span className="font-medium text-slate-700">{derivedSlug || '—'}</span>
                {!form.slug ? ' (from organization name if left blank)' : ''}
              </p>
              {derivedSlug.length >= 3 ? (
                <p
                  className={`mt-1 text-xs ${
                    slugStatus.checking
                      ? 'text-slate-500'
                      : slugStatus.available
                        ? 'text-emerald-700'
                        : slugStatus.available === false
                          ? 'text-rose-600'
                          : 'text-slate-500'
                  }`}
                >
                  {slugStatus.checking
                    ? 'Checking availability…'
                    : slugStatus.available
                      ? 'Slug is available.'
                      : slugStatus.reason || 'Slug not available.'}
                </p>
              ) : null}
            </label>

            <div>
              <p className={labelClass}>Do you need ERP?</p>
              <YesNo
                name="needErp"
                value={form.needErp}
                onChange={(v) => set('needErp', v)}
                disabled={saving}
              />
            </div>

            <label className="block">
              <span className={labelClass}>
                Existing ERP <span className="text-rose-600">*</span>
              </span>
              <select
                className={fieldClass}
                value={
                  !form.currentErp
                    ? ''
                    : ERP_OPTIONS.includes(form.currentErp)
                      ? form.currentErp
                      : 'Others'
                }
                onChange={(e) => set('currentErp', e.target.value)}
                disabled={saving}
                required
              >
                <option value="">Select ERP</option>
                {ERP_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {form.currentErp === 'Others' ||
              (form.currentErp && !ERP_OPTIONS.includes(form.currentErp)) ? (
                <input
                  className={`${fieldClass} mt-2`}
                  value={form.currentErp === 'Others' ? '' : form.currentErp}
                  onChange={(e) => set('currentErp', e.target.value.trim() || 'Others')}
                  disabled={saving}
                  placeholder="Enter ERP name"
                  aria-label="Other ERP name"
                />
              ) : null}
            </label>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-stone-200 p-4">
          <p className="text-sm font-semibold text-ink">Razorpay</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className={labelClass}>Connect Razorpay account?</p>
              <YesNo
                name="connectRazorpay"
                value={form.connectRazorpay}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    connectRazorpay: v,
                    razorpayAccountId: v === 'yes' ? f.razorpayAccountId : '',
                    razorpayKeyId: v === 'yes' ? f.razorpayKeyId : '',
                  }))
                }
                disabled={saving}
              />
            </div>
            {form.connectRazorpay === 'yes' ? (
              <>
                <label className="block">
                  <span className={labelClass}>
                    Razorpay account ID <span className="text-rose-600">*</span>
                  </span>
                  <input
                    className={fieldClass}
                    value={form.razorpayAccountId}
                    onChange={(e) => set('razorpayAccountId', e.target.value.trim())}
                    disabled={saving}
                    placeholder="acc_xxxxxxxx"
                    required
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>
                    Razorpay key ID <span className="text-rose-600">*</span>
                  </span>
                  <input
                    className={fieldClass}
                    value={form.razorpayKeyId}
                    onChange={(e) => set('razorpayKeyId', e.target.value.trim())}
                    disabled={saving}
                    placeholder="rzp_live_xxxxxxxx or rzp_test_xxxxxxxx"
                    required
                  />
                  <span className="mt-1 block text-xs text-stone-500">
                    Key ID only — never paste the Key Secret in this form.
                  </span>
                </label>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-stone-100 pt-4 sm:flex-row sm:justify-end">
          <button type="button" className={btnSecondary} onClick={handleClose} disabled={saving || logoBusy}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={saving || logoBusy || slugStatus.checking}>
            {saving ? (
              <>
                <FiLoader className="h-4 w-4 animate-spin" aria-hidden />
                Sending…
              </>
            ) : (
              'Send to Lobby'
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default OnboardTenantModal
