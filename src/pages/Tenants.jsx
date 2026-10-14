import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiEdit2, FiEye, FiLoader, FiPlus, FiRefreshCw, FiTrash2 } from 'react-icons/fi'
import { fetchTenantById, fetchTenants, suspendTenant, updateTenantById } from '../api/tenants'
import { FEATURE_CATALOG } from '../config/features'
import { saveStoredTenants } from '../utils/tenants'
import OnboardTenantModal from '../components/OnboardTenantModal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/PageState'
import { onboardTenant } from '../store/platformStore'
import { apiErrorMessage } from '../utils/errors'
import { clearSelectedTenant, getSelectedTenantId } from '../utils/tenants'
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
  schema_name: '',
  status: '',
  owner: '',
  contact_email: '',
  contact_phone: '',
  timezone: '',
  default_currency: '',
  label: '',
  tag: '',
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

const toEditForm = (detail = {}) => ({
  name: detail.name || '',
  schema_name: detail.schema_name || '',
  status: detail.status || '',
  owner: detail.owner != null ? String(detail.owner) : '',
  contact_email: detail.contact_email || '',
  contact_phone: detail.contact_phone || '',
  timezone: detail.timezone || '',
  default_currency: detail.default_currency || '',
  label: detail.label || '',
  tag: detail.tag || '',
  domains: (Array.isArray(detail.domains) ? detail.domains : []).map((d, i) => ({
    id: d.id ?? `new-${i}`,
    domain: d.domain || '',
    is_primary: Boolean(d.is_primary),
    verified: Boolean(d.verified),
    verified_at: d.verified_at || null,
  })),
  modules: (Array.isArray(detail.modules) ? detail.modules : [])
    .map(moduleKey)
    .filter(Boolean),
  subscriptions: (Array.isArray(detail.subscriptions) ? detail.subscriptions : []).map(
    (s, i) => ({
      id: s.id ?? `sub-${i}`,
      plan: s.plan || s.name || s.plan_name || '',
      status: s.status || '',
      starts_at: s.starts_at || s.start_date || '',
      ends_at: s.ends_at || s.end_date || '',
    })
  ),
})

const statusChip = (status) => {
  const s = String(status || '').toLowerCase()
  if (s === 'active' || s === 'ready') {
    return 'rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800'
  }
  if (s === 'provisioning' || s === 'pending') {
    return 'rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900'
  }
  if (s === 'failed' || s === 'suspended' || s === 'offboarded') {
    return 'rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-800'
  }
  return 'rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600'
}

const formatDate = (value) => {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('en-IN')
  } catch {
    return '—'
  }
}

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

