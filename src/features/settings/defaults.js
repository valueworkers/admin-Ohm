export const FONT_FAMILIES = [
  { value: 'Segoe UI', label: 'Segoe UI' },
  { value: 'system-ui', label: 'System UI' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Courier New', label: 'Courier New' },
]

export const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

export const FONT_SIZES = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
]

export const NOTIFY_CHANNELS = [
  { key: 'email', label: 'Email' },
  { key: 'in_app', label: 'In-app' },
  { key: 'browser_push', label: 'Browser push' },
  { key: 'mobile_push', label: 'Mobile push' },
  { key: 'sms', label: 'SMS' },
]

export const NOTIFY_CATEGORIES = [
  { key: 'product_updates', label: 'Product updates', mandatory: false },
  { key: 'marketing', label: 'Marketing emails', mandatory: false },
  { key: 'security', label: 'Security alerts', mandatory: true },
  { key: 'billing', label: 'Billing / payment alerts', mandatory: true },
]

export const EXPORT_FORMATS = [
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
  { value: 'pdf', label: 'PDF' },
]

const emptyChannelPrefs = () =>
  Object.fromEntries(NOTIFY_CHANNELS.map((c) => [c.key, c.key === 'email' || c.key === 'in_app']))

const emptyCategoryPrefs = () =>
  Object.fromEntries(
    NOTIFY_CATEGORIES.map((c) => [c.key, c.mandatory ? true : c.key !== 'marketing']),
  )

/** PDF page presets (portrait mm). Preview uses 96dpi: mm × 96 / 25.4 */
export const PDF_PAGE_SIZES = [
  { value: 'A3', label: 'A3 (297 × 420 mm)', widthMm: 297, heightMm: 420 },
  { value: 'A4', label: 'A4 (210 × 297 mm)', widthMm: 210, heightMm: 297 },
  { value: 'A5', label: 'A5 (148 × 210 mm)', widthMm: 148, heightMm: 210 },
  { value: 'Letter', label: 'Letter (8.5 × 11 in)', widthMm: 216, heightMm: 279 },
  { value: 'Legal', label: 'Legal (8.5 × 14 in)', widthMm: 216, heightMm: 356 },
  { value: 'Tabloid', label: 'Tabloid (11 × 17 in)', widthMm: 279, heightMm: 432 },
  { value: 'Custom', label: 'Custom size…', widthMm: 210, heightMm: 297 },
]

const MM_TO_PX = 96 / 25.4

export const mmToPx = (mm) => Math.round(Number(mm) * MM_TO_PX)

export const resolvePdfPageMm = (style = {}) => {
  const preset = PDF_PAGE_SIZES.find((p) => p.value === style.pageSize)
  if (style.pageSize === 'Custom' || !preset) {
    const w = Number(style.pageWidthMm)
    const h = Number(style.pageHeightMm)
    return {
      widthMm: Number.isFinite(w) && w > 0 ? w : 210,
      heightMm: Number.isFinite(h) && h > 0 ? h : 297,
    }
  }
  return { widthMm: preset.widthMm, heightMm: preset.heightMm }
}

export const resolvePdfPagePx = (style = {}) => {
  const { widthMm, heightMm } = resolvePdfPageMm(style)
  return { w: mmToPx(widthMm), h: mmToPx(heightMm) }
}

export const PDF_ALIGN = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
]

export const defaultPdfStyle = () => ({
  pageSize: 'A4',
  pageWidthMm: 210,
  pageHeightMm: 297,
  orientation: 'portrait',
  marginTop: 48,
  marginRight: 48,
  marginBottom: 48,
  marginLeft: 48,
  paddingTop: 20,
  paddingRight: 20,
  paddingBottom: 20,
  paddingLeft: 20,
  borderWidth: 1,
  borderColor: '#d6d3d1',
  borderStyle: 'solid',
  fontFamily: 'Segoe UI',
  fontSize: 11,
  headingSize: 20,
  lineHeight: 1.45,
  fontWeightHeading: '700',
  fontStyleHeading: 'normal',
  textAlign: 'left',
  textColor: '#1e1e2c',
  accentColor: '#f29f67',
  tableBorder: true,
  tableHeaderBg: '#f5f5f4',
  showLogo: true,
  showHeader: true,
  showFooter: true,
  showBorder: true,
  showPageNumber: true,
  showWatermark: false,
  watermarkText: 'DRAFT',
})

