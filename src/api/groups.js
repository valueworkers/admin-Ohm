import api from './axiosClient'

const asList = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.data?.results)) return data.data.results
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.groups)) return data.groups
  if (Array.isArray(data?.permissions)) return data.permissions
  if (Array.isArray(data?.users)) return data.users
  if (Array.isArray(data?.members)) return data.members
  return []
}

const unwrap = (data) => data?.data || data

/**
 * Accounts → Groups / Permissions.
 * Super Admin (public schema): omit X-Tenant.
 * Tenant workspace: send X-Tenant = tenant slug.
 */
const tenantOpts = (tenantSlug) => {
  const slug = String(tenantSlug || '').trim()
  return slug ? { xTenant: slug } : {}
}

const requireId = (id, label) => {
  const v = String(id ?? '').trim()
  if (!v) throw new Error(`${label} id is required.`)
  return v
}

const toPermissionIds = (list = []) =>
  (list || [])
    .map((p) => {
      if (typeof p === 'number') return p
      if (typeof p === 'string' && /^\d+$/.test(p)) return Number(p)
      const id = p?.id ?? p?.pk
      return id != null && id !== '' ? Number(id) : null
    })
    .filter((id) => Number.isFinite(id))

export const normalizePermission = (row, fallbackCode = '') => {
  if (typeof row === 'string' || typeof row === 'number') {
    const code = String(row)
    return {
      id: typeof row === 'number' ? row : null,
      code,
      name: code,
      description: '',
      contentType: '',
      app_label: '',
      model: '',
    }
  }
  if (row == null || typeof row !== 'object') {
    return {
      id: null,
      code: fallbackCode,
      name: fallbackCode,
      description: '',
      contentType: '',
      app_label: '',
      model: '',
    }
  }
  const appLabel = String(
    row.app_label ||
      (typeof row.content_type === 'object' ? row.content_type?.app_label : '') ||
      '',
  ).trim()
  const model = String(
    row.model ||
      (typeof row.content_type === 'object' ? row.content_type?.model : '') ||
      '',
  ).trim()
  const code = String(
    row.codename || row.code || row.key || row.slug || row.id || fallbackCode || '',
  ).trim()
  const contentType =
    [appLabel, model].filter(Boolean).join('.') ||
    (typeof row.content_type === 'object'
      ? String(row.content_type?.app_label || row.content_type?.model || '')
      : String(row.content_type || ''))
  return {
    id: row.id ?? row.pk ?? null,
    code,
    name: String(row.name || row.label || row.title || code).trim() || code,
    description: String(row.description || row.help_text || '').trim(),
    contentType,
    app_label: appLabel,
    model,
  }
}

const permissionIds = (row = {}) => {
  const raw = row.permissions ?? row.permission_ids ?? row.permission_details ?? []
  if (!Array.isArray(raw)) return []
  return toPermissionIds(raw)
}

export const normalizeGroup = (row = {}) => {
  const rawPerms = Array.isArray(row.permissions)
    ? row.permissions
    : Array.isArray(row.permission_details)
      ? row.permission_details
      : permissionIds(row)
  const perms = rawPerms.map((p) => normalizePermission(p))
  return {
    ...row,
    id: row.id ?? row.pk ?? null,
    name: String(row.name || '').trim(),
    permissions: perms,
    permissionIds: permissionIds(row).length
      ? permissionIds(row)
      : toPermissionIds(perms),
    userCount: Number(row.user_count ?? row.users_count ?? row.member_count ?? NaN),
  }
}

