import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FiArrowDown, FiArrowUp, FiDownload, FiPlus, FiTrash2 } from 'react-icons/fi'
import StatusBanner from '../components/ui/StatusBanner'
import TenantOpsPlaceholder from '../components/TenantOpsPlaceholder'
import { ErrorState, LoadingState } from '../components/ui/PageState'
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

/** Platform quotes always brand as O-HM Senior Care — never tenant or personal admin name. */
const readPlatformSeller = () => {
  try {
    const settings = loadSettingsForMode('account', {})
    const manualPay = settings?.payments?.manual || {}
    return {
      sellerName: PLATFORM.name,
      sellerEmail: PLATFORM.email,
      sellerAddress: PLATFORM.address,
      sellerGstin: settings?.billing?.gstin || '',
      manualPay,
      contactName: PLATFORM.name,
      contactEmail: PLATFORM.email,
      contactPhone: PLATFORM.phone,
    }
  } catch {
    return {
      sellerName: PLATFORM.name,
      sellerEmail: PLATFORM.email,
      sellerAddress: PLATFORM.address,
      sellerGstin: '',
      manualPay: {},
      contactName: PLATFORM.name,
      contactEmail: PLATFORM.email,
      contactPhone: '',
    }
  }
}

const LINE_CATS = [
  { id: 'stocked', label: 'Catalog · package' },
  { id: 'custom', label: 'Custom service' },
  { id: 'service', label: 'Service visit' },
  { id: 'on_request', label: 'On request' },
]

