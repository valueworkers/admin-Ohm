import api from './axiosClient'
import { isManPowerLine, normalizeLineKind, normalizeUom } from '../features/billing/gstLines'
import { IN_STATES } from '../features/quotes/states'

const asList = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.data)) return data.data
  return []
}

const money2 = (value, fallback = 0) => {
  const n = Number(value)
  return (Number.isFinite(n) ? n : fallback).toFixed(2)
}

const relatedName = (value) => {
  if (value == null) return ''
  if (typeof value !== 'object') return String(value)
  return value.name || value.full_name || value.invoice_number || ''
}

/** UI line category → API `line_type`. */
const lineTypeForApi = (line = {}) => {
  const kind = normalizeLineKind(line.category || line.kind || line.line_type)
  if (kind === 'catalog') return 'catalog'
  if (kind === 'service_visit') return 'service_visit'
  if (kind === 'manpower') return 'manpower'
  return 'custom_service'
}

const num = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const lineTypeToCategory = (raw) => {
  const v = String(raw || '').trim().toLowerCase()
  if (v === 'catalog' || v === 'stocked') return 'catalog'
  if (v === 'service_visit' || v === 'service') return 'service_visit'
  if (v === 'manpower' || v === 'on_request') return 'manpower'
  if (v === 'custom_service' || v === 'custom') return 'custom'
  return 'custom'
}

export const normalizeInvoiceLine = (line = {}, index = 0) => {
  const category = lineTypeToCategory(line.line_type || line.category || line.kind)
  return {
    id: String(line.id ?? `ln-${index + 1}`),
    position: line.position ?? index + 1,
    category,
    kind: category,
    lineType: line.line_type || category,
    item: line.description || line.item || '',
    description: line.description || line.item || '',
    hsn: line.hsn_sac || line.hsn || '',
    specification: line.specification || '',
    qty: num(line.quantity ?? line.qty) ?? 1,
    uom: normalizeUom(line.uom),
    unitPrice: num(line.unit_price ?? line.unitPrice) ?? 0,
    discountPct: num(line.discount_percent ?? line.discountPct) ?? 0,
    discountAmount: num(line.discount_amount) ?? 0,
    leadTime: String(line.lead_time ?? line.leadTime ?? ''),
    gstRate: num(line.gst_rate ?? line.gstRate),
    taxable: num(line.taxable_value ?? line.taxable) ?? 0,
    cgst: num(line.cgst_amount ?? line.cgst) ?? 0,
    sgst: num(line.sgst_amount ?? line.sgst) ?? 0,
    igst: num(line.igst_amount ?? line.igst) ?? 0,
    lineTotal: num(line.amount ?? line.line_total ?? line.lineTotal) ?? 0,
    onRequest: category === 'manpower',
  }
}

