import api from './axiosClient'
import { IN_STATES } from '../features/quotes/states'

const resolveStateCode = (state) => {
  const raw = String(state || '').trim()
  if (!raw) return ''
  if (/^\d{2}$/.test(raw)) return raw
  const byName = IN_STATES.find(
    (s) => s.name.toLowerCase() === raw.toLowerCase(),
  )
  return byName?.code || raw
}

const asList = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.data)) return data.data
  return []
}

const num = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const normalizeLine = (line = {}, index = 0) => ({
  id: String(line.id ?? `ln-${index + 1}`),
  item: line.item || '',
  hsn: line.hsn_sac || line.hsn || '',
  specification: line.specification || '',
  qty: num(line.qty) ?? 1,
  uom: String(line.uom || line.unit || 'Pcs').trim() || 'Pcs',
  unitPrice: num(line.unit_price) ?? 0,
  discountPct: num(line.discount_pct ?? line.discountPct) ?? 0,
  // API lead_time ↔ editor "Lead time" field
  leadTime: String(line.lead_time ?? line.leadTime ?? ''),
  category: line.kind || line.category || 'custom',
  onRequest: Boolean(line.on_request),
  gstRate: num(line.gst_rate),
  plan: line.plan ?? null,
  position: line.position ?? index + 1,
})

const normalizeEvent = (event = {}) => ({
  type: event.kind || event.type || 'created',
  at: event.at || '',
  by: event.actor != null ? String(event.actor) : event.by || '',
  detail: event.detail || '',
  to: event.to || undefined,
})

const personLabel = (value) => {
  if (value == null || value === '') return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value !== 'object') return ''
  const name = [value.first_name, value.last_name].filter(Boolean).join(' ').trim()
  return (
    name ||
    value.full_name ||
    value.name ||
    value.email ||
    value.username ||
    (value.id != null ? String(value.id) : '')
  )
}

const createdByFromEvents = (events = []) => {
  const created = events.find((e) => String(e.kind || e.type || '').toLowerCase() === 'created')
  if (!created) return ''
  if (created.actor_name || created.actor_email) {
    return created.actor_name || created.actor_email
  }
  return personLabel(created.actor) || personLabel(created.by)
}

/** Map platform quote API row → UI / editor shape. */
export const normalizePlatformQuote = (row = {}) => {
  const revision = Number(row.revision) || 0
  const number = String(row.number || '').trim()
  const total = num(row.total)
  const status = String(row.status || 'draft').trim().toUpperCase() || 'DRAFT'
  const events = Array.isArray(row.events) ? row.events : []

  return {
    id: String(row.id ?? ''),
    groupId: row.group_id || (row.id != null ? `qg-${row.id}` : ''),
    revision,
    numberRaw: number,
    number: number ? `${number} R${revision}` : row.id != null ? `Quote #${row.id}` : '—',
    forName: row.company || '—',
    customer: row.company || row.customer || row.customer_name || '—',
    status,
    date: row.quote_date || String(row.created_at || '').slice(0, 10),
    createdAt: row.created_at || row.created_date || null,
    lastModifiedAt:
      row.updated_at ||
      row.modified_at ||
      row.last_modified_at ||
      row.last_modified ||
      null,
    createdBy:
      personLabel(row.created_by) ||
      personLabel(row.created_by_name) ||
      personLabel(row.creator) ||
      createdByFromEvents(events) ||
      '—',
    validFrom: row.valid_from || row.quote_date || String(row.created_at || '').slice(0, 10) || '',
    validUntil: row.valid_until || '',
    assignTo:
      personLabel(row.assigned_to) ||
      personLabel(row.assign_to) ||
      personLabel(row.assignee) ||
      personLabel(row.assigned_to_name) ||
      '—',
    totalInclGst: total,
    gstSet: total != null,
    sentAt: row.sent_at || null,
    acceptedAt: row.accepted_at || null,
    history: events.map(normalizeEvent),
    payload: {
      company: row.company || '',
      legalName: row.legal_name || row.legalName || '',
      attention: row.attention || '',
      address: row.address || '',
      gstin: row.gstin || '',
      stateCode: resolveStateCode(row.state),
      buyerEmail: row.buyer_email || '',
      ccEmails: Array.isArray(row.cc_emails)
        ? row.cc_emails.join(', ')
        : String(row.cc_emails || row.cc || ''),
      bccEmails: Array.isArray(row.bcc_emails)
        ? row.bcc_emails.join(', ')
        : String(row.bcc_emails || row.bcc || ''),
      shipTo: row.ship_to || '',
      yourRef: row.your_ref || '',
      quoteNumber: number || '',
      validityDays: num(row.valid_days) ?? 30,
      notes: row.notes || '',
      terms: row.terms || '',
      sellerName: row.seller_name || row.company_header_name || '',
      sellerAddress: row.seller_address || row.company_header_address || '',
      sellerPhone: row.seller_phone || row.company_header_phone || '',
      sellerGstin: row.seller_gstin || '',
      logoUrl: row.logo_url || row.seller_logo || '',
      contactName: row.contact_name || 'O-HM Senior Care',
      contactPhone: row.contact_phone || '',
      contactEmail: row.contact_email || 'support@o-hm.com',
      lines: Array.isArray(row.lines) ? row.lines.map(normalizeLine) : [],
      subtotal: num(row.subtotal),
      cgst: num(row.cgst),
      sgst: num(row.sgst),
      igst: num(row.igst),
      freight: num(row.freight),
      total,
    },
  }
}

