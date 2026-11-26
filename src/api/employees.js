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

const idOf = (value) =>
  value != null && typeof value === 'object' ? String(value.id ?? '') : String(value ?? '')

const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v != null && v !== 'all'),
  )

export { fetchShifts, normalizeShift } from './shifts'

export const normalizeEmployee = (row = {}) => {
  const profile = row.employee_profile || {}
  const shiftRaw = profile.shift ?? row.shift
  const shiftId = idOf(shiftRaw)
  const shiftName =
    profile.shift_detail ||
    (shiftRaw && typeof shiftRaw === 'object'
      ? shiftRaw.name || shiftRaw.label || ''
      : '') ||
    row.shift_name ||
    ''
  const terminated =
    Boolean(row.is_terminated) ||
    Boolean(profile.termination_type) ||
    Boolean(profile.last_working_day && !row.is_active) ||
    String(row.status || '').toLowerCase() === 'terminated'
  return {
    ...row,
    id: String(row.id ?? ''),
    email: String(row.email || ''),
    profile_pic: row.profile_pic || null,
    first_name: String(row.first_name || ''),
    middle_name: String(row.middle_name || ''),
    last_name: String(row.last_name || ''),
    mobile_number: String(row.mobile_number || row.phone || ''),
    alternate_phone_number: String(row.alternate_phone_number || ''),
    emergency_contact_name: String(row.emergency_contact_name || ''),
    emergency_contact_number: String(row.emergency_contact_number || ''),
    age: row.age ?? '',
    gender: String(row.gender || ''),
    permanent_address: String(row.permanent_address || ''),
    current_address: String(row.current_address || ''),
    city: String(row.city || ''),
    primary_role: String(row.primary_role || row.role || row.role_code || ''),
    role: String(row.role || row.primary_role || row.role_code || row.user_type || ''),
    is_active: row.is_active !== false && !terminated,
    is_deleted: Boolean(row.is_deleted),
    is_terminated: terminated,
    date_joined: row.date_joined || '',
    created_by: row.created_by ?? '',
    employee_profile: {
      ...profile,
      id: profile.id ?? null,
      employee_id: String(profile.employee_id || ''),
      category: String(profile.category || ''),
      designation: String(profile.designation || ''),
      grade: profile.grade ?? '',
      cost_center: profile.cost_center ?? '',
      department: String(profile.department || ''),
      skills: Array.isArray(profile.skills) ? profile.skills : [],
      vendor_name: profile.vendor_name ?? '',
      vendor_phone: profile.vendor_phone ?? '',
      shift: shiftId,
      shift_name: shiftName,
      shift_detail: String(profile.shift_detail || shiftName || ''),
      rehired_status: String(profile.rehired_status || 'NO'),
      pf_applicable: Boolean(profile.pf_applicable),
      pf_number: profile.pf_number ?? '',
      uan_number: profile.uan_number ?? '',
      esi_applicable: Boolean(profile.esi_applicable),
      esi_number: profile.esi_number ?? '',
      esi_dispensary: profile.esi_dispensary ?? '',
      shift_effective_from: String(profile.shift_effective_from || '').slice(0, 10),
      termination_type: String(profile.termination_type || ''),
      termination_reason: String(profile.termination_reason || profile.reason || ''),
      last_working_day: String(profile.last_working_day || '').slice(0, 10),
    },
  }
}

