import { useCallback, useEffect, useState } from 'react'
import { FiEdit2, FiLoader, FiPlus, FiRefreshCw } from 'react-icons/fi'
import {
  activateMyTenant,
  fetchMyTenantById,
  fetchMyTenants,
  updateMyTenant,
} from '../api/myTenants'
import { FEATURE_CATALOG } from '../config/features'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/PageState'
import { getAuthUser, persistAuthSession } from '../utils/auth'
import { apiErrorMessage } from '../utils/errors'
import { saveStoredTenants, setSelectedTenantId } from '../utils/tenants'
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  fieldClass,
  labelClass,
  tableHeadClass,
  tableWrapClass,
} from '../utils/ui'

const EMPTY_EDIT = {
  name: '',
  contact_email: '',
  contact_phone: '',
  timezone: '',
  default_currency: '',
  tagsText: '',
  domains: [],
  modules: [],
  subscriptions: [],
}

const moduleKey = (m) => {
  if (m == null) return ''
  if (typeof m === 'string') return m
  return String(m.key || m.name || m.label || m.id || '')
}

const moduleLabel = (key) => {
  const found = FEATURE_CATALOG.find((f) => f.key === key)
  return found?.label || key
}

const tagsToText = (tags) => (Array.isArray(tags) ? tags : []).map(String).filter(Boolean).join(', ')

