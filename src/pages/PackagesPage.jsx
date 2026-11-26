import { useCallback, useEffect, useState } from 'react'
import { FiClock, FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi'
import { createPackage, deletePackage, fetchPackages, updatePackage } from '../api/billingCatalog'
import {
  fetchCatalogResources,
  fetchResourcesDropdown,
  fetchServicesDropdown,
} from '../api/catalog'
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
const SERVICE_TYPES = [
  { value: 'IN_HOUSE', label: 'IN_HOUSE' },
  { value: 'CLIENT_SIDE', label: 'CLIENT_SIDE' },
  { value: 'OPD', label: 'OPD' },
]

const EMPTY = {
  name: '',
  description: '',
  price: '',
  package_type: 'IN_HOUSE',
  period: 'MONTHLY',
  resource: '',
}

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

const withOption = (list, value) => (list.includes(value) ? list : value ? [value, ...list] : list)

const PackagesPage = ({ canWrite: canWriteProp, eyebrow } = {}) => {
  const access = useAccess()
  const canWrite = canWriteProp ?? access.canWrite
  const tenantSlug = resolveCatalogTenantSlug(access.tenant)

  const [serviceType, setServiceType] = useState('IN_HOUSE')
  const [services, setServices] = useState([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const [servicesError, setServicesError] = useState('')
  const [selectedServiceId, setSelectedServiceId] = useState('')

  const [rows, setRows] = useState([])
  const [resources, setResources] = useState([])
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

  const loadResources = useCallback(async () => {
    if (!tenantSlug) {
      setResources([])
      return
    }
    try {
      let list = await fetchResourcesDropdown(tenantSlug)
      if (!list.length) {
        const data = await fetchCatalogResources(tenantSlug, { pageSize: 100 })
        list = data.results
      }
      setResources(list)
    } catch {
      setResources([])
    }
  }, [tenantSlug])

  const loadServices = useCallback(async () => {
    if (!tenantSlug || !serviceType) {
      setServices([])
      setSelectedServiceId('')
      setServicesError('')
      return
    }
    setServicesLoading(true)
    setServicesError('')
    setSelectedServiceId('')
    try {
      const list = await fetchServicesDropdown(tenantSlug, { serviceType })
      setServices(list)
    } catch (err) {
      setServices([])
      setServicesError(apiErrorMessage(err, 'Could not load services.'))
    } finally {
      setServicesLoading(false)
    }
  }, [tenantSlug, serviceType])

  const loadPackages = useCallback(async () => {
    if (!tenantSlug || !serviceType) {
      setRows([])
      setLoadError('')
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      setRows(await fetchPackages(tenantSlug, { packageType: serviceType }))
    } catch (err) {
      setRows([])
      setLoadError(apiErrorMessage(err, 'Could not load packages.'))
    } finally {
      setLoading(false)
    }
  }, [tenantSlug, serviceType])

  useEffect(() => {
    loadServices()
  }, [loadServices])

  useEffect(() => {
    loadPackages()
    loadResources()
  }, [loadPackages, loadResources])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY, package_type: serviceType || 'IN_HOUSE' })
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      name: row.name,
      description: row.description,
      price: row.price,
      package_type: row.package_type || serviceType || 'IN_HOUSE',
      period: row.period,
      resource: row.resource || '',
    })
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!tenantSlug) return
    if (!form.name.trim()) {
      setStatus({ type: 'error', message: 'Package name is required.' })
      return
    }
    if (form.price === '' || Number.isNaN(Number(form.price))) {
      setStatus({ type: 'error', message: 'Price is required.' })
      return
    }
    if (!String(form.resource || '').trim()) {
      setStatus({ type: 'error', message: 'Select a catalog resource for this package.' })
      return
    }
    if (!form.description.trim()) {
      setStatus({ type: 'error', message: 'Description is required.' })
      return
    }
    setSaving(true)
    try {
      const payload = { ...form, package_type: serviceType || form.package_type }
      if (editing) await updatePackage(tenantSlug, editing.id, payload)
      else await createPackage(tenantSlug, payload)
      setStatus({ type: 'success', message: editing ? 'Package updated.' : 'Package created.' })
      setModalOpen(false)
      await loadPackages()
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
      await loadPackages()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not delete package.') })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const resourceOptions = (() => {
    if (!form.resource) return resources
    if (resources.some((r) => String(r.id) === String(form.resource))) return resources
    return [
      {
        id: String(form.resource),
        name: editing?.resource_name || `Resource #${form.resource}`,
      },
      ...resources,
    ]
  })()

  const selectedService = services.find((s) => String(s.id) === String(selectedServiceId))

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={eyebrow || access.tenant?.name || 'Organization'}
        title="Packages"
        description="Select a service type and service, then add or manage packages."
        actions={
          canWrite ? (
            <button
              type="button"
              className={btnPrimary}
              onClick={openCreate}
              disabled={!tenantSlug || !selectedServiceId}
            >
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

      {!tenantSlug ? (
        <StatusBanner type="warning" message="Select or activate a tenant first so X-Tenant can be sent." />
      ) : null}
      {status.message ? <StatusBanner type={status.type} message={status.message} /> : null}

      {!tenantSlug ? (
        <Panel>
          <EmptyState bare title="No tenant selected" hint="Packages load once a tenant is selected." />
        </Panel>
      ) : (
        <>
          <Panel>
            <div className="space-y-4">
              <div>
                <label className={labelClass} htmlFor="pkg-service-type">
                  Service type
                </label>
                <select
                  id="pkg-service-type"
                  className={fieldClass}
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                >
                  {SERVICE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Services</p>
                {servicesLoading ? (
                  <LoadingState label="Loading services…" />
                ) : servicesError ? (
                  <ErrorState bare message={servicesError} onRetry={loadServices} />
                ) : services.length === 0 ? (
                  <EmptyState
                    bare
                    title="No services"
                    hint={`No services for ${serviceType.replace(/_/g, ' ')}.`}
                  />
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {services.map((svc) => {
                      const active = String(svc.id) === String(selectedServiceId)
                      return (
                        <button
                          key={svc.id}
                          type="button"
                          onClick={() => setSelectedServiceId(String(svc.id))}
                          className={`rounded-xl border px-3 py-3 text-left text-sm font-medium transition-colors ${
                            active
                              ? 'border-brand-500 bg-brand-50 text-ink ring-2 ring-brand-500/20'
                              : 'border-stone-200 bg-white text-slate-700 hover:border-stone-300 hover:bg-stone-50'
                          }`}
                        >
                          {svc.name || `Service #${svc.id}`}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </Panel>

          {!selectedServiceId ? (
            <Panel>
              <EmptyState
                bare
                title="Select a service"
                hint="Choose a service above to view and manage its packages."
              />
            </Panel>
          ) : loading ? (
            <Panel>
              <LoadingState label="Loading packages…" />
            </Panel>
          ) : loadError ? (
            <Panel>
              <ErrorState bare message={loadError} onRetry={loadPackages} />
            </Panel>
          ) : rows.length === 0 ? (
            <Panel>
              <EmptyState
                bare
                title={`No packages for ${selectedService?.name || 'this service'}`}
                hint={canWrite ? 'Create a care package for this service type.' : 'Nothing on file.'}
                actionLabel={canWrite ? 'Add package' : undefined}
                onAction={canWrite ? openCreate : undefined}
              />
            </Panel>
          ) : (
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-slate-900">
                Packages · {selectedService?.name || serviceType}
              </h2>
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
                      Resource:{' '}
                      {pkg.resource_name ||
                        resources.find((r) => String(r.id) === String(pkg.resource))?.name ||
                        (pkg.resource ? `#${pkg.resource}` : '—')}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <FiClock className="h-3.5 w-3.5" aria-hidden />
                        {pkg.period.replace(/_/g, ' ')}
                      </span>
                      <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-800">
                        {pkg.package_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </>
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
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="pkg-name">
                Package name <span className="text-rose-600">*</span>
              </label>
              <input
                id="pkg-name"
                className={fieldClass}
                placeholder="e.g. Oxygen Concentrator Rental (Monthly)"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
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
              <label className={labelClass} htmlFor="pkg-resource">
                Resource <span className="text-rose-600">*</span>
              </label>
              <select
                id="pkg-resource"
                className={fieldClass}
                value={form.resource}
                onChange={(e) => set('resource', e.target.value)}
                required
              >
                <option value="">Select resource</option>
                {resourceOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name || r.label || r.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="pkg-type">
                Package type
              </label>
              <input
                id="pkg-type"
                className={`${fieldClass} bg-stone-50`}
                value={serviceType}
                readOnly
              />
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
              Description <span className="text-rose-600">*</span>
            </label>
            <textarea
              id="pkg-desc"
              rows={3}
              className={fieldClass}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              required
            />
          </div>
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
