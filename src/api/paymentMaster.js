import api from './axiosClient'

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
  if (v == null || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_ABBREV = Object.fromEntries(MONTH_SHORT.map((m, i) => [m, i]))

export const monthKeyToYearMonth = (raw) => {
  const s = String(raw ?? '').trim()
  if (!s) return null
  let m = /^([A-Za-z]{3})'(\d{4})$/.exec(s)
  if (m && MONTH_ABBREV[m[1]] !== undefined) return { year: +m[2], month: MONTH_ABBREV[m[1]] + 1 }
  m = /^([A-Za-z]{3})-(\d{4})$/.exec(s)
  if (m && MONTH_ABBREV[m[1]] !== undefined) return { year: +m[2], month: MONTH_ABBREV[m[1]] + 1 }
  m = /^([A-Za-z]{3})\s+(\d{4})$/.exec(s)
  if (m && MONTH_ABBREV[m[1]] !== undefined) return { year: +m[2], month: MONTH_ABBREV[m[1]] + 1 }
  m = /^(\d{4})-(\d{2})$/.exec(s)
  if (m) return { year: +m[1], month: +m[2] }
  return null
}

export const normalizeMonthLabel = (monthRaw) => {
  const parsed = monthKeyToYearMonth(monthRaw)
  if (parsed) return `${MONTH_SHORT[parsed.month - 1]}'${parsed.year}`
  return String(monthRaw ?? '').trim() || '—'
}

export const normalizeMonthlyRow = (row = {}, year) => {
  const gen = num(row.generated_invoices)
  const notGen = num(row.not_generated_invoices)
  const hasSplit = row.generated_invoices != null || row.not_generated_invoices != null
  const totalInvoices = hasSplit
    ? gen + notGen
    : num(row.total_invoices ?? row.no_of_invoices ?? row.invoice_count)
  const unpaid = num(row.unpaid_invoices ?? row.pending_invoices)
  return {
    month: normalizeMonthLabel(row.month),
    year,
    bookingsStarting: num(row.bookings_starting ?? row.total_bookings),
    bookingsEnding: num(row.bookings_ending),
    invoiceValue: num(row.invoice_value),
    amtCollected: num(row.amt_collected),
    balance: row.balance == null || row.balance === '' ? null : num(row.balance),
    generatedInvoices: gen,
    notGeneratedInvoices: notGen,
    totalInvoices,
    paidInvoices: num(row.paid_invoices),
    partiallyPaidInvoices: num(row.partially_paid_invoices),
    unpaidInvoices: unpaid,
    unmappedCount: num(row.unmapped_count ?? row.unmapped_payments),
    unmappedAmount: num(row.unmapped_amount),
    collectionPct: row.collection_pct,
    raw: row,
  }
}

export const normalizeMonthlySummary = (summary = {}) => ({
  totalInvoiceValue: num(summary.total_invoice_value),
  totalAmtCollected: num(summary.total_amt_collected),
  totalBalance: num(summary.total_balance),
  totalBookingsStarting: num(summary.total_bookings_starting),
  totalBookingsEnding: num(summary.total_bookings_ending),
  totalGeneratedInvoices: num(summary.total_generated_invoices),
  totalPaidInvoices: num(summary.total_paid_invoices),
  totalPartiallyPaidInvoices: num(summary.total_partially_paid_invoices),
  totalUnpaidInvoices: num(summary.total_unpaid_invoices),
  totalUnmappedCount: num(summary.total_unmapped_count),
  totalUnmappedAmount: num(summary.total_unmapped_amount),
  collectionPct: summary.collection_pct,
})

const apiMonthBucketKey = (year, month) => `${MONTH_SHORT[month - 1]}-${year}`

export const parseDailyCollection = (dailyCollection, year, month) => {
  if (!dailyCollection || typeof dailyCollection !== 'object') return {}
  const preferred = apiMonthBucketKey(year, month)
  let bucket = dailyCollection[preferred]
  if (!bucket) {
    const lower = preferred.toLowerCase()
    const key = Object.keys(dailyCollection).find((k) => k.toLowerCase() === lower)
    if (key) bucket = dailyCollection[key]
  }
  if (!bucket && Object.keys(dailyCollection).length === 1) {
    bucket = dailyCollection[Object.keys(dailyCollection)[0]]
  }
  if (!bucket || typeof bucket !== 'object') return {}
  const out = {}
  Object.entries(bucket).forEach(([dayStr, val]) => {
    const day = parseInt(String(dayStr), 10)
    if (day >= 1 && day <= 31) out[day] = num(val)
  })
  return out
}

/** Month-wise performance — OAS: year; live client also sends year_type. */
export const fetchMonthWisePerformance = async (tenantSlug, { year, yearType = 'CY' } = {}) => {
  const { data } = await api.get('api/analytics/payment-master/month-wise-performance/', {
    ...tenantOpts(tenantSlug),
    params: cleanParams({ year, year_type: yearType }),
  })
  const displayYear = yearType === 'FY' ? Number(year) - 1 : Number(year)
  const rows = Array.isArray(data?.rows) ? data.rows : []
  return {
    rows: rows.map((r) => normalizeMonthlyRow(r, displayYear)),
    summary: data?.summary ? normalizeMonthlySummary(data.summary) : null,
  }
}

/**
 * Daily collection — OAS: date; live client: year + month.
 * Send year/month plus date (1st of month) for compatibility.
 */
export const fetchDailyCollection = async (tenantSlug, { year, month } = {}) => {
  const y = Number(year)
  const m = Number(month)
  const date = `${y}-${String(m).padStart(2, '0')}-01`
  const { data } = await api.get('api/analytics/payment-master/daily-collection/', {
    ...tenantOpts(tenantSlug),
    params: cleanParams({ year: y, month: m, date }),
  })
  return parseDailyCollection(data?.daily_collection, y, m)
}

/**
 * Payment mode analytics — OAS: start_date/end_date; live: year+year_type or year+month.
 */
export const fetchPaymentModeAnalytics = async (tenantSlug, params = {}) => {
  const query = {}
  if (params.startDate) query.start_date = params.startDate
  if (params.endDate) query.end_date = params.endDate
  if (params.year != null) query.year = params.year
  if (params.yearType) query.year_type = params.yearType
  if (params.month != null) query.month = params.month

  const { data } = await api.get('api/analytics/payment-master/payment-mode-analytics/', {
    ...tenantOpts(tenantSlug),
    params: cleanParams(query),
  })
  return data
}
