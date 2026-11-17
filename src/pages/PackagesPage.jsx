import { useCallback, useEffect, useState } from 'react'
import { FiClock, FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi'
import { createPackage, deletePackage, fetchPackages, updatePackage } from '../api/billingCatalog'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import { EmptyState, ErrorState, LoadingState, Panel } from '../components/ui/PageState'
import { useAccess } from '../hooks/useAccess'
import { apiErrorMessage } from '../utils/errors'
import { resolveCatalogTenantSlug } from '../utils/tenantHeader'
import { btnGhost, btnPrimary, btnSecondary, fieldClass, labelClass } from '../utils/ui'

const PERIODS = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'ONE_TIME']
const PACKAGE_TYPES = ['IN_HOUSE', 'AT_HOME', 'OUT_PATIENT', 'HYBRID']

const EMPTY = {
  owner: '',
  name: '',
  description: '',
  price: '',
  registration_fees: '0',
  package_type: 'IN_HOUSE',
  period: 'MONTHLY',
  is_active: true,
}

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

const withOption = (list, value) => (list.includes(value) ? list : [value, ...list])

const defaultOwner = (tenant) => {
  const raw = tenant?.owner ?? tenant?.owner_id
  return raw != null && /^\d+$/.test(String(raw)) ? String(raw) : ''
}

