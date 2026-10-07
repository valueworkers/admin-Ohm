import { useRef, useState } from 'react'
import { FiCheck, FiUpload } from 'react-icons/fi'
import Modal from './ui/Modal'
import { btnPrimary, btnSecondary, fieldClass, labelClass } from '../utils/ui'

export const EMPTY_ONBOARD = {
  name: '',
  type: 'Home care',
  domain: '',
  company_code: '',
  logo_url: '',
  city: '',
  address: '',
  phone: '',
  enable_ops_admin: true,
  ops_admin_name: '',
  ops_admin_email: '',
  ops_admin_password: 'tenant123',
  ops_admin_phone: '',
  ops_admin_role_label: 'Ops Admin',
  ops_can_create_vendors: true,
  ops_can_activate_vendors: false,
  employee_offboarding: 'soft_delete',
  employee_signin: 'both',
}

const TENANT_TYPES = ['Home care', 'Clinic', 'Daycare', 'Assisted living', 'Corporate']

const Section = ({ title, hint, children }) => (
  <section className="space-y-3 rounded-xl border border-slate-200 p-4">
    <div>
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
    {children}
  </section>
)

const ToggleRow = ({ checked, onChange, title, description, id }) => (
  <label
    htmlFor={id}
    className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-3"
  >
    <span className="min-w-0">
      <span className="block text-sm font-medium text-slate-900">{title}</span>
      <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
    </span>
    <input
      id={id}
      type="checkbox"
      className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  </label>
)

const SignInOption = ({ value, selected, onSelect, title, description }) => (
  <label
    className={`flex cursor-pointer gap-3 rounded-lg border px-3 py-3 transition-colors ${
      selected === value ? 'border-sky-500 bg-sky-50/60' : 'border-slate-200 hover:bg-slate-50'
    }`}
  >
    <input
      type="radio"
      name="employee_signin"
      className="mt-1 text-sky-600 focus:ring-sky-500"
      checked={selected === value}
      onChange={() => onSelect(value)}
    />
    <span>
      <span className="block text-sm font-medium text-slate-900">{title}</span>
      <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
    </span>
  </label>
)

