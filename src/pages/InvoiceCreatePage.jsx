import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  FiArrowDown,
  FiArrowUp,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
} from 'react-icons/fi'
import InvoiceDocumentPreview from '../components/InvoiceDocumentPreview'
import StatusBanner from '../components/ui/StatusBanner'
import TenantOpsPlaceholder from '../components/TenantOpsPlaceholder'
import {
  fetchGstCaptcha,
  gstinLookupConfigured,
  gstinUsesCaptcha,
  isValidGstinFormat,
  lookupGstin,
} from '../api/gstin'
import {
  CGST_SGST_RATE_OPTIONS,
  DEFAULT_TERMS,
  GST_NOT_APPL,
  IGST_RATE_OPTIONS,
  LINE_CATS,
  UOM_OPTIONS,
  emptyGstLine,
  gstSelectValue,
  isManPowerLine,
  lineGstSplit,
} from '../features/billing/gstLines'
import {
  createTenantInvoice,
  fmtMoney,
  getInvoice,
  nextInvoiceNumber,
} from '../features/invoices/store'
import {
  IN_STATES,
  SELLER_STATE_CODE,
  stateFromGstin,
} from '../features/quotes/states'
import { isValidEmail, loadSettingsForMode } from '../features/settings/store'
import { useAccess } from '../hooks/useAccess'
import { listTenantsByStatus } from '../store/platformStore'
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
      contactName: PLATFORM.name,
      contactEmail: PLATFORM.email,
      contactPhone: String(manualPay.phone || billing.phone || PLATFORM.phone || '').trim(),
    }
  } catch {
    return {
      sellerName: PLATFORM.name,
      sellerEmail: PLATFORM.email,
      sellerAddress: PLATFORM.address,
      sellerPhone: '',
      sellerGstin: '',
      logoUrl: '',
      contactName: PLATFORM.name,
      contactEmail: PLATFORM.email,
      contactPhone: '',
    }
  }
}

const todayInput = () => new Date().toISOString().slice(0, 10)

const addDays = (iso, days) => {
  const d = new Date(iso || Date.now())
  if (Number.isNaN(d.getTime())) d.setTime(Date.now())
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const daysBetween = (fromIso, toIso) => {
  const a = new Date(fromIso)
  const b = new Date(toIso)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 15
  a.setHours(0, 0, 0, 0)
  b.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((b - a) / 86400000))
}

const sectionLabel = 'text-[11px] font-bold uppercase tracking-wide text-brand-700'

const hydrateLines = (existing) => {
  if (Array.isArray(existing?.lines) && existing.lines.length) {
    return existing.lines.map((ln) => ({
      ...emptyGstLine(),
      ...ln,
      hsn: ln.hsn || '',
      uom: ln.uom || 'Pcs',
      discountPct: ln.discountPct ?? 0,
      gstRate: ln.gstRate ?? 18,
      category: ln.category || 'stocked',
      onRequest: Boolean(ln.onRequest) || ln.category === 'on_request',
    }))
  }
  return [
    {
      ...emptyGstLine(),
      item: 'Platform subscription · monthly',
      hsn: '9983',
      category: 'service',
      qty: 1,
      unitPrice: 9999,
      gstRate: 18,
    },
  ]
}

