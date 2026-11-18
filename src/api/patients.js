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

const nullableStr = (v) => {
  const s = str(v)
  return s || null
}

const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v != null && v !== 'all'),
  )

export const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
]

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

/** Writable fields for POST/PUT (excludes id, patient_id, is_deleted, is_active, registration_date, updated_at, registered_by). */
export const PATIENT_WRITE_KEYS = [
  'first_name',
  'last_name',
  'full_name',
  'email',
  'phone',
  'address',
  'age',
  'emergency_contact',
  'emergency_phone',
  'emergency_contact_2',
  'emergency_phone_2',
  'medical_conditions',
  'allergies',
  'present_health_condition',
  'gender',
  'blood_group',
  'preferred_language',
  'education_qualifications',
  'earlier_occupation',
  'year_of_retirement',
  'affiliate',
  'source',
  'referred_by',
  'is_probono',
  'is_registration_fees_paid',
]

export const patientFullName = (row = {}) =>
  str(row.full_name) ||
  [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
  row.name ||
  row.email ||
  (row.patient_id ? `Patient ${row.patient_id}` : '') ||
  (row.id ? `Patient #${row.id}` : '—')

export const normalizePatient = (row = {}) => {
  const first = str(row.first_name)
  const last = str(row.last_name)
  return {
    ...row,
    id: String(row.id ?? ''),
    patient_id: str(row.patient_id),
    first_name: first,
    last_name: last,
    full_name: str(row.full_name) || [first, last].filter(Boolean).join(' ').trim(),
    email: str(row.email),
    phone: str(row.phone || row.mobile_number),
    address: str(row.address),
    age: row.age != null && row.age !== '' ? Number(row.age) : null,
    emergency_contact: str(row.emergency_contact),
    emergency_phone: str(row.emergency_phone),
    emergency_contact_2: str(row.emergency_contact_2),
    emergency_phone_2: str(row.emergency_phone_2),
    medical_conditions: str(row.medical_conditions),
    allergies: str(row.allergies),
    present_health_condition: str(row.present_health_condition),
    gender: str(row.gender),
    blood_group: str(row.blood_group),
    preferred_language: str(row.preferred_language),
    education_qualifications: str(row.education_qualifications),
    earlier_occupation: str(row.earlier_occupation),
    year_of_retirement:
      row.year_of_retirement != null && row.year_of_retirement !== ''
        ? Number(row.year_of_retirement)
        : null,
    affiliate: str(row.affiliate),
    source: str(row.source),
    referred_by: str(row.referred_by),
    is_probono: Boolean(row.is_probono),
    is_registration_fees_paid: Boolean(row.is_registration_fees_paid),
    is_deleted: Boolean(row.is_deleted),
    is_active: row.is_active !== false,
    registration_date: row.registration_date || '',
    updated_at: row.updated_at || '',
    registered_by: row.registered_by ?? null,
    name: patientFullName(row),
  }
}

export const buildPatientBody = (form = {}) => {
  const first = str(form.first_name)
  const last = str(form.last_name)
  const full =
    str(form.full_name) || [first, last].filter(Boolean).join(' ').trim()

  const yearRaw = form.year_of_retirement
  const year =
    yearRaw === '' || yearRaw == null
      ? null
      : Number.isFinite(Number(yearRaw))
        ? Number(yearRaw)
        : null

  return {
    first_name: first,
    last_name: last,
    full_name: full,
    email: str(form.email),
    phone: str(form.phone),
    address: str(form.address),
    age: Math.max(0, Number(form.age) || 0),
    emergency_contact: str(form.emergency_contact),
    emergency_phone: str(form.emergency_phone),
    emergency_contact_2: nullableStr(form.emergency_contact_2),
    emergency_phone_2: nullableStr(form.emergency_phone_2),
    medical_conditions: nullableStr(form.medical_conditions),
    allergies: nullableStr(form.allergies),
    present_health_condition: nullableStr(form.present_health_condition),
    gender: str(form.gender),
    blood_group: str(form.blood_group),
    preferred_language: str(form.preferred_language),
    education_qualifications: nullableStr(form.education_qualifications),
    earlier_occupation: nullableStr(form.earlier_occupation),
    year_of_retirement: year,
    affiliate: nullableStr(form.affiliate),
    source: nullableStr(form.source),
    referred_by: nullableStr(form.referred_by),
    is_probono: Boolean(form.is_probono),
    is_registration_fees_paid: Boolean(form.is_registration_fees_paid),
  }
}

export const buildPatientPatchBody = (form = {}) => buildPatientBody(form)

/** GET /api/billing/patients/ */
export const fetchPatients = async (
  tenantSlug,
  {
    page = 1,
    pageSize = 100,
    search,
    gender,
    isActive,
    isProbono,
    ordering,
  } = {},
) => {
  const { data } = await api.get('api/billing/patients/', {
    params: cleanParams({
      page,
      page_size: pageSize,
      search,
      gender,
      is_active: isActive,
      is_probono: isProbono,
      ordering,
    }),
    ...tenantOpts(tenantSlug),
  })
  const results = asList(data).map(normalizePatient)
  return { count: Number(data?.count) || results.length, results }
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
    buildPatientPatchBody(form),
    tenantOpts(tenantSlug),
  )
  return normalizePatient(unwrap(data))
}

/** PUT /api/billing/patients/:id/ */
export const replacePatient = async (tenantSlug, patientId, form) => {
  const id = requireId(patientId, 'Patient')
  const { data } = await api.put(
    `api/billing/patients/${id}/`,
    buildPatientBody(form),
    tenantOpts(tenantSlug),
  )
  return normalizePatient(unwrap(data))
}

/** POST /api/billing/patients/:id/soft_delete/ */
export const softDeletePatient = async (tenantSlug, patientId) => {
  const id = requireId(patientId, 'Patient')
  await api.post(`api/billing/patients/${id}/soft_delete/`, {}, tenantOpts(tenantSlug))
  return { id }
}

/** DELETE /api/billing/patients/:id/ */
export const deletePatient = async (tenantSlug, patientId) => {
  const id = requireId(patientId, 'Patient')
  await api.delete(`api/billing/patients/${id}/`, tenantOpts(tenantSlug))
  return { id }
}
