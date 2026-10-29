import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FiPlus, FiTrash2 } from 'react-icons/fi'
import InvoiceDocumentPreview from '../components/InvoiceDocumentPreview'
import StatusBanner from '../components/ui/StatusBanner'
import TenantOpsPlaceholder from '../components/TenantOpsPlaceholder'
import { useAccess } from '../hooks/useAccess'
import { loadSettingsForMode } from '../features/settings/store'
import { listTenantsByStatus } from '../store/platformStore'
import {
  createTenantInvoice,
  fmtMoney,
  getInvoice,
  nextInvoiceNumber,
} from '../features/invoices/store'
import { btnGhost, btnPrimary, btnSecondary, fieldClass, labelClass } from '../utils/ui'

const PLATFORM = {
  name: 'O-HM Senior Care',
  email: 'support@o-hm.com',
  address: 'India',
}

const LINE_PRESETS = [
  { id: 'sub', label: 'Platform subscription', category: 'Subscription' },
  { id: 'onboard', label: 'Tenant onboarding fee', category: 'Platform fee' },
  { id: 'pkg', label: 'Care package settlement', category: 'Tenant package' },
  { id: 'custom', label: 'Custom line', category: 'Platform fee' },
]

const emptyLine = () => ({
  id: `ln-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
  item: '',
  category: 'Platform fee',
  qty: 1,
  unitPrice: 0,
})

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

const readSellerGstin = () => {
  try {
    return loadSettingsForMode('account', {})?.billing?.gstin || ''
  } catch {
    return ''
  }
}

const sectionLabel = 'text-[11px] font-bold uppercase tracking-wide text-brand-700'

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
  const sellerGstin = useMemo(() => readSellerGstin(), [])

  const [status, setStatus] = useState({ type: '', message: '' })
  const [saving, setSaving] = useState(false)
  const [tenantId, setTenantId] = useState(
    () => existing?.tenantId || tenants[0]?.id || '',
  )
  const [payerName, setPayerName] = useState(
    () => existing?.payerName || existing?.clientName || '',
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
    () => existing?.terms || 'Net 15 · tenant bank transfer',
  )
  const [notes, setNotes] = useState(() => existing?.note || '')
  const [received, setReceived] = useState(() =>
    String(existing?.received != null ? existing.received : 0),
  )
  const [lines, setLines] = useState(() => {
    if (Array.isArray(existing?.lines) && existing.lines.length) {
      return existing.lines.map((ln) => ({ ...ln }))
    }
    return [
      {
        ...emptyLine(),
        item: 'Platform subscription · monthly',
        category: 'Subscription',
        qty: 1,
        unitPrice: 9999,
      },
    ]
  })

  const tenant = tenants.find((t) => String(t.id) === String(tenantId)) || null
  const dueDate = addDays(date, Math.max(0, Number(dueDays) || 0))
  const subtotal = lines.reduce(
    (s, ln) => s + (Number(ln.qty) || 0) * (Number(ln.unitPrice) || 0),
    0,
  )
  const gstAmount = subtotal * 0.18
  const total = subtotal + gstAmount
  const billTenant = !isEdit || existing?.billTo === 'tenant' || Boolean(existing?.tenantId)

  const patchLine = (id, patch) => {
    setLines((rows) => rows.map((ln) => (ln.id === id ? { ...ln, ...patch } : ln)))
  }

  const addLine = (preset) => {
    if (lines.length >= 20) {
      setStatus({ type: 'error', message: 'Maximum 20 lines per invoice.' })
      return
    }
    const base = emptyLine()
    if (preset && preset.id !== 'custom') {
      base.item = preset.label
      base.category = preset.category
    }
    setLines((rows) => [...rows, base])
  }

  const removeLine = (id) => {
    setLines((rows) => (rows.length <= 1 ? rows : rows.filter((ln) => ln.id !== id)))
  }

  const persist = (asSent) => {
    if (canWrite === false) {
      setStatus({ type: 'error', message: 'You do not have permission to save invoices.' })
      return
    }
    if (!isSuperAdmin) {
      setStatus({
        type: 'error',
        message: 'Only O-HM platform admins can manage tenant invoices.',
      })
      return
    }
    if (billTenant && !tenant && !existing) {
      setStatus({ type: 'error', message: 'Select the tenant to bill.' })
      return
    }
    if (!billTenant && !String(payerName).trim()) {
      setStatus({ type: 'error', message: 'Add the payer name.' })
      return
    }
    if (!String(number).trim()) {
      setStatus({ type: 'error', message: 'Add an invoice number.' })
      return
    }
    if (!lines.some((ln) => String(ln.item).trim() && Number(ln.unitPrice) > 0)) {
      setStatus({ type: 'error', message: 'Add at least one priced line.' })
      return
    }

    setSaving(true)
    try {
      const row = createTenantInvoice({
        existing: existing || null,
        tenant: billTenant ? tenant : null,
        payerName: billTenant ? tenant?.name || existing?.payerName : payerName.trim(),
        number: number.trim(),
        date,
        dueDate,
        terms,
        notes,
        lines,
        asSent,
        amountReceived: Number(received) || 0,
        subtotal,
        gstAmount,
        total,
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
            {isEdit ? 'Edit invoice' : 'Invoice a tenant'}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-stone-500">
            {isEdit
              ? `Update ${existing.number}. Document preview matches the quote layout.`
              : `Same document layout as quotes — issued by ${PLATFORM.name} to the selected tenant. GST 18% is added on the preview.`}
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
            {billTenant ? (
              <>
                <label className="block">
                  <span className={labelClass}>Tenant</span>
                  <select
                    className={fieldClass}
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                  >
                    {tenants.length === 0 ? (
                      <option value="">No active tenants</option>
                    ) : (
                      tenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {t.city ? ` · ${t.city}` : ''}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                {tenant ? (
                  <dl className="grid gap-2 rounded-xl border border-stone-100 bg-stone-50 px-3.5 py-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-stone-500">Owner / attention</dt>
                      <dd className="font-medium text-stone-800">
                        {tenant.owner_name || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-stone-500">Billing email</dt>
                      <dd className="font-medium text-stone-800">
                        {tenant.owner_email || tenant.email || '—'}
                      </dd>
                    </div>
                  </dl>
                ) : null}
              </>
            ) : (
              <label className="block">
                <span className={labelClass}>Payer</span>
                <input
                  className={fieldClass}
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                />
              </label>
            )}
          </section>

          <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={sectionLabel}>Lines · {lines.length} of 20</h2>
              <div className="flex flex-wrap gap-1">
                {LINE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={btnGhost}
                    onClick={() => addLine(p)}
                  >
                    <FiPlus className="h-3.5 w-3.5" aria-hidden />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <ul className="space-y-3">
              {lines.map((ln, i) => (
                <li
                  key={ln.id}
                  className="space-y-2 rounded-xl border border-stone-200 bg-stone-50/80 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-stone-500">Line {i + 1}</p>
                    <button
                      type="button"
                      className={btnGhost}
                      aria-label="Remove line"
                      onClick={() => removeLine(ln.id)}
                      disabled={lines.length <= 1}
                    >
                      <FiTrash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                  <label className="block">
                    <span className={labelClass}>Description</span>
                    <input
                      className={fieldClass}
                      value={ln.item}
                      onChange={(e) => patchLine(ln.id, { item: e.target.value })}
                    />
                  </label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="block">
                      <span className={labelClass}>Category</span>
                      <select
                        className={fieldClass}
                        value={ln.category}
                        onChange={(e) => patchLine(ln.id, { category: e.target.value })}
                      >
                        <option>Subscription</option>
                        <option>Platform fee</option>
                        <option>Tenant package</option>
                        <option>Assessment</option>
                        <option>Other</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className={labelClass}>Qty</span>
                      <input
                        type="number"
                        min={1}
                        className={fieldClass}
                        value={ln.qty}
                        onChange={(e) =>
                          patchLine(ln.id, { qty: Number(e.target.value) || 0 })
                        }
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
                        onChange={(e) =>
                          patchLine(ln.id, { unitPrice: Number(e.target.value) || 0 })
                        }
                      />
                    </label>
                  </div>
                </li>
              ))}
            </ul>
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
              <span className={labelClass}>Payment terms</span>
              <input
                className={fieldClass}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
              />
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
              <div className="mt-1 flex justify-between gap-2">
                <span className="text-stone-500">GST 18%</span>
                <span className="font-medium">{fmtMoney(gstAmount)}</span>
              </div>
              <div className="mt-2 flex justify-between gap-2 border-t border-stone-200 pt-2 text-base font-semibold">
                <span>Total (INR)</span>
                <span>{fmtMoney(total)}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnPrimary}
                disabled={saving || (billTenant && !tenant && !existing)}
                onClick={() => persist(true)}
              >
                {isEdit ? 'Save & raise' : 'Raise invoice to tenant'}
              </button>
              <button
                type="button"
                className={btnSecondary}
                disabled={saving || (billTenant && !tenant && !existing)}
                onClick={() => persist(false)}
              >
                {isEdit ? 'Save changes' : 'Save draft'}
              </button>
            </div>
          </section>
        </div>

        <aside className="xl:sticky xl:top-4 xl:self-start">
          <InvoiceDocumentPreview
            sellerName={PLATFORM.name}
            sellerAddress={PLATFORM.address}
            sellerGstin={sellerGstin}
            sellerEmail={PLATFORM.email}
            number={number}
            date={date}
            dueDate={dueDate}
            terms={terms}
            billToName={
              billTenant ? tenant?.name || existing?.tenantName || '—' : payerName || '—'
            }
            billToAttention={tenant?.owner_name || existing?.ownerName || ''}
            billToAddress={tenant?.city || existing?.city || existing?.venue || ''}
            billToEmail={
              tenant?.owner_email || tenant?.email || existing?.email || ''
            }
            placeOfSupply={
              tenant?.city ||
              tenant?.name ||
              existing?.city ||
              existing?.venue ||
              existing?.tenantName ||
              '—'
            }
            notes={notes}
            lines={lines}
            subtotal={subtotal}
            gstAmount={gstAmount}
            total={total}
            received={Number(received) || 0}
            statusLabel={isEdit ? existing?.status || 'Edit' : 'Preview'}
          />
        </aside>
      </div>
    </div>
  )
}

export default InvoiceCreatePage
