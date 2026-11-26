import api from './axiosClient'

const asList = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.data?.results)) return data.data.results
  if (Array.isArray(data?.data)) return data.data
  return []
}

const unwrap = (data) => data?.data || data

const tenantOpts = (tenantSlug) => {
  const slug = String(tenantSlug || '').trim()
  if (!slug) throw new Error('Select a tenant first so X-Tenant can be sent.')
  return { xTenant: slug }
}

const requireId = (id, label) => {
  const v = String(id ?? '').trim()
  if (!v) throw new Error(`${label} id is required.`)
  return v
}

const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v != null && v !== 'all'),
  )

const idOf = (value) =>
  value != null && typeof value === 'object' ? String(value.id ?? '') : String(value ?? '')

export const normalizeAttendanceStatus = (row = {}) => ({
  id: String(row.id ?? ''),
  code: String(row.code || '').trim().toUpperCase(),
  label: String(row.label || row.name || '').trim(),
  isActive: row.is_active !== false,
  raw: row,
})

export const normalizeAttendanceRecord = (row = {}) => {
  const statusRaw = row.status
  const statusId =
    idOf(statusRaw) ||
    String(row.status_id || row.attendance_status || '').trim()
  const statusCode = String(
    (statusRaw && typeof statusRaw === 'object' && (statusRaw.code || statusRaw.label)) ||
      row.status_code ||
      row.code ||
      '',
  )
    .trim()
    .toUpperCase()
  const statusLabel = String(
    (statusRaw && typeof statusRaw === 'object' && (statusRaw.label || statusRaw.name)) ||
      row.status_label ||
      row.label ||
      statusCode ||
      '',
  ).trim()
  return {
    id: String(row.id ?? `${row.user || row.user_id || ''}-${row.date || ''}`),
    userId: idOf(row.user ?? row.user_id),
    date: String(row.date || '').slice(0, 10),
    statusId,
    statusCode,
    statusLabel,
    duration: String(row.duration || ''),
    reason: String(row.reason || ''),
    raw: row,
  }
}

/** GET /api/payroll/attendance-status/ */
export const fetchAttendanceStatuses = async (tenantSlug) => {
  const { data } = await api.get(
    'api/payroll/attendance-status/',
    tenantOpts(tenantSlug),
  )
  return asList(data).map(normalizeAttendanceStatus).filter((r) => r.id || r.code)
}

/** POST /api/payroll/attendance-status/ */
export const createAttendanceStatus = async (tenantSlug, form = {}) => {
  const body = {
    code: String(form.code || '').trim().toUpperCase(),
    label: String(form.label || '').trim(),
    is_active: form.isActive !== false && form.is_active !== false,
  }
  const { data } = await api.post(
    'api/payroll/attendance-status/',
    body,
    tenantOpts(tenantSlug),
  )
  return normalizeAttendanceStatus(unwrap(data))
}

/** GET /api/payroll/attendance-status/:id/ */
export const fetchAttendanceStatus = async (tenantSlug, statusId) => {
  const id = requireId(statusId, 'Attendance status')
  const { data } = await api.get(
    `api/payroll/attendance-status/${id}/`,
    tenantOpts(tenantSlug),
  )
  return normalizeAttendanceStatus(unwrap(data))
}

/** PATCH /api/payroll/attendance-status/:id/ */
export const updateAttendanceStatus = async (tenantSlug, statusId, form = {}) => {
  const id = requireId(statusId, 'Attendance status')
  const body = {}
  if (form.label != null) body.label = String(form.label || '').trim()
  if (form.isActive != null || form.is_active != null) {
    body.is_active = form.isActive !== false && form.is_active !== false
  }
  if (form.code != null) body.code = String(form.code || '').trim().toUpperCase()
  const { data } = await api.patch(
    `api/payroll/attendance-status/${id}/`,
    body,
    tenantOpts(tenantSlug),
  )
  return normalizeAttendanceStatus(unwrap(data))
}

/** DELETE /api/payroll/attendance-status/:id/ */
export const deleteAttendanceStatus = async (tenantSlug, statusId) => {
  const id = requireId(statusId, 'Attendance status')
  await api.delete(
    `api/payroll/attendance-status/${id}/`,
    tenantOpts(tenantSlug),
  )
}

/**
 * GET /api/payroll/attendance/
 * Apidog examples use date + user_id; month view also sends date_from/date_to.
 */
export const fetchAttendanceRecords = async (tenantSlug, params = {}) => {
  const { data } = await api.get('api/payroll/attendance/', {
    ...tenantOpts(tenantSlug),
    params: cleanParams({
      user_id: params.userId,
      user: params.userId,
      date: params.date,
      date_from: params.dateFrom,
      date_to: params.dateTo,
      start_date: params.dateFrom,
      end_date: params.dateTo,
      year: params.year,
      month: params.month,
      page: params.page,
      page_size: params.pageSize || 100,
    }),
  })
  const results = asList(data).map(normalizeAttendanceRecord)
  return {
    results,
    count: Number(data?.count) || results.length,
  }
}

/** POST /api/payroll/attendance/ — log or update staff attendance */
export const upsertAttendanceRecord = async (tenantSlug, form = {}) => {
  const body = {
    user: String(form.userId || form.user || '').trim(),
    date: String(form.date || '').slice(0, 10),
    status: String(form.statusId || form.status || '').trim(),
    duration: String(form.duration || '08:00:00').trim() || '08:00:00',
    reason: String(form.reason || '').trim() || 'Attendance marked',
  }
  if (!body.user) throw new Error('Employee is required.')
  if (!body.date) throw new Error('Date is required.')
  if (!body.status) throw new Error('Attendance status is required.')
  const { data } = await api.post(
    'api/payroll/attendance/',
    body,
    tenantOpts(tenantSlug),
  )
  return normalizeAttendanceRecord(unwrap(data))
}
