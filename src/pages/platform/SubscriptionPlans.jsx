import { useCallback, useEffect, useState } from 'react'
import { FiEdit2, FiPlus, FiRefreshCw, FiTrash2 } from 'react-icons/fi'
import { createPlan, deletePlan, fetchPlans, updatePlan } from '../../api/plans'
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

const emptyFeature = () => ({ code: '', name: '', description: '' })

const EMPTY_FORM = () => ({
  code: '',
  name: '',
  description: '',
  max_employees: '',
  max_branches: '',
  features: [emptyFeature()],
})

const toEditForm = (plan = {}) => ({
  code: plan.code || '',
  name: plan.name || '',
  description: plan.description || '',
  max_employees: plan.max_employees != null ? String(plan.max_employees) : '',
  max_branches: plan.max_branches != null ? String(plan.max_branches) : '',
  features:
    Array.isArray(plan.features) && plan.features.length > 0
      ? plan.features.map((f) => ({
          code: f.code || '',
          name: f.name || '',
          description: f.description || '',
        }))
      : [emptyFeature()],
})

const buildPayload = (form) => ({
  code: form.code.trim(),
  name: form.name.trim(),
  description: form.description.trim(),
  max_employees: form.max_employees === '' ? null : Number(form.max_employees),
  max_branches: form.max_branches === '' ? null : Number(form.max_branches),
  features: (form.features || [])
    .map((f) => ({
      code: String(f.code || '').trim(),
      name: String(f.name || '').trim(),
      description: String(f.description || '').trim(),
    }))
    .filter((f) => f.code || f.name),
})

