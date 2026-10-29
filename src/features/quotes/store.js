const KEY = 'sc_quotes_demo_v1'

const demoPayload = (partial) => ({
  company: '',
  attention: '',
  address: '',
  gstin: '',
  stateCode: '',
  buyerEmail: '',
  shipTo: 'Same as above',
  yourRef: '',
  validityDays: 30,
  notes: '',
  contactName: 'O-HM Senior Care',
  contactPhone: '',
  contactEmail: 'support@o-hm.com',
  lines: [
    {
      id: 'ln-demo-1',
      item: '',
      hsn: '',
      specification: '',
      qty: 1,
      unitPrice: 0,
      leadTime: '',
      category: 'stocked',
      onRequest: false,
    },
  ],
  ...partial,
})

const rainbowPayload = demoPayload({
  company: 'Rainbow Senior Living',
  attention: 'Procurement',
  address: 'Pune, Maharashtra',
  gstin: '27AABCT1332L1ZV',
  stateCode: '27',
  buyerEmail: 'quotes@rainbow.example',
  yourRef: 'Verbal',
  lines: [
    {
      id: 'ln-q3-1',
      item: 'Assisted living starter kit',
      hsn: '9993',
      specification: 'Assessment + 14-day care plan',
      qty: 1,
      unitPrice: 141645,
      leadTime: '10 days',
      category: 'custom',
      onRequest: false,
    },
  ],
})

