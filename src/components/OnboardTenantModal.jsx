import { useEffect, useMemo, useState } from 'react'
import { FiLoader, FiPlus, FiTrash2 } from 'react-icons/fi'
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

export const EMPTY_ONBOARD = {
  tenantName: '',
  tenantLogo: null,
  email: '',
  phone: '',
  gst: '',
  wantsCoOwners: 'no',
  coOwnerEmails: [''],
  branches: [emptyBranch()],
  hasDomain: 'no',
  customDomain: '',
  slug: '',
  customizeWebsite: 'no',
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

const joinAddress = (branch) =>
  [branch.addressLine1, branch.addressLine2, branch.locality, branch.city, branch.pincode]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .join(', ')

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
  const [slugStatus, setSlugStatus] = useState({
    checking: false,
    available: null,
    reason: '',
    checkedSlug: '',
  })

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const derivedSlug = useMemo(() => {
    if (form.hasDomain === 'yes') return slugFromOrgName(form.tenantName)
    return normalizeSlug(form.slug)
  }, [form.hasDomain, form.tenantName, form.slug])

  const reset = () => {
    setForm(EMPTY_ONBOARD)
    setError('')
    setLogoBusy(false)
    setLogoPreview('')
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

    if (form.hasDomain === 'yes' && !String(form.customDomain || '').trim()) {
      return 'Custom domain is required when you have a domain.'
    }

    return ''
  }

  const buildFormData = () => {
    const gst = String(form.gst || '').trim().toUpperCase()
    const slug = derivedSlug
    const branches = form.branches.filter(isBranchComplete).map((b) => ({
      name: String(b.name || '').trim(),
      address_line_1: String(b.addressLine1 || '').trim(),
      address_line_2: String(b.addressLine2 || '').trim(),
      locality: String(b.locality || '').trim(),
      city: String(b.city || '').trim(),
      pincode: String(b.pincode || '').trim(),
      address: joinAddress(b),
    }))

    const coOwnerEmails =
      form.wantsCoOwners === 'yes'
        ? form.coOwnerEmails.map((e) => String(e || '').trim()).filter(Boolean).slice(0, 3)
        : []

    const fd = new FormData()
    fd.append('organization_name', String(form.tenantName || '').trim())
    fd.append('email', String(form.email || '').trim())
    fd.append('contact_phone', String(form.phone || '').trim())
    if (gst) fd.append('gst_number', gst)
    fd.append('branches', JSON.stringify(branches))
    fd.append('co_owner_emails', JSON.stringify(coOwnerEmails))
    fd.append('slug', slug)
    fd.append(
      'custom_domain',
      form.hasDomain === 'yes' ? String(form.customDomain || '').trim() : '',
    )
    fd.append('wants_custom_website', form.customizeWebsite === 'yes' ? 'true' : 'false')
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

          <label className="block sm:col-span-2">
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
            <p className="text-sm font-semibold text-slate-900">Branches</p>
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
                  <span className={labelClass}>Name</span>
                  <input
                    className={fieldClass}
                    value={branch.name}
                    onChange={(e) => updateBranch(index, 'name', e.target.value)}
                    disabled={saving}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className={labelClass}>Address line 1</span>
                  <input
                    className={fieldClass}
                    value={branch.addressLine1}
                    onChange={(e) => updateBranch(index, 'addressLine1', e.target.value)}
                    disabled={saving}
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
                  <span className={labelClass}>Locality</span>
                  <input
                    className={fieldClass}
                    value={branch.locality}
                    onChange={(e) => updateBranch(index, 'locality', e.target.value)}
                    disabled={saving}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>City</span>
                  <input
                    className={fieldClass}
                    value={branch.city}
                    onChange={(e) => updateBranch(index, 'city', e.target.value)}
                    disabled={saving}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Pincode</span>
                  <input
                    className={fieldClass}
                    value={branch.pincode}
                    onChange={(e) =>
                      updateBranch(index, 'pincode', e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    disabled={saving}
                    inputMode="numeric"
                    maxLength={6}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3 rounded-xl border border-stone-200 p-4">
          <div>
            <p className={labelClass}>Have a custom domain?</p>
            <YesNo
              name="hasDomain"
              value={form.hasDomain}
              onChange={(v) => set('hasDomain', v)}
              disabled={saving}
            />
          </div>

          {form.hasDomain === 'yes' ? (
            <label className="block">
              <span className={labelClass}>Custom domain</span>
              <input
                className={fieldClass}
                value={form.customDomain}
                onChange={(e) => set('customDomain', e.target.value)}
                disabled={saving}
                placeholder="care.example.com"
              />
            </label>
          ) : (
            <label className="block">
              <span className={labelClass}>Free subdomain (slug)</span>
              <input
                className={fieldClass}
                value={form.slug}
                onChange={(e) => set('slug', normalizeSlug(e.target.value))}
                disabled={saving}
                placeholder="vaishnavi-medicare"
              />
            </label>
          )}

          <div>
            <p className="text-xs text-slate-500">
              Slug used: <span className="font-medium text-slate-700">{derivedSlug || '—'}</span>
              {form.hasDomain === 'yes' ? ' (derived from organization name)' : ''}
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
          </div>

          <div>
            <p className={labelClass}>Customize website?</p>
            <YesNo
              name="customizeWebsite"
              value={form.customizeWebsite}
              onChange={(v) => set('customizeWebsite', v)}
              disabled={saving}
            />
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
