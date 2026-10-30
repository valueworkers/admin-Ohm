import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FiArrowDown, FiArrowUp, FiDownload, FiPlus, FiRefreshCw, FiTrash2 } from 'react-icons/fi'
import StatusBanner from '../components/ui/StatusBanner'
import TenantOpsPlaceholder from '../components/TenantOpsPlaceholder'
import { ErrorState, LoadingState } from '../components/ui/PageState'
import {
  fetchGstCaptcha,
  gstinLookupConfigured,
  gstinUsesCaptcha,
  isValidGstinFormat,
  lookupGstin,
} from '../api/gstin'
import {
  createPlatformQuote,
  downloadPlatformQuotePdf,
  fetchPlatformQuoteById,
  revisePlatformQuote,
  sendPlatformQuote,
  sendPlatformQuoteTest,
  updatePlatformQuote,
} from '../api/quotes'
import { useAccess } from '../hooks/useAccess'
import { loadSettingsForMode } from '../features/settings/store'
import {
  IN_STATES,
  SELLER_STATE_CODE,
  amountInWords,
  stateFromGstin,
} from '../features/quotes/states'
import { fmtDateTime, formFromQuote } from '../features/quotes/store'
import { isValidEmail } from '../features/settings/store'
import { apiErrorMessage } from '../utils/errors'
import { btnGhost, btnPrimary, btnSecondary, fieldClass, labelClass } from '../utils/ui'

const PLATFORM = {
  name: 'O-HM Senior Care',
  email: 'support@o-hm.com',
  address: 'India',
  phone: '',
}

const joinAddress = (...parts) =>
  parts
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .join(', ')

/** Platform quotes brand as O-HM; logo/address from account settings when set. */
const readPlatformSeller = () => {
  try {
    const settings = loadSettingsForMode('account', {})
    const org = settings?.organization || {}
    const billing = settings?.billing || {}
    const manualPay = settings?.payments?.manual || {}
    const sellerAddress =
      joinAddress(
        billing.address,
        org.address_line1,
        org.address_line2,
        org.locality,
        org.city,
        org.country,
      ) || PLATFORM.address
    return {
      sellerName: PLATFORM.name,
      sellerEmail: PLATFORM.email,
      sellerAddress,
      sellerPhone: String(manualPay.phone || billing.phone || PLATFORM.phone || '').trim(),
      sellerGstin: billing.gstin || '',
      logoUrl: String(org.logoUrl || '').trim(),
      manualPay,
      contactName: PLATFORM.name,
      contactEmail: PLATFORM.email,
      contactPhone: String(manualPay.phone || billing.phone || PLATFORM.phone || '').trim(),
      contactAddress: sellerAddress,
    }
  } catch {
    return {
      sellerName: PLATFORM.name,
      sellerEmail: PLATFORM.email,
      sellerAddress: PLATFORM.address,
      sellerPhone: '',
      sellerGstin: '',
      logoUrl: '',
      manualPay: {},
      contactName: PLATFORM.name,
      contactEmail: PLATFORM.email,
      contactPhone: '',
      contactAddress: PLATFORM.address,
    }
  }
}

const LINE_CATS = [
  { id: 'stocked', label: 'Catalog' },
  { id: 'custom', label: 'Custom service' },
  { id: 'service', label: 'Service visit' },
  { id: 'on_request', label: 'Man power' },
]

const DEFAULT_TERMS = [
  'Payment as agreed; advance may be required for custom packages.',
  'Services subject to caregiver availability at the venue.',
  'Prices exclude hospital / pharmacy pass-through unless listed.',
  'Cancellation per organization policy.',
  'Subject to laws of India.',
].join('\n')

const isManPowerLine = (ln = {}) =>
  Boolean(ln.onRequest) || ln.category === 'on_request'

