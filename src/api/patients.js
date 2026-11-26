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

export const GENDERS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
]

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

export const patientFullName = (row = {}) =>
  [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
  row.full_name ||
  row.name ||
  row.email ||
  (row.id ? `Patient #${row.id}` : '—')

const addressFromRow = (row = {}) => {
  const addr = row.address && typeof row.address === 'object' ? row.address : {}
  return {
    line1: str(addr.line1 || row.address_line1),
    line2: str(addr.line2 || row.address_line2),
    locality: str(addr.locality || row.locality),
    city: str(addr.city || row.city),
    state: str(addr.state || row.state),
    pincode: str(addr.pincode || row.pincode || row.postal_code),
  }
}

/** Care patient — /api/care/patients/ */
export const normalizePatient = (row = {}) => {
  const address = addressFromRow(row)
  const first = str(row.first_name)
  const last = str(row.last_name)
  return {
    ...row,
    id: String(row.id ?? ''),
    patient_id: str(row.patient_id || row.id),
    first_name: first,
    last_name: last,
    full_name: [first, last].filter(Boolean).join(' ').trim(),
    email: str(row.email),
    phone: str(row.phone || row.mobile_number),
    dob: str(row.dob).slice(0, 10),
    gender: str(row.gender).toUpperCase(),
    blood_group: str(row.blood_group),
    address,
    address_line1: address.line1,
    address_line2: address.line2,
    locality: address.locality,
    city: address.city,
    state: address.state,
    postal_code: address.pincode,
    medical_history: str(row.medical_history || row.medical_conditions),
    allergies: str(row.allergies),
    emergency_contact_name: str(row.emergency_contact_name || row.emergency_contact),
    emergency_contact_phone: str(row.emergency_contact_phone || row.emergency_phone),
    emergency_contact_relation: str(row.emergency_contact_relation),
    is_deleted: Boolean(row.is_deleted),
    is_active: row.is_active !== false && row.status !== false,
    name: patientFullName({ first_name: first, last_name: last, email: row.email, id: row.id }),
  }
}

export const buildPatientBody = (form = {}) => ({
  first_name: str(form.first_name),
  last_name: str(form.last_name),
  phone: str(form.phone || form.mobile_number),
  email: str(form.email),
  dob: str(form.dob).slice(0, 10),
  gender: str(form.gender || 'MALE').toUpperCase(),
  blood_group: str(form.blood_group || 'O+'),
  address: {
    line1: str(form.address?.line1 || form.address_line1 || form.address),
    line2: str(form.address?.line2 || form.address_line2),
    locality: str(form.address?.locality || form.locality),
    city: str(form.address?.city || form.city),
    state: str(form.address?.state || form.state),
    pincode: str(form.address?.pincode || form.postal_code || form.pincode),
  },
  medical_history: str(form.medical_history || form.medical_conditions),
  allergies: str(form.allergies),
  emergency_contact_name: str(
    form.emergency_contact_name || form.emergency_contact,
  ),
  emergency_contact_phone: str(
    form.emergency_contact_phone || form.emergency_phone,
  ),
  emergency_contact_relation: str(form.emergency_contact_relation || 'Family'),
})

/** GET /api/care/patients/ */
export const fetchPatients = async (
  tenantSlug,
  { page = 1, pageSize = 100, search, status, isActive, ordering } = {},
) => {
  const { data } = await api.get('api/care/patients/', {
    params: cleanParams({
      page,
      page_size: pageSize,
      search,
      status: status ?? (isActive === true || isActive === 'true' ? 'true' : isActive === false || isActive === 'false' ? 'false' : undefined),
      ordering,
    }),
    ...tenantOpts(tenantSlug),
  })
  const results = asList(data).map(normalizePatient)
  return {
    count: Number(data?.count) || results.length,
    results,
    next: data?.next || null,
    previous: data?.previous || null,
  }
}

/** GET /api/care/patients/:id/ */
export const fetchPatient = async (tenantSlug, patientId) => {
  const id = requireId(patientId, 'Patient')
  const { data } = await api.get(`api/care/patients/${id}/`, tenantOpts(tenantSlug))
  return normalizePatient(unwrap(data))
}

/** POST /api/care/patients/ */
export const createPatient = async (tenantSlug, form) => {
  const { data } = await api.post(
    'api/care/patients/',
    buildPatientBody(form),
    tenantOpts(tenantSlug),
  )
  return normalizePatient(unwrap(data))
}

/** PATCH /api/care/patients/:id/ */
export const updatePatient = async (tenantSlug, patientId, form) => {
  const id = requireId(patientId, 'Patient')
  const { data } = await api.patch(
    `api/care/patients/${id}/`,
    buildPatientBody(form),
    tenantOpts(tenantSlug),
  )
  return normalizePatient(unwrap(data))
}

/** Alias kept for older callers that used PUT replace. */
export const replacePatient = updatePatient

/** DELETE /api/care/patients/:id/ — soft delete */
export const softDeletePatient = async (tenantSlug, patientId) => {
  const id = requireId(patientId, 'Patient')
  await api.delete(`api/care/patients/${id}/`, tenantOpts(tenantSlug))
  return { id }
}

export const deletePatient = softDeletePatient

/** Unused helper retained for compatibility with older imports. */
export const PATIENT_WRITE_KEYS = [
  'first_name',
  'last_name',
  'phone',
  'email',
  'dob',
  'gender',
  'blood_group',
  'address',
  'medical_history',
  'allergies',
  'emergency_contact_name',
  'emergency_contact_phone',
  'emergency_contact_relation',
]
