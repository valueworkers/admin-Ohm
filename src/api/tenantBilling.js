import api from './axiosClient'
import { normalizeUom } from '../features/billing/gstLines'
import { fetchPatients, normalizePatient } from './patients'

export { normalizePatient, patientFullName as patientDisplayName } from './patients'

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

const money2 = (value, fallback = 0) => {
  const n = Number(value)
  return (Number.isFinite(n) ? n : fallback).toFixed(2)
}

const num = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const idOf = (value) =>
  value != null && typeof value === 'object' ? String(value.id ?? '') : String(value ?? '')

const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v != null && v !== 'all'),
  )

const listResult = (data, normalize) => {
  const results = asList(data).map(normalize)
  return { count: Number(data?.count) || results.length, results }
}

const parseEmails = (raw) =>
  (Array.isArray(raw) ? raw : String(raw || '').split(/[,;\s]+/))
    .map((e) => String(e || '').trim().toLowerCase())
    .filter(Boolean)

/* ---------- Patients (dropdown) ---------- */

/** GET /api/billing/patients/ — lightweight list for billing selects */
export const fetchBillingPatients = async (tenantSlug, { search } = {}) => {
  const { results } = await fetchPatients(tenantSlug, { search, pageSize: 100 })
  return results.map(normalizePatient)
}

/* ---------- Quotes ---------- */

export const QUOTE_LINE_KINDS = ['service', 'catalog', 'custom', 'manpower']
export const BOOKING_ENTITIES = ['SERVICE', 'VENUE', 'RESOURCE']

const normalizeQuoteLine = (ln = {}, i = 0) => ({
  key: `ln-${ln.id ?? i}-${i}`,
  kind: String(ln.kind || 'service').toLowerCase(),
  item: ln.item || '',
  specification: ln.specification || '',
  hsn_sac: ln.hsn_sac || '',
  uom: normalizeUom(ln.uom),
  qty: ln.qty ?? '1',
  unit_price: ln.unit_price ?? '0',
  discount_percent: ln.discount_percent ?? '0',
  gst_rate: ln.gst_rate ?? '18',
})

export const normalizeBillingQuote = (row = {}) => ({
  ...row,
  id: String(row.id ?? ''),
  number: row.number
    ? `${row.number}${row.revision ? ` R${row.revision}` : ''}`
    : `Quote #${row.id ?? ''}`,
  status: String(row.status || 'draft').toUpperCase(),
  booking_entity: String(row.booking_entity || 'SERVICE').toUpperCase(),
  service: idOf(row.service),
  service_name: row.service_name || row.service?.name || '',
  patient: idOf(row.patient),
  patient_name: row.patient_name || '',
  company: row.company || '',
  attention: row.attention || '',
  address: row.address || '',
  gstin: String(row.gstin || '').toUpperCase(),
  state: row.state || '',
  buyer_email: row.buyer_email || '',
  valid_days: num(row.valid_days) ?? 30,
  freight: row.freight ?? '0',
  packing: row.packing ?? '0',
  charges_gst_rate: row.charges_gst_rate ?? '18',
  notes: row.notes || '',
  total: num(row.total),
  created_at: row.created_at || '',
  lines: Array.isArray(row.lines) ? row.lines.map(normalizeQuoteLine) : [],
})

export const buildBillingQuoteBody = (form = {}) => {
  const body = {
    booking_entity: String(form.booking_entity || 'SERVICE'),
    service: String(form.service || ''),
    company: String(form.company || '').trim(),
    attention: String(form.attention || '').trim(),
    address: String(form.address || '').trim(),
    gstin: String(form.gstin || '').trim().toUpperCase(),
    state: String(form.state || '').trim(),
    buyer_email: String(form.buyer_email || '').trim(),
    valid_days: Math.max(1, Number(form.valid_days) || 30),
    freight: money2(form.freight),
    packing: money2(form.packing),
    charges_gst_rate: money2(form.charges_gst_rate, 18),
    lines: (form.lines || []).map((ln, i) => ({
      position: i + 1,
      kind: ln.kind || 'service',
      item: String(ln.item || '').trim(),
      specification: String(ln.specification || '').trim(),
      hsn_sac: String(ln.hsn_sac || '').trim(),
      uom: normalizeUom(ln.uom),
      qty: money2(ln.qty, 1),
      unit_price: money2(ln.unit_price),
      discount_percent: money2(ln.discount_percent),
      gst_rate: money2(ln.gst_rate, 18),
    })),
    patient: String(form.patient || ''),
  }
  if (form.notes != null) body.notes = String(form.notes).trim()
  return body
}

