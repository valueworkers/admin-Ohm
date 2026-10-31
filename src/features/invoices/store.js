import { normalizeGstLine } from '../billing/gstLines'

const KEY = 'sc_invoices_demo_v1'
const DELETED_KEY = 'sc_invoices_deleted_v1'

/** Close-out steps for a care booking before the platform tax invoice is raised. */
export const DUE_STEPS = [
  {
    id: 'scheduled',
    title: 'Care scheduled',
    hint: 'Slot confirmed with the tenant venue and caregiver assigned.',
  },
  {
    id: 'delivered',
    title: 'Care delivered',
    hint: 'Visit or package attendance logged at the venue.',
  },
  {
    id: 'acknowledged',
    title: 'Family / tenant acknowledged',
    hint: 'Payer or tenant ops confirmed the service was satisfactory.',
  },
  {
    id: 'invoiced',
    title: 'Invoice raised and balance settled',
    hint: 'Platform tax invoice recorded; any remaining balance collected.',
  },
]

export const DEMO_DUE = [
  {
    id: 'due-2',
    kind: 'due',
    payerName: 'Meera Iyer',
    patientName: 'Lakshmi Iyer',
    tenantName: 'Vaishnavi Medicare',
    bookingRef: 'BK-10024',
    venue: 'Vaishnavi · Home care',
    service: 'Night caregiver · 12 hr × 7',
    amount: 12600,
    received: 0,
    owed: 12600,
    terms: 'Bill family after delivery',
    daysWaiting: 3,
    currentStep: 1,
    email: 'meera.iyer@example.com',
    createdAt: '2026-10-25',
    banner:
      'Care is scheduled under Vaishnavi Medicare. Mark delivery when night shifts are complete, then raise the invoice to the family payer.',
    lines: [
      {
        id: 'd2-l1',
        item: 'Night caregiver · 12 hr',
        category: 'Care visit',
        qty: 7,
        unitPrice: 1800,
      },
    ],
  },
]

