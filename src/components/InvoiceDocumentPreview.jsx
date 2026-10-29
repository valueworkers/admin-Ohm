import { amountInWords } from '../features/quotes/states'
import { fmtDate, fmtMoney } from '../features/invoices/store'
import { btnPrimary } from '../utils/ui'

const PLATFORM = {
  name: 'O-HM Senior Care',
  email: 'support@o-hm.com',
  address: 'India',
}

/**
 * Tax-invoice document chrome — same layout language as the quote preview.
 */
const InvoiceDocumentPreview = ({
  sellerName = PLATFORM.name,
  sellerAddress = PLATFORM.address,
  sellerGstin = '',
  sellerEmail = PLATFORM.email,
  number = '—',
  date,
  dueDate,
  terms = '',
  billToName = '—',
  billToAttention = '',
  billToAddress = '',
  billToGstin = '',
  billToEmail = '',
  placeOfSupply = '',
  yourRef = '',
  notes = '',
  lines = [],
  subtotal = 0,
  gstAmount = 0,
  gstLabel = 'GST 18%',
  total = 0,
  received = 0,
  statusLabel = '',
}) => {
  const owed = Math.max(0, Number(total) - Number(received || 0))

  return (
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
            {(sellerName || 'OH').slice(0, 2).toUpperCase()}
          </span>
        </div>
      </div>

      <div className="space-y-4 p-4 text-[11px] leading-relaxed text-stone-700">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-stone-100 pb-3">
          <div>
            <p className="text-lg font-bold tracking-tight text-stone-900">Tax invoice</p>
            {statusLabel ? (
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                {statusLabel}
              </p>
            ) : null}
          </div>
          <div className="text-right text-stone-500">
            <p>Invoice no. · {number || '—'}</p>
            <p>Date {date ? fmtDate(date) : '—'}</p>
            {dueDate ? <p>Due {fmtDate(dueDate)}</p> : null}
            {terms ? <p className="max-w-[200px]">{terms}</p> : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="font-bold uppercase tracking-wide text-stone-400">Billed to</p>
            <p className="mt-1 font-semibold text-stone-900">{billToName || '—'}</p>
            {billToAttention ? <p className="whitespace-pre-wrap">{billToAttention}</p> : null}
            {billToAddress ? <p className="whitespace-pre-wrap">{billToAddress}</p> : null}
            {billToGstin ? <p>GSTIN {billToGstin}</p> : null}
            {billToEmail ? <p>{billToEmail}</p> : null}
          </div>
          <div>
            <p className="font-bold uppercase tracking-wide text-stone-400">Place of supply</p>
            <p className="mt-1 whitespace-pre-wrap font-semibold text-stone-900">
              {placeOfSupply || '—'}
            </p>
          </div>
          <div>
            <p className="font-bold uppercase tracking-wide text-stone-400">Your contact</p>
            <p className="mt-1 font-semibold text-stone-900">{sellerName}</p>
            {sellerEmail ? <p>{sellerEmail}</p> : null}
          </div>
        </div>

        {yourRef ? (
          <p>
            <span className="text-stone-400">Your ref. · </span>
            {yourRef}
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
            {(lines.length ? lines : [{ id: 'empty', item: '', qty: 0, unitPrice: 0 }]).map(
              (ln, i) => {
                const amt = (Number(ln.qty) || 0) * (Number(ln.unitPrice) || 0)
                return (
                  <tr key={ln.id || i} className="border-b border-stone-100 align-top">
                    <td className="py-2 pr-2 text-stone-400">
                      {String(i + 1).padStart(2, '0')}
                    </td>
                    <td className="py-2 pr-2">
                      <p className="font-semibold text-stone-900">{ln.item || '—'}</p>
                      {ln.specification ? (
                        <p className="text-stone-500">{ln.specification}</p>
                      ) : null}
                      {ln.category ? (
                        <p className="mt-0.5 text-[10px] uppercase text-stone-400">
                          {ln.category}
                          {ln.hsn ? ` · HSN ${ln.hsn}` : ''}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-2 pr-2 text-right">{ln.qty || '—'}</td>
                    <td className="py-2 text-right font-medium">{fmtMoney(amt)}</td>
                  </tr>
                )
              },
            )}
          </tbody>
        </table>

        <div className="ml-auto max-w-[220px] space-y-1 border border-stone-200 bg-stone-50 p-2.5">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{fmtMoney(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>{gstLabel}</span>
            <span>{fmtMoney(gstAmount)}</span>
          </div>
          <div className="flex justify-between border-t border-stone-200 pt-1 font-bold text-stone-900">
            <span>Total (INR)</span>
            <span>{fmtMoney(total)}</span>
          </div>
          {Number(received) > 0 ? (
            <>
              <div className="flex justify-between text-stone-500">
                <span>Received</span>
                <span>{fmtMoney(received)}</span>
              </div>
              <div className="flex justify-between font-semibold text-stone-900">
                <span>Balance due</span>
                <span>{fmtMoney(owed)}</span>
              </div>
            </>
          ) : null}
        </div>

        {notes ? <p className="whitespace-pre-wrap text-stone-600">{notes}</p> : null}
        <p className="italic text-stone-500">{amountInWords(total)}</p>

        <div className="space-y-1 border-t border-stone-100 pt-3 text-[10px] text-stone-500">
          <p className="font-semibold text-stone-700">Terms</p>
          <ol className="list-decimal space-y-0.5 pl-4">
            <li>{terms || 'Payment as agreed on this invoice.'}</li>
            <li>This is a tax invoice from O-HM Senior Care to the billed tenant.</li>
            <li>Care services are delivered by the tenant venue unless stated otherwise.</li>
            <li>Disputes must be raised within 7 days of the invoice date.</li>
            <li>Subject to laws of India.</li>
          </ol>
        </div>

        <div className="border-t border-stone-100 pt-3">
          <p className="font-bold text-stone-800">Pay this invoice</p>
          <button type="button" className={`${btnPrimary} mt-2 w-full sm:w-auto`} disabled>
            Pay online →
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
}

export default InvoiceDocumentPreview