const emptyLine = () => ({
  id: `ln-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  item: '',
  hsn: '',
  specification: '',
  qty: 1,
  unitPrice: 0,
  leadTime: '',
  category: 'stocked',
  onRequest: false,
})

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
    attention: '',
    address: '',
    gstin: '',
    stateCode: '',
    buyerEmail: '',
    shipTo: 'Same as above',
    yourRef: '',
    validityDays: 30,
    notes: '',
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
    sellerName,
    sellerAddress,
    sellerGstin,
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
    const qty = Number(ln.qty) || 0
    const price = ln.onRequest || ln.category === 'on_request' ? 0 : Number(ln.unitPrice) || 0
    return { ...ln, amount: qty * price }
  })

  const subtotal = linesComputed.reduce((s, ln) => s + ln.amount, 0)
  const gstRate = 0.18
  const gstAmount = buyerState ? subtotal * gstRate : 0
  const total = subtotal + gstAmount

  const blockers = useMemo(() => {
    const list = []
    if (!String(form.company).trim()) list.push('Add who the quote is for.')
    if (!String(form.gstin).trim() && !form.stateCode) {
      list.push(
        "Add the buyer's GSTIN or state, so GST can be split (CGST + SGST in Karnataka, IGST outside).",
      )
    }
    form.lines.forEach((ln, i) => {
      if (!String(ln.item).trim()) list.push(`Line ${i + 1} needs an item name.`)
      const onReq = ln.onRequest || ln.category === 'on_request'
      if (!onReq && !(Number(ln.unitPrice) > 0)) {
        list.push(`Line ${i + 1} needs a unit price, or mark it On request.`)
      }
    })
    if (!String(form.buyerEmail).trim()) {
      list.push("Add the buyer's email to send the quote.")
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
      setStatus({ type: 'error', message: 'Add who the quote is for.' })
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
          revised = await sendPlatformQuote(revised.id)
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
        saved = await sendPlatformQuote(saved.id)
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

  const handleMakeRevision = () => {
    if (canWrite === false || !existing) return
    const key = String(existing.status || '').toUpperCase()
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
      <div className="border-b border-stone-200 bg-stone-50 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-stone-900">{sellerName}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-stone-500">
              {sellerAddress}
              {sellerGstin ? ` · GSTIN ${sellerGstin}` : ''}
            </p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-xs font-bold text-white">
            {(sellerName || 'SC').slice(0, 2).toUpperCase()}
          </span>
        </div>
      </div>
      <div className="space-y-4 p-4 text-[11px] leading-relaxed text-stone-700">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-stone-100 pb-3">
          <p className="text-lg font-bold tracking-tight text-stone-900">Quotation</p>
          <div className="text-right text-stone-500">
            <p>Quote no. · {existing?.number || 'assigned on save'}</p>
            <p>Revision R{existing?.revision ?? 0}</p>
            <p>Date {fmtDate(quoteDate)}</p>
            <p>Valid until {fmtDate(validUntil)}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="font-bold uppercase tracking-wide text-stone-400">Quoted to</p>
            <p className="mt-1 font-semibold text-stone-900">{form.company || '—'}</p>
            {form.attention ? <p className="whitespace-pre-wrap">{form.attention}</p> : null}
            {form.address ? <p className="whitespace-pre-wrap">{form.address}</p> : null}
            {form.gstin ? <p>GSTIN {form.gstin}</p> : null}
            {buyerState ? <p>{buyerState.name}</p> : null}
          </div>
          <div>
            <p className="font-bold uppercase tracking-wide text-stone-400">Ship to</p>
            <p className="mt-1 whitespace-pre-wrap font-semibold text-stone-900">
              {form.shipTo || '—'}
            </p>
          </div>
          <div>
            <p className="font-bold uppercase tracking-wide text-stone-400">Your contact</p>
            <p className="mt-1 font-semibold text-stone-900">
              {form.contactName || PLATFORM.name}
            </p>
            {form.contactPhone ? <p>{form.contactPhone}</p> : null}
            {form.contactEmail ? <p>{form.contactEmail}</p> : null}
          </div>
        </div>

        {form.yourRef ? (
          <p>
            <span className="text-stone-400">Your ref. · </span>
            {form.yourRef}
          </p>
        ) : null}

        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-stone-200 text-[10px] uppercase tracking-wide text-stone-400">
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">Item</th>
              <th className="py-1 pr-2 text-right">Qty</th>
              <th className="py-1 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {linesComputed.map((ln, i) => (
              <tr key={ln.id} className="border-b border-stone-100 align-top">
                <td className="py-2 pr-2 text-stone-400">{String(i + 1).padStart(2, '0')}</td>
                <td className="py-2 pr-2">
                  <p className="font-semibold text-stone-900">{ln.item || '—'}</p>
                  {ln.specification ? <p className="text-stone-500">{ln.specification}</p> : null}
                  <p className="mt-0.5 text-[10px] uppercase text-stone-400">
                    {LINE_CATS.find((c) => c.id === ln.category)?.label}
                    {ln.hsn ? ` · HSN ${ln.hsn}` : ''}
                  </p>
                </td>
                <td className="py-2 pr-2 text-right">{ln.qty}</td>
                <td className="py-2 text-right font-medium">
                  {ln.onRequest || ln.category === 'on_request'
                    ? 'On request'
                    : fmtMoney(ln.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto max-w-[220px] space-y-1 border border-stone-200 bg-stone-50 p-2.5">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{fmtMoney(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>GST</span>
            <span className={buyerState ? '' : 'text-rose-600'}>
              {buyerState ? fmtMoney(gstAmount) : "Buyer's state needed"}
            </span>
          </div>
          <div className="flex justify-between border-t border-stone-200 pt-1 font-bold text-stone-900">
            <span>Total (INR)</span>
            <span>{fmtMoney(total)}</span>
          </div>
        </div>

        {form.notes ? <p className="whitespace-pre-wrap text-stone-600">{form.notes}</p> : null}
        <p className="italic text-stone-500">{amountInWords(total)}</p>

        <div className="space-y-1 border-t border-stone-100 pt-3 text-[10px] text-stone-500">
          <p className="font-semibold text-stone-700">Terms</p>
          <ol className="list-decimal space-y-0.5 pl-4">
            <li>
              Validity {validityDays} day{validityDays === 1 ? '' : 's'} from quote date (until{' '}
              {fmtDate(validUntil)}) unless stated otherwise.
            </li>
            <li>Payment as agreed; advance may be required for custom packages.</li>
            <li>Services subject to caregiver availability at the venue.</li>
            <li>Prices exclude hospital / pharmacy pass-through unless listed.</li>
            <li>Cancellation per organization policy.</li>
            <li>Subject to laws of India.</li>
          </ol>
        </div>

        <div className="border-t border-stone-100 pt-3">
          <p className="font-bold text-stone-800">Accept this quote</p>
          <button type="button" className={`${btnPrimary} mt-2 w-full sm:w-auto`} disabled>
            Accept quote online →
          </button>
        </div>
        <p className="pt-2 text-right text-stone-500">
          For {sellerName}
          <br />
          Authorized signatory
        </p>
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
                  A newer revision was sent; this one can no longer be accepted.
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
                {canWrite !== false ? (
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
              ? `The number (SC-Q-2610-…) is given when you save. Valid for ${validityDays} day${
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
              <span className={labelClass}>Company</span>
              <input
                className={fieldClass}
                value={form.company}
                onChange={(e) => set('company', e.target.value)}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Attention / department</span>
                <textarea
                  className={`${fieldClass} min-h-[72px]`}
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
                  value={form.gstin}
                  onChange={(e) => {
                    const gstin = e.target.value.toUpperCase()
                    const st = stateFromGstin(gstin)
                    setForm((f) => ({
                      ...f,
                      gstin,
                      stateCode: st?.code || f.stateCode,
                    }))
                  }}
                />
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
            </div>
            <label className="block">
              <span className={labelClass}>Buyer&apos;s email (the quote goes here)</span>
              <input
                type="email"
                className={fieldClass}
                value={form.buyerEmail}
                onChange={(e) => set('buyerEmail', e.target.value)}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Ship to (first line in bold)</span>
              <textarea
                className={`${fieldClass} min-h-[64px]`}
                value={form.shipTo}
                onChange={(e) => set('shipTo', e.target.value)}
              />
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
                    <span className={labelClass}>HSN/SAC</span>
                    <input
                      className={fieldClass}
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
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label className="block">
                    <span className={labelClass}>Qty</span>
                    <input
                      type="number"
                      min={0}
                      className={fieldClass}
                      value={ln.qty}
                      onChange={(e) => patchLine(ln.id, { qty: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Unit price (₹)</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={fieldClass}
                      value={ln.unitPrice}
                      disabled={ln.onRequest || ln.category === 'on_request'}
                      onChange={(e) => patchLine(ln.id, { unitPrice: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Lead time</span>
                    <input
                      className={fieldClass}
                      value={ln.leadTime}
                      onChange={(e) => patchLine(ln.id, { leadTime: e.target.value })}
                    />
                  </label>
                  <div>
                    <span className={labelClass}>Amount</span>
                    <p className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-800">
                      {fmtMoney(ln.amount)}
                    </p>
                  </div>
                </div>
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
          </section>

          <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
            <h2 className={sectionLabel}>Your contact</h2>
            <p className="text-xs text-stone-500">
              Platform quotes are always from O-HM Senior Care (not the tenant or personal admin).
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className={labelClass}>Name</span>
                <input
                  className={fieldClass}
                  value={form.contactName || defaultContactName}
                  readOnly
                  disabled
                />
              </label>
              <label className="block">
                <span className={labelClass}>Contact phone</span>
                <input
                  className={fieldClass}
                  value={form.contactPhone || defaultContactPhone}
                  readOnly
                  disabled
                />
              </label>
              <label className="block">
                <span className={labelClass}>Contact email</span>
                <input
                  type="email"
                  className={fieldClass}
                  value={form.contactEmail || defaultContactEmail}
                  readOnly
                  disabled
                />
              </label>
            </div>
            <div className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-stone-500">Subtotal</span>
                <span className="font-medium">{fmtMoney(subtotal)}</span>
              </div>
              <div className="mt-1 flex justify-between gap-2">
                <span className="text-stone-500">
                  {intraState === true
                    ? 'CGST + SGST 18%'
                    : intraState === false
                      ? 'IGST 18%'
                      : 'CGST + SGST 18%'}
                </span>
                <span className={buyerState ? 'font-medium' : 'font-medium text-rose-600'}>
                  {buyerState ? fmtMoney(gstAmount) : 'State needed'}
                </span>
              </div>
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