export const normalizeInvoice = (row = {}) => {
  const amount = num(row.amount ?? row.total_amount ?? row.grand_total ?? row.total)
  const received = num(
    row.received ?? row.amount_received ?? row.amount_paid ?? row.paid_amount,
  )
  const owed =
    num(row.owed ?? row.balance_due) ??
    (amount != null && received != null ? amount - received : null)

  const rawNumber = row.number ?? row.invoice_number ?? row.invoice_no
  const number =
    rawNumber != null && String(rawNumber).trim()
      ? String(rawNumber).trim()
      : row.id != null
        ? `Draft #${row.id}`
        : '—'

  const issueDate =
    row.issue_date ||
    row.date ||
    row.invoice_date ||
    String(row.created_at || '').slice(0, 10) ||
    null

  const issuer = row.issuer && typeof row.issuer === 'object' ? row.issuer : {}
  const items = Array.isArray(row.items)
    ? row.items
    : Array.isArray(row.lines)
      ? row.lines
      : []
  const lines = items.map(normalizeInvoiceLine)

  const subtotal = num(row.subtotal)
  const cgstTotal = num(row.cgst_amount ?? row.cgstTotal ?? row.cgst)
  const sgstTotal = num(row.sgst_amount ?? row.sgstTotal ?? row.sgst)
  const igstTotal = num(row.igst_amount ?? row.igstTotal ?? row.igst)
  const gstAmount =
    num(row.tax_amount ?? row.gstAmount) ??
    ((cgstTotal || 0) + (sgstTotal || 0) + (igstTotal || 0) || null)

  const stateCode =
    String(row.state_code || '').trim() ||
    IN_STATES.find(
      (s) => s.name.toLowerCase() === String(row.state || '').trim().toLowerCase(),
    )?.code ||
    ''

  return {
    ...row,
    id: row.id != null ? String(row.id) : row.id,
    number,
    numberRaw: rawNumber != null ? String(rawNumber).trim() : '',
    date: issueDate,
    issueDate,
    dueDate: row.due_date || row.dueDate || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    currency: row.currency || 'INR',
    yourRef: row.your_ref || row.yourRef || '',
    bookingRef:
      row.bookingRef ||
      row.booking_ref ||
      row.booking_reference ||
      relatedName(row.booking) ||
      '',
    payerName:
      row.payerName ||
      row.payer_name ||
      row.customer_name ||
      relatedName(row.payer) ||
      relatedName(row.customer) ||
      '',
    clientName:
      row.clientName || row.client_name || row.company || row.customer_name || '',
    customerName: row.customer_name || row.clientName || row.company || '',
    patientName: row.patientName || row.patient_name || '',
    tenantId: row.tenant != null ? String(row.tenant) : null,
    tenantName: row.tenant_name || row.tenantName || relatedName(row.tenant) || '',
    venue: row.venue || '',
    attention: row.attention || '',
    address: row.address || '',
    shipTo: row.ship_to || row.shipTo || '',
    state: row.state || '',
    stateCode,
    isInterstate: Boolean(row.is_interstate),
    gstin: String(row.gstin || '').trim().toUpperCase(),
    buyerEmail: row.buyer_email || row.email || '',
    email: row.buyer_email || row.email || '',
    ccEmails: Array.isArray(row.cc_emails)
      ? row.cc_emails.join(', ')
      : String(row.cc_emails || row.ccEmails || ''),
    bccEmails: Array.isArray(row.bcc_emails)
      ? row.bcc_emails.join(', ')
      : String(row.bcc_emails || row.bccEmails || ''),
    notes: row.notes || row.note || '',
    note: row.notes || row.note || '',
    terms: row.terms || '',
    dueDays: Number(row.due_days) || undefined,
    periodStart: row.period_start || null,
    periodEnd: row.period_end || null,
    amount,
    received: received ?? 0,
    owed: owed ?? 0,
    subtotal,
    discount: num(row.discount) ?? 0,
    cgstTotal: cgstTotal ?? 0,
    sgstTotal: sgstTotal ?? 0,
    igstTotal: igstTotal ?? 0,
    gstAmount: gstAmount ?? 0,
    lines,
    payments: Array.isArray(row.payments) ? row.payments : [],
    pdf: row.pdf || null,
    quotationId: row.quotation != null ? String(row.quotation) : null,
    subscriptionId: row.subscription != null ? String(row.subscription) : null,
    sellerName: issuer.company_name || row.sellerName || 'O-HM Senior Care',
    sellerAddress: issuer.company_address || row.sellerAddress || '',
    sellerPhone: issuer.company_phone || row.sellerPhone || '',
    sellerGstin: issuer.gstin || row.sellerGstin || '',
    sellerState: issuer.state || '',
    logoUrl: issuer.logo || row.logoUrl || '',
    contactName: issuer.contact_name || row.contactName || '',
    contactPhone: issuer.contact_phone || row.contactPhone || '',
    contactEmail: issuer.contact_email || row.contactEmail || 'support@o-hm.com',
    status: String(row.status || 'draft').trim().toUpperCase() || 'DRAFT',
    kind: row.kind || 'invoice',
  }
}

