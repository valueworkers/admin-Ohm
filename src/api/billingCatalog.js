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

const money2 = (value) => {
  const n = Number(value)
  return (Number.isFinite(n) ? n : 0).toFixed(2)
}

const idOf = (value) =>
  value != null && typeof value === 'object' ? String(value.id ?? '') : String(value ?? '')

const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v != null && v !== 'all'),
  )

const addressFromRow = (row = {}) => {
  const addr =
    row.address && typeof row.address === 'object' ? row.address : {}
  return {
    line1: String(addr.line1 || row.address_line1 || '').trim(),
    line2: String(addr.line2 || row.address_line2 || '').trim(),
    locality: String(addr.locality || row.locality || '').trim(),
    city: String(addr.city || row.city || '').trim(),
    state: String(addr.state || row.state || '').trim(),
    pincode: String(addr.pincode || row.postal_code || row.pincode || '').trim(),
  }
}

/** Billing location — /api/billing/locations/ */
export const normalizeLocation = (row = {}) => {
  const address = addressFromRow(row)
  return {
    ...row,
    id: row.id != null ? String(row.id) : '',
    name: String(row.name || row.building_name || '').trim(),
    phone: String(row.phone || '').trim(),
    email: String(row.email || '').trim(),
    address,
    // Flat aliases for table/forms
    building_name: String(row.name || row.building_name || '').trim(),
    address_line1: address.line1,
    address_line2: address.line2,
    locality: address.locality,
    city: address.city,
    state: address.state,
    postal_code: address.pincode,
  }
}

export const buildLocationBody = (form = {}) => ({
  name: String(form.name || form.building_name || '').trim(),
  phone: String(form.phone || '').trim(),
  email: String(form.email || '').trim(),
  address: {
    line1: String(form.address?.line1 || form.address_line1 || '').trim(),
    line2: String(form.address?.line2 || form.address_line2 || '').trim(),
    locality: String(form.address?.locality || form.locality || '').trim(),
    city: String(form.address?.city || form.city || '').trim(),
    state: String(form.address?.state || form.state || '').trim(),
    pincode: String(
      form.address?.pincode || form.postal_code || form.pincode || '',
    ).trim(),
  },
})

/** API package_type: IN_HOUSE | CLIENT_SIDE | OPD */
export const PACKAGE_TYPES = ['IN_HOUSE', 'CLIENT_SIDE', 'OPD']

/** Billing package — /api/billing/packages/ (resource target) */
export const normalizePackage = (row = {}) => {
  const rawType = String(row.package_type || 'IN_HOUSE').toUpperCase()
  const package_type = PACKAGE_TYPES.includes(rawType) ? rawType : rawType || 'IN_HOUSE'
  const resourceRaw = row.resource
  const resourceId = idOf(resourceRaw)
  const resourceName =
    String(row.resource_name || '').trim() ||
    (resourceRaw && typeof resourceRaw === 'object'
      ? String(resourceRaw.name || resourceRaw.label || '').trim()
      : '')
  return {
    ...row,
    id: row.id != null ? String(row.id) : '',
    name: String(row.name || ''),
    description: String(row.description || ''),
    price: money2(row.price),
    package_type,
    period: String(row.period || 'MONTHLY'),
    resource: resourceId,
    resource_name: resourceName,
    is_active: row.is_active !== false && row.is_deleted !== true,
  }
}

export const buildPackageBody = (form = {}) => {
  const rawType = String(form.package_type || 'IN_HOUSE').toUpperCase()
  return {
    name: String(form.name || '').trim(),
    package_type: PACKAGE_TYPES.includes(rawType) ? rawType : 'IN_HOUSE',
    period: String(form.period || 'MONTHLY'),
    price: money2(form.price),
    resource: String(form.resource || form.resourceId || '').trim(),
    description: String(form.description || '').trim(),
  }
}

