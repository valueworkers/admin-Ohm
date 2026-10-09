import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FiBriefcase,
  FiEdit2,
  FiMapPin,
  FiPhone,
  FiPlus,
  FiTrash2,
} from 'react-icons/fi'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import { EmptyState } from '../components/ui/PageState'
import { useAccess } from '../hooks/useAccess'
import { usePlatformCollection } from '../hooks/usePlatformCollection'
import { useVenueScope } from '../hooks/useVenueScope'
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  fieldClass,
  labelClass,
  tableHeadClass,
  tableWrapClass,
} from '../utils/ui'

const SERVICE_TYPES = [
  'Care Companion',
  'Home Care',
  'Nursing',
  'Physiotherapy',
  'Medical Equipment',
  'Daycare',
  'Other',
]

const EMPTY = {
  name: '',
  contact: '',
  email: '',
  address: '',
  city: '',
  service_type: '',
  venue_ids: [],
  photos: [],
  logo_url: '',
  website: '',
  description: '',
  tags: '',
  active: true,
  show_to_tenant: true,
}

const isShownToTenant = (row) => row.show_to_tenant !== false

const readFilesAsDataUrls = (files, max = 6) =>
  Promise.all(
    Array.from(files || [])
      .slice(0, max)
      .filter((f) => f.type.startsWith('image/'))
      .map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result || ''))
            reader.onerror = () => resolve('')
            reader.readAsDataURL(file)
          })
      )
  ).then((urls) => urls.filter(Boolean))

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

