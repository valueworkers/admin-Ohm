import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiEdit2, FiEye, FiPlus, FiTrash2 } from 'react-icons/fi'
import OnboardTenantModal from '../components/OnboardTenantModal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import { EmptyState } from '../components/ui/PageState'
import {
  listTenantsByStatus,
  onboardTenant,
  subscribePlatform,
  updateTenant,
  updateTenantStatus,
} from '../store/platformStore'
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
  type: '',
  city: '',
  phone: '',
  address: '',
  owner_name: '',
  owner_email: '',
  owner_phone: '',
}

const Tenants = () => {
  const [rows, setRows] = useState(() => listTenantsByStatus('active'))
  const [status, setStatus] = useState({ type: '', message: '' })
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY_EDIT)
  const [saving, setSaving] = useState(false)

  useEffect(() => subscribePlatform(() => setRows(listTenantsByStatus('active'))), [])

  const moveToOffboarded = () => {
    if (!deleteTarget) return
    updateTenantStatus(deleteTarget.id, 'offboarded', {
      offboarded_at: new Date().toISOString(),
    })
    if (getSelectedTenantId() === String(deleteTarget.id)) clearSelectedTenant()
    setStatus({
      type: 'success',
      message: `${deleteTarget.name} moved to Offboarded. Restore anytime from Manage Tenants → Offboarded.`,
    })
    setDeleteTarget(null)
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

  const openEdit = (row) => {
    setEditTarget(row)
    setEditForm({
      name: row.name || '',
      type: row.type || '',
      city: row.city || '',
      phone: row.phone || '',
      address: row.address || '',
      owner_name: row.owner_name || '',
      owner_email: row.owner_email || '',
      owner_phone: row.owner_phone || '',
    })
  }

  const saveEdit = (event) => {
    event.preventDefault()
    if (!editTarget) return
    setSaving(true)
    try {
      updateTenant(editTarget.id, editForm)
      setStatus({ type: 'success', message: `${editForm.name} updated.` })
      setEditTarget(null)
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Could not update tenant.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Manage Tenants"
        title="Tenants"
        description="Add or edit active organizations. Delete moves a tenant to the Offboarded list."
        actions={
          <div className="flex flex-wrap gap-2">
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

      <div className={tableWrapClass}>
        {rows.length === 0 ? (
          <EmptyState
            bare
            title="No active tenants"
            hint="Create a tenant, then approve it from Lobby."
            actionLabel="Create tenant"
            onAction={() => setModalOpen(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-4 py-3">Tenant</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Approved</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{row.owner_name}</div>
                      <div className="text-xs text-slate-400">{row.owner_email}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.city}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.approved_at
                        ? new Date(row.approved_at).toLocaleDateString('en-IN')
                        : '—'}
                    </td>
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

      <OnboardTenantModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        saving={saving}
      />

      <Modal
        open={Boolean(editTarget)}
        title="Edit tenant"
        onClose={() => setEditTarget(null)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setEditTarget(null)}>
              Cancel
            </button>
            <button type="submit" form="edit-tenant-form" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        }
      >
        <form id="edit-tenant-form" className="grid gap-3 sm:grid-cols-2" onSubmit={saveEdit}>
          {[
            ['name', 'Organization name', true],
            ['type', 'Type', false],
            ['city', 'City', false],
            ['phone', 'Phone', false],
            ['address', 'Address', false],
            ['owner_name', 'Owner name', false],
            ['owner_email', 'Owner email', false],
            ['owner_phone', 'Owner phone', false],
          ].map(([key, label, required]) => (
            <div key={key} className={key === 'address' ? 'sm:col-span-2' : ''}>
              <label className={labelClass} htmlFor={`edit-${key}`}>
                {label}
              </label>
              <input
                id={`edit-${key}`}
                className={fieldClass}
                value={editForm[key]}
                required={required}
                onChange={(e) => setEditForm((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </div>
          ))}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete tenant?"
        message="This removes the organization from active Tenants and moves it to the Offboarded list. You can restore it later."
        confirmLabel="Move to Offboarded"
        onConfirm={moveToOffboarded}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export default Tenants
