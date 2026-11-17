import { isManPowerLine, uomLabel } from '../features/billing/gstLines'
import { amountInWords } from '../features/quotes/states'
import { fmtDate, fmtMoney } from '../features/invoices/store'
import { btnPrimary } from '../utils/ui'

const PLATFORM = {
  name: 'O-HM Senior Care',
  email: 'support@o-hm.com',
  address: 'India',
}

const MSME_BADGE = '/badges/msme.png'
const DUNS_BADGE = '/badges/duns.png'

const websiteHref = (url) => {
  const s = String(url || '').trim()
  if (!s) return '#'
  if (/^https?:\/\//i.test(s)) return s
  return `https://${s}`
}

/**
 * Tax-invoice document chrome — same layout as the quotation template.
 */
const InvoiceDocumentPreview = ({
  sellerName = PLATFORM.name,
  sellerAddress = PLATFORM.address,
  sellerPhone = '',
  sellerGstin = '',
  sellerUdyam = '',
  sellerDuns = '',
  logoUrl = '',
  sellerEmail = PLATFORM.email,
  brandRows = [],
  contactName = '',
  contactPhone = '',
  showSecondaryContact = false,
  secondaryContactPhone = '',
  secondaryContactEmail = '',
  showTertiaryContact = false,
  tertiaryContactPhone = '',
  tertiaryContactEmail = '',
  number = '—',
  date,
  dueDate,
  terms = '',
  billToName = '—',
  billToLegalName = '',
  billToAttention = '',
  billToAddress = '',
  billToGstin = '',
  billToEmail = '',
  billToState = '',
  yourRef = '',
  notes = '',
  lines = [],
  subtotal = 0,
  cgstTotal = 0,
  sgstTotal = 0,
  igstTotal = 0,
  gstAmount = 0,
  total = 0,
  received = 0,
  intraState = null,
  statusLabel = '',
}) => {
  const owed = Math.max(0, Number(total) - Number(received || 0))
  const termsList = String(terms || '')
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)

  const headerRegLine = [
    sellerPhone,
    sellerGstin && `GSTIN ${sellerGstin}`,
    sellerUdyam && `Udyam ${sellerUdyam}`,
    sellerDuns && `D-U-N-S ${sellerDuns}`,
  ]
    .filter(Boolean)
    .join(' · ')

  const displayLines =
    lines.length > 0 ? lines : [{ id: 'empty', item: '', qty: 0, unitPrice: 0 }]

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-300 bg-white shadow-md">
      <div className="space-y-3 p-4 text-[11px] leading-relaxed text-stone-700">
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 pb-3">
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                className="h-11 w-11 shrink-0 rounded-lg border border-stone-200 bg-white object-contain"
              />
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ink text-[11px] font-bold text-white">
                o-
              </span>
            )}
            <div className="min-w-0">
              <p className="text-lg font-bold tracking-tight text-brand-700">{sellerName}</p>
              {sellerAddress ? (
                <p className="mt-1 whitespace-pre-wrap text-[10px] leading-snug text-stone-600">
                  {sellerAddress}
                </p>
              ) : null}
              {headerRegLine ? (
                <p className="mt-1 text-[9px] leading-snug text-stone-600">{headerRegLine}</p>
              ) : null}
              {Array.isArray(brandRows) && brandRows.length ? (
                <div className="mt-1.5 space-y-0.5 border-t border-stone-100 pt-1.5">
                  {brandRows.map((b) => {
                    const name = String(b.name || '').trim()
                    const email = String(b.email || '').trim()
                    const site = String(b.website || '').trim()
                    return (
                      <p
                        key={b.id || `${name}-${email}-${site}`}
                        className="text-[10px] leading-snug text-stone-600"
                      >
                        {name ? <span className="font-semibold text-stone-800">{name}</span> : null}
                        {name && (email || site) ? ' : ' : null}
                        {email ? (
                          <a href={`mailto:${email}`} className="text-brand-800 hover:underline">
                            {email}
                          </a>
                        ) : null}
                        {email && site ? ' · ' : null}
                        {site ? (
                          <a
                            href={websiteHref(site)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-800 hover:underline"
                          >
                            {site.replace(/^https?:\/\//i, '')}
                          </a>
                        ) : null}
                      </p>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </div>

          <div className="w-[44%] max-w-[220px] shrink-0 text-right">
            <div className="mb-1.5 flex items-center justify-end gap-2">
              <img
                src={MSME_BADGE}
                alt="MSME"
                className="h-11 w-11 bg-transparent object-contain"
              />
              <img
                src={DUNS_BADGE}
                alt="D-U-N-S Registered"
                className="h-11 w-auto max-w-[96px] bg-transparent object-contain"
              />
            </div>
            <p className="text-2xl font-bold uppercase tracking-wide text-brand-700">Tax invoice</p>
            {statusLabel ? (
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                {statusLabel}
              </p>
            ) : null}
            <div className="mt-2 space-y-0.5 text-left text-[10px]">
              <div className="flex justify-between gap-2">
                <span className="text-stone-500">Invoice no.</span>
                <span className="font-semibold text-stone-900">{number || '—'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-stone-500">Date</span>
                <span className="text-stone-800">{date ? fmtDate(date) : '—'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-stone-500">Your ref.</span>
                <span className="max-w-[55%] truncate text-right text-stone-800">
                  {yourRef || '—'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-stone-500">Due date</span>
                <span className="text-stone-800">{dueDate ? fmtDate(dueDate) : '—'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 border-y border-stone-100 py-3 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
              Billed to
            </p>
            <p className="mt-1 font-semibold text-stone-900">{billToName || '—'}</p>
            {billToLegalName &&
            String(billToLegalName).trim() !== String(billToName || '').trim() ? (
              <p className="whitespace-pre-wrap text-stone-600">{billToLegalName}</p>
            ) : null}
            {billToAttention ? (
              <p className="whitespace-pre-wrap text-stone-600">{billToAttention}</p>
            ) : null}
            {billToAddress ? (
              <p className="whitespace-pre-wrap text-stone-600">{billToAddress}</p>
            ) : null}
            {billToGstin ? <p className="text-stone-600">GSTIN {billToGstin}</p> : null}
            {billToState ? <p className="text-stone-600">{billToState}</p> : null}
            {billToEmail ? <p className="text-stone-600">{billToEmail}</p> : null}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
              Your contact
            </p>
            <p className="mt-1 font-semibold text-stone-900">
              {contactName || sellerName || '—'}
            </p>
            {contactPhone ? <p className="text-stone-600">Ph: {contactPhone}</p> : null}
            {sellerEmail ? <p className="text-stone-600">{sellerEmail}</p> : null}
            {showSecondaryContact && secondaryContactPhone ? (
              <p className="text-stone-600">Ph: {secondaryContactPhone}</p>
            ) : null}
            {showSecondaryContact && secondaryContactEmail ? (
              <p className="text-stone-600">{secondaryContactEmail}</p>
            ) : null}
            {showTertiaryContact && tertiaryContactPhone ? (
              <p className="text-stone-600">Ph: {tertiaryContactPhone}</p>
            ) : null}
            {showTertiaryContact && tertiaryContactEmail ? (
              <p className="text-stone-600">{tertiaryContactEmail}</p>
            ) : null}
          </div>
        </div>

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
            {displayLines.map((ln, i) => {
              const taxable =
                ln.taxable != null
                  ? Number(ln.taxable)
                  : (Number(ln.qty) || 0) * (Number(ln.unitPrice) || 0)
              const manPower = isManPowerLine(ln)
              return (
                <tr key={ln.id || i} className="border-b border-stone-200 align-top">
                  <td className="px-1 py-1.5 text-stone-500">
                    {String(i + 1).padStart(2, '0')}
                  </td>
                  <td className="px-1 py-1.5">
                    <p className="font-semibold text-stone-900">{ln.item || ln.description || '—'}</p>
                    {ln.specification ? (
                      <p className="mt-0.5 text-stone-500">{ln.specification}</p>
                    ) : null}
                    {Number(ln.discountPct) > 0 ? (
                      <p className="mt-0.5 text-stone-400">Disc {Number(ln.discountPct)}%</p>
                    ) : null}
                  </td>
                  <td className="px-1 py-1.5 text-stone-600">{ln.hsn || '—'}</td>
                  <td className="px-1 py-1.5 text-right tabular-nums">{ln.qty || '—'}</td>
                  <td className="px-1 py-1.5 text-right uppercase text-stone-600">
                    {ln.uom ? uomLabel(ln.uom) : '—'}
                  </td>
                  <td className="px-1 py-1.5 text-right tabular-nums">
                    {manPower ? '—' : fmtMoney(ln.unitPrice)}
                  </td>
                  <td className="px-1 py-1.5 text-right text-stone-600">
                    {ln.leadTime || '—'}
                  </td>
                  <td className="px-1 py-1.5 text-right font-medium tabular-nums">
                    {manPower ? 'Man power' : fmtMoney(taxable)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-[55%] text-[10px] text-stone-600">
            <p>
              <span className="font-semibold text-stone-800">Amount in words: </span>
              <span className="italic">{amountInWords(total)}</span>
            </p>
            {notes ? (
              <p className="mt-1 whitespace-pre-wrap text-stone-500">{notes}</p>
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
                <span className="tabular-nums">{fmtMoney(igstTotal || gstAmount)}</span>
              </div>
            )}
            <div className="flex justify-between gap-4 border-t border-stone-200 pt-1 font-bold text-stone-900">
              <span>Total</span>
              <span className="tabular-nums">{fmtMoney(total)}</span>
            </div>
            {Number(received) > 0 ? (
              <>
                <div className="flex justify-between gap-4 text-stone-500">
                  <span>Received</span>
                  <span className="tabular-nums">{fmtMoney(received)}</span>
                </div>
                <div className="flex justify-between gap-4 font-semibold text-stone-900">
                  <span>Balance due</span>
                  <span className="tabular-nums">{fmtMoney(owed)}</span>
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3 border-t border-stone-100 pt-3 text-[10px]">
          <div className="min-w-0 flex-1 space-y-1 text-stone-500">
            <p className="font-semibold text-stone-700">Terms</p>
            <ol className="list-decimal space-y-0.5 pl-4">
              {(termsList.length ? termsList : ['Payment as agreed on this invoice.']).map(
                (t, i) => (
                  <li key={i}>{t}</li>
                ),
              )}
            </ol>
          </div>
          <p className="shrink-0 pt-0.5 text-right text-stone-500">
            For {sellerName}
            <br />
            Authorized signatory
          </p>
        </div>

        <div className="border-t border-stone-100 pt-3">
          <p className="font-bold text-stone-800">Pay this invoice</p>
          <button type="button" className={`${btnPrimary} mt-2`} disabled>
            Pay online →
          </button>
        </div>
      </div>
    </div>
  )
}

export default InvoiceDocumentPreview