const parseTags = (value) =>
  String(value || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

const toEditForm = (detail = {}) => ({
  name: detail.name || '',
  contact_email: detail.contact_email || detail.owner_email || '',
  contact_phone: detail.contact_phone || detail.phone || '',
  timezone: detail.timezone || '',
  default_currency: detail.default_currency || '',
  tagsText: tagsToText(detail.tags),
  domains: (Array.isArray(detail.domains) ? detail.domains : []).map((d, i) => ({
    id: d.id ?? `new-${i}`,
    domain: d.domain || '',
    is_primary: Boolean(d.is_primary),
    verified: Boolean(d.verified),
    verified_at: d.verified_at || null,
  })),
  modules: (Array.isArray(detail.modules) ? detail.modules : []).map(moduleKey).filter(Boolean),
  subscriptions: (Array.isArray(detail.subscriptions) ? detail.subscriptions : []).map(
    (s, i) => ({
      id: s.id ?? `sub-${i}`,
      plan: s.plan || s.name || s.plan_name || '',
      status: s.status || '',
      starts_at: s.starts_at || s.start_date || '',
      ends_at: s.ends_at || s.end_date || '',
    }),
  ),
})

const formatDateTime = (value) => {
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

const statusClass = (status) => {
  const s = String(status || '').toLowerCase()
  if (s === 'active') return 'bg-emerald-50 text-emerald-800 ring-emerald-100'
  if (s === 'suspended' || s === 'inactive') return 'bg-amber-50 text-amber-900 ring-amber-100'
  return 'bg-stone-50 text-stone-600 ring-stone-100'
}

const MyTenants = () => {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState({ type: '', message: '' })
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY_EDIT)
  const [saving, setSaving] = useState(false)
  const [activatingId, setActivatingId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await fetchMyTenants()
      saveStoredTenants(list)
      setRows(list)
    } catch (err) {
      setRows([])
      setError(apiErrorMessage(err, 'Could not load your tenants.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openEdit = async (row) => {
    setStatus({ type: '', message: '' })
    setSaving(true)
    try {
      const detail = await fetchMyTenantById(row.id)
      setEditTarget(detail)
      setEditForm(toEditForm(detail))
    } catch (err) {
      setEditTarget(null)
      setStatus({
        type: 'error',
        message: apiErrorMessage(err, 'Could not load tenant details for edit.'),
      })
    } finally {
      setSaving(false)
    }
  }

  const closeEdit = () => {
    if (saving) return
    setEditTarget(null)
    setEditForm(EMPTY_EDIT)
  }

  const setEditField = (key, value) => {
    setEditForm((prev) => ({ ...prev, [key]: value }))
  }

  const updateDomain = (index, patch) => {
    setEditForm((prev) => ({
      ...prev,
      domains: prev.domains.map((d, i) => {
        if (i !== index) {
          return patch.is_primary ? { ...d, is_primary: false } : d
        }
        return { ...d, ...patch }
      }),
    }))
  }

  const addDomain = () => {
    setEditForm((prev) => ({
      ...prev,
      domains: [
        ...prev.domains,
        {
          id: `new-${Date.now()}`,
          domain: '',
          is_primary: prev.domains.length === 0,
          verified: false,
          verified_at: null,
        },
      ],
    }))
  }

  const removeDomain = (index) => {
    setEditForm((prev) => {
      const next = prev.domains.filter((_, i) => i !== index)
      if (next.length && !next.some((d) => d.is_primary)) {
        next[0] = { ...next[0], is_primary: true }
      }
      return { ...prev, domains: next }
    })
  }

  const toggleModule = (key) => {
    setEditForm((prev) => {
      const has = prev.modules.includes(key)
      return {
        ...prev,
        modules: has ? prev.modules.filter((k) => k !== key) : [...prev.modules, key],
      }
    })
  }

  const updateSubscription = (index, patch) => {
    setEditForm((prev) => ({
      ...prev,
      subscriptions: prev.subscriptions.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }))
  }

  const addSubscription = () => {
    setEditForm((prev) => ({
      ...prev,
      subscriptions: [
        ...prev.subscriptions,
        { id: `sub-${Date.now()}`, plan: '', status: '', starts_at: '', ends_at: '' },
      ],
    }))
  }

  const removeSubscription = (index) => {
    setEditForm((prev) => ({
      ...prev,
      subscriptions: prev.subscriptions.filter((_, i) => i !== index),
    }))
  }

  const handleSave = async (event) => {
    event.preventDefault()
    if (!editTarget?.id) return
    const name = editForm.name.trim() || editTarget.name || 'Tenant'
    setSaving(true)
    setStatus({ type: '', message: '' })
    try {
      const payload = {
        name: editForm.name.trim(),
        contact_email: editForm.contact_email.trim(),
        contact_phone: editForm.contact_phone.trim(),
        timezone: editForm.timezone.trim(),
        default_currency: editForm.default_currency.trim(),
        tags: parseTags(editForm.tagsText),
        domains: (editForm.domains || [])
          .map((d) => ({
            ...(d.id != null && !String(d.id).startsWith('new-') ? { id: d.id } : {}),
            domain: String(d.domain || '').trim(),
            is_primary: Boolean(d.is_primary),
            verified: Boolean(d.verified),
          }))
          .filter((d) => d.domain),
        modules: [...(editForm.modules || [])],
        subscriptions: (editForm.subscriptions || [])
          .map((s) => ({
            ...(s.id != null && !String(s.id).startsWith('sub-') ? { id: s.id } : {}),
            plan: String(s.plan || '').trim(),
            status: String(s.status || '').trim(),
            starts_at: String(s.starts_at || '').trim(),
            ends_at: String(s.ends_at || '').trim(),
          }))
          .filter((s) => s.plan || s.status || s.starts_at || s.ends_at),
      }
      const updated = await updateMyTenant(editTarget.id, payload)
      setRows((prev) =>
        prev.map((r) => (String(r.id) === String(editTarget.id) ? { ...r, ...updated } : r)),
      )
      setStatus({ type: 'success', message: `${name} updated.` })
      setEditTarget(null)
      setEditForm(EMPTY_EDIT)
      await load()
    } catch (err) {
      setStatus({
        type: 'error',
        message: apiErrorMessage(err, 'Could not update tenant.'),
      })
    } finally {
      setSaving(false)
    }
  }

  const handleActivate = async (row) => {
    setActivatingId(row.id)
    setStatus({ type: '', message: '' })
    try {
      await activateMyTenant(row.id)
      await load()
      setSelectedTenantId(row.id)
      const user = getAuthUser()
      if (user) {
        const slug = row.schema_name || row.slug || ''
        persistAuthSession({
          user: {
            ...user,
            tenant_id: row.id,
            tenant_slug: slug,
            schema_name: slug,
            organization_name: row.name || user.organization_name || '',
          },
        })
      }
      setStatus({ type: 'success', message: `${row.name || 'Tenant'} activated.` })
    } catch (err) {
      setStatus({
        type: 'error',
        message: apiErrorMessage(err, 'Could not activate tenant.'),
      })
    } finally {
      setActivatingId(null)
    }
  }

  const canActivate = (row) => {
    const s = String(row.status || '').toLowerCase()
    return s !== 'active' && row.is_active !== true
  }

  const extraModuleKeys = editForm.modules.filter(
    (key) => !FEATURE_CATALOG.some((f) => f.key === key),
  )

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Your organization"
        title="My tenants"
        description="View, edit, and activate tenants linked to your owner account."
        actions={
          <button type="button" className={btnGhost} onClick={load} disabled={loading}>
            <FiRefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </button>
        }
      />

      {status.message ? <StatusBanner type={status.type} message={status.message} /> : null}

      {loading ? <LoadingState label="Loading your tenants…" /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState
          title="No tenants yet"
          hint="When your organization is provisioned, it will show up here."
        />
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <div className={tableWrapClass}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-left">Domain</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-stone-100 hover:bg-stone-50/80">
                    <td className="px-4 py-3 font-medium text-stone-900">{row.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ${statusClass(row.status)}`}
                      >
                        {row.status || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      <div>{row.contact_email || '—'}</div>
                      <div className="text-xs text-stone-400">{row.contact_phone || ''}</div>
                    </td>
                    <td className="px-4 py-3 text-stone-600">{row.primary_domain || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          className={btnGhost}
                          onClick={() => openEdit(row)}
                          disabled={saving}
                        >
                          <FiEdit2 className="h-3.5 w-3.5" aria-hidden />
                          Edit
                        </button>
                        {canActivate(row) ? (
                          <button
                            type="button"
                            className={btnPrimary}
                            disabled={activatingId === row.id}
                            onClick={() => handleActivate(row)}
                          >
                            {activatingId === row.id ? (
                              <>
                                <FiLoader className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                Activating…
                              </>
                            ) : (
                              'Activate'
                            )}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <Modal
        open={Boolean(editTarget)}
        title={editTarget ? `Edit tenant · ${editTarget.name}` : 'Edit tenant'}
        onClose={closeEdit}
        xl
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={closeEdit} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="my-edit-tenant-form" className={btnPrimary} disabled={saving}>
              {saving ? (
                <>
                  <FiLoader className="h-4 w-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                'Save changes'
              )}
            </button>
          </div>
        }
      >
        <form id="my-edit-tenant-form" className="space-y-5" onSubmit={handleSave}>
          <section className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">
              Main details
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="my-edit-name">
                  Organization name
                </label>
                <input
                  id="my-edit-name"
                  className={fieldClass}
                  value={editForm.name}
                  required
                  disabled={saving}
                  onChange={(e) => setEditField('name', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="my-edit-email">
                  Contact email
                </label>
                <input
                  id="my-edit-email"
                  type="email"
                  className={fieldClass}
                  value={editForm.contact_email}
                  disabled={saving}
                  onChange={(e) => setEditField('contact_email', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="my-edit-phone">
                  Contact phone
                </label>
                <input
                  id="my-edit-phone"
                  className={fieldClass}
                  value={editForm.contact_phone}
                  disabled={saving}
                  onChange={(e) => setEditField('contact_phone', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="my-edit-timezone">
                  Timezone
                </label>
                <input
                  id="my-edit-timezone"
                  className={fieldClass}
                  value={editForm.timezone}
                  disabled={saving}
                  onChange={(e) => setEditField('timezone', e.target.value)}
                  placeholder="Asia/Kolkata"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="my-edit-currency">
                  Currency
                </label>
                <input
                  id="my-edit-currency"
                  className={fieldClass}
                  value={editForm.default_currency}
                  disabled={saving}
                  onChange={(e) => setEditField('default_currency', e.target.value)}
                  placeholder="INR"
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="my-edit-tags">
                  Tags
                </label>
                <input
                  id="my-edit-tags"
                  className={fieldClass}
                  value={editForm.tagsText}
                  disabled={saving}
                  onChange={(e) => setEditField('tagsText', e.target.value)}
                  placeholder="Comma-separated, e.g. test, care"
                />
              </div>
              {editTarget?.created_at ? (
                <div>
                  <p className={labelClass}>Created</p>
                  <p className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                    {formatDateTime(editTarget.created_at)}
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">
                Domains
              </p>
              <button type="button" className={btnGhost} onClick={addDomain} disabled={saving}>
                <FiPlus className="h-3.5 w-3.5" aria-hidden />
                Add domain
              </button>
            </div>
            {editForm.domains.length === 0 ? (
              <p className="text-sm text-stone-500">No domains on this tenant yet.</p>
            ) : (
              <ul className="space-y-3">
                {editForm.domains.map((d, index) => (
                  <li
                    key={d.id}
                    className="rounded-xl border border-stone-200 bg-stone-50/60 p-3"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className={labelClass} htmlFor={`my-edit-domain-${index}`}>
                          Domain
                        </label>
                        <input
                          id={`my-edit-domain-${index}`}
                          className={fieldClass}
                          value={d.domain}
                          disabled={saving}
                          onChange={(e) => updateDomain(index, { domain: e.target.value })}
                          placeholder="example-clinic.o-hm.com"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm text-stone-700">
                        <input
                          type="checkbox"
                          checked={d.is_primary}
                          disabled={saving}
                          onChange={(e) => updateDomain(index, { is_primary: e.target.checked })}
                        />
                        Primary domain
                      </label>
                      <label className="flex items-center gap-2 text-sm text-stone-700">
                        <input
                          type="checkbox"
                          checked={d.verified}
                          disabled={saving}
                          onChange={(e) => updateDomain(index, { verified: e.target.checked })}
                        />
                        Verified
                      </label>
                      <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-stone-500">
                          Verified at: {formatDateTime(d.verified_at)}
                        </p>
                        <button
                          type="button"
                          className={`${btnGhost} text-rose-600 hover:bg-rose-50`}
                          onClick={() => removeDomain(index)}
                          disabled={saving}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">
              Modules
            </p>
            <div className="flex flex-wrap gap-2">
              {FEATURE_CATALOG.map((f) => {
                const on = editForm.modules.includes(f.key)
                return (
                  <button
                    key={f.key}
                    type="button"
                    disabled={saving}
                    onClick={() => toggleModule(f.key)}
                    className={
                      on
                        ? 'rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-800 ring-1 ring-brand-200'
                        : 'rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-500 ring-1 ring-stone-200 hover:bg-stone-50'
                    }
                    aria-pressed={on}
                  >
                    {f.label}
                  </button>
                )
              })}
              {extraModuleKeys.map((key) => {
                const on = editForm.modules.includes(key)
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={saving}
                    onClick={() => toggleModule(key)}
                    className={
                      on
                        ? 'rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-800 ring-1 ring-brand-200'
                        : 'rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-500 ring-1 ring-stone-200'
                    }
                    aria-pressed={on}
                  >
                    {moduleLabel(key)}
                  </button>
                )
              })}
            </div>
            {editForm.modules.length === 0 ? (
              <p className="text-sm text-stone-500">No modules assigned.</p>
            ) : (
              <p className="text-xs text-stone-500">
                Selected: {editForm.modules.map(moduleLabel).join(', ')}
              </p>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">
                Subscriptions
              </p>
              <button
                type="button"
                className={btnGhost}
                onClick={addSubscription}
                disabled={saving}
              >
                <FiPlus className="h-3.5 w-3.5" aria-hidden />
                Add subscription
              </button>
            </div>
            {editForm.subscriptions.length === 0 ? (
              <p className="text-sm text-stone-500">No subscriptions on this tenant yet.</p>
            ) : (
              <ul className="space-y-3">
                {editForm.subscriptions.map((s, index) => (
                  <li
                    key={s.id}
                    className="rounded-xl border border-stone-200 bg-stone-50/60 p-3"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className={labelClass} htmlFor={`my-edit-sub-plan-${index}`}>
                          Plan
                        </label>
                        <input
                          id={`my-edit-sub-plan-${index}`}
                          className={fieldClass}
                          value={s.plan}
                          disabled={saving}
                          onChange={(e) => updateSubscription(index, { plan: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className={labelClass} htmlFor={`my-edit-sub-status-${index}`}>
                          Status
                        </label>
                        <input
                          id={`my-edit-sub-status-${index}`}
                          className={fieldClass}
                          value={s.status}
                          disabled={saving}
                          onChange={(e) => updateSubscription(index, { status: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className={labelClass} htmlFor={`my-edit-sub-start-${index}`}>
                          Starts
                        </label>
                        <input
                          id={`my-edit-sub-start-${index}`}
                          className={fieldClass}
                          value={s.starts_at}
                          disabled={saving}
                          onChange={(e) =>
                            updateSubscription(index, { starts_at: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className={labelClass} htmlFor={`my-edit-sub-end-${index}`}>
                          Ends
                        </label>
                        <input
                          id={`my-edit-sub-end-${index}`}
                          className={fieldClass}
                          value={s.ends_at}
                          disabled={saving}
                          onChange={(e) => updateSubscription(index, { ends_at: e.target.value })}
                        />
                      </div>
                      <div className="sm:col-span-2 flex justify-end">
                        <button
                          type="button"
                          className={`${btnGhost} text-rose-600 hover:bg-rose-50`}
                          onClick={() => removeSubscription(index)}
                          disabled={saving}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </form>
      </Modal>
    </div>
  )
}

export default MyTenants
