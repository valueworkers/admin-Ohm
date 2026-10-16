import { useEffect, useState } from 'react'
import { FiLoader, FiPlus, FiTrash2 } from 'react-icons/fi'
import { checkSlugAvailability } from '../api/onboarding'
import { apiErrorMessage } from '../utils/errors'
import Modal from './ui/Modal'
import { btnGhost, btnPrimary, btnSecondary, fieldClass, labelClass } from '../utils/ui'

export const EMPTY_ONBOARD = {
  organization_name: '',
  email: '',
  contact_phone: '',
  address: '',
  ops_admin_email: '',
  slug: '',
  custom_domain: '',
  wants_custom_website: false,
  requested_plan: null,
  branches: [{ name: '', address: '' }],
}

const emptyBranch = () => ({ name: '', address: '' })

const normalizeSlug = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/--+/g, '-')

const OnboardTenantModal = ({ open, onClose, onSubmit, saving }) => {
  const [form, setForm] = useState(EMPTY_ONBOARD)
  const [error, setError] = useState('')
  const [slugStatus, setSlugStatus] = useState({
    checking: false,
    available: null,
    reason: '',
    checkedSlug: '',
  })

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const reset = () => {
    setForm(EMPTY_ONBOARD)
    setError('')
    setSlugStatus({ checking: false, available: null, reason: '', checkedSlug: '' })
  }

  const handleClose = () => {
    if (saving) return
    reset()
    onClose?.()
  }

  useEffect(() => {
    if (!open) return undefined
    const slug = normalizeSlug(form.slug)
    if (!slug) {
      setSlugStatus({ checking: false, available: null, reason: '', checkedSlug: '' })
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
  }, [form.slug, open])

  const setBranchField = (index, key, value) => {
    setForm((prev) => {
      const branches = [...(prev.branches || [])]
      branches[index] = { ...branches[index], [key]: value }
      return { ...prev, branches }
    })
  }

  const addBranch = () => {
    setForm((prev) => ({
      ...prev,
      branches: [...(prev.branches || []), emptyBranch()],
    }))
  }

  const removeBranch = (index) => {
    setForm((prev) => {
      const branches = (prev.branches || []).filter((_, i) => i !== index)
      return { ...prev, branches: branches.length ? branches : [emptyBranch()] }
    })
  }

  const slugReady =
    !form.slug.trim() ||
    (slugStatus.available === true &&
      slugStatus.checkedSlug === normalizeSlug(form.slug) &&
      !slugStatus.checking)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.organization_name.trim()) {
      setError('Organization name is required.')
      return
    }
    if (!form.email.trim()) {
      setError('Owner email is required.')
      return
    }
    if (form.slug.trim()) {
      if (slugStatus.checking) {
        setError('Still checking slug availability…')
        return
      }
      if (slugStatus.available !== true) {
        setError(slugStatus.reason || 'This slug is not available.')
        return
      }
    }
    try {
      await onSubmit?.({ ...form, slug: normalizeSlug(form.slug) })
      reset()
    } catch (err) {
      setError(err?.message || 'Could not create onboarding request.')
    }
  }

  const previewHost = form.slug.trim() ? `${normalizeSlug(form.slug)}.o-hm.com` : ''

  return (
    <Modal
      open={open}
      title="Create tenant"
      onClose={handleClose}
      wide
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={handleClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            form="onboard-tenant-form"
            className={btnPrimary}
            disabled={saving || slugStatus.checking || (Boolean(form.slug.trim()) && !slugReady)}
          >
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      }
    >
      <form id="onboard-tenant-form" className="space-y-4" onSubmit={handleSubmit}>
        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
            {error}
          </p>
        ) : null}

        <p className="text-sm text-stone-600">
          Creates an onboarding request in Lobby. Approve it there to provision the tenant.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="ob-org">
              Organization name <span className="text-rose-600">*</span>
            </label>
            <input
              id="ob-org"
              className={fieldClass}
              value={form.organization_name}
              onChange={(e) => set('organization_name', e.target.value)}
              required
              disabled={saving}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="ob-email">
              Owner email <span className="text-rose-600">*</span>
            </label>
            <input
              id="ob-email"
              type="email"
              className={fieldClass}
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              required
              disabled={saving}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="ob-ops">
              Ops Admin email
            </label>
            <input
              id="ob-ops"
              type="email"
              className={fieldClass}
              value={form.ops_admin_email}
              onChange={(e) => set('ops_admin_email', e.target.value)}
              disabled={saving}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="ob-phone">
              Contact phone
            </label>
            <input
              id="ob-phone"
              className={fieldClass}
              value={form.contact_phone}
              onChange={(e) => set('contact_phone', e.target.value)}
              disabled={saving}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="ob-slug">
              Slug
            </label>
            <input
              id="ob-slug"
              className={fieldClass}
              value={form.slug}
              onChange={(e) => set('slug', normalizeSlug(e.target.value))}
              placeholder="care01"
              disabled={saving}
              autoComplete="off"
              spellCheck={false}
            />
            {previewHost ? (
              <p className="mt-1 text-xs text-stone-500">{previewHost}</p>
            ) : (
              <p className="mt-1 text-xs text-stone-500">Becomes slug.o-hm.com</p>
            )}
            {slugStatus.checking ? (
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-stone-500">
                <FiLoader className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Checking availability…
              </p>
            ) : null}
            {!slugStatus.checking && slugStatus.available === true ? (
              <p className="mt-1 text-xs font-medium text-emerald-700">
                {previewHost} is available
              </p>
            ) : null}
            {!slugStatus.checking && slugStatus.available === false ? (
              <p className="mt-1 text-xs font-medium text-rose-700" role="alert">
                {slugStatus.reason || `${previewHost} is not available`}
              </p>
            ) : null}
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="ob-address">
              Address
            </label>
            <textarea
              id="ob-address"
              className={`${fieldClass} min-h-[72px] resize-y`}
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              disabled={saving}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="ob-domain">
              Custom domain
            </label>
            <input
              id="ob-domain"
              className={fieldClass}
              value={form.custom_domain}
              onChange={(e) => set('custom_domain', e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-stone-300 text-brand-500 focus:ring-brand-500"
                checked={form.wants_custom_website}
                onChange={(e) => set('wants_custom_website', e.target.checked)}
                disabled={saving}
              />
              Wants custom website
            </label>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-stone-900">Branches</p>
            <button type="button" className={btnGhost} onClick={addBranch} disabled={saving}>
              <FiPlus className="h-3.5 w-3.5" aria-hidden />
              Add branch
            </button>
          </div>
          <div className="space-y-2">
            {form.branches.map((branch, index) => (
              <div
                key={`ob-branch-${index}`}
                className="grid gap-2 rounded-lg border border-stone-200 p-3 sm:grid-cols-[1fr_1fr_auto]"
              >
                <div>
                  <label className={labelClass} htmlFor={`ob-branch-name-${index}`}>
                    Name
                  </label>
                  <input
                    id={`ob-branch-name-${index}`}
                    className={fieldClass}
                    value={branch.name}
                    onChange={(e) => setBranchField(index, 'name', e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor={`ob-branch-address-${index}`}>
                    Address
                  </label>
                  <input
                    id={`ob-branch-address-${index}`}
                    className={fieldClass}
                    value={branch.address}
                    onChange={(e) => setBranchField(index, 'address', e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    className={`${btnGhost} text-rose-600`}
                    onClick={() => removeBranch(index)}
                    aria-label="Remove branch"
                    disabled={saving}
                  >
                    <FiTrash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  )
}

export default OnboardTenantModal