/** GET /api/platform/quotes/ — Super Admin platform quotes list. */
export const fetchPlatformQuotes = async (params = {}) => {
  const { data } = await api.get('api/platform/quotes/', { params })
  const rows = asList(data).map(normalizePlatformQuote)
  return {
    count: Number(data?.count) || rows.length,
    next: data?.next ?? null,
    previous: data?.previous ?? null,
    results: rows,
  }
}

/** GET /api/platform/quotes/:id/ — Super Admin quote detail. */
export const fetchPlatformQuoteById = async (quoteId) => {
  const id = String(quoteId || '').trim()
  if (!id) throw new Error('Quote id is required.')
  const { data } = await api.get(`api/platform/quotes/${id}/`)
  const row = data?.data || data?.quote || data
  return normalizePlatformQuote(row)
}

/** Normalize GET /api/platform/quotes/stats/ */
export const normalizeQuoteStats = (row = {}) => {
  const winRaw = Number(row.win_rate)
  const winRate = Number.isFinite(winRaw) ? winRaw : 0
  return {
    open: Number(row.open) || 0,
    accepted: Number(row.accepted) || 0,
    rejected: Number(row.rejected) || 0,
    expired: Number(row.expired) || 0,
    pipeline: num(row.pipeline),
    winRate,
  }
}

/**
 * GET /api/platform/quotes/stats/?from=YYYY-MM-DD&to=YYYY-MM-DD
 * from = today minus N days, to = today (for 30/90/180/365 range chips).
 */
export const fetchPlatformQuoteStats = async ({ from, to } = {}) => {
  const { data } = await api.get('api/platform/quotes/stats/', {
    params: { from, to },
  })
  const row = data?.data || data?.stats || data
  return normalizeQuoteStats(row)
}

const lineKindForApi = (line = {}) => {
  const raw = String(line.category || line.kind || 'custom').toLowerCase()
  if (raw === 'on_request') return 'custom'
  if (raw === 'stocked' || raw === 'service' || raw === 'custom') return raw
  return 'custom'
}

/** Build POST /api/platform/quotes/ body from editor form. */
export const buildPlatformQuotePayload = (form = {}, { freight = 0 } = {}) => {
  const stateCode = String(form.stateCode || '').trim()
  const stateName =
    IN_STATES.find((s) => s.code === stateCode)?.name ||
    (stateCode && !/^\d{2}$/.test(stateCode) ? stateCode : '') ||
    ''

  const lines = (Array.isArray(form.lines) ? form.lines : []).map((ln) => {
    const onReq = Boolean(ln.onRequest) || ln.category === 'on_request'
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
      kind: lineKindForApi(ln),
      item: String(ln.item || '').trim(),
      specification: String(ln.specification || '').trim(),
      hsn_sac: String(ln.hsn || '').trim(),
      qty: (Number.isFinite(qty) ? qty : 0).toFixed(2),
      uom: String(ln.uom || 'Pcs').trim() || 'Pcs',
      unit_price: (Number.isFinite(unit) ? unit : 0).toFixed(2),
      discount_pct: (Number.isFinite(disc) ? Math.max(0, Math.min(100, disc)) : 0).toFixed(2),
      lead_time: String(ln.leadTime ?? ln.lead_time ?? '').trim(),
      gst_rate: gst.toFixed(2),
    }
  })

  const quoteNumber = String(form.quoteNumber || '').trim()
  const parseEmails = (raw) =>
    String(raw || '')
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)

  return {
    company: String(form.company || '').trim(),
    legal_name: String(form.legalName || '').trim(),
    attention: String(form.attention || '').trim(),
    address: String(form.address || '').trim(),
    gstin: String(form.gstin || '').trim().toUpperCase(),
    state: stateName,
    buyer_email: String(form.buyerEmail || '').trim(),
    cc_emails: parseEmails(form.ccEmails),
    bcc_emails: parseEmails(form.bccEmails),
    ship_to:
      String(form.shipTo || '').trim() || String(form.address || '').trim(),
    your_ref: String(form.yourRef || '').trim(),
    ...(quoteNumber ? { number: quoteNumber } : {}),
    valid_days: Math.max(1, Math.min(3650, Number(form.validityDays) || 30)),
    notes: String(form.notes || '').trim(),
    terms: String(form.terms || '').trim(),
    seller_name: String(form.sellerName || '').trim(),
    seller_address: String(form.sellerAddress || '').trim(),
    seller_phone: String(form.sellerPhone || '').trim(),
    seller_gstin: String(form.sellerGstin || '').trim().toUpperCase(),
    logo_url: String(form.logoUrl || '').trim(),
    contact_name: String(form.contactName || '').trim(),
    contact_phone: String(form.contactPhone || '').trim(),
    contact_email: String(form.contactEmail || '').trim(),
    freight: Number(freight) || 0,
    lines,
  }
}

