/** Shared line GST helpers (quotes + invoices). Seller state = Karnataka (29). */

export const LINE_CATS = [
  { id: 'stocked', label: 'Catalog' },
  { id: 'custom', label: 'Custom service' },
  { id: 'service', label: 'Service visit' },
  { id: 'on_request', label: 'Man power' },
]

export const DEFAULT_TERMS = [
  'Payment as agreed; advance may be required for custom packages.',
  'Services subject to caregiver availability at the venue.',
  'Prices exclude hospital / pharmacy pass-through unless listed.',
  'Cancellation per organization policy.',
  'Subject to laws of India.',
].join('\n')

/** Portal-style CGST + SGST halves (intra-state). Value stored = total %. */
export const CGST_SGST_RATE_OPTIONS = [
  { half: 0, label: '0 + 0' },
  { half: 0.05, label: '0.050 + 0.050' },
  { half: 0.125, label: '0.125 + 0.125' },
  { half: 0.5, label: '0.500 + 0.500' },
  { half: 0.75, label: '0.750 + 0.750' },
  { half: 1.5, label: '1.500 + 1.500' },
  { half: 2.5, label: '2.500 + 2.500' },
  { half: 3, label: '3 + 3' },
  { half: 3.75, label: '3.750 + 3.750' },
  { half: 6, label: '6 + 6' },
  { half: 9, label: '9 + 9' },
  { half: 14, label: '14 + 14' },
  { half: 20, label: '20 + 20' },
]

/** Portal-style IGST full rates (inter-state). */
export const IGST_RATE_OPTIONS = [
  { rate: 0, label: '0' },
  { rate: 0.1, label: '0.100' },
  { rate: 0.25, label: '0.250' },
  { rate: 1, label: '1' },
  { rate: 1.5, label: '1.500' },
  { rate: 3, label: '3' },
  { rate: 5, label: '5' },
  { rate: 6, label: '6' },
  { rate: 7.5, label: '7.500' },
  { rate: 12, label: '12' },
  { rate: 18, label: '18' },
  { rate: 28, label: '28' },
  { rate: 40, label: '40' },
]

export const GST_NOT_APPL = 'na'

export const UOM_OPTIONS = [
  'Pcs',
  'Nos',
  'Kg',
  'Gms',
  'Litre',
  'Ml',
  'Box',
  'Pack',
  'Set',
  'Pair',
  'Dozen',
  'Hour',
  'Day',
  'Month',
  'Unit',
]

export const isManPowerLine = (ln = {}) =>
  Boolean(ln.onRequest) || ln.category === 'on_request'

export const resolveGstRatePct = (ln = {}) => {
  const raw = ln.gstRate
  if (raw === GST_NOT_APPL || raw === 'NA') return 0
  if (raw === '' || raw == null) return 18
  const n = Number(raw)
  return Number.isFinite(n) ? n : 18
}

export const gstSelectValue = (ln = {}) => {
  if (ln.gstRate === GST_NOT_APPL || ln.gstRate === 'NA') return GST_NOT_APPL
  if (ln.gstRate === '' || ln.gstRate == null) return ''
  const n = Number(ln.gstRate)
  return Number.isFinite(n) ? String(n) : ''
}

export const emptyGstLine = () => ({
  id: `ln-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  item: '',
  hsn: '',
  specification: '',
  qty: 1,
  uom: 'Pcs',
  unitPrice: 0,
  discountPct: 0,
  leadTime: '',
  gstRate: 18,
  category: 'stocked',
  onRequest: false,
})

/** Split line GST: Karnataka (seller) → CGST+SGST; other states → IGST. */
export const lineGstSplit = (ln, { intraState, hasBuyerState }) => {
  const qty = Number(ln.qty) || 0
  const price = isManPowerLine(ln) ? 0 : Number(ln.unitPrice) || 0
  const gross = qty * price
  const discPct = Math.max(0, Math.min(100, Number(ln.discountPct) || 0))
  const discountAmt = gross * (discPct / 100)
  const taxable = Math.max(0, gross - discountAmt)
  const ratePct = resolveGstRatePct(ln)
  if (!hasBuyerState || taxable <= 0 || ratePct <= 0) {
    return {
      gross,
      discountPct: discPct,
      discountAmt,
      taxable,
      amount: taxable,
      ratePct,
      cgstRate: 0,
      sgstRate: 0,
      igstRate: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      gstTotal: 0,
      lineTotal: taxable,
    }
  }
  const gstTotal = taxable * (ratePct / 100)
  if (intraState) {
    const half = ratePct / 2
    const halfAmt = gstTotal / 2
    return {
      gross,
      discountPct: discPct,
      discountAmt,
      taxable,
      amount: taxable,
      ratePct,
      cgstRate: half,
      sgstRate: half,
      igstRate: 0,
      cgst: halfAmt,
      sgst: halfAmt,
      igst: 0,
      gstTotal,
      lineTotal: taxable + gstTotal,
    }
  }
  return {
    gross,
    discountPct: discPct,
    discountAmt,
    taxable,
    amount: taxable,
    ratePct,
    cgstRate: 0,
    sgstRate: 0,
    igstRate: ratePct,
    cgst: 0,
    sgst: 0,
    igst: gstTotal,
    gstTotal,
    lineTotal: taxable + gstTotal,
  }
}

export const normalizeGstLine = (ln, i = 0) => ({
  id: ln.id || `ln-${Date.now()}-${i}`,
  item: String(ln.item || '').trim(),
  hsn: String(ln.hsn || '').trim(),
  specification: String(ln.specification || '').trim(),
  qty: Number(ln.qty) || 1,
  uom: ln.uom || 'Pcs',
  unitPrice: Number(ln.unitPrice) || 0,
  discountPct: Math.max(0, Math.min(100, Number(ln.discountPct) || 0)),
  leadTime: String(ln.leadTime || '').trim(),
  gstRate: ln.gstRate === GST_NOT_APPL || ln.gstRate === 'NA' ? GST_NOT_APPL : Number(ln.gstRate) || 18,
  category: ln.category || 'stocked',
  onRequest: Boolean(ln.onRequest) || ln.category === 'on_request',
})
