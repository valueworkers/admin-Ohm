import api from './axiosClient'

const asList = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.data?.results)) return data.data.results
  if (Array.isArray(data?.data)) return data.data
  return []
}

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

export const normalizeLocation = (row = {}) => ({
  ...row,
  id: row.id != null ? String(row.id) : '',
  location_type: String(row.location_type || 'OPD'),
  building_name: String(row.building_name || ''),
  address_line1: String(row.address_line1 || ''),
  address_line2: String(row.address_line2 || ''),
  locality: String(row.locality || ''),
  city: String(row.city || ''),
  state: String(row.state || ''),
  postal_code: String(row.postal_code || ''),
})

export const buildLocationBody = (form = {}) => ({
  location_type: String(form.location_type || 'OPD').trim() || 'OPD',
  building_name: String(form.building_name || '').trim(),
  address_line1: String(form.address_line1 || '').trim(),
  address_line2: String(form.address_line2 || '').trim(),
  locality: String(form.locality || '').trim(),
  city: String(form.city || '').trim(),
  state: String(form.state || '').trim(),
  postal_code: String(form.postal_code || '').trim(),
})

/** API package_type: IN_HOUSE | CLIENT_SIDE | OPD */
export const PACKAGE_TYPES = ['IN_HOUSE', 'CLIENT_SIDE', 'OPD']

export const normalizePackage = (row = {}) => {
  const rawType = String(row.package_type || 'IN_HOUSE').toUpperCase()
  const package_type = PACKAGE_TYPES.includes(rawType) ? rawType : rawType || 'IN_HOUSE'
  return {
    ...row,
    id: row.id != null ? String(row.id) : '',
    owner: row.owner != null && typeof row.owner === 'object' ? row.owner.id ?? '' : row.owner ?? '',
    owner_name: String(row.owner_name || row.owner?.full_name || row.owner?.email || ''),
    name: String(row.name || ''),
    description: String(row.description || ''),
    price: money2(row.price),
    registration_fees: money2(row.registration_fees),
    package_type,
    period: String(row.period || 'MONTHLY'),
    is_active: row.is_active !== false,
  }
}

export const buildPackageBody = (form = {}) => {
  const rawType = String(form.package_type || 'IN_HOUSE').toUpperCase()
  return {
    owner: Number(form.owner),
    name: String(form.name || '').trim(),
    description: String(form.description || '').trim(),
    price: money2(form.price),
    registration_fees: money2(form.registration_fees),
    package_type: PACKAGE_TYPES.includes(rawType) ? rawType : 'IN_HOUSE',
    period: String(form.period || 'MONTHLY'),
    is_active: Boolean(form.is_active),
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
  return normalizeLocation(data?.data || data)
}

/** PATCH /api/billing/locations/:id/ — full create-shaped body */
export const updateLocation = async (tenantSlug, locationId, form) => {
  const id = requireId(locationId, 'Location')
  const { data } = await api.patch(
    `api/billing/locations/${id}/`,
    buildLocationBody(form),
    tenantOpts(tenantSlug),
  )
  return normalizeLocation(data?.data || data)
}

/** DELETE /api/billing/locations/:id/ */
export const deleteLocation = async (tenantSlug, locationId) => {
  const id = requireId(locationId, 'Location')
  await api.delete(`api/billing/locations/${id}/`, tenantOpts(tenantSlug))
  return { id }
}

/** GET /api/billing/packages/ */
export const fetchPackages = async (tenantSlug, { page = 1, pageSize = 100 } = {}) => {
  const { data } = await api.get('api/billing/packages/', {
    params: { page, page_size: pageSize },
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
  return normalizePackage(data?.data || data)
}

/** PATCH /api/billing/packages/:id/ — full create-shaped body */
export const updatePackage = async (tenantSlug, packageId, form) => {
  const id = requireId(packageId, 'Package')
  const { data } = await api.patch(
    `api/billing/packages/${id}/`,
    buildPackageBody(form),
    tenantOpts(tenantSlug),
  )
  return normalizePackage(data?.data || data)
}

/** DELETE /api/billing/packages/:id/ */
export const deletePackage = async (tenantSlug, packageId) => {
  const id = requireId(packageId, 'Package')
  await api.delete(`api/billing/packages/${id}/`, tenantOpts(tenantSlug))
  return { id }
}