const parseTags = (value) =>
  String(value || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

const ServicesPage = ({ tenantId: tenantIdProp, canWrite: canWriteProp, eyebrow } = {}) => {
  const access = useAccess()
  const tenantId = tenantIdProp || access.tenantId
  const canWrite = canWriteProp ?? access.canWrite
  const { rows, save, remove } = usePlatformCollection('services', tenantId)
  const { rows: venues } = usePlatformCollection('venues', tenantId)
  const { isSuperAdmin } = access
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
  const photoRef = useRef(null)
  const logoRef = useRef(null)

  const venueMap = useMemo(() => {
    const map = new Map()
    venues.forEach((v) => map.set(String(v.id), v))
    return map
  }, [venues])

  const visibleServices = useMemo(() => {
    let list = rows
    if (!isSuperAdmin) {
      list = list.filter(isShownToTenant)
    }
    if (tenantRestricted && selectedId) {
      list = list.filter((row) => {
        const ids = Array.isArray(row.venue_ids) ? row.venue_ids.map(String) : []
        if (!ids.length) return true
        return ids.includes(String(selectedId))
      })
    }
    return list
  }, [rows, isSuperAdmin, tenantRestricted, selectedId])

  const resolveLocations = (row) => {
    const ids = Array.isArray(row.venue_ids) ? row.venue_ids : []
    if (ids.length) {
      return ids
        .map((id) => {
          const v = venueMap.get(String(id))
          if (!v) return null
          const area = v.area || v.city || ''
          return area ? `${v.name} (${area})` : v.name
        })
        .filter(Boolean)
    }
    if (row.address) {
      const bits = [row.address, row.city].filter(Boolean)
      return [bits.join(', ')]
    }
    return []
  }

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const toggleVenue = (id) => {
    if (tenantRestricted) {
      setForm((f) => ({ ...f, venue_ids: [id] }))
      return
    }
    setForm((f) => {
      const sid = String(id)
      const has = f.venue_ids.map(String).includes(sid)
      return {
        ...f,
        venue_ids: has ? f.venue_ids.filter((x) => String(x) !== sid) : [...f.venue_ids, id],
      }
    })
  }

  const openCreate = () => {
    setEditing(null)
    setForm({
      ...EMPTY,
      venue_ids: tenantRestricted && selectedId ? [selectedId] : [],
    })
    setModalOpen(true)
  }

  useEffect(() => {
    if (!modalOpen || !tenantRestricted || !selectedId) return
    setForm((f) => {
      const ids = f.venue_ids.map(String)
      if (ids.length === 1 && ids[0] === String(selectedId)) return f
      return { ...f, venue_ids: [selectedId] }
    })
  }, [modalOpen, tenantRestricted, selectedId])

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      name: row.name || '',
      contact: row.contact || '',
      email: row.email || '',
      address: row.address || '',
      city: row.city || '',
      service_type: row.service_type || row.category || '',
      venue_ids: Array.isArray(row.venue_ids) ? [...row.venue_ids] : [],
      photos: Array.isArray(row.photos) ? [...row.photos] : [],
      logo_url: row.logo_url || '',
      website: row.website || '',
      description: row.description || '',
      tags: Array.isArray(row.tags) ? row.tags.join(', ') : row.tags || '',
      active: row.active !== false && row.status !== 'inactive',
      show_to_tenant: isShownToTenant(row),
    })
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setStatus({ type: 'error', message: 'Service name is required.' })
      return
    }
    if (!form.contact.trim()) {
      setStatus({ type: 'error', message: 'Contact number is required.' })
      return
    }
    if (!form.address.trim() || !form.city.trim()) {
      setStatus({ type: 'error', message: 'Address and city are required.' })
      return
    }
    const tags = parseTags(form.tags)
    if (!tags.length) {
      setStatus({ type: 'error', message: 'Add at least one tag (comma separated).' })
      return
    }

    setSaving(true)
    try {
      save({
        id: editing?.id,
        tenantId,
        name: form.name.trim(),
        contact: form.contact.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        service_type: form.service_type,
        category: form.service_type || 'Other',
        venue_ids: form.venue_ids,
        photos: form.photos,
        logo_url: form.logo_url,
        website: form.website.trim(),
        description: form.description.trim(),
        tags,
        active: Boolean(form.active),
        status: form.active ? 'active' : 'inactive',
        show_to_tenant: isSuperAdmin ? Boolean(form.show_to_tenant) : isShownToTenant(editing || {}),
      })
      setStatus({
        type: 'success',
        message: editing ? 'Service updated.' : 'Service created.',
      })
      setModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = (row) => {
    if (!canWrite) return
    const next = !(row.active !== false && row.status !== 'inactive')
    save({
      ...row,
      active: next,
      status: next ? 'active' : 'inactive',
    })
  }

  const toggleShowToTenant = (row) => {
    if (!isSuperAdmin) return
    const next = !isShownToTenant(row)
    save({ ...row, show_to_tenant: next })
    setStatus({
      type: 'success',
      message: next
        ? `${row.name} is now visible to the tenant.`
        : `${row.name} is hidden from the tenant.`,
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={eyebrow || 'Organization'}
        title="Services"
        description={
          isSuperAdmin
            ? 'Choose which services this tenant can see using Show to tenant. You can still add and edit every service.'
            : tenantRestricted
              ? 'Services assigned to your organization (Single venue mode applies).'
              : 'Care services available for your organization.'
        }
        actions={
          canWrite ? (
            <button type="button" className={btnPrimary} onClick={openCreate}>
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

      <StatusBanner type={status.type} message={status.message} />

      <div className={tableWrapClass}>
        {rows.length === 0 ? (
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
            title={isSuperAdmin ? 'No services match' : 'No services available'}
            hint={
              isSuperAdmin
                ? 'Add a service or adjust filters.'
                : 'Super Admin has not shared any services with your organization yet.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Website</th>
                  <th className="px-4 py-3">Tags</th>
                  <th className="px-4 py-3">Active</th>
                  {isSuperAdmin ? <th className="px-4 py-3">Show to tenant</th> : null}
                  {canWrite ? <th className="px-4 py-3 text-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {visibleServices.map((row) => {
                  const active = row.active !== false && row.status !== 'inactive'
                  const shown = isShownToTenant(row)
                  const tags = Array.isArray(row.tags)
                    ? row.tags
                    : parseTags(row.tags || row.service_type || row.category)
                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-stone-50 ${isSuperAdmin && !shown ? 'opacity-70' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {row.logo_url ? (
                            <img
                              src={row.logo_url}
                              alt=""
                              className="h-8 w-8 rounded-lg object-cover"
                            />
                          ) : null}
                          <span className="font-semibold text-stone-900">{row.name}</span>
                        </div>
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
                          {tags.length ? (
                            tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                              >
                                <FiBriefcase className="h-3 w-3 text-slate-400" aria-hidden />
                                {tag}
                              </span>
                            ))
                          ) : (
                            '—'
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={active}
                          disabled={!canWrite}
                          onClick={() => toggleActive(row)}
                          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-not-allowed ${
                            active ? 'bg-emerald-500' : 'bg-stone-300'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                              active ? 'left-5' : 'left-0.5'
                            }`}
                          />
                        </button>
                      </td>
                      {isSuperAdmin ? (
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={shown}
                            aria-label={`Show ${row.name} to tenant`}
                            onClick={() => toggleShowToTenant(row)}
                            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
                              shown ? 'bg-brand-600' : 'bg-stone-300'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                                shown ? 'left-5' : 'left-0.5'
                              }`}
                            />
                          </button>
                        </td>
                      ) : null}
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
              <label className={labelClass} htmlFor="svc-email">
                Email
              </label>
              <input
                id="svc-email"
                type="email"
                className={fieldClass}
                placeholder="example@email.com"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
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
                <option value="">Select Service Type</option>
                {SERVICE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
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
                placeholder="City, State"
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
                  const label = v.area || v.city ? `${v.name} (${v.area || v.city})` : v.name
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="svc-photos">
                Photos (Multiple)
              </label>
              <input
                ref={photoRef}
                id="svc-photos"
                type="file"
                accept="image/*"
                multiple
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-800"
                onChange={async (e) => {
                  const urls = await readFilesAsDataUrls(e.target.files, 6)
                  set('photos', urls)
                }}
              />
              <p className="mt-1 text-xs text-slate-500">You can select multiple photos at once.</p>
              {form.photos.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {form.photos.map((src) => (
                    <img key={src.slice(0, 32)} src={src} alt="" className="h-12 w-12 rounded object-cover" />
                  ))}
                </div>
              ) : null}
            </div>
            <div>
              <label className={labelClass} htmlFor="svc-logo">
                Logo
              </label>
              <input
                ref={logoRef}
                id="svc-logo"
                type="file"
                accept="image/*"
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-800"
                onChange={async (e) => {
                  const urls = await readFilesAsDataUrls(e.target.files, 1)
                  set('logo_url', urls[0] || '')
                }}
              />
              {form.logo_url ? (
                <img src={form.logo_url} alt="" className="mt-2 h-12 w-12 rounded object-cover" />
              ) : null}
            </div>
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
              Services / Tags <span className="text-rose-600">*</span>
            </label>
            <input
              id="svc-tags"
              className={fieldClass}
              placeholder="Home Care, Nursing Care, Physiotherapy, Medical Equipment (comma separated)"
              value={form.tags}
              onChange={(e) => set('tags', e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-slate-500">Separate multiple services with commas.</p>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                className="rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                checked={form.active}
                onChange={(e) => set('active', e.target.checked)}
              />
              Active
            </label>
            {isSuperAdmin ? (
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  className="rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                  checked={Boolean(form.show_to_tenant)}
                  onChange={(e) => set('show_to_tenant', e.target.checked)}
                />
                Show to tenant
              </label>
            ) : null}
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete service?"
        message="This removes the service from demo data for this tenant."
        confirmLabel="Delete"
        onConfirm={() => {
          remove(deleteTarget.id)
          setStatus({ type: 'success', message: 'Service removed.' })
          setDeleteTarget(null)
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export default ServicesPage
