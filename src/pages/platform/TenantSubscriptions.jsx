import { useCallback, useEffect, useState } from 'react'
import { FiEdit2, FiPlus, FiRefreshCw, FiTrash2 } from 'react-icons/fi'
import { fetchPlans } from '../../api/plans'
import {
  createSubscription,
  deleteSubscription,
  fetchSubscriptions,
  updateSubscription,
} from '../../api/subscriptions'
import { fetchTenants } from '../../api/tenants'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import StatusBanner from '../../components/ui/StatusBanner'
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/PageState'
import { apiErrorMessage } from '../../utils/errors'
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  fieldClass,
  labelClass,
  tableHeadClass,
  tableWrapClass,
} from '../../utils/ui'

const EMPTY_FORM = {
  tenant: '',
  plan: '',
  status: 'trial',
  starts_at: '',
  ends_at: '',
  trial_ends_at: '',
  billing_email: '',
}

const toDateInput = (value) => {
  if (!value) return ''
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    return d.toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

const toIsoOrNull = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T00:00:00Z`
  try {
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return null
    return d.toISOString()
  } catch {
    return null
  }
}

const formatDate = (value) => {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('en-IN')
  } catch {
    return '—'
  }
}

const statusChip = (status) => {
  const s = String(status || '').toLowerCase()
  if (s === 'active') {
    return 'rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800'
  }
  if (s === 'trial' || s === 'trialing' || s === 'pending') {
    return 'rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900'
  }
  if (s === 'canceled' || s === 'expired' || s === 'inactive') {
    return 'rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-800'
  }
  return 'rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600'
}

const toForm = (row = {}) => ({
  tenant: row.tenant != null ? String(row.tenant) : '',
  plan: row.plan != null ? String(row.plan) : '',
  status: row.status || 'active',
  starts_at: toDateInput(row.starts_at),
  ends_at: toDateInput(row.ends_at),
  trial_ends_at: toDateInput(row.trial_ends_at),
  billing_email: row.billing_email || '',
})

const TenantSubscriptions = () => {
  const [rows, setRows] = useState([])
  const [tenants, setTenants] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState({ type: '', message: '' })
  const [modalMode, setModalMode] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [list, tenantList, planList] = await Promise.all([
        fetchSubscriptions(),
        fetchTenants(),
        fetchPlans(),
      ])
      setRows(list)
      setTenants(tenantList)
      setPlans(planList)
    } catch (err) {
      setRows([])
      setError(apiErrorMessage(err, 'Could not load tenant subscriptions.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const openCreate = () => {
    setStatus({ type: '', message: '' })
    setModalMode('create')
    setEditTarget(null)
    setForm(EMPTY_FORM)
  }

  const openEdit = (row) => {
    setStatus({ type: '', message: '' })
    setModalMode('edit')
    setEditTarget(row)
    setForm(toForm(row))
  }

  const closeModal = () => {
    if (saving) return
    setModalMode(null)
    setEditTarget(null)
    setForm(EMPTY_FORM)
  }

  const tenantLabel = (id) => {
    const t = tenants.find((row) => String(row.id) === String(id))
    return t?.name || String(id || '—')
  }

  const planLabel = (id) => {
    const p = plans.find((row) => String(row.id) === String(id))
    return p?.name || String(id || '—')
  }

  const buildPayload = () => ({
    tenant: Number(form.tenant) || form.tenant,
    plan: Number(form.plan) || form.plan,
    status: form.status.trim() || 'trial',
    starts_at: toIsoOrNull(form.starts_at) || new Date().toISOString(),
    ends_at: toIsoOrNull(form.ends_at),
    trial_ends_at: toIsoOrNull(form.trial_ends_at),
    billing_email: form.billing_email.trim(),
    features: Array.isArray(editTarget?.features) ? editTarget.features : [],
  })

  const submitForm = async (event) => {
    event.preventDefault()
    if (!form.tenant) {
      setStatus({ type: 'error', message: 'Select a tenant.' })
      return
    }
    if (!form.plan) {
      setStatus({ type: 'error', message: 'Select a plan.' })
      return
    }
    if (modalMode === 'edit' && !editTarget?.id) return

    setSaving(true)
    setStatus({ type: '', message: '' })
    try {
      const payload = buildPayload()
      if (modalMode === 'create') {
        await createSubscription(payload)
        setStatus({
          type: 'success',
          message: `Subscription created for ${tenantLabel(form.tenant)}.`,
        })
      } else {
        await updateSubscription(editTarget.id, payload)
        setStatus({
          type: 'success',
          message: `Subscription updated for ${tenantLabel(form.tenant)}.`,
        })
      }
      setModalMode(null)
      setEditTarget(null)
      setForm(EMPTY_FORM)
      await load()
    } catch (err) {
      setStatus({
        type: 'error',
        message: apiErrorMessage(
          err,
          modalMode === 'create'
            ? 'Could not create subscription.'
            : 'Could not update subscription.'
        ),
      })
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return
    const name = deleteTarget.tenant_name || tenantLabel(deleteTarget.tenant)
    setSaving(true)
    setStatus({ type: '', message: '' })
    try {
      await deleteSubscription(deleteTarget.id)
      setStatus({ type: 'success', message: `Subscription for ${name} deleted.` })
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setStatus({
        type: 'error',
        message: apiErrorMessage(err, 'Could not delete subscription.'),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Subscription"
        title="Tenant subscriptions"
        description="Assign a subscription plan to a tenant."
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} onClick={load} disabled={loading}>
              <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
              Refresh
            </button>
            <button type="button" className={btnPrimary} onClick={openCreate}>
              <FiPlus className="h-4 w-4" aria-hidden />
              Assign plan
            </button>
          </div>
        }
      />

      <StatusBanner type={status.type} message={status.message} />

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <div className={tableWrapClass}>
          {loading ? (
            <LoadingState label="Loading subscriptions…" />
          ) : rows.length === 0 ? (
            <EmptyState
              bare
              title="No tenant subscriptions"
              hint="Assign a plan to a tenant to get started."
              actionLabel="Assign plan"
              onAction={openCreate}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className={tableHeadClass}>
                  <tr>
                    <th className="px-4 py-3">Tenant</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Starts</th>
                    <th className="px-4 py-3">Ends</th>
                    <th className="px-4 py-3">Billing email</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {rows.map((row) => (
                    <tr key={row.id || `${row.tenant}-${row.plan}`} className="hover:bg-stone-50">
                      <td className="px-4 py-3 font-medium text-stone-900">
                        {row.tenant_name || tenantLabel(row.tenant)}
                      </td>
                      <td className="px-4 py-3 text-stone-600">
                        {row.plan_name || planLabel(row.plan)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={statusChip(row.status)}>{row.status || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-stone-600">{formatDate(row.starts_at)}</td>
                      <td className="px-4 py-3 text-stone-600">{formatDate(row.ends_at)}</td>
                      <td className="px-4 py-3 text-stone-600">{row.billing_email || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-1">
                          <button
                            type="button"
                            className={btnGhost}
                            onClick={() => openEdit(row)}
                            disabled={!row.id}
                          >
                            <FiEdit2 className="h-3.5 w-3.5" aria-hidden />
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`${btnGhost} text-rose-600 hover:bg-rose-50`}
                            onClick={() => setDeleteTarget(row)}
                            disabled={!row.id}
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

      <Modal
        open={Boolean(modalMode)}
        title={modalMode === 'edit' ? 'Edit subscription' : 'Assign subscription plan'}
        onClose={closeModal}
        wide
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={closeModal} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="tenant-sub-form" className={btnPrimary} disabled={saving}>
              {saving
                ? modalMode === 'edit'
                  ? 'Saving…'
                  : 'Creating…'
                : modalMode === 'edit'
                  ? 'Save changes'
                  : 'Create subscription'}
            </button>
          </div>
        }
      >
        <form id="tenant-sub-form" className="grid gap-3 sm:grid-cols-2" onSubmit={submitForm}>
          <div>
            <label className={labelClass} htmlFor="sub-tenant">
              Tenant <span className="text-rose-600">*</span>
            </label>
            <select
              id="sub-tenant"
              className={fieldClass}
              value={form.tenant}
              onChange={(e) => setField('tenant', e.target.value)}
              required
              disabled={saving}
            >
              <option value="">Select tenant</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="sub-plan">
              Plan <span className="text-rose-600">*</span>
            </label>
            <select
              id="sub-plan"
              className={fieldClass}
              value={form.plan}
              onChange={(e) => setField('plan', e.target.value)}
              required
              disabled={saving}
            >
              <option value="">Select plan</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="sub-status">
              Status
            </label>
            <select
              id="sub-status"
              className={fieldClass}
              value={form.status}
              onChange={(e) => setField('status', e.target.value)}
              disabled={saving}
            >
              <option value="trial">trial</option>
              <option value="active">active</option>
              <option value="trialing">trialing</option>
              <option value="pending">pending</option>
              <option value="canceled">canceled</option>
              <option value="expired">expired</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="sub-billing">
              Billing email
            </label>
            <input
              id="sub-billing"
              type="email"
              className={fieldClass}
              value={form.billing_email}
              onChange={(e) => setField('billing_email', e.target.value)}
              disabled={saving}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="sub-starts">
              Starts at
            </label>
            <input
              id="sub-starts"
              type="date"
              className={fieldClass}
              value={form.starts_at}
              onChange={(e) => setField('starts_at', e.target.value)}
              disabled={saving}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="sub-ends">
              Ends at
            </label>
            <input
              id="sub-ends"
              type="date"
              className={fieldClass}
              value={form.ends_at}
              onChange={(e) => setField('ends_at', e.target.value)}
              disabled={saving}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="sub-trial">
              Trial ends at
            </label>
            <input
              id="sub-trial"
              type="date"
              className={fieldClass}
              value={form.trial_ends_at}
              onChange={(e) => setField('trial_ends_at', e.target.value)}
              disabled={saving}
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete subscription?"
        message={
          deleteTarget
            ? `This permanently deletes the subscription for “${
                deleteTarget.tenant_name || tenantLabel(deleteTarget.tenant)
              }”.`
            : 'This permanently deletes the subscription.'
        }
        confirmLabel="Delete"
        loading={saving}
        onConfirm={confirmDelete}
        onClose={() => {
          if (!saving) setDeleteTarget(null)
        }}
      />
    </div>
  )
}

export default TenantSubscriptions
