import api from './axiosClient'

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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

const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v != null && v !== 'all'),
  )

const num = (v) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export const monthBounds = (monthKey) => {
  const m = String(monthKey || '').match(/^(\d{4})-(\d{2})$/)
  if (!m) {
    const now = new Date()
    return monthBounds(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  }
  const year = Number(m[1])
  const month = Number(m[2])
  const last = new Date(year, month, 0).getDate()
  return {
    monthKey: `${year}-${String(month).padStart(2, '0')}`,
    year,
    month,
    daysInMonth: last,
    startDate: `${year}-${String(month).padStart(2, '0')}-01`,
    endDate: `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`,
    /** Matches API attendance keys like Nov'2026 */
    attendanceLabel: `${MONTH_SHORT[month - 1]}'${year}`,
  }
}

const dayCode = (raw) => {
  if (raw == null || raw === '') return ''
  const s = String(raw).trim().toUpperCase()
  if (!s || s === '-' || s === '--') return ''
  if (s === 'P' || s.startsWith('PRESENT')) return 'P'
  if (s === 'A' || s.startsWith('ABSENT')) return 'A'
  if (/HALF|^H$|^HD$/.test(s)) return 'H'
  if (/^PL|PAID/.test(s)) return 'PL'
  return s.slice(0, 2)
}

/** Extract day map for the selected month from attendance: { "Nov'2026": { "01": "P" } } */
export const dailyMapForMonth = (attendanceBag = {}, monthKey) => {
  const bounds = monthBounds(monthKey)
  const bag =
    (attendanceBag && typeof attendanceBag === 'object' && !Array.isArray(attendanceBag)
      ? attendanceBag
      : {}) || {}

  const monthDays =
    bag[bounds.attendanceLabel] ||
    bag[bounds.monthKey] ||
    bag[`${MONTH_SHORT[bounds.month - 1]} ${bounds.year}`] ||
    null

  const map = {}
  if (monthDays && typeof monthDays === 'object') {
    for (const [dayKey, value] of Object.entries(monthDays)) {
      const dayNum = Number(dayKey)
      if (!Number.isFinite(dayNum) || dayNum < 1 || dayNum > bounds.daysInMonth) continue
      map[dayNum] = dayCode(value)
    }
  }

  let present = 0
  let absent = 0
  for (const code of Object.values(map)) {
    if (code === 'P' || code === 'PL' || code === 'H') present += code === 'H' ? 0.5 : 1
    if (code === 'A') absent += 1
  }

  return { daily: map, presentDays: present, absentDays: absent, ...bounds }
}

export const normalizeAttendanceAnalysisRow = (row = {}, monthKey) => {
  const id = String(row.user ?? row.user_id ?? row.id ?? '')
  const parsed = dailyMapForMonth(row.attendance || {}, monthKey)
  return {
    id,
    daily: parsed.daily,
    presentDays: parsed.presentDays,
    absentDays: parsed.absentDays,
    raw: row,
  }
}

export const normalizeSalaryAnalysisRow = (row = {}, monthKey) => {
  const bounds = monthBounds(monthKey)
  const periods = Array.isArray(row.periods) ? row.periods : []
  const period =
    periods.find((p) => {
      const start = String(p.start_date || '')
      return start.startsWith(bounds.monthKey)
    }) ||
    periods[0] ||
    null

  const name =
    [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ').trim() ||
    row.name ||
    'Employee'

  // Prefer explicit current_status / is_active / is_terminated over boolean status.
  const statusLabel = String(
    row.current_status ||
      (typeof row.status === 'string' ? row.status : '') ||
      '',
  ).trim()
  const terminated =
    row.is_terminated === true ||
    row.is_active === false ||
    (typeof row.status === 'boolean' && row.status === false) ||
    /termin/i.test(statusLabel) ||
    /inactive/i.test(statusLabel)
  const status = terminated
    ? statusLabel && /termin/i.test(statusLabel)
      ? statusLabel
      : 'Terminated'
    : statusLabel && !/termin|inactive/i.test(statusLabel)
      ? statusLabel
      : 'Active'

  return {
    id: String(row.id ?? row.user ?? row.user_id ?? ''),
    employeeId: String(row.emp_id || row.employee_id || ''),
    name,
    mobile: String(row.mobile_number || row.mobile || row.phone || ''),
    baseSalary: num(period?.salary ?? row.base_salary ?? row.basic_salary),
    salary: num(period?.total_salary ?? row.total_salary),
    paid: num(period?.amount_paid ?? row.amount_paid),
    balance: num(period?.excess_balance ?? row.excess_balance),
    paymentStatus: String(period?.payment_status || ''),
    presentDays: num(period?.total_payable_days),
    absentDays: num(period?.total_unpaid_days),
    attendancePct: num(period?.attendance_pct),
    status,
    isActive: !terminated,
    raw: row,
  }
}

export const mergeAttendanceSalaryRows = (attendanceRows = [], salaryRows = [], daysInMonth = 31) => {
  const attendanceById = new Map(
    attendanceRows.filter((r) => r.id).map((r) => [String(r.id), r]),
  )

  const merged = salaryRows.map((sal) => {
    const att = attendanceById.get(String(sal.id)) || {}
    const daily = att.daily || {}
    const presentFromDaily = att.presentDays
    const absentFromDaily = att.absentDays
    return {
      id: sal.id,
      employeeId: sal.employeeId,
      name: sal.name,
      mobile: sal.mobile,
      baseSalary: sal.baseSalary,
      salary: sal.salary,
      paid: sal.paid,
      balance: sal.balance,
      paymentStatus: sal.paymentStatus,
      status: sal.status,
      isActive: sal.isActive,
      presentDays: sal.presentDays ?? presentFromDaily ?? 0,
      absentDays: sal.absentDays ?? absentFromDaily ?? 0,
      attendancePct: sal.attendancePct,
      daily,
      _days: daysInMonth,
      raw: { salary: sal.raw, attendance: att.raw },
    }
  })

  // Include attendance-only users (rare) so nothing is dropped.
  for (const att of attendanceRows) {
    if (!att.id || merged.some((r) => String(r.id) === String(att.id))) continue
    merged.push({
      id: att.id,
      employeeId: '',
      name: `User #${att.id}`,
      mobile: '',
      baseSalary: null,
      salary: null,
      paid: null,
      balance: null,
      paymentStatus: '',
      status: 'Active',
      isActive: true,
      presentDays: att.presentDays ?? 0,
      absentDays: att.absentDays ?? 0,
      attendancePct: null,
      daily: att.daily || {},
      _days: daysInMonth,
      raw: { attendance: att.raw },
    })
  }

  return merged
}

/** Backend caps page_size at 100; "all" walks pages. */
export const ATTENDANCE_PAGE_SIZES = [20, 40, 60, 'all']
const MAX_PAGE_SIZE = 100

const resolvePageSize = (pageSize) => {
  if (pageSize === 'all' || pageSize === 'ALL') return 'all'
  const n = Number(pageSize)
  if (!Number.isFinite(n) || n <= 0) return 20
  return Math.min(Math.floor(n), MAX_PAGE_SIZE)
}

const fetchPage = async (path, params, tenantSlug, pageSize = 20) => {
  const { data } = await api.get(path, {
    ...tenantOpts(tenantSlug),
    params: { ...params, page_size: pageSize },
  })
  const payload = unwrap(data)
  return {
    rows: asList(payload),
    count: Number(payload?.count ?? data?.count ?? 0) || 0,
    next: data?.next ?? payload?.next ?? null,
    previous: data?.previous ?? payload?.previous ?? null,
    summary: payload?.summary ?? null,
  }
}

const fetchAllPages = async (path, baseParams, tenantSlug) => {
  const all = []
  let page = 1
  let count = 0
  let summary = null
  let guard = 0
  while (guard < 100) {
    guard += 1
    const batch = await fetchPage(path, { ...baseParams, page }, tenantSlug, MAX_PAGE_SIZE)
    all.push(...batch.rows)
    count = batch.count || all.length
    if (batch.summary) summary = batch.summary
    if (!batch.next || !batch.rows.length || all.length >= count) break
    page += 1
  }
  return { rows: all, count, next: null, previous: null, summary }
}

/**
 * GET /api/analytics/attendance/
 * Results: { user, attendance: { "Nov'2026": { "01": "P" } } }
 * Pass is_active true|false to filter employees server-side.
 */
const activeQuery = (isActive) => {
  if (isActive === true || isActive === 'true') return { is_active: true }
  if (isActive === false || isActive === 'false') return { is_active: false }
  return {}
}

export const fetchAttendanceAnalysis = async (
  tenantSlug,
  { month, userId, page = 1, pageSize = 20, isActive } = {},
) => {
  const bounds = monthBounds(month)
  const size = resolvePageSize(pageSize)
  const baseParams = cleanParams({
    month: bounds.monthKey,
    months: bounds.monthKey,
    year: bounds.year,
    start_date: bounds.startDate,
    end_date: bounds.endDate,
    user_id: userId,
    ...activeQuery(isActive),
  })
  const result =
    size === 'all'
      ? await fetchAllPages('api/analytics/attendance/', baseParams, tenantSlug)
      : await fetchPage(
          'api/analytics/attendance/',
          { ...baseParams, page },
          tenantSlug,
          size,
        )
  const rows = result.rows.map((r) => normalizeAttendanceAnalysisRow(r, bounds.monthKey))
  return {
    ...bounds,
    rows,
    count: result.count,
    next: result.next,
    previous: result.previous,
    page: size === 'all' ? 1 : page,
    pageSize: size,
  }
}

/**
 * GET /api/analytics/salary/
 * Results: employee + periods[] for the month
 * Pass is_active true|false to filter employees server-side.
 */
export const fetchSalaryAnalysis = async (
  tenantSlug,
  { month, userId, period = 'monthly', page = 1, pageSize = 20, isActive } = {},
) => {
  const bounds = monthBounds(month)
  const size = resolvePageSize(pageSize)
  const baseParams = cleanParams({
    month: bounds.monthKey,
    months: bounds.monthKey,
    year: bounds.year,
    period,
    start_date: bounds.startDate,
    end_date: bounds.endDate,
    user_id: userId,
    ...activeQuery(isActive),
  })
  const result =
    size === 'all'
      ? await fetchAllPages('api/analytics/salary/', baseParams, tenantSlug)
      : await fetchPage(
          'api/analytics/salary/',
          { ...baseParams, page },
          tenantSlug,
          size,
        )
  const rows = result.rows.map((r) => normalizeSalaryAnalysisRow(r, bounds.monthKey))
  return {
    ...bounds,
    rows,
    count: result.count,
    next: result.next,
    previous: result.previous,
    summary: result.summary,
    page: size === 'all' ? 1 : page,
    pageSize: size,
  }
}