export const DEMO_QUOTES = [
  {
    id: 'q1',
    groupId: 'qg-sunrise',
    revision: 0,
    number: 'SC-Q-2610-003 R0',
    forName: 'Sunrise Care Home',
    status: 'DRAFT',
    date: '2026-10-27',
    validUntil: '2026-11-26',
    totalInclGst: null,
    gstSet: false,
    history: [{ type: 'created', at: '2026-10-27T10:00:00+05:30', by: 'support@o-hm.com' }],
    payload: demoPayload({
      company: 'Sunrise Care Home',
      attention: 'Facility Manager',
      address: 'Bengaluru, Karnataka',
      stateCode: '29',
      buyerEmail: 'ops@sunrisecare.example',
      lines: [
        {
          id: 'ln-q1-1',
          item: 'Day-care package · monthly',
          hsn: '9993',
          specification: 'Weekday day care, meals included',
          qty: 1,
          unitPrice: 45000,
          leadTime: '7 days',
          category: 'stocked',
          onRequest: false,
        },
      ],
    }),
  },
  {
    id: 'q2',
    groupId: 'qg-vaishnavi',
    revision: 0,
    number: 'SC-Q-2610-002 R0',
    forName: 'Vaishnavi Medicare',
    status: 'DRAFT',
    date: '2026-10-26',
    validUntil: '2026-11-25',
    totalInclGst: null,
    gstSet: false,
    history: [{ type: 'created', at: '2026-10-26T11:20:00+05:30', by: 'support@o-hm.com' }],
    payload: demoPayload({
      company: 'Vaishnavi Medicare',
      attention: 'Dr. Rao',
      address: 'Hyderabad, Telangana',
      stateCode: '36',
      buyerEmail: 'admin@vaishnavi.example',
      lines: [
        {
          id: 'ln-q2-1',
          item: 'Night caregiver · 12 hr',
          hsn: '9993',
          specification: 'Trained caregiver, night shift',
          qty: 30,
          unitPrice: 1800,
          leadTime: '3 days',
          category: 'service',
          onRequest: false,
        },
      ],
    }),
  },
  {
    id: 'q3-r0',
    groupId: 'qg-rainbow',
    revision: 0,
    number: 'SC-Q-2610-001 R0',
    forName: 'Rainbow Senior Living',
    status: 'SUPERSEDED',
    date: '2026-10-26',
    validUntil: '2026-11-25',
    totalInclGst: 167141.1,
    gstSet: true,
    sentAt: '2026-10-27T19:45:00+05:30',
    sentTo: ['quotes@rainbow.example'],
    sentBy: 'support@o-hm.com',
    history: [
      {
        type: 'sent',
        at: '2026-10-27T19:45:00+05:30',
        to: 'quotes@rainbow.example',
        by: 'support@o-hm.com',
      },
      { type: 'created', at: '2026-10-26T09:15:00+05:30', by: 'support@o-hm.com' },
    ],
    payload: rainbowPayload,
  },
  {
    id: 'q3-r1',
    groupId: 'qg-rainbow',
    revision: 1,
    number: 'SC-Q-2610-001 R1',
    forName: 'Rainbow Senior Living',
    status: 'SENT',
    date: '2026-10-28',
    validUntil: '2026-11-27',
    totalInclGst: 167141.1,
    gstSet: true,
    sentAt: '2026-10-28T19:45:00+05:30',
    sentTo: ['quotes@rainbow.example'],
    sentBy: 'support@o-hm.com',
    history: [
      {
        type: 'sent',
        at: '2026-10-28T19:45:00+05:30',
        to: 'quotes@rainbow.example',
        by: 'support@o-hm.com',
      },
      { type: 'created', at: '2026-10-28T08:00:00+05:30', by: 'support@o-hm.com' },
    ],
    payload: {
      ...rainbowPayload,
      lines: [
        {
          ...rainbowPayload.lines[0],
          id: 'ln-q3-r1-1',
          unitPrice: 141645,
          specification: 'Assessment + 14-day care plan · revised scope',
        },
      ],
    },
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

export const loadQuotes = () => {
  const saved = readSaved()
  if (saved.length) {
    const ids = new Set(saved.map((q) => q.id))
    return [...saved, ...DEMO_QUOTES.filter((d) => !ids.has(d.id))]
  }
  return DEMO_QUOTES.map((q) => ({ ...q }))
}

export const getQuote = (id) => {
  if (!id) return null
  return loadQuotes().find((q) => String(q.id) === String(id)) || null
}

export const getQuoteFamily = (quote) => {
  if (!quote) return []
  const gid = quote.groupId || quote.id
  return loadQuotes()
    .filter((q) => (q.groupId || q.id) === gid)
    .sort((a, b) => (Number(a.revision) || 0) - (Number(b.revision) || 0))
}

export const upsertQuote = (row) => {
  const prev = readSaved()
  const idx = prev.findIndex((q) => q.id === row.id)
  const next = idx >= 0 ? prev.map((q, i) => (i === idx ? row : q)) : [row, ...prev]
  localStorage.setItem(KEY, JSON.stringify(next))
  return row
}

export const createRevision = (quote) => {
  if (!quote) return null
  const family = getQuoteFamily(quote)
  const nextRev = family.reduce((m, q) => Math.max(m, Number(q.revision) || 0), 0) + 1
  const baseNumber = String(quote.number || '')
    .replace(/\s*R\d+\s*$/i, '')
    .trim()
  const now = new Date()
  const draft = {
    ...quote,
    id: `q-${Date.now()}`,
    groupId: quote.groupId || quote.id,
    revision: nextRev,
    number: `${baseNumber} R${nextRev}`,
    status: 'DRAFT',
    date: now.toISOString().slice(0, 10),
    sentAt: null,
    sentTo: null,
    sentBy: null,
    history: [
      {
        type: 'created',
        at: now.toISOString(),
        by: 'support@o-hm.com',
        note: `Revision of ${quote.number}`,
      },
    ],
    payload: {
      ...(quote.payload && typeof quote.payload === 'object' ? quote.payload : {}),
      contactName: 'O-HM Senior Care',
    },
  }

  let saved = readSaved()
  const write = (row) => {
    const i = saved.findIndex((q) => q.id === row.id)
    if (i >= 0) saved = saved.map((q, idx) => (idx === i ? row : q))
    else saved = [row, ...saved]
  }
  family.forEach((q) => {
    if (q.status === 'SENT') write({ ...q, status: 'SUPERSEDED' })
  })
  write(draft)
  localStorage.setItem(KEY, JSON.stringify(saved))
  return draft
}

const daysBetween = (fromIso, toIso) => {
  const a = new Date(fromIso)
  const b = new Date(toIso)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 30
  const ms = b.setHours(0, 0, 0, 0) - a.setHours(0, 0, 0, 0)
  return Math.max(1, Math.round(ms / 86400000))
}

export const formFromQuote = (quote) => {
  const s = demoPayload({})
  const p = quote?.payload && typeof quote.payload === 'object' ? quote.payload : {}
  const validityDays =
    p.validityDays != null
      ? Number(p.validityDays) || 30
      : quote?.date && quote?.validUntil
        ? daysBetween(quote.date, quote.validUntil)
        : 30
  return {
    ...s,
    ...p,
    company: p.company || quote?.forName || '',
    validityDays,
    contactName: 'O-HM Senior Care',
    contactEmail: p.contactEmail || 'support@o-hm.com',
    lines: Array.isArray(p.lines) && p.lines.length ? p.lines : s.lines,
  }
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
