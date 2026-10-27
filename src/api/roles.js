import api from './axiosClient'

const asList = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.roles)) return data.roles
  if (Array.isArray(data?.permissions)) return data.permissions
  if (Array.isArray(data?.assignments)) return data.assignments
  return []
}

const normalizePermission = (row, fallbackCode = '') => {
  if (typeof row === 'string' || typeof row === 'number') {
    const code = String(row)
    return { id: typeof row === 'number' ? row : null, code, name: code, description: '' }
  }
  if (row == null || typeof row !== 'object') {
    return { id: null, code: fallbackCode, name: fallbackCode, description: '' }
  }
  const code = String(
    row.code || row.codename || row.key || row.slug || row.id || fallbackCode || '',
  ).trim()
  return {
    id: row.id ?? row.pk ?? null,
    code,
    name: String(row.name || row.label || row.title || code).trim() || code,
    description: String(row.description || row.help_text || '').trim(),
  }
}

const permissionsFromRole = (row = {}) => {
  if (Array.isArray(row.permission_details) && row.permission_details.length) {
    return row.permission_details
  }
  if (Array.isArray(row.permissions) && row.permissions.length) {
    return row.permissions
  }
  if (Array.isArray(row.permission_ids) && row.permission_ids.length) {
    return row.permission_ids
  }
  return []
}

const normalizeRole = (row = {}) => {
  const permissions = permissionsFromRole(row).map((p) => normalizePermission(p))
  return {
    ...row,
    id: row.id ?? row.pk ?? null,
    code: row.code || '',
    name: row.name || '',
    rank: row.rank != null ? Number(row.rank) : 0,
    permissions,
    permission_details: permissions,
    is_system: Boolean(row.is_system || row.is_builtin || row.system),
  }
}

/** Flatten common permissions API shapes into a list. */
const permissionsFromPayload = (data) => {
  const root = data?.data || data || {}

  if (Array.isArray(root)) return root
  if (Array.isArray(root.results)) return root.results
  if (Array.isArray(root.permissions)) return root.permissions
  if (Array.isArray(root.items)) return root.items
  if (Array.isArray(root.available_permissions)) return root.available_permissions

  // { permissions: { venues: {...}, booking: true } } or { venues: "Venues", ... }
  const bag =
    root.permissions && typeof root.permissions === 'object' && !Array.isArray(root.permissions)
      ? root.permissions
      : root && typeof root === 'object' && !Array.isArray(root)
        ? root
        : null

  if (bag) {
    const skip = new Set(['message', 'detail', 'count', 'next', 'previous'])
    return Object.entries(bag)
      .filter(([key]) => !skip.has(key))
      .map(([key, value]) => {
        if (typeof value === 'string') return { code: key, name: value, description: '' }
        if (typeof value === 'boolean') return { code: key, name: key, description: '', enabled: value }
        if (value && typeof value === 'object') return { code: key, ...value }
        return { code: key, name: key, description: '' }
      })
  }

  return []
}

const normalizeAssignment = (row = {}) => ({
  ...row,
  id: row.id ?? row.pk ?? null,
  user_id: row.user_id != null ? String(row.user_id) : '',
  role_id: row.role_id != null ? String(row.role_id) : String(row.role?.id || ''),
  role_name: row.role_name || row.role?.name || '',
  role_code: row.role_code || row.role?.code || '',
  object_type: row.object_type || '',
  object_id: row.object_id ?? null,
})

/** GET /api/roles/ */
export const fetchRoles = async () => {
  const { data } = await api.get('api/roles/')
  return asList(data).map(normalizeRole)
}

/** GET /api/roles/:id/ */
export const fetchRoleById = async (roleId) => {
  const { data } = await api.get(`api/roles/${roleId}/`)
  return normalizeRole(data?.data || data)
}

/** POST /api/roles/ */
export const createRole = async (payload) => {
  const { data } = await api.post('api/roles/', payload)
  return normalizeRole(data?.data || data)
}

/** PATCH /api/roles/:id/ */
export const updateRole = async (roleId, payload) => {
  const { data } = await api.patch(`api/roles/${roleId}/`, payload)
  return normalizeRole(data?.data || data)
}

/** DELETE /api/roles/:id/ */
export const deleteRole = async (roleId) => {
  const { data } = await api.delete(`api/roles/${roleId}/`)
  return data?.data || data
}

/** GET /api/roles/permissions/ — returns list from API response (not a static catalog). */
export const fetchRolePermissions = async () => {
  const { data } = await api.get('api/roles/permissions/')
  return permissionsFromPayload(data)
    .map((row) =>
      typeof row === 'string' || typeof row === 'number'
        ? normalizePermission(row)
        : normalizePermission(row, row?.code || row?.key || ''),
    )
    .filter((p) => p.code && p.id != null)
}

/** GET /api/role-assignments/?user_id= */
export const fetchRoleAssignments = async (userId) => {
  const { data } = await api.get('api/role-assignments/', {
    params: { user_id: String(userId || '').trim() },
  })
  return asList(data).map(normalizeAssignment)
}

/** POST /api/role-assignments/ */
export const createRoleAssignment = async (payload) => {
  const { data } = await api.post('api/role-assignments/', payload)
  return normalizeAssignment(data?.data || data)
}

/** DELETE /api/role-assignments/:id/ */
export const deleteRoleAssignment = async (assignmentId) => {
  const { data } = await api.delete(`api/role-assignments/${assignmentId}/`)
  return data?.data || data
}
