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

/** Mon=0 … Sun=6 (matches API example weekend [5,6]) */
export const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Monday' },
  { value: 1, label: 'Tuesday' },
  { value: 2, label: 'Wednesday' },
  { value: 3, label: 'Thursday' },
  { value: 4, label: 'Friday' },
  { value: 5, label: 'Saturday' },
  { value: 6, label: 'Sunday' },
]

export const weekdayLabel = (n) => WEEKDAY_OPTIONS.find((d) => d.value === Number(n))?.label || String(n)

const toTime = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw
  if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`
  return raw
}

const fromTimeInput = (value) => String(value || '').slice(0, 5)

export const normalizeShift = (row = {}) => {
  const offs = Array.isArray(row.weekly_off_days)
    ? row.weekly_off_days.map((n) => Number(n)).filter((n) => Number.isFinite(n))
    : []
  return {
    ...row,
    id: String(row.id ?? ''),
    name: String(row.name || row.label || `Shift #${row.id ?? ''}`),
    start_time: row.start_time || '',
    end_time: row.end_time || '',
    start_hhmm: fromTimeInput(row.start_time),
    end_hhmm: fromTimeInput(row.end_time),
    is_overnight: Boolean(row.is_overnight),
    grace_minutes: Number(row.grace_minutes) || 0,
    weekly_off_days: offs,
    weekly_off_label: offs.map(weekdayLabel).join(', ') || '—',
    is_active: row.is_active !== false,
  }
}

export const buildShiftBody = (form = {}) => ({
  name: String(form.name || '').trim(),
  start_time: toTime(form.start_time || form.start_hhmm),
  end_time: toTime(form.end_time || form.end_hhmm),
  is_overnight: Boolean(form.is_overnight),
  grace_minutes: Number(form.grace_minutes) || 0,
  weekly_off_days: (Array.isArray(form.weekly_off_days) ? form.weekly_off_days : [])
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n)),
  is_active: form.is_active !== false,
})

/** GET /api/shifts/ */
export const fetchShifts = async (tenantSlug, { page = 1, pageSize = 100 } = {}) => {
  const { data } = await api.get('api/shifts/', {
    params: { page, page_size: pageSize },
    ...tenantOpts(tenantSlug),
  })
  return asList(data).map(normalizeShift)
}

/** GET /api/shifts/:id/ */
export const fetchShift = async (tenantSlug, shiftId) => {
  const id = requireId(shiftId, 'Shift')
  const { data } = await api.get(`api/shifts/${id}/`, tenantOpts(tenantSlug))
  return normalizeShift(unwrap(data))
}

/** POST /api/shifts/ */
export const createShift = async (tenantSlug, form) => {
  const { data } = await api.post('api/shifts/', buildShiftBody(form), tenantOpts(tenantSlug))
  return normalizeShift(unwrap(data))
}

/** PATCH /api/shifts/:id/ */
export const updateShift = async (tenantSlug, shiftId, form) => {
  const id = requireId(shiftId, 'Shift')
  const { data } = await api.patch(
    `api/shifts/${id}/`,
    buildShiftBody(form),
    tenantOpts(tenantSlug),
  )
  return normalizeShift(unwrap(data))
}

/** DELETE /api/shifts/:id/ */
export const deleteShift = async (tenantSlug, shiftId) => {
  const id = requireId(shiftId, 'Shift')
  await api.delete(`api/shifts/${id}/`, tenantOpts(tenantSlug))
  return { id }
}