const InvoiceCreatePage = () => {
  const navigate = useNavigate()
  const { invoiceId } = useParams()
  const existing = useMemo(
    () => (invoiceId ? getInvoice(invoiceId) : null),
    [invoiceId],
  )
  const isEdit = Boolean(invoiceId)
  const { canWrite, isSuperAdmin } = useAccess()
  const tenants = useMemo(
    () => listTenantsByStatus('active').filter((t) => t?.id && t?.name),
    [],
  )
  const seller = useMemo(() => readPlatformSeller(), [])

  const [status, setStatus] = useState({ type: '', message: '' })
  const [saving, setSaving] = useState(false)
  const [tenantId, setTenantId] = useState(
    () => existing?.tenantId || '',
  )
  const [company, setCompany] = useState(
    () =>
      existing?.payerName ||
      existing?.clientName ||
      existing?.tenantName ||
      '',
  )
  const [legalName, setLegalName] = useState(() => existing?.legalName || '')
  const [attention, setAttention] = useState(
    () => existing?.attention || existing?.ownerName || '',
  )
  const [address, setAddress] = useState(
    () => existing?.address || existing?.city || existing?.venue || '',
  )
  const [gstin, setGstin] = useState(() => existing?.gstin || '')
  const [stateCode, setStateCode] = useState(
    () => existing?.stateCode || stateFromGstin(existing?.gstin)?.code || SELLER_STATE_CODE,
  )
  const [buyerEmail, setBuyerEmail] = useState(() => existing?.email || '')
  const [ccEmails, setCcEmails] = useState(() => existing?.ccEmails || '')
  const [bccEmails, setBccEmails] = useState(() => existing?.bccEmails || '')
  const [shipTo, setShipTo] = useState(
    () => existing?.shipTo || 'Same as above',
  )
  const [yourRef, setYourRef] = useState(
    () => existing?.yourRef || existing?.bookingRef || '',
  )
  const [number, setNumber] = useState(
    () => existing?.number || nextInvoiceNumber(),
  )
  const [date, setDate] = useState(() => existing?.date || todayInput())
  const [dueDays, setDueDays] = useState(() =>
    existing?.date && existing?.dueDate
      ? daysBetween(existing.date, existing.dueDate)
      : 15,
  )
  const [terms, setTerms] = useState(
    () => existing?.terms || DEFAULT_TERMS,
  )
  const [notes, setNotes] = useState(() => existing?.note || '')
  const [received, setReceived] = useState(() =>
    String(existing?.received != null ? existing.received : 0),
  )
  const [sellerName, setSellerName] = useState(
    () => existing?.sellerName || seller.sellerName,
  )
  const [sellerAddress, setSellerAddress] = useState(
    () => existing?.sellerAddress || seller.sellerAddress,
  )
  const [sellerPhone, setSellerPhone] = useState(
    () => existing?.sellerPhone || seller.sellerPhone,
  )
  const [sellerGstin, setSellerGstin] = useState(
    () => existing?.sellerGstin || seller.sellerGstin,
  )
  const [logoUrl, setLogoUrl] = useState(
    () => existing?.logoUrl || seller.logoUrl || '',
  )
  const [contactName, setContactName] = useState(
    () => existing?.contactName || seller.contactName,
  )
  const [contactPhone, setContactPhone] = useState(
    () => existing?.contactPhone || seller.contactPhone,
  )
  const [contactEmail, setContactEmail] = useState(
    () => existing?.contactEmail || seller.contactEmail,
  )
  const [lines, setLines] = useState(() => hydrateLines(existing))

  const [gstLookupBusy, setGstLookupBusy] = useState(false)
  const [gstLookupNote, setGstLookupNote] = useState('')
  const [gstCaptchaBusy, setGstCaptchaBusy] = useState(false)
  const [gstCaptchaImage, setGstCaptchaImage] = useState('')
  const [gstCaptchaCookie, setGstCaptchaCookie] = useState('')
  const [gstCaptchaText, setGstCaptchaText] = useState('')
  const portalCaptcha = gstinUsesCaptcha()

  const dueDate = addDays(date, Math.max(0, Number(dueDays) || 0))

  const onLogoFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setLogoUrl(String(reader.result || ''))
    reader.readAsDataURL(file)
  }

  const applyTenant = (id) => {
    setTenantId(id)
    const t = tenants.find((x) => String(x.id) === String(id))
    if (!t) return
    setCompany((c) => c || t.name || '')
    setAttention((a) => a || t.owner_name || '')
    setBuyerEmail((e) => e || t.owner_email || t.email || '')
    setAddress((a) => a || t.city || '')
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
      const data = await fetchGstCaptcha()
      setGstCaptchaImage(data?.captchaImage || '')
      setGstCaptchaCookie(data?.captchaCookie || '')
      setGstCaptchaText('')
    } catch (err) {
      setGstLookupNote(apiErrorMessage(err, 'Could not load GST captcha.'))
      clearGstCaptcha()
    } finally {
      setGstCaptchaBusy(false)
    }
  }

  const applyGstHit = (gstinVal, hit) => {
    const legal = hit.legalName || ''
    const tradeOrLegal = hit.company || legal
    if (tradeOrLegal) setCompany(String(tradeOrLegal).trim())
    if (legal) setLegalName(String(legal).trim())
    if (hit.address) setAddress(String(hit.address).trim())
    if (hit.stateCode) setStateCode(hit.stateCode)
    else {
      const st = stateFromGstin(gstinVal)
      if (st?.code) setStateCode(st.code)
    }
    setShipTo((s) =>
      s && s !== 'Same as above' && s !== address
        ? s
        : hit.address || s || address,
    )
    if (hit.partial) {
      setGstLookupNote(
        hit.note ||
          'State filled from GSTIN. Use the captcha lookup for full company details.',
      )
    } else {
      const bits = []
      if (tradeOrLegal) bits.push(`Customer: ${tradeOrLegal}`)
      if (legal && legal !== tradeOrLegal) bits.push(`Legal name: ${legal}`)
      if (hit.status) bits.push(hit.status)
      setGstLookupNote(
        bits.length ? bits.join(' · ') : 'GSTIN found — review customer and address.',
      )
    }
  }

  const runGstLookup = async (rawGstin, captchaOpts = null) => {
    const g = String(rawGstin || '').trim().toUpperCase()
    if (!isValidGstinFormat(g)) {
      setGstLookupNote(
        g.length === 15 ? 'That GSTIN format or checksum looks invalid.' : '',
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
      const hit = await lookupGstin(g, captchaOpts || {})
      applyGstHit(g, hit)
      if (portalCaptcha) clearGstCaptcha()
    } catch (err) {
      setGstLookupNote(apiErrorMessage(err, 'Could not look up this GSTIN.'))
      if (portalCaptcha && err?.code === 'SWEB_9000') await loadGstCaptcha()
    } finally {
      setGstLookupBusy(false)
    }
  }

  const submitGstCaptchaLookup = async () => {
    const g = String(gstin || '').trim().toUpperCase()
    if (!isValidGstinFormat(g)) {
      setGstLookupNote('Enter a valid 15-character GSTIN first.')
      return
    }
    if (!gstCaptchaCookie || !String(gstCaptchaText || '').trim()) {
      setGstLookupNote('Enter the captcha text shown in the image.')
      return
    }
    await runGstLookup(g, {
      captcha: gstCaptchaText,
      captchaCookie: gstCaptchaCookie,
    })
  }

  const patchLine = (id, patch) => {
    setLines((rows) => rows.map((ln) => (ln.id === id ? { ...ln, ...patch } : ln)))
  }

  const addLine = () => {
    if (lines.length >= 30) {
      setStatus({ type: 'error', message: 'Maximum 30 lines per invoice.' })
      return
    }
    setLines((rows) => [...rows, emptyGstLine()])
  }

  const removeLine = (id) => {
    setLines((rows) => (rows.length <= 1 ? rows : rows.filter((ln) => ln.id !== id)))
  }

  const moveLine = (id, dir) => {
    setLines((rows) => {
      const idx = rows.findIndex((ln) => ln.id === id)
      if (idx < 0) return rows
      const next = idx + dir
      if (next < 0 || next >= rows.length) return rows
      const copy = [...rows]
      ;[copy[idx], copy[next]] = [copy[next], copy[idx]]
      return copy
    })
  }

  const buyerState = useMemo(() => {
    const fromGst = stateFromGstin(gstin)
    if (fromGst) return fromGst
    return IN_STATES.find((s) => s.code === stateCode) || null
  }, [gstin, stateCode])

  const intraState = buyerState ? buyerState.code === SELLER_STATE_CODE : null

  const linesComputed = lines.map((ln) => {
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
  const tenant = tenants.find((t) => String(t.id) === String(tenantId)) || null
  const blockers = useMemo(() => {
    const list = []
    if (!String(company).trim()) list.push('Add the customer name.')
    if (!String(gstin).trim() && !stateCode) {
      list.push(
        "Add the buyer's GSTIN or state, so GST can be split (CGST + SGST in Karnataka, IGST outside).",
      )
    }
    if (!String(number).trim()) list.push('Add an invoice number.')
    lines.forEach((ln, i) => {
      if (!String(ln.item).trim()) list.push(`Line ${i + 1} needs an item name.`)
      if (!String(ln.hsn || '').trim()) list.push(`Line ${i + 1} needs HSN/SAC.`)
      if (!isManPowerLine(ln) && !(Number(ln.unitPrice) > 0)) {
        list.push(`Line ${i + 1} needs a unit price, or mark it Man power.`)
      }
    })
    if (buyerEmail && !isValidEmail(buyerEmail)) {
      list.push("Buyer's email looks invalid.")
    }
    return list
  }, [company, gstin, stateCode, number, lines, buyerEmail])

  const persist = (asSent) => {
    if (canWrite === false) {
      setStatus({ type: 'error', message: 'You do not have permission to save invoices.' })
      return
    }
    if (!isSuperAdmin) {
      setStatus({
        type: 'error',
        message: 'Only O-HM platform admins can manage invoices.',
      })
      return
    }
    if (blockers.length) {
      setStatus({ type: 'error', message: blockers[0] })
      return
    }

    setSaving(true)
    try {
      const row = createTenantInvoice({
        existing: existing || null,
        tenant,
        payerName: company.trim(),
        number: number.trim(),
        date,
        dueDate,
        terms,
        notes,
        lines: linesComputed,
        asSent,
        amountReceived: Number(received) || 0,
        subtotal,
        gstAmount,
        cgstTotal,
        sgstTotal,
        igstTotal,
        total,
        customer: {
          legalName,
          attention,
          address,
          gstin,
          stateCode: buyerState?.code || stateCode,
          email: buyerEmail,
          ccEmails,
          bccEmails,
          shipTo,
          yourRef,
        },
        seller: {
          sellerName,
          sellerAddress,
          sellerPhone,
          sellerGstin,
          logoUrl,
          contactName,
          contactPhone,
          contactEmail,
        },
      })
      setStatus({
        type: 'success',
        message: asSent
          ? `Invoice ${row.number} saved and raised.`
          : `Invoice ${row.number} saved.`,
      })
      window.setTimeout(() => navigate(`/ops/invoices/${row.id}`), 500)
    } catch {
      setStatus({ type: 'error', message: 'Could not save the invoice.' })
    } finally {
      setSaving(false)
    }
  }

  if (!isSuperAdmin) {
    return (
      <TenantOpsPlaceholder
        title="Invoices"
        description="Your organization’s invoices will appear here when tenant billing is enabled."
      />
    )
  }

  if (isEdit && !existing) {
    return (
      <div className="sc-page-enter space-y-4">
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-10 text-center">
          <p className="font-medium text-rose-800">Invoice not found</p>
          <Link to="/ops/invoices" className={`${btnPrimary} mt-4 inline-flex`}>
            Back to invoices
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="sc-page-enter space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-brand-700">
            <Link to="/ops/invoices" className="hover:underline">
              Invoices
            </Link>
            <span className="text-stone-300"> / </span>
            {isEdit ? existing.number : 'New'}
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-stone-900">
            {isEdit ? 'Edit invoice' : 'New invoice'}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-stone-500">
            Same GST and line fields as quotes. Invoice number, due date, and amount received stay
            under Invoice details.
          </p>
        </div>
        <Link
          to={isEdit ? `/ops/invoices/${existing.id}` : '/ops/invoices'}
          className={btnSecondary}
        >
          Back
        </Link>
      </div>

      <StatusBanner type={status.type} message={status.message} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,440px)]">
        <div className="space-y-5">
          <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
            <h2 className={sectionLabel}>Billed to</h2>
            <label className="block">
              <span className={labelClass}>Link tenant (optional)</span>
              <select
                className={fieldClass}
                value={tenantId}
                onChange={(e) => applyTenant(e.target.value)}
              >
                <option value="">No tenant link</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.city ? ` · ${t.city}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Customer</span>
              <input
                className={fieldClass}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                disabled={gstLookupBusy}
              />
            </label>
            {legalName &&
            String(legalName).trim() !== String(company || '').trim() ? (
              <p className="text-[11px] text-stone-500">
                Legal name (on invoice): {legalName}
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Attention / department</span>
                <textarea
                  className={`${fieldClass} min-h-[72px]`}
                  placeholder="Contact person or department (optional)"
                  value={attention}
                  onChange={(e) => setAttention(e.target.value)}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Address</span>
                <textarea
                  className={`${fieldClass} min-h-[72px]`}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
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
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>CC</span>
                <input
                  type="text"
                  className={fieldClass}
                  placeholder="cc1@email.com, cc2@email.com"
                  value={ccEmails}
                  onChange={(e) => setCcEmails(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <label className="block">
                <span className={labelClass}>BCC</span>
                <input
                  type="text"
                  className={fieldClass}
                  placeholder="bcc@email.com"
                  value={bccEmails}
                  onChange={(e) => setBccEmails(e.target.value)}
                  autoComplete="off"
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>GSTIN</span>
                <input
                  className={fieldClass}
                  placeholder="15 characters"
                  maxLength={15}
                  value={gstin}
                  onChange={(e) => {
                    const next = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '')
                    const st = stateFromGstin(next)
                    setGstin(next)
                    if (st?.code) setStateCode(st.code)
                    setGstLookupNote('')
                    if (next.length < 15) clearGstCaptcha()
                    if (next.length === 15 && isValidGstinFormat(next)) {
                      runGstLookup(next)
                    }
                  }}
                  onBlur={() => {
                    const g = String(gstin || '').trim()
                    if (g.length === 15 && isValidGstinFormat(g)) {
                      if (portalCaptcha) {
                        if (!gstCaptchaImage && !gstCaptchaBusy) loadGstCaptcha()
                      } else {
                        runGstLookup(g)
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
                            : 'Enter GSTIN to fill state.')}
                </span>
              </label>
              <label className="block">
                <span className={labelClass}>State</span>
                <select
                  className={fieldClass}
                  value={stateCode}
                  onChange={(e) => setStateCode(e.target.value)}
                >
                  <option value="">Choose a state</option>
                  {IN_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] text-stone-500">
                  GSTIN digits or state decide CGST+SGST vs IGST.
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
              <span className={labelClass}>Ship to</span>
              <textarea
                className={`${fieldClass} min-h-[64px]`}
                value={shipTo}
                onChange={(e) => setShipTo(e.target.value)}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Your ref.</span>
              <input
                className={fieldClass}
                placeholder="Booking or PO reference"
                value={yourRef}
                onChange={(e) => setYourRef(e.target.value)}
              />
            </label>
          </section>

          <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className={sectionLabel}>Lines · {lines.length} of 30</h2>
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
                    <span className={labelClass}>Item</span>
                    <input
                      className={fieldClass}
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
                            patchLine(ln.id, {
                              gstRate: v === GST_NOT_APPL ? GST_NOT_APPL : '',
                            })
                            return
                          }
                          patchLine(ln.id, { gstRate: Number(v) })
                        }}
                      >
                        <option value="">-Select-</option>
                        {CGST_SGST_RATE_OPTIONS.map((opt) => {
                          const totalPct = opt.half * 2
                          return (
                            <option key={opt.label} value={String(totalPct)}>
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
                            patchLine(ln.id, {
                              gstRate: v === GST_NOT_APPL ? GST_NOT_APPL : '',
                            })
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
          </section>

          <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
            <h2 className={sectionLabel}>Invoice details</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Invoice number</span>
                <input
                  className={fieldClass}
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Date</span>
                <input
                  type="date"
                  className={fieldClass}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Due in (days)</span>
                <input
                  type="number"
                  min={0}
                  max={365}
                  className={fieldClass}
                  value={dueDays}
                  onChange={(e) => setDueDays(Number(e.target.value) || 0)}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Amount already received (₹)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={fieldClass}
                  value={received}
                  onChange={(e) => setReceived(e.target.value)}
                />
              </label>
            </div>
            <label className="block">
              <span className={labelClass}>Terms</span>
              <textarea
                className={`${fieldClass} min-h-[100px]`}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
              />
              <span className="mt-1 block text-[11px] text-stone-500">
                One term per line — same as quotes.
              </span>
            </label>
            <label className="block">
              <span className={labelClass}>Notes (on the invoice)</span>
              <textarea
                className={`${fieldClass} min-h-[72px]`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>

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
                  <span className="font-medium">{fmtMoney(igstTotal)}</span>
                </div>
              )}
              <div className="mt-2 flex justify-between gap-2 border-t border-stone-200 pt-2 text-base font-semibold">
                <span>Total (INR)</span>
                <span>{fmtMoney(total)}</span>
              </div>
            </div>

            {blockers.length ? (
              <p className="text-xs text-rose-600">{blockers[0]}</p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnPrimary}
                disabled={saving || blockers.length > 0}
                onClick={() => persist(true)}
              >
                {isEdit ? 'Save & raise' : 'Raise invoice'}
              </button>
              <button
                type="button"
                className={btnSecondary}
                disabled={saving || blockers.length > 0}
                onClick={() => persist(false)}
              >
                {isEdit ? 'Save changes' : 'Save draft'}
              </button>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
            <h2 className={sectionLabel}>Company header</h2>
            <p className="text-xs text-stone-500">
              Letterhead on the invoice: logo, company name, address, and phone.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
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
                {logoUrl ? (
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => setLogoUrl('')}
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
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Company address</span>
              <textarea
                className={`${fieldClass} min-h-[72px]`}
                value={sellerAddress}
                onChange={(e) => setSellerAddress(e.target.value)}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Company phone</span>
                <input
                  className={fieldClass}
                  value={sellerPhone}
                  onChange={(e) => setSellerPhone(e.target.value)}
                  placeholder="+91 …"
                />
              </label>
              <label className="block">
                <span className={labelClass}>GSTIN (header)</span>
                <input
                  className={fieldClass}
                  value={sellerGstin}
                  onChange={(e) =>
                    setSellerGstin(
                      e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ''),
                    )
                  }
                  maxLength={15}
                />
              </label>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
            <h2 className={sectionLabel}>Your contact</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className={labelClass}>Name</span>
                <input
                  className={fieldClass}
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Phone</span>
                <input
                  className={fieldClass}
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Email</span>
                <input
                  type="email"
                  className={fieldClass}
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </label>
            </div>
          </section>
        </div>

        <aside className="xl:sticky xl:top-4 xl:self-start">
          <InvoiceDocumentPreview
            sellerName={sellerName}
            sellerAddress={sellerAddress}
            sellerPhone={sellerPhone}
            sellerGstin={sellerGstin}
            logoUrl={logoUrl}
            sellerEmail={contactEmail}
            contactName={contactName}
            contactPhone={contactPhone}
            number={number}
            date={date}
            dueDate={dueDate}
            terms={terms}
            billToName={company || '—'}
            billToAttention={attention}
            billToAddress={address}
            billToGstin={gstin}
            billToEmail={buyerEmail}
            yourRef={yourRef}
            notes={notes}
            lines={linesComputed}
            subtotal={subtotal}
            cgstTotal={cgstTotal}
            sgstTotal={sgstTotal}
            igstTotal={igstTotal}
            gstAmount={gstAmount}
            total={total}
            received={Number(received) || 0}
            intraState={intraState}
            statusLabel={isEdit ? existing?.status || 'Edit' : 'Preview'}
          />
        </aside>
      </div>
    </div>
  )
}

export default InvoiceCreatePage