export const defaultPdfTemplates = () => [
  {
    id: 'template-1',
    option: 1,
    name: 'Template 1',
    label: 'Classic invoice',
    description: 'A4 invoice with logo, billed-to block, line items, and totals.',
    docType: 'invoice',
    style: {
      ...defaultPdfStyle(),
      accentColor: '#1e1e2c',
      headingSize: 22,
      borderWidth: 1,
      showBorder: true,
      tableBorder: true,
    },
  },
  {
    id: 'template-2',
    option: 2,
    name: 'Template 2',
    label: 'Modern quotation',
    description: 'Clean quote layout with accent bar, optional watermark, and soft borders.',
    docType: 'quotation',
    style: {
      ...defaultPdfStyle(),
      accentColor: '#f29f67',
      borderWidth: 0,
      showBorder: false,
      tableHeaderBg: '#fef6f0',
      showWatermark: false,
      headingSize: 20,
      fontWeightHeading: '600',
    },
  },
  {
    id: 'template-3',
    option: 3,
    name: 'Template 3',
    label: 'Formal report',
    description: 'Serif report with centered title, denser margins, and page numbers.',
    docType: 'report',
    style: {
      ...defaultPdfStyle(),
      fontFamily: 'Georgia',
      fontSize: 10,
      headingSize: 18,
      marginTop: 56,
      marginBottom: 56,
      marginLeft: 56,
      marginRight: 56,
      textAlign: 'left',
      accentColor: '#334155',
      tableHeaderBg: '#f1f5f9',
      showPageNumber: true,
    },
  },
]

/** Ensure saved settings always have Template 1–3. */
export const normalizePdfTemplates = (list) => {
  const defaults = defaultPdfTemplates()
  if (!Array.isArray(list) || !list.length) return defaults
  const byId = new Map(list.map((t) => [t.id, t]))
  // Migrate legacy ids
  const legacy = {
    invoice: 'template-1',
    quotation: 'template-2',
    report: 'template-3',
  }
  return defaults.map((base) => {
    const legacyId = Object.keys(legacy).find((k) => legacy[k] === base.id)
    const saved = byId.get(base.id) || (legacyId ? byId.get(legacyId) : null)
    if (!saved) return base
    return {
      ...base,
      ...saved,
      id: base.id,
      option: base.option,
      name: base.name,
      label: saved.label || base.label,
      docType: saved.docType || base.docType,
      style: { ...base.style, ...(saved.style || {}) },
    }
  })
}

export const defaultUserSettings = (user = {}) => ({
  profile: {
    first_name: '',
    last_name: '',
    email: '',
    email_verified: false,
    pending_email: '',
  },
  organization: {
    name: user.organization_name || '',
    email: '',
    address_line1: '',
    address_line2: '',
    city: '',
    locality: '',
    country: 'India',
    logoUrl: '',
  },
  appearance: {
    theme: 'light',
    fontSize: 'medium',
    fontFamily: 'Segoe UI',
  },
  notifications: {
    channels: emptyChannelPrefs(),
    categories: emptyCategoryPrefs(),
    marketingConsentAt: null,
  },
  security: {
    twoFactorEnabled: false,
    recoveryCodesRemaining: 0,
    loginHistory: [
      {
        id: '1',
        at: new Date().toISOString(),
        device: 'Chrome · Windows',
        location: 'Bengaluru, IN',
        ip: '103.•••.•••.12',
        status: 'success',
      },
      {
        id: '2',
        at: new Date(Date.now() - 86400000 * 2).toISOString(),
        device: 'Safari · iPhone',
        location: 'Bengaluru, IN',
        ip: '103.•••.•••.44',
        status: 'success',
      },
    ],
  },
  billing: {
    planName: 'Growth',
    status: 'active',
    billingCycle: 'monthly',
    renewalDate: new Date(Date.now() + 86400000 * 20).toISOString().slice(0, 10),
    usage: { seats: 8, seatsLimit: 25, storageGb: 12, storageLimitGb: 50 },
    autoRenew: true,
    billingName: '',
    billingEmail: '',
    gstin: '',
    address: '',
    paymentMethods: [
      { id: 'pm1', brand: 'Visa', last4: '4242', expMonth: 8, expYear: 2028, isDefault: true },
    ],
    invoices: [
      {
        id: 'inv-1001',
        date: '2026-09-24',
        amount: 4999,
        currency: 'INR',
        status: 'paid',
      },
      {
        id: 'inv-1000',
        date: '2026-08-24',
        amount: 4999,
        currency: 'INR',
        status: 'paid',
      },
    ],
  },
  data: {
    preferredExportFormat: 'csv',
    autoSave: true,
    retentionDays: 365,
    storageUsedGb: 12.4,
    storageLimitGb: 50,
    backupsEnabled: true,
    lastBackupAt: new Date(Date.now() - 86400000).toISOString(),
    exportJobs: [],
  },
  pdfTemplates: defaultPdfTemplates(),
})