const parseEmails = (raw) => {
  if (Array.isArray(raw)) {
    return raw.map((e) => String(e || '').trim().toLowerCase()).filter(Boolean)
  }
  return String(raw || '')
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Build POST/PATCH /api/platform/invoices/ body.
 * customer_name, attention, address, buyer_email, gstin, state, due_days,
 * notes, items[{ line_type, description, hsn_sac, specification, quantity,
 * uom, unit_price, discount_percent, gst_rate }]
 * Optional: terms, your_ref, ship_to, cc/bcc_emails, status.
 */
export const buildPlatformInvoicePayload = (form = {}, { status } = {}) => {
  const stateCode = String(form.stateCode || '').trim()
  const stateName =
    IN_STATES.find((s) => s.code === stateCode)?.name ||
    String(form.state || '').trim() ||
    (stateCode && !/^\d{2}$/.test(stateCode) ? stateCode : '') ||
    ''

  const items = (Array.isArray(form.lines) ? form.lines : []).map((ln) => {
    const onReq = isManPowerLine(ln)
    const qty = Number(ln.qty)
    const unit = onReq ? 0 : Number(ln.unitPrice)
    const rawGst = ln.gstRate
    let gst = 18
    if (rawGst === 'na' || rawGst === 'NA') gst = 0
    else if (rawGst === '' || rawGst == null) gst = 18
    else {
      const n = Number(rawGst)
      gst = Number.isFinite(n) ? n : 18
    }
    const disc = Number(ln.discountPct)
    return {
      line_type: lineTypeForApi(ln),
      description: String(ln.item || ln.description || '').trim(),
      hsn_sac: String(ln.hsn || ln.hsn_sac || '').trim(),
      specification: String(ln.specification || '').trim(),
      quantity: Number.isFinite(qty) ? qty : 0,
      uom: normalizeUom(ln.uom),
      unit_price: money2(unit, 0),
      discount_percent: money2(
        Number.isFinite(disc) ? Math.max(0, Math.min(100, disc)) : 0,
        0,
      ),
      gst_rate: money2(gst, 18),
    }
  })

  const body = {
    customer_name: String(form.company || form.customer_name || '').trim(),
    attention: String(form.attention || '').trim(),
    address: String(form.address || '').trim(),
    buyer_email: String(form.buyerEmail || form.buyer_email || '').trim(),
    gstin: String(form.gstin || '').trim().toUpperCase(),
    state: stateName,
    due_days: Math.max(0, Math.min(3650, Number(form.dueDays ?? form.due_days) || 15)),
    ship_to:
      String(form.shipTo || form.ship_to || '').trim() ||
      String(form.address || '').trim(),
    your_ref: String(form.yourRef || form.your_ref || '').trim(),
    cc_emails: parseEmails(form.ccEmails ?? form.cc_emails),
    bcc_emails: parseEmails(form.bccEmails ?? form.bcc_emails),
    terms: String(form.terms || '').trim(),
    items,
    notes: String(form.notes || '').trim(),
  }
  const statusVal = String(status || form.status || '')
    .trim()
    .toLowerCase()
  if (statusVal) body.status = statusVal
  return body
}

/** GET /api/platform/invoices/ — list platform invoices. */
export const fetchInvoices = async () => {
  const { data } = await api.get('api/platform/invoices/')
  return asList(data).map(normalizeInvoice)
}

/** GET /api/platform/invoices/:id/ — invoice detail. */
export const fetchPlatformInvoiceById = async (invoiceId) => {
  const id = String(invoiceId || '').trim()
  if (!id) throw new Error('Invoice id is required.')
  const { data } = await api.get(`api/platform/invoices/${id}/`)
  const row = data?.data || data?.invoice || data
  return normalizeInvoice(row)
}

/** POST /api/platform/invoices/ — create platform invoice. */
export const createPlatformInvoice = async (form, options = {}) => {
  const body = buildPlatformInvoicePayload(form, options)
  const { data } = await api.post('api/platform/invoices/', body)
  const row = data?.data || data?.invoice || data
  return normalizeInvoice(row)
}

/** PATCH /api/platform/invoices/:id/ — update draft platform invoice. */
export const updatePlatformInvoice = async (invoiceId, form, options = {}) => {
  const id = String(invoiceId || '').trim()
  if (!id) throw new Error('Invoice id is required.')
  const body = buildPlatformInvoicePayload(form, options)
  const { data } = await api.patch(`api/platform/invoices/${id}/`, body)
  const row = data?.data || data?.invoice || data
  return normalizeInvoice(row)
}

/** POST /api/platform/invoices/:id/raise/ — raise (issue) a draft invoice. */
export const raisePlatformInvoice = async (invoiceId) => {
  const id = String(invoiceId || '').trim()
  if (!id) throw new Error('Invoice id is required.')
  const { data } = await api.post(`api/platform/invoices/${id}/raise/`, {})
  const row = data?.data || data?.invoice || data
  if (row && (row.id != null || row.number != null)) {
    return normalizeInvoice(row)
  }
  return fetchPlatformInvoiceById(id)
}

/** GET /api/platform/invoices/:id/pdf/ — download invoice PDF. */
export const downloadPlatformInvoicePdf = async (invoiceId) => {
  const id = String(invoiceId || '').trim()
  if (!id) throw new Error('Invoice id is required.')
  const response = await api.get(`api/platform/invoices/${id}/pdf/`, {
    responseType: 'blob',
  })
  const blob = response.data
  const disposition = String(response.headers?.['content-disposition'] || '')
  const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i)
  const filename = match
    ? decodeURIComponent(match[1].replace(/"/g, '').trim())
    : `invoice-${id}.pdf`
  return { blob, filename }
}

/** DELETE /api/platform/invoices/:id/ — delete invoice. */
export const deletePlatformInvoice = async (invoiceId) => {
  const id = String(invoiceId || '').trim()
  if (!id) throw new Error('Invoice id is required.')
  await api.delete(`api/platform/invoices/${id}/`)
  return { id }
}
