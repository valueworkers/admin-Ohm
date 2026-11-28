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
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
]

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

export const patientFullName = (row = {}) =>
  [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
  row.full_name ||
  row.name ||
  row.email ||
  (row.id ? `Patient #${row.id}` : '—')

const addressToString = (row = {}) => {
  if (typeof row.address === 'string') return str(row.address)
  const addr = row.address && typeof row.address === 'object' ? row.address : null
  if (addr) {
    return [addr.line1, addr.line2, addr.locality, addr.city, addr.state, addr.pincode]
      .map(str)
      .filter(Boolean)
      .join(', ')
  }
  return [
    row.address_line1,
    row.address_line2,
    row.locality,
    row.city,
    row.state,
    row.pincode || row.postal_code,
  ]
    .map(str)
    .filter(Boolean)
    .join(', ')
}

/** Billing patient — /api/billing/patients/ */
export const normalizePatient = (row = {}) => {
  const first = str(row.first_name)
  const last = str(row.last_name)
  const address = addressToString(row)
  const gender = str(row.gender).toLowerCase() || 'male'
  return {
    ...row,
    id: String(row.id ?? ''),
    patient_id: str(row.patient_id || row.id),
    first_name: first,
    last_name: last,
    full_name: str(row.full_name) || [first, last].filter(Boolean).join(' ').trim(),
    email: str(row.email),
    phone: str(row.phone || row.mobile_number),
    address,
    age: row.age == null || row.age === '' ? null : Number(row.age),
    emergency_contact: str(row.emergency_contact || row.emergency_contact_name),
    emergency_phone: str(row.emergency_phone || row.emergency_contact_phone),
    emergency_contact_2: str(row.emergency_contact_2),
    emergency_phone_2: str(row.emergency_phone_2),
    medical_conditions: str(row.medical_conditions || row.medical_history),
    allergies: str(row.allergies),
    present_health_condition: str(row.present_health_condition),
    gender,
    blood_group: str(row.blood_group) || 'O+',
    preferred_language: str(row.preferred_language) || 'English',
    education_qualifications: str(row.education_qualifications),
    earlier_occupation: str(row.earlier_occupation),
    year_of_retirement:
      row.year_of_retirement == null || row.year_of_retirement === ''
        ? null
        : Number(row.year_of_retirement),
    affiliate: str(row.affiliate),
    source: str(row.source),
    referred_by: str(row.referred_by),
    is_probono: Boolean(row.is_probono),
    is_registration_fees_paid: Boolean(row.is_registration_fees_paid),
    is_deleted: Boolean(row.is_deleted),
    is_active: row.is_active !== false && row.status !== false,
    registration_date: row.registration_date || row.created_at || '',
    updated_at: row.updated_at || row.modified_at || '',
    registered_by: row.registered_by ?? null,
    name: patientFullName({ first_name: first, last_name: last, email: row.email, id: row.id }),
  }
}

/** POST/PATCH body for Billing → Patients */
export const buildPatientBody = (form = {}) => {
  const ageRaw = form.age
  const age =
    ageRaw === '' || ageRaw == null ? undefined : Number(ageRaw)
  const retireRaw = form.year_of_retirement
  const year_of_retirement =
    retireRaw === '' || retireRaw == null ? undefined : Number(retireRaw)

  return cleanParams({
    first_name: str(form.first_name),
    last_name: str(form.last_name),
    full_name:
      str(form.full_name) ||
      [form.first_name, form.last_name].map(str).filter(Boolean).join(' '),
    email: str(form.email),
    phone: str(form.phone || form.mobile_number),
    address: str(
      typeof form.address === 'string'
        ? form.address
        : form.address?.line1 || form.address_line1 || '',
    ),
    age: Number.isFinite(age) ? age : undefined,
    emergency_contact: str(form.emergency_contact || form.emergency_contact_name),
    emergency_phone: str(form.emergency_phone || form.emergency_contact_phone),
    emergency_contact_2: str(form.emergency_contact_2),
    emergency_phone_2: str(form.emergency_phone_2),
    medical_conditions: str(form.medical_conditions || form.medical_history),
    allergies: str(form.allergies),
    present_health_condition: str(form.present_health_condition),
    gender: str(form.gender || 'male').toLowerCase(),
    blood_group: str(form.blood_group || 'O+'),
    preferred_language: str(form.preferred_language || 'English'),
    education_qualifications: str(form.education_qualifications),
    earlier_occupation: str(form.earlier_occupation),
    year_of_retirement: Number.isFinite(year_of_retirement)
      ? year_of_retirement
      : undefined,
    affiliate: str(form.affiliate),
    source: str(form.source),
    referred_by: str(form.referred_by),
    is_probono: Boolean(form.is_probono),
    is_registration_fees_paid: Boolean(form.is_registration_fees_paid),
  })
}

/** GET /api/billing/patients/ */
export const fetchPatients = async (
  tenantSlug,
  {
    page = 1,
    pageSize = 100,
    search,
    status,
    isActive,
    isDeleted,
    gender,
    isProbono,
    ordering,
  } = {},
) => {
  const activeParam =
    status ??
    (isActive === true || isActive === 'true'
      ? 'true'
      : isActive === false || isActive === 'false'
        ? 'false'
        : undefined)

  const { data } = await api.get('api/billing/patients/', {
    params: cleanParams({
      page,
      page_size: pageSize,
      search,
      status: activeParam,
      is_active: activeParam,
      is_deleted:
        isDeleted === true || isDeleted === 'true'
          ? true
          : isDeleted === false || isDeleted === 'false'
            ? false
            : undefined,
      gender: gender ? String(gender).toLowerCase() : undefined,
      is_probono:
        isProbono === true || isProbono === 'true'
          ? true
          : isProbono === false || isProbono === 'false'
            ? false
            : undefined,
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

/** GET /api/billing/patients/patient_dropdown/ */
export const fetchPatientsDropdown = async (tenantSlug, params = {}) => {
  const { data } = await api.get('api/billing/patients/patient_dropdown/', {
    params: cleanParams(params),
    ...tenantOpts(tenantSlug),
  })
  return asList(data).map(normalizePatient)
}

/** GET /api/billing/patients/:id/ */
export const fetchPatient = async (tenantSlug, patientId) => {
  const id = requireId(patientId, 'Patient')
  const { data } = await api.get(`api/billing/patients/${id}/`, tenantOpts(tenantSlug))
  return normalizePatient(unwrap(data))
}

/** POST /api/billing/patients/ */
export const createPatient = async (tenantSlug, form) => {
  const { data } = await api.post(
    'api/billing/patients/',
    buildPatientBody(form),
    tenantOpts(tenantSlug),
  )
  return normalizePatient(unwrap(data))
}

/** PATCH /api/billing/patients/:id/ */
export const updatePatient = async (tenantSlug, patientId, form) => {
  const id = requireId(patientId, 'Patient')
  const { data } = await api.patch(
    `api/billing/patients/${id}/`,
    buildPatientBody(form),
    tenantOpts(tenantSlug),
  )
  return normalizePatient(unwrap(data))
}

/** Alias kept for older callers that used PUT replace. */
export const replacePatient = updatePatient

/** DELETE /api/billing/patients/:id/ — soft delete */
export const softDeletePatient = async (tenantSlug, patientId) => {
  const id = requireId(patientId, 'Patient')
  await api.delete(`api/billing/patients/${id}/`, tenantOpts(tenantSlug))
  return { id }
}

export const deletePatient = softDeletePatient

/** PATCH /api/billing/patients/:id/active-status/ */
export const setPatientActiveStatus = async (tenantSlug, patientId, isActive) => {
  const id = requireId(patientId, 'Patient')
  const { data } = await api.patch(
    `api/billing/patients/${id}/active-status/`,
    { is_active: Boolean(isActive) },
    tenantOpts(tenantSlug),
  )
  return normalizePatient(unwrap(data))
}

export const PATIENT_WRITE_KEYS = [
  'first_name',
  'last_name',
  'full_name',
  'phone',
  'email',
  'address',
  'age',
  'gender',
  'blood_group',
  'preferred_language',
  'medical_conditions',
  'allergies',
  'present_health_condition',
  'emergency_contact',
  'emergency_phone',
  'emergency_contact_2',
  'emergency_phone_2',
  'education_qualifications',
  'earlier_occupation',
  'year_of_retirement',
  'affiliate',
  'source',
  'referred_by',
  'is_probono',
  'is_registration_fees_paid',
]