/** GET /api/billing/quotes/ */
export const fetchBillingQuotes = async (
  tenantSlug,
  { status, search, bookingEntity, company, ordering, page = 1, pageSize = 50 } = {},
) => {
  const { data } = await api.get('api/billing/quotes/', {
    params: cleanParams({
      page,
      page_size: pageSize,
      status: status?.toLowerCase(),
      search,
      booking_entity: bookingEntity,
      company,
      ordering,
    }),
    ...tenantOpts(tenantSlug),
  })
  return listResult(data, normalizeBillingQuote)
}

/** GET /api/billing/quotes/:id/ */
export const fetchBillingQuote = async (tenantSlug, quoteId) => {
  const id = requireId(quoteId, 'Quote')
  const { data } = await api.get(`api/billing/quotes/${id}/`, tenantOpts(tenantSlug))
  return normalizeBillingQuote(unwrap(data))
}

/** POST /api/billing/quotes/ */
export const createBillingQuote = async (tenantSlug, form) => {
  const { data } = await api.post('api/billing/quotes/', buildBillingQuoteBody(form), tenantOpts(tenantSlug))
  return normalizeBillingQuote(unwrap(data))
}

/** PATCH /api/billing/quotes/:id/ — full create-shaped body */
export const updateBillingQuote = async (tenantSlug, quoteId, form) => {
  const id = requireId(quoteId, 'Quote')
  const { data } = await api.patch(
    `api/billing/quotes/${id}/`,
    buildBillingQuoteBody(form),
    tenantOpts(tenantSlug),
  )
  return normalizeBillingQuote(unwrap(data))
}

/** DELETE /api/billing/quotes/:id/ */
export const deleteBillingQuote = async (tenantSlug, quoteId) => {
  const id = requireId(quoteId, 'Quote')
  await api.delete(`api/billing/quotes/${id}/`, tenantOpts(tenantSlug))
  return { id }
}

const quoteAction = async (tenantSlug, quoteId, action, body = {}) => {
  const id = requireId(quoteId, 'Quote')
  const { data } = await api.post(`api/billing/quotes/${id}/${action}/`, body, tenantOpts(tenantSlug))
  return unwrap(data)
}

export const sendBillingQuote = (slug, id) => quoteAction(slug, id, 'send')
export const sendBillingQuoteTest = (slug, id, recipients) =>
  quoteAction(slug, id, 'send_test', { recipients: parseEmails(recipients) })
export const reviseBillingQuote = (slug, id) => quoteAction(slug, id, 'revise')
export const recalculateBillingQuote = (slug, id) => quoteAction(slug, id, 'recalculate')
export const convertBillingQuoteToInvoice = (slug, id, issueNow = false) =>
  quoteAction(slug, id, 'convert_to_invoice', { issue_now: Boolean(issueNow) })

/* ---------- Invoices ---------- */

export const INVOICE_TYPE_TAGS = ['STANDARD', 'PROFORMA']
export const INVOICE_LINE_TYPES = ['service', 'product', 'custom']
export const PAYMENT_METHODS = ['UPI', 'CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']

const normalizeInvoiceItem = (it = {}, i = 0) => ({
  key: `it-${it.id ?? i}-${i}`,
  line_type: String(it.line_type || 'service').toLowerCase(),
  description: it.description || '',
  hsn_sac: it.hsn_sac || '',
  quantity: it.quantity ?? '1',
  uom: normalizeUom(it.uom),
  unit_price: it.unit_price ?? '0',
  discount_percent: it.discount_percent ?? '0',
  gst_rate: it.gst_rate ?? '18',
})

