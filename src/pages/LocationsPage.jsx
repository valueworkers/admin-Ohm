import { useCallback, useEffect, useState } from 'react'
import { FiEdit2, FiMapPin, FiPlus, FiTrash2 } from 'react-icons/fi'
import { createLocation, deleteLocation, fetchLocations, updateLocation } from '../api/billingCatalog'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/PageState'
import { useAccess } from '../hooks/useAccess'
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
  location_type: 'OPD',
  building_name: '',
  address_line1: '',
  address_line2: '',
  locality: '',
  city: '',
  state: '',
  postal_code: '',
}

const FIELDS = [
  ['building_name', 'Building name', true],
  ['address_line1', 'Address line 1', true],
  ['address_line2', 'Address line 2', false],
  ['locality', 'Locality', true],
  ['city', 'City', true],
  ['state', 'State', true],
  ['postal_code', 'Postal code', true],
]

const LocationsPage = () => {
  const access = useAccess()
  const canWrite = access.canWrite
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
      setRows(await fetchLocations(tenantSlug))
    } catch (err) {
      setRows([])
      setLoadError(apiErrorMessage(err, 'Could not load locations.'))
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
    setForm(Object.fromEntries(Object.keys(EMPTY).map((k) => [k, row[k] || EMPTY[k]])))
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!tenantSlug) return
    const missing = FIELDS.find(([key, , req]) => req && !String(form[key] || '').trim())
    if (missing) {
      setStatus({ type: 'error', message: `${missing[1]} is required.` })
      return
    }
    setSaving(true)
    try {
      if (editing) await updateLocation(tenantSlug, editing.id, form)
      else await createLocation(tenantSlug, form)
      setStatus({ type: 'success', message: editing ? 'Location updated.' : 'Location created.' })
      setModalOpen(false)
      await load()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not save location.') })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget || !tenantSlug) return
    setDeleting(true)
    try {
      await deleteLocation(tenantSlug, deleteTarget.id)
      setStatus({ type: 'success', message: 'Location removed.' })
      await load()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not delete location.') })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const typeOptions = LOCATION_TYPES.includes(form.location_type)
    ? LOCATION_TYPES
    : [form.location_type, ...LOCATION_TYPES]

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={access.tenant?.name || 'Organization'}
        title="Locations"
        description="Billing locations (OPD, in-house, client side) for this tenant."
        actions={
          canWrite ? (
            <button type="button" className={btnPrimary} onClick={openCreate} disabled={!tenantSlug}>
              <FiPlus className="h-4 w-4" aria-hidden />
              Add location
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

      <div className={tableWrapClass}>
        {!tenantSlug ? (
          <EmptyState bare title="No tenant selected" hint="Locations load once a tenant is selected." />
        ) : loading ? (
          <LoadingState label="Loading locations…" />
        ) : loadError ? (
          <ErrorState bare message={loadError} onRetry={load} />
        ) : rows.length === 0 ? (
          <EmptyState
            bare
            title="No locations yet"
            hint={canWrite ? 'Add a location to use in billing.' : 'Nothing on file.'}
            actionLabel={canWrite ? 'Add location' : undefined}
            onAction={canWrite ? openCreate : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Building</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">State</th>
                  <th className="px-4 py-3">Postal code</th>
                  {canWrite ? <th className="px-4 py-3 text-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-800">
                        {row.location_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-stone-900">{row.building_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <span className="inline-flex max-w-[280px] items-start gap-1.5">
                        <FiMapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                        <span className="line-clamp-2">
                          {[row.address_line1, row.address_line2, row.locality].filter(Boolean).join(', ') || '—'}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.city || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{row.state || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{row.postal_code || '—'}</td>
                    {canWrite ? (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            className={btnGhost}
                            onClick={() => openEdit(row)}
                            aria-label={`Edit ${row.building_name || 'location'}`}
                          >
                            <FiEdit2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            className={`${btnGhost} text-rose-600 hover:bg-rose-50`}
                            onClick={() => setDeleteTarget(row)}
                            aria-label={`Delete ${row.building_name || 'location'}`}
                          >
                            <FiTrash2 className="h-3.5 w-3.5" aria-hidden />
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
        title={editing ? 'Edit location' : 'Add location'}
        onClose={() => setModalOpen(false)}
        wide
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="location-form" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add location'}
            </button>
          </div>
        }
      >
        <form id="location-form" className="grid gap-3 sm:grid-cols-2" onSubmit={handleSave}>
          <div>
            <label className={labelClass} htmlFor="loc-type">
              Location type <span className="text-rose-600">*</span>
            </label>
            <select
              id="loc-type"
              className={fieldClass}
              value={form.location_type}
              onChange={(e) => set('location_type', e.target.value)}
            >
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          {FIELDS.map(([key, label, required]) => (
            <div key={key}>
              <label className={labelClass} htmlFor={`loc-${key}`}>
                {label} {required ? <span className="text-rose-600">*</span> : null}
              </label>
              <input
                id={`loc-${key}`}
                className={fieldClass}
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                required={required}
              />
            </div>
          ))}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete location?"
        message="This removes the billing location for this tenant."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export default LocationsPage
