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

const str = (v) => String(v ?? '').trim()

const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v != null && v !== 'all'),
  )

export const customerFullName = (row = {}) =>
  [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ').trim() ||
  row.full_name ||
  row.name ||
  row.email ||
  '—'

export const normalizeCustomer = (row = {}) => ({
  ...row,
  id: String(row.id ?? ''),
  email: str(row.email),
  first_name: str(row.first_name),
  middle_name: str(row.middle_name),
  last_name: str(row.last_name),
  mobile_number: str(row.mobile_number || row.phone),
  city: str(row.city),
  is_active: row.is_active !== false,
  is_deleted: Boolean(row.is_deleted),
  date_joined: row.date_joined || '',
  profile_pic: row.profile_pic || null,
})

/** POST /api/customers/ body */
export const buildCreateCustomerBody = (form = {}) => ({
  email: str(form.email),
  password: String(form.password || ''),
  confirm_password: String(form.confirm_password || ''),
  first_name: str(form.first_name),
  middle_name: str(form.middle_name),
  last_name: str(form.last_name),
  mobile_number: str(form.mobile_number),
  city: str(form.city),
})

/** PATCH /api/customers/:id/ body */
export const buildUpdateCustomerBody = (form = {}) => ({
  first_name: str(form.first_name),
  middle_name: str(form.middle_name),
  last_name: str(form.last_name),
  mobile_number: str(form.mobile_number),
  city: str(form.city),
})

/** GET /api/customers/ */
export const fetchCustomers = async (
  tenantSlug,
  { page = 1, pageSize = 20, search, ordering = 'first_name' } = {},
) => {
  const { data } = await api.get('api/customers/', {
    params: cleanParams({ page, page_size: pageSize, search, ordering }),
    ...tenantOpts(tenantSlug),
  })
  const results = asList(data).map(normalizeCustomer)
  return {
    count: Number(data?.count) || results.length,
    results,
    next: data?.next || null,
    previous: data?.previous || null,
  }
}

/** GET /api/customers/:id/ */
export const fetchCustomer = async (tenantSlug, userId) => {
  const id = requireId(userId, 'Customer')
  const { data } = await api.get(`api/customers/${id}/`, tenantOpts(tenantSlug))
  return normalizeCustomer(unwrap(data))
}

/** POST /api/customers/ */
export const createCustomer = async (tenantSlug, form) => {
  const { data } = await api.post(
    'api/customers/',
    buildCreateCustomerBody(form),
    tenantOpts(tenantSlug),
  )
  return normalizeCustomer(unwrap(data))
}

/** PATCH /api/customers/:id/ */
export const updateCustomer = async (tenantSlug, userId, form) => {
  const id = requireId(userId, 'Customer')
  const { data } = await api.patch(
    `api/customers/${id}/`,
    buildUpdateCustomerBody(form),
    tenantOpts(tenantSlug),
  )
  return normalizeCustomer(unwrap(data))
}

/** DELETE /api/customers/:id/ */
export const deleteCustomer = async (tenantSlug, userId) => {
  const id = requireId(userId, 'Customer')
  await api.delete(`api/customers/${id}/`, tenantOpts(tenantSlug))
  return { id }
}