const SubscriptionPlans = () => {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState({ type: '', message: '' })
  const [modalMode, setModalMode] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await fetchPlans()
      setRows(list)
    } catch (err) {
      setRows([])
      setError(apiErrorMessage(err, 'Could not load subscription plans.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setStatus({ type: '', message: '' })
    setModalMode('create')
    setEditTarget(null)
    setEditForm(EMPTY_FORM())
  }

  const openEdit = (plan) => {
    setStatus({ type: '', message: '' })
    setModalMode('edit')
    setEditTarget(plan)
    setEditForm(toEditForm(plan))
  }

  const closeEdit = () => {
    if (saving) return
    setModalMode(null)
    setEditTarget(null)
    setEditForm(null)
  }

  const setEditField = (key, value) => {
    setEditForm((prev) => ({ ...prev, [key]: value }))
  }

  const setFeatureField = (index, key, value) => {
    setEditForm((prev) => {
      const features = [...(prev.features || [])]
      features[index] = { ...features[index], [key]: value }
      return { ...prev, features }
    })
  }

  const addFeature = () => {
    setEditForm((prev) => ({
      ...prev,
      features: [...(prev.features || []), emptyFeature()],
    }))
  }

  const removeFeature = (index) => {
    setEditForm((prev) => {
      const features = (prev.features || []).filter((_, i) => i !== index)
      return { ...prev, features: features.length ? features : [emptyFeature()] }
    })
  }

  const savePlan = async (event) => {
    event.preventDefault()
    if (!editForm) return
    if (modalMode === 'edit' && !editTarget?.id) return
    setSaving(true)
    setStatus({ type: '', message: '' })
    try {
      const payload = buildPayload(editForm)
      if (!payload.name) {
        setStatus({ type: 'error', message: 'Plan name is required.' })
        return
      }
      if (!payload.code) {
        setStatus({ type: 'error', message: 'Plan code is required.' })
        return
      }
      if (modalMode === 'create') {
        await createPlan(payload)
        setStatus({ type: 'success', message: `${payload.name} created.` })
      } else {
        await updatePlan(editTarget.id, payload)
        setStatus({ type: 'success', message: `${payload.name} updated.` })
      }
      setModalMode(null)
      setEditTarget(null)
      setEditForm(null)
      await load()
    } catch (err) {
      setStatus({
        type: 'error',
        message: apiErrorMessage(
          err,
          modalMode === 'create' ? 'Could not create plan.' : 'Could not update plan.'
        ),
      })
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return
    const name = deleteTarget.name || 'Plan'
    setSaving(true)
    setStatus({ type: '', message: '' })
    try {
      await deletePlan(deleteTarget.id)
      setStatus({ type: 'success', message: `${name} deleted.` })
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setStatus({
        type: 'error',
        message: apiErrorMessage(err, 'Could not delete plan.'),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Platform"
        title="Subscription plans"
        description="Plans available for tenant onboarding and subscriptions."
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} onClick={load} disabled={loading}>
              <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
              Refresh
            </button>
            <button type="button" className={btnPrimary} onClick={openCreate}>
              <FiPlus className="h-4 w-4" aria-hidden />
              Create plan
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
            <LoadingState label="Loading plans…" />
          ) : rows.length === 0 ? (
            <EmptyState
              bare
              title="No plans"
              hint="Create a subscription plan to get started."
              actionLabel="Create plan"
              onAction={openCreate}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className={tableHeadClass}>
                  <tr>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Features</th>
                    <th className="px-4 py-3">Limits</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-stone-900">{row.name}</p>
                        <p className="mt-0.5 text-xs text-stone-500">{row.description || '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-stone-600">{row.code || '—'}</td>
                      <td className="px-4 py-3">
                        {row.features?.length ? (
                          <ul className="flex flex-wrap gap-1.5">
                            {row.features.map((f) => (
                              <li
                                key={f.code || f.name}
                                className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-800"
                                title={f.description || ''}
                              >
                                {f.name || f.code}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-stone-600">
                        <div>Employees: {row.max_employees ?? '—'}</div>
                        <div className="text-xs text-stone-400">
                          Branches: {row.max_branches ?? '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-1">
                          <button
                            type="button"
                            className={btnGhost}
                            onClick={() => openEdit(row)}
                          >
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

      <Modal
        open={Boolean(modalMode) && Boolean(editForm)}
        title={
          modalMode === 'create'
            ? 'Create plan'
            : editTarget
              ? `Edit plan · ${editTarget.name}`
              : 'Edit plan'
        }
        onClose={closeEdit}
        wide
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={closeEdit} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="plan-form" className={btnPrimary} disabled={saving}>
              {saving
                ? modalMode === 'create'
                  ? 'Creating…'
                  : 'Saving…'
                : modalMode === 'create'
                  ? 'Create plan'
                  : 'Save changes'}
            </button>
          </div>
        }
      >
        {editForm ? (
          <form id="plan-form" className="space-y-4" onSubmit={savePlan}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="plan-name">
                  Name
                </label>
                <input
                  id="plan-name"
                  className={fieldClass}
                  value={editForm.name}
                  onChange={(e) => setEditField('name', e.target.value)}
                  required
                  disabled={saving}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="plan-code">
                  Code
                </label>
                <input
                  id="plan-code"
                  className={fieldClass}
                  value={editForm.code}
                  onChange={(e) => setEditField('code', e.target.value)}
                  required
                  disabled={saving}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="plan-description">
                  Description
                </label>
                <textarea
                  id="plan-description"
                  className={`${fieldClass} min-h-[72px] resize-y`}
                  value={editForm.description}
                  onChange={(e) => setEditField('description', e.target.value)}
                  disabled={saving}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="plan-max-employees">
                  Max employees
                </label>
                <input
                  id="plan-max-employees"
                  type="number"
                  min="0"
                  className={fieldClass}
                  value={editForm.max_employees}
                  onChange={(e) => setEditField('max_employees', e.target.value)}
                  disabled={saving}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="plan-max-branches">
                  Max branches
                </label>
                <input
                  id="plan-max-branches"
                  type="number"
                  min="0"
                  className={fieldClass}
                  value={editForm.max_branches}
                  onChange={(e) => setEditField('max_branches', e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-stone-900">Features</p>
                <button
                  type="button"
                  className={btnGhost}
                  onClick={addFeature}
                  disabled={saving}
                >
                  <FiPlus className="h-3.5 w-3.5" aria-hidden />
                  Add feature
                </button>
              </div>
              <div className="space-y-2">
                {editForm.features.map((feature, index) => (
                  <div
                    key={`feature-${index}`}
                    className="grid gap-2 rounded-lg border border-stone-200 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
                  >
                    <div>
                      <label className={labelClass} htmlFor={`feature-code-${index}`}>
                        Code
                      </label>
                      <input
                        id={`feature-code-${index}`}
                        className={fieldClass}
                        value={feature.code}
                        onChange={(e) => setFeatureField(index, 'code', e.target.value)}
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor={`feature-name-${index}`}>
                        Name
                      </label>
                      <input
                        id={`feature-name-${index}`}
                        className={fieldClass}
                        value={feature.name}
                        onChange={(e) => setFeatureField(index, 'name', e.target.value)}
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor={`feature-desc-${index}`}>
                        Description
                      </label>
                      <input
                        id={`feature-desc-${index}`}
                        className={fieldClass}
                        value={feature.description}
                        onChange={(e) => setFeatureField(index, 'description', e.target.value)}
                        disabled={saving}
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        className={`${btnGhost} text-rose-600`}
                        onClick={() => removeFeature(index)}
                        aria-label="Remove feature"
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
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete plan?"
        message={
          deleteTarget
            ? `This permanently deletes “${deleteTarget.name || 'this plan'}”.`
            : 'This permanently deletes the plan.'
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

export default SubscriptionPlans