/** GET /api/billing/locations/ */
export const fetchLocations = async (tenantSlug, { page = 1, pageSize = 100 } = {}) => {
  const { data } = await api.get('api/billing/locations/', {
    params: { page, page_size: pageSize },
    ...tenantOpts(tenantSlug),
  })
  return asList(data).map(normalizeLocation)
}

/** POST /api/billing/locations/ */
export const createLocation = async (tenantSlug, form) => {
  const { data } = await api.post(
    'api/billing/locations/',
    buildLocationBody(form),
    tenantOpts(tenantSlug),
  )
  return normalizeLocation(unwrap(data))
}

/** GET /api/billing/locations/:id/ */
export const fetchLocation = async (tenantSlug, locationId) => {
  const id = requireId(locationId, 'Location')
  const { data } = await api.get(`api/billing/locations/${id}/`, tenantOpts(tenantSlug))
  return normalizeLocation(unwrap(data))
}

/** PATCH /api/billing/locations/:id/ */
export const updateLocation = async (tenantSlug, locationId, form) => {
  const id = requireId(locationId, 'Location')
  const { data } = await api.patch(
    `api/billing/locations/${id}/`,
    buildLocationBody(form),
    tenantOpts(tenantSlug),
  )
  return normalizeLocation(unwrap(data))
}

/** PUT /api/billing/locations/:id/ */
export const replaceLocation = async (tenantSlug, locationId, form) => {
  const id = requireId(locationId, 'Location')
  const { data } = await api.put(
    `api/billing/locations/${id}/`,
    buildLocationBody(form),
    tenantOpts(tenantSlug),
  )
  return normalizeLocation(unwrap(data))
}

/** DELETE /api/billing/locations/:id/ */
export const deleteLocation = async (tenantSlug, locationId) => {
  const id = requireId(locationId, 'Location')
  await api.delete(`api/billing/locations/${id}/`, tenantOpts(tenantSlug))
  return { id }
}

/** GET /api/billing/packages/ */
export const fetchPackages = async (
  tenantSlug,
  { page = 1, pageSize = 100, packageType, period } = {},
) => {
  const { data } = await api.get('api/billing/packages/', {
    params: cleanParams({
      page,
      page_size: pageSize,
      package_type: packageType,
      period,
    }),
    ...tenantOpts(tenantSlug),
  })
  return asList(data).map(normalizePackage)
}

/** POST /api/billing/packages/ */
export const createPackage = async (tenantSlug, form) => {
  const { data } = await api.post(
    'api/billing/packages/',
    buildPackageBody(form),
    tenantOpts(tenantSlug),
  )
  return normalizePackage(unwrap(data))
}

/** GET /api/billing/packages/:id/ */
export const fetchPackage = async (tenantSlug, packageId) => {
  const id = requireId(packageId, 'Package')
  const { data } = await api.get(`api/billing/packages/${id}/`, tenantOpts(tenantSlug))
  return normalizePackage(unwrap(data))
}

/** PATCH /api/billing/packages/:id/ */
export const updatePackage = async (tenantSlug, packageId, form) => {
  const id = requireId(packageId, 'Package')
  const { data } = await api.patch(
    `api/billing/packages/${id}/`,
    buildPackageBody(form),
    tenantOpts(tenantSlug),
  )
  return normalizePackage(unwrap(data))
}

/** PUT /api/billing/packages/:id/ */
export const replacePackage = async (tenantSlug, packageId, form) => {
  const id = requireId(packageId, 'Package')
  const { data } = await api.put(
    `api/billing/packages/${id}/`,
    buildPackageBody(form),
    tenantOpts(tenantSlug),
  )
  return normalizePackage(unwrap(data))
}

/** DELETE /api/billing/packages/:id/ */
export const deletePackage = async (tenantSlug, packageId) => {
  const id = requireId(packageId, 'Package')
  await api.delete(`api/billing/packages/${id}/`, tenantOpts(tenantSlug))
  return { id }
}
