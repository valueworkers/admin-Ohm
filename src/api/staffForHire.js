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

const asStringList = (value) => {
  if (Array.isArray(value)) return value.map((x) => String(x || '').trim()).filter(Boolean)
  const text = String(value ?? '').trim()
  if (!text) return []
  return text
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

export const AVAILABLE_FOR_OPTIONS = ['Day Shift', 'Night Shift', 'Full Time', 'Part Time']
export const LANGUAGE_SUGGESTIONS = ['English', 'Hindi', 'Kannada', 'Marathi', 'Tamil', 'Telugu']
export const SKILL_SUGGESTIONS = [
  'General Ward Nursing',
  'ICU Ward Nursing',
  'Geriatric Care',
  'Home Care',
]

export const normalizeStaffForHire = (row = {}) => {
  const availableFor = asStringList(row.available_for)
  const language = asStringList(row.language)
  const skill = asStringList(row.skill)
  return {
    id: String(row.id ?? ''),
    staffName: String(row.staff_name || ''),
    email: String(row.email || ''),
    mobileNumber: String(row.mobile_number || ''),
    vendorName: String(row.vendor_name || ''),
    availableFrom: String(row.available_from || '').slice(0, 10),
    availableFor,
    language,
    skill,
    price: row.price ?? '',
    isActive: row.is_active !== false,
    isAvailable: row.is_available !== false,
    raw: row,
  }
}

export const buildStaffForHireBody = (form = {}) => {
  const priceNum = Number(form.price)
  return {
    staff_name: String(form.staffName || form.staff_name || '').trim(),
    email: String(form.email || '').trim(),
    mobile_number: String(form.mobileNumber || form.mobile_number || '').trim(),
    vendor_name: String(form.vendorName || form.vendor_name || '').trim(),
    available_from: String(form.availableFrom || form.available_from || '').trim(),
    available_for: asStringList(form.availableFor || form.available_for),
    language: asStringList(form.language),
    skill: asStringList(form.skill),
    price: Number.isFinite(priceNum) ? priceNum.toFixed(2) : String(form.price || '').trim(),
    is_active: form.isActive !== false && form.is_active !== false,
    is_available: form.isAvailable !== false && form.is_available !== false,
  }
}

export const fetchStaffForHire = async (tenantSlug, params = {}) => {
  const { data } = await api.get('api/staff-for-hire/', {
    ...tenantOpts(tenantSlug),
    params: cleanParams({
      page: params.page || 1,
      page_size: params.pageSize || 20,
      search: params.search,
      available_for: params.availableFor,
      ordering: params.ordering || '-created_at',
    }),
  })
  const results = asList(data).map(normalizeStaffForHire).filter((r) => r.id)
  return {
    results,
    count: data?.count ?? results.length,
    next: data?.next || null,
    previous: data?.previous || null,
    page: data?.current_page ?? params.page ?? 1,
    totalPages: data?.total_pages ?? null,
  }
}

export const fetchStaffForHireDetail = async (tenantSlug, id) => {
  const listingId = requireId(id, 'Staff for hire')
  const { data } = await api.get(
    `api/staff-for-hire/${listingId}/`,
    tenantOpts(tenantSlug),
  )
  return normalizeStaffForHire(unwrap(data))
}

export const createStaffForHire = async (tenantSlug, form) => {
  const { data } = await api.post(
    'api/staff-for-hire/',
    buildStaffForHireBody(form),
    tenantOpts(tenantSlug),
  )
  return normalizeStaffForHire(unwrap(data))
}

export const updateStaffForHire = async (tenantSlug, id, form) => {
  const listingId = requireId(id, 'Staff for hire')
  const body =
    form && typeof form === 'object' && Object.keys(form).length === 1 && 'is_available' in form
      ? { is_available: Boolean(form.is_available) }
      : buildStaffForHireBody(form)
  const { data } = await api.patch(
    `api/staff-for-hire/${listingId}/`,
    body,
    tenantOpts(tenantSlug),
  )
  return normalizeStaffForHire(unwrap(data))
}

export const deleteStaffForHire = async (tenantSlug, id) => {
  const listingId = requireId(id, 'Staff for hire')
  await api.delete(`api/staff-for-hire/${listingId}/`, tenantOpts(tenantSlug))
}
