import { useCallback, useEffect, useState } from 'react'
import { FiArrowLeft, FiPlus, FiRefreshCw } from 'react-icons/fi'
import {
  WEEKDAY_OPTIONS,
  createShift,
  deleteShift,
  fetchShifts,
  updateShift,
} from '../api/shifts'
import ConfirmDialog from './ui/ConfirmDialog'
import Modal from './ui/Modal'
import StatusBanner from './ui/StatusBanner'
import { EmptyState, ErrorState, LoadingState } from './ui/PageState'
import { apiErrorMessage } from '../utils/errors'
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  fieldClass,
  labelClass,
  tableHeadClass,
  tableWrapClass,
} from '../utils/ui'

const EMPTY = {
  name: '',
  start_hhmm: '09:00',
  end_hhmm: '17:00',
  is_overnight: false,
  grace_minutes: 0,
  weekly_off_days: [6],
  is_active: true,
}

const ShiftsManagerModal = ({ open, tenantSlug, canWrite = true, onClose, onChanged }) => {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [status, setStatus] = useState({ type: '', message: '' })

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const toggleOffDay = (day) => {
    setForm((f) => {
      const has = f.weekly_off_days.includes(day)
      return {
        ...f,
        weekly_off_days: has
          ? f.weekly_off_days.filter((d) => d !== day)
          : [...f.weekly_off_days, day].sort((a, b) => a - b),
      }
    })
  }

  const load = useCallback(async () => {
    if (!tenantSlug || !open) {
      setRows([])
      setLoadError('')
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      setRows(await fetchShifts(tenantSlug))
    } catch (err) {
      setRows([])
      setLoadError(apiErrorMessage(err, 'Could not load shifts.'))
    } finally {
      setLoading(false)
    }
  }, [tenantSlug, open])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setFormOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      name: row.name || '',
      start_hhmm: row.start_hhmm || String(row.start_time || '').slice(0, 5) || '09:00',
      end_hhmm: row.end_hhmm || String(row.end_time || '').slice(0, 5) || '17:00',
      is_overnight: Boolean(row.is_overnight),
      grace_minutes: row.grace_minutes ?? 0,
      weekly_off_days: Array.isArray(row.weekly_off_days) ? [...row.weekly_off_days] : [],
      is_active: row.is_active !== false,
    })
    setFormOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!tenantSlug) return
    if (!form.name.trim()) {
      setStatus({ type: 'error', message: 'Shift name is required.' })
      return
    }
    if (!form.start_hhmm || !form.end_hhmm) {
      setStatus({ type: 'error', message: 'Start and end time are required.' })
      return
    }
    setSaving(true)
    try {
      if (editing) await updateShift(tenantSlug, editing.id, form)
      else await createShift(tenantSlug, form)
      setStatus({ type: 'success', message: editing ? 'Shift updated.' : 'Shift created.' })
      setFormOpen(false)
      await load()
      onChanged?.()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not save shift.') })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!tenantSlug || !deleteTarget) return
    setDeleting(true)
    try {
      await deleteShift(tenantSlug, deleteTarget.id)
      setStatus({ type: 'success', message: 'Shift deleted.' })
      setDeleteTarget(null)
      await load()
      onChanged?.()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not delete shift.') })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Modal
        open={open}
        title="Shifts"
        onClose={onClose}
        xl
        footer={
          <div className="flex justify-end">
            <button type="button" className={btnSecondary} onClick={onClose}>
              Close
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" className={btnSecondary} onClick={onClose}>
              <FiArrowLeft className="h-4 w-4" aria-hidden />
              Back to employees
            </button>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnSecondary} onClick={load} disabled={loading || !tenantSlug}>
                <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
                Refresh
              </button>
              {canWrite ? (
                <button type="button" className={btnPrimary} onClick={openCreate} disabled={!tenantSlug}>
                  <FiPlus className="h-4 w-4" aria-hidden />
                  Add shift
                </button>
              ) : null}
            </div>
          </div>

          <StatusBanner type={status.type} message={status.message} />

          <div className={tableWrapClass}>
            {!tenantSlug ? (
              <EmptyState bare title="No tenant selected" hint="Select a tenant to manage shifts." />
            ) : loading ? (
              <LoadingState label="Loading shifts…" />
            ) : loadError ? (
              <ErrorState bare message={loadError} onRetry={load} />
            ) : rows.length === 0 ? (
              <EmptyState
                bare
                title="No shifts yet"
                hint={canWrite ? 'Add a shift for employees to select.' : 'Nothing on file.'}
                actionLabel={canWrite ? 'Add shift' : undefined}
                onAction={canWrite ? openCreate : undefined}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className={tableHeadClass}>
                    <tr>
                      <th className="px-3 py-3">Name</th>
                      <th className="px-3 py-3">Start</th>
                      <th className="px-3 py-3">End</th>
                      <th className="px-3 py-3">Overnight</th>
                      <th className="px-3 py-3">Grace</th>
                      <th className="px-3 py-3">Weekly off</th>
                      <th className="px-3 py-3">Status</th>
                      {canWrite ? <th className="px-3 py-3 text-right">Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {rows.map((row) => (
                      <tr key={row.id} className="hover:bg-stone-50">
                        <td className="px-3 py-3 font-semibold text-stone-900">{row.name}</td>
                        <td className="px-3 py-3 tabular-nums text-stone-700">
                          {row.start_hhmm || String(row.start_time).slice(0, 5) || '—'}
                        </td>
                        <td className="px-3 py-3 tabular-nums text-stone-700">
                          {row.end_hhmm || String(row.end_time).slice(0, 5) || '—'}
                        </td>
                        <td className="px-3 py-3 text-stone-700">
                          {row.is_overnight ? 'Yes' : 'No'}
                        </td>
                        <td className="px-3 py-3 text-stone-700">{row.grace_minutes} min</td>
                        <td className="px-3 py-3 text-stone-700">{row.weekly_off_label}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              row.is_active
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'bg-stone-100 text-stone-600'
                            }`}
                          >
                            {row.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        {canWrite ? (
                          <td className="px-3 py-3">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                className={btnGhost}
                                onClick={() => openEdit(row)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className={`${btnGhost} border-rose-200 text-rose-600 hover:bg-rose-50`}
                                onClick={() => setDeleteTarget(row)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={formOpen}
        title={editing ? 'Edit shift' : 'Add shift'}
        onClose={() => setFormOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setFormOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="shift-form" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add shift'}
            </button>
          </div>
        }
      >
        <form id="shift-form" className="space-y-3" onSubmit={handleSave}>
          <div>
            <label className={labelClass} htmlFor="shift-name">
              Name <span className="text-rose-600">*</span>
            </label>
            <input
              id="shift-name"
              className={fieldClass}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="shift-start">
                Start <span className="text-rose-600">*</span>
              </label>
              <input
                id="shift-start"
                type="time"
                className={fieldClass}
                value={form.start_hhmm}
                onChange={(e) => set('start_hhmm', e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="shift-end">
                End <span className="text-rose-600">*</span>
              </label>
              <input
                id="shift-end"
                type="time"
                className={fieldClass}
                value={form.end_hhmm}
                onChange={(e) => set('end_hhmm', e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="shift-grace">
              Grace minutes
            </label>
            <input
              id="shift-grace"
              type="number"
              min="0"
              className={fieldClass}
              value={form.grace_minutes}
              onChange={(e) => set('grace_minutes', e.target.value)}
            />
          </div>
          <div>
            <p className={labelClass}>Weekly off days</p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map((d) => (
                <label
                  key={d.value}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                    form.weekly_off_days.includes(d.value)
                      ? 'border-brand-300 bg-brand-50 text-brand-800'
                      : 'border-stone-200 bg-white text-stone-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={form.weekly_off_days.includes(d.value)}
                    onChange={() => toggleOffDay(d.value)}
                  />
                  {d.label.slice(0, 3)}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-stone-700">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                checked={form.is_overnight}
                onChange={(e) => set('is_overnight', e.target.checked)}
              />
              Overnight
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                checked={form.is_active}
                onChange={(e) => set('is_active', e.target.checked)}
              />
              Active
            </label>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete shift?"
        message={`${deleteTarget?.name || 'This shift'} will be permanently removed.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  )
}

export default ShiftsManagerModal
