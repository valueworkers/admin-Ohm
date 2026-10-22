import { useCallback, useEffect, useState } from 'react'
import { FiEdit2, FiLoader, FiRefreshCw } from 'react-icons/fi'
import {
  activateMyTenant,
  fetchMyTenants,
  updateMyTenant,
} from '../api/myTenants'
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

const toEditForm = (row = {}) => ({
  name: row.name || '',
  contact_email: row.contact_email || row.owner_email || '',
  contact_phone: row.contact_phone || row.phone || '',
  timezone: row.timezone || '',
  default_currency: row.default_currency || '',
})

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
  const [editForm, setEditForm] = useState(null)
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

  const openEdit = (row) => {
    setStatus({ type: '', message: '' })
    setEditTarget(row)
    setEditForm(toEditForm(row))
  }

  const closeEdit = () => {
    if (saving) return
    setEditTarget(null)
    setEditForm(null)
  }

  const handleSave = async (event) => {
    event.preventDefault()
    if (!editTarget || !editForm) return
    setSaving(true)
    setStatus({ type: '', message: '' })
    try {
      const payload = {
        name: String(editForm.name || '').trim(),
        contact_email: String(editForm.contact_email || '').trim(),
        contact_phone: String(editForm.contact_phone || '').trim(),
        timezone: String(editForm.timezone || '').trim(),
        default_currency: String(editForm.default_currency || '').trim(),
      }
      const updated = await updateMyTenant(editTarget.id, payload)
      setRows((prev) => prev.map((r) => (String(r.id) === String(updated.id) ? updated : r)))
      setStatus({ type: 'success', message: 'Tenant updated.' })
      closeEdit()
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
                        <button type="button" className={btnGhost} onClick={() => openEdit(row)}>
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

      <Modal open={Boolean(editTarget)} onClose={closeEdit} title="Edit tenant" wide>
        {editForm ? (
          <form className="space-y-4" onSubmit={handleSave}>
            <label className="block">
              <span className={labelClass}>Name</span>
              <input
                className={fieldClass}
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                disabled={saving}
                required
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Contact email</span>
                <input
                  type="email"
                  className={fieldClass}
                  value={editForm.contact_email}
                  onChange={(e) => setEditForm((f) => ({ ...f, contact_email: e.target.value }))}
                  disabled={saving}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Contact phone</span>
                <input
                  className={fieldClass}
                  value={editForm.contact_phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, contact_phone: e.target.value }))}
                  disabled={saving}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Timezone</span>
                <input
                  className={fieldClass}
                  value={editForm.timezone}
                  onChange={(e) => setEditForm((f) => ({ ...f, timezone: e.target.value }))}
                  disabled={saving}
                  placeholder="Asia/Kolkata"
                />
              </label>
              <label className="block">
                <span className={labelClass}>Currency</span>
                <input
                  className={fieldClass}
                  value={editForm.default_currency}
                  onChange={(e) => setEditForm((f) => ({ ...f, default_currency: e.target.value }))}
                  disabled={saving}
                  placeholder="INR"
                />
              </label>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-stone-100 pt-4 sm:flex-row sm:justify-end">
              <button type="button" className={btnSecondary} onClick={closeEdit} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className={btnPrimary} disabled={saving}>
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
          </form>
        ) : null}
      </Modal>
    </div>
  )
}

export default MyTenants
