import { useCallback, useEffect, useState } from 'react'
import { FiEdit2, FiLoader, FiPlus, FiRefreshCw, FiTrash2 } from 'react-icons/fi'
import {
  createCoOwner,
  deleteCoOwner,
  fetchCoOwners,
  fetchOwnerMe,
  updateCoOwner,
  updateOwnerMe,
} from '../api/owner'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import { EmptyState, ErrorState, LoadingState, Panel } from '../components/ui/PageState'
import { getAuthUser, persistAuthSession } from '../utils/auth'
import { apiErrorMessage } from '../utils/errors'
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  fieldClass,
  labelClass,
  tableHeadClass,
  tableWrapClass,
} from '../utils/ui'

const PHONE_RE = /^\+?\d{10,15}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const emptyCoOwner = () => ({
  email: '',
  full_name: '',
  phone: '',
})

const splitName = (fullName = '') => {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return { first_name: '', last_name: '' }
  if (parts.length === 1) return { first_name: parts[0], last_name: '' }
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') }
}

const Profile = () => {
  const [meForm, setMeForm] = useState(null)
  const [coOwners, setCoOwners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState({ type: '', message: '' })
  const [savingMe, setSavingMe] = useState(false)
  const [coModal, setCoModal] = useState(null)
  const [coForm, setCoForm] = useState(null)
  const [savingCo, setSavingCo] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [profile, owners] = await Promise.all([fetchOwnerMe(), fetchCoOwners()])
      setMeForm({
        email: profile.email || '',
        full_name: profile.full_name || '',
        phone: profile.phone || '',
      })
      const meId = profile.id
      setCoOwners(
        owners.filter((o) => (meId == null ? true : String(o.id) !== String(meId))),
      )
    } catch (err) {
      setMeForm(null)
      setCoOwners([])
      setError(apiErrorMessage(err, 'Could not load profile.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const syncSessionFromProfile = (profile) => {
    const user = getAuthUser()
    if (!user || !profile) return
    const names = splitName(profile.full_name)
    persistAuthSession({
      user: {
        ...user,
        email: profile.email || user.email,
        full_name: profile.full_name || user.full_name,
        first_name: names.first_name || user.first_name,
        last_name: names.last_name || user.last_name,
        phone: profile.phone || user.phone,
      },
    })
  }

  const handleSaveMe = async (event) => {
    event.preventDefault()
    if (!meForm) return
    const email = String(meForm.email || '').trim()
    const full_name = String(meForm.full_name || '').trim()
    const phone = String(meForm.phone || '').trim()
    if (!full_name) {
      setStatus({ type: 'error', message: 'Full name is required.' })
      return
    }
    if (!EMAIL_RE.test(email)) {
      setStatus({ type: 'error', message: 'Enter a valid email.' })
      return
    }
    if (phone && !PHONE_RE.test(phone)) {
      setStatus({ type: 'error', message: 'Enter a valid phone number.' })
      return
    }

    setSavingMe(true)
    setStatus({ type: '', message: '' })
    try {
      const updated = await updateOwnerMe({ email, full_name, phone })
      setMeForm({
        email: updated.email || '',
        full_name: updated.full_name || '',
        phone: updated.phone || '',
      })
      syncSessionFromProfile(updated)
      setStatus({ type: 'success', message: 'Profile updated.' })
    } catch (err) {
      setStatus({
        type: 'error',
        message: apiErrorMessage(err, 'Could not update profile.'),
      })
    } finally {
      setSavingMe(false)
    }
  }

  const openCreateCo = () => {
    setStatus({ type: '', message: '' })
    setCoModal('create')
    setCoForm(emptyCoOwner())
  }

  const openEditCo = (row) => {
    setStatus({ type: '', message: '' })
    setCoModal('edit')
    setCoForm({
      id: row.id,
      email: row.email || '',
      full_name: row.full_name || '',
      phone: row.phone || '',
    })
  }

  const closeCoModal = () => {
    if (savingCo) return
    setCoModal(null)
    setCoForm(null)
  }

  const handleSaveCo = async (event) => {
    event.preventDefault()
    if (!coForm) return
    const payload = {
      email: String(coForm.email || '').trim(),
      full_name: String(coForm.full_name || '').trim(),
      phone: String(coForm.phone || '').trim(),
    }
    if (!payload.full_name) {
      setStatus({ type: 'error', message: 'Co-owner name is required.' })
      return
    }
    if (!EMAIL_RE.test(payload.email)) {
      setStatus({ type: 'error', message: 'Enter a valid co-owner email.' })
      return
    }
    if (payload.phone && !PHONE_RE.test(payload.phone)) {
      setStatus({ type: 'error', message: 'Enter a valid co-owner phone.' })
      return
    }

    setSavingCo(true)
    setStatus({ type: '', message: '' })
    try {
      if (coModal === 'create') {
        const created = await createCoOwner(payload)
        setCoOwners((prev) => [...prev, created])
        setStatus({ type: 'success', message: 'Co-owner added.' })
      } else {
        const updated = await updateCoOwner(coForm.id, payload)
        setCoOwners((prev) =>
          prev.map((o) => (String(o.id) === String(updated.id) ? updated : o)),
        )
        setStatus({ type: 'success', message: 'Co-owner updated.' })
      }
      closeCoModal()
    } catch (err) {
      setStatus({
        type: 'error',
        message: apiErrorMessage(err, 'Could not save co-owner.'),
      })
    } finally {
      setSavingCo(false)
    }
  }

  const handleDeleteCo = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteCoOwner(deleteTarget.id)
      setCoOwners((prev) => prev.filter((o) => String(o.id) !== String(deleteTarget.id)))
      setStatus({ type: 'success', message: 'Co-owner removed.' })
      setDeleteTarget(null)
    } catch (err) {
      setStatus({
        type: 'error',
        message: apiErrorMessage(err, 'Could not remove co-owner.'),
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Account"
        title="Profile"
        description="Update your owner details and manage co-owners."
        actions={
          <button type="button" className={btnGhost} onClick={load} disabled={loading}>
            <FiRefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </button>
        }
      />

      {status.message ? <StatusBanner type={status.type} message={status.message} /> : null}

      {loading ? <LoadingState label="Loading profile…" /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={load} /> : null}

      {!loading && !error && meForm ? (
        <Panel>
          <h3 className="text-base font-semibold text-slate-900">Your details</h3>
          <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={handleSaveMe}>
            <label className="block sm:col-span-2">
              <span className={labelClass}>Full name</span>
              <input
                className={fieldClass}
                value={meForm.full_name}
                onChange={(e) => setMeForm((f) => ({ ...f, full_name: e.target.value }))}
                disabled={savingMe}
                required
              />
            </label>
            <label className="block">
              <span className={labelClass}>Email</span>
              <input
                type="email"
                className={fieldClass}
                value={meForm.email}
                onChange={(e) => setMeForm((f) => ({ ...f, email: e.target.value }))}
                disabled={savingMe}
                required
              />
            </label>
            <label className="block">
              <span className={labelClass}>Phone</span>
              <input
                className={fieldClass}
                value={meForm.phone}
                onChange={(e) => setMeForm((f) => ({ ...f, phone: e.target.value }))}
                disabled={savingMe}
                placeholder="+919999999999"
              />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className={btnPrimary} disabled={savingMe}>
                {savingMe ? (
                  <>
                    <FiLoader className="h-4 w-4 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : (
                  'Save profile'
                )}
              </button>
            </div>
          </form>
        </Panel>
      ) : null}

      {!loading && !error ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900">Co-owners</h3>
            <button type="button" className={btnPrimary} onClick={openCreateCo}>
              <FiPlus className="h-4 w-4" aria-hidden />
              Add co-owner
            </button>
          </div>

          {coOwners.length === 0 ? (
            <EmptyState
              title="No co-owners"
              hint="Invite a co-owner with email, name, and phone."
              actionLabel="Add co-owner"
              onAction={openCreateCo}
            />
          ) : (
            <div className={tableWrapClass}>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className={tableHeadClass}>
                    <tr>
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-left">Email</th>
                      <th className="px-4 py-3 text-left">Phone</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coOwners.map((row) => (
                      <tr key={row.id || row.email} className="border-t border-stone-100 hover:bg-stone-50/80">
                        <td className="px-4 py-3 font-medium text-stone-900">{row.full_name || '—'}</td>
                        <td className="px-4 py-3 text-stone-600">{row.email || '—'}</td>
                        <td className="px-4 py-3 text-stone-600">{row.phone || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            <button type="button" className={btnGhost} onClick={() => openEditCo(row)}>
                              <FiEdit2 className="h-3.5 w-3.5" aria-hidden />
                              Edit
                            </button>
                            <button
                              type="button"
                              className={btnGhost}
                              onClick={() => setDeleteTarget(row)}
                              aria-label={`Remove ${row.full_name || row.email}`}
                            >
                              <FiTrash2 className="h-3.5 w-3.5 text-rose-600" aria-hidden />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}

      <Modal
        open={Boolean(coModal)}
        onClose={closeCoModal}
        title={coModal === 'create' ? 'Add co-owner' : 'Edit co-owner'}
      >
        {coForm ? (
          <form className="space-y-4" onSubmit={handleSaveCo}>
            <label className="block">
              <span className={labelClass}>Full name</span>
              <input
                className={fieldClass}
                value={coForm.full_name}
                onChange={(e) => setCoForm((f) => ({ ...f, full_name: e.target.value }))}
                disabled={savingCo}
                required
              />
            </label>
            <label className="block">
              <span className={labelClass}>Email</span>
              <input
                type="email"
                className={fieldClass}
                value={coForm.email}
                onChange={(e) => setCoForm((f) => ({ ...f, email: e.target.value }))}
                disabled={savingCo}
                required
              />
            </label>
            <label className="block">
              <span className={labelClass}>Phone</span>
              <input
                className={fieldClass}
                value={coForm.phone}
                onChange={(e) => setCoForm((f) => ({ ...f, phone: e.target.value }))}
                disabled={savingCo}
                placeholder="+919888888888"
              />
            </label>
            <div className="flex flex-col-reverse gap-2 border-t border-stone-100 pt-4 sm:flex-row sm:justify-end">
              <button type="button" className={btnSecondary} onClick={closeCoModal} disabled={savingCo}>
                Cancel
              </button>
              <button type="submit" className={btnPrimary} disabled={savingCo}>
                {savingCo ? (
                  <>
                    <FiLoader className="h-4 w-4 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : coModal === 'create' ? (
                  'Add co-owner'
                ) : (
                  'Save changes'
                )}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove co-owner?"
        message={
          deleteTarget
            ? `Remove ${deleteTarget.full_name || deleteTarget.email} from co-owners?`
            : ''
        }
        confirmLabel="Remove"
        loading={deleting}
        onConfirm={handleDeleteCo}
        onClose={() => !deleting && setDeleteTarget(null)}
      />
    </div>
  )
}

export default Profile
