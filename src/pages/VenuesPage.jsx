import { useCallback, useEffect, useState } from 'react'
import { FiCheck, FiEdit2, FiImage, FiMapPin, FiPlus, FiTrash2 } from 'react-icons/fi'
import { createVenue, deleteVenue, fetchVenues, updateVenue } from '../api/catalog'
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

const LOCATION_TYPES = ['OPD', 'IN_HOUSE', 'CLIENT_SIDE']

const EMPTY = {
  name: '',
  description: '',
  contact: '',
  website: '',
  instagram: '',
  capacity: '',
  price_per_event: '',
  rooms: '',
  floors: '',
  bike_parking: '',
  car_parking: '',
  amenities: '',
  seating_arrangement: '',
  location_type: 'OPD',
  building_name: '',
  address_line1: '',
  address_line2: '',
  locality: '',
  city: '',
  state: '',
  postal_code: '',
}

const REQUIRED = [
  ['name', 'Venue name'],
  ['contact', 'Contact'],
  ['capacity', 'Capacity'],
  ['building_name', 'Building name'],
  ['address_line1', 'Address line 1'],
  ['address_line2', 'Address line 2'],
  ['locality', 'Locality'],
  ['city', 'City'],
  ['state', 'State'],
  ['postal_code', 'Postal code'],
]

const formatAddress = (row) => {
  const parts = [row.address_line1, row.address_line2, row.locality, row.city, row.state, row.postal_code].filter(
    Boolean
  )
  return parts.join(', ') || '—'
}

const TextField = ({ id, label, required, form, set, name, type = 'text', ...rest }) => (
  <div>
    <label className={labelClass} htmlFor={id}>
      {label} {required ? <span className="text-rose-600">*</span> : null}
    </label>
    <input
      id={id}
      type={type}
      className={fieldClass}
      value={form[name]}
      onChange={(e) => set(name, e.target.value)}
      required={required}
      {...rest}
    />
  </div>
)

