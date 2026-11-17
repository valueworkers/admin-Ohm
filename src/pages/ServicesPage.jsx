import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiBriefcase, FiEdit2, FiImage, FiMapPin, FiPhone, FiPlus, FiTrash2 } from 'react-icons/fi'
import {
  createService,
  deleteService,
  fetchServices,
  fetchVenues,
  updateService,
} from '../api/catalog'
import CatalogPhotosModal from '../components/CatalogPhotosModal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/PageState'
import { useAccess } from '../hooks/useAccess'
import { useVenueScope } from '../hooks/useVenueScope'
import { apiErrorMessage } from '../utils/errors'
import { resolveCatalogTenantSlug } from '../utils/tenantHeader'
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  fieldClass,
  labelClass,
  tableHeadClass,
  tableWrapClass,
} from '../utils/ui'

const SERVICE_TYPES = ['IN_HOUSE', 'OPD', 'CLIENT_SIDE']

const EMPTY = {
  name: '',
  service_type: 'OPD',
  description: '',
  address: '',
  city: '',
  contact: '',
  website: '',
  venue_ids: [],
  tags: '',
  duration_mins: '45',
}

const LocationCell = ({ locations }) => {
  if (!locations.length) return <span className="text-slate-400">—</span>
  if (locations.length === 1) {
    return (
      <span className="inline-flex max-w-[220px] items-center gap-1.5 text-slate-700">
        <FiMapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
        <span className="truncate">{locations[0]}</span>
      </span>
    )
  }
  return (
    <label className="inline-flex max-w-[220px] items-center gap-1.5 text-slate-700">
      <FiMapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
      <select
        className="max-w-[180px] truncate rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
        aria-label="Service locations"
        defaultValue={locations[0]}
      >
        {locations.map((loc) => (
          <option key={loc} value={loc}>
            {loc}
          </option>
        ))}
      </select>
    </label>
  )
}