export const normalizeBillingInvoice = (row = {}) => ({
  ...row,
  id: String(row.id ?? ''),
  number: row.number || row.invoice_number || `Invoice #${row.id ?? ''}`,
  status: String(row.status || 'DRAFT').toUpperCase(),
  invoice_type_tag: String(row.invoice_type_tag || 'STANDARD').toUpperCase(),
  booking_entity: String(row.booking_entity || 'SERVICE').toUpperCase(),
  service: idOf(row.service),
  patient: idOf(row.patient),
  patient_name: row.patient_name || '',
  customer_name: row.customer_name || '',
  attention: row.attention || '',
  address: row.address || '',
  buyer_email: row.buyer_email || '',
  gstin: String(row.gstin || '').toUpperCase(),
  state: row.state || '',
  due_days: num(row.due_days) ?? 15,
  currency: row.currency || 'INR',
  notes: row.notes || '',
  total: num(row.total ?? row.grand_total),
  amount_paid: num(row.amount_paid),
  balance_due: num(row.balance_due ?? row.amount_due),
  due_date: row.due_date || '',
  created_at: row.created_at || '',
  items: Array.isArray(row.items) ? row.items.map(normalizeInvoiceItem) : [],
})

export const buildBillingInvoiceBody = (form = {}) => {
  const body = {
    invoice_type_tag: String(form.invoice_type_tag || 'STANDARD'),
    booking_entity: String(form.booking_entity || 'SERVICE'),
    service: String(form.service || ''),
    patient: String(form.patient || ''),
    customer_name: String(form.customer_name || '').trim(),
    attention: String(form.attention || '').trim(),
    address: String(form.address || '').trim(),
    buyer_email: String(form.buyer_email || '').trim(),
    gstin: String(form.gstin || '').trim().toUpperCase(),
    state: String(form.state || '').trim(),
    due_days: Math.max(0, Number(form.due_days) || 0),
    currency: String(form.currency || 'INR').trim() || 'INR',
    items: (form.items || []).map((it, i) => ({
      position: i + 1,
      line_type: it.line_type || 'service',
      description: String(it.description || '').trim(),
      hsn_sac: String(it.hsn_sac || '').trim(),
      quantity: money2(it.quantity, 1),
      uom: normalizeUom(it.uom),
      unit_price: money2(it.unit_price),
      discount_percent: money2(it.discount_percent),
      gst_rate: money2(it.gst_rate, 18),
    })),
  }
  if (form.notes != null) body.notes = String(form.notes).trim()
  return body
}

/** GET /api/billing/invoices/ */
export const fetchBillingInvoices = async (tenantSlug, { status, search, page = 1, pageSize = 50 } = {}) => {
  const { data } = await api.get('api/billing/invoices/', {
    params: cleanParams({ page, page_size: pageSize, status, search }),
    ...tenantOpts(tenantSlug),
  })
  return listResult(data, normalizeBillingInvoice)
}

/** GET /api/billing/invoices/:id/ */
export const fetchBillingInvoice = async (tenantSlug, invoiceId) => {
  const id = requireId(invoiceId, 'Invoice')
  const { data } = await api.get(`api/billing/invoices/${id}/`, tenantOpts(tenantSlug))
  return normalizeBillingInvoice(unwrap(data))
}

/** POST /api/billing/invoices/ */
export const createBillingInvoice = async (tenantSlug, form) => {
  const { data } = await api.post(
    'api/billing/invoices/',
    buildBillingInvoiceBody(form),
    tenantOpts(tenantSlug),
  )
  return normalizeBillingInvoice(unwrap(data))
}

/** PATCH /api/billing/invoices/:id/ — full create-shaped body */
export const updateBillingInvoice = async (tenantSlug, invoiceId, form) => {
  const id = requireId(invoiceId, 'Invoice')
  const { data } = await api.patch(
    `api/billing/invoices/${id}/`,
    buildBillingInvoiceBody(form),
    tenantOpts(tenantSlug),
  )
  return normalizeBillingInvoice(unwrap(data))
}

/** DELETE /api/billing/invoices/:id/ */
export const deleteBillingInvoice = async (tenantSlug, invoiceId) => {
  const id = requireId(invoiceId, 'Invoice')
  await api.delete(`api/billing/invoices/${id}/`, tenantOpts(tenantSlug))
  return { id }
}