export const normalizeGroupMember = (row = {}) => {
  if (typeof row === 'string' || typeof row === 'number') {
    return { id: String(row), name: String(row), email: '', raw: row }
  }
  const id = row.id ?? row.pk ?? row.user_id ?? row.user?.id ?? ''
  const name =
    [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
    row.full_name ||
    row.name ||
    row.username ||
    row.email ||
    String(id)
  return {
    id: String(id),
    name,
    email: String(row.email || row.user?.email || ''),
    username: String(row.username || row.user?.username || ''),
    raw: row,
  }
}

const dedupePermissions = (list) => {
  const seen = new Set()
  const out = []
  for (const p of list) {
    const key = p.id != null ? `id:${p.id}` : `code:${p.code}`
    if (!p.code && p.id == null) continue
    if (seen.has(key)) continue
    seen.add(key)
    out.push(p)
  }
  return out
}

const collectPermissionRows = (node, label = '', depth = 0) => {
  if (node == null || depth > 6) return []
  if (Array.isArray(node)) {
    return node.flatMap((item) => collectPermissionRows(item, label, depth + 1))
  }
  if (typeof node !== 'object') {
    return [normalizePermission(node, label)]
  }

  if (
    node.id != null ||
    node.pk != null ||
    node.codename ||
    node.code ||
    (node.name && (node.content_type != null || node.app_label != null))
  ) {
    return [normalizePermission(node, label)]
  }

  if (Array.isArray(node.results)) return collectPermissionRows(node.results, label, depth + 1)
  if (Array.isArray(node.permissions)) {
    return collectPermissionRows(
      node.permissions,
      label || node.name || node.app_label || node.model || '',
      depth + 1,
    )
  }
  if (Array.isArray(node.items)) return collectPermissionRows(node.items, label, depth + 1)
  if (Array.isArray(node.models)) return collectPermissionRows(node.models, label, depth + 1)
  if (Array.isArray(node.groups)) return collectPermissionRows(node.groups, label, depth + 1)

  const skip = new Set([
    'message',
    'detail',
    'count',
    'next',
    'previous',
    'page',
    'page_size',
    'total_pages',
    'current_page',
  ])
  return Object.entries(node).flatMap(([key, value]) => {
    if (skip.has(key)) return []
    if (key === 'data') return collectPermissionRows(value, label, depth + 1)
    return collectPermissionRows(value, label || key, depth + 1)
  })
}

/** Flatten GET /api/permissions/ or /api/permissions/grouped/ into a list. */
export const flattenPermissions = (data) =>
  dedupePermissions(
    collectPermissionRows(unwrap(data)).filter((p) => p.id != null || Boolean(p.code)),
  )

export const groupPermissionsByApp = (list = []) => {
  const map = new Map()
  for (const p of list) {
    const key = p.contentType || p.app_label || 'other'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(p)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([app, permissions]) => ({
      app,
      permissions: [...permissions].sort((x, y) =>
        String(x.name || x.code).localeCompare(String(y.name || y.code)),
      ),
    }))
}

const fetchAllPages = async (path, tenantSlug, extraParams = {}) => {
  const opts = tenantOpts(tenantSlug)
  const all = []
  let page = 1
  let guard = 0
  while (guard < 50) {
    guard += 1
    const { data } = await api.get(path, {
      params: { page, page_size: 100, ...extraParams },
      ...opts,
    })
    const batch = asList(data)
    if (!batch.length) break
    all.push(...batch)

    const next = data?.next ?? data?.data?.next ?? null
    const totalPages = Number(data?.total_pages ?? data?.data?.total_pages ?? 0)
    const count = Number(data?.count ?? data?.data?.count ?? 0)
    if (next || (totalPages && page < totalPages) || (count && all.length < count)) {
      page += 1
      continue
    }
    break
  }
  return all
}

/** GET /api/auth/groups/ */
export const fetchGroups = async (tenantSlug) => {
  const rows = await fetchAllPages('api/auth/groups/', tenantSlug)
  return rows.map(normalizeGroup).filter((g) => g.id != null)
}

/** GET /api/auth/groups/:id/ */
export const fetchGroupById = async (tenantSlug, groupId) => {
  const id = requireId(groupId, 'Group')
  const { data } = await api.get(`api/auth/groups/${id}/`, tenantOpts(tenantSlug))
  return normalizeGroup(unwrap(data))
}

/** POST /api/auth/groups/ */
export const createGroup = async (tenantSlug, { name, permissions = [] } = {}) => {
  const { data } = await api.post(
    'api/auth/groups/',
    {
      name: String(name || '').trim(),
      permissions: toPermissionIds(permissions),
    },
    tenantOpts(tenantSlug),
  )
  return normalizeGroup(unwrap(data))
}

/** PATCH /api/auth/groups/:id/ */
export const updateGroup = async (tenantSlug, groupId, { name, permissions } = {}) => {
  const id = requireId(groupId, 'Group')
  const { data } = await api.patch(
    `api/auth/groups/${id}/`,
    {
      name: String(name || '').trim(),
      permissions: toPermissionIds(permissions),
    },
    tenantOpts(tenantSlug),
  )
  return normalizeGroup(unwrap(data))
}

/** PUT /api/auth/groups/:id/ */
export const replaceGroup = async (tenantSlug, groupId, { name, permissions } = {}) => {
  const id = requireId(groupId, 'Group')
  const { data } = await api.put(
    `api/auth/groups/${id}/`,
    {
      name: String(name || '').trim(),
      permissions: toPermissionIds(permissions),
    },
    tenantOpts(tenantSlug),
  )
  return normalizeGroup(unwrap(data))
}

/** DELETE /api/auth/groups/:id/ */
export const deleteGroup = async (tenantSlug, groupId) => {
  const id = requireId(groupId, 'Group')
  await api.delete(`api/auth/groups/${id}/`, tenantOpts(tenantSlug))
  return { id }
}

/** GET /api/auth/groups/:id/users/ */
export const fetchGroupMembers = async (tenantSlug, groupId) => {
  const id = requireId(groupId, 'Group')
  const { data } = await api.get(`api/auth/groups/${id}/users/`, tenantOpts(tenantSlug))
  return asList(data).map(normalizeGroupMember).filter((m) => m.id)
}

/** POST /api/auth/groups/:id/users/ — { user_ids: [] } */
export const addGroupMembers = async (tenantSlug, groupId, userIds = []) => {
  const id = requireId(groupId, 'Group')
  const ids = (userIds || [])
    .map((u) => (Number.isFinite(Number(u)) ? Number(u) : u))
    .filter((v) => v !== '' && v != null)
  const { data } = await api.post(
    `api/auth/groups/${id}/users/`,
    { user_ids: ids },
    tenantOpts(tenantSlug),
  )
  return unwrap(data)
}

/** DELETE /api/auth/groups/:id/users/?user_id= */
export const removeGroupMember = async (tenantSlug, groupId, userId) => {
  const id = requireId(groupId, 'Group')
  const uid = requireId(userId, 'User')
  await api.delete(`api/auth/groups/${id}/users/`, {
    params: { user_id: uid },
    ...tenantOpts(tenantSlug),
  })
  return { id, userId: uid }
}

/** GET /api/auth/permissions/ */
export const fetchPermissions = async (tenantSlug, { search } = {}) => {
  const rows = await fetchAllPages(
    'api/auth/permissions/',
    tenantSlug,
    search ? { search } : {},
  )
  return dedupePermissions(
    rows.map((row) => normalizePermission(row)).filter((p) => p.id != null),
  )
}

/** GET /api/auth/permissions/grouped/ */
export const fetchPermissionsGrouped = async (tenantSlug) => {
  const { data } = await api.get('api/auth/permissions/grouped/', tenantOpts(tenantSlug))
  return flattenPermissions(data)
}
