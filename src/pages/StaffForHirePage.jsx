import { useCallback, useEffect, useState } from 'react'
import { FiEdit2, FiLoader, FiPlus, FiSearch, FiTrash2 } from 'react-icons/fi'
import {
  AVAILABLE_FOR_OPTIONS,
  LANGUAGE_SUGGESTIONS,
  SKILL_SUGGESTIONS,
  createStaffForHire,
  deleteStaffForHire,
  fetchStaffForHire,
  updateStaffForHire,
} from '../api/staffForHire'
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

const EMPTY = {
  staffName: '',
  vendorName: '',
  email: '',
  mobileNumber: '',
  availableFrom: '',
  availableFor: ['Day Shift'],
  language: [],
  skill: [],
  price: '',
  isActive: true,
  isAvailable: true,
}

const money = (v) => {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

const formatDate = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const toggleList = (list, value) => {
  const next = Array.isArray(list) ? [...list] : []
  const i = next.indexOf(value)
  if (i >= 0) next.splice(i, 1)
  else next.push(value)
  return next
}

const ChipToggle = ({ options, value, onChange, disabled }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map((opt) => {
      const on = (value || []).includes(opt)
      return (
        <button
          key={opt}
          type="button"
          disabled={disabled}
          onClick={() => onChange(toggleList(value, opt))}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
            on
              ? 'border-brand-300 bg-brand-50 text-brand-800'
              : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
          } disabled:opacity-50`}
        >
          {opt}
        </button>
      )
    })}
  </div>
)

const StaffForHirePage = () => {
  const access = useAccess()
  const canWrite = access.canWrite
  const tenantSlug = resolveCatalogTenantSlug(access.tenant)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [status, setStatus] = useState({ type: '', message: '' })
  const [search, setSearch] = useState('')
  const [searchApplied, setSearchApplied] = useState('')
  const [page, setPage] = useState(1)
  const [count, setCount] = useState(0)
  const pageSize = 20

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [skillInput, setSkillInput] = useState('')
  const [langInput, setLangInput] = useState('')

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const totalPages = Math.max(1, Math.ceil((count || 0) / pageSize) || 1)
  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const load = useCallback(async () => {
    if (!tenantSlug) {
      setRows([])
      setCount(0)
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      const data = await fetchStaffForHire(tenantSlug, {
        page,
        pageSize,
        search: searchApplied,
      })
      setRows(data.results)
      setCount(data.count)
    } catch (err) {
      setRows([])
      setCount(0)
      setLoadError(apiErrorMessage(err, 'Could not load staff for hire.'))
    } finally {
      setLoading(false)
    }
  }, [tenantSlug, page, searchApplied])

  useEffect(() => {
    load()
  }, [load])

  const runSearch = () => {
    setPage(1)
    setSearchApplied(search.trim())
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY })
    setFormError('')
    setSkillInput('')
    setLangInput('')
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      staffName: row.staffName,
      vendorName: row.vendorName,
      email: row.email,
      mobileNumber: row.mobileNumber,
      availableFrom: row.availableFrom,
      availableFor: row.availableFor?.length ? row.availableFor : ['Day Shift'],
      language: row.language || [],
      skill: row.skill || [],
      price: row.price != null && row.price !== '' ? String(row.price) : '',
      isActive: row.isActive,
      isAvailable: row.isAvailable,
    })
    setFormError('')
    setSkillInput('')
    setLangInput('')
    setModalOpen(true)
  }

  const closeModal = () => {
    if (saving) return
    setModalOpen(false)
    setEditing(null)
    setFormError('')
  }

  const addCsv = (field, raw) => {
    const parts = String(raw || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    if (!parts.length) return
    setForm((f) => {
      const cur = Array.isArray(f[field]) ? [...f[field]] : []
      parts.forEach((p) => {
        if (!cur.some((x) => x.toLowerCase() === p.toLowerCase())) cur.push(p)
      })
      return { ...f, [field]: cur }
    })
  }

  const validate = () => {
    if (!form.staffName.trim()) return 'Staff name is required.'
    if (!form.vendorName.trim()) return 'Vendor name is required.'
    if (!form.email.trim()) return 'Email is required.'
    if (!form.mobileNumber.trim()) return 'Mobile number is required.'
    if (!form.availableFrom) return 'Available from date is required.'
    if (!form.availableFor?.length) return 'Select at least one availability option.'
    if (!form.language?.length) return 'Add at least one language.'
    if (!form.skill?.length) return 'Add at least one skill.'
    const priceNum = Number(form.price)
    if (!Number.isFinite(priceNum) || priceNum < 0) return 'Enter a valid price.'
    return ''
  }

  const submit = async (e) => {
    e.preventDefault()
    const err = validate()
    if (err) {
      setFormError(err)
      return
    }
    setSaving(true)
    setFormError('')
    try {
      if (editing?.id) {
        await updateStaffForHire(tenantSlug, editing.id, form)
        setStatus({ type: 'success', message: 'Listing updated.' })
      } else {
        await createStaffForHire(tenantSlug, form)
        setStatus({ type: 'success', message: 'Listing created.' })
      }
      setModalOpen(false)
      setEditing(null)
      load()
    } catch (ex) {
      setFormError(apiErrorMessage(ex, editing ? 'Could not update listing.' : 'Could not create listing.'))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return
    setDeleting(true)
    try {
      await deleteStaffForHire(tenantSlug, deleteTarget.id)
      setStatus({ type: 'success', message: `Deleted ${deleteTarget.staffName || 'listing'}.` })
      setDeleteTarget(null)
      load()
    } catch (err) {
      setStatus({
        type: 'error',
        message: apiErrorMessage(err, 'Could not delete listing.'),
      })
    } finally {
      setDeleting(false)
    }
  }

  const toggleAvailable = async (row) => {
    if (!canWrite) return
    try {
      await updateStaffForHire(tenantSlug, row.id, { is_available: !row.isAvailable })
      setStatus({
        type: 'success',
        message: `${row.staffName} marked ${!row.isAvailable ? 'available' : 'unavailable'}.`,
      })
      load()
    } catch (err) {
      setStatus({
        type: 'error',
        message: apiErrorMessage(err, 'Could not update availability.'),
      })
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Manage Staff"
        title="Staff for hire"
        description={`Contract / vendor staff listings for ${access.tenant?.name || 'your organization'}.`}
        actions={
          canWrite ? (
            <button type="button" className={btnPrimary} onClick={openCreate} disabled={!tenantSlug}>
              <FiPlus className="h-4 w-4" />
              Add listing
            </button>
          ) : null
        }
      />

      {!tenantSlug ? (
        <StatusBanner type="warning" message="Select a tenant to load staff for hire." />
      ) : null}
      {status.message ? <StatusBanner type={status.type || 'info'} message={status.message} /> : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            className={`${fieldClass} pl-9`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                runSearch()
              }
            }}
            placeholder="Search name, vendor, skill…"
            aria-label="Search staff for hire"
            disabled={!tenantSlug || loading}
          />
        </div>
        <button type="button" className={btnPrimary} onClick={runSearch} disabled={!tenantSlug || loading}>
          Search
        </button>
      </div>

      {loadError ? <ErrorState message={loadError} onRetry={load} /> : null}
      {loading ? <LoadingState label="Loading staff for hire…" /> : null}

      {!loading && !loadError && tenantSlug ? (
        rows.length === 0 ? (
          <EmptyState
            title="No listings yet"
            hint={canWrite ? 'Add a staff-for-hire listing to get started.' : 'Nothing on file.'}
            actionLabel={canWrite ? 'Add listing' : undefined}
            onAction={canWrite ? openCreate : undefined}
          />
        ) : (
          <div className={tableWrapClass}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className={tableHeadClass}>
                  <tr>
                    <th className="px-3 py-3">Name</th>
                    <th className="px-3 py-3">Vendor</th>
                    <th className="px-3 py-3">Contact</th>
                    <th className="px-3 py-3">Available from</th>
                    <th className="px-3 py-3">Available for</th>
                    <th className="px-3 py-3">Language</th>
                    <th className="px-3 py-3">Skill</th>
                    <th className="px-3 py-3">Price</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t border-stone-100 hover:bg-stone-50/80">
                      <td className="px-3 py-2.5 font-medium text-stone-900">{row.staffName || '—'}</td>
                      <td className="px-3 py-2.5 text-stone-600">{row.vendorName || '—'}</td>
                      <td className="px-3 py-2.5 text-stone-600">
                        <div>{row.email || '—'}</div>
                        <div className="text-xs text-stone-400">{row.mobileNumber || ''}</div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-stone-600">
                        {formatDate(row.availableFrom)}
                      </td>
                      <td className="px-3 py-2.5 text-stone-600">
                        {row.availableFor?.length ? row.availableFor.join(', ') : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-stone-600">
                        {row.language?.length ? row.language.join(', ') : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-stone-600">
                        {row.skill?.length ? row.skill.join(', ') : '—'}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums font-medium">{money(row.price)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              row.isActive
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {row.isActive ? 'Active' : 'Inactive'}
                          </span>
                          <button
                            type="button"
                            className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              row.isAvailable
                                ? 'bg-brand-50 text-brand-800'
                                : 'bg-stone-100 text-stone-600'
                            }`}
                            onClick={() => toggleAvailable(row)}
                            disabled={!canWrite}
                            title="Toggle availability"
                          >
                            {row.isAvailable ? 'Available' : 'Unavailable'}
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {canWrite ? (
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              className={btnGhost}
                              onClick={() => openEdit(row)}
                              aria-label={`Edit ${row.staffName}`}
                            >
                              <FiEdit2 className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button
                              type="button"
                              className={`${btnGhost} text-rose-700`}
                              onClick={() => setDeleteTarget(row)}
                              aria-label={`Delete ${row.staffName}`}
                            >
                              <FiTrash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-stone-100 px-4 py-3 text-sm text-stone-600">
              <span>
                {count} listing{count === 1 ? '' : 's'} · page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )
      ) : null}

      <Modal
        open={modalOpen}
        title={editing ? 'Edit staff for hire' : 'Add staff for hire'}
        onClose={closeModal}
        wide
        footer={
          <>
            <button type="button" className={btnSecondary} onClick={closeModal} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="staff-for-hire-form" className={btnPrimary} disabled={saving}>
              {saving ? (
                <>
                  <FiLoader className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : editing ? (
                'Save changes'
              ) : (
                'Create listing'
              )}
            </button>
          </>
        }
      >
        {formError ? (
          <div className="mb-3">
            <StatusBanner type="error" message={formError} />
          </div>
        ) : null}
        <form id="staff-for-hire-form" className="space-y-4" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="sfh-name">
                Staff name <span className="text-rose-600">*</span>
              </label>
              <input
                id="sfh-name"
                className={fieldClass}
                value={form.staffName}
                onChange={(e) => setField('staffName', e.target.value)}
                disabled={saving}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="sfh-vendor">
                Vendor name <span className="text-rose-600">*</span>
              </label>
              <input
                id="sfh-vendor"
                className={fieldClass}
                value={form.vendorName}
                onChange={(e) => setField('vendorName', e.target.value)}
                disabled={saving}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="sfh-email">
                Email <span className="text-rose-600">*</span>
              </label>
              <input
                id="sfh-email"
                type="email"
                className={fieldClass}
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                disabled={saving}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="sfh-mobile">
                Mobile <span className="text-rose-600">*</span>
              </label>
              <input
                id="sfh-mobile"
                className={fieldClass}
                value={form.mobileNumber}
                onChange={(e) => setField('mobileNumber', e.target.value)}
                disabled={saving}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="sfh-from">
                Available from <span className="text-rose-600">*</span>
              </label>
              <input
                id="sfh-from"
                type="date"
                className={fieldClass}
                value={form.availableFrom}
                onChange={(e) => setField('availableFrom', e.target.value)}
                disabled={saving}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="sfh-price">
                Price (₹) <span className="text-rose-600">*</span>
              </label>
              <input
                id="sfh-price"
                type="number"
                min="0"
                step="0.01"
                className={fieldClass}
                value={form.price}
                onChange={(e) => setField('price', e.target.value)}
                disabled={saving}
                required
              />
            </div>
          </div>

          <div>
            <p className={labelClass}>
              Available for <span className="text-rose-600">*</span>
            </p>
            <ChipToggle
              options={AVAILABLE_FOR_OPTIONS}
              value={form.availableFor}
              onChange={(v) => setField('availableFor', v)}
              disabled={saving}
            />
          </div>

          <div>
            <p className={labelClass}>
              Language <span className="text-rose-600">*</span>
            </p>
            <ChipToggle
              options={LANGUAGE_SUGGESTIONS}
              value={form.language}
              onChange={(v) => setField('language', v)}
              disabled={saving}
            />
            <div className="mt-2 flex gap-2">
              <input
                className={fieldClass}
                value={langInput}
                onChange={(e) => setLangInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCsv('language', langInput)
                    setLangInput('')
                  }
                }}
                placeholder="Add other languages (comma separated)"
                disabled={saving}
              />
              <button
                type="button"
                className={btnSecondary}
                disabled={saving || !langInput.trim()}
                onClick={() => {
                  addCsv('language', langInput)
                  setLangInput('')
                }}
              >
                Add
              </button>
            </div>
          </div>

          <div>
            <p className={labelClass}>
              Skill <span className="text-rose-600">*</span>
            </p>
            <ChipToggle
              options={SKILL_SUGGESTIONS}
              value={form.skill}
              onChange={(v) => setField('skill', v)}
              disabled={saving}
            />
            <div className="mt-2 flex gap-2">
              <input
                className={fieldClass}
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCsv('skill', skillInput)
                    setSkillInput('')
                  }
                }}
                placeholder="Add other skills (comma separated)"
                disabled={saving}
              />
              <button
                type="button"
                className={btnSecondary}
                disabled={saving || !skillInput.trim()}
                onClick={() => {
                  addCsv('skill', skillInput)
                  setSkillInput('')
                }}
              >
                Add
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setField('isActive', e.target.checked)}
                disabled={saving}
              />
              Active
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={form.isAvailable}
                onChange={(e) => setField('isAvailable', e.target.checked)}
                disabled={saving}
              />
              Available
            </label>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete listing?"
        message={
          deleteTarget
            ? `Delete ${deleteTarget.staffName || 'this listing'} from staff for hire?`
            : ''
        }
        confirmLabel="Delete"
        loading={deleting}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

export default StaffForHirePage