const Tenants = () => {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState({ type: '', message: '' })
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY_EDIT)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await fetchTenants()
      setRows(list)
      saveStoredTenants(list)
    } catch (err) {
      setRows([])
      setError(apiErrorMessage(err, 'Could not load tenants.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const name = deleteTarget.name || 'Tenant'
    setSaving(true)
    setStatus({ type: '', message: '' })
    try {
      await suspendTenant(deleteTarget.id)
      if (getSelectedTenantId() === String(deleteTarget.id)) clearSelectedTenant()
      setStatus({ type: 'success', message: `${name} suspended.` })
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setStatus({
        type: 'error',
        message: apiErrorMessage(err, 'Could not suspend tenant.'),
      })
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = (form) => {
    setSaving(true)
    try {
      const { tenant } = onboardTenant(form)
      setStatus({
        type: 'success',
        message: tenant.has_ops_admin
          ? `${tenant.name} sent to Lobby with Ops Admin ${tenant.owner_email}. Approve it there to activate.`
          : `${tenant.name} sent to Lobby (no Ops Admin). Approve it there to activate.`,
      })
      setModalOpen(false)
    } catch (err) {
      setSaving(false)
      throw err
    }
    setSaving(false)
  }

  const openEdit = async (row) => {
    setStatus({ type: '', message: '' })
    setSaving(true)
    try {
      const detail = await fetchTenantById(row.id)
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

  const saveEdit = async (event) => {
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
        label: editForm.label.trim(),
        tag: editForm.tag.trim(),
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
      const updated = await updateTenantById(editTarget.id, payload)
      setStatus({ type: 'success', message: `${name} updated.` })
      setRows((prev) =>
        prev.map((r) =>
          String(r.id) === String(editTarget.id) ? { ...r, ...updated } : r
        )
      )
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

  const extraModuleKeys = editForm.modules.filter(
    (key) => !FEATURE_CATALOG.some((f) => f.key === key)
  )

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Manage Tenants"
        title="Tenants"
        description="Organizations from the care platform."
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} onClick={load} disabled={loading}>
              <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
              Refresh
            </button>
            <button type="button" className={btnPrimary} onClick={() => setModalOpen(true)}>
              <FiPlus className="h-4 w-4" aria-hidden />
              Create tenant
            </button>
            <Link to="/lobby" className={btnSecondary}>
              Go to Lobby
            </Link>
            <Link to="/tenants/offboarded" className={btnSecondary}>
              Offboarded
            </Link>
          </div>
        }
      />

      <StatusBanner type={status.type} message={status.message} />

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <div className={tableWrapClass}>
          {loading ? (
            <LoadingState label="Loading tenants…" />
          ) : rows.length === 0 ? (
            <EmptyState
              bare
              title="No tenants"
              hint="No tenants returned from the API yet."
              actionLabel="Refresh"
              onAction={load}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className={tableHeadClass}>
                  <tr>
                    <th className="px-4 py-3">Tenant</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Domain</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-stone-50 text-[10px] text-stone-400">
                            {row.logo ? (
                              <img src={row.logo} alt="" className="h-full w-full object-cover" />
                            ) : (
                              'Logo'
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-stone-900">{row.name}</p>
                            <p className="truncate text-xs text-stone-400">
                              {row.schema_name || '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-stone-600">
                        <div>{row.contact_email || '—'}</div>
                        <div className="text-xs text-stone-400">{row.contact_phone || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-stone-600">
                        {row.primary_domain || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={statusChip(row.status)}>{row.status || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-stone-600">{formatDate(row.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Link to={`/tenants/${row.id}`} className={btnGhost}>
                            <FiEye className="h-3.5 w-3.5" aria-hidden />
                            View
                          </Link>
                          <button type="button" className={btnGhost} onClick={() => openEdit(row)}>
                            <FiEdit2 className="h-3.5 w-3.5" aria-hidden />
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`${btnGhost} text-rose-600 hover:bg-rose-50`}
                            onClick={() => setDeleteTarget(row)}
                          >
                            <FiTrash2 className="h-3.5 w-3.5" aria-hidden />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <OnboardTenantModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        saving={saving}
      />

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
            <button type="submit" form="edit-tenant-form" className={btnPrimary} disabled={saving}>
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
        <form id="edit-tenant-form" className="space-y-5" onSubmit={saveEdit}>
          <section className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">
              Main details
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="edit-name">
                  Organization name
                </label>
                <input
                  id="edit-name"
                  className={fieldClass}
                  value={editForm.name}
                  required
                  onChange={(e) => setEditField('name', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="edit-schema">
                  Schema name
                </label>
                <input
                  id="edit-schema"
                  className={fieldClass}
                  value={editForm.schema_name}
                  onChange={(e) => setEditField('schema_name', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="edit-status">
                  Status
                </label>
                <input
                  id="edit-status"
                  className={fieldClass}
                  value={editForm.status}
                  onChange={(e) => setEditField('status', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="edit-email">
                  Contact email
                </label>
                <input
                  id="edit-email"
                  type="email"
                  className={fieldClass}
                  value={editForm.contact_email}
                  onChange={(e) => setEditField('contact_email', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="edit-phone">
                  Contact phone
                </label>
                <input
                  id="edit-phone"
                  className={fieldClass}
                  value={editForm.contact_phone}
                  onChange={(e) => setEditField('contact_phone', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="edit-timezone">
                  Timezone
                </label>
                <input
                  id="edit-timezone"
                  className={fieldClass}
                  value={editForm.timezone}
                  onChange={(e) => setEditField('timezone', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="edit-currency">
                  Currency
                </label>
                <input
                  id="edit-currency"
                  className={fieldClass}
                  value={editForm.default_currency}
                  onChange={(e) => setEditField('default_currency', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="edit-label">
                  Label
                </label>
                <input
                  id="edit-label"
                  className={fieldClass}
                  value={editForm.label}
                  onChange={(e) => setEditField('label', e.target.value)}
                  placeholder="Display label"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="edit-tag">
                  Tag
                </label>
                <input
                  id="edit-tag"
                  className={fieldClass}
                  value={editForm.tag}
                  onChange={(e) => setEditField('tag', e.target.value)}
                  placeholder="e.g. clinic, daycare"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="edit-owner">
                  Owner id
                </label>
                <input
                  id="edit-owner"
                  className={fieldClass}
                  value={editForm.owner}
                  onChange={(e) => setEditField('owner', e.target.value)}
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
              <button type="button" className={btnGhost} onClick={addDomain}>
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
                        <label className={labelClass} htmlFor={`edit-domain-${index}`}>
                          Domain
                        </label>
                        <input
                          id={`edit-domain-${index}`}
                          className={fieldClass}
                          value={d.domain}
                          onChange={(e) => updateDomain(index, { domain: e.target.value })}
                          placeholder="example-clinic.o-hm.com"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm text-stone-700">
                        <input
                          type="checkbox"
                          checked={d.is_primary}
                          onChange={(e) => updateDomain(index, { is_primary: e.target.checked })}
                        />
                        Primary domain
                      </label>
                      <label className="flex items-center gap-2 text-sm text-stone-700">
                        <input
                          type="checkbox"
                          checked={d.verified}
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
              <button type="button" className={btnGhost} onClick={addSubscription}>
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
                        <label className={labelClass} htmlFor={`edit-sub-plan-${index}`}>
                          Plan
                        </label>
                        <input
                          id={`edit-sub-plan-${index}`}
                          className={fieldClass}
                          value={s.plan}
                          onChange={(e) => updateSubscription(index, { plan: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className={labelClass} htmlFor={`edit-sub-status-${index}`}>
                          Status
                        </label>
                        <input
                          id={`edit-sub-status-${index}`}
                          className={fieldClass}
                          value={s.status}
                          onChange={(e) => updateSubscription(index, { status: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className={labelClass} htmlFor={`edit-sub-start-${index}`}>
                          Starts
                        </label>
                        <input
                          id={`edit-sub-start-${index}`}
                          className={fieldClass}
                          value={s.starts_at}
                          onChange={(e) =>
                            updateSubscription(index, { starts_at: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className={labelClass} htmlFor={`edit-sub-end-${index}`}>
                          Ends
                        </label>
                        <input
                          id={`edit-sub-end-${index}`}
                          className={fieldClass}
                          value={s.ends_at}
                          onChange={(e) => updateSubscription(index, { ends_at: e.target.value })}
                        />
                      </div>
                      <div className="sm:col-span-2 flex justify-end">
                        <button
                          type="button"
                          className={`${btnGhost} text-rose-600 hover:bg-rose-50`}
                          onClick={() => removeSubscription(index)}
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

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Suspend tenant?"
        message={
          deleteTarget
            ? `This suspends “${deleteTarget.name || 'this tenant'}” and removes it from the active list.`
            : 'This suspends the tenant and removes it from the active list.'
        }
        confirmLabel="Suspend"
        loading={saving}
        onConfirm={confirmDelete}
        onClose={() => {
          if (!saving) setDeleteTarget(null)
        }}
      />
    </div>
  )
}

export default Tenants