/** Portal-style CGST + SGST halves (intra-state). Value stored = total %. */
const CGST_SGST_RATE_OPTIONS = [
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
const IGST_RATE_OPTIONS = [
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

const GST_NOT_APPL = 'na'

const resolveGstRatePct = (ln = {}) => {
  const raw = ln.gstRate
  if (raw === GST_NOT_APPL || raw === 'NA') return 0
  if (raw === '' || raw == null) return 18
  const n = Number(raw)
  return Number.isFinite(n) ? n : 18
}

const gstSelectValue = (ln = {}) => {
  if (ln.gstRate === GST_NOT_APPL || ln.gstRate === 'NA') return GST_NOT_APPL
  if (ln.gstRate === '' || ln.gstRate == null) return ''
  const n = Number(ln.gstRate)
  return Number.isFinite(n) ? String(n) : ''
}

const UOM_OPTIONS = [
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

const emptyLine = () => ({
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
const lineGstSplit = (ln, { intraState, hasBuyerState }) => {
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

const fmtDate = (d) =>
  d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  })

const statusBadgeClass = (status) => {
  const s = String(status || '').toUpperCase()
  if (s === 'SENT') return 'border border-stone-300 bg-white text-stone-800'
  if (s === 'ACCEPTED') return 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100'
  if (s === 'SUPERSEDED' || s === 'EXPIRED') return 'bg-stone-100 text-stone-600'
  return 'bg-stone-100 text-stone-700'
}

const blankForm = () => {
  const s = readPlatformSeller()
  return {
    company: '',
    legalName: '',
    attention: '',
    address: '',
    gstin: '',
    stateCode: '',
    buyerEmail: '',
    ccEmails: '',
    bccEmails: '',
    shipTo: 'Same as above',
    yourRef: '',
    quoteNumber: '',
    validityDays: 30,
    notes: '',
    terms: DEFAULT_TERMS,
    // Header (company letterhead) — editable on the quote
    sellerName: s.sellerName,
    sellerAddress: s.sellerAddress,
    sellerPhone: s.sellerPhone,
    sellerGstin: s.sellerGstin,
    logoUrl: s.logoUrl,
    // Your contact — person details only
    contactName: s.contactName,
    contactPhone: s.contactPhone,
    contactEmail: s.contactEmail,
    lines: [emptyLine()],
  }
}

const QuoteEditorPage = () => {
  const navigate = useNavigate()
  const { quoteId } = useParams()
  const isNew = !quoteId || quoteId === 'new'
  const { canWrite, isSuperAdmin } = useAccess()
  const [existing, setExisting] = useState(null)
  const [loadingQuote, setLoadingQuote] = useState(!isNew)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  /** When set, a SENT quote is being revised locally; Send calls /revise/. */
  const [revisingFromId, setRevisingFromId] = useState(null)
  const isRevising = Boolean(revisingFromId)
  const family = useMemo(() => (existing ? [existing] : []), [existing])
  const statusKey = String(existing?.status || '').toUpperCase()
  const isDraft = isNew || statusKey === 'DRAFT' || isRevising
  const lockedByStatus = Boolean(existing) && !isDraft
  const readOnly = canWrite === false || lockedByStatus
  const seller = useMemo(() => readPlatformSeller(), [])
  const {
    contactName: defaultContactName,
    contactEmail: defaultContactEmail,
    contactPhone: defaultContactPhone,
  } = seller
  const [testEmails, setTestEmails] = useState(() =>
    [PLATFORM.email, 'ops@o-hm.com'].filter(Boolean),
  )
  const [testEmailDraft, setTestEmailDraft] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)
  const [testBusy, setTestBusy] = useState(false)
  const [gstLookupBusy, setGstLookupBusy] = useState(false)
  const [gstLookupNote, setGstLookupNote] = useState('')
  const [gstCaptchaBusy, setGstCaptchaBusy] = useState(false)
  const [gstCaptchaImage, setGstCaptchaImage] = useState('')
  const [gstCaptchaCookie, setGstCaptchaCookie] = useState('')
  const [gstCaptchaText, setGstCaptchaText] = useState('')
  const portalCaptcha = gstinUsesCaptcha()

  const quoteDate = useMemo(() => {
    if (existing?.date) {
      const d = new Date(existing.date)
      if (!Number.isNaN(d.getTime())) return d
    }
    return new Date()
  }, [existing])

  const [status, setStatus] = useState({ type: '', message: '' })
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(() => blankForm())

  useEffect(() => {
    if (!isSuperAdmin) return undefined
    if (isNew) {
      setExisting(null)
      setLoadError('')
      setLoadingQuote(false)
      setRevisingFromId(null)
      setForm(blankForm())
      return undefined
    }

    let cancelled = false
    ;(async () => {
      setLoadingQuote(true)
      setLoadError('')
      setRevisingFromId(null)
      try {
        const quote = await fetchPlatformQuoteById(quoteId)
        if (cancelled) return
        setExisting(quote)
        setForm(formFromQuote(quote))
      } catch (err) {
        if (cancelled) return
        setExisting(null)
        setLoadError(apiErrorMessage(err, 'Could not load quote.'))
      } finally {
        if (!cancelled) setLoadingQuote(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [quoteId, isNew, isSuperAdmin, reloadKey])

  const validityDays = Math.max(1, Math.min(3650, Number(form.validityDays) || 30))
  const validUntil = useMemo(() => {
    const d = new Date(quoteDate)
    d.setDate(d.getDate() + validityDays)
    return d
  }, [quoteDate, validityDays])

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const headerName = form.sellerName || seller.sellerName || PLATFORM.name
  const headerAddress = form.sellerAddress || seller.sellerAddress || ''
  const headerPhone = form.sellerPhone || seller.sellerPhone || ''
  const headerGstin = form.sellerGstin || seller.sellerGstin || ''
  const headerLogo = form.logoUrl || seller.logoUrl || ''

  const onLogoFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => set('logoUrl', String(reader.result || ''))
    reader.readAsDataURL(file)
  }

  const patchLine = (id, patch) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((ln) => (ln.id === id ? { ...ln, ...patch } : ln)),
    }))
  }

  const addLine = () => {
    if (form.lines.length >= 30) {
      setStatus({ type: 'error', message: 'Maximum 30 lines per quote.' })
      return
    }
    setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))
  }

  const removeLine = (id) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.length <= 1 ? f.lines : f.lines.filter((ln) => ln.id !== id),
    }))
  }

  const moveLine = (id, dir) => {
    setForm((f) => {
      const idx = f.lines.findIndex((ln) => ln.id === id)
      if (idx < 0) return f
      const next = idx + dir
      if (next < 0 || next >= f.lines.length) return f
      const lines = [...f.lines]
      ;[lines[idx], lines[next]] = [lines[next], lines[idx]]
      return { ...f, lines }
    })
  }

  const buyerState = useMemo(() => {
    const fromGst = stateFromGstin(form.gstin)
    if (fromGst) return fromGst
    return IN_STATES.find((s) => s.code === form.stateCode) || null
  }, [form.gstin, form.stateCode])

  const intraState = buyerState ? buyerState.code === SELLER_STATE_CODE : null

  const linesComputed = form.lines.map((ln) => {
    const split = lineGstSplit(ln, {
      intraState: intraState === true,
      hasBuyerState: Boolean(buyerState),
    })
    return { ...ln, amount: split.taxable, ...split }
  })

  const subtotal = linesComputed.reduce((s, ln) => s + ln.taxable, 0)
  const cgstTotal = linesComputed.reduce((s, ln) => s + ln.cgst, 0)
  const sgstTotal = linesComputed.reduce((s, ln) => s + ln.sgst, 0)
  const igstTotal = linesComputed.reduce((s, ln) => s + ln.igst, 0)
  const gstAmount = cgstTotal + sgstTotal + igstTotal
  const total = subtotal + gstAmount

  const displayQuoteNo =
    String(form.quoteNumber || '').trim() ||
    (existing?.numberRaw ? String(existing.numberRaw) : '') ||
    (isNew ? '' : String(existing?.number || '').replace(/\s*R\d+\s*$/i, '').trim())

  const blockers = useMemo(() => {
    const list = []
    if (!String(form.company).trim()) list.push('Add the customer name.')
    if (!String(form.gstin).trim() && !form.stateCode) {
      list.push(
        "Add the buyer's GSTIN or state, so GST can be split (CGST + SGST in Karnataka, IGST outside).",
      )
    }
    form.lines.forEach((ln, i) => {
      if (!String(ln.item).trim()) list.push(`Line ${i + 1} needs an item name.`)
      if (!String(ln.hsn || '').trim()) list.push(`Line ${i + 1} needs HSN/SAC.`)
      if (!isManPowerLine(ln) && !(Number(ln.unitPrice) > 0)) {
        list.push(`Line ${i + 1} needs a unit price, or mark it Man power.`)
      }
    })
    if (!String(form.buyerEmail).trim()) {
      list.push("Add the buyer's email to send the quote.")
    } else if (!isValidEmail(form.buyerEmail)) {
      list.push("Buyer's email looks invalid.")
    }
    const splitMails = (raw) =>
      String(raw || '')
        .split(/[,;\s]+/)
        .map((e) => e.trim())
        .filter(Boolean)
    for (const email of splitMails(form.ccEmails)) {
      if (!isValidEmail(email)) list.push(`CC email looks invalid: ${email}`)
    }
    for (const email of splitMails(form.bccEmails)) {
      if (!isValidEmail(email)) list.push(`BCC email looks invalid: ${email}`)
    }
    return list
  }, [form])

  const canSend = blockers.length === 0

  const persistDraft = async (asSent) => {
    if (canWrite === false) {
      setStatus({ type: 'error', message: 'You do not have permission to save quotes.' })
      return
    }
    if (lockedByStatus) {
      setStatus({
        type: 'error',
        message: 'Only draft quotes can be edited. Sent or superseded quotes are view-only.',
      })
      return
    }
    if (asSent && !canSend) {
      setStatus({ type: 'error', message: 'Fix the checklist below before sending.' })
      return
    }

    if (!String(form.company).trim()) {
      setStatus({ type: 'error', message: 'Add the customer name.' })
      return
    }
    if (!form.lines.some((ln) => String(ln.item || '').trim())) {
      setStatus({ type: 'error', message: 'Add at least one line item.' })
      return
    }

    setSaving(true)
    setStatus({ type: '', message: '' })
    try {
      // Revision of a sent quote → edit locally, then POST .../revise/ on Send
      if (isRevising && asSent) {
        const sourceId = revisingFromId || existing?.id || quoteId
        let revised = await revisePlatformQuote(sourceId)
        const revisedStatus = String(revised.status || '').toUpperCase()
        if (revisedStatus === 'DRAFT') {
          revised = await updatePlatformQuote(
            revised.id,
            { ...form, validityDays },
            { freight: Number(existing?.payload?.freight) || 0 },
          )
          revised = await sendPlatformQuote(revised.id, {
            cc: form.ccEmails,
            bcc: form.bccEmails,
          })
        }
        setRevisingFromId(null)
        setExisting(revised)
        setForm(formFromQuote(revised))
        setStatus({
          type: 'success',
          message: `Quote ${revised.number} revision sent.`,
        })
        window.setTimeout(() => navigate(`/ops/quotations/${revised.id}`), 600)
        return
      }

      if (isRevising && !asSent) {
        setStatus({
          type: 'success',
          message: 'Revision edits kept on this screen. Press Send email to create and send the revision.',
        })
        return
      }

      // New → POST; existing draft → PATCH /api/platform/quotes/:id/
      let saved = isNew
        ? await createPlatformQuote({ ...form, validityDays }, { freight: 0 })
        : await updatePlatformQuote(
            existing?.id || quoteId,
            { ...form, validityDays },
            { freight: Number(existing?.payload?.freight) || 0 },
          )

      if (asSent) {
        saved = await sendPlatformQuote(saved.id, {
          cc: form.ccEmails,
          bcc: form.bccEmails,
        })
        setExisting(saved)
        setForm(formFromQuote(saved))
        setStatus({
          type: 'success',
          message: `Quote ${saved.number} sent.`,
        })
        window.setTimeout(() => navigate(`/ops/quotations/${saved.id}`), 600)
        return
      }

      setExisting(saved)
      setForm(formFromQuote(saved))
      setStatus({
        type: 'success',
        message: `Quote ${saved.number} saved.`,
      })
      if (isNew) {
        window.setTimeout(() => navigate(`/ops/quotations/${saved.id}`), 600)
      }
    } catch (err) {
      setStatus({
        type: 'error',
        message: apiErrorMessage(
          err,
          asSent
            ? isRevising
              ? 'Could not revise quote.'
              : 'Could not send quote.'
            : isNew
              ? 'Could not create quote.'
              : 'Could not update quote.',
        ),
      })
    } finally {
      setSaving(false)
    }
  }

  const sectionLabel = 'text-[11px] font-bold uppercase tracking-wide text-brand-700'

  if (!isSuperAdmin) {
    return (
      <TenantOpsPlaceholder
        title="Quotes"
        description="Your organization’s quotes will appear here when tenant quoting is enabled."
      />
    )
  }

  if (!isNew && loadingQuote) {
    return (
      <div className="sc-page-enter">
        <LoadingState label="Loading quote…" />
      </div>
    )
  }

  if (!isNew && loadError) {
    return (
      <div className="sc-page-enter space-y-4">
        <ErrorState
          message={loadError}
          onRetry={() => setReloadKey((n) => n + 1)}
        />
        <div className="flex justify-center">
          <Link to="/ops/quotations" className={btnSecondary}>
            Back to quotes
          </Link>
        </div>
      </div>
    )
  }

  const clearGstCaptcha = () => {
    setGstCaptchaImage('')
    setGstCaptchaCookie('')
    setGstCaptchaText('')
  }

  const loadGstCaptcha = async () => {
    setGstCaptchaBusy(true)
    setGstLookupNote('')
    try {
      const hit = await fetchGstCaptcha()
      setGstCaptchaImage(hit.captchaImage)
      setGstCaptchaCookie(hit.captchaCookie)
      setGstCaptchaText('')
    } catch (err) {
      clearGstCaptcha()
      setGstLookupNote(apiErrorMessage(err, 'Could not load GST captcha.'))
    } finally {
      setGstCaptchaBusy(false)
    }
  }

  const applyGstHit = (gstin, hit) => {
    const legalName = hit.legalName || ''
    const tradeOrLegal = hit.company || legalName
    setForm((f) => {
      const prevLegal = String(f.legalName || '').trim()
      const attentionWasGstName =
        f.attention &&
        [legalName, hit.ownerName, prevLegal].some(
          (n) => n && String(f.attention).trim() === String(n).trim(),
        )
      return {
      ...f,
      gstin,
      company: tradeOrLegal || f.company,
      legalName: legalName || f.legalName,
      attention: attentionWasGstName ? '' : f.attention,
      address: hit.address || f.address,
      stateCode: hit.stateCode || f.stateCode,
      shipTo:
        f.shipTo && f.shipTo !== 'Same as above' && f.shipTo !== f.address
          ? f.shipTo
          : hit.address || f.shipTo || f.address,
    }
    })
    if (hit.partial) {
      setGstLookupNote(
        hit.note ||
          'State filled from GSTIN. Use the captcha lookup for full company details.',
      )
    } else {
      const bits = []
      if (tradeOrLegal) bits.push(`Customer: ${tradeOrLegal}`)
      if (legalName && legalName !== tradeOrLegal) bits.push(`Legal name: ${legalName}`)
      if (hit.status) bits.push(hit.status)
      setGstLookupNote(
        bits.length ? bits.join(' · ') : 'GSTIN found — review customer and address.',
      )
    }
  }

  const runGstLookup = async (rawGstin, captchaOpts = null) => {
    const gstin = String(rawGstin || '').trim().toUpperCase()
    if (!isValidGstinFormat(gstin)) {
      setGstLookupNote(
        gstin.length === 15 ? 'That GSTIN format or checksum looks invalid.' : '',
      )
      return
    }

    if (portalCaptcha && !captchaOpts) {
      await loadGstCaptcha()
      setGstLookupNote('Solve the captcha, then fetch GST details.')
      return
    }

    setGstLookupBusy(true)
    setGstLookupNote('Looking up GSTIN…')
    try {
      const hit = await lookupGstin(gstin, captchaOpts || {})
      applyGstHit(gstin, hit)
      if (portalCaptcha) clearGstCaptcha()
    } catch (err) {
      setGstLookupNote(apiErrorMessage(err, 'Could not look up this GSTIN.'))
      if (portalCaptcha && err?.code === 'SWEB_9000') {
        await loadGstCaptcha()
      }
    } finally {
      setGstLookupBusy(false)
    }
  }

  const submitGstCaptchaLookup = async () => {
    const gstin = String(form.gstin || '').trim().toUpperCase()
    if (!isValidGstinFormat(gstin)) {
      setGstLookupNote('Enter a valid 15-character GSTIN first.')
      return
    }
    if (!gstCaptchaCookie || !String(gstCaptchaText || '').trim()) {
      setGstLookupNote('Enter the captcha text shown in the image.')
      return
    }
    await runGstLookup(gstin, {
      captcha: gstCaptchaText,
      captchaCookie: gstCaptchaCookie,
    })
  }

  const handleMakeRevision = () => {
    if (canWrite === false || !existing) return
    const key = String(existing.status || '').toUpperCase()
    if (key === 'SUPERSEDED') {
      setStatus({
        type: 'error',
        message: 'Superseded quotes cannot be edited or revised.',
      })
      return
    }
    if (key !== 'SENT' && key !== 'ACCEPTED') {
      setStatus({
        type: 'error',
        message: 'Only sent quotes can be revised.',
      })
      return
    }
    setRevisingFromId(String(existing.id))
    setForm(formFromQuote(existing))
    setStatus({
      type: 'info',
      message:
        'Revision mode — edit lines or prices, then press Send email to create and send the revision.',
    })
  }

  const handleDownloadPdf = async () => {
    const id = existing?.id || quoteId
    if (!id || id === 'new') {
      setStatus({ type: 'error', message: 'Save the quote before downloading a PDF.' })
      return
    }
    setPdfBusy(true)
    setStatus({ type: '', message: '' })
    try {
      const { blob, filename } = await downloadPlatformQuotePdf(id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename || `quote-${id}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      setStatus({ type: 'success', message: 'PDF downloaded.' })
    } catch (err) {
      setStatus({
        type: 'error',
        message: apiErrorMessage(err, 'Could not download PDF.'),
      })
    } finally {
      setPdfBusy(false)
    }
  }

  const addTestEmail = () => {
    const email = String(testEmailDraft || '').trim().toLowerCase()
    if (!isValidEmail(email)) {
      setStatus({ type: 'error', message: 'Enter a valid test email address.' })
      return
    }
    if (testEmails.some((e) => e.toLowerCase() === email)) {
      setStatus({ type: 'error', message: 'That email is already in the list.' })
      return
    }
    setTestEmails((list) => [...list, email])
    setTestEmailDraft('')
    setStatus({ type: '', message: '' })
  }

  const removeTestEmail = (email) => {
    setTestEmails((list) => list.filter((e) => e !== email))
  }

  const handleTestSend = async () => {
    if (!isDraft || isRevising) {
      setStatus({ type: 'error', message: 'Test send is only available for draft quotes.' })
      return
    }
    const id = existing?.id || quoteId
    if (!id || id === 'new') {
      setStatus({ type: 'error', message: 'Save the quote before sending a test.' })
      return
    }
    if (!testEmails.length) {
      setStatus({ type: 'error', message: 'Add at least one test recipient.' })
      return
    }
    setTestBusy(true)
    setStatus({ type: '', message: '' })
    try {
      await sendPlatformQuoteTest(id, testEmails)
      setStatus({
        type: 'success',
        message: `Test email sent to ${testEmails.join(', ')}.`,
      })
    } catch (err) {
      setStatus({
        type: 'error',
        message: apiErrorMessage(err, 'Could not send test email.'),
      })
    } finally {
      setTestBusy(false)
    }
  }

  const previewCard = (
    <div className="overflow-hidden rounded-2xl border border-stone-300 bg-white shadow-md">
      <div className="space-y-3 p-4 text-[11px] leading-relaxed text-stone-700">
        {/* Header: editable company letterhead (left) · QUOTATION + meta (right) */}
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 pb-3">
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            {headerLogo ? (
              <img
                src={headerLogo}
                alt=""
                className="h-11 w-11 shrink-0 rounded-lg border border-stone-200 bg-white object-contain"
              />
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ink text-[11px] font-bold text-white">
                {(headerName || 'SC').slice(0, 2).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-lg font-bold tracking-tight text-brand-700">{headerName}</p>
              {headerAddress ? (
                <p className="mt-1 whitespace-pre-wrap text-[10px] leading-snug text-stone-600">
                  {headerAddress}
                </p>
              ) : null}
              {headerPhone ? (
                <p className="text-[10px] text-stone-600">Ph: {headerPhone}</p>
              ) : null}
              {headerGstin ? (
                <p className="text-[10px] text-stone-600">GSTIN {headerGstin}</p>
              ) : null}
            </div>
          </div>
          <div className="w-[42%] max-w-[200px] shrink-0 text-right">
            <p className="text-2xl font-bold uppercase tracking-wide text-brand-700">Quotation</p>
            <div className="mt-2 space-y-0.5 text-left text-[10px]">
              <div className="flex justify-between gap-2">
                <span className="text-stone-500">Quote no.</span>
                <span className="font-semibold text-stone-900">
                  {displayQuoteNo || (isNew ? '—' : existing?.number || '—')}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-stone-500">Date</span>
                <span className="text-stone-800">{fmtDate(quoteDate)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-stone-500">Revision</span>
                <span className="text-stone-800">R{existing?.revision ?? 0}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-stone-500">Your ref.</span>
                <span className="max-w-[55%] truncate text-right text-stone-800">
                  {form.yourRef || '—'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-stone-500">Valid till</span>
                <span className="text-stone-800">{fmtDate(validUntil)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Parties */}
        <div className="grid gap-3 border-y border-stone-100 py-3 sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
              Quoted to
            </p>
            <p className="mt-1 font-semibold text-stone-900">{form.company || '—'}</p>
            {form.legalName &&
            String(form.legalName).trim() !== String(form.company || '').trim() ? (
              <p className="whitespace-pre-wrap text-stone-600">{form.legalName}</p>
            ) : null}
            {form.attention ? (
              <p className="whitespace-pre-wrap text-stone-600">{form.attention}</p>
            ) : null}
            {form.address ? (
              <p className="whitespace-pre-wrap text-stone-600">{form.address}</p>
            ) : null}
            {form.gstin ? <p className="text-stone-600">GSTIN {form.gstin}</p> : null}
            {buyerState ? <p className="text-stone-600">{buyerState.name}</p> : null}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Ship to</p>
            <p className="mt-1 whitespace-pre-wrap font-semibold text-stone-900">
              {form.shipTo || '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
              Your contact
            </p>
            <p className="mt-1 font-semibold text-stone-900">
              {form.contactName || defaultContactName || '—'}
            </p>
            {(form.contactPhone || defaultContactPhone) ? (
              <p className="text-stone-600">Ph: {form.contactPhone || defaultContactPhone}</p>
            ) : null}
            {(form.contactEmail || defaultContactEmail) ? (
              <p className="text-stone-600">{form.contactEmail || defaultContactEmail}</p>
            ) : null}
          </div>
        </div>

        {/* Lines — same columns as reference template */}
        <table className="w-full table-fixed border-collapse text-[9px]">
          <colgroup>
            <col className="w-[5%]" />
            <col className="w-[28%]" />
            <col className="w-[10%]" />
            <col className="w-[7%]" />
            <col className="w-[8%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-stone-300 text-left uppercase tracking-wide text-stone-500">
              <th className="px-1 py-1.5 font-semibold">#</th>
              <th className="px-1 py-1.5 font-semibold">Item &amp; specification</th>
              <th className="px-1 py-1.5 font-semibold">HSN/SAC</th>
              <th className="px-1 py-1.5 text-right font-semibold">Qty</th>
              <th className="px-1 py-1.5 text-right font-semibold">Unit</th>
              <th className="px-1 py-1.5 text-right font-semibold">Price</th>
              <th className="px-1 py-1.5 text-right font-semibold">Lead</th>
              <th className="px-1 py-1.5 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {linesComputed.map((ln, i) => (
              <tr key={ln.id} className="border-b border-stone-200 align-top">
                <td className="px-1 py-1.5 text-stone-500">
                  {String(i + 1).padStart(2, '0')}
                </td>
                <td className="px-1 py-1.5">
                  <p className="font-semibold text-stone-900">{ln.item || '—'}</p>
                  {ln.specification ? (
                    <p className="mt-0.5 text-stone-500">{ln.specification}</p>
                  ) : null}
                  {Number(ln.discountPct) > 0 ? (
                    <p className="mt-0.5 text-stone-400">Disc {Number(ln.discountPct)}%</p>
                  ) : null}
                </td>
                <td className="px-1 py-1.5 text-stone-600">{ln.hsn || '—'}</td>
                <td className="px-1 py-1.5 text-right tabular-nums">{ln.qty}</td>
                <td className="px-1 py-1.5 text-right uppercase text-stone-600">
                  {ln.uom || '—'}
                </td>
                <td className="px-1 py-1.5 text-right tabular-nums">
                  {isManPowerLine(ln) ? '—' : fmtMoney(ln.unitPrice)}
                </td>
                <td className="px-1 py-1.5 text-right text-stone-600">{ln.leadTime || '—'}</td>
                <td className="px-1 py-1.5 text-right font-medium tabular-nums">
                  {isManPowerLine(ln) ? 'Man power' : fmtMoney(ln.taxable)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Amount in words + totals */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-[55%] text-[10px] text-stone-600">
            <p>
              <span className="font-semibold text-stone-800">Amount in words: </span>
              <span className="italic">{amountInWords(total)}</span>
            </p>
            {form.notes ? (
              <p className="mt-1 whitespace-pre-wrap text-stone-500">{form.notes}</p>
            ) : null}
          </div>
          <div className="ml-auto min-w-[160px] space-y-0.5 border border-stone-200 bg-stone-50 px-2.5 py-2 text-[10px]">
            <div className="flex justify-between gap-4">
              <span className="text-stone-500">Subtotal</span>
              <span className="tabular-nums">{fmtMoney(subtotal)}</span>
            </div>
            {intraState === true ? (
              <>
                <div className="flex justify-between gap-4">
                  <span className="text-stone-500">CGST</span>
                  <span className="tabular-nums">{fmtMoney(cgstTotal)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-stone-500">SGST</span>
                  <span className="tabular-nums">{fmtMoney(sgstTotal)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between gap-4">
                <span className="text-stone-500">IGST</span>
                <span className={`tabular-nums ${buyerState ? '' : 'text-rose-600'}`}>
                  {buyerState ? fmtMoney(igstTotal) : 'State needed'}
                </span>
              </div>
            )}
            <div className="flex justify-between gap-4 border-t border-stone-200 pt-1 font-bold text-stone-900">
              <span>Total</span>
              <span className="tabular-nums">{fmtMoney(total)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-1 border-t border-stone-100 pt-3 text-[10px] text-stone-500">
          <p className="font-semibold text-stone-700">Terms</p>
          <ol className="list-decimal space-y-0.5 pl-4">
            <li>
              Validity {validityDays} day{validityDays === 1 ? '' : 's'} from quote date (until{' '}
              {fmtDate(validUntil)}) unless stated otherwise.
            </li>
            {String(form.terms || '')
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line) => (
                <li key={line}>{line}</li>
              ))}
          </ol>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-stone-100 pt-3">
          <div>
            <p className="font-bold text-stone-800">Accept this quote</p>
            <button type="button" className={`${btnPrimary} mt-2`} disabled>
              Accept quote online →
            </button>
          </div>
          <p className="text-right text-stone-500">
            For {headerName}
            <br />
            Authorized signatory
          </p>
        </div>
      </div>
    </div>
  )

  if (!isNew && !existing) {
    return (
      <div className="sc-page-enter space-y-4">
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-10 text-center">
          <p className="font-medium text-rose-800">Quote not found</p>
          <p className="mt-1 text-sm text-rose-700">
            It may have been removed, or the link is wrong.
          </p>
          <Link to="/ops/quotations" className={`${btnPrimary} mt-4 inline-flex`}>
            Back to quotes
          </Link>
        </div>
      </div>
    )
  }

  if (lockedByStatus && existing) {
    const history = Array.isArray(existing.history) ? existing.history : []
    const displayTotal =
      existing.gstSet && existing.totalInclGst != null ? existing.totalInclGst : total
    const baseLabel = String(existing.number || '')
      .replace(/\s*R\d+\s*$/i, '')
      .trim()

    return (
      <div className="sc-page-enter space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-brand-700">
              <Link to="/ops/quotations" className="hover:underline">
                Quotes
              </Link>
              <span className="text-stone-300"> / </span>
              {baseLabel || existing.number}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-stone-900">
                {baseLabel || existing.number}
              </h1>
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusBadgeClass(
                  statusKey,
                )}`}
              >
                {statusKey}
              </span>
            </div>
          </div>
          <Link to="/ops/quotations" className={btnSecondary}>
            Back to quotes
          </Link>
        </div>

        <StatusBanner type={status.type} message={status.message} />

        {family.length > 1 ? (
          <div
            role="tablist"
            aria-label="Revisions"
            className="inline-flex flex-wrap gap-1 rounded-xl border border-stone-200 bg-stone-50 p-1"
          >
            {family.map((rev) => {
              const on = rev.id === existing.id
              const label = `R${rev.revision ?? 0} · ${String(rev.status || '').toLowerCase()}`
              return (
                <button
                  key={rev.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => navigate(`/ops/quotations/${rev.id}`)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 ${
                    on
                      ? 'bg-ink text-white shadow-sm'
                      : 'text-stone-500 hover:bg-white hover:text-stone-800'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
              <h2 className={sectionLabel}>Status</h2>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-stone-500">Total incl. GST</dt>
                  <dd className="font-semibold text-stone-900">
                    {existing.gstSet ? fmtMoney(displayTotal) : 'GST not set'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-stone-500">Quote date</dt>
                  <dd className="text-stone-800">{fmtDate(quoteDate)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-stone-500">Valid until</dt>
                  <dd className="text-stone-800">{fmtDate(validUntil)}</dd>
                </div>
                {existing.sentAt ? (
                  <div>
                    <dt className="text-stone-500">Sent</dt>
                    <dd className="mt-0.5 text-stone-800">
                      {fmtDateTime(existing.sentAt)}
                      {existing.sentTo?.length ? (
                        <span className="block text-xs text-stone-500">
                          to {existing.sentTo.join(', ')}
                          {existing.sentBy ? ` · by ${existing.sentBy}` : ''}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                ) : null}
              </dl>

              {statusKey === 'SUPERSEDED' ? (
                <p className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs leading-relaxed text-stone-600">
                  Superseded — view only. A newer revision was sent; this quote cannot be edited or
                  revised.
                </p>
              ) : statusKey === 'SENT' ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900">
                  Waiting on the customer. This revision is view-only — make a revision to change
                  lines or prices.
                </p>
              ) : (
                <p className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs leading-relaxed text-stone-600">
                  This quote is view-only. Only drafts can be edited.
                </p>
              )}

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={pdfBusy}
                  onClick={handleDownloadPdf}
                >
                  <FiDownload className="h-4 w-4" aria-hidden />
                  {pdfBusy ? 'Downloading…' : 'Download PDF'}
                </button>
                {canWrite !== false && statusKey !== 'SUPERSEDED' ? (
                  <button type="button" className={btnSecondary} onClick={handleMakeRevision}>
                    Make a revision
                  </button>
                ) : null}
              </div>

            </section>

            <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
              <h2 className={sectionLabel}>History</h2>
              {history.length === 0 ? (
                <p className="text-sm text-stone-500">No history yet.</p>
              ) : (
                <ol className="relative space-y-4 border-l border-stone-200 pl-4">
                  {history.map((h, i) => (
                    <li key={`${h.type}-${h.at}-${i}`} className="relative text-sm">
                      <span className="absolute -left-[1.3rem] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white" />
                      <p className="font-semibold text-stone-900">
                        {h.type === 'sent'
                          ? 'Sent to the buyer'
                          : h.type === 'created'
                            ? 'Created'
                            : h.type}
                      </p>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {fmtDateTime(h.at)}
                        {h.to ? ` · to ${h.to}` : ''}
                        {h.by ? ` · ${h.by}` : ''}
                      </p>
                      {h.note ? <p className="mt-0.5 text-xs text-stone-500">{h.note}</p> : null}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <aside>{previewCard}</aside>
        </div>
      </div>
    )
  }

  return (
    <div className="sc-page-enter space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-brand-700">
            <Link to="/ops/quotations" className="hover:underline">
              Quotes
            </Link>
            <span className="text-stone-300"> / </span>
            {isNew ? 'New' : existing.number}
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-stone-900">
            {isNew ? 'New quote' : 'Edit quote'}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-stone-500">
            {isNew
              ? `Set a quote number below (or leave blank for the server to assign one). Valid for ${validityDays} day${
                  validityDays === 1 ? '' : 's'
                } from today (until ${fmtDate(validUntil)}). Nothing is emailed until you press Send.`
              : `${existing.number} · ${existing.status}. Valid for ${validityDays} day${
                  validityDays === 1 ? '' : 's'
                } (until ${fmtDate(validUntil)}).`}
          </p>
        </div>
        <Link to="/ops/quotations" className={btnSecondary}>
          Back to quotes
        </Link>
      </div>

      <StatusBanner type={status.type} message={status.message} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,440px)]">
        {/* FORM */}
        <fieldset disabled={readOnly} className="min-w-0 space-y-5 border-0 p-0">
          <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
            <h2 className={sectionLabel}>Quoted to</h2>
            <label className="block">
              <span className={labelClass}>Customer</span>
              <input
                className={fieldClass}
                value={form.company}
                onChange={(e) => set('company', e.target.value)}
                disabled={gstLookupBusy}
              />
            </label>
            {form.legalName &&
            String(form.legalName).trim() !== String(form.company || '').trim() ? (
              <p className="text-[11px] text-stone-500">
                Legal name (on quote): {form.legalName}
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Attention / department</span>
                <textarea
                  className={`${fieldClass} min-h-[72px]`}
                  placeholder="Contact person or department (optional)"
                  value={form.attention}
                  onChange={(e) => set('attention', e.target.value)}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Address</span>
                <textarea
                  className={`${fieldClass} min-h-[72px]`}
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  disabled={gstLookupBusy}
                />
              </label>
            </div>
            <label className="block">
              <span className={labelClass}>Buyer&apos;s email (To)</span>
              <input
                type="email"
                className={fieldClass}
                placeholder="buyer@company.com"
                value={form.buyerEmail}
                onChange={(e) => set('buyerEmail', e.target.value)}
              />
              <span className="mt-1 block text-[11px] text-stone-500">
                Primary recipient — the quote is sent here.
              </span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>CC</span>
                <input
                  type="text"
                  className={fieldClass}
                  placeholder="cc1@email.com, cc2@email.com"
                  value={form.ccEmails}
                  onChange={(e) => set('ccEmails', e.target.value)}
                  autoComplete="off"
                />
                <span className="mt-1 block text-[11px] text-stone-500">
                  Optional. Comma-separated.
                </span>
              </label>
              <label className="block">
                <span className={labelClass}>BCC</span>
                <input
                  type="text"
                  className={fieldClass}
                  placeholder="bcc@email.com"
                  value={form.bccEmails}
                  onChange={(e) => set('bccEmails', e.target.value)}
                  autoComplete="off"
                />
                <span className="mt-1 block text-[11px] text-stone-500">
                  Optional. Comma-separated.
                </span>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>GSTIN</span>
                <input
                  className={fieldClass}
                  placeholder="15 characters"
                  maxLength={15}
                  value={form.gstin}
                  onChange={(e) => {
                    const gstin = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '')
                    const st = stateFromGstin(gstin)
                    setForm((f) => ({
                      ...f,
                      gstin,
                      stateCode: st?.code || f.stateCode,
                    }))
                    setGstLookupNote('')
                    if (gstin.length < 15) clearGstCaptcha()
                    if (gstin.length === 15 && isValidGstinFormat(gstin)) {
                      runGstLookup(gstin)
                    }
                  }}
                  onBlur={() => {
                    const gstin = String(form.gstin || '').trim()
                    if (gstin.length === 15 && isValidGstinFormat(gstin)) {
                      if (portalCaptcha) {
                        if (!gstCaptchaImage && !gstCaptchaBusy) loadGstCaptcha()
                      } else {
                        runGstLookup(gstin)
                      }
                    }
                  }}
                />
                <span className="mt-1 block text-[11px] text-stone-500">
                  {gstLookupBusy
                    ? 'Looking up GSTIN…'
                    : gstCaptchaBusy
                      ? 'Loading captcha…'
                      : gstLookupNote ||
                        (portalCaptcha
                          ? 'Enter a valid GSTIN, then solve the captcha below.'
                          : gstinLookupConfigured()
                            ? 'Enter a valid GSTIN to prefill customer, address, and state.'
                            : 'Enter GSTIN to fill state. Set VITE_GSTIN_PROVIDER=portal (default) or a paid API key.')}
                </span>
                <a
                  className="mt-1 inline-flex text-[11px] font-medium text-brand-700 hover:underline"
                  href="https://services.gst.gov.in/services/searchtp"
                  target="_blank"
                  rel="noreferrer"
                >
                  Verify on GST portal ↗
                </a>
              </label>
              <label className="block">
                <span className={labelClass}>State</span>
                <select
                  className={fieldClass}
                  value={form.stateCode}
                  onChange={(e) => set('stateCode', e.target.value)}
                >
                  <option value="">Choose a state</option>
                  {IN_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] text-stone-500">
                  The GSTIN&apos;s first two digits, or else the state, decide the GST split.
                </span>
              </label>
              {portalCaptcha && (gstCaptchaImage || gstCaptchaBusy) ? (
                <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-stone-50/80 p-3 sm:col-span-2 sm:flex-row sm:items-end">
                  <div className="shrink-0">
                    <span className={labelClass}>GST captcha</span>
                    <div className="flex items-center gap-2">
                      {gstCaptchaBusy && !gstCaptchaImage ? (
                        <div className="flex h-12 w-36 items-center justify-center rounded-lg border border-stone-200 bg-white text-[11px] text-stone-500">
                          Loading…
                        </div>
                      ) : (
                        <img
                          src={`data:image/png;base64,${gstCaptchaImage}`}
                          alt="GST portal captcha"
                          className="h-12 w-auto rounded-lg border border-stone-200 bg-white"
                        />
                      )}
                      <button
                        type="button"
                        className={btnGhost}
                        aria-label="Refresh captcha"
                        disabled={gstCaptchaBusy || gstLookupBusy}
                        onClick={() => loadGstCaptcha()}
                      >
                        <FiRefreshCw
                          className={`h-3.5 w-3.5 ${gstCaptchaBusy ? 'animate-spin' : ''}`}
                          aria-hidden
                        />
                      </button>
                    </div>
                  </div>
                  <label className="min-w-0 flex-1">
                    <span className={labelClass}>Captcha text</span>
                    <input
                      className={fieldClass}
                      inputMode="text"
                      autoComplete="off"
                      placeholder="Enter characters from the image"
                      value={gstCaptchaText}
                      disabled={gstLookupBusy || gstCaptchaBusy || !gstCaptchaCookie}
                      onChange={(e) => setGstCaptchaText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          submitGstCaptchaLookup()
                        }
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className={`${btnPrimary} w-full sm:w-auto`}
                    disabled={
                      gstLookupBusy ||
                      gstCaptchaBusy ||
                      !gstCaptchaCookie ||
                      !String(gstCaptchaText || '').trim()
                    }
                    onClick={() => submitGstCaptchaLookup()}
                  >
                    {gstLookupBusy ? 'Fetching…' : 'Fetch details'}
                  </button>
                </div>
              ) : null}
            </div>
            <label className="block">
              <span className={labelClass}>Ship to (first line in bold)</span>
              <textarea
                className={`${fieldClass} min-h-[64px]`}
                value={form.shipTo}
                onChange={(e) => set('shipTo', e.target.value)}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Quote no.</span>
                <input
                  className={fieldClass}
                  placeholder="e.g. SC-Q-2610-001"
                  value={form.quoteNumber}
                  disabled={!isNew}
                  onChange={(e) => set('quoteNumber', e.target.value)}
                />
                <span className="mt-1 block text-[11px] text-stone-500">
                  {isNew
                    ? 'Shown on the quote. Leave blank to let the server assign one on save.'
                    : 'Assigned quote number.'}
                </span>
              </label>
              <label className="block">
                <span className={labelClass}>Your ref.</span>
                <input
                  className={fieldClass}
                  placeholder="Their enquiry or RFQ number"
                  value={form.yourRef}
                  onChange={(e) => set('yourRef', e.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className={sectionLabel}>
                Lines · {form.lines.length} of 30
              </h2>
              <button type="button" className={btnGhost} onClick={addLine}>
                <FiPlus className="h-3.5 w-3.5" aria-hidden />
                Add a line
              </button>
            </div>

            {linesComputed.map((ln, index) => (
              <div
                key={ln.id}
                className="space-y-2.5 rounded-xl border border-stone-200 bg-stone-50/50 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-stone-500">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className={btnGhost}
                      aria-label="Move up"
                      onClick={() => moveLine(ln.id, -1)}
                    >
                      <FiArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className={btnGhost}
                      aria-label="Move down"
                      onClick={() => moveLine(ln.id, 1)}
                    >
                      <FiArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className={`${btnGhost} text-rose-600`}
                      onClick={() => removeLine(ln.id)}
                    >
                      <FiTrash2 className="h-3.5 w-3.5" aria-hidden />
                      Remove
                    </button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
                  <label className="block">
                    <span className={labelClass}>Item · pick a catalog product or custom item</span>
                    <input
                      className={fieldClass}
                      placeholder="Search products, e.g. home nursing, physio package"
                      value={ln.item}
                      onChange={(e) => patchLine(ln.id, { item: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>HSN/SAC *</span>
                    <input
                      className={fieldClass}
                      required
                      aria-required="true"
                      placeholder="Required"
                      value={ln.hsn}
                      onChange={(e) => patchLine(ln.id, { hsn: e.target.value })}
                    />
                  </label>
                </div>
                <label className="block">
                  <span className={labelClass}>Specification</span>
                  <input
                    className={fieldClass}
                    value={ln.specification}
                    onChange={(e) => patchLine(ln.id, { specification: e.target.value })}
                  />
                </label>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                  <label className="block min-w-0">
                    <span className={labelClass}>Qty</span>
                    <input
                      type="number"
                      min={0}
                      className={fieldClass}
                      value={ln.qty}
                      onChange={(e) => patchLine(ln.id, { qty: e.target.value })}
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className={labelClass}>UOM</span>
                    <select
                      className={fieldClass}
                      value={ln.uom || 'Pcs'}
                      onChange={(e) => patchLine(ln.id, { uom: e.target.value })}
                    >
                      {UOM_OPTIONS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block min-w-0">
                    <span className={labelClass}>Unit price (₹)</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={fieldClass}
                      value={ln.unitPrice}
                      disabled={isManPowerLine(ln)}
                      onChange={(e) => patchLine(ln.id, { unitPrice: e.target.value })}
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className={labelClass}>Disc %</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      className={fieldClass}
                      value={ln.discountPct ?? 0}
                      disabled={isManPowerLine(ln)}
                      onChange={(e) => patchLine(ln.id, { discountPct: e.target.value })}
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className={labelClass}>Lead time</span>
                    <input
                      className={fieldClass}
                      value={ln.leadTime}
                      onChange={(e) => patchLine(ln.id, { leadTime: e.target.value })}
                    />
                  </label>
                  <div className="min-w-0">
                    <span className={labelClass}>Taxable</span>
                    <p className="rounded-lg border border-stone-200 bg-white px-2 py-2 text-sm font-medium tabular-nums text-stone-800">
                      {fmtMoney(ln.taxable ?? ln.amount)}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {intraState === true ? (
                    <label className="block min-w-0">
                      <span className={labelClass}>CGST + SGST</span>
                      <select
                        className={fieldClass}
                        value={gstSelectValue(ln)}
                        disabled={isManPowerLine(ln)}
                        onChange={(e) => {
                          const v = e.target.value
                          if (v === '' || v === GST_NOT_APPL) {
                            patchLine(ln.id, { gstRate: v === GST_NOT_APPL ? GST_NOT_APPL : '' })
                            return
                          }
                          patchLine(ln.id, { gstRate: Number(v) })
                        }}
                      >
                        <option value="">-Select-</option>
                        {CGST_SGST_RATE_OPTIONS.map((opt) => {
                          const total = opt.half * 2
                          return (
                            <option key={opt.label} value={String(total)}>
                              {opt.label}
                            </option>
                          )
                        })}
                        <option value={GST_NOT_APPL}>-Not Appl-</option>
                      </select>
                    </label>
                  ) : (
                    <label className="block min-w-0">
                      <span className={labelClass}>IGST %</span>
                      <select
                        className={fieldClass}
                        value={gstSelectValue(ln)}
                        disabled={isManPowerLine(ln) || !buyerState}
                        onChange={(e) => {
                          const v = e.target.value
                          if (v === '' || v === GST_NOT_APPL) {
                            patchLine(ln.id, { gstRate: v === GST_NOT_APPL ? GST_NOT_APPL : '' })
                            return
                          }
                          patchLine(ln.id, { gstRate: Number(v) })
                        }}
                      >
                        <option value="">-Select-</option>
                        {IGST_RATE_OPTIONS.map((opt) => (
                          <option key={opt.label} value={String(opt.rate)}>
                            {opt.label}
                          </option>
                        ))}
                        <option value={GST_NOT_APPL}>-Not Appl-</option>
                      </select>
                    </label>
                  )}
                  {intraState === true ? (
                    <>
                      <div className="min-w-0">
                        <span className={labelClass}>CGST</span>
                        <p className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-2 text-sm font-medium tabular-nums text-stone-800">
                          {fmtMoney(ln.cgst)}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <span className={labelClass}>SGST</span>
                        <p className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-2 text-sm font-medium tabular-nums text-stone-800">
                          {fmtMoney(ln.sgst)}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="min-w-0 sm:col-span-2">
                      <span className={labelClass}>IGST amt</span>
                      <p
                        className={`rounded-lg border border-stone-200 bg-stone-50 px-2 py-2 text-sm font-medium tabular-nums ${
                          buyerState ? 'text-stone-800' : 'text-rose-600'
                        }`}
                      >
                        {buyerState ? fmtMoney(ln.igst) : 'Set buyer state'}
                      </p>
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className={labelClass}>Line total</span>
                    <p className="rounded-lg border border-stone-200 bg-white px-2 py-2 text-sm font-semibold tabular-nums text-stone-900">
                      {buyerState ? fmtMoney(ln.lineTotal) : fmtMoney(ln.taxable)}
                    </p>
                  </div>
                </div>
                {intraState === true ? (
                  <p className="text-[11px] text-stone-500">
                    Karnataka — CGST + SGST (e.g. 9 + 9).
                  </p>
                ) : intraState === false ? (
                  <p className="text-[11px] text-stone-500">Outside Karnataka — IGST.</p>
                ) : (
                  <p className="text-[11px] text-rose-600">
                    Add GSTIN or state for CGST+SGST / IGST.
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {LINE_CATS.map((c) => {
                    const on = ln.category === c.id
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() =>
                          patchLine(ln.id, {
                            category: c.id,
                            onRequest: c.id === 'on_request',
                          })
                        }
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          on
                            ? 'bg-ink text-white'
                            : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        {c.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>
                  Valid for (days from {isNew ? 'today' : 'quote date'})
                </span>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  step={1}
                  className={fieldClass}
                  value={form.validityDays}
                  onChange={(e) => {
                    const raw = e.target.value
                    if (raw === '') {
                      set('validityDays', '')
                      return
                    }
                    const n = Number.parseInt(raw, 10)
                    if (Number.isNaN(n)) return
                    set('validityDays', Math.max(1, Math.min(3650, n)))
                  }}
                  onBlur={() => {
                    if (!form.validityDays) set('validityDays', 30)
                  }}
                />
                <span className="mt-1 block text-xs text-stone-500">
                  Expires {fmtDate(validUntil)} · shown on the quote and in Terms
                </span>
              </label>
            </div>

            <label className="block">
              <span className={labelClass}>Notes (printed under the amount in words)</span>
              <textarea
                className={`${fieldClass} min-h-[72px]`}
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Terms</span>
              <textarea
                className={`${fieldClass} min-h-[120px]`}
                value={form.terms}
                onChange={(e) => set('terms', e.target.value)}
              />
              <span className="mt-1 block text-[11px] text-stone-500">
                One term per line. Validity (from days above) is always listed first on the quote.
              </span>
            </label>
          </section>

          <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
            <h2 className={sectionLabel}>Company header</h2>
            <p className="text-xs text-stone-500">
              Letterhead on the quote (arrow area): logo, company name, address, and phone.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {form.logoUrl ? (
                <img
                  src={form.logoUrl}
                  alt=""
                  className="h-14 w-14 rounded-lg border border-stone-200 bg-white object-contain"
                />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-stone-100 text-xs font-semibold text-stone-500">
                  Logo
                </span>
              )}
              <div className="flex flex-wrap gap-2">
                <label className={`${btnSecondary} cursor-pointer`}>
                  Upload logo
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      onLogoFile(e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />
                </label>
                {form.logoUrl ? (
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => set('logoUrl', '')}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
            <label className="block">
              <span className={labelClass}>Company name</span>
              <input
                className={fieldClass}
                value={form.sellerName}
                onChange={(e) => set('sellerName', e.target.value)}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Company address</span>
              <textarea
                className={`${fieldClass} min-h-[72px]`}
                value={form.sellerAddress}
                onChange={(e) => set('sellerAddress', e.target.value)}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Company phone</span>
                <input
                  className={fieldClass}
                  value={form.sellerPhone}
                  onChange={(e) => set('sellerPhone', e.target.value)}
                  placeholder="+91 …"
                />
              </label>
              <label className="block">
                <span className={labelClass}>GSTIN (header)</span>
                <input
                  className={fieldClass}
                  value={form.sellerGstin}
                  onChange={(e) =>
                    set('sellerGstin', e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ''))
                  }
                  maxLength={15}
                />
              </label>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
            <h2 className={sectionLabel}>Your contact</h2>
            <p className="text-xs text-stone-500">
              Person details on the quote (boxed area): name, phone, and email only.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className={labelClass}>Name</span>
                <input
                  className={fieldClass}
                  value={form.contactName}
                  onChange={(e) => set('contactName', e.target.value)}
                  placeholder={defaultContactName}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Phone</span>
                <input
                  className={fieldClass}
                  value={form.contactPhone}
                  onChange={(e) => set('contactPhone', e.target.value)}
                  placeholder={defaultContactPhone || 'Phone'}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Email</span>
                <input
                  type="email"
                  className={fieldClass}
                  value={form.contactEmail}
                  onChange={(e) => set('contactEmail', e.target.value)}
                  placeholder={defaultContactEmail}
                />
              </label>
            </div>
            <div className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-stone-500">Subtotal</span>
                <span className="font-medium">{fmtMoney(subtotal)}</span>
              </div>
              {intraState === true ? (
                <>
                  <div className="mt-1 flex justify-between gap-2">
                    <span className="text-stone-500">CGST</span>
                    <span className="font-medium">{fmtMoney(cgstTotal)}</span>
                  </div>
                  <div className="mt-1 flex justify-between gap-2">
                    <span className="text-stone-500">SGST</span>
                    <span className="font-medium">{fmtMoney(sgstTotal)}</span>
                  </div>
                </>
              ) : (
                <div className="mt-1 flex justify-between gap-2">
                  <span className="text-stone-500">IGST</span>
                  <span className={buyerState ? 'font-medium' : 'font-medium text-rose-600'}>
                    {buyerState ? fmtMoney(igstTotal) : 'State needed'}
                  </span>
                </div>
              )}
              <div className="mt-2 flex justify-between gap-2 border-t border-stone-200 pt-2 text-base font-semibold">
                <span>Total (INR)</span>
                <span>{fmtMoney(total)}</span>
              </div>
              <p className="mt-1 text-xs text-stone-500">{amountInWords(total)}</p>
            </div>
          </section>

          {blockers.length ? (
            <ul className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-950">
              {blockers.map((b) => (
                <li key={b}>· {b}</li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900">
              Ready to save or send.
            </p>
          )}

          {!readOnly && isDraft && !isRevising && existing?.id ? (
            <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
              <h2 className={sectionLabel}>Send TEST</h2>
              <p className="text-xs text-stone-500">
                Draft only — send a test copy without marking the quote as sent.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {testEmails.map((email) => (
                  <button
                    key={email}
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-800 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
                    onClick={() => removeTestEmail(email)}
                    aria-label={`Remove ${email}`}
                    title="Remove"
                  >
                    {email}
                    <span aria-hidden>×</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="email"
                  className={`${fieldClass} min-w-[12rem] flex-1`}
                  placeholder="add@email.com"
                  value={testEmailDraft}
                  onChange={(e) => setTestEmailDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTestEmail()
                    }
                  }}
                />
                <button type="button" className={btnSecondary} onClick={addTestEmail}>
                  Add
                </button>
              </div>
              <button
                type="button"
                className={btnGhost}
                disabled={testBusy || !testEmails.length}
                onClick={handleTestSend}
              >
                {testBusy ? 'Sending…' : 'Send TEST'}
              </button>
            </section>
          ) : null}

          {!readOnly ? (
            <div className="flex flex-wrap gap-2">
              {isRevising ? (
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={saving}
                  onClick={() => {
                    setRevisingFromId(null)
                    if (existing) setForm(formFromQuote(existing))
                    setStatus({ type: '', message: '' })
                  }}
                >
                  Cancel revision
                </button>
              ) : (
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={saving}
                  onClick={() => persistDraft(false)}
                >
                  Save draft
                </button>
              )}
              <button
                type="button"
                className={btnPrimary}
                disabled={saving || !canSend}
                onClick={() => persistDraft(true)}
              >
                {isRevising ? 'Send revision' : 'Send email'}
              </button>
            </div>
          ) : null}
        </fieldset>

        <aside className="xl:sticky xl:top-4 xl:self-start">{previewCard}</aside>
      </div>
    </div>
  )
}

export default QuoteEditorPage