const ServicesPage = ({ tenantId: tenantIdProp, canWrite: canWriteProp, eyebrow } = {}) => {
  const access = useAccess()
  const tenantId = tenantIdProp || access.tenantId
  const canWrite = canWriteProp ?? access.canWrite
  const { isSuperAdmin } = access
  const tenantSlug = resolveCatalogTenantSlug(access.tenant)

  const [rows, setRows] = useState([])
  const [venues, setVenues] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const { selectedId, displayVenues, allVenues, tenantRestricted } = useVenueScope(
    tenantId,
    venues
  )

  const [status, setStatus] = useState({ type: '', message: '' })
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [photoTarget, setPhotoTarget] = useState(null)

  const load = useCallback(async () => {
    if (!tenantSlug) {
      setRows([])
      setVenues([])
      setLoadError('')
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      const [serviceRows, venueRows] = await Promise.all([
        fetchServices(tenantSlug),
        fetchVenues(tenantSlug),
      ])
      setRows(serviceRows)
      setVenues(venueRows)
    } catch (err) {
      setRows([])
      setVenues([])
      setLoadError(apiErrorMessage(err, 'Could not load services.'))
    } finally {
      setLoading(false)
    }
  }, [tenantSlug])

  useEffect(() => {
    load()
  }, [load])

  const venueMap = useMemo(() => {
    const map = new Map()
    venues.forEach((v) => map.set(String(v.id), v))
    return map
  }, [venues])

  const visibleServices = useMemo(() => {
    if (!tenantRestricted || !selectedId) return rows
    return rows.filter((row) => {
      const ids = Array.isArray(row.venue_ids) ? row.venue_ids.map(String) : []
      return !ids.length || ids.includes(String(selectedId))
    })
  }, [rows, tenantRestricted, selectedId])

  const resolveLocations = (row) => {
    const ids = Array.isArray(row.venue_ids) ? row.venue_ids : []
    if (ids.length) {
      return ids
        .map((id) => {
          const v = venueMap.get(String(id))
          if (!v) return null
          const area = v.locality || v.city || ''
          return area ? `${v.name} (${area})` : v.name
        })
        .filter(Boolean)
    }
    if (row.address) return [[row.address, row.city].filter(Boolean).join(', ')]
    return []
  }

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const toggleVenue = (id) => {
    if (tenantRestricted) {
      setForm((f) => ({ ...f, venue_ids: [String(id)] }))
      return
    }
    setForm((f) => {
      const sid = String(id)
      const has = f.venue_ids.map(String).includes(sid)
      return {
        ...f,
        venue_ids: has ? f.venue_ids.filter((x) => String(x) !== sid) : [...f.venue_ids, sid],
      }
    })
  }

  const openCreate = () => {
    setEditing(null)
    setForm({
      ...EMPTY,
      venue_ids: tenantRestricted && selectedId ? [String(selectedId)] : [],
    })
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      name: row.name || '',
      service_type: row.service_type || 'OPD',
      description: row.description || '',
      address: row.address || '',
      city: row.city || '',
      contact: row.contact || '',
      website: row.website || '',
      venue_ids: Array.isArray(row.venue_ids) ? row.venue_ids.map(String) : [],
      tags: Array.isArray(row.tags) ? row.tags.join(', ') : '',
      duration_mins: String(row.duration_mins ?? 45),
    })
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!tenantSlug) return
    const required = [
      ['name', 'Service name'],
      ['contact', 'Contact number'],
      ['address', 'Address'],
      ['city', 'City'],
    ]
    for (const [key, label] of required) {
      if (!String(form[key] ?? '').trim()) {
        setStatus({ type: 'error', message: `${label} is required.` })
        return
      }
    }

    setSaving(true)
    try {
      if (editing) {
        await updateService(tenantSlug, editing.id, form)
        setStatus({ type: 'success', message: 'Service updated.' })
        setModalOpen(false)
      } else {
        const created = await createService(tenantSlug, form)
        setStatus({ type: 'success', message: 'Service created. Add photos next.' })
        setModalOpen(false)
        if (created?.id) {
          setPhotoTarget({ id: created.id, name: created.name || form.name })
        }
      }
      await load()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not save service.') })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    const target = deleteTarget
    if (!target || !tenantSlug) return
    setDeleting(true)
    try {
      await deleteService(tenantSlug, target.id)
      setStatus({ type: 'success', message: 'Service removed.' })
      await load()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not delete service.') })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={eyebrow || 'Organization'}
        title="Services"
        description={
          isSuperAdmin
            ? 'Add and edit every service for the selected tenant.'
            : tenantRestricted
              ? 'Services assigned to your organization (Single venue mode applies).'
              : 'Care services available for your organization.'
        }
        actions={
          canWrite ? (
            <button
              type="button"
              className={btnPrimary}
              onClick={openCreate}
              disabled={!tenantSlug}
            >
              <FiPlus className="h-4 w-4" aria-hidden />
              Add service
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
        <StatusBanner
          type="warning"
          message="Select or activate a tenant first so X-Tenant can be sent."
        />
      )}
      <StatusBanner type={status.type} message={status.message} />

      <div className={tableWrapClass}>
        {!tenantSlug ? (
          <EmptyState
            bare
            title="No tenant selected"
            hint="Services load once a tenant is selected."
          />
        ) : loading ? (
          <LoadingState label="Loading services…" />
        ) : loadError ? (
          <ErrorState bare message={loadError} onRetry={load} />
        ) : rows.length === 0 ? (
          <EmptyState
            bare
            title="No services yet"
            hint={canWrite ? 'Add your first service to get started.' : 'Nothing on file for this tenant.'}
            actionLabel={canWrite ? 'Add service' : undefined}
            onAction={canWrite ? openCreate : undefined}
          />
        ) : visibleServices.length === 0 ? (
          <EmptyState
            bare
            title="No services available"
            hint="No services are linked to the selected venue."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Website</th>
                  <th className="px-4 py-3">Tags</th>
                  <th className="px-4 py-3">Duration</th>
                  {canWrite ? <th className="px-4 py-3 text-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {visibleServices.map((row) => {
                  const tags = Array.isArray(row.tags) ? row.tags : []
                  return (
                    <tr key={row.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3 font-semibold text-stone-900">{row.name}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800">
                          {row.service_type || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <LocationCell locations={resolveLocations(row)} />
                      </td>
                      <td className="px-4 py-3">
                        {row.contact ? (
                          <span className="inline-flex items-center gap-1.5 text-slate-700">
                            <FiPhone className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                            {row.contact}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {row.website ? (
                          <a
                            href={row.website}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-700 hover:underline"
                          >
                            {row.website.replace(/^https?:\/\//, '').slice(0, 28)}
                            {row.website.length > 36 ? '…' : ''}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {tags.length
                            ? tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                                >
                                  <FiBriefcase className="h-3 w-3 text-slate-400" aria-hidden />
                                  {tag}
                                </span>
                              ))
                            : '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {row.duration_mins ? `${row.duration_mins} min` : '—'}
                      </td>
                      {canWrite ? (
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              className={btnGhost}
                              onClick={() => openEdit(row)}
                              aria-label={`Edit ${row.name}`}
                            >
                              <FiEdit2 className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            <button
                              type="button"
                              className={btnGhost}
                              onClick={() => setPhotoTarget({ id: row.id, name: row.name })}
                              aria-label={`Photos for ${row.name}`}
                            >
                              <FiImage className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            <button
                              type="button"
                              className={`${btnGhost} text-rose-600 hover:bg-rose-50`}
                              onClick={() => setDeleteTarget(row)}
                              aria-label={`Delete ${row.name}`}
                            >
                              <FiTrash2 className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit service' : 'Add New Service'}
        onClose={() => setModalOpen(false)}
        xl
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="service-form" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add Service'}
            </button>
          </div>
        }
      >
        <form id="service-form" className="space-y-3" onSubmit={handleSave}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="svc-name">
                Service Name <span className="text-rose-600">*</span>
              </label>
              <input
                id="svc-name"
                className={fieldClass}
                placeholder="Enter service name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="svc-type">
                Service Type
              </label>
              <select
                id="svc-type"
                className={fieldClass}
                value={form.service_type}
                onChange={(e) => set('service_type', e.target.value)}
              >
                {(SERVICE_TYPES.includes(form.service_type)
                  ? SERVICE_TYPES
                  : [form.service_type, ...SERVICE_TYPES]
                ).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="svc-contact">
                Contact Number <span className="text-rose-600">*</span>
              </label>
              <input
                id="svc-contact"
                className={fieldClass}
                placeholder="+91 98765 43210"
                value={form.contact}
                onChange={(e) => set('contact', e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="svc-duration">
                Duration (mins)
              </label>
              <input
                id="svc-duration"
                type="number"
                min="1"
                className={fieldClass}
                value={form.duration_mins}
                onChange={(e) => set('duration_mins', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="svc-address">
                Address <span className="text-rose-600">*</span>
              </label>
              <input
                id="svc-address"
                className={fieldClass}
                placeholder="Street address"
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="svc-city">
                City <span className="text-rose-600">*</span>
              </label>
              <input
                id="svc-city"
                className={fieldClass}
                placeholder="City"
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <p className={labelClass}>
              {tenantRestricted ? 'Venue' : 'Venues (optional, select multiple)'}
            </p>
            {displayVenues.length === 0 ? (
              <p className="rounded-lg border border-dashed border-stone-200 px-3 py-3 text-sm text-stone-500">
                {allVenues.length === 0
                  ? 'No venues yet — add venues first, or rely on address/city for location.'
                  : 'No venue assigned for Single mode yet.'}
              </p>
            ) : (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-stone-200 p-2">
                {displayVenues.map((v) => {
                  const checked = form.venue_ids.map(String).includes(String(v.id))
                  const area = v.locality || v.city
                  const label = area ? `${v.name} (${area})` : v.name
                  return (
                    <label
                      key={v.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-stone-50"
                    >
                      <input
                        type={tenantRestricted ? 'radio' : 'checkbox'}
                        name="service-venue"
                        className="rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                        checked={checked}
                        onChange={() => toggleVenue(v.id)}
                      />
                      <span className="text-stone-800">{label}</span>
                    </label>
                  )
                })}
              </div>
            )}
            <p className="mt-1 text-xs text-stone-500">
              {tenantRestricted
                ? 'Your org is limited to the Super Admin–selected venue.'
                : 'If multiple venues are selected, the table shows them in a location dropdown.'}
            </p>
          </div>

          <div>
            <label className={labelClass} htmlFor="svc-web">
              Website URL
            </label>
            <input
              id="svc-web"
              className={fieldClass}
              placeholder="https://example.com"
              value={form.website}
              onChange={(e) => set('website', e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="svc-desc">
              Description
            </label>
            <textarea
              id="svc-desc"
              rows={3}
              className={fieldClass}
              placeholder="Enter service description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="svc-tags">
              Tags
            </label>
            <input
              id="svc-tags"
              className={fieldClass}
              placeholder="Home Care, Nursing Care, Physiotherapy (comma separated)"
              value={form.tags}
              onChange={(e) => set('tags', e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">Separate multiple tags with commas.</p>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete service?"
        message="This permanently removes the service for this tenant."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />

      <CatalogPhotosModal
        open={Boolean(photoTarget?.id)}
        onClose={() => setPhotoTarget(null)}
        tenantSlug={tenantSlug}
        entityType="service"
        objectId={photoTarget?.id}
        title={
          photoTarget?.name
            ? `Photos · ${photoTarget.name}`
            : `Photos · service #${photoTarget?.id || ''}`
        }
        canWrite={canWrite}
      />
    </div>
  )
}

export default ServicesPage
