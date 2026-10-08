import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import StatusBanner from '../../components/ui/StatusBanner'
import { EmptyState, Panel } from '../../components/ui/PageState'
import {
  getTenant,
  listCollection,
  listTenantsByStatus,
  removeRow,
  subscribePlatform,
  upsertRow,
} from '../../store/platformStore'
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  fieldClass,
  labelClass,
  tableHeadClass,
  tableWrapClass,
} from '../../utils/ui'

const EMPTY = {
  name: '',
  category: '',
  contact: '',
  phone: '',
  status: 'active',
  tenantId: '',
}

const PlatformVendors = () => {
  const [tenants, setTenants] = useState(() => listCollection('tenants'))
  const [vendors, setVendors] = useState(() => listCollection('vendors'))
  const [tenantFilter, setTenantFilter] = useState('')
  const [status, setStatus] = useState({ type: '', message: '' })
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    return subscribePlatform(() => {
      setTenants(listCollection('tenants'))
      setVendors(listCollection('vendors'))
    })
  }, [])

  const assignableTenants = useMemo(
    () =>
      tenants.filter((t) => t.status === 'active' || t.status === 'pending' || t.status === 'offboarded'),
    [tenants]
  )

  const activeTenants = useMemo(() => listTenantsByStatus('active'), [tenants])

  const rows = useMemo(() => {
    const enriched = vendors.map((v) => ({
      ...v,
      tenant_name: getTenant(v.tenantId)?.name || v.tenantId || '—',
    }))
    if (!tenantFilter) return enriched
    return enriched.filter((v) => String(v.tenantId) === String(tenantFilter))
  }, [vendors, tenantFilter])

  const openCreate = () => {
    setEditing(null)
    setForm({
      ...EMPTY,
      tenantId: tenantFilter || activeTenants[0]?.id || assignableTenants[0]?.id || '',
    })
    setStatus({ type: '', message: '' })
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      name: row.name || '',
      category: row.category || '',
      contact: row.contact || '',
      phone: row.phone || '',
      status: row.status || 'active',
      tenantId: row.tenantId || '',
    })
    setStatus({ type: '', message: '' })
    setModalOpen(true)
  }

  const handleSave = (e) => {
    e.preventDefault()
    if (!form.tenantId) {
      setStatus({ type: 'error', message: 'Select a tenant to assign this vendor.' })
      return
    }
    if (!form.name.trim()) {
      setStatus({ type: 'error', message: 'Vendor name is required.' })
      return
    }
    setSaving(true)
    try {
      upsertRow('vendors', {
        ...(editing || {}),
        id: editing?.id,
        name: form.name.trim(),
        category: form.category.trim(),
        contact: form.contact.trim(),
        phone: form.phone.trim(),
        status: form.status || 'active',
        tenantId: form.tenantId,
      })
      setModalOpen(false)
      setStatus({
        type: 'success',
        message: editing
          ? 'Vendor updated.'
          : `Vendor assigned to ${getTenant(form.tenantId)?.name || 'tenant'}.`,
      })
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Could not save vendor.' })
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    removeRow('vendors', deleteTarget.id)
    setStatus({ type: 'success', message: `${deleteTarget.name} removed.` })
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Platform"
        title="Vendors"
        description="Assign suppliers and partner vendors to tenants. Each vendor belongs to one organization."
        actions={
          <button type="button" className={btnPrimary} onClick={openCreate}>
            <FiPlus className="h-4 w-4" aria-hidden />
            Assign vendor
          </button>
        }
      />

      <StatusBanner type={status.type} message={status.message} />

      <Panel className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <label htmlFor="vendor-tenant-filter" className={labelClass}>
              Filter by tenant
            </label>
            <select
              id="vendor-tenant-filter"
              className={fieldClass}
              value={tenantFilter}
              onChange={(e) => setTenantFilter(e.target.value)}
            >
              <option value="">All tenants</option>
              {assignableTenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.status})
                </option>
              ))}
            </select>
          </div>
          <p className="text-sm text-slate-500">
            {rows.length} vendor{rows.length === 1 ? '' : 's'}
          </p>
        </div>
      </Panel>

      <div className={tableWrapClass}>
        {rows.length === 0 ? (
          <EmptyState
            bare
            title="No vendors assigned"
            hint="Assign a vendor to a tenant to get started."
            actionLabel="Assign vendor"
            onAction={openCreate}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-3 py-3">Tenant</th>
                  <th className="px-3 py-3">Vendor</th>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Contact</th>
                  <th className="px-3 py-3">Phone</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3">
                      <Link
                        to={`/tenants/${row.tenantId}`}
                        className="font-medium text-sky-700 hover:underline"
                      >
                        {row.tenant_name}
                      </Link>
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-900">{row.name}</td>
                    <td className="px-3 py-3 text-slate-600">{row.category || '—'}</td>
                    <td className="px-3 py-3 text-slate-600">{row.contact || '—'}</td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{row.phone || '—'}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          row.status === 'active'
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {row.status || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className={btnGhost}
                          onClick={() => openEdit(row)}
                          aria-label={`Edit ${row.name}`}
                        >
                          <FiEdit2 className="h-3.5 w-3.5" aria-hidden />
                          Edit
                        </button>
                        <button
                          type="button"
                          className={btnGhost}
                          onClick={() => setDeleteTarget(row)}
                          aria-label={`Remove ${row.name}`}
                        >
                          <FiTrash2 className="h-3.5 w-3.5" aria-hidden />
                          Remove
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

      <Modal
        open={modalOpen}
        title={editing ? 'Edit vendor' : 'Assign vendor to tenant'}
        onClose={() => setModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" form="platform-vendor-form" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save' : 'Assign'}
            </button>
          </div>
        }
      >
        <form id="platform-vendor-form" className="space-y-3" onSubmit={handleSave}>
          <div>
            <label htmlFor="vendor-tenant" className={labelClass}>
              Tenant <span className="text-rose-600">*</span>
            </label>
            <select
              id="vendor-tenant"
              className={fieldClass}
              value={form.tenantId}
              onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))}
              required
            >
              <option value="">Select tenant</option>
              {assignableTenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.status})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="vendor-name" className={labelClass}>
              Vendor name <span className="text-rose-600">*</span>
            </label>
            <input
              id="vendor-name"
              className={fieldClass}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="vendor-category" className={labelClass}>
                Category
              </label>
              <input
                id="vendor-category"
                className={fieldClass}
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="vendor-status" className={labelClass}>
                Status
              </label>
              <select
                id="vendor-status"
                className={fieldClass}
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="vendor-contact" className={labelClass}>
                Contact person
              </label>
              <input
                id="vendor-contact"
                className={fieldClass}
                value={form.contact}
                onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="vendor-phone" className={labelClass}>
                Phone
              </label>
              <input
                id="vendor-phone"
                className={fieldClass}
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove vendor?"
        message={
          deleteTarget
            ? `${deleteTarget.name} will be unassigned from ${getTenant(deleteTarget.tenantId)?.name || 'this tenant'}.`
            : ''
        }
        confirmLabel="Remove"
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export default PlatformVendors
