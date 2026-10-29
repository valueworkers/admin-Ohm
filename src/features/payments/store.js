const KEY = 'sc_payments_demo_v1'

/** Payments received by O-HM Senior Care from tenants (platform billing). */
export const DEMO_PAYMENTS = [
  {
    id: 'pay-1',
    ref: 'PAY-2610-014',
    tenantId: 'tenant-vaishnavi',
    tenantName: 'Vaishnavi Medicare',
    amount: 11798.82,
    currency: 'INR',
    status: 'SUCCESS',
    paidAt: '2026-10-26T14:22:00+05:30',
    receivedAt: '2026-10-26T14:22:08+05:30',
    mode: 'UPI',
    modeDetail: 'UPI · @vaishnavi@okaxis',
    gateway: 'Razorpay',
    gatewayTxnId: 'pay_RzpVaish261014',
    bankRef: 'AXIS261026UPI4421',
    invoiceNumber: '034/202627',
    invoiceId: 'inv-2',
    purpose: 'Platform subscription · Oct 2026',
    payerName: 'Priya Menon',
    payerEmail: 'owner@vaishnavi.com',
    notes: 'Auto-captured against subscription invoice.',
  },
  {
    id: 'pay-2',
    ref: 'PAY-2610-011',
    tenantId: 'tenant-careplus',
    tenantName: 'CarePlus Homes',
    amount: 25000,
    currency: 'INR',
    status: 'SUCCESS',
    paidAt: '2026-10-21T11:05:00+05:30',
    receivedAt: '2026-10-21T11:05:12+05:30',
    mode: 'NEFT',
    modeDetail: 'NEFT · CarePlus current a/c',
    gateway: 'Manual bank',
    gatewayTxnId: null,
    bankRef: 'HDFCNEFT2110268891',
    invoiceNumber: '031/202627',
    invoiceId: null,
    purpose: 'Partial payment · platform subscription',
    payerName: 'Rahul Desai',
    payerEmail: 'owner@careplus.com',
    notes: 'Tenant advance against Net 15 invoice.',
  },
  {
    id: 'pay-3',
    ref: 'PAY-2610-008',
    tenantId: 'tenant-vaishnavi',
    tenantName: 'Vaishnavi Medicare',
    amount: 4999,
    currency: 'INR',
    status: 'SUCCESS',
    paidAt: '2026-10-12T09:40:00+05:30',
    receivedAt: '2026-10-12T09:40:04+05:30',
    mode: 'Card',
    modeDetail: 'Visa · **** 4242',
    gateway: 'Razorpay',
    gatewayTxnId: 'pay_RzpVaish261008',
    bankRef: null,
    invoiceNumber: null,
    invoiceId: null,
    purpose: 'Onboarding fee',
    payerName: 'Priya Menon',
    payerEmail: 'owner@vaishnavi.com',
    notes: 'One-time onboarding collected at go-live.',
  },
  {
    id: 'pay-4',
    ref: 'PAY-2610-005',
    tenantId: 'tenant-careplus',
    tenantName: 'CarePlus Homes',
    amount: 9999,
    currency: 'INR',
    status: 'FAILED',
    paidAt: '2026-10-08T18:12:00+05:30',
    receivedAt: null,
    mode: 'UPI',
    modeDetail: 'UPI · timeout',
    gateway: 'Razorpay',
    gatewayTxnId: 'pay_RzpCpFail005',
    bankRef: null,
    invoiceNumber: null,
    invoiceId: null,
    purpose: 'Platform subscription · Oct 2026',
    payerName: 'Rahul Desai',
    payerEmail: 'owner@careplus.com',
    notes: 'Customer cancelled at bank page. Retried successfully later as PAY-2610-011 partial.',
  },
  {
    id: 'pay-5',
    ref: 'PAY-2609-031',
    tenantId: 'tenant-vaishnavi',
    tenantName: 'Vaishnavi Medicare',
    amount: 11798.82,
    currency: 'INR',
    status: 'SUCCESS',
    paidAt: '2026-09-28T16:01:00+05:30',
    receivedAt: '2026-09-28T16:01:06+05:30',
    mode: 'Bank transfer',
    modeDetail: 'IMPS · Vaishnavi ops',
    gateway: 'Manual bank',
    gatewayTxnId: null,
    bankRef: 'SBIIMPS2809267712',
    invoiceNumber: '028/202626',
    invoiceId: null,
    purpose: 'Platform subscription · Sep 2026',
    payerName: 'Anil Rao',
    payerEmail: 'ops@vaishnavi.com',
    notes: 'Reconciled manually by platform ops.',
  },
]

const readSaved = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

export const loadPayments = () => {
  const saved = readSaved()
  if (saved.length) {
    const ids = new Set(saved.map((p) => String(p.id)))
    return [...saved, ...DEMO_PAYMENTS.filter((d) => !ids.has(String(d.id)))]
  }
  return DEMO_PAYMENTS.map((p) => ({ ...p }))
}

export const getPayment = (id) => {
  if (!id) return null
  return loadPayments().find((p) => String(p.id) === String(id)) || null
}

export const fmtDate = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const fmtDateTime = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const fmtMoney = (n) => {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  })
}

export const paymentStatusClass = (status) => {
  const s = String(status || '').toUpperCase()
  if (s === 'SUCCESS') return 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100'
  if (s === 'FAILED') return 'bg-rose-50 text-rose-800 ring-1 ring-rose-100'
  if (s === 'PENDING') return 'bg-amber-50 text-amber-900 ring-1 ring-amber-100'
  return 'bg-stone-100 text-stone-700'
}