const VenuesPage = ({ tenantId: tenantIdProp, canWrite: canWriteProp, eyebrow } = {}) => {
  const access = useAccess()
  const tenantId = tenantIdProp || access.tenantId
  const canWrite = canWriteProp ?? access.canWrite
  const tenantSlug = resolveCatalogTenantSlug(access.tenant)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const {
    mode,
    selectedId,
    displayVenues,
    allVenues,
    switchMode,
    selectVenue,
    isSingle,
    canConfigureMode,
    tenantRestricted,
  } = useVenueScope(tenantId, rows)

  const [status, setStatus] = useState({ type: '', message: '' })
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [photoTarget, setPhotoTarget] = useState(null)

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const load = useCallback(async () => {
    if (!tenantSlug) {
      setRows([])
      setLoadError('')
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      setRows(await fetchVenues(tenantSlug))
    } catch (err) {
      setRows([])
      setLoadError(apiErrorMessage(err, 'Could not load venues.'))
    } finally {
      setLoading(false)
    }
  }, [tenantSlug])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      name: row.name || '',
      description: row.description || '',
      contact: row.contact || '',
      website: row.website || '',
      instagram: row.instagram || '',
      capacity: row.capacity ?? '',
      price_per_event: row.price_per_event ?? '',
      rooms: row.rooms ?? '',
      floors: row.floors ?? '',
      bike_parking: row.bike_parking ?? '',
      car_parking: row.car_parking ?? '',
      amenities: Array.isArray(row.amenities) ? row.amenities.join(', ') : '',
      seating_arrangement: Array.isArray(row.seating_arrangement)
        ? row.seating_arrangement.join(', ')
        : '',
      location_type: row.location_type || 'OPD',
      building_name: row.building_name || '',
      address_line1: row.address_line1 || '',
      address_line2: row.address_line2 || '',
      locality: row.locality || '',
      city: row.city || '',
      state: row.state || '',
      postal_code: row.postal_code || '',
    })
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!tenantSlug) return
    for (const [key, label] of REQUIRED) {
      if (!String(form[key] ?? '').trim()) {
        setStatus({ type: 'error', message: `${label} is required.` })
        return
      }
    }

    setSaving(true)
    try {
      if (editing) {
        await updateVenue(tenantSlug, editing.id, form)
        setStatus({ type: 'success', message: 'Venue updated.' })
        setModalOpen(false)
      } else {
        const created = await createVenue(tenantSlug, form)
        setStatus({ type: 'success', message: 'Venue created. Add photos next.' })
        setModalOpen(false)
        if (created?.id) {
          setPhotoTarget({ id: created.id, name: created.name || form.name })
        }
      }
      await load()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not save venue.') })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    const target = deleteTarget
    if (!target || !tenantSlug) return
    setDeleting(true)
    try {
      await deleteVenue(tenantSlug, target.id)
      setStatus({ type: 'success', message: 'Venue removed.' })
      await load()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not delete venue.') })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const locationOptions = LOCATION_TYPES.includes(form.location_type)
    ? LOCATION_TYPES
    : [form.location_type, ...LOCATION_TYPES]

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={eyebrow || 'Organization'}
        title="Venues"
        description={
          canConfigureMode
            ? isSingle
              ? 'Single (Super Admin) — tenants only see the selected venue. You can still add more venues here.'
              : 'Multi (Super Admin) — tenants see all venues. You can add and manage every location.'
            : tenantRestricted
              ? 'Your organization is in Single venue mode. Only the venue assigned by Super Admin is shown.'
              : 'Clinics and care venues for your organization.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canConfigureMode ? (
              <>
                <div
                  className="flex rounded-lg border border-stone-200 bg-stone-50 p-0.5"
                  role="group"
                  aria-label="Venue mode for tenant"
                >
                  {['single', 'multi'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`rounded-md px-2.5 py-1.5 text-xs font-semibold capitalize transition-colors ${
                        mode === m ? 'bg-brand-600 text-white' : 'text-stone-600 hover:bg-white'
                      }`}
                      onClick={() => switchMode(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                {isSingle && allVenues.length > 0 ? (
                  <select
                    className={`${fieldClass} w-auto min-w-[10rem] py-1.5 text-xs`}
                    value={selectedId}
                    onChange={(e) => selectVenue(e.target.value)}
                    aria-label="Selected venue for tenant"
                  >
                    {allVenues.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                ) : null}
              </>
            ) : null}
            {canWrite ? (
              <button
                type="button"
                className={btnPrimary}
                onClick={openCreate}
                disabled={!tenantSlug}
              >
                <FiPlus className="h-4 w-4" aria-hidden />
                Add venue
              </button>
            ) : (
              <span className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600">
                Read only
              </span>
            )}
          </div>
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
            hint="Venues load once a tenant is selected."
          />
        ) : loading ? (
          <LoadingState label="Loading venues…" />
        ) : loadError ? (
          <ErrorState bare message={loadError} onRetry={load} />
        ) : allVenues.length === 0 ? (
          <EmptyState
            bare
            title="No venues yet"
            hint={canWrite ? 'Add a venue so services can link locations.' : 'Nothing on file.'}
            actionLabel={canWrite ? 'Add venue' : undefined}
            onAction={canWrite ? openCreate : undefined}
          />
        ) : displayVenues.length === 0 ? (
          <EmptyState
            bare
            title="No venue assigned"
            hint="Super Admin has not selected a venue for Single mode yet."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-4 py-3">Venue</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Capacity</th>
                  <th className="px-4 py-3">Rooms / Floors</th>
                  <th className="px-4 py-3">Parking</th>
                  <th className="px-4 py-3 text-right">Price / event</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {displayVenues.map((row) => {
                  const active = row.active !== false
                  const isSelected = String(row.id) === String(selectedId)
                  return (
                    <tr key={row.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3">
                        <div className="flex min-w-[220px] items-center gap-3">
                          {row.photo_url ? (
                            <img
                              src={row.photo_url}
                              alt={row.name}
                              loading="lazy"
                              width={48}
                              height={48}
                              className="h-12 w-12 shrink-0 rounded-lg border border-stone-200 object-cover"
                            />
                          ) : (
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50 text-stone-400">
                              <FiImage className="h-4 w-4" aria-hidden />
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 font-semibold text-stone-900">
                              {row.name}
                              {isSelected ? (
                                <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-800">
                                  Selected
                                </span>
                              ) : null}
                            </p>
                            {row.description ? (
                              <p className="line-clamp-1 text-xs text-stone-500">{row.description}</p>
                            ) : null}
                            {row.photos.length > 1 ? (
                              <p className="text-xs text-stone-400">{row.photos.length} photos</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-[260px] text-slate-700">
                          <p className="flex items-center gap-1.5 font-medium text-stone-800">
                            <FiMapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                            {row.building_name || '—'}
                            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-800">
                              {row.location_type.replace(/_/g, ' ')}
                            </span>
                          </p>
                          <p className="line-clamp-2 text-xs text-stone-500">{formatAddress(row)}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.capacity ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {row.rooms} / {row.floors}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                        2W {row.bike_parking} · 4W {row.car_parking}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        ₹{Number(row.price_per_event || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <p>{row.contact || '—'}</p>
                        {row.website ? (
                          <a href={row.website} target="_blank" rel="noreferrer" className="text-xs text-brand-700 hover:underline">
                            Website
                          </a>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            active
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {canConfigureMode && !isSelected ? (
                            <button
                              type="button"
                              className={btnGhost}
                              onClick={() => selectVenue(row.id)}
                              aria-label={`Set ${row.name} as tenant selected venue`}
                            >
                              <FiCheck className="h-3.5 w-3.5" aria-hidden />
                              Use
                            </button>
                          ) : null}
                            {canWrite ? (
                              <>
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
                                onClick={() =>
                                  setPhotoTarget({ id: row.id, name: row.name, photos: row.photos })
                                }
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
                              </>
                            ) : null}
                        </div>
                      </td>
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
        title={editing ? 'Edit venue' : 'Add New Venue'}
        onClose={() => setModalOpen(false)}
        xl
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="venue-form" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add Venue'}
            </button>
          </div>
        }
      >
        <form id="venue-form" className="space-y-3" onSubmit={handleSave}>
          <TextField
            id="ven-name"
            label="Venue Name"
            required
            form={form}
            set={set}
            name="name"
            placeholder="Enter venue name"
          />
          <div>
            <label className={labelClass} htmlFor="ven-desc">
              Description
            </label>
            <textarea
              id="ven-desc"
              rows={3}
              className={fieldClass}
              placeholder="Enter venue description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              id="ven-contact"
              label="Contact"
              required
              form={form}
              set={set}
              name="contact"
              placeholder="+91 98765 43210"
            />
            <TextField
              id="ven-web"
              label="Website"
              form={form}
              set={set}
              name="website"
              placeholder="https://example.com"
            />
            <TextField
              id="ven-insta"
              label="Instagram"
              form={form}
              set={set}
              name="instagram"
              placeholder="https://instagram.com/venue"
            />
            <div>
              <label className={labelClass} htmlFor="ven-loc-type">
                Location Type
              </label>
              <select
                id="ven-loc-type"
                className={fieldClass}
                value={form.location_type}
                onChange={(e) => set('location_type', e.target.value)}
              >
                {locationOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <TextField
              id="ven-cap"
              label="Capacity"
              required
              form={form}
              set={set}
              name="capacity"
              type="number"
              min="0"
              placeholder="Enter capacity"
            />
            <TextField
              id="ven-price"
              label="Price per Event"
              form={form}
              set={set}
              name="price_per_event"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
            />
            <TextField
              id="ven-rooms"
              label="Rooms"
              form={form}
              set={set}
              name="rooms"
              type="number"
              min="0"
              placeholder="Rooms"
            />
            <TextField
              id="ven-floors"
              label="Floors"
              form={form}
              set={set}
              name="floors"
              type="number"
              min="0"
              placeholder="Floors"
            />
            <TextField
              id="ven-bike"
              label="Bike Parking"
              form={form}
              set={set}
              name="bike_parking"
              type="number"
              min="0"
              placeholder="Bike spaces"
            />
            <TextField
              id="ven-car"
              label="Car Parking"
              form={form}
              set={set}
              name="car_parking"
              type="number"
              min="0"
              placeholder="Car spaces"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="ven-amenities">
                Amenities
              </label>
              <input
                id="ven-amenities"
                className={fieldClass}
                placeholder="WiFi, AC, Wheelchair access"
                value={form.amenities}
                onChange={(e) => set('amenities', e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-500">Comma separated.</p>
            </div>
            <div>
              <label className={labelClass} htmlFor="ven-seating">
                Seating Arrangement
              </label>
              <input
                id="ven-seating"
                className={fieldClass}
                placeholder="Theatre, Classroom, Round tables"
                value={form.seating_arrangement}
                onChange={(e) => set('seating_arrangement', e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-500">Comma separated.</p>
            </div>
          </div>

          <TextField
            id="ven-building"
            label="Building Name"
            required
            form={form}
            set={set}
            name="building_name"
            placeholder="Enter building name"
          />
          <TextField
            id="ven-a1"
            label="Address Line 1"
            required
            form={form}
            set={set}
            name="address_line1"
            placeholder="Enter address line 1"
          />
          <TextField
            id="ven-a2"
            label="Address Line 2"
            required
            form={form}
            set={set}
            name="address_line2"
            placeholder="Enter address line 2"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              id="ven-locality"
              label="Locality"
              required
              form={form}
              set={set}
              name="locality"
              placeholder="Enter locality"
            />
            <TextField
              id="ven-city"
              label="City"
              required
              form={form}
              set={set}
              name="city"
              placeholder="Enter city"
            />
            <TextField
              id="ven-state"
              label="State"
              required
              form={form}
              set={set}
              name="state"
              placeholder="Enter state"
            />
            <TextField
              id="ven-pin"
              label="Postal Code"
              required
              form={form}
              set={set}
              name="postal_code"
              placeholder="Enter postal code"
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete venue?"
        message="Services linked to this venue may be affected."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />

      <CatalogPhotosModal
        open={Boolean(photoTarget?.id)}
        onClose={() => {
          setPhotoTarget(null)
          load()
        }}
        tenantSlug={tenantSlug}
        entityType="venue"
        initialPhotos={photoTarget?.photos}
        objectId={photoTarget?.id}
        title={
          photoTarget?.name
            ? `Photos · ${photoTarget.name}`
            : `Photos · venue #${photoTarget?.id || ''}`
        }
        canWrite={canWrite}
      />
    </div>
  )
}

export default VenuesPage
