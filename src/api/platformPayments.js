import api from './axiosClient'

const asList = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.data?.results)) return data.data.results
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.payments)) return data.payments
  return []
}

const num = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const relatedId = (value) => {
  if (value == null) return ''
  if (typeof value === 'object') {
    return String(value.id ?? value.pk ?? value.uuid ?? '')
  }
  return String(value)
}

const relatedName = (value) => {
  if (value == null) return ''
  if (typeof value === 'object') {
    return String(value.name || value.number || value.invoice_number || value.full_name || '')
  }
  return String(value)
}

/** UI / API status → display uppercase. */
export const normalizePaymentStatus = (raw) => {
  const s = String(raw || '').trim().toLowerCase()
  if (s === 'success' || s === 'succeeded' || s === 'paid') return 'SUCCEEDED'
  if (s === 'pending' || s === 'processing') return 'PENDING'
  if (s === 'failed' || s === 'failure') return 'FAILED'
  if (s === 'cancelled' || s === 'canceled') return 'CANCELLED'
  return String(raw || 'PENDING').trim().toUpperCase() || 'PENDING'
}

/** Display / form status → API status string. */
export const statusForApi = (raw) => {
  const s = normalizePaymentStatus(raw)
  if (s === 'SUCCEEDED' || s === 'SUCCESS') return 'succeeded'
  if (s === 'FAILED') return 'failed'
  if (s === 'CANCELLED') return 'cancelled'
  return 'pending'
}

/** UI mode label → API method. */
export const methodForApi = (raw) => {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
  if (s === 'bank_transfer' || s === 'bank-transfer') return 'bank_transfer'
  if (s === 'neft') return 'neft'
  if (s === 'imps') return 'imps'
  if (s === 'upi') return 'upi'
  if (s === 'card') return 'card'
  if (s === 'cash') return 'cash'
  if (s === 'cheque' || s === 'check') return 'cheque'
  return s || 'bank_transfer'
}

export const methodLabel = (raw) => {
  const s = String(raw || '').trim().toLowerCase()
  if (s === 'bank_transfer') return 'Bank transfer'
  if (s === 'neft') return 'NEFT'
  if (s === 'imps') return 'IMPS'
  if (s === 'upi') return 'UPI'
  if (s === 'card') return 'Card'
  if (s === 'cash') return 'Cash'
  if (s === 'cheque' || s === 'check') return 'Cheque'
  return String(raw || '—').replace(/_/g, ' ')
}

/** Map platform payment API row → UI shape. No X-Tenant. */
export const normalizePlatformPayment = (row = {}) => {
  const id = String(row.id ?? row.platformPaymentId ?? row.platform_payment_id ?? '')
  const tenantObj = row.tenant && typeof row.tenant === 'object' ? row.tenant : null
  const invoiceObj = row.invoice && typeof row.invoice === 'object' ? row.invoice : null
  const invoiceId = relatedId(row.invoice ?? row.invoice_id)
  const invoiceNumber =
    row.invoice_number ||
    row.invoiceNumber ||
    (invoiceObj ? relatedName(invoiceObj) : '') ||
    ''

  return {
    id,
    platformPaymentId: id,
    ref: String(row.reference || row.ref || row.payment_id || (id ? `PAY-${id}` : '')),
    tenantId: relatedId(row.tenant ?? row.tenant_id),
    tenantName:
      row.tenant_name ||
      row.tenantName ||
      (tenantObj ? relatedName(tenantObj) : '') ||
      '',
    invoiceId: invoiceId || null,
    invoiceNumber: invoiceNumber || null,
    amount: num(row.amount),
    currency: String(row.currency || 'INR').toUpperCase(),
    method: String(row.method || row.mode || ''),
    mode: methodLabel(row.method || row.mode),
    status: normalizePaymentStatus(row.status),
    paidAt: row.paid_at || row.paidAt || null,
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
    notes: String(row.notes || ''),
    raw: row,
  }
}

export const buildPaymentBody = (payload = {}) => ({
  tenant: String(payload.tenant || payload.tenantId || '').trim(),
  invoice: String(payload.invoice || payload.invoiceId || '').trim(),
  amount: String(
    payload.amount != null && payload.amount !== '' ? Number(payload.amount).toFixed(2) : '0.00',
  ),
  currency: String(payload.currency || 'INR').trim().toUpperCase() || 'INR',
  method: methodForApi(payload.method || payload.mode),
  status: statusForApi(payload.status),
  reference: String(payload.reference || payload.ref || payload.bankRef || '').trim(),
  paid_at: String(payload.paidAt || payload.paid_at || '').trim(),
})

/** GET /api/platform/payments/ */
export const fetchPlatformPayments = async ({
  tenant,
  status,
  page = 1,
  pageSize = 100,
} = {}) => {
  const params = { page, page_size: pageSize }
  if (tenant) params.tenant = tenant
  if (status) params.status = statusForApi(status)

  const { data } = await api.get('api/platform/payments/', { params })
  const rows = asList(data).map(normalizePlatformPayment)
  return {
    count: Number(data?.count) || rows.length,
    next: data?.next ?? null,
    previous: data?.previous ?? null,
    results: rows,
  }
}

/** GET /api/platform/payments/:id/ */
export const fetchPlatformPaymentById = async (paymentId) => {
  const id = String(paymentId || '').trim()
  if (!id) throw new Error('Payment id is required.')
  const { data } = await api.get(`api/platform/payments/${id}/`)
  const row = data?.data || data?.payment || data
  return normalizePlatformPayment(row)
}

/** POST /api/platform/payments/ */
export const createPlatformPayment = async (payload) => {
  const { data } = await api.post('api/platform/payments/', buildPaymentBody(payload))
  const row = data?.data || data?.payment || data
  return normalizePlatformPayment(row)
}

/** PATCH /api/platform/payments/:id/ — same fields as POST payload */
export const updatePlatformPayment = async (paymentId, payload = {}) => {
  const id = String(paymentId || '').trim()
  if (!id) throw new Error('Payment id is required.')
  const { data } = await api.patch(`api/platform/payments/${id}/`, buildPaymentBody(payload))
  const row = data?.data || data?.payment || data
  return normalizePlatformPayment(row)
}

/** DELETE /api/platform/payments/:id/ */
export const deletePlatformPayment = async (paymentId) => {
  const id = String(paymentId || '').trim()
  if (!id) throw new Error('Payment id is required.')
  const { data } = await api.delete(`api/platform/payments/${id}/`)
  return data?.data || data || { id }
}