const invoiceAction = async (tenantSlug, invoiceId, action, body = {}) => {
  const id = requireId(invoiceId, 'Invoice')
  const { data } = await api.post(`api/billing/invoices/${id}/${action}/`, body, tenantOpts(tenantSlug))
  return unwrap(data)
}

export const issueBillingInvoice = (slug, id) => invoiceAction(slug, id, 'issue')
export const voidBillingInvoice = (slug, id) => invoiceAction(slug, id, 'void')
export const recalculateBillingInvoice = (slug, id) => invoiceAction(slug, id, 'recalculate')
export const sendBillingInvoiceEmail = (slug, id, recipients) =>
  invoiceAction(slug, id, 'send_email', { recipients: parseEmails(recipients) })
export const recordBillingInvoicePayment = (slug, id, { amount, method, reference }) =>
  invoiceAction(slug, id, 'record-payment', {
    amount: money2(amount),
    method: String(method || 'UPI'),
    reference: String(reference || '').trim(),
  })

/* ---------- Payments ---------- */

export const MAPPING_STATUSES = ['AUTO_MAPPED', 'MANUAL', 'UNMAPPED']

export const normalizeBillingPayment = (row = {}) => ({
  ...row,
  id: String(row.id ?? ''),
  invoice: idOf(row.invoice),
  invoice_number: row.invoice_number || row.invoice?.number || '',
  patient: idOf(row.patient),
  patient_name: row.patient_name || '',
  amount: row.amount ?? '0',
  currency: row.currency || 'INR',
  method: String(row.method || 'UPI').toUpperCase(),
  gateway: row.gateway || '',
  reference: row.reference || '',
  mapping_status: String(row.mapping_status || '').toUpperCase(),
  is_verified: Boolean(row.is_verified),
  paid_at: row.paid_at || row.created_at || '',
})

export const buildBillingPaymentBody = (form = {}) => {
  const body = {
    invoice: String(form.invoice || ''),
    patient: String(form.patient || ''),
    amount: money2(form.amount),
    currency: String(form.currency || 'INR').trim() || 'INR',
    method: String(form.method || 'UPI'),
    gateway: String(form.gateway || '').trim(),
  }
  if (form.mapping_status) body.mapping_status = form.mapping_status
  return body
}

/** GET /api/billing/payments/ */
export const fetchBillingPayments = async (
  tenantSlug,
  { method, isVerified, mappingStatus, search, ordering, page = 1, pageSize = 50 } = {},
) => {
  const { data } = await api.get('api/billing/payments/', {
    params: cleanParams({
      page,
      page_size: pageSize,
      method,
      is_verified: isVerified,
      mapping_status: mappingStatus,
      search,
      ordering,
    }),
    ...tenantOpts(tenantSlug),
  })
  return listResult(data, normalizeBillingPayment)
}

/** POST /api/billing/payments/ */
export const createBillingPayment = async (tenantSlug, form) => {
  const { data } = await api.post(
    'api/billing/payments/',
    buildBillingPaymentBody(form),
    tenantOpts(tenantSlug),
  )
  return normalizeBillingPayment(unwrap(data))
}

/** PATCH /api/billing/payments/:id/ — full create-shaped body */
export const updateBillingPayment = async (tenantSlug, paymentId, form) => {
  const id = requireId(paymentId, 'Payment')
  const { data } = await api.patch(
    `api/billing/payments/${id}/`,
    buildBillingPaymentBody(form),
    tenantOpts(tenantSlug),
  )
  return normalizeBillingPayment(unwrap(data))
}

/** DELETE /api/billing/payments/:id/ */
export const deleteBillingPayment = async (tenantSlug, paymentId) => {
  const id = requireId(paymentId, 'Payment')
  await api.delete(`api/billing/payments/${id}/`, tenantOpts(tenantSlug))
  return { id }
}

export const verifyBillingPayment = async (tenantSlug, paymentId, verified = true) => {
  const id = requireId(paymentId, 'Payment')
  const { data } = await api.post(
    `api/billing/payments/${id}/${verified ? 'verify' : 'unverify'}/`,
    {},
    tenantOpts(tenantSlug),
  )
  return unwrap(data)
}
