import api from './axiosClient'

const asList = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.data?.results)) return data.data.results
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.bookings)) return data.bookings
  return []
}

const num = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const tenantIdOf = (row = {}) => {
  if (row.tenant == null) return row.tenant_id != null ? String(row.tenant_id) : ''
  if (typeof row.tenant === 'object') {
    return String(row.tenant.id ?? row.tenant.pk ?? row.tenant.uuid ?? '')
  }
  return String(row.tenant)
}

const tenantNameOf = (row = {}) => {
  if (row.tenant && typeof row.tenant === 'object') {
    return String(row.tenant.name || row.tenant.organization_name || '')
  }
  return String(row.tenant_name || row.organization_name || '')
}

const planIdOf = (row = {}) => {
  if (row.plan == null) return row.plan_id != null ? String(row.plan_id) : ''
  if (typeof row.plan === 'object') {
    return String(row.plan.id ?? row.plan.pk ?? '')
  }
  return String(row.plan)
}

/** Shared POST / PATCH body — same fields as create payload. */
export const buildBookingBody = (payload = {}) => ({
  tenant: String(payload.tenant || '').trim(),
  title: String(payload.title || '').trim(),
  booking_type: String(payload.bookingType || payload.booking_type || '').trim(),
  status: String(payload.status || 'confirmed').trim(),
  start_datetime: String(payload.startDatetime || payload.start_datetime || '').trim(),
  end_datetime: String(payload.endDatetime || payload.end_datetime || '').trim(),
  location: String(payload.location || '').trim(),
  total_amount: String(
    payload.totalAmount != null && payload.totalAmount !== ''
      ? payload.totalAmount
      : payload.total_amount || '0',
  ),
  notes: String(payload.notes || '').trim(),
})

/** Map platform booking API row → UI shape. No X-Tenant (Root / Super Admin). */
export const normalizePlatformBooking = (row = {}) => {
  const id = String(row.id ?? row.platformBookingId ?? row.platform_booking_id ?? '')
  return {
    id,
    platformBookingId: id,
    bookingCode: String(row.booking_id || row.bookingId || ''),
    tenantId: tenantIdOf(row),
    tenantName: tenantNameOf(row),
    planId: planIdOf(row),
    planName: String(
      row.plan_name ||
        (row.plan && typeof row.plan === 'object' ? row.plan.name || '' : '') ||
        '',
    ),
    title: String(row.title || ''),
    bookingType: String(row.booking_type || row.bookingType || ''),
    status: String(row.status || ''),
    startDatetime: row.start_datetime || row.startDatetime || '',
    endDatetime: row.end_datetime || row.endDatetime || '',
    location: String(row.location || ''),
    totalAmount: num(row.total_amount ?? row.totalAmount),
    notes: String(row.notes || ''),
    invoiceId: row.invoice_id ?? row.invoiceId ?? null,
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
    raw: row,
  }
}

/** GET /api/platform/bookings/ */
export const fetchPlatformBookings = async ({
  tenant,
  status,
  page = 1,
  pageSize = 20,
} = {}) => {
  const params = {
    page,
    page_size: pageSize,
  }
  if (tenant) params.tenant = tenant
  if (status) params.status = status

  const { data } = await api.get('api/platform/bookings/', { params })
  const rows = asList(data).map(normalizePlatformBooking)
  return {
    count: Number(data?.count) || rows.length,
    next: data?.next ?? null,
    previous: data?.previous ?? null,
    results: rows,
  }
}

/** GET /api/platform/bookings/:id/ */
export const fetchPlatformBookingById = async (bookingId) => {
  const id = String(bookingId || '').trim()
  if (!id) throw new Error('Booking id is required.')
  const { data } = await api.get(`api/platform/bookings/${id}/`)
  const row = data?.data || data?.booking || data
  return normalizePlatformBooking(row)
}

/** POST /api/platform/bookings/ */
export const createPlatformBooking = async (payload) => {
  const { data } = await api.post('api/platform/bookings/', buildBookingBody(payload))
  const row = data?.data || data?.booking || data
  return normalizePlatformBooking(row)
}

/** PATCH /api/platform/bookings/:id/ — same fields as POST payload */
export const updatePlatformBooking = async (bookingId, payload) => {
  const id = String(bookingId || '').trim()
  if (!id) throw new Error('Booking id is required.')
  const { data } = await api.patch(`api/platform/bookings/${id}/`, buildBookingBody(payload))
  const row = data?.data || data?.booking || data
  return normalizePlatformBooking(row)
}

/** DELETE /api/platform/bookings/:id/ */
export const deletePlatformBooking = async (bookingId) => {
  const id = String(bookingId || '').trim()
  if (!id) throw new Error('Booking id is required.')
  const { data } = await api.delete(`api/platform/bookings/${id}/`)
  return data?.data || data
}

/** POST /api/platform/bookings/:id/convert-to-invoice/ */
export const convertPlatformBookingToInvoice = async (bookingId) => {
  const id = String(bookingId || '').trim()
  if (!id) throw new Error('Booking id is required.')
  const { data } = await api.post(`api/platform/bookings/${id}/convert-to-invoice/`)
  return data?.data || data
}
