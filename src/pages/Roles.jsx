import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FiEdit2, FiLoader, FiPlus, FiRefreshCw, FiSearch, FiTrash2, FiUsers } from 'react-icons/fi'
import {
  addGroupMembers,
  createGroup,
  deleteGroup,
  fetchGroupById,
  fetchGroupMembers,
  fetchGroups,
  fetchPermissions,
  fetchPermissionsGrouped,
  groupPermissionsByApp,
  removeGroupMember,
  updateGroup,
} from '../api/groups'
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
  { id: 'members', label: 'Members' },
]

const emptyForm = () => ({
  name: '',
  permissions: [],
})

const toForm = (group = {}) => ({
  name: group.name || '',
  permissions: (group.permissionIds || []).map(Number).filter((n) => Number.isFinite(n)),
})

const Roles = () => {
  const { isSuperAdmin: superAdmin, tenant, user } = useAccess()
  const [tab, setTab] = useState('roles')
  const visibleTabs = superAdmin ? TABS.filter((t) => t.id === 'roles') : TABS

  useEffect(() => {
    if (superAdmin && tab !== 'roles') setTab('roles')
  }, [superAdmin, tab])

  const [groups, setGroups] = useState([])
  const [permissions, setPermissions] = useState([])
  const [permSearch, setPermSearch] = useState('')
  const [permsLoading, setPermsLoading] = useState(false)
  const [permsError, setPermsError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState({ type: '', message: '' })
  const loadGen = useRef(0)

  const [modalMode, setModalMode] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const [memberGroupId, setMemberGroupId] = useState('')
  const [members, setMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [addUserId, setAddUserId] = useState('')
  const [removeTarget, setRemoveTarget] = useState(null)

  const tenantSlug =
    resolveRolesTenantSlug() ||
    tenant?.schema_name ||
    tenant?.slug ||
    user?.tenant_slug ||
    user?.schema_name ||
    ''

  const canUseApi = superAdmin || Boolean(tenantSlug)

  const ensureTenantSlug = useCallback(async () => {
    if (isSuperAdmin(getAuthUser())) return true
    if (resolveRolesTenantSlug()) return true
    try {
      const auth = getAuthUser()
      const list = await fetchMyTenants()
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
      // ignore
    }
    return Boolean(resolveRolesTenantSlug())
  }, [])

  const loadGroups = useCallback(async () => {
    const gen = ++loadGen.current
    setLoading(true)
    setError('')
    try {
      const asSuper = isSuperAdmin(getAuthUser())
      if (!asSuper) {
        const ok = await ensureTenantSlug()
        if (gen !== loadGen.current) return
        if (!ok) {
          setGroups([])
          setError('Select or activate a tenant first so X-Tenant (slug) can be sent.')
          return
        }
      }

      const list = await fetchGroups()
      if (gen !== loadGen.current) return
      setGroups(list)
      setMemberGroupId((prev) => prev || (list[0]?.id != null ? String(list[0].id) : ''))
    } catch (err) {
      if (gen !== loadGen.current) return
      setGroups([])
      setError(apiErrorMessage(err, 'Could not load roles (permission groups).'))
    } finally {
      if (gen === loadGen.current) setLoading(false)
    }
  }, [ensureTenantSlug])

  useEffect(() => {
    loadGroups()
    return () => {
      loadGen.current += 1
    }
  }, [loadGroups])

  const loadPermissionCatalog = useCallback(async () => {
    setPermsLoading(true)
    setPermsError('')
    setPermissions([])
    try {
      // Flat list follows pagination so we get the full catalog.
      let list = await fetchPermissions()
      if (!list.length) list = await fetchPermissionsGrouped()
      // Merge grouped in case it includes extras the flat list missed.
      try {
        const grouped = await fetchPermissionsGrouped()
        if (grouped.length) {
          const byId = new Map()
          for (const p of [...list, ...grouped]) {
            const key = p.id != null ? `id:${p.id}` : `code:${p.code}`
            if (!byId.has(key)) byId.set(key, p)
          }
          list = [...byId.values()]
        }
      } catch {
        // keep flat list
      }
      setPermissions(list)
      if (!list.length) setPermsError('Permissions API returned an empty list.')
    } catch (err) {
      try {
        const list = await fetchPermissionsGrouped()
        setPermissions(list)
        if (!list.length) setPermsError('Permissions API returned an empty list.')
      } catch (err2) {
        setPermissions([])
        setPermsError(apiErrorMessage(err2, 'Could not load permissions.'))
      }
    } finally {
      setPermsLoading(false)
    }
  }, [])

  const filteredPermissionGroups = useMemo(() => {
    const q = permSearch.trim().toLowerCase()
    const list = !q
      ? permissions
      : permissions.filter((p) => {
          const hay = `${p.name || ''} ${p.code || ''} ${p.contentType || ''} ${p.description || ''}`.toLowerCase()
          return hay.includes(q)
        })
    return groupPermissionsByApp(list)
  }, [permissions, permSearch])

  const openCreate = () => {
    setStatus({ type: '', message: '' })
    setPermsError('')
    setPermSearch('')
    setModalMode('create')
    setEditTarget(null)
    setForm(emptyForm())
    loadPermissionCatalog()
  }

  const openEdit = async (group) => {
    setStatus({ type: '', message: '' })
    setPermsError('')
    setPermSearch('')
    setModalMode('edit')
    setEditTarget(group)
    setForm(toForm(group))
    loadPermissionCatalog()
    try {
      const full = await fetchGroupById(group.id)
      setEditTarget(full)
      setForm(toForm(full))
    } catch {
      // keep list row data
    }
  }

  const closeModal = () => {
    if (saving) return
    setModalMode(null)
    setEditTarget(null)
    setForm(null)
  }

  const togglePermission = (permId) => {
    const id = Number(permId)
    if (!Number.isFinite(id)) return
    setForm((prev) => {
      const set = new Set((prev.permissions || []).map(Number))
      if (set.has(id)) set.delete(id)
      else set.add(id)
      return { ...prev, permissions: [...set] }
    })
  }

  const saveGroup = async (event) => {
    event.preventDefault()
    if (!form) return
    const name = String(form.name || '').trim()
    const permissions = (form.permissions || []).map(Number).filter((id) => Number.isFinite(id))
    if (!name) {
      setStatus({ type: 'error', message: 'Role name is required.' })
      return
    }
    setSaving(true)
    setStatus({ type: '', message: '' })
    try {
      if (modalMode === 'create') {
        await createGroup({ name, permissions })
        setStatus({ type: 'success', message: `${name} created.` })
      } else {
        await updateGroup(editTarget.id, { name, permissions })
        setStatus({ type: 'success', message: `${name} updated.` })
      }
      closeModal()
      await loadGroups()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not save role.') })
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return
    setSaving(true)
    setStatus({ type: '', message: '' })
    try {
      await deleteGroup(deleteTarget.id)
      setStatus({ type: 'success', message: `${deleteTarget.name || 'Role'} deleted.` })
      setDeleteTarget(null)
      await loadGroups()
    } catch (err) {
      setStatus({
        type: 'error',
        message: apiErrorMessage(err, 'Could not delete role. Remove members first.'),
      })
    } finally {
      setSaving(false)
    }
  }

  const loadMembers = useCallback(async () => {
    const gid = String(memberGroupId || '').trim()
    if (!gid) {
      setMembers([])
      return
    }
    setMembersLoading(true)
    setStatus({ type: '', message: '' })
    try {
      const list = await fetchGroupMembers(gid)
      setMembers(list)
      if (!list.length) {
        setStatus({ type: 'info', message: 'No members in this role yet.' })
      }
    } catch (err) {
      setMembers([])
      setStatus({
        type: 'error',
        message: apiErrorMessage(err, 'Could not load group members.'),
      })
    } finally {
      setMembersLoading(false)
    }
  }, [memberGroupId])

  useEffect(() => {
    if (tab === 'members' && memberGroupId) loadMembers()
  }, [tab, memberGroupId, loadMembers])

  const addMember = async (event) => {
    event.preventDefault()
    const gid = String(memberGroupId || '').trim()
    const uid = String(addUserId || '').trim()
    if (!gid || !uid) {
      setStatus({ type: 'error', message: 'Select a role and enter a user id.' })
      return
    }
    setSaving(true)
    setStatus({ type: '', message: '' })
    try {
      await addGroupMembers(gid, [uid])
      setAddUserId('')
      setStatus({ type: 'success', message: 'Member added.' })
      await loadMembers()
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not add member.') })
    } finally {
      setSaving(false)
    }
  }

  const confirmRemoveMember = async () => {
    if (!removeTarget?.id || !memberGroupId) return
    setSaving(true)
    setStatus({ type: '', message: '' })
    try {
      await removeGroupMember(memberGroupId, removeTarget.id)
      setRemoveTarget(null)
      setStatus({ type: 'success', message: 'Member removed.' })
      await loadMembers()
    } catch (err) {
      setStatus({
        type: 'error',
        message: apiErrorMessage(err, 'Could not remove member.'),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={superAdmin ? 'Platform' : 'Organization'}
        title="Roles"
        description={
          superAdmin
            ? 'Permission groups for the platform (no X-Tenant).'
            : `Permission groups for ${tenantSlug || 'your tenant'} (X-Tenant required).`
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={loadGroups}
              disabled={loading || !canUseApi}
            >
              <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
              Refresh
            </button>
            {tab === 'roles' || superAdmin ? (
              <button
                type="button"
                className={btnPrimary}
                onClick={openCreate}
                disabled={!canUseApi}
              >
                <FiPlus className="h-4 w-4" aria-hidden />
                Create role
              </button>
            ) : null}
          </div>
        }
      />

      {!superAdmin && !canUseApi ? (
        <StatusBanner
          type="warning"
          message="Select or activate a tenant first so requests can include X-Tenant (slug)."
        />
      ) : null}

      {!superAdmin && tenantSlug ? (
        <StatusBanner type="info" message={`X-Tenant: ${tenantSlug}`} />
      ) : null}

      {superAdmin ? (
        <StatusBanner type="info" message="Super Admin — Groups & Permissions APIs without X-Tenant." />
      ) : null}

      {status.message ? <StatusBanner type={status.type} message={status.message} /> : null}

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
          {error ? <ErrorState message={error} onRetry={loadGroups} /> : null}
          {!error && loading ? <LoadingState label="Loading roles…" /> : null}
          {!error && !loading && !canUseApi ? (
            <EmptyState
              title="Tenant required"
              hint="Activate a tenant so the X-Tenant slug can be sent."
            />
          ) : null}
          {!error && !loading && canUseApi && groups.length === 0 ? (
            <EmptyState
              title="No roles"
              hint="Create a permission group."
              actionLabel="Create role"
              onAction={openCreate}
            />
          ) : null}
          {!error && !loading && groups.length > 0 ? (
            <div className={tableWrapClass}>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className={tableHeadClass}>
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Permissions</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {groups.map((row) => {
                      const count =
                        row.permissionIds?.length ||
                        row.permissions?.length ||
                        0
                      return (
                        <tr key={row.id} className="hover:bg-stone-50">
                          <td className="px-4 py-3 font-medium text-stone-900">{row.name || '—'}</td>
                          <td className="px-4 py-3 text-stone-600">
                            <p className="font-medium text-stone-800">
                              {count} {count === 1 ? 'permission' : 'permissions'}
                            </p>
                            <p className="text-xs text-stone-400">Assigned to this role</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1.5">
                              {!superAdmin ? (
                                <button
                                  type="button"
                                  className={btnGhost}
                                  onClick={() => {
                                    setMemberGroupId(String(row.id))
                                    setTab('members')
                                  }}
                                  aria-label={`Members of ${row.name}`}
                                >
                                  <FiUsers className="h-3.5 w-3.5" aria-hidden />
                                  Members
                                </button>
                              ) : null}
                              <button type="button" className={btnGhost} onClick={() => openEdit(row)}>
                                <FiEdit2 className="h-3.5 w-3.5" aria-hidden />
                                Edit
                              </button>
                              <button
                                type="button"
                                className={btnGhost}
                                onClick={() => setDeleteTarget(row)}
                                aria-label={`Delete ${row.name}`}
                              >
                                <FiTrash2 className="h-3.5 w-3.5 text-rose-600" aria-hidden />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="space-y-4">
          <Panel>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="block min-w-0 flex-1">
                <span className={labelClass}>Role (permission group)</span>
                <select
                  className={fieldClass}
                  value={memberGroupId}
                  onChange={(e) => setMemberGroupId(e.target.value)}
                  disabled={!canUseApi || membersLoading}
                >
                  <option value="">Select role…</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={btnSecondary}
                onClick={loadMembers}
                disabled={!canUseApi || !memberGroupId || membersLoading}
              >
                {membersLoading ? (
                  <>
                    <FiLoader className="h-4 w-4 animate-spin" aria-hidden />
                    Loading…
                  </>
                ) : (
                  'Refresh members'
                )}
              </button>
            </div>
          </Panel>

          <Panel>
            <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={addMember}>
              <label className="block min-w-0 flex-1">
                <span className={labelClass}>Add user id</span>
                <input
                  className={fieldClass}
                  value={addUserId}
                  onChange={(e) => setAddUserId(e.target.value)}
                  placeholder="User id"
                  disabled={!canUseApi || !memberGroupId || saving}
                />
              </label>
              <button
                type="submit"
                className={btnPrimary}
                disabled={!canUseApi || !memberGroupId || saving}
              >
                <FiPlus className="h-4 w-4" aria-hidden />
                Add member
              </button>
            </form>
          </Panel>

          {!canUseApi ? (
            <EmptyState title="Tenant required" hint="Activate a tenant to manage members." />
          ) : !memberGroupId ? (
            <EmptyState title="Select a role" hint="Choose a permission group to view members." />
          ) : membersLoading ? (
            <LoadingState label="Loading members…" />
          ) : members.length === 0 ? (
            <EmptyState title="No members" hint="Add a user id to this role." />
          ) : (
            <div className={tableWrapClass}>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className={tableHeadClass}>
                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {members.map((row) => (
                      <tr key={row.id} className="hover:bg-stone-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-stone-900">{row.name || row.id}</p>
                          <p className="font-mono text-xs text-stone-400">{row.id}</p>
                        </td>
                        <td className="px-4 py-3 text-stone-600">{row.email || '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            className={btnGhost}
                            onClick={() => setRemoveTarget(row)}
                          >
                            <FiTrash2 className="h-3.5 w-3.5 text-rose-600" aria-hidden />
                            Remove
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
        {form ? (
          <form className="space-y-4" onSubmit={saveGroup}>
            <label className="block">
              <span className={labelClass}>Name</span>
              <input
                className={fieldClass}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                disabled={saving}
                required
                placeholder="e.g. Billing Manager"
              />
            </label>

            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <p className={labelClass + ' mb-0'}>Permissions</p>
                {!permsLoading && permissions.length > 0 ? (
                  <p className="text-xs text-stone-500">
                    {(form.permissions || []).length} selected · {permissions.length} total
                  </p>
                ) : null}
              </div>
              {permsLoading ? (
                <p className="inline-flex items-center gap-2 text-sm text-stone-500">
                  <FiLoader className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Loading all permissions…
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
              {!permsLoading && !permsError && permissions.length === 0 ? (
                <p className="text-sm text-stone-500">No permissions in API response.</p>
              ) : null}
              {!permsLoading && !permsError && permissions.length > 0 ? (
                <div className="space-y-2">
                  <div className="relative">
                    <FiSearch
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
                      aria-hidden
                    />
                    <input
                      className={`${fieldClass} pl-9`}
                      value={permSearch}
                      onChange={(e) => setPermSearch(e.target.value)}
                      placeholder="Search permissions…"
                      aria-label="Search permissions"
                      disabled={saving}
                    />
                  </div>
                  <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-lg border border-stone-200 p-3">
                    {filteredPermissionGroups.length === 0 ? (
                      <p className="text-sm text-stone-500">No permissions match this search.</p>
                    ) : (
                      filteredPermissionGroups.map((group) => (
                        <div key={group.app}>
                          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-stone-400">
                            {group.app} · {group.permissions.length}
                          </p>
                          <div className="space-y-0.5">
                            {group.permissions.map((perm) => {
                              const permId = Number(perm.id)
                              const checked =
                                Number.isFinite(permId) &&
                                (form.permissions || []).map(Number).includes(permId)
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
                                  </span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
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

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete role?"
        message={
          deleteTarget
            ? `Delete “${deleteTarget.name}”? Remove members first if the API requires it.`
            : ''
        }
        confirmLabel="Delete"
        loading={saving}
        onConfirm={confirmDelete}
        onClose={() => !saving && setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Remove member?"
        message={
          removeTarget
            ? `Remove ${removeTarget.name || removeTarget.id} from this role?`
            : ''
        }
        confirmLabel="Remove"
        loading={saving}
        onConfirm={confirmRemoveMember}
        onClose={() => !saving && setRemoveTarget(null)}
      />
    </div>
  )
}

export default Roles
