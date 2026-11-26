import { useCallback, useEffect, useState } from 'react'
import { FiEdit2, FiEye, FiEyeOff, FiPlus, FiSearch, FiTrash2 } from 'react-icons/fi'
import {
  createCustomer,
  customerFullName,
  deleteCustomer,
  fetchCustomers,
  updateCustomer,
} from '../api/customers'
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
  email: '',
  password: '',
  confirm_password: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  mobile_number: '',
  city: '',
}

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim())

const CustomersPage = () => {
  const access = useAccess()
  const canWrite = access.canWrite
  const tenantSlug = resolveCatalogTenantSlug(access.tenant)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [status, setStatus] = useState({ type: '', message: '' })
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [count, setCount] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [hasPrevious, setHasPrevious] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [showPass2, setShowPass2] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const totalPages = Math.max(1, Math.ceil((count || 0) / pageSize) || 1)
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const load = useCallback(async () => {
    if (!tenantSlug) {
      setRows([])
      setCount(0)
      setHasNext(false)
      setHasPrevious(false)
      setLoadError('')
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      const data = await fetchCustomers(tenantSlug, {
        page,
        pageSize,
        search: search || undefined,
        ordering: 'first_name',
      })
      setRows(data.results)
      setCount(data.count)
      setHasNext(Boolean(data.next))
      setHasPrevious(Boolean(data.previous) || page > 1)
    } catch (err) {
      setRows([])
      setCount(0)
      setHasNext(false)
      setHasPrevious(false)
      setLoadError(apiErrorMessage(err, 'Could not load customers.'))
    } finally {
      setLoading(false)
    }
  }, [tenantSlug, page, pageSize, search])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setShowPass(false)
    setShowPass2(false)
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      ...EMPTY,
      email: row.email || '',
      first_name: row.first_name || '',
      middle_name: row.middle_name || '',
      last_name: row.last_name || '',
      mobile_number: row.mobile_number || '',
      city: row.city || '',
    })
    setShowPass(false)
    setShowPass2(false)
    setModalOpen(true)
  }

  const closeModal = () => {
    if (saving) return
    setModalOpen(false)
    setEditing(null)
  }

  const validate = () => {
    if (!form.first_name.trim()) return 'First name is required.'
    if (!form.last_name.trim()) return 'Last name is required.'
    if (!editing) {
      if (!form.email.trim() || !isEmail(form.email)) return 'Valid email is required.'
      if (!form.password) return 'Password is required.'
      if (form.password !== form.confirm_password) return 'Passwords do not match.'
    }
    if (!form.mobile_number.trim()) return 'Mobile number is required.'
    if (!form.city.trim()) return 'City is required.'
    return ''
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!tenantSlug) return
    const message = validate()
    if (message) {
      setStatus({ type: 'error', message })
      return
    }
    setSaving(true)
    try {
      if (editing) await updateCustomer(tenantSlug, editing.id, form)
      else await createCustomer(tenantSlug, form)
      setStatus({
        type: 'success',
        message: editing ? 'Customer updated.' : 'Customer created.',
      })
      closeModal()
      if (!editing) setPage(1)
      await load()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not save customer.') })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!tenantSlug || !deleteTarget) return
    setDeleting(true)
    try {
      await deleteCustomer(tenantSlug, deleteTarget.id)
      setStatus({ type: 'success', message: 'Customer deleted.' })
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not delete customer.') })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={access.tenant?.name || 'Organization'}
        title="Customer Master"
        description="Tenant customer accounts."
        actions={
          canWrite ? (
            <button type="button" className={btnPrimary} onClick={openCreate} disabled={!tenantSlug}>
              <FiPlus className="h-4 w-4" aria-hidden />
              Add customer
            </button>
          ) : (
            <span className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600">
              Read only
            </span>
          )
        }
      />

      {!tenantSlug ? (
        <StatusBanner type="warning" message="Select a tenant to load customers." />
      ) : null}
      {status.message ? <StatusBanner type={status.type} message={status.message} /> : null}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white p-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:min-w-[240px]">
          <input
            className={`${fieldClass} min-w-0 flex-1 sm:max-w-xs`}
            placeholder="Search customers…"
            aria-label="Search customers"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1)
                setSearch(searchInput.trim())
              }
            }}
          />
          <button
            type="button"
            className={btnPrimary}
            disabled={!tenantSlug}
            onClick={() => {
              setPage(1)
              setSearch(searchInput.trim())
            }}
          >
            <FiSearch className="h-4 w-4" aria-hidden />
            Search
          </button>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-stone-600">
          <span className="whitespace-nowrap">Rows</span>
          <select
            className={`${fieldClass} w-auto min-w-[72px]`}
            value={pageSize}
            aria-label="Rows per page"
            onChange={(e) => {
              setPage(1)
              setPageSize(Number(e.target.value) || 20)
            }}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={tableWrapClass}>
        {!tenantSlug ? (
          <EmptyState bare title="No tenant selected" hint="Customers load once a tenant is selected." />
        ) : loading ? (
          <LoadingState label="Loading customers…" />
        ) : loadError ? (
          <ErrorState bare message={loadError} onRetry={load} />
        ) : rows.length === 0 ? (
          <EmptyState
            bare
            title={search ? 'No matching customers' : 'No customers yet'}
            hint={
              search
                ? 'Try another name, email, or phone.'
                : canWrite
                  ? 'Add the first customer for this tenant.'
                  : 'Nothing on file.'
            }
            actionLabel={!search && canWrite ? 'Add customer' : undefined}
            onAction={!search && canWrite ? openCreate : undefined}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className={tableHeadClass}>
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Mobile</th>
                    <th className="px-4 py-3">City</th>
                    <th className="px-4 py-3">Status</th>
                    {canWrite ? <th className="px-4 py-3 text-right">Actions</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3 font-semibold text-ink">{customerFullName(row)}</td>
                      <td className="px-4 py-3 text-stone-600">{row.email || '—'}</td>
                      <td className="px-4 py-3 text-stone-600">{row.mobile_number || '—'}</td>
                      <td className="px-4 py-3 text-stone-600">{row.city || '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            row.is_active
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-stone-100 text-stone-500'
                          }`}
                        >
                          {row.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {canWrite ? (
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              className={btnGhost}
                              onClick={() => openEdit(row)}
                              aria-label={`Edit ${customerFullName(row)}`}
                            >
                              <FiEdit2 className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            <button
                              type="button"
                              className={`${btnGhost} text-rose-600 hover:bg-rose-50`}
                              onClick={() => setDeleteTarget(row)}
                              aria-label={`Delete ${customerFullName(row)}`}
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 px-4 py-3 text-sm text-stone-600">
              <span>
                {count} customer{count === 1 ? '' : 's'} · page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={!hasPrevious || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={!hasNext || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit customer' : 'Add customer'}
        onClose={closeModal}
        wide
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={closeModal} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="customer-form" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add customer'}
            </button>
          </div>
        }
      >
        <form id="customer-form" className="grid gap-3 sm:grid-cols-2" onSubmit={handleSave}>
          <div>
            <label className={labelClass} htmlFor="cust-fn">
              First name <span className="text-rose-600">*</span>
            </label>
            <input
              id="cust-fn"
              className={fieldClass}
              value={form.first_name}
              onChange={(e) => set('first_name', e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="cust-mn">
              Middle name
            </label>
            <input
              id="cust-mn"
              className={fieldClass}
              value={form.middle_name}
              onChange={(e) => set('middle_name', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="cust-ln">
              Last name <span className="text-rose-600">*</span>
            </label>
            <input
              id="cust-ln"
              className={fieldClass}
              value={form.last_name}
              onChange={(e) => set('last_name', e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="cust-mobile">
              Mobile <span className="text-rose-600">*</span>
            </label>
            <input
              id="cust-mobile"
              className={fieldClass}
              value={form.mobile_number}
              onChange={(e) => set('mobile_number', e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="cust-city">
              City <span className="text-rose-600">*</span>
            </label>
            <input
              id="cust-city"
              className={fieldClass}
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              required
            />
          </div>
          {!editing ? (
            <>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="cust-email">
                  Email <span className="text-rose-600">*</span>
                </label>
                <input
                  id="cust-email"
                  type="email"
                  className={fieldClass}
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="cust-pass">
                  Password <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    id="cust-pass"
                    type={showPass ? 'text' : 'password'}
                    className={`${fieldClass} pr-10`}
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                  >
                    {showPass ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelClass} htmlFor="cust-pass2">
                  Confirm password <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    id="cust-pass2"
                    type={showPass2 ? 'text' : 'password'}
                    className={`${fieldClass} pr-10`}
                    value={form.confirm_password}
                    onChange={(e) => set('confirm_password', e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400"
                    onClick={() => setShowPass2((v) => !v)}
                    aria-label={showPass2 ? 'Hide password' : 'Show password'}
                  >
                    {showPass2 ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete customer?"
        message={`${customerFullName(deleteTarget || {})} will be removed from this tenant.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => !deleting && setDeleteTarget(null)}
      />
    </div>
  )
}

export default CustomersPage
