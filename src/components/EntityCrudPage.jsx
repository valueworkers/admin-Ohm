import { useMemo, useState } from 'react'
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi'
import ConfirmDialog from './ui/ConfirmDialog'
import Modal from './ui/Modal'
import PageHeader from './ui/PageHeader'
import StatusBanner from './ui/StatusBanner'
import { EmptyState } from './ui/PageState'
import { usePlatformCollection } from '../hooks/usePlatformCollection'
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  fieldClass,
  labelClass,
  tableHeadClass,
  tableWrapClass,
} from '../utils/ui'

/**
 * Generic tenant-scoped CRUD table.
 * fields: [{ key, label, type?: 'text'|'number'|'select', options?: [], required? }]
 * columns: [{ key, label, render?: (row) => node }]
 */
const EntityCrudPage = ({
  title,
  description,
  eyebrow = 'Organization',
  collection,
  tenantId,
  canWrite,
  columns,
  fields,
  emptyTitle,
  emptyHint,
  buildEmpty,
  validate,
}) => {
  const { rows, save, remove } = usePlatformCollection(collection, tenantId)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const sorted = useMemo(() => rows, [rows])

  const openCreate = () => {
    setEditing(null)
    setForm(buildEmpty())
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    const next = { ...row }
    fields.forEach((f) => {
      if (f.type === 'datetime-local' && next[f.key]) {
        const d = new Date(next[f.key])
        if (!Number.isNaN(d.getTime())) {
          next[f.key] = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16)
        }
      }
    })
    setForm(next)
    setModalOpen(true)
  }

  const onChange = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const handleSave = (e) => {
    e.preventDefault()
    const err = validate?.(form)
    if (err) {
      setStatus({ type: 'error', message: err })
      return
    }
    setSaving(true)
    try {
      const payload = { ...form, id: editing?.id, tenantId }
      fields.forEach((f) => {
        if (f.type === 'datetime-local' && payload[f.key]) {
          const d = new Date(payload[f.key])
          if (!Number.isNaN(d.getTime())) payload[f.key] = d.toISOString()
        }
      })
      save(payload)
      setStatus({
        type: 'success',
        message: editing ? `${title} updated.` : `${title} created.`,
      })
      setModalOpen(false)
    } catch (ex) {
      setStatus({ type: 'error', message: ex.message || 'Could not save.' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    remove(deleteTarget.id)
    setStatus({ type: 'success', message: `${title} removed.` })
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          canWrite ? (
            <button type="button" className={btnPrimary} onClick={openCreate}>
              <FiPlus className="h-4 w-4" aria-hidden />
              {title === 'Vendors' ? 'Assign vendor' : `Add ${title.replace(/s$/, '')}`}
            </button>
          ) : (
            <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
              Read only
            </span>
          )
        }
      />

      <StatusBanner type={status.type} message={status.message} />

      <div className={tableWrapClass}>
        {sorted.length === 0 ? (
          <EmptyState
            bare
            title={emptyTitle || `No ${title.toLowerCase()} yet`}
            hint={emptyHint || (canWrite ? 'Add the first record to get started.' : 'Nothing on file for this tenant.')}
            actionLabel={canWrite ? `Add ${title.replace(/s$/, '')}` : undefined}
            onAction={canWrite ? openCreate : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} className="px-4 py-3">
                      {c.label}
                    </th>
                  ))}
                  {canWrite ? <th className="px-4 py-3 text-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3 text-slate-700">
                        {c.render ? c.render(row) : row[c.key] ?? '—'}
                      </td>
                    ))}
                    {canWrite ? (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            className={btnGhost}
                            onClick={() => openEdit(row)}
                            aria-label={`Edit ${row.name || row.id}`}
                          >
                            <FiEdit2 className="h-3.5 w-3.5" aria-hidden />
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`${btnGhost} text-rose-600 hover:bg-rose-50`}
                            onClick={() => setDeleteTarget(row)}
                            aria-label={`Delete ${row.name || row.id}`}
                          >
                            <FiTrash2 className="h-3.5 w-3.5" aria-hidden />
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

      <Modal
        open={modalOpen}
        title={editing ? `Edit ${title.replace(/s$/, '')}` : `Add ${title.replace(/s$/, '')}`}
        onClose={() => setModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="entity-crud-form" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        }
      >
        <form id="entity-crud-form" className="space-y-3" onSubmit={handleSave}>
          {fields.map((f) => (
            <div key={f.key}>
              <label className={labelClass} htmlFor={f.key}>
                {f.label}
              </label>
              {f.type === 'select' ? (
                <select
                  id={f.key}
                  className={fieldClass}
                  value={form[f.key] ?? ''}
                  onChange={(e) => onChange(f.key, e.target.value)}
                  required={f.required !== false}
                >
                  {(f.options || []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={f.key}
                  type={f.type || 'text'}
                  className={fieldClass}
                  value={form[f.key] ?? ''}
                  onChange={(e) =>
                    onChange(
                      f.key,
                      f.type === 'number' ? Number(e.target.value) : e.target.value
                    )
                  }
                  required={f.required !== false}
                />
              )}
            </div>
          ))}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete ${title.replace(/s$/, '')}?`}
        message="This removes the record from demo data for this tenant."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export default EntityCrudPage
