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

const requireId = (id, label) => {
  const v = String(id ?? '').trim()
  if (!v) throw new Error(`${label} id is required.`)
  return v
}

export const normalizePermission = (row, fallbackCode = '') => {
  if (typeof row === 'string' || typeof row === 'number') {
    const code = String(row)
    return {
      id: typeof row === 'number' ? row : null,
      code,
      name: code,
      description: '',
      contentType: '',
    }
  }
  if (row == null || typeof row !== 'object') {
    return { id: null, code: fallbackCode, name: fallbackCode, description: '', contentType: '' }
  }
  const code = String(
    row.codename || row.code || row.key || row.slug || row.id || fallbackCode || '',
  ).trim()
  const contentType =
    typeof row.content_type === 'object'
      ? String(row.content_type?.app_label || row.content_type?.model || '')
      : String(row.content_type || row.app_label || '')
  return {
    id: row.id ?? row.pk ?? null,
    code,
    name: String(row.name || row.label || row.title || code).trim() || code,
    description: String(row.description || row.help_text || '').trim(),
    contentType,
  }
}

const permissionIds = (row = {}) => {
  const raw = row.permissions ?? row.permission_ids ?? row.permission_details ?? []
  if (!Array.isArray(raw)) return []
  return raw
    .map((p) => {
      if (typeof p === 'number') return p
      if (typeof p === 'string' && /^\d+$/.test(p)) return Number(p)
      const id = p?.id ?? p?.pk
      return id != null && id !== '' ? Number(id) : null
    })
    .filter((id) => Number.isFinite(id))
}

export const normalizeGroup = (row = {}) => {
  const perms = Array.isArray(row.permissions)
    ? row.permissions.map((p) => normalizePermission(p))
    : permissionIds(row).map((id) => normalizePermission(id))
  return {
    ...row,
    id: row.id ?? row.pk ?? null,
    name: String(row.name || '').trim(),
    permissions: perms,
    permissionIds: permissionIds(row),
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

  // Leaf permission row
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
    return collectPermissionRows(node.permissions, label || node.name || node.app_label || '', depth + 1)
  }
  if (Array.isArray(node.items)) return collectPermissionRows(node.items, label, depth + 1)
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
    const key = p.contentType || 'other'
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

/** GET /api/groups/ */
export const fetchGroups = async () => {
  const { data } = await api.get('api/groups/')
  return asList(data).map(normalizeGroup).filter((g) => g.id != null)
}

/** GET /api/groups/:id/ */
export const fetchGroupById = async (groupId) => {
  const id = requireId(groupId, 'Group')
  const { data } = await api.get(`api/groups/${id}/`)
  return normalizeGroup(unwrap(data))
}

/** POST /api/groups/ */
export const createGroup = async ({ name, permissions = [] }) => {
  const { data } = await api.post('api/groups/', {
    name: String(name || '').trim(),
    permissions: (permissions || []).map(Number).filter((n) => Number.isFinite(n)),
  })
  return normalizeGroup(unwrap(data))
}

/** PATCH /api/groups/:id/ */
export const updateGroup = async (groupId, { name, permissions } = {}) => {
  const id = requireId(groupId, 'Group')
  const body = {}
  if (name != null) body.name = String(name).trim()
  if (permissions != null) {
    body.permissions = permissions.map(Number).filter((n) => Number.isFinite(n))
  }
  const { data } = await api.patch(`api/groups/${id}/`, body)
  return normalizeGroup(unwrap(data))
}

/** DELETE /api/groups/:id/ */
export const deleteGroup = async (groupId) => {
  const id = requireId(groupId, 'Group')
  await api.delete(`api/groups/${id}/`)
  return { id }
}

/** GET /api/groups/:id/users/ */
export const fetchGroupMembers = async (groupId) => {
  const id = requireId(groupId, 'Group')
  const { data } = await api.get(`api/groups/${id}/users/`)
  return asList(data).map(normalizeGroupMember).filter((m) => m.id)
}

/** POST /api/groups/:id/users/ */
export const addGroupMembers = async (groupId, userIds = []) => {
  const id = requireId(groupId, 'Group')
  const ids = (userIds || []).map((u) => (Number.isFinite(Number(u)) ? Number(u) : u)).filter(Boolean)
  const { data } = await api.post(`api/groups/${id}/users/`, {
    user_ids: ids,
    users: ids,
  })
  return unwrap(data)
}

/** DELETE /api/groups/:id/users/ — remove one member */
export const removeGroupMember = async (groupId, userId) => {
  const id = requireId(groupId, 'Group')
  const uid = requireId(userId, 'User')
  await api.delete(`api/groups/${id}/users/`, {
    params: { user: uid, user_id: uid },
  })
  return { id, userId: uid }
}

/** GET /api/permissions/ — follows pagination so the full catalog is returned. */
export const fetchPermissions = async () => {
  const all = []
  let page = 1
  let guard = 0
  while (guard < 50) {
    guard += 1
    const { data } = await api.get('api/permissions/', {
      params: { page, page_size: 100 },
    })
    const batch = flattenPermissions(data)
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
  return dedupePermissions(all)
}

/** GET /api/permissions/grouped/ */
export const fetchPermissionsGrouped = async () => {
  const { data } = await api.get('api/permissions/grouped/')
  return flattenPermissions(data)
}
