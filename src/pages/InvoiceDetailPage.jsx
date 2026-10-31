import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FiCheck, FiDownload, FiPlus } from 'react-icons/fi'
import InvoiceDocumentPreview from '../components/InvoiceDocumentPreview'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import StatusBanner from '../components/ui/StatusBanner'
import TenantOpsPlaceholder from '../components/TenantOpsPlaceholder'
import { useAccess } from '../hooks/useAccess'
import { loadSettingsForMode } from '../features/settings/store'
import {
  DUE_STEPS,
  deleteInvoice,
  displayPayer,
  fmtDate,
  fmtDateTime,
  fmtMoney,
  getInvoice,
} from '../features/invoices/store'
import { btnDanger, btnGhost, btnPrimary, btnSecondary, fieldClass, labelClass } from '../utils/ui'

const readSellerGstin = () => {
  try {
    return loadSettingsForMode('account', {})?.billing?.gstin || ''
  } catch {
    return ''
  }
}

const sectionLabel = 'text-[11px] font-bold uppercase tracking-wide text-brand-700'

const todayInput = () => {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

const DueInvoiceView = ({ record, canWrite, status, setStatus }) => {
  const navigate = useNavigate()
  const initialStep = Math.min(
    Math.max(Number(record.currentStep) || 0, 0),
    DUE_STEPS.length - 1,
  )
  const lines = Array.isArray(record.lines) ? record.lines : []
  const paidInFull = Number(record.owed) <= 0 && Number(record.received) > 0

  const [stepIndex, setStepIndex] = useState(initialStep)
  const [owner, setOwner] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [doneDate, setDoneDate] = useState(todayInput())
  const [note, setNote] = useState('')
  const [invNumber, setInvNumber] = useState('')
  const [invDate, setInvDate] = useState(todayInput())
  const [invAmount, setInvAmount] = useState(String(record.amount ?? ''))
  const [billAs, setBillAs] = useState('family')
  const [doneSteps, setDoneSteps] = useState(() =>
    DUE_STEPS.map((_, i) => i < initialStep),
  )

  const activeStep = DUE_STEPS[Math.min(stepIndex, DUE_STEPS.length - 1)]

  useEffect(() => {
    const next = Math.min(
      Math.max(Number(record.currentStep) || 0, 0),
      DUE_STEPS.length - 1,
    )
    setStepIndex(next)
    setInvAmount(String(record.amount ?? ''))
    setDoneSteps(DUE_STEPS.map((_, i) => i < next))
    setOwner('')
    setTargetDate('')
    setDoneDate(todayInput())
    setNote('')
  }, [record])

  const markStepDone = () => {
    if (canWrite === false) {
      setStatus({ type: 'error', message: 'You do not have permission to update this booking.' })
      return
    }
    const title = activeStep?.title || 'Step'
    setDoneSteps((prev) => prev.map((v, i) => (i === stepIndex ? true : v)))
    if (stepIndex < DUE_STEPS.length - 1) {
      setStepIndex(stepIndex + 1)
      setOwner('')
      setTargetDate('')
      setDoneDate(todayInput())
      setNote('')
    }
    setStatus({
      type: 'success',
      message: `Marked “${title}” done (demo — not saved to API).`,
    })
  }

  const saveInvoice = () => {
    if (canWrite === false) {
      setStatus({ type: 'error', message: 'You do not have permission to raise invoices.' })
      return
    }
    if (!String(invNumber).trim()) {
      setStatus({ type: 'error', message: 'Add an invoice number before saving.' })
      return
    }
    setStatus({
      type: 'success',
      message: `Invoice ${invNumber.trim()} saved for ${record.bookingRef} (demo).`,
    })
  }

  const addDoc = (label) => {
    setStatus({
      type: 'info',
      message: `${label} attach is demo-only for now.`,
    })
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
            Due
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className="inline-flex rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-800 ring-1 ring-brand-100">
              Care booking · {record.bookingRef}
            </span>
            {record.tenantName ? (
              <span className="inline-flex rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-semibold text-stone-700">
                Tenant · {record.tenantName}
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">
              {displayPayer(record)}
            </h1>
            <span className="inline-flex items-center rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-700">
              {record.bookingRef}
            </span>
          </div>
          {record.patientName ? (
            <p className="mt-1 text-sm text-stone-600">
              Resident <span className="font-medium text-stone-800">{record.patientName}</span>
              {record.venue ? ` · ${record.venue}` : ''}
            </p>
          ) : null}
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-stone-600">
            <span>
              Now: <span className="font-semibold text-stone-900">{activeStep.title}</span>
            </span>
            <span className="inline-flex rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-800 ring-1 ring-brand-100">
              Waiting {record.daysWaiting} day{record.daysWaiting === 1 ? '' : 's'} for invoice
            </span>
          </p>
        </div>
        <Link to="/ops/invoices" className={btnSecondary}>
          Back
        </Link>
      </div>

      <StatusBanner type={status.type} message={status.message} />

      {record.banner ? (
        <p className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm leading-relaxed text-stone-700">
          {record.banner}
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="space-y-3">
          <ol className="space-y-2">
            {DUE_STEPS.map((step, i) => {
              const isDone = Boolean(doneSteps[i])
              const isActive = i === stepIndex && !isDone
              const locked = i > stepIndex

              return (
                <li
                  key={step.id}
                  className={`rounded-2xl border bg-white shadow-sm transition-colors ${
                    isActive
                      ? 'border-ink ring-1 ring-ink/10'
                      : locked
                        ? 'border-stone-200 opacity-60'
                        : 'border-stone-200'
                  }`}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isDone
                          ? 'bg-emerald-500 text-white'
                          : isActive
                            ? 'bg-ink text-white'
                            : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {isDone ? <FiCheck className="h-3.5 w-3.5" aria-hidden /> : i + 1}
                    </span>
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-semibold ${
                          locked ? 'text-stone-500' : 'text-stone-900'
                        }`}
                      >
                        {step.title}
                      </p>
                      {step.hint ? (
                        <p className="mt-0.5 text-xs text-stone-500">{step.hint}</p>
                      ) : null}
                    </div>
                  </div>

                  {isActive ? (
                    <div className="space-y-3 border-t border-stone-100 px-4 pb-4 pt-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className={labelClass}>Responsible</span>
                          <select
                            className={fieldClass}
                            value={owner}
                            onChange={(e) => setOwner(e.target.value)}
                            disabled={canWrite === false}
                          >
                            <option value="">Unassigned</option>
                            <option value="platform">Platform ops (O-HM)</option>
                            <option value="tenant">Tenant ops</option>
                            <option value="coordinator">Care coordinator</option>
                            <option value="venue">Venue lead</option>
                          </select>
                        </label>
                        <label className="block">
                          <span className={labelClass}>Target date</span>
                          <input
                            type="date"
                            className={fieldClass}
                            value={targetDate}
                            onChange={(e) => setTargetDate(e.target.value)}
                            disabled={canWrite === false}
                          />
                        </label>
                      </div>
                      <label className="block">
                        <span className={labelClass}>Completed on</span>
                        <input
                          type="date"
                          className={fieldClass}
                          value={doneDate}
                          onChange={(e) => setDoneDate(e.target.value)}
                          disabled={canWrite === false}
                        />
                      </label>
                      <label className="block">
                        <span className={labelClass}>Note (optional)</span>
                        <textarea
                          className={`${fieldClass} min-h-[88px]`}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          disabled={canWrite === false}
                          placeholder="e.g. caregiver name, shift notes, family feedback"
                        />
                      </label>
                      {canWrite !== false ? (
                        <button type="button" className={btnPrimary} onClick={markStepDone}>
                          Mark “{step.title}” done
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ol>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
            <h2 className={sectionLabel}>Money</h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">Care booking total</dt>
                <dd className="font-semibold text-stone-900">{fmtMoney(record.amount)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">Terms</dt>
                <dd className="text-right text-stone-800">{record.terms || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">Platform invoice</dt>
                <dd className="text-stone-800">Not raised</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">Collected</dt>
                <dd className="font-medium text-stone-900">{fmtMoney(record.received)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-stone-100 pt-2.5">
                <dt className="text-stone-500">Still owed by payer</dt>
                <dd
                  className={
                    paidInFull ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-700'
                  }
                >
                  {paidInFull ? 'Nothing — settled' : fmtMoney(record.owed)}
                </dd>
              </div>
            </dl>

            {(Number(record.received) || 0) > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-stone-900">
                    Collected · {fmtDate(record.createdAt)}
                  </p>
                  <p className="text-xs text-stone-500">
                    {paidInFull ? 'prepaid with booking' : 'advance / partial'}
                  </p>
                </div>
                <p className="font-semibold text-stone-900">{fmtMoney(record.received)}</p>
              </div>
            ) : null}

            <div className="space-y-3 border-t border-stone-100 pt-3">
              <label className="block">
                <span className={labelClass}>Invoice number</span>
                <input
                  className={fieldClass}
                  value={invNumber}
                  onChange={(e) => setInvNumber(e.target.value)}
                  placeholder="e.g. 036/202627"
                  disabled={canWrite === false}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>Date</span>
                  <input
                    type="date"
                    className={fieldClass}
                    value={invDate}
                    onChange={(e) => setInvDate(e.target.value)}
                    disabled={canWrite === false}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Amount (₹)</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={fieldClass}
                    value={invAmount}
                    onChange={(e) => setInvAmount(e.target.value)}
                    disabled={canWrite === false}
                  />
                </label>
              </div>
              {canWrite !== false ? (
                <button type="button" className={btnPrimary} onClick={saveInvoice}>
                  Save invoice
                </button>
              ) : null}
            </div>
          </section>

          <section className="space-y-2 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
            <h2 className={sectionLabel}>Staff on this booking</h2>
            <p className="text-sm text-stone-500">
              No caregiver assignment linked yet. Assign from the tenant roster when care is
              scheduled.
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
            <h2 className={sectionLabel}>Care booking</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">Booked</dt>
                <dd className="text-stone-800">{fmtDate(record.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">Tenant</dt>
                <dd className="text-right text-stone-800">{record.tenantName || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">Venue</dt>
                <dd className="text-right text-stone-800">{record.venue || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">Payer email</dt>
                <dd className="truncate text-right text-stone-800">{record.email}</dd>
              </div>
              {record.patientName ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-stone-500">Resident</dt>
                  <dd className="text-right text-stone-800">{record.patientName}</dd>
                </div>
              ) : null}
            </dl>
            <ul className="divide-y divide-stone-100 border-t border-stone-100 pt-2">
              {lines.map((ln) => (
                <li
                  key={ln.id}
                  className="flex items-start justify-between gap-2 py-2.5 first:pt-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-900">{ln.item}</p>
                    <p className="text-xs text-stone-500">{ln.category}</p>
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    <p className="text-stone-500">× {ln.qty}</p>
                    <p className="font-medium text-stone-900">
                      {fmtMoney(Number(ln.unitPrice) * Number(ln.qty || 1))}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="text-sm font-medium text-brand-800 hover:underline"
              onClick={() => navigate('/ops/bookings')}
            >
              Open bookings
            </button>
          </section>
        </aside>
      </div>

      <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={sectionLabel}>Documents</h2>
            <p className="mt-1 text-xs text-stone-500">
              Attach proof of care and the platform tax invoice for this booking.
            </p>
          </div>
          <label className="block w-full max-w-xs sm:w-auto">
            <span className={labelClass}>Bill as</span>
            <select
              className={fieldClass}
              value={billAs}
              onChange={(e) => setBillAs(e.target.value)}
            >
              <option value="family">Family / individual (B2C)</option>
              <option value="tenant">Tenant organisation (B2B)</option>
              <option value="insurance">Insurance / TPA</option>
            </select>
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
              Care delivered
            </p>
            <p className="mt-1 text-sm font-semibold text-stone-900">Visit / attendance note</p>
            <button
              type="button"
              className={`${btnGhost} mt-3`}
              onClick={() => addDoc('Visit / attendance note')}
            >
              <FiPlus className="h-3.5 w-3.5" aria-hidden />
              Add
            </button>
          </div>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
              Invoice raised
            </p>
            <p className="mt-1 text-sm font-semibold text-stone-900">Tax invoice (O-HM)</p>
            <button
              type="button"
              className={`${btnGhost} mt-3`}
              onClick={() => addDoc('Tax invoice')}
            >
              <FiPlus className="h-3.5 w-3.5" aria-hidden />
              Add
            </button>
          </div>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
              Optional
            </p>
            <p className="mt-1 text-sm font-semibold text-stone-900">E-invoice IRN</p>
            <button
              type="button"
              className={`${btnGhost} mt-3`}
              onClick={() => addDoc('E-invoice IRN')}
            >
              <FiPlus className="h-3.5 w-3.5" aria-hidden />
              Add
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

const InvoiceDetailPage = () => {
  const { invoiceId } = useParams()
  const navigate = useNavigate()
  const { canWrite, isSuperAdmin } = useAccess()
  const record = useMemo(() => getInvoice(invoiceId), [invoiceId])
  const [status, setStatus] = useState({ type: '', message: '' })
  const [testEmail, setTestEmail] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setTestEmail(record?.email || '')
    setStatus({ type: '', message: '' })
  }, [record])

  const handleDelete = () => {
    if (canWrite === false || !record) return
    setDeleting(true)
    try {
      deleteInvoice(record.id)
      setConfirmDelete(false)
      navigate('/ops/invoices')
    } catch {
      setStatus({ type: 'error', message: 'Could not delete this invoice.' })
      setDeleting(false)
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

  if (!record) {
    return (
      <div className="sc-page-enter space-y-4">
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-10 text-center">
          <p className="font-medium text-rose-800">Invoice not found</p>
          <p className="mt-1 text-sm text-rose-700">
            It may have been removed, or the link is wrong.
          </p>
          <Link to="/ops/invoices" className={`${btnPrimary} mt-4 inline-flex`}>
            Back to invoices
          </Link>
        </div>
      </div>
    )
  }

  if (record.kind === 'due') {
    return (
      <DueInvoiceView
        record={record}
        canWrite={canWrite}
        status={status}
        setStatus={setStatus}
      />
    )
  }

  const owed = Number(record.owed) || 0
  const paidInFull = owed <= 0
  const timeline = Array.isArray(record.timeline) ? record.timeline : []
  const lines = Array.isArray(record.lines) ? record.lines : []
  const sellerGstin = readSellerGstin()
  const subtotal =
    record.subtotal != null
      ? Number(record.subtotal)
      : lines.reduce((s, ln) => s + (Number(ln.qty) || 0) * (Number(ln.unitPrice) || 0), 0)
  const gstAmount =
    record.gstAmount != null ? Number(record.gstAmount) : Math.max(0, Number(record.amount) - subtotal)
  const cgstTotal = Number(record.cgstTotal) || 0
  const sgstTotal = Number(record.sgstTotal) || 0
  const igstTotal = Number(record.igstTotal) || 0
  const total = Number(record.amount) || subtotal + gstAmount
  const intraState =
    cgstTotal > 0 || sgstTotal > 0 ? true : igstTotal > 0 ? false : null

  const handleDownload = () => {
    setStatus({
      type: 'info',
      message: 'PDF download is demo-only — use the on-screen tax invoice preview.',
    })
  }

  const handleSend = () => {
    setStatus({
      type: 'success',
      message: `Invoice queued to ${testEmail || record.email} (demo — not emailed).`,
    })
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
            {record.number}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-800 ring-1 ring-brand-100">
              Invoice · {record.number}
            </span>
            {record.billTo === 'tenant' ? (
              <span className="inline-flex rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-semibold text-stone-700">
                Tenant bill
              </span>
            ) : null}
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
            {displayPayer(record)}
          </h1>
          {record.patientName && record.patientName !== '— (tenant package)' ? (
            <p className="mt-1 text-sm text-stone-600">
              Resident <span className="font-medium text-stone-800">{record.patientName}</span>
              {record.tenantName ? ` · ${record.tenantName}` : ''}
            </p>
          ) : record.tenantName ? (
            <p className="mt-1 text-sm text-stone-600">Tenant · {record.tenantName}</p>
          ) : null}
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-stone-600">
            {paidInFull ? (
              <>
                <span className="inline-flex gap-0.5" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className="h-2 w-2 rounded-full bg-emerald-500" />
                  ))}
                </span>
                Settled
              </>
            ) : (
              <>
                <span className="inline-flex h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                Balance outstanding · {fmtMoney(owed)}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700">
            {record.bookingRef}
          </span>
          {canWrite !== false && isSuperAdmin ? (
            <>
              <Link to={`/ops/invoices/${record.id}/edit`} className={btnSecondary}>
                Edit
              </Link>
              <button
                type="button"
                className={btnDanger}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </button>
            </>
          ) : null}
          <Link to="/ops/invoices" className={btnSecondary}>
            Back
          </Link>
        </div>
      </div>

      <StatusBanner type={status.type} message={status.message} />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete invoice?"
        message={`Delete ${record.number} for ${displayPayer(record)}? This cannot be undone.`}
        confirmLabel="Delete invoice"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => {
          if (!deleting) setConfirmDelete(false)
        }}
      />

      {record.note ? (
        <p className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-700">
          {record.note}
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
            <h2 className={sectionLabel}>Status</h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">Total incl. GST</dt>
                <dd className="font-semibold text-stone-900">{fmtMoney(total)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">Terms</dt>
                <dd className="text-right text-stone-800">{record.terms || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">Received</dt>
                <dd className="font-medium text-stone-900">{fmtMoney(record.received)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-stone-100 pt-2.5">
                <dt className="text-stone-500">Still owed</dt>
                <dd
                  className={
                    paidInFull ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-700'
                  }
                >
                  {paidInFull ? 'Nothing — settled' : fmtMoney(owed)}
                </dd>
              </div>
            </dl>
            <div className="flex flex-col gap-2 pt-1">
              <button type="button" className={btnPrimary} onClick={handleDownload}>
                <FiDownload className="h-4 w-4" aria-hidden />
                Download PDF
              </button>
              {canWrite !== false && isSuperAdmin ? (
                <Link to={`/ops/invoices/${record.id}/edit`} className={btnSecondary}>
                  Make Revision
                </Link>
              ) : null}
            </div>
            <div className="border-t border-stone-100 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">
                Send to
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                <input
                  type="email"
                  className={fieldClass}
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  aria-label="Recipient email"
                />
                <button type="button" className={btnGhost} onClick={handleSend}>
                  Send
                </button>
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
            <h2 className={sectionLabel}>History</h2>
            {timeline.length === 0 ? (
              <p className="text-sm text-stone-500">No history yet.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-stone-200 pl-4">
                {timeline.map((step) => (
                  <li key={step.id} className="relative text-sm">
                    <span className="absolute -left-[1.3rem] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white" />
                    <p className="font-semibold text-stone-900">{step.title}</p>
                    <p className="mt-0.5 text-xs text-stone-500">{fmtDateTime(step.at)}</p>
                    {step.detail ? (
                      <p className="mt-0.5 text-xs text-stone-500">{step.detail}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="space-y-2 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
            <h2 className={sectionLabel}>Care booking</h2>
            <p className="text-sm text-stone-800">
              <span className="text-stone-500">Tenant · </span>
              {record.tenantName || '—'}
            </p>
            <p className="text-sm text-stone-800">
              <span className="text-stone-500">Venue · </span>
              {record.venue || '—'}
            </p>
            <button
              type="button"
              className="mt-1 text-sm font-medium text-brand-800 hover:underline"
              onClick={() => navigate('/ops/bookings')}
            >
              Open bookings
            </button>
          </section>
        </div>

        <aside>
          <InvoiceDocumentPreview
            sellerName={record.sellerName || 'O-HM Senior Care'}
            sellerAddress={record.sellerAddress || 'India'}
            sellerPhone={record.sellerPhone || ''}
            sellerGstin={record.sellerGstin || sellerGstin}
            logoUrl={record.logoUrl || ''}
            sellerEmail={record.contactEmail || 'support@o-hm.com'}
            contactName={record.contactName || ''}
            contactPhone={record.contactPhone || ''}
            number={record.number}
            date={record.date}
            dueDate={record.dueDate}
            terms={record.terms}
            billToName={displayPayer(record)}
            billToAttention={record.attention || record.ownerName || ''}
            billToAddress={record.address || record.city || record.venue || ''}
            billToGstin={record.gstin || ''}
            billToEmail={record.email || ''}
            yourRef={record.yourRef || record.bookingRef}
            notes={record.note}
            lines={lines}
            subtotal={subtotal}
            cgstTotal={cgstTotal}
            sgstTotal={sgstTotal}
            igstTotal={igstTotal}
            gstAmount={gstAmount}
            total={total}
            received={Number(record.received) || 0}
            intraState={intraState}
            statusLabel={record.status}
          />
        </aside>
      </div>
    </div>
  )
}

export default InvoiceDetailPage
