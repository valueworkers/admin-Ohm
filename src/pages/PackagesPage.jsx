import { useEffect, useMemo, useState } from 'react'
import { FiClock, FiEdit2, FiGrid, FiPackage, FiPlus, FiTrash2 } from 'react-icons/fi'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import { EmptyState, Panel } from '../components/ui/PageState'
import { useAccess } from '../hooks/useAccess'
import { usePlatformCollection } from '../hooks/usePlatformCollection'
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  fieldClass,
  labelClass,
} from '../utils/ui'

const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'ONE_TIME']
const SERVICE_TYPES = ['IN_HOUSE', 'AT_HOME', 'OUT_PATIENT', 'HYBRID']

const EMPTY = {
  name: '',
  subcategory: '',
  price: '',
  registration_fee: '0',
  frequency: 'MONTHLY',
  service_type: 'IN_HOUSE',
  visits: '',
  description: '',
  active: true,
}

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

const PackagesPage = ({ tenantId: tenantIdProp, canWrite: canWriteProp, eyebrow } = {}) => {
  const access = useAccess()
  const tenantId = tenantIdProp || access.tenantId
  const canWrite = canWriteProp ?? access.canWrite
  const { rows: services } = usePlatformCollection('services', tenantId)
  const { rows: packages, save, remove } = usePlatformCollection('packages', tenantId)

  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [status, setStatus] = useState({ type: '', message: '' })
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    if (!services.length) {
      setSelectedServiceId('')
      return
    }
    if (!selectedServiceId || !services.some((s) => String(s.id) === String(selectedServiceId))) {
      setSelectedServiceId(String(services[0].id))
    }
  }, [services, selectedServiceId])

  const selectedService = useMemo(
    () => services.find((s) => String(s.id) === String(selectedServiceId)) || null,
    [services, selectedServiceId]
  )

  const filteredPackages = useMemo(() => {
    if (!selectedServiceId) return []
    return packages.filter((p) => {
      if (p.service_id) return String(p.service_id) === String(selectedServiceId)
      // legacy rows matched by service name
      return String(p.service_name || '') === String(selectedService?.name || '')
    })
  }, [packages, selectedServiceId, selectedService])

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const openCreate = () => {
    if (!selectedService) {
      setStatus({ type: 'error', message: 'Add a service first, then create packages for it.' })
      return
    }
    setEditing(null)
    setForm({
      ...EMPTY,
      subcategory: selectedService.service_type || selectedService.category || selectedService.name,
    })
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      name: row.name || '',
      subcategory: row.subcategory || row.service_name || '',
      price: row.price ?? '',
      registration_fee: row.registration_fee ?? '0',
      frequency: row.frequency || 'MONTHLY',
      service_type: row.service_type || 'IN_HOUSE',
      visits: row.visits ?? '',
      description: row.description || '',
      active: row.active !== false && row.status !== 'inactive',
    })
    setModalOpen(true)
  }

  const handleSave = (e) => {
    e.preventDefault()
    if (!selectedService) return
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
      save({
        id: editing?.id,
        tenantId,
        service_id: selectedService.id,
        service_name: selectedService.name,
        name: form.name.trim(),
        subcategory: form.subcategory.trim() || selectedService.name,
        price: Number(form.price) || 0,
        registration_fee: Number(form.registration_fee) || 0,
        frequency: form.frequency,
        service_type: form.service_type,
        visits: form.visits === '' ? '' : Number(form.visits),
        description: form.description.trim(),
        active: Boolean(form.active),
        status: form.active ? 'active' : 'inactive',
      })
      setStatus({
        type: 'success',
        message: editing ? 'Package updated.' : 'Package created.',
      })
      setModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={eyebrow || 'Organization'}
        title="Packages"
        description="Pick a service, then manage pricing packages for that service."
      />

      <StatusBanner type={status.type} message={status.message} />

      <Panel className="p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <FiGrid className="h-4 w-4 text-brand-600" aria-hidden />
          Services
        </div>
        {services.length === 0 ? (
          <p className="text-sm text-slate-500">No services yet. Create services first.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {services.map((svc) => {
              const active = String(svc.id) === String(selectedServiceId)
              return (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => setSelectedServiceId(String(svc.id))}
                  className={`rounded-xl border px-3 py-2 text-left text-sm font-medium transition-colors ${
                    active
                      ? 'border-brand-500 bg-brand-50 text-brand-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {svc.name}
                </button>
              )
            })}
          </div>
        )}
      </Panel>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FiPackage className="h-4 w-4 text-brand-600" aria-hidden />
            Packages {selectedService ? `(${selectedService.name})` : '(Service)'}
          </div>
          {canWrite ? (
            <button type="button" className={btnPrimary} onClick={openCreate} disabled={!selectedService}>
              <FiPlus className="h-4 w-4" aria-hidden />
              Add Package
            </button>
          ) : (
            <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
              Read only
            </span>
          )}
        </div>

        {!selectedService ? (
          <EmptyState bare title="Select a service" hint="Choose a service above to view packages." />
        ) : filteredPackages.length === 0 ? (
          <EmptyState
            bare
            title="No packages for this service"
            hint={canWrite ? 'Create a package for the selected service.' : 'Nothing on file.'}
            actionLabel={canWrite ? 'Add Package' : undefined}
            onAction={canWrite ? openCreate : undefined}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredPackages.map((pkg) => (
              <article
                key={pkg.id}
                className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900">{pkg.name}</h3>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {pkg.subcategory || pkg.service_name || selectedService.name}
                    </p>
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
                  Registration Fee: {money(pkg.registration_fee ?? 0)}
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <FiClock className="h-3.5 w-3.5" aria-hidden />
                    {pkg.frequency || 'MONTHLY'}
                  </span>
                  <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-800">
                    {(pkg.service_type || 'IN_HOUSE').replace(/_/g, ' ')}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit package' : 'Add Package'}
        onClose={() => setModalOpen(false)}
        wide
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="package-form" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add Package'}
            </button>
          </div>
        }
      >
        <form id="package-form" className="space-y-3" onSubmit={handleSave}>
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-900">
            Service: <span className="font-semibold">{selectedService?.name}</span>
          </p>
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="pkg-sub">
                Sub-category
              </label>
              <input
                id="pkg-sub"
                className={fieldClass}
                placeholder="Geriatric care"
                value={form.subcategory}
                onChange={(e) => set('subcategory', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="pkg-type">
                Service type
              </label>
              <select
                id="pkg-type"
                className={fieldClass}
                value={form.service_type}
                onChange={(e) => set('service_type', e.target.value)}
              >
                {SERVICE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="pkg-price">
                Price <span className="text-rose-600">*</span>
              </label>
              <input
                id="pkg-price"
                type="number"
                min="0"
                className={fieldClass}
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="pkg-reg">
                Registration fee
              </label>
              <input
                id="pkg-reg"
                type="number"
                min="0"
                className={fieldClass}
                value={form.registration_fee}
                onChange={(e) => set('registration_fee', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="pkg-freq">
                Frequency
              </label>
              <select
                id="pkg-freq"
                className={fieldClass}
                value={form.frequency}
                onChange={(e) => set('frequency', e.target.value)}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="pkg-visits">
                Visits (optional)
              </label>
              <input
                id="pkg-visits"
                type="number"
                min="0"
                className={fieldClass}
                value={form.visits}
                onChange={(e) => set('visits', e.target.value)}
              />
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
              checked={form.active}
              onChange={(e) => set('active', e.target.checked)}
            />
            Active
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete package?"
        message="This removes the package from demo data for this service."
        confirmLabel="Delete"
        onConfirm={() => {
          remove(deleteTarget.id)
          setStatus({ type: 'success', message: 'Package removed.' })
          setDeleteTarget(null)
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export default PackagesPage
