import { useRef, useState } from 'react'
import { FiCheck, FiEdit2, FiMapPin, FiPlus, FiTrash2 } from 'react-icons/fi'
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

const LOCALITY_TYPES = ['Area', 'Colony', 'Layout', 'Village', 'Town', 'Ward', 'Other']

const EMPTY_HALL = { name: '', capacity: '' }

const EMPTY = {
  name: '',
  description: '',
  capacity: '',
  building_name: '',
  address_line1: '',
  address_line2: '',
  locality: '',
  locality_type: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'India',
  rooms: '',
  floors: '',
  car_parking: '',
  bike_parking: '',
  halls: [],
  photos: [],
  active: true,
}

const readFilesAsDataUrls = (files, max = 8) =>
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

const formatAddress = (row) => {
  const parts = [
    row.address_line1,
    row.locality,
    row.city,
    row.state,
    row.postal_code,
  ].filter(Boolean)
  return parts.join(', ') || row.address || '—'
}

const VenuesPage = ({ tenantId: tenantIdProp, canWrite: canWriteProp, eyebrow } = {}) => {
  const access = useAccess()
  const tenantId = tenantIdProp || access.tenantId
  const canWrite = canWriteProp ?? access.canWrite
  const { rows, save, remove } = usePlatformCollection('venues', tenantId)
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
  const photoRef = useRef(null)

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

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
      capacity: row.capacity ?? '',
      building_name: row.building_name || '',
      address_line1: row.address_line1 || row.address || '',
      address_line2: row.address_line2 || '',
      locality: row.locality || row.area || '',
      locality_type: row.locality_type || '',
      city: row.city || '',
      state: row.state || '',
      postal_code: row.postal_code || '',
      country: row.country || 'India',
      rooms: row.rooms ?? '',
      floors: row.floors ?? '',
      car_parking: row.car_parking ?? '',
      bike_parking: row.bike_parking ?? '',
      halls: Array.isArray(row.halls) ? row.halls.map((h) => ({ ...h })) : [],
      photos: Array.isArray(row.photos) ? [...row.photos] : [],
      active: row.active !== false && row.status !== 'inactive',
    })
    setModalOpen(true)
  }

  const addHall = () => setForm((f) => ({ ...f, halls: [...f.halls, { ...EMPTY_HALL }] }))

  const updateHall = (index, key, value) => {
    setForm((f) => ({
      ...f,
      halls: f.halls.map((h, i) => (i === index ? { ...h, [key]: value } : h)),
    }))
  }

  const removeHall = (index) => {
    setForm((f) => ({ ...f, halls: f.halls.filter((_, i) => i !== index) }))
  }

  const handleSave = (e) => {
    e.preventDefault()
    const required = [
      ['name', 'Venue name'],
      ['capacity', 'Capacity'],
      ['building_name', 'Building name'],
      ['address_line1', 'Address line 1'],
      ['address_line2', 'Address line 2'],
      ['locality', 'Locality'],
      ['locality_type', 'Locality type'],
      ['city', 'City'],
      ['state', 'State'],
      ['postal_code', 'Postal code'],
      ['country', 'Country'],
    ]
    for (const [key, label] of required) {
      if (!String(form[key] ?? '').trim()) {
        setStatus({ type: 'error', message: `${label} is required.` })
        return
      }
    }

    setSaving(true)
    try {
      const area = form.locality.trim()
      save({
        id: editing?.id,
        tenantId,
        name: form.name.trim(),
        description: form.description.trim(),
        capacity: Number(form.capacity) || 0,
        building_name: form.building_name.trim(),
        address_line1: form.address_line1.trim(),
        address_line2: form.address_line2.trim(),
        locality: area,
        locality_type: form.locality_type,
        area,
        city: form.city.trim(),
        state: form.state.trim(),
        postal_code: form.postal_code.trim(),
        country: form.country.trim() || 'India',
        address: [form.address_line1, form.address_line2, area, form.city]
          .filter(Boolean)
          .join(', '),
        rooms: form.rooms === '' ? '' : Number(form.rooms),
        floors: form.floors === '' ? '' : Number(form.floors),
        car_parking: form.car_parking === '' ? '' : Number(form.car_parking),
        bike_parking: form.bike_parking === '' ? '' : Number(form.bike_parking),
        halls: form.halls
          .filter((h) => h.name?.trim())
          .map((h) => ({
            name: h.name.trim(),
            capacity: h.capacity === '' ? '' : Number(h.capacity),
          })),
        photos: form.photos,
        active: Boolean(form.active),
        status: form.active ? 'active' : 'inactive',
      })
      setStatus({
        type: 'success',
        message: editing ? 'Venue updated.' : 'Venue created.',
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
              <button type="button" className={btnPrimary} onClick={openCreate}>
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

      <StatusBanner type={status.type} message={status.message} />

      <div className={tableWrapClass}>
        {allVenues.length === 0 ? (
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
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Building</th>
                  <th className="px-4 py-3">Capacity</th>
                  <th className="px-4 py-3">Halls</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {displayVenues.map((row) => {
                  const active = row.active !== false && row.status !== 'inactive'
                  const hallCount = Array.isArray(row.halls) ? row.halls.length : 0
                  const isSelected = String(row.id) === String(selectedId)
                  return (
                    <tr key={row.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3 font-semibold text-stone-900">
                        <span className="inline-flex items-center gap-2">
                          {row.name}
                          {isSelected ? (
                            <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-800">
                              Selected
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex max-w-[260px] items-start gap-1.5 text-slate-700">
                          <FiMapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                          <span className="line-clamp-2">{formatAddress(row)}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.building_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{row.capacity ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{hallCount || '—'}</td>
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
          <div>
            <label className={labelClass} htmlFor="ven-name">
              Venue Name <span className="text-rose-600">*</span>
            </label>
            <input
              id="ven-name"
              className={fieldClass}
              placeholder="Enter venue name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
            />
          </div>
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
            <div>
              <label className={labelClass} htmlFor="ven-cap">
                Capacity <span className="text-rose-600">*</span>
              </label>
              <input
                id="ven-cap"
                type="number"
                min="0"
                className={fieldClass}
                placeholder="Enter capacity"
                value={form.capacity}
                onChange={(e) => set('capacity', e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ven-building">
                Building Name <span className="text-rose-600">*</span>
              </label>
              <input
                id="ven-building"
                className={fieldClass}
                placeholder="Enter building name"
                value={form.building_name}
                onChange={(e) => set('building_name', e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="ven-a1">
              Address Line 1 <span className="text-rose-600">*</span>
            </label>
            <input
              id="ven-a1"
              className={fieldClass}
              placeholder="Enter address line 1"
              value={form.address_line1}
              onChange={(e) => set('address_line1', e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="ven-a2">
              Address Line 2 <span className="text-rose-600">*</span>
            </label>
            <input
              id="ven-a2"
              className={fieldClass}
              placeholder="Enter address line 2"
              value={form.address_line2}
              onChange={(e) => set('address_line2', e.target.value)}
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="ven-locality">
                Locality <span className="text-rose-600">*</span>
              </label>
              <input
                id="ven-locality"
                className={fieldClass}
                placeholder="Enter locality"
                value={form.locality}
                onChange={(e) => set('locality', e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ven-loc-type">
                Locality Type <span className="text-rose-600">*</span>
              </label>
              <select
                id="ven-loc-type"
                className={fieldClass}
                value={form.locality_type}
                onChange={(e) => set('locality_type', e.target.value)}
                required
              >
                <option value="">Select locality type</option>
                {LOCALITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="ven-city">
                City <span className="text-rose-600">*</span>
              </label>
              <input
                id="ven-city"
                className={fieldClass}
                placeholder="Enter city"
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ven-state">
                State <span className="text-rose-600">*</span>
              </label>
              <input
                id="ven-state"
                className={fieldClass}
                placeholder="Enter state"
                value={form.state}
                onChange={(e) => set('state', e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ven-pin">
                Postal Code <span className="text-rose-600">*</span>
              </label>
              <input
                id="ven-pin"
                className={fieldClass}
                placeholder="Enter postal code"
                value={form.postal_code}
                onChange={(e) => set('postal_code', e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ven-country">
                Country <span className="text-rose-600">*</span>
              </label>
              <input
                id="ven-country"
                className={fieldClass}
                value={form.country}
                onChange={(e) => set('country', e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ven-rooms">
                Rooms
              </label>
              <input
                id="ven-rooms"
                type="number"
                min="0"
                className={fieldClass}
                placeholder="Rooms"
                value={form.rooms}
                onChange={(e) => set('rooms', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ven-floors">
                Floors
              </label>
              <input
                id="ven-floors"
                type="number"
                min="0"
                className={fieldClass}
                placeholder="Floors"
                value={form.floors}
                onChange={(e) => set('floors', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ven-car">
                Car Parking
              </label>
              <input
                id="ven-car"
                type="number"
                min="0"
                className={fieldClass}
                placeholder="Car spaces"
                value={form.car_parking}
                onChange={(e) => set('car_parking', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ven-bike">
                Bike Parking
              </label>
              <input
                id="ven-bike"
                type="number"
                min="0"
                className={fieldClass}
                placeholder="Bike spaces"
                value={form.bike_parking}
                onChange={(e) => set('bike_parking', e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">Halls (optional)</p>
                <p className="text-xs text-slate-500">Add named halls with optional capacity.</p>
              </div>
              <button type="button" className={btnSecondary} onClick={addHall}>
                <FiPlus className="h-3.5 w-3.5" aria-hidden />
                Add Hall
              </button>
            </div>
            {form.halls.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No halls added.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {form.halls.map((hall, index) => (
                  <div key={`hall-${index}`} className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
                    <input
                      className={fieldClass}
                      placeholder="Hall name"
                      value={hall.name}
                      onChange={(e) => updateHall(index, 'name', e.target.value)}
                    />
                    <input
                      type="number"
                      min="0"
                      className={fieldClass}
                      placeholder="Capacity"
                      value={hall.capacity}
                      onChange={(e) => updateHall(index, 'capacity', e.target.value)}
                    />
                    <button
                      type="button"
                      className={`${btnGhost} text-rose-600`}
                      onClick={() => removeHall(index)}
                      aria-label="Remove hall"
                    >
                      <FiTrash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className={labelClass} htmlFor="ven-photos">
              Venue Photos
            </label>
            <input
              ref={photoRef}
              id="ven-photos"
              type="file"
              accept="image/*"
              multiple
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-800"
              onChange={async (e) => {
                const urls = await readFilesAsDataUrls(e.target.files, 8)
                set('photos', urls)
              }}
            />
            <p className="mt-1 text-xs text-slate-500">You can select multiple photos at once.</p>
            {form.photos.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {form.photos.map((src) => (
                  <img key={src.slice(0, 40)} src={src} alt="" className="h-12 w-12 rounded object-cover" />
                ))}
              </div>
            ) : null}
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
        title="Delete venue?"
        message="Services linked to this venue will keep the id until you edit them."
        confirmLabel="Delete"
        onConfirm={() => {
          remove(deleteTarget.id)
          setStatus({ type: 'success', message: 'Venue removed.' })
          setDeleteTarget(null)
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export default VenuesPage