export const DEMO_INVOICES = [
  {
    id: 'inv-2',
    kind: 'invoice',
    number: '034/202627',
    payerName: 'Sunrise Care Home',
    patientName: '— (tenant package)',
    clientName: 'Sunrise Care Home',
    tenantName: 'Sunrise Care Home',
    bookingRef: 'BK-10018',
    venue: 'Sunrise · Day centre',
    date: '2026-10-20',
    amount: 53100,
    received: 25000,
    owed: 28100,
    status: 'PARTIAL',
    terms: 'Net 15 · tenant bank transfer',
    email: 'ops@sunrisecare.example',
    paidAt: '2026-10-21T11:00:00+05:30',
    lines: [
      {
        id: 'ln1',
        item: 'Day-care package · monthly (platform fee)',
        category: 'Tenant package',
        qty: 1,
        unitPrice: 45000,
      },
    ],
    timeline: [
      {
        id: 't1',
        title: 'Quote accepted',
        at: '2026-10-18T09:00:00+05:30',
        detail: 'SC-Q-2610-003 · converted to booking',
      },
      {
        id: 't2',
        title: 'Invoice raised',
        at: '2026-10-20T14:00:00+05:30',
        detail: '034/202627 · ₹53,100.00 incl. GST',
      },
      {
        id: 't3',
        title: 'Partial payment received',
        at: '2026-10-21T11:00:00+05:30',
        detail: '₹25,000.00 · tenant bank transfer',
      },
    ],
    note: 'Tenant advance received. Balance due under Net 15.',
  },
  {
    id: 'inv-3',
    kind: 'invoice',
    number: '033/202627',
    payerName: 'Anita Desai',
    patientName: 'Mohan Desai',
    clientName: 'Anita Desai',
    tenantName: 'CarePlus Home',
    bookingRef: 'BK-10015',
    venue: 'CarePlus · Home visits',
    date: '2026-10-12',
    amount: 9440,
    received: 0,
    owed: 9440,
    status: 'OWED',
    terms: 'Due on receipt · family',
    email: 'anita.desai@example.com',
    paidAt: null,
    lines: [
      {
        id: 'ln1',
        item: 'Physio session · home visit',
        category: 'Care visit',
        qty: 4,
        unitPrice: 2000,
      },
    ],
    timeline: [
      {
        id: 't1',
        title: 'Sessions completed',
        at: '2026-10-11T18:00:00+05:30',
        detail: '4 home visits logged at CarePlus',
      },
      {
        id: 't2',
        title: 'Invoice raised',
        at: '2026-10-12T10:30:00+05:30',
        detail: '033/202627 · awaiting family payment',
      },
    ],
    note: 'Sent to family payer. No payment recorded yet.',
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

const readDeleted = () => {
  try {
    const ids = JSON.parse(localStorage.getItem(DELETED_KEY) || '[]')
    return Array.isArray(ids) ? ids.map(String) : []
  } catch {
    return []
  }
}

export const loadDue = () => DEMO_DUE.map((d) => ({ ...d }))

export const loadInvoices = () => {
  const deleted = new Set(readDeleted())
  const saved = readSaved().filter((i) => !deleted.has(String(i.id)))
  const ids = new Set(saved.map((i) => String(i.id)))
  const demos = DEMO_INVOICES.filter(
    (d) => !ids.has(String(d.id)) && !deleted.has(String(d.id)),
  )
  return [...saved, ...demos.map((i) => ({ ...i }))]
}

export const getInvoice = (id) => {
  if (!id) return null
  if (readDeleted().includes(String(id))) return null
  const due = loadDue().find((d) => String(d.id) === String(id))
  if (due) return due
  return loadInvoices().find((i) => String(i.id) === String(id)) || null
}

export const deleteInvoice = (id) => {
  if (!id) return false
  const sid = String(id)
  const saved = readSaved().filter((i) => String(i.id) !== sid)
  localStorage.setItem(KEY, JSON.stringify(saved))
  const deleted = new Set(readDeleted())
  deleted.add(sid)
  localStorage.setItem(DELETED_KEY, JSON.stringify([...deleted]))
  return true
}

export const nextInvoiceNumber = () => {
  const y = new Date().getFullYear()
  const yy = String(y).slice(2)
  const seq = String(Date.now()).slice(-3)
  return `${seq}/${y}${yy}`
}

/** Persist a platform (O-HM) invoice billed to a tenant or payer. */
export const upsertInvoice = (row) => {
  const saved = readSaved()
  const idx = saved.findIndex((q) => q.id === row.id)
  const next = idx >= 0 ? saved.map((q, i) => (i === idx ? row : q)) : [row, ...saved]
  localStorage.setItem(KEY, JSON.stringify(next))
  return row
}

export const createTenantInvoice = ({
  existing,
  tenant,
  payerName: payerOverride,
  number,
  date,
  dueDate,
  terms,
  notes,
  lines,
  asSent = false,
  amountReceived = 0,
  subtotal: subtotalIn,
  gstAmount: gstIn,
  cgstTotal: cgstIn,
  sgstTotal: sgstIn,
  igstTotal: igstIn,
  total: totalIn,
  customer = {},
  seller = {},
}) => {
  const safeLines = (Array.isArray(lines) ? lines : [])
    .filter((ln) => String(ln.item || '').trim())
    .map((ln, i) => normalizeGstLine(ln, i))
  const subtotal =
    subtotalIn != null
      ? Number(subtotalIn) || 0
      : safeLines.reduce(
          (s, ln) => s + (Number(ln.qty) || 0) * (Number(ln.unitPrice) || 0),
          0,
        )
  const gstAmount = gstIn != null ? Number(gstIn) || 0 : subtotal * 0.18
  const amount = totalIn != null ? Number(totalIn) || 0 : subtotal + gstAmount
  const received = Math.max(0, Number(amountReceived) || 0)
  const owed = Math.max(0, amount - received)
  let status = owed <= 0 ? 'PAID' : received > 0 ? 'PARTIAL' : asSent ? 'OWED' : 'DRAFT'
  if (asSent && status === 'DRAFT') status = 'OWED'
  if (!asSent && existing?.status && !['DRAFT', 'OWED', 'PARTIAL', 'PAID'].includes(existing.status)) {
    status = existing.status
  }
  const nowIso = new Date().toISOString()
  const tenantName = tenant?.name || existing?.tenantName || payerOverride || 'Customer'
  const payerName = payerOverride || tenantName
  const prevHistory = Array.isArray(existing?.timeline) ? existing.timeline : []
  const row = {
    ...(existing && typeof existing === 'object' ? existing : {}),
    id: existing?.id || `inv-${Date.now()}`,
    kind: 'invoice',
    billTo: tenant || existing?.tenantId ? 'tenant' : 'customer',
    issuedBy: seller.sellerName || existing?.issuedBy || 'O-HM Senior Care',
    number: number || existing?.number || nextInvoiceNumber(),
    payerName,
    patientName: existing?.patientName || '— (tenant package)',
    clientName: payerName,
    legalName: customer.legalName ?? existing?.legalName ?? '',
    attention: customer.attention ?? existing?.attention ?? '',
    address: customer.address ?? existing?.address ?? '',
    gstin: customer.gstin ?? existing?.gstin ?? '',
    stateCode: customer.stateCode ?? existing?.stateCode ?? '',
    ccEmails: customer.ccEmails ?? existing?.ccEmails ?? '',
    bccEmails: customer.bccEmails ?? existing?.bccEmails ?? '',
    shipTo: customer.shipTo ?? existing?.shipTo ?? 'Same as above',
    yourRef: customer.yourRef ?? existing?.yourRef ?? '',
    sellerName: seller.sellerName ?? existing?.sellerName ?? '',
    sellerAddress: seller.sellerAddress ?? existing?.sellerAddress ?? '',
    sellerPhone: seller.sellerPhone ?? existing?.sellerPhone ?? '',
    sellerGstin: seller.sellerGstin ?? existing?.sellerGstin ?? '',
    logoUrl: seller.logoUrl ?? existing?.logoUrl ?? '',
    contactName: seller.contactName ?? existing?.contactName ?? '',
    contactPhone: seller.contactPhone ?? existing?.contactPhone ?? '',
    contactEmail: seller.contactEmail ?? existing?.contactEmail ?? '',
    tenantId: tenant?.id || existing?.tenantId || null,
    tenantName,
    bookingRef:
      customer.yourRef ||
      existing?.bookingRef ||
      `PLT-${String(Date.now()).slice(-5)}`,
    venue:
      tenant?.city
        ? `${tenantName} · ${tenant.city}`
        : existing?.venue || customer.address || tenantName,
    date: date || existing?.date || nowIso.slice(0, 10),
    dueDate: dueDate || existing?.dueDate || null,
    amount,
    subtotal,
    gstAmount,
    cgstTotal: cgstIn != null ? Number(cgstIn) || 0 : existing?.cgstTotal || 0,
    sgstTotal: sgstIn != null ? Number(sgstIn) || 0 : existing?.sgstTotal || 0,
    igstTotal: igstIn != null ? Number(igstIn) || 0 : existing?.igstTotal || 0,
    received,
    owed,
    status,
    terms: terms || existing?.terms || 'Net 15 · bank transfer',
    email:
      customer.email ||
      tenant?.owner_email ||
      tenant?.email ||
      existing?.email ||
      '',
    ownerName:
      customer.attention ||
      tenant?.owner_name ||
      existing?.ownerName ||
      '',
    city: tenant?.city || existing?.city || '',
    paidAt: received > 0 ? existing?.paidAt || nowIso : null,
    lines: safeLines,
    timeline: existing
      ? [
          {
            id: `t-edit-${Date.now()}`,
            title: asSent ? 'Invoice updated and raised' : 'Invoice updated',
            at: nowIso,
            detail: `${number || existing.number} · ${payerName}`,
          },
          ...prevHistory,
        ]
      : [
          ...(asSent
            ? [
                {
                  id: 't-sent',
                  title: 'Invoice raised',
                  at: nowIso,
                  detail: `${number || 'Invoice'} · ${payerName}`,
                },
              ]
            : []),
          {
            id: 't-created',
            title: 'Created by O-HM Senior Care',
            at: nowIso,
            detail: 'Platform billing',
          },
        ],
    note: notes ?? existing?.note ?? '',
  }
  return upsertInvoice(row)
}

export const displayPayer = (row) => row?.payerName || row?.clientName || '—'

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

export const invoiceAgeDays = (dateIso) => {
  if (!dateIso) return null
  const d = new Date(dateIso)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((now - d) / 86400000))
}