/** POST /api/platform/quotes/ — create platform quote. */
export const createPlatformQuote = async (form, options = {}) => {
  const body = buildPlatformQuotePayload(form, options)
  const { data } = await api.post('api/platform/quotes/', body)
  const row = data?.data || data?.quote || data
  return normalizePlatformQuote(row)
}

/** PATCH /api/platform/quotes/:id/ — update draft platform quote. */
export const updatePlatformQuote = async (quoteId, form, options = {}) => {
  const id = String(quoteId || '').trim()
  if (!id) throw new Error('Quote id is required.')
  const body = buildPlatformQuotePayload(form, options)
  const { data } = await api.patch(`api/platform/quotes/${id}/`, body)
  const row = data?.data || data?.quote || data
  return normalizePlatformQuote(row)
}

const parseEmailList = (raw) => {
  if (Array.isArray(raw)) {
    return raw.map((e) => String(e || '').trim().toLowerCase()).filter(Boolean)
  }
  return String(raw || '')
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

/** POST /api/platform/quotes/:id/send/ — send quote email (optional cc / bcc). */
export const sendPlatformQuote = async (quoteId, { cc, bcc } = {}) => {
  const id = String(quoteId || '').trim()
  if (!id) throw new Error('Quote id is required.')
  const body = {
    cc_emails: parseEmailList(cc),
    bcc_emails: parseEmailList(bcc),
  }
  const { data } = await api.post(`api/platform/quotes/${id}/send/`, body)
  const row = data?.data || data?.quote || data
  if (row && (row.id != null || row.number)) {
    return normalizePlatformQuote(row)
  }
  return fetchPlatformQuoteById(id)
}

/**
 * POST /api/platform/quotes/:id/revise/
 * Creates/sends a revision of a sent quote. Body is {} (API contract).
 */
export const revisePlatformQuote = async (quoteId) => {
  const id = String(quoteId || '').trim()
  if (!id) throw new Error('Quote id is required.')
  const { data } = await api.post(`api/platform/quotes/${id}/revise/`, {})
  const row = data?.data || data?.quote || data
  if (row && (row.id != null || row.number)) {
    return normalizePlatformQuote(row)
  }
  return fetchPlatformQuoteById(id)
}

/** GET /api/platform/quotes/:id/pdf/ — download quote PDF. */
export const downloadPlatformQuotePdf = async (quoteId) => {
  const id = String(quoteId || '').trim()
  if (!id) throw new Error('Quote id is required.')
  const response = await api.get(`api/platform/quotes/${id}/pdf/`, {
    responseType: 'blob',
  })
  const blob = response.data
  const disposition = String(response.headers?.['content-disposition'] || '')
  const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i)
  const filename = match
    ? decodeURIComponent(match[1].replace(/"/g, '').trim())
    : `quote-${id}.pdf`
  return { blob, filename }
}

/** POST /api/platform/quotes/:id/send-test/ — send test email(s). */
export const sendPlatformQuoteTest = async (quoteId, recipients = []) => {
  const id = String(quoteId || '').trim()
  if (!id) throw new Error('Quote id is required.')
  const list = (Array.isArray(recipients) ? recipients : [])
    .map((e) => String(e || '').trim().toLowerCase())
    .filter(Boolean)
  if (!list.length) throw new Error('Add at least one recipient email.')
  const { data } = await api.post(`api/platform/quotes/${id}/send-test/`, {
    recipients: list,
  })
  return data?.data || data
}
