import { useCallback, useEffect, useRef, useState } from 'react'
import { FiEdit2, FiLoader, FiPlus, FiRefreshCw, FiTrash2 } from 'react-icons/fi'
import {
  createRole,
  createRoleAssignment,
  deleteRole,
  deleteRoleAssignment,
  fetchRoleAssignments,
  fetchRolePermissions,
  fetchRoles,
  updateRole,
} from '../api/roles'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import { EmptyState, ErrorState, LoadingState, Panel } from '../components/ui/PageState'
import { fetchMyTenants } from '../api/myTenants'
import { useAccess } from '../hooks/useAccess'
import { getAuthUser, isSuperAdmin } from '../utils/auth'
import { apiErrorMessage } from '../utils/errors'
import { resolveRolesTenantSlug } from '../utils/tenantHeader'
import { saveStoredTenants, setSelectedTenantId } from '../utils/tenants'
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  fieldClass,
  labelClass,
  tableHeadClass,
  tableWrapClass,
} from '../utils/ui'

const TABS = [
  { id: 'roles', label: 'Roles' },
  { id: 'assignments', label: 'Assignments' },
]

const emptyRoleForm = () => ({
  code: '',
  name: '',
  rank: '50',
  permissions: [],
})

const permissionIdsFromRole = (role = {}) => {
  const list = role.permissions || role.permission_details || []
  if (!Array.isArray(list)) return []
  return list
    .map((p) => {
      if (typeof p === 'number') return p
      if (typeof p === 'string' && /^\d+$/.test(p)) return Number(p)
      const id = p?.id ?? p?.pk
      return id != null && id !== '' ? Number(id) : null
    })
    .filter((id) => Number.isFinite(id))
}

const toRoleForm = (role = {}) => ({
  code: role.code || '',
  name: role.name || '',
  rank: role.rank != null ? String(role.rank) : '50',
  permissions: permissionIdsFromRole(role),
})

const emptyAssignForm = () => ({
  user_id: '',
  role_id: '',
  object_type: 'booking.venue',
  object_id: '1',
})

