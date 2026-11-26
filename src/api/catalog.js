import api from './axiosClient'

const asList = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.data?.results)) return data.data.results
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.venues)) return data.venues
  if (Array.isArray(data?.services)) return data.services
  return []
}

const money2 = (value, fallback = 0) => {
  const n = Number(value)
  return (Number.isFinite(n) ? n : fallback).toFixed(2)
}

const num = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const tenantOpts = (tenantSlug) => {
  const slug = String(tenantSlug || '').trim()
  if (!slug) throw new Error('Select a tenant first so X-Tenant can be sent.')
  return { xTenant: slug }
}

const parseList = (value) => {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean)
  return String(value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

/** Normalize venue API row → UI shape. */
export const normalizeVenue = (row = {}) => {
  const parking =
    row.parking_slots && typeof row.parking_slots === 'object' ? row.parking_slots : {}
  const social =
    row.social_links && typeof row.social_links === 'object' ? row.social_links : {}
  const loc = row.location && typeof row.location === 'object' ? row.location : {}
  const photos = (Array.isArray(row.photos) ? row.photos : []).map(normalizeCatalogPhoto)
  const primaryPhoto = photos.find((p) => p.isPrimary) || photos[0] || null
  const rest = { ...row }
  delete rest.owner
  delete rest.location
  return {
    ...rest,
    photos,
    photo_url: primaryPhoto?.url || '',
    created_at: row.created_at || '',
    updated_at: row.updated_at || '',
    id: row.id != null ? String(row.id) : '',
    name: String(row.name || ''),
    description: String(row.description || ''),
    contact: String(row.contact || ''),
    website: String(row.website || ''),
    instagram: String(social.instagram || row.instagram || ''),
    capacity: num(row.capacity, 0),
    price_per_event: money2(row.price_per_event ?? row.pricePerEvent, 0),
    rooms: num(row.rooms, 0),
    floors: num(row.floors, 0),
    bike_parking: num(parking.two_wheeler ?? row.bike_parking, 0),
    car_parking: num(parking.four_wheeler ?? row.car_parking, 0),
    amenities: Array.isArray(row.amenities) ? row.amenities : parseList(row.amenities),
    seating_arrangement: Array.isArray(row.seating_arrangement)
      ? row.seating_arrangement
      : parseList(row.seating_arrangement),
    location_id: loc.id != null ? String(loc.id) : '',
    location_type: String(loc.location_type || row.location_type || 'OPD'),
    building_name: String(loc.building_name || row.building_name || ''),
    address_line1: String(loc.address_line1 || row.address_line1 || ''),
    address_line2: String(loc.address_line2 || row.address_line2 || ''),
    locality: String(loc.locality || row.locality || row.area || ''),
    city: String(loc.city || row.city || ''),
    state: String(loc.state || row.state || ''),
    postal_code: String(loc.postal_code || row.postal_code || ''),
    is_active: row.is_active !== false && row.active !== false,
    active: row.is_active !== false && row.active !== false,
    status: row.is_active === false || row.active === false ? 'inactive' : 'active',
  }
}

export const buildVenueBody = (form = {}) => ({
  name: String(form.name || '').trim(),
  description: String(form.description || form.name || '').trim(),
  contact: String(form.contact || '').trim(),
  website: String(form.website || '').trim(),
  social_links: {
    instagram: String(form.instagram || form.social_links?.instagram || '').trim(),
  },
  capacity: Math.max(0, num(form.capacity, 0)),
  price_per_event: money2(form.price_per_event ?? form.pricePerEvent, 0),
  rooms: Math.max(0, num(form.rooms, 0)),
  floors: Math.max(0, num(form.floors, 0)),
  parking_slots: {
    two_wheeler: Math.max(0, num(form.bike_parking ?? form.parking_slots?.two_wheeler, 0)),
    four_wheeler: Math.max(0, num(form.car_parking ?? form.parking_slots?.four_wheeler, 0)),
  },
  amenities: parseList(form.amenities),
  seating_arrangement: parseList(form.seating_arrangement ?? form.seatingArrangement),
  location_type: String(form.location_type || form.locationType || 'OPD').trim() || 'OPD',
  building_name: String(form.building_name || '').trim(),
  address_line1: String(form.address_line1 || '').trim(),
  address_line2: String(form.address_line2 || '').trim(),
  locality: String(form.locality || form.area || '').trim(),
  city: String(form.city || '').trim(),
  state: String(form.state || '').trim(),
  postal_code: String(form.postal_code || '').trim(),
})

/** Normalize service API row → UI shape. */
export const normalizeService = (row = {}) => {
  const venueRaw = row.venue ?? row.venues ?? row.venue_ids ?? []
  const venueIds = Array.isArray(venueRaw)
    ? venueRaw.map((v) => (typeof v === 'object' ? String(v.id ?? '') : String(v))).filter(Boolean)
    : []
  const quick =
    row.quick_info && typeof row.quick_info === 'object' ? row.quick_info : {}
  return {
    ...row,
    id: row.id != null ? String(row.id) : '',
    name: String(row.name || ''),
    service_type: String(row.service_type || ''),
    description: String(row.description || ''),
    address: String(row.address || ''),
    city: String(row.city || ''),
    contact: String(row.contact || ''),
    website: String(row.website || ''),
    venue_ids: venueIds,
    tags: Array.isArray(row.tags) ? row.tags : parseList(row.tags),
    duration_mins: num(quick.duration_mins ?? row.duration_mins, 45),
    is_active: row.is_active !== false && row.active !== false,
    active: row.is_active !== false && row.active !== false,
    show_to_tenant: row.show_to_tenant !== false,
  }
}

export const buildServiceBody = (form = {}) => {
  const venueIds = Array.isArray(form.venue_ids || form.venue)
    ? (form.venue_ids || form.venue)
        .map((v) => (typeof v === 'object' ? v.id : v))
        .filter((v) => v != null && String(v).trim())
        .map(String)
    : []
  return {
    name: String(form.name || '').trim(),
    service_type: String(form.service_type || 'OPD').trim() || 'OPD',
    description: String(form.description || form.name || '').trim(),
    address: String(form.address || '').trim(),
    city: String(form.city || '').trim(),
    contact: String(form.contact || '').trim(),
    website: String(form.website || '').trim(),
    venue: venueIds,
    tags: parseList(form.tags),
    quick_info: {
      duration_mins: Math.max(1, num(form.duration_mins ?? form.quick_info?.duration_mins, 45)),
    },
  }
}

/** GET /api/catalog/venues/ */
export const fetchVenues = async (tenantSlug, { page = 1, pageSize = 100, search } = {}) => {
  const params = { page, page_size: pageSize }
  if (search) params.search = search
  const { data } = await api.get('api/catalog/venues/', {
    params,
    ...tenantOpts(tenantSlug),
  })
  return asList(data).map(normalizeVenue)
}

/** POST /api/catalog/venues/ */
export const createVenue = async (tenantSlug, form) => {
  const { data } = await api.post('api/catalog/venues/', buildVenueBody(form), tenantOpts(tenantSlug))
  const row = data?.data || data?.venue || data
  return normalizeVenue(row)
}

/** PATCH /api/catalog/venues/:id/ — full create-shaped body */
export const updateVenue = async (tenantSlug, venueId, form) => {
  const id = String(venueId || '').trim()
  if (!id) throw new Error('Venue id is required.')
  const { data } = await api.patch(
    `api/catalog/venues/${id}/`,
    buildVenueBody(form),
    tenantOpts(tenantSlug),
  )
  const row = data?.data || data?.venue || data
  return normalizeVenue(row)
}

/** DELETE /api/catalog/venues/:id/ */
export const deleteVenue = async (tenantSlug, venueId) => {
  const id = String(venueId || '').trim()
  if (!id) throw new Error('Venue id is required.')
  await api.delete(`api/catalog/venues/${id}/`, tenantOpts(tenantSlug))
  return { id }
}

/** GET /api/catalog/services/dropdown/?service_type= */
export const fetchServicesDropdown = async (tenantSlug, { serviceType } = {}) => {
  const params = {}
  const type = String(serviceType || '').trim()
  if (type) params.service_type = type
  const { data } = await api.get('api/catalog/services/dropdown/', {
    params,
    ...tenantOpts(tenantSlug),
  })
  return asList(data)
    .map((row) =>
      normalizeService({
        ...row,
        id: row.id ?? row.value ?? row.service_id,
        name: row.name || row.label || row.title || '',
      }),
    )
    .filter((s) => s.id)
}

/** GET /api/catalog/services/ */
export const fetchServices = async (
  tenantSlug,
  { page = 1, pageSize = 100, search, venue } = {},
) => {
  const params = { page, page_size: pageSize }
  if (search) params.search = search
  if (venue) params.venue = venue
  const { data } = await api.get('api/catalog/services/', {
    params,
    ...tenantOpts(tenantSlug),
  })
  return asList(data).map(normalizeService)
}

/** POST /api/catalog/services/ */
export const createService = async (tenantSlug, form) => {
  const { data } = await api.post(
    'api/catalog/services/',
    buildServiceBody(form),
    tenantOpts(tenantSlug),
  )
  const row = data?.data || data?.service || data
  return normalizeService(row)
}

/** PATCH /api/catalog/services/:id/ — full create-shaped body */
export const updateService = async (tenantSlug, serviceId, form) => {
  const id = String(serviceId || '').trim()
  if (!id) throw new Error('Service id is required.')
  const { data } = await api.patch(
    `api/catalog/services/${id}/`,
    buildServiceBody(form),
    tenantOpts(tenantSlug),
  )
  const row = data?.data || data?.service || data
  return normalizeService(row)
}

/** DELETE /api/catalog/services/:id/ */
export const deleteService = async (tenantSlug, serviceId) => {
  const id = String(serviceId || '').trim()
  if (!id) throw new Error('Service id is required.')
  await api.delete(`api/catalog/services/${id}/`, tenantOpts(tenantSlug))
  return { id }
}

export const normalizeCatalogPhoto = (row = {}) => ({
  id: String(row.id ?? row.photoId ?? row.photo_id ?? ''),
  url: String(row.image || row.url || row.image_url || row.file || ''),
  isPrimary: Boolean(row.is_primary ?? row.isPrimary),
  entityType: String(row.entity_type || row.entityType || ''),
  objectId: String(row.object_id ?? row.objectId ?? ''),
  raw: row,
})

/** POST /api/catalog/photos/upload/ — multipart form-data */
export const uploadCatalogPhoto = async (
  tenantSlug,
  { entityType, objectId, image, isPrimary = true },
) => {
  const type = String(entityType || '').trim().toLowerCase()
  const oid = String(objectId || '').trim()
  if (!type) throw new Error('entity_type is required.')
  if (!oid) throw new Error('object_id is required.')
  if (!image) throw new Error('image file is required.')

  const body = new FormData()
  body.append('entity_type', type)
  body.append('object_id', oid)
  body.append('image', image)
  body.append('is_primary', isPrimary ? 'true' : 'false')

  const { data } = await api.post('api/catalog/photos/upload/', body, tenantOpts(tenantSlug))
  const row = data?.data || data?.photo || data
  return normalizeCatalogPhoto(row)
}

/** PATCH /api/catalog/photos/:id/set-primary/ */
export const setCatalogPhotoPrimary = async (tenantSlug, photoId) => {
  const id = String(photoId || '').trim()
  if (!id) throw new Error('Photo id is required.')
  const { data } = await api.patch(
    `api/catalog/photos/${id}/set-primary/`,
    {},
    tenantOpts(tenantSlug),
  )
  const row = data?.data || data?.photo || data
  return normalizeCatalogPhoto(row)
}

/** DELETE /api/catalog/photos/:id/ */
export const deleteCatalogPhoto = async (tenantSlug, photoId) => {
  const id = String(photoId || '').trim()
  if (!id) throw new Error('Photo id is required.')
  await api.delete(`api/catalog/photos/${id}/`, tenantOpts(tenantSlug))
  return { id }
}

export const normalizeCatalogResource = (row = {}) => ({
  id: String(row.id ?? row.value ?? ''),
  name: String(row.name || row.label || row.title || '').trim(),
  label: String(row.label || row.name || row.title || '').trim(),
  raw: row,
})

/** GET /api/catalog/resources/dropdown/ */
export const fetchResourcesDropdown = async (tenantSlug) => {
  const { data } = await api.get(
    'api/catalog/resources/dropdown/',
    tenantOpts(tenantSlug),
  )
  return asList(data).map(normalizeCatalogResource).filter((r) => r.id)
}

/** GET /api/catalog/resources/ */
export const fetchCatalogResources = async (
  tenantSlug,
  { page = 1, pageSize = 100, search } = {},
) => {
  const params = { page, page_size: pageSize }
  if (search) params.search = search
  const { data } = await api.get('api/catalog/resources/', {
    params,
    ...tenantOpts(tenantSlug),
  })
  const results = asList(data).map(normalizeCatalogResource).filter((r) => r.id)
  return { count: Number(data?.count) || results.length, results }
}
