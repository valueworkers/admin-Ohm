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

const num = (v) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export const normalizeEmployeePayroll = (row = {}) => {
  const fullName = [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ')
  return {
    id: String(row.id ?? ''),
    name: fullName || row.name || 'Employee',
    employeeId: String(row.employee_id || row.employee_profile?.employee_id || ''),
    email: String(row.email || ''),
    mobile: String(row.mobile_number || row.phone || ''),
    category: String(row.employee_category || row.employee_profile?.category || ''),
    vendorName: String(row.vendor_name || ''),
    basicSalary: num(row.basic_salary),
    pfAmount: num(row.pf_amount),
    esiAmount: num(row.esi_amount),
    recentPayment: num(row.recent_payment),
    payoutMode: String(row.payout_mode || row.salary_mode || ''),
    effectiveDate: String(row.effective_date || ''),
    raw: row,
  }
}

export const normalizeSalaryStructure = (row = {}) => {
  const amount = num(row.amount)
  const pf = num(row.pf_amount) ?? 0
  const esi = num(row.esi_amount) ?? 0
  const finalSalary = num(row.final_salary) ?? (amount != null ? amount : null)
  return {
    id: String(row.id ?? ''),
    userId: String(row.user ?? row.user_id ?? ''),
    salaryType: String(row.salary_type || 'MONTHLY').toUpperCase(),
    changeType: String(row.change_type || 'BASE_SALARY').toUpperCase(),
    amount,
    pfAmount: pf,
    esiAmount: esi,
    finalSalary,
    salaryMode: String(row.salary_mode || row.payout_mode || ''),
    effectiveFrom: String(row.effective_from || ''),
    updatedAt: String(row.updated_at || row.modified_at || ''),
    raw: row,
  }
}

export const normalizeSalaryReport = (row = {}) => {
  const start = String(row.start_date || row.payment_period_start || '')
  const end = String(row.end_date || row.payment_period_end || '')
  const monthKey =
    String(row.period_month || '').slice(0, 7) ||
    (start.match(/^(\d{4}-\d{2})/) || [])[1] ||
    (end.match(/^(\d{4}-\d{2})/) || [])[1] ||
    ''
  const present = num(row.present_days) ?? 0
  const absent = num(row.absent_days) ?? 0
  const halfDay = num(row.half_day_count ?? row.half_days) ?? 0
  const paidLeave = num(row.paid_leave_days) ?? 0
  const payableDays =
    num(row.total_payable_days ?? row.payable_days) ?? present + halfDay * 0.5 + paidLeave
  const totalPayable = num(row.total_payable_amount ?? row.payable_amount) ?? 0
  const paidAmount = num(row.amount_paid ?? row.paid_amount ?? row.total_paid) ?? 0
  const advance = num(row.advance_amount ?? row.advance) ?? 0
  const loan = num(row.loan_amount ?? row.loan) ?? 0
  return {
    id: String(row.id ?? ''),
    userId: String(row.user ?? row.user_id ?? ''),
    monthKey,
    startDate: start,
    endDate: end,
    present,
    absent,
    halfDay,
    paidLeave,
    payableDays,
    advance,
    loan,
    totalPayable,
    paidAmount,
    isFinalized: Boolean(row.is_finalized),
    raw: row,
  }
}

export const fetchEmployeePayroll = async (tenantSlug, params = {}) => {
  const { data } = await api.get('api/payroll/employee-payroll/', {
    ...tenantOpts(tenantSlug),
    params: cleanParams({
      page: params.page || 1,
      page_size: params.pageSize || 20,
      search: params.search,
      ordering: params.ordering,
    }),
  })
  const results = asList(data).map(normalizeEmployeePayroll).filter((r) => r.id)
  return {
    results,
    count: data?.count ?? results.length,
    next: data?.next || null,
    previous: data?.previous || null,
    page: data?.current_page ?? params.page ?? 1,
    totalPages: data?.total_pages ?? null,
  }
}

export const fetchEmployeePayrollDetail = async (tenantSlug, tenantUserId) => {
  const id = requireId(tenantUserId, 'Employee')
  const { data } = await api.get(
    `api/payroll/employee-payroll/${id}/`,
    tenantOpts(tenantSlug),
  )
  return normalizeEmployeePayroll(unwrap(data))
}

export const fetchSalaryStructures = async (tenantSlug, { userId } = {}) => {
  const { data } = await api.get('api/payroll/salary-structures/', {
    ...tenantOpts(tenantSlug),
    params: cleanParams({ user_id: userId, user: userId }),
  })
  return asList(data).map(normalizeSalaryStructure).filter((r) => r.id)
}

export const createSalaryStructure = async (tenantSlug, payload) => {
  const { data } = await api.post(
    'api/payroll/salary-structures/',
    payload,
    {
      ...tenantOpts(tenantSlug),
      params: cleanParams({ user_id: payload.user }),
    },
  )
  return normalizeSalaryStructure(unwrap(data))
}

export const updateSalaryStructure = async (tenantSlug, structureId, payload) => {
  const id = requireId(structureId, 'Salary structure')
  const { data } = await api.patch(
    `api/payroll/salary-structures/${id}/`,
    payload,
    tenantOpts(tenantSlug),
  )
  return normalizeSalaryStructure(unwrap(data))
}

export const deleteSalaryStructure = async (tenantSlug, structureId) => {
  const id = requireId(structureId, 'Salary structure')
  await api.delete(`api/payroll/salary-structures/${id}/`, tenantOpts(tenantSlug))
}

export const refreshSalaryReports = async (tenantSlug, userId) => {
  const id = requireId(userId, 'Employee')
  const { data } = await api.post(
    'api/payroll/reports/refresh/',
    { user_id: Number.isFinite(Number(id)) ? Number(id) : id },
    tenantOpts(tenantSlug),
  )
  return unwrap(data)
}

export const fetchSalaryReports = async (tenantSlug, params = {}) => {
  const { data } = await api.get('api/payroll/reports/', {
    ...tenantOpts(tenantSlug),
    params: cleanParams({
      user_id: params.userId,
      start_date: params.startDate,
      end_date: params.endDate,
      is_finalized: params.isFinalized,
    }),
  })
  return asList(data).map(normalizeSalaryReport).filter((r) => r.id || r.monthKey)
}

export const finalizeSalaryReport = async (tenantSlug, reportId) => {
  const id = requireId(reportId, 'Salary report')
  const { data } = await api.post(
    `api/payroll/reports/${id}/finalize/`,
    {},
    tenantOpts(tenantSlug),
  )
  return unwrap(data)
}

export const fetchSalaryTransactions = async (tenantSlug, { userId } = {}) => {
  const { data } = await api.get('api/payroll/salary-transactions/', {
    ...tenantOpts(tenantSlug),
    params: cleanParams({ user: userId, user_id: userId }),
  })
  return asList(data)
}

export const createSalaryTransaction = async (tenantSlug, payload) => {
  const { data } = await api.post(
    'api/payroll/salary-transactions/',
    payload,
    tenantOpts(tenantSlug),
  )
  return unwrap(data)
}