const Roles = () => {
  const { isSuperAdmin: superAdmin, tenant, user } = useAccess()
  const [tab, setTab] = useState('roles')
  const visibleTabs = superAdmin ? TABS.filter((t) => t.id === 'roles') : TABS

  useEffect(() => {
    if (superAdmin && tab !== 'roles') setTab('roles')
  }, [superAdmin, tab])
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState([])
  const [permsLoading, setPermsLoading] = useState(false)
  const [permsError, setPermsError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState({ type: '', message: '' })
  const loadGen = useRef(0)

  const [modalMode, setModalMode] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [roleForm, setRoleForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const [lookupUserId, setLookupUserId] = useState('')
  const [assignments, setAssignments] = useState([])
  const [assignLoading, setAssignLoading] = useState(false)
  const [assignForm, setAssignForm] = useState(emptyAssignForm)
  const [assignOpen, setAssignOpen] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState(null)

  const tenantSlug =
    resolveRolesTenantSlug() ||
    tenant?.schema_name ||
    tenant?.slug ||
    user?.tenant_slug ||
    user?.schema_name ||
    ''

  const canUseRolesApi = superAdmin || Boolean(tenantSlug)

  const loadRoles = useCallback(async () => {
    const gen = ++loadGen.current
    setLoading(true)
    setError('')
    try {
      // Prefer JWT / stored slug — do NOT persistAuthSession here (that caused the loop).
      if (!isSuperAdmin(getAuthUser()) && !resolveRolesTenantSlug()) {
        try {
          const auth = getAuthUser()
          const list = await fetchMyTenants()
          if (gen !== loadGen.current) return
          saveStoredTenants(list)
          const preferred =
            list.find((t) => String(t.id) === String(auth?.tenant_id)) ||
            list.find((t) => String(t.status).toLowerCase() === 'active') ||
            list[0] ||
            null
          if (preferred?.id != null) {
            setSelectedTenantId(preferred.id)
            const slug = preferred.schema_name || preferred.slug || ''
            if (slug && auth) {
              // Quiet write — no auth-changed event
              localStorage.setItem(
                'authUser',
                JSON.stringify({
                  ...auth,
                  tenant_id: preferred.id,
                  tenant_slug: slug,
                  schema_name: slug,
                }),
              )
            }
          }
        } catch {
          // ignore — roles call may still work via JWT schema
        }
      }

      if (gen !== loadGen.current) return

      const asSuper = isSuperAdmin(getAuthUser())
      if (!asSuper && !resolveRolesTenantSlug()) {
        setRoles([])
        setError('Select or activate a tenant first so X-Tenant (slug) can be sent.')
        return
      }

      // List page: roles only. Permissions load when opening create/edit.
      const roleList = await fetchRoles()
      if (gen !== loadGen.current) return
      setRoles(roleList)
    } catch (err) {
      if (gen !== loadGen.current) return
      setRoles([])
      setError(apiErrorMessage(err, 'Could not load roles.'))
    } finally {
      if (gen === loadGen.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRoles()
    return () => {
      // Invalidate in-flight work so StrictMode remount can fetch cleanly.
      loadGen.current += 1
    }
  }, [loadRoles])

  /** Only what GET /api/roles/permissions/ returns — no static catalog. */
  const permissionOptions = permissions

  /** Load permission list from API when opening create/edit. */
  const loadPermissionCatalog = useCallback(async () => {
    setPermsLoading(true)
    setPermsError('')
    setPermissions([])
    try {
      const list = await fetchRolePermissions()
      setPermissions(list)
      if (!list.length) {
        setPermsError('Permissions API returned an empty list.')
      }
    } catch (err) {
      setPermissions([])
      setPermsError(apiErrorMessage(err, 'Could not load permissions from API.'))
    } finally {
      setPermsLoading(false)
    }
  }, [])

  const openCreate = () => {
    setStatus({ type: '', message: '' })
    setPermsError('')
    setModalMode('create')
    setEditTarget(null)
    setRoleForm(emptyRoleForm())
    loadPermissionCatalog()
  }

  const openEdit = (role) => {
    setStatus({ type: '', message: '' })
    setPermsError('')
    setModalMode('edit')
    setEditTarget(role)
    setRoleForm(toRoleForm(role))
    loadPermissionCatalog()
  }

  const closeModal = () => {
    if (saving) return
    setModalMode(null)
    setEditTarget(null)
    setRoleForm(null)
  }

  const togglePermission = (permId) => {
    const id = Number(permId)
    if (!Number.isFinite(id)) return
    setRoleForm((prev) => {
      const set = new Set((prev.permissions || []).map(Number))
      if (set.has(id)) set.delete(id)
      else set.add(id)
      return { ...prev, permissions: [...set] }
    })
  }

  const saveRole = async (event) => {
    event.preventDefault()
    if (!roleForm) return
    const code = String(roleForm.code || '').trim().toUpperCase()
    const name = String(roleForm.name || '').trim()
    const rank = Number(roleForm.rank)
    const permissions = (roleForm.permissions || [])
      .map(Number)
      .filter((id) => Number.isFinite(id))
    if (!code || !name || !Number.isFinite(rank)) {
      setStatus({ type: 'error', message: 'Code, name, and rank are required.' })
      return
    }
    setSaving(true)
    setStatus({ type: '', message: '' })
    try {
      if (modalMode === 'create') {
        await createRole({ code, name, rank, permissions })
        setStatus({ type: 'success', message: `${name} created.` })
      } else {
        await updateRole(editTarget.id, {
          name,
          rank,
          permissions,
        })
        setStatus({ type: 'success', message: `${name} updated.` })
      }
      closeModal()
      await loadRoles()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not save role.') })
    } finally {
      setSaving(false)
    }
  }

  const confirmDeleteRole = async () => {
    if (!deleteTarget?.id) return
    setSaving(true)
    setStatus({ type: '', message: '' })
    try {
      await deleteRole(deleteTarget.id)
      setStatus({ type: 'success', message: `${deleteTarget.name || 'Role'} deleted.` })
      setDeleteTarget(null)
      await loadRoles()
    } catch (err) {
      setStatus({
        type: 'error',
        message: apiErrorMessage(err, 'Could not delete role. Remove assignments first.'),
      })
    } finally {
      setSaving(false)
    }
  }

  const loadAssignments = async (event) => {
    event?.preventDefault?.()
    const userId = String(lookupUserId || '').trim()
    if (!userId) {
      setStatus({ type: 'error', message: 'Enter a user id to load assignments.' })
      return
    }
    setAssignLoading(true)
    setStatus({ type: '', message: '' })
    try {
      const list = await fetchRoleAssignments(userId)
      setAssignments(list)
      if (!list.length) {
        setStatus({ type: 'info', message: 'No role assignments for this user.' })
      }
    } catch (err) {
      setAssignments([])
      setStatus({
        type: 'error',
        message: apiErrorMessage(err, 'Could not load role assignments.'),
      })
    } finally {
      setAssignLoading(false)
    }
  }

  const openAssign = () => {
    setStatus({ type: '', message: '' })
    setAssignForm({
      ...emptyAssignForm(),
      user_id: String(lookupUserId || '').trim(),
      role_id: roles[0]?.id != null ? String(roles[0].id) : '',
    })
    setAssignOpen(true)
  }

  const saveAssignment = async (event) => {
    event.preventDefault()
    const user_id = String(assignForm.user_id || '').trim()
    const role_id = String(assignForm.role_id || '').trim()
    const object_type = String(assignForm.object_type || '').trim()
    const object_id = Number(assignForm.object_id)
    if (!user_id || !role_id || !object_type || !Number.isFinite(object_id)) {
      setStatus({
        type: 'error',
        message: 'user_id, role_id, object_type, and object_id are required.',
      })
      return
    }
    setSaving(true)
    setStatus({ type: '', message: '' })
    try {
      await createRoleAssignment({ user_id, role_id, object_type, object_id })
      setAssignOpen(false)
      setLookupUserId(user_id)
      setStatus({ type: 'success', message: 'Role assigned.' })
      setAssignments(await fetchRoleAssignments(user_id))
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not assign role.') })
    } finally {
      setSaving(false)
    }
  }

  const confirmRevoke = async () => {
    if (!revokeTarget?.id) return
    setSaving(true)
    setStatus({ type: '', message: '' })
    try {
      await deleteRoleAssignment(revokeTarget.id)
      setRevokeTarget(null)
      setStatus({ type: 'success', message: 'Assignment revoked.' })
      if (lookupUserId.trim()) {
        setAssignments(await fetchRoleAssignments(lookupUserId.trim()))
      }
    } catch (err) {
      setStatus({
        type: 'error',
        message: apiErrorMessage(err, 'Could not revoke assignment.'),
      })
    } finally {
      setSaving(false)
    }
  }

  const roleNameById = (id) => {
    const found = roles.find((r) => String(r.id) === String(id))
    return found?.name || found?.code || id || '—'
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={superAdmin ? 'Platform' : 'Organization'}
        title={superAdmin ? 'Roles' : 'Roles & assignments'}
        description={
          superAdmin
            ? 'Create and manage platform roles.'
            : `Workspace roles and assignments for ${tenantSlug || 'your tenant'} (X-Tenant = tenant slug).`
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={loadRoles}
              disabled={loading || !canUseRolesApi}
            >
              <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
              Refresh
            </button>
            {tab === 'roles' || superAdmin ? (
              <button
                type="button"
                className={btnPrimary}
                onClick={openCreate}
                disabled={!canUseRolesApi}
              >
                <FiPlus className="h-4 w-4" aria-hidden />
                Create role
              </button>
            ) : (
              <button
                type="button"
                className={btnPrimary}
                onClick={openAssign}
                disabled={!canUseRolesApi || !roles.length}
              >
                <FiPlus className="h-4 w-4" aria-hidden />
                Assign role
              </button>
            )}
          </div>
        }
      />

      {!superAdmin && !canUseRolesApi ? (
        <StatusBanner
          type="warning"
          message="Select or activate a tenant first so requests can include X-Tenant (slug)."
        />
      ) : null}

      {!superAdmin && tenantSlug ? (
        <StatusBanner type="info" message={`X-Tenant: ${tenantSlug}`} />
      ) : null}

      <StatusBanner type={status.type} message={status.message} />

      {!superAdmin ? (
        <div className="inline-flex rounded-xl border border-stone-200 bg-white p-1">
          {visibleTabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                tab === item.id
                  ? 'bg-brand-500 text-white'
                  : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {tab === 'roles' || superAdmin ? (
        <>
          {error ? <ErrorState message={error} onRetry={loadRoles} /> : null}
          {!error && loading ? <LoadingState label="Loading roles…" /> : null}
          {!error && !loading && !canUseRolesApi ? (
            <EmptyState
              title="Tenant required"
              hint="Activate a tenant so the X-Tenant slug can be sent."
            />
          ) : null}
          {!error && !loading && canUseRolesApi && roles.length === 0 ? (
            <EmptyState
              title="No roles"
              hint="Create a custom role with a unique code."
              actionLabel="Create role"
              onAction={openCreate}
            />
          ) : null}
          {!error && !loading && roles.length > 0 ? (
            <div className={tableWrapClass}>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className={tableHeadClass}>
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Permissions</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {roles.map((row) => (
                      <tr key={row.id} className="hover:bg-stone-50">
                        <td className="px-4 py-3 font-medium text-stone-900">{row.name || '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-stone-600">
                          {row.code || '—'}
                        </td>
                        <td className="px-4 py-3 text-stone-600">{row.rank}</td>
                        <td className="px-4 py-3 text-stone-600">
                          {(() => {
                            const perms = row.permissions || row.permission_details || []
                            if (!perms.length) {
                              return <span className="text-stone-400">0</span>
                            }
                            const preview = perms
                              .slice(0, 2)
                              .map((p) => (typeof p === 'string' ? p : p.name || p.code || ''))
                              .filter(Boolean)
                              .join(', ')
                            const extra = perms.length > 2 ? ` +${perms.length - 2}` : ''
                            return (
                              <div className="min-w-0">
                                <p className="font-medium text-stone-800">{perms.length}</p>
                                {preview ? (
                                  <p className="truncate text-xs text-stone-400" title={perms
                                    .map((p) => (typeof p === 'string' ? p : p.name || p.code || ''))
                                    .filter(Boolean)
                                    .join(', ')}>
                                    {preview}
                                    {extra}
                                  </p>
                                ) : null}
                              </div>
                            )
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            <button type="button" className={btnGhost} onClick={() => openEdit(row)}>
                              <FiEdit2 className="h-3.5 w-3.5" aria-hidden />
                              Edit
                            </button>
                            <button
                              type="button"
                              className={btnGhost}
                              onClick={() => setDeleteTarget(row)}
                              disabled={row.is_system}
                              aria-label={`Delete ${row.name}`}
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
          ) : null}
        </>
      ) : (
        <div className="space-y-4">
          <Panel>
            <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={loadAssignments}>
              <label className="block min-w-0 flex-1">
                <span className={labelClass}>User id</span>
                <input
                  className={fieldClass}
                  value={lookupUserId}
                  onChange={(e) => setLookupUserId(e.target.value)}
                  placeholder="User id"
                  disabled={!canUseRolesApi || assignLoading}
                />
              </label>
              <button type="submit" className={btnPrimary} disabled={!canUseRolesApi || assignLoading}>
                {assignLoading ? (
                  <>
                    <FiLoader className="h-4 w-4 animate-spin" aria-hidden />
                    Loading…
                  </>
                ) : (
                  'Load assignments'
                )}
              </button>
            </form>
          </Panel>

          {!canUseRolesApi ? (
            <EmptyState title="Tenant required" hint="Activate a tenant to manage assignments." />
          ) : assignments.length === 0 ? (
            <EmptyState
              title="No assignments loaded"
              hint="Enter a user id and load, or assign a role."
              actionLabel="Assign role"
              onAction={openAssign}
            />
          ) : (
            <div className={tableWrapClass}>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className={tableHeadClass}>
                    <tr>
                      <th className="px-4 py-3">Assignment</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Object</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {assignments.map((row) => (
                      <tr key={row.id} className="hover:bg-stone-50">
                        <td className="px-4 py-3 font-mono text-xs text-stone-600">{row.id}</td>
                        <td className="px-4 py-3 text-stone-800">
                          {row.role_name || roleNameById(row.role_id)}
                        </td>
                        <td className="px-4 py-3 text-stone-600">
                          {row.object_type}:{row.object_id}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            className={btnGhost}
                            onClick={() => setRevokeTarget(row)}
                          >
                            <FiTrash2 className="h-3.5 w-3.5 text-rose-600" aria-hidden />
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal
        open={Boolean(modalMode)}
        onClose={closeModal}
        title={modalMode === 'create' ? 'Create role' : 'Edit role'}
        wide
      >
        {roleForm ? (
          <form className="space-y-4" onSubmit={saveRole}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Code</span>
                <input
                  className={fieldClass}
                  value={roleForm.code}
                  onChange={(e) =>
                    setRoleForm((f) => ({
                      ...f,
                      code: e.target.value.toUpperCase().replace(/\s+/g, '_'),
                    }))
                  }
                  disabled={saving || modalMode === 'edit'}
                  required
                  placeholder="AUDITOR"
                />
              </label>
              <label className="block">
                <span className={labelClass}>Rank</span>
                <input
                  type="number"
                  className={fieldClass}
                  value={roleForm.rank}
                  onChange={(e) => setRoleForm((f) => ({ ...f, rank: e.target.value }))}
                  disabled={saving}
                  required
                />
              </label>
              <label className="block sm:col-span-2">
                <span className={labelClass}>Name</span>
                <input
                  className={fieldClass}
                  value={roleForm.name}
                  onChange={(e) => setRoleForm((f) => ({ ...f, name: e.target.value }))}
                  disabled={saving}
                  required
                />
              </label>
            </div>

            <div>
              <p className={labelClass}>Permissions</p>
              {permsLoading ? (
                <p className="inline-flex items-center gap-2 text-sm text-stone-500">
                  <FiLoader className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Loading from /api/roles/permissions/…
                </p>
              ) : null}
              {!permsLoading && permsError ? (
                <div className="space-y-2">
                  <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {permsError}
                  </p>
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={loadPermissionCatalog}
                    disabled={saving}
                  >
                    Retry permissions
                  </button>
                </div>
              ) : null}
              {!permsLoading && !permsError && permissionOptions.length === 0 ? (
                <p className="text-sm text-stone-500">No permissions in API response.</p>
              ) : null}
              {!permsLoading && !permsError && permissionOptions.length > 0 ? (
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-stone-200 p-3">
                  {permissionOptions.map((perm) => {
                    const permId = Number(perm.id)
                    const checked =
                      Number.isFinite(permId) &&
                      (roleForm.permissions || []).map(Number).includes(permId)
                    return (
                      <label
                        key={perm.id ?? perm.code}
                        className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-stone-50"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-brand-500"
                          checked={checked}
                          disabled={saving || !Number.isFinite(permId)}
                          onChange={() => togglePermission(permId)}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-stone-800">
                            {perm.name || perm.code}
                          </span>
                          <span className="block font-mono text-[11px] text-stone-400">
                            {perm.code}
                          </span>
                          {perm.description ? (
                            <span className="mt-0.5 block text-xs text-stone-500">
                              {perm.description}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    )
                  })}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-stone-100 pt-4 sm:flex-row sm:justify-end">
              <button type="button" className={btnSecondary} onClick={closeModal} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className={btnPrimary} disabled={saving}>
                {saving ? (
                  <>
                    <FiLoader className="h-4 w-4 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : modalMode === 'create' ? (
                  'Create role'
                ) : (
                  'Save changes'
                )}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={assignOpen} onClose={() => !saving && setAssignOpen(false)} title="Assign role">
        <form className="space-y-4" onSubmit={saveAssignment}>
          <label className="block">
            <span className={labelClass}>User id</span>
            <input
              className={fieldClass}
              value={assignForm.user_id}
              onChange={(e) => setAssignForm((f) => ({ ...f, user_id: e.target.value }))}
              disabled={saving}
              required
            />
          </label>
          <label className="block">
            <span className={labelClass}>Role</span>
            <select
              className={fieldClass}
              value={assignForm.role_id}
              onChange={(e) => setAssignForm((f) => ({ ...f, role_id: e.target.value }))}
              disabled={saving}
              required
            >
              <option value="">Select role…</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.code})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Object type</span>
            <input
              className={fieldClass}
              value={assignForm.object_type}
              onChange={(e) => setAssignForm((f) => ({ ...f, object_type: e.target.value }))}
              disabled={saving}
              required
              placeholder="booking.venue"
            />
          </label>
          <label className="block">
            <span className={labelClass}>Object id</span>
            <input
              type="number"
              className={fieldClass}
              value={assignForm.object_id}
              onChange={(e) => setAssignForm((f) => ({ ...f, object_id: e.target.value }))}
              disabled={saving}
              required
            />
          </label>
          <div className="flex flex-col-reverse gap-2 border-t border-stone-100 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setAssignOpen(false)}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className={btnPrimary} disabled={saving}>
              {saving ? (
                <>
                  <FiLoader className="h-4 w-4 animate-spin" aria-hidden />
                  Assigning…
                </>
              ) : (
                'Assign role'
              )}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete role?"
        message={
          deleteTarget
            ? `Delete “${deleteTarget.name || deleteTarget.code}”? Remove all assignments first.`
            : ''
        }
        confirmLabel="Delete"
        loading={saving}
        onConfirm={confirmDeleteRole}
        onClose={() => !saving && setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title="Revoke assignment?"
        message="Remove this role grant? The last active Tenant Admin grant cannot be removed."
        confirmLabel="Revoke"
        loading={saving}
        onConfirm={confirmRevoke}
        onClose={() => !saving && setRevokeTarget(null)}
      />
    </div>
  )
}

export default Roles
