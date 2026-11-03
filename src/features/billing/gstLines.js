/** Shared line GST helpers (quotes + invoices). Seller state = Karnataka (29). */

/** Matches backend Kind TextChoices. */
export const LINE_CATS = [
  { id: 'catalog', label: 'Catalog' },
  { id: 'custom', label: 'Custom service' },
  { id: 'service_visit', label: 'Service visit' },
  { id: 'manpower', label: 'Man power' },
]

/** Map legacy UI ids → API Kind values. */
export const normalizeLineKind = (raw) => {
  const v = String(raw || '').trim().toLowerCase()
  if (v === 'catalog' || v === 'stocked') return 'catalog'
  if (v === 'custom') return 'custom'
  if (v === 'service_visit' || v === 'service') return 'service_visit'
  if (v === 'manpower' || v === 'on_request') return 'manpower'
  return 'custom'
}

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

/**
 * Unit of measurement — value = API code, label = FE display.
 * Matches backend Uom TextChoices.
 */
export const UNITS = [
  // Quantity / Count
  { value: 'PCS', label: 'Pcs' },
  { value: 'NOS', label: 'Nos' },
  { value: 'UNT', label: 'Unit' },
  { value: 'SET', label: 'Set' },
  { value: 'PR', label: 'Pair' },
  { value: 'DOZ', label: 'Dozen' },
  // Packaging
  { value: 'BOX', label: 'Box' },
  { value: 'PAC', label: 'Pack' },
  { value: 'PKT', label: 'Packet' },
  { value: 'CTN', label: 'Carton' },
  { value: 'BAG', label: 'Bag' },
  { value: 'BDL', label: 'Bundle' },
  { value: 'ROL', label: 'Roll' },
  { value: 'BTL', label: 'Bottle' },
  { value: 'CAN', label: 'Can' },
  // Weight
  { value: 'MG', label: 'Mg' },
  { value: 'GMS', label: 'Gms' },
  { value: 'KGS', label: 'Kg' },
  { value: 'QTL', label: 'Quintal' },
  { value: 'TON', label: 'Ton' },
  // Volume
  { value: 'ML', label: 'Ml' },
  { value: 'LTR', label: 'Litre' },
  // Length / Distance
  { value: 'MM', label: 'Mm' },
  { value: 'CM', label: 'Cm' },
  { value: 'MTR', label: 'Mtr' },
  { value: 'KM', label: 'Km' },
  { value: 'IN', label: 'Inch' },
  { value: 'FT', label: 'Feet' },
  { value: 'YD', label: 'Yard' },
  { value: 'MI', label: 'Mile' },
  // Area
  { value: 'SQFT', label: 'Sq.Ft' },
  { value: 'SQM', label: 'Sq.Mtr' },
  { value: 'SQYD', label: 'Sq.Yard' },
  // Time / Services
  { value: 'HRS', label: 'Hour' },
  { value: 'DAY', label: 'Day' },
  { value: 'MTH', label: 'Month' },
  { value: 'YR', label: 'Year' },
  { value: 'VST', label: 'Visits' },
  // Other
  { value: 'OTH', label: 'Other' },
]

export const UOM_OPTIONS = UNITS

const UOM_BY_VALUE = Object.fromEntries(UNITS.map((u) => [u.value, u]))
const UOM_BY_LABEL = Object.fromEntries(
  UNITS.map((u) => [u.label.toLowerCase(), u]),
)

/** Normalize any raw UOM (code or label) → API code. Default PCS. */
export const normalizeUom = (raw) => {
  const s = String(raw || '').trim()
  if (!s) return 'PCS'
  const upper = s.toUpperCase()
  if (UOM_BY_VALUE[upper]) return upper
  const byLabel = UOM_BY_LABEL[s.toLowerCase()]
  return byLabel?.value || 'PCS'
}

/** Display label for a stored UOM code (or legacy label). */
export const uomLabel = (raw) => {
  const code = normalizeUom(raw)
  return UOM_BY_VALUE[code]?.label || code
}

export const isManPowerLine = (ln = {}) =>
  Boolean(ln.onRequest) ||
  normalizeLineKind(ln.category || ln.kind) === 'manpower'

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
  uom: 'PCS',
  unitPrice: 0,
  discountPct: 0,
  leadTime: '',
  gstRate: 18,
  category: 'catalog',
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
  uom: normalizeUom(ln.uom),
  unitPrice: Number(ln.unitPrice) || 0,
  discountPct: Math.max(0, Math.min(100, Number(ln.discountPct) || 0)),
  leadTime: String(ln.leadTime || '').trim(),
  gstRate: ln.gstRate === GST_NOT_APPL || ln.gstRate === 'NA' ? GST_NOT_APPL : Number(ln.gstRate) || 18,
  category: normalizeLineKind(ln.category || ln.kind),
  onRequest:
    Boolean(ln.onRequest) ||
    normalizeLineKind(ln.category || ln.kind) === 'manpower',
})
