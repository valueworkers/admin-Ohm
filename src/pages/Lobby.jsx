import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FiCheck, FiEdit2, FiLoader, FiPlus, FiRefreshCw, FiTrash2, FiX } from 'react-icons/fi'
import {
  approveOnboardingRequest,
  deleteOnboardingRequest,
  fetchOnboardingRequests,
  rejectOnboardingRequest,
  updateOnboardingRequest,
} from '../api/onboarding'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/PageState'
import { apiErrorMessage } from '../utils/errors'
import {
  btnDanger,
  btnGhost,
  btnPrimary,
  btnSecondary,
  fieldClass,
  labelClass,
  tableHeadClass,
  tableWrapClass,
} from '../utils/ui'

const formatDate = (value) => {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

const statusChip = (status) => {
  const s = String(status || '').toLowerCase()
  if (s === 'submitted' || s === 'pending') {
    return 'rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900'
  }
  if (s === 'approved' || s === 'active') {
    return 'rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800'
  }
  if (s === 'rejected' || s === 'offboarded') {
    return 'rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-800'
  }
  return 'rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600'
}

const canReview = (status) => {
  const s = String(status || '').toLowerCase()
  return s === 'submitted' || s === 'pending' || !s
}

const emptyBranch = () => ({
  name: '',
  line1: '',
  line2: '',
  locality: '',
  city: '',
  pincode: '',
})

const mapBranch = (b = {}) => ({
  name: b.name || '',
  line1: b.line1 || b.address || '',
  line2: b.line2 || '',
  locality: b.locality || '',
  city: b.city || '',
  pincode: b.pincode || '',
})

const formatBranchLine = (b) => {
  const parts = [b.line1, b.line2, b.locality, b.city, b.pincode]
    .map((p) => String(p || '').trim())
    .filter(Boolean)
  return parts.join(', ')
}

const emailsToText = (emails) =>
  Array.isArray(emails) ? emails.filter(Boolean).join('\n') : String(emails || '').trim()

const textToEmails = (text) =>
  String(text || '')
    .split(/[\n,;]+/)
    .map((e) => e.trim())
    .filter(Boolean)

const formFromRow = (row) => ({
  organization_name: row.organization_name || '',
  email: row.email || row.applicant_email || '',
  contact_phone: row.contact_phone || '',
  gst_number: row.gst_number || '',
  ops_admin_email: row.ops_admin_email || '',
  co_owner_emails: emailsToText(row.co_owner_emails),
  slug: row.slug || '',
  custom_domain: row.custom_domain || '',
  wants_custom_website: Boolean(row.wants_custom_website),
  branches:
    Array.isArray(row.branches) && row.branches.length > 0
      ? row.branches.map(mapBranch)
      : [emptyBranch()],
})

const normalizeBranches = (branches) =>
  (branches || [])
    .map((b) => ({
      name: String(b.name || '').trim(),
      line1: String(b.line1 || '').trim(),
      line2: String(b.line2 || '').trim(),
      locality: String(b.locality || '').trim(),
      city: String(b.city || '').trim(),
      pincode: String(b.pincode || '').trim(),
    }))
    .filter((b) => b.name || b.line1 || b.city || b.pincode)

const buildEditPayload = (current, baseline) => {
  const next = {
    organization_name: String(current.organization_name || '').trim(),
    email: String(current.email || '').trim(),
    contact_phone: String(current.contact_phone || '').trim(),
    gst_number: String(current.gst_number || '').trim().toUpperCase(),
    ops_admin_email: String(current.ops_admin_email || '').trim(),
    co_owner_emails: textToEmails(current.co_owner_emails),
    slug: String(current.slug || '').trim(),
    custom_domain: String(current.custom_domain || '').trim(),
    wants_custom_website: Boolean(current.wants_custom_website),
    branches: normalizeBranches(current.branches),
  }
  const prev = {
    organization_name: String(baseline.organization_name || '').trim(),
    email: String(baseline.email || '').trim(),
    contact_phone: String(baseline.contact_phone || '').trim(),
    gst_number: String(baseline.gst_number || '').trim().toUpperCase(),
    ops_admin_email: String(baseline.ops_admin_email || '').trim(),
    co_owner_emails: textToEmails(baseline.co_owner_emails),
    slug: String(baseline.slug || '').trim(),
    custom_domain: String(baseline.custom_domain || '').trim(),
    wants_custom_website: Boolean(baseline.wants_custom_website),
    branches: normalizeBranches(baseline.branches),
  }

  const payload = {}
  for (const key of [
    'organization_name',
    'email',
    'contact_phone',
    'gst_number',
    'ops_admin_email',
    'slug',
    'custom_domain',
    'wants_custom_website',
  ]) {
    if (next[key] !== prev[key]) payload[key] = next[key]
  }
  if (JSON.stringify(next.co_owner_emails) !== JSON.stringify(prev.co_owner_emails)) {
    payload.co_owner_emails = next.co_owner_emails
  }
  if (JSON.stringify(next.branches) !== JSON.stringify(prev.branches)) {
    payload.branches = next.branches
  }
  return payload
}

const Lobby = () => {
  const location = useLocation()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [banner, setBanner] = useState({ type: '', message: '' })
  const [selectedId, setSelectedId] = useState('')
  const [review, setReview] = useState(null)
  const [notes, setNotes] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [editBaseline, setEditBaseline] = useState(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const selected = useMemo(
    () => rows.find((r) => String(r.id) === String(selectedId)) || null,
    [rows, selectedId]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await fetchOnboardingRequests()
      setRows(list)
      setSelectedId((prev) => {
        if (prev && list.some((r) => String(r.id) === String(prev))) return prev
        return ''
      })
    } catch (err) {
      setRows([])
      setError(apiErrorMessage(err, 'Could not load onboarding requests.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const next = location.state?.banner
    if (!next?.message) return
    setBanner({ type: next.type || 'success', message: next.message })
    window.history.replaceState({}, document.title)
  }, [location.state])

  const openReview = (action) => {
    if (!selected) {
      setBanner({ type: 'error', message: 'Select a request first.' })
      return
    }
    if (!canReview(selected.status)) {
      setBanner({ type: 'error', message: 'This request has already been reviewed.' })
      return
    }
    setBanner({ type: '', message: '' })
    setReview({ action })
    setNotes(action === 'approve' ? 'Approved' : 'Rejected')
  }

  const closeReview = () => {
    if (saving) return
    setReview(null)
    setNotes('')
  }

  const openEdit = () => {
    if (!selected) {
      setBanner({ type: 'error', message: 'Select a request first.' })
      return
    }
    setBanner({ type: '', message: '' })
    const form = formFromRow(selected)
    setEditForm(form)
    setEditBaseline(form)
    setEditOpen(true)
  }

  const closeEdit = () => {
    if (saving) return
    setEditOpen(false)
    setEditForm(null)
    setEditBaseline(null)
  }

  const setEditField = (key, value) => {
    setEditForm((prev) => ({ ...prev, [key]: value }))
  }

  const setBranchField = (index, key, value) => {
    setEditForm((prev) => {
      const branches = [...(prev.branches || [])]
      branches[index] = { ...branches[index], [key]: value }
      return { ...prev, branches }
    })
  }

  const addBranch = () => {
    setEditForm((prev) => ({
      ...prev,
      branches: [...(prev.branches || []), emptyBranch()],
    }))
  }

  const removeBranch = (index) => {
    setEditForm((prev) => {
      const branches = (prev.branches || []).filter((_, i) => i !== index)
      return { ...prev, branches: branches.length ? branches : [emptyBranch()] }
    })
  }

  const submitReview = async () => {
    if (!selected?.id || !review) return
    const name = selected.organization_name || 'Request'
    const reviewNotes = notes.trim() || (review.action === 'approve' ? 'Approved' : 'Rejected')
    setSaving(true)
    setBanner({ type: '', message: '' })
    try {
      if (review.action === 'approve') {
        await approveOnboardingRequest(selected.id, reviewNotes)
        setBanner({ type: 'success', message: `${name} approved.` })
      } else {
        await rejectOnboardingRequest(selected.id, reviewNotes)
        setBanner({ type: 'success', message: `${name} rejected.` })
      }
      setReview(null)
      setNotes('')
      setSelectedId('')
      await load()
    } catch (err) {
      setBanner({
        type: 'error',
        message: apiErrorMessage(
          err,
          review.action === 'approve' ? 'Could not approve request.' : 'Could not reject request.'
        ),
      })
    } finally {
      setSaving(false)
    }
  }

  const submitEdit = async (event) => {
    event.preventDefault()
    if (!selected?.id || !editForm || !editBaseline) return
    const completeBranches = normalizeBranches(editForm.branches).filter((b) => b.name)
    if (!completeBranches.length) {
      setBanner({
        type: 'error',
        message: 'At least one branch with a name is required.',
      })
      return
    }
    const name = editForm.organization_name.trim() || selected.organization_name || 'Request'
    const payload = buildEditPayload(
      { ...editForm, branches: completeBranches },
      editBaseline,
    )
    if (Object.keys(payload).length === 0) {
      setBanner({ type: 'success', message: 'No changes to save.' })
      closeEdit()
      return
    }
    setSaving(true)
    setBanner({ type: '', message: '' })
    try {
      await updateOnboardingRequest(selected.id, payload)
      setBanner({ type: 'success', message: `${name} updated.` })
      setEditOpen(false)
      setEditForm(null)
      setEditBaseline(null)
      await load()
    } catch (err) {
      setBanner({
        type: 'error',
        message: apiErrorMessage(err, 'Could not update onboarding request.'),
      })
    } finally {
      setSaving(false)
    }
  }

  const openDelete = () => {
    if (!selected) {
      setBanner({ type: 'error', message: 'Select a request first.' })
      return
    }
    setBanner({ type: '', message: '' })
    setDeleteOpen(true)
  }

  const closeDelete = () => {
    if (saving) return
    setDeleteOpen(false)
  }

  const confirmDelete = async () => {
    if (!selected?.id) return
    const name = selected.organization_name || selected.slug || 'Request'
    setSaving(true)
    setBanner({ type: '', message: '' })
    try {
      await deleteOnboardingRequest(selected.id)
      setBanner({ type: 'success', message: `${name} deleted.` })
      setDeleteOpen(false)
      setSelectedId('')
      await load()
    } catch (err) {
      setBanner({
        type: 'error',
        message: apiErrorMessage(err, 'Could not delete onboarding request.'),
      })
    } finally {
      setSaving(false)
    }
  }

  const isApprove = review?.action === 'approve'
  const selectedActionable = selected ? canReview(selected.status) : false

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Platform"
        title="Lobby"
        description="Select a request, then edit, approve, reject, or delete."
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} onClick={load} disabled={loading}>
              <FiRefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden />
              Refresh
            </button>
            <Link to="/tenants" className={btnPrimary}>
              Go to Tenants
            </Link>
          </div>
        }
      />

      <StatusBanner type={banner.type} message={banner.message} />

      {!loading && !error ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5">
          <p className="mr-auto text-sm text-stone-600">
            {selected ? (
              <>
                Selected:{' '}
                <span className="font-semibold text-stone-900">
                  {selected.organization_name || selected.slug || 'Request'}
                </span>
              </>
            ) : (
              'Select a row to edit, approve, reject, or delete.'
            )}
          </p>
          <button
            type="button"
            className={btnSecondary}
            disabled={!selected || saving}
            onClick={openEdit}
          >
            <FiEdit2 className="h-3.5 w-3.5" aria-hidden />
            Edit
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={!selected || !selectedActionable || saving}
            onClick={() => openReview('approve')}
          >
            <FiCheck className="h-3.5 w-3.5" aria-hidden />
            Approve
          </button>
          <button
            type="button"
            className={btnDanger}
            disabled={!selected || !selectedActionable || saving}
            onClick={() => openReview('reject')}
          >
            <FiX className="h-3.5 w-3.5" aria-hidden />
            Reject
          </button>
          <button
            type="button"
            className={btnDanger}
            disabled={!selected || saving}
            onClick={openDelete}
          >
            <FiTrash2 className="h-3.5 w-3.5" aria-hidden />
            Delete
          </button>
        </div>
      ) : null}

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <div className={tableWrapClass}>
          {loading ? (
            <LoadingState label="Loading onboarding requests…" />
          ) : rows.length === 0 ? (
            <EmptyState bare title="Lobby is empty" hint="No onboarding requests right now." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className={tableHeadClass}>
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="px-4 py-3">Organization</th>
                    <th className="px-4 py-3">Owner email</th>
                    <th className="px-4 py-3">Ops Admin</th>
                    <th className="px-4 py-3">Co-owners</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Branches</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Custom website</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {rows.map((row) => {
                    const branches = Array.isArray(row.branches) ? row.branches : []
                    const coOwners = Array.isArray(row.co_owner_emails)
                      ? row.co_owner_emails.filter(Boolean)
                      : []
                    const isSelected = String(row.id) === String(selectedId)
                    return (
                      <tr
                        key={row.id}
                        className={`cursor-pointer ${
                          isSelected ? 'bg-brand-50/70' : 'hover:bg-stone-50'
                        }`}
                        onClick={() => setSelectedId(row.id)}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="radio"
                            name="lobby-select"
                            className="h-4 w-4 border-stone-300 text-brand-500 focus:ring-brand-500"
                            checked={isSelected}
                            onChange={() => setSelectedId(row.id)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select ${row.organization_name || 'request'}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-stone-50 text-[10px] text-stone-400">
                              {row.logo ? (
                                <img src={row.logo} alt="" className="h-full w-full object-cover" />
                              ) : (
                                'Logo'
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-stone-900">
                                {row.organization_name || '—'}
                              </p>
                              <p className="truncate text-xs text-stone-400">
                                {row.slug || row.applicant_email || '—'}
                              </p>
                              {row.gst_number ? (
                                <p className="truncate text-xs text-stone-400">
                                  GST: {row.gst_number}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-stone-600">
                          {row.email || row.applicant_email || '—'}
                        </td>
                        <td className="px-4 py-3 text-stone-600">
                          {row.ops_admin_email ? (
                            row.ops_admin_email
                          ) : (
                            <span className="text-amber-800">Not set</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-stone-600">
                          {coOwners.length === 0 ? (
                            '—'
                          ) : (
                            <div className="space-y-0.5 text-xs">
                              {coOwners.map((email) => (
                                <div key={email}>{email}</div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-stone-600">{row.contact_phone || '—'}</td>
                        <td className="px-4 py-3 text-stone-600">
                          {branches.length === 0 ? (
                            '—'
                          ) : (
                            <div className="space-y-0.5">
                              {branches.map((b, i) => {
                                const line = formatBranchLine(mapBranch(b))
                                return (
                                  <div key={`${row.id}-b-${i}`}>
                                    <span className="font-medium text-stone-800">
                                      {b.name || 'Branch'}
                                    </span>
                                    {line ? (
                                      <span className="block text-xs text-stone-400">{line}</span>
                                    ) : null}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-stone-600">
                          {row.requested_plan_name ||
                            (row.requested_plan != null ? String(row.requested_plan) : '—')}
                        </td>
                        <td className="px-4 py-3">
                          {row.wants_custom_website === true ||
                          row.wants_custom_website === 'true' ||
                          row.wants_custom_website === 1 ? (
                            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-800 ring-1 ring-brand-100">
                              Custom website required
                            </span>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={statusChip(row.status)}>{row.status || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-stone-600">{formatDate(row.created_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal
        open={Boolean(review)}
        title={isApprove ? 'Approve onboarding?' : 'Reject onboarding?'}
        onClose={closeReview}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={closeReview} disabled={saving}>
              Cancel
            </button>
            <button
              type="button"
              className={isApprove ? btnPrimary : btnDanger}
              onClick={submitReview}
              disabled={saving}
            >
              {saving ? (
                <>
                  <FiLoader className="h-4 w-4 animate-spin" aria-hidden />
                  Working…
                </>
              ) : isApprove ? (
                'Approve'
              ) : (
                'Reject'
              )}
            </button>
          </div>
        }
      >
        <p className="text-sm text-stone-600">
          {isApprove
            ? `Approve ${selected?.organization_name || 'this organization'} and provision the tenant.`
            : `Reject ${selected?.organization_name || 'this organization'}.`}
        </p>
        <div className="mt-3">
          <label htmlFor="review-notes" className={labelClass}>
            Review notes
          </label>
          <textarea
            id="review-notes"
            className={`${fieldClass} min-h-[88px] resize-y`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={saving}
          />
        </div>
      </Modal>

      <Modal
        open={editOpen && Boolean(editForm)}
        title="Edit onboarding request"
        onClose={closeEdit}
        wide
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={closeEdit} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              form="lobby-edit-form"
              className={btnPrimary}
              disabled={saving}
            >
              {saving ? (
                <>
                  <FiLoader className="h-4 w-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                'Save changes'
              )}
            </button>
          </div>
        }
      >
        {editForm ? (
          <form id="lobby-edit-form" className="space-y-4" onSubmit={submitEdit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="edit-org" className={labelClass}>
                  Organization name
                </label>
                <input
                  id="edit-org"
                  className={fieldClass}
                  value={editForm.organization_name}
                  onChange={(e) => setEditField('organization_name', e.target.value)}
                  required
                  disabled={saving}
                />
              </div>
              <div>
                <label htmlFor="edit-email" className={labelClass}>
                  Owner email
                </label>
                <input
                  id="edit-email"
                  type="email"
                  className={fieldClass}
                  value={editForm.email}
                  onChange={(e) => setEditField('email', e.target.value)}
                  disabled={saving}
                />
              </div>
              <div>
                <label htmlFor="edit-ops" className={labelClass}>
                  Ops Admin email
                </label>
                <input
                  id="edit-ops"
                  type="email"
                  className={fieldClass}
                  value={editForm.ops_admin_email}
                  onChange={(e) => setEditField('ops_admin_email', e.target.value)}
                  disabled={saving}
                />
              </div>
              <div>
                <label htmlFor="edit-phone" className={labelClass}>
                  Contact phone
                </label>
                <input
                  id="edit-phone"
                  className={fieldClass}
                  value={editForm.contact_phone}
                  onChange={(e) => setEditField('contact_phone', e.target.value)}
                  disabled={saving}
                />
              </div>
              <div>
                <label htmlFor="edit-gst" className={labelClass}>
                  GST number
                </label>
                <input
                  id="edit-gst"
                  className={fieldClass}
                  value={editForm.gst_number}
                  onChange={(e) => setEditField('gst_number', e.target.value)}
                  disabled={saving}
                />
              </div>
              <div>
                <label htmlFor="edit-slug" className={labelClass}>
                  Slug
                </label>
                <input
                  id="edit-slug"
                  className={fieldClass}
                  value={editForm.slug}
                  onChange={(e) => setEditField('slug', e.target.value)}
                  disabled={saving}
                />
              </div>
              <div>
                <label htmlFor="edit-domain" className={labelClass}>
                  Custom domain
                </label>
                <input
                  id="edit-domain"
                  className={fieldClass}
                  value={editForm.custom_domain}
                  onChange={(e) => setEditField('custom_domain', e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="edit-co-owners" className={labelClass}>
                  Co-owner emails
                </label>
                <textarea
                  id="edit-co-owners"
                  className={`${fieldClass} min-h-[72px] resize-y`}
                  value={editForm.co_owner_emails}
                  onChange={(e) => setEditField('co_owner_emails', e.target.value)}
                  placeholder="One email per line"
                  disabled={saving}
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-stone-300 text-brand-500 focus:ring-brand-500"
                    checked={editForm.wants_custom_website}
                    onChange={(e) => setEditField('wants_custom_website', e.target.checked)}
                    disabled={saving}
                  />
                  Wants custom website
                </label>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-stone-900">
                    Branches <span className="text-rose-600">*</span>
                  </p>
                  <p className="text-xs text-stone-500">At least one branch is required.</p>
                </div>
                <button
                  type="button"
                  className={btnGhost}
                  onClick={addBranch}
                  disabled={saving}
                >
                  <FiPlus className="h-3.5 w-3.5" aria-hidden />
                  Add branch
                </button>
              </div>
              <div className="space-y-2">
                {editForm.branches.map((branch, index) => (
                  <div
                    key={`branch-${index}`}
                    className="space-y-2 rounded-lg border border-stone-200 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                        Branch {index + 1}
                      </p>
                      <button
                        type="button"
                        className={`${btnGhost} text-rose-600`}
                        onClick={() => removeBranch(index)}
                        aria-label="Remove branch"
                        disabled={saving || editForm.branches.length <= 1}
                      >
                        <FiTrash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className={labelClass} htmlFor={`branch-name-${index}`}>
                          Name <span className="text-rose-600">*</span>
                        </label>
                        <input
                          id={`branch-name-${index}`}
                          className={fieldClass}
                          value={branch.name}
                          onChange={(e) => setBranchField(index, 'name', e.target.value)}
                          disabled={saving}
                          required={index === 0}
                        />
                      </div>
                      <div>
                        <label className={labelClass} htmlFor={`branch-line1-${index}`}>
                          Address line 1
                        </label>
                        <input
                          id={`branch-line1-${index}`}
                          className={fieldClass}
                          value={branch.line1}
                          onChange={(e) => setBranchField(index, 'line1', e.target.value)}
                          disabled={saving}
                        />
                      </div>
                      <div>
                        <label className={labelClass} htmlFor={`branch-line2-${index}`}>
                          Address line 2
                        </label>
                        <input
                          id={`branch-line2-${index}`}
                          className={fieldClass}
                          value={branch.line2}
                          onChange={(e) => setBranchField(index, 'line2', e.target.value)}
                          disabled={saving}
                        />
                      </div>
                      <div>
                        <label className={labelClass} htmlFor={`branch-locality-${index}`}>
                          Locality
                        </label>
                        <input
                          id={`branch-locality-${index}`}
                          className={fieldClass}
                          value={branch.locality}
                          onChange={(e) => setBranchField(index, 'locality', e.target.value)}
                          disabled={saving}
                        />
                      </div>
                      <div>
                        <label className={labelClass} htmlFor={`branch-city-${index}`}>
                          City
                        </label>
                        <input
                          id={`branch-city-${index}`}
                          className={fieldClass}
                          value={branch.city}
                          onChange={(e) => setBranchField(index, 'city', e.target.value)}
                          disabled={saving}
                        />
                      </div>
                      <div>
                        <label className={labelClass} htmlFor={`branch-pincode-${index}`}>
                          Pincode
                        </label>
                        <input
                          id={`branch-pincode-${index}`}
                          className={fieldClass}
                          value={branch.pincode}
                          onChange={(e) => setBranchField(index, 'pincode', e.target.value)}
                          disabled={saving}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </form>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={deleteOpen && Boolean(selected)}
        title="Delete request?"
        message={
          selected
            ? `This permanently removes “${selected.organization_name || selected.slug || 'this request'}” from the lobby.`
            : 'This permanently removes the onboarding request.'
        }
        confirmLabel="Delete"
        loading={saving}
        onConfirm={confirmDelete}
        onClose={closeDelete}
      />
    </div>
  )
}

export default Lobby