const OnboardTenantModal = ({ open, onClose, onSubmit, saving }) => {
  const [form, setForm] = useState(EMPTY_ONBOARD)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const reset = () => {
    setForm(EMPTY_ONBOARD)
    setError('')
  }

  const handleClose = () => {
    reset()
    onClose?.()
  }

  const onFile = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Logo must be an image file.')
      return
    }
    if (file.size > 1.5 * 1024 * 1024) {
      setError('Logo must be under 1.5 MB for this demo.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      set('logo_url', String(reader.result || ''))
      setError('')
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) {
      setError('Organization name is required.')
      return
    }
    if (form.enable_ops_admin) {
      if (!form.ops_admin_name.trim() || !form.ops_admin_email.trim() || !form.ops_admin_phone.trim()) {
        setError('Ops admin name, email, and phone are required when Ops Admin is enabled.')
        return
      }
      if (!form.ops_admin_password.trim()) {
        setError('Ops admin password is required.')
        return
      }
    }
    try {
      onSubmit?.(form)
      reset()
    } catch (err) {
      setError(err.message || 'Could not submit.')
    }
  }

  return (
    <Modal
      open={open}
      title="Create tenant"
      onClose={handleClose}
      xl
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={handleClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="onboard-tenant-form" className={btnPrimary} disabled={saving}>
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

        <Section title="Basics" hint="Organization profile shown across the platform.">
          <div>
            <label className={labelClass} htmlFor="ob-name">
              Name <span className="text-rose-600">*</span>
            </label>
            <input
              id="ob-name"
              className={fieldClass}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="ob-type">
                Type
              </label>
              <select
                id="ob-type"
                className={fieldClass}
                value={form.type}
                onChange={(e) => set('type', e.target.value)}
              >
                {TENANT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="ob-domain">
                Domain (optional)
              </label>
              <input
                id="ob-domain"
                className={fieldClass}
                placeholder="vaishnavi.care"
                value={form.domain}
                onChange={(e) => set('domain', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ob-code">
                Company code (optional)
              </label>
              <input
                id="ob-code"
                className={fieldClass}
                value={form.company_code}
                onChange={(e) => set('company_code', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ob-city">
                City
              </label>
              <input
                id="ob-city"
                className={fieldClass}
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="ob-logo">
                Logo (optional)
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  id="ob-logo"
                  className={`${fieldClass} min-w-0 flex-1`}
                  placeholder="Paste image URL or upload"
                  value={form.logo_url.startsWith('data:') ? '' : form.logo_url}
                  onChange={(e) => set('logo_url', e.target.value)}
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => fileRef.current?.click()}
                >
                  <FiUpload className="h-4 w-4" aria-hidden />
                  Upload
                </button>
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-400">
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    'No image'
                  )}
                </div>
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="ob-phone">
                Org phone
              </label>
              <input
                id="ob-phone"
                className={fieldClass}
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="ob-address">
                Address (optional)
              </label>
              <input
                id="ob-address"
                className={fieldClass}
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
              />
            </div>
          </div>
        </Section>

        <Section
          title="Ops Admin"
          hint="Optional. If enabled, this person becomes the tenant’s Ops Admin and can sign in after Lobby approval."
        >
          <ToggleRow
            id="enable-ops"
            checked={form.enable_ops_admin}
            onChange={(v) => set('enable_ops_admin', v)}
            title="Create Ops Admin login"
            description="When off, the tenant is onboarded without a login until you add one later."
          />

          {form.enable_ops_admin ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="ops-name">
                  Ops admin name <span className="text-rose-600">*</span>
                </label>
                <input
                  id="ops-name"
                  className={fieldClass}
                  value={form.ops_admin_name}
                  onChange={(e) => set('ops_admin_name', e.target.value)}
                  required={form.enable_ops_admin}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="ops-email">
                  Ops admin email <span className="text-rose-600">*</span>
                </label>
                <input
                  id="ops-email"
                  type="email"
                  className={fieldClass}
                  value={form.ops_admin_email}
                  onChange={(e) => set('ops_admin_email', e.target.value)}
                  required={form.enable_ops_admin}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="ops-phone">
                  Ops admin phone <span className="text-rose-600">*</span>
                </label>
                <input
                  id="ops-phone"
                  className={fieldClass}
                  value={form.ops_admin_phone}
                  onChange={(e) => set('ops_admin_phone', e.target.value)}
                  required={form.enable_ops_admin}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="ops-pass">
                  Ops admin password <span className="text-rose-600">*</span>
                </label>
                <input
                  id="ops-pass"
                  type="text"
                  className={fieldClass}
                  value={form.ops_admin_password}
                  onChange={(e) => set('ops_admin_password', e.target.value)}
                  required={form.enable_ops_admin}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="ops-role">
                  Role label (optional)
                </label>
                <input
                  id="ops-role"
                  className={fieldClass}
                  placeholder="Ops Admin"
                  value={form.ops_admin_role_label}
                  onChange={(e) => set('ops_admin_role_label', e.target.value)}
                />
              </div>
            </div>
          ) : (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              No login will be created. After approval, only Super Admin can inspect this tenant until
              an Ops Admin is added.
            </p>
          )}
        </Section>

        <Section
          title="Ops vendor controls"
          hint="Super Admin can change this later from tenant settings."
        >
          <div className="space-y-2">
            <ToggleRow
              id="ops-create-vendors"
              checked={form.ops_can_create_vendors}
              onChange={(v) => set('ops_can_create_vendors', v)}
              title="Ops can create vendors"
              description="Allow the tenant Ops Admin to onboard vendors."
            />
            <ToggleRow
              id="ops-activate-vendors"
              checked={form.ops_can_activate_vendors}
              onChange={(v) => set('ops_can_activate_vendors', v)}
              title="Ops can activate vendors"
              description="Allow Ops Admins to activate vendors after document review."
            />
          </div>
        </Section>

        <Section
          title="Employee management"
          hint="Offboarding behavior and how employees will sign in for this tenant."
        >
          <div>
            <label className={labelClass} htmlFor="emp-offboard">
              Employee offboarding
            </label>
            <select
              id="emp-offboard"
              className={fieldClass}
              value={form.employee_offboarding}
              onChange={(e) => set('employee_offboarding', e.target.value)}
            >
              <option value="soft_delete">Soft delete — deactivate account (reversible)</option>
              <option value="hard_delete">Hard delete — remove employee record</option>
              <option value="archive">Archive — keep history, hide from active lists</option>
            </select>
          </div>
          <div className="space-y-2">
            <p className={`${labelClass} mb-0`}>Employee sign-in method</p>
            <SignInOption
              value="email"
              selected={form.employee_signin}
              onSelect={(v) => set('employee_signin', v)}
              title="Email only"
              description="Employees sign in with work email + password."
            />
            <SignInOption
              value="phone"
              selected={form.employee_signin}
              onSelect={(v) => set('employee_signin', v)}
              title="Phone only"
              description="Employees sign in with phone number (OTP or password)."
            />
            <SignInOption
              value="both"
              selected={form.employee_signin}
              onSelect={(v) => set('employee_signin', v)}
              title="Both"
              description="Allow email or phone sign-in for employees."
            />
          </div>
          {form.enable_ops_admin ? (
            <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <FiCheck className="h-3.5 w-3.5 text-sky-600" aria-hidden />
              Ops Admin credentials are stored in demo data (shown on login after approval).
            </p>
          ) : null}
        </Section>
      </form>
    </Modal>
  )
}

export default OnboardTenantModal