const PackagesPage = ({ canWrite: canWriteProp, eyebrow } = {}) => {
  const access = useAccess()
  const canWrite = canWriteProp ?? access.canWrite
  const tenantSlug = resolveCatalogTenantSlug(access.tenant)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [status, setStatus] = useState({ type: '', message: '' })
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const load = useCallback(async () => {
    if (!tenantSlug) {
      setRows([])
      setLoadError('')
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      setRows(await fetchPackages(tenantSlug))
    } catch (err) {
      setRows([])
      setLoadError(apiErrorMessage(err, 'Could not load packages.'))
    } finally {
      setLoading(false)
    }
  }, [tenantSlug])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY, owner: defaultOwner(access.tenant) || String(rows[0]?.owner ?? '') })
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      owner: String(row.owner ?? ''),
      name: row.name,
      description: row.description,
      price: row.price,
      registration_fees: row.registration_fees,
      package_type: row.package_type,
      period: row.period,
      is_active: row.is_active,
    })
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!tenantSlug) return
    if (!/^\d+$/.test(String(form.owner).trim())) {
      setStatus({ type: 'error', message: 'Owner ID is required.' })
      return
    }
    if (!form.name.trim()) {
      setStatus({ type: 'error', message: 'Package name is required.' })
      return
    }
    if (form.price === '' || Number.isNaN(Number(form.price))) {
      setStatus({ type: 'error', message: 'Price is required.' })
      return
    }
    setSaving(true)
    try {
      if (editing) await updatePackage(tenantSlug, editing.id, form)
      else await createPackage(tenantSlug, form)
      setStatus({ type: 'success', message: editing ? 'Package updated.' : 'Package created.' })
      setModalOpen(false)
      await load()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not save package.') })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget || !tenantSlug) return
    setDeleting(true)
    try {
      await deletePackage(tenantSlug, deleteTarget.id)
      setStatus({ type: 'success', message: 'Package removed.' })
      await load()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not delete package.') })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={eyebrow || access.tenant?.name || 'Organization'}
        title="Packages"
        description="Pricing packages billed to customers of this tenant."
        actions={
          canWrite ? (
            <button type="button" className={btnPrimary} onClick={openCreate} disabled={!tenantSlug}>
              <FiPlus className="h-4 w-4" aria-hidden />
              Add package
            </button>
          ) : (
            <span className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600">
              Read only
            </span>
          )
        }
      />

      {tenantSlug ? (
        <StatusBanner type="info" message={`X-Tenant: ${tenantSlug}`} />
      ) : (
        <StatusBanner type="warning" message="Select or activate a tenant first so X-Tenant can be sent." />
      )}
      <StatusBanner type={status.type} message={status.message} />

      {!tenantSlug ? (
        <Panel>
          <EmptyState bare title="No tenant selected" hint="Packages load once a tenant is selected." />
        </Panel>
      ) : loading ? (
        <Panel>
          <LoadingState label="Loading packages…" />
        </Panel>
      ) : loadError ? (
        <Panel>
          <ErrorState bare message={loadError} onRetry={load} />
        </Panel>
      ) : rows.length === 0 ? (
        <Panel>
          <EmptyState
            bare
            title="No packages yet"
            hint={canWrite ? 'Create a pricing package for this tenant.' : 'Nothing on file.'}
            actionLabel={canWrite ? 'Add package' : undefined}
            onAction={canWrite ? openCreate : undefined}
          />
        </Panel>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((pkg) => (
            <article
              key={pkg.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900">{pkg.name}</h3>
                  {pkg.description ? (
                    <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{pkg.description}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="text-base font-bold text-brand-700">{money(pkg.price)}</span>
                  {canWrite ? (
                    <>
                      <button
                        type="button"
                        className={btnGhost}
                        onClick={() => openEdit(pkg)}
                        aria-label={`Edit ${pkg.name}`}
                      >
                        <FiEdit2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={`${btnGhost} text-rose-600 hover:bg-rose-50`}
                        onClick={() => setDeleteTarget(pkg)}
                        aria-label={`Delete ${pkg.name}`}
                      >
                        <FiTrash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              <p className="mt-3 text-sm text-slate-600">
                Registration fees: {money(pkg.registration_fees)}
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <FiClock className="h-3.5 w-3.5" aria-hidden />
                  {pkg.period.replace(/_/g, ' ')}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-800">
                    {pkg.package_type.replace(/_/g, ' ')}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      pkg.is_active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {pkg.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editing ? 'Edit package' : 'Add package'}
        onClose={() => setModalOpen(false)}
        wide
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="package-form" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add package'}
            </button>
          </div>
        }
      >
        <form id="package-form" className="space-y-3" onSubmit={handleSave}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="pkg-name">
                Package name <span className="text-rose-600">*</span>
              </label>
              <input
                id="pkg-name"
                className={fieldClass}
                placeholder="e.g. Geriatric care Monthly Package - 24/7"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="pkg-owner">
                Owner ID <span className="text-rose-600">*</span>
              </label>
              <input
                id="pkg-owner"
                type="number"
                min="1"
                inputMode="numeric"
                className={fieldClass}
                value={form.owner}
                onChange={(e) => set('owner', e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="pkg-price">
                Price <span className="text-rose-600">*</span>
              </label>
              <input
                id="pkg-price"
                type="number"
                min="0"
                step="0.01"
                className={fieldClass}
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="pkg-reg">
                Registration fees
              </label>
              <input
                id="pkg-reg"
                type="number"
                min="0"
                step="0.01"
                className={fieldClass}
                value={form.registration_fees}
                onChange={(e) => set('registration_fees', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="pkg-type">
                Package type
              </label>
              <select
                id="pkg-type"
                className={fieldClass}
                value={form.package_type}
                onChange={(e) => set('package_type', e.target.value)}
              >
                {withOption(PACKAGE_TYPES, form.package_type).map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="pkg-period">
                Period
              </label>
              <select
                id="pkg-period"
                className={fieldClass}
                value={form.period}
                onChange={(e) => set('period', e.target.value)}
              >
                {withOption(PERIODS, form.period).map((p) => (
                  <option key={p} value={p}>
                    {p.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="pkg-desc">
              Description
            </label>
            <textarea
              id="pkg-desc"
              rows={3}
              className={fieldClass}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              checked={form.is_active}
              onChange={(e) => set('is_active', e.target.checked)}
            />
            Active
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete package?"
        message="This removes the package for this tenant."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export default PackagesPage