export const employeeFullName = (row = {}) =>
  [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ').trim() ||
  row.name ||
  row.email ||
  '—'

const str = (v) => String(v ?? '').trim()

const asSkillRows = (skills) => {
  if (!Array.isArray(skills)) return []
  return skills
    .map((s) => {
      if (typeof s === 'string') {
        const skill = s.trim()
        return skill ? { service: '', skill, priority: '' } : null
      }
      const skill = str(s?.skill || s?.name)
      if (!skill && !str(s?.service)) return null
      return {
        service: str(s?.service || s?.service_id),
        skill,
        priority: str(s?.priority),
      }
    })
    .filter(Boolean)
}

const buildProfile = (form = {}, { requireCore = false } = {}) => {
  const src = { ...(form.employee_profile || {}), ...form }
  const profile = {
    employee_id: str(src.employee_id),
    category: str(src.category),
    designation: str(src.designation),
    grade: str(src.grade) || null,
    cost_center: str(src.cost_center) || null,
    department: str(src.department),
    shift: str(src.shift),
    rehired_status: str(src.rehired_status) || 'NO',
    last_working_day: str(src.last_working_day) || null,
    target_percent: src.target_percent === '' || src.target_percent == null ? null : Number(src.target_percent),
    qc_required: Boolean(src.qc_required),
    pf_applicable: Boolean(src.pf_applicable),
    esi_applicable: Boolean(src.esi_applicable),
    skills: asSkillRows(src.skills),
  }
  if (!requireCore) {
    Object.keys(profile).forEach((k) => {
      if (profile[k] === '' || profile[k] === null || (Array.isArray(profile[k]) && !profile[k].length)) {
        if (k !== 'qc_required' && k !== 'pf_applicable' && k !== 'esi_applicable') {
          if (profile[k] === '' || profile[k] === null) delete profile[k]
        }
      }
    })
  }
  return profile
}

export const buildCreateEmployeeBody = (form = {}) => {
  const status = str(form.status) || (form.is_active === false ? 'INACTIVE' : 'ACTIVE')
  return {
    email: str(form.email),
    password: String(form.password || ''),
    confirm_password: String(form.confirm_password || ''),
    first_name: str(form.first_name),
    middle_name: str(form.middle_name),
    last_name: str(form.last_name),
    mobile_number: str(form.mobile_number),
    // Backend rejects null for these — always send strings.
    alternate_phone_number: str(form.alternate_phone_number),
    age: form.age === '' || form.age == null ? null : Number(form.age),
    gender: str(form.gender),
    city: str(form.city || form.base_location),
    address_line1: str(form.address_line1),
    address_line2: str(form.address_line2),
    permanent_address: str(form.permanent_address) || str(form.address_line1),
    current_address: str(form.current_address) || str(form.address_line1),
    emergency_contact_name: str(form.emergency_contact_name),
    emergency_contact_number: str(form.emergency_contact_number),
    date_joined: str(form.date_joined) || null,
    is_active: status.toUpperCase() !== 'INACTIVE',
    status: status.toUpperCase(),
    role: str(form.role || 'STAFF'),
    employee_profile: buildProfile(form, { requireCore: true }),
  }
}

export const buildUpdateEmployeeBody = (form = {}) => {
  const status = str(form.status)
  return {
    first_name: str(form.first_name),
    middle_name: str(form.middle_name),
    last_name: str(form.last_name),
    mobile_number: str(form.mobile_number),
    alternate_phone_number: str(form.alternate_phone_number),
    age: form.age === '' || form.age == null ? null : Number(form.age),
    gender: str(form.gender),
    city: str(form.city || form.base_location),
    address_line1: str(form.address_line1),
    address_line2: str(form.address_line2),
    permanent_address: str(form.permanent_address) || str(form.address_line1),
    current_address: str(form.current_address) || str(form.address_line1),
    emergency_contact_name: str(form.emergency_contact_name),
    emergency_contact_number: str(form.emergency_contact_number),
    date_joined: str(form.date_joined) || null,
    ...(status
      ? {
          status: status.toUpperCase(),
          is_active: status.toUpperCase() !== 'INACTIVE',
        }
      : {}),
    role: str(form.role) || undefined,
    employee_profile: buildProfile(form),
  }
}

/** GET /api/employees/ */
export const fetchEmployees = async (
  tenantSlug,
  { page = 1, pageSize = 100, q, search, isActive, category, ordering } = {},
) => {
  const { data } = await api.get('api/employees/', {
    params: cleanParams({
      page,
      page_size: pageSize,
      q,
      search: search || q,
      is_active: isActive,
      category,
      ordering,
    }),
    ...tenantOpts(tenantSlug),
  })
  const results = asList(data).map(normalizeEmployee)
  return {
    count: Number(data?.count) || results.length,
    results,
    next: data?.next || null,
    previous: data?.previous || null,
  }
}

/** GET /api/employees/:id/ */
export const fetchEmployee = async (tenantSlug, userId) => {
  const id = requireId(userId, 'Employee')
  const { data } = await api.get(`api/employees/${id}/`, tenantOpts(tenantSlug))
  return normalizeEmployee(unwrap(data))
}

/** POST /api/employees/ */
export const createEmployee = async (tenantSlug, form) => {
  const { data } = await api.post(
    'api/employees/',
    buildCreateEmployeeBody(form),
    tenantOpts(tenantSlug),
  )
  return normalizeEmployee(unwrap(data))
}

/** PATCH /api/employees/:id/ */
export const updateEmployee = async (tenantSlug, userId, form) => {
  const id = requireId(userId, 'Employee')
  const { data } = await api.patch(
    `api/employees/${id}/`,
    buildUpdateEmployeeBody(form),
    tenantOpts(tenantSlug),
  )
  return normalizeEmployee(unwrap(data))
}

/** POST /api/employees/:id/terminate/ */
export const terminateEmployee = async (tenantSlug, userId, payload) => {
  const id = requireId(userId, 'Employee')
  const body = {
    termination_type: String(payload.termination_type || '').trim(),
    reason: String(payload.reason || '').trim(),
    last_working_day: String(payload.last_working_day || '').trim(),
  }
  const { data } = await api.post(
    `api/employees/${id}/terminate/`,
    body,
    tenantOpts(tenantSlug),
  )
  return normalizeEmployee(unwrap(data))
}

/** POST /api/employees/:id/termination-revoke/ */
export const revokeEmployeeTermination = async (tenantSlug, userId, { rehired = true } = {}) => {
  const id = requireId(userId, 'Employee')
  const { data } = await api.post(
    `api/employees/${id}/termination-revoke/`,
    { rehired: Boolean(rehired) },
    tenantOpts(tenantSlug),
  )
  return normalizeEmployee(unwrap(data))
}

/** POST /api/employees-bulk-upload/ — multipart .xlsx/.xlsm */
export const bulkUploadEmployees = async (tenantSlug, file) => {
  if (!file) throw new Error('Excel file is required.')
  const body = new FormData()
  body.append('file', file)
  const { data } = await api.post('api/employees-bulk-upload/', body, tenantOpts(tenantSlug))
  return unwrap(data)
}
