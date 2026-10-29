import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import TenantOpsPlaceholder from '../components/TenantOpsPlaceholder'
import { useAccess } from '../hooks/useAccess'
import {
  fmtDate,
  fmtDateTime,
  fmtMoney,
  getPayment,
  paymentStatusClass,
} from '../features/payments/store'
import { btnPrimary, btnSecondary } from '../utils/ui'

const sectionLabel = 'text-[11px] font-bold uppercase tracking-wide text-brand-700'

const Row = ({ label, children }) => (
  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-stone-100 py-2.5 last:border-0">
    <dt className="text-sm text-stone-500">{label}</dt>
    <dd className="max-w-[65%] text-right text-sm font-medium text-stone-900">{children}</dd>
  </div>
)

const PaymentDetailPage = () => {
  const { paymentId } = useParams()
  const navigate = useNavigate()
  const { isSuperAdmin } = useAccess()
  const payment = useMemo(() => getPayment(paymentId), [paymentId])

  if (!isSuperAdmin) {
    return (
      <TenantOpsPlaceholder
        title="Payments"
        description="Your organization’s payment history will appear here when tenant payments are enabled."
      />
    )
  }

  if (!payment) {
    return (
      <div className="sc-page-enter space-y-4">
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-10 text-center">
          <p className="font-medium text-rose-800">Payment not found</p>
          <p className="mt-1 text-sm text-rose-700">
            It may have been removed, or the link is wrong.
          </p>
          <Link to="/ops/payments" className={`${btnPrimary} mt-4 inline-flex`}>
            Back to payments
          </Link>
        </div>
      </div>
    )
  }

  const ok = String(payment.status).toUpperCase() === 'SUCCESS'

  return (
    <div className="sc-page-enter space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-brand-700">
            <Link to="/ops/payments" className="hover:underline">
              Payments
            </Link>
            <span className="text-stone-300"> / </span>
            {payment.ref}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${paymentStatusClass(
                payment.status,
              )}`}
            >
              {payment.status}
            </span>
            <span className="inline-flex rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-semibold text-stone-700">
              Tenant → O-HM
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
            {fmtMoney(payment.amount)}
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            {payment.tenantName}
            <span className="text-stone-400"> · </span>
            {payment.purpose}
          </p>
        </div>
        <Link to="/ops/payments" className={btnSecondary}>
          Back
        </Link>
      </div>

      {payment.notes ? (
        <p className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-700">
          {payment.notes}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
          <h2 className={sectionLabel}>Payment</h2>
          <dl className="mt-2">
            <Row label="Reference">{payment.ref}</Row>
            <Row label="Amount">{fmtMoney(payment.amount)}</Row>
            <Row label="Currency">{payment.currency || 'INR'}</Row>
            <Row label="Status">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${paymentStatusClass(
                  payment.status,
                )}`}
              >
                {payment.status}
              </span>
            </Row>
            <Row label="Paid at">{fmtDateTime(payment.paidAt)}</Row>
            <Row label="Received at">
              {payment.receivedAt ? fmtDateTime(payment.receivedAt) : '—'}
            </Row>
            <Row label="Purpose">{payment.purpose || '—'}</Row>
          </dl>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
          <h2 className={sectionLabel}>Payment mode</h2>
          <dl className="mt-2">
            <Row label="Mode">{payment.mode || '—'}</Row>
            <Row label="Details">{payment.modeDetail || '—'}</Row>
            <Row label="Gateway">{payment.gateway || '—'}</Row>
            <Row label="Gateway txn ID">{payment.gatewayTxnId || '—'}</Row>
            <Row label="Bank / UTR ref">{payment.bankRef || '—'}</Row>
          </dl>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
          <h2 className={sectionLabel}>From tenant</h2>
          <dl className="mt-2">
            <Row label="Tenant">{payment.tenantName || '—'}</Row>
            <Row label="Payer">{payment.payerName || '—'}</Row>
            <Row label="Payer email">{payment.payerEmail || '—'}</Row>
            <Row label="Paid to">O-HM Senior Care</Row>
          </dl>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
          <h2 className={sectionLabel}>Linked invoice</h2>
          <dl className="mt-2">
            <Row label="Invoice">
              {payment.invoiceNumber ? (
                payment.invoiceId ? (
                  <button
                    type="button"
                    className="font-medium text-brand-800 hover:underline"
                    onClick={() => navigate(`/ops/invoices/${payment.invoiceId}`)}
                  >
                    {payment.invoiceNumber}
                  </button>
                ) : (
                  payment.invoiceNumber
                )
              ) : (
                '—'
              )}
            </Row>
            <Row label="Date">{fmtDate(payment.paidAt)}</Row>
            <Row label="Settlement">{ok ? 'Applied to platform books' : 'Not settled'}</Row>
          </dl>
          {isSuperAdmin && payment.invoiceId ? (
            <button
              type="button"
              className={`${btnSecondary} mt-3`}
              onClick={() => navigate(`/ops/invoices/${payment.invoiceId}`)}
            >
              Open invoice
            </button>
          ) : null}
        </section>
      </div>
    </div>
  )
}

export default PaymentDetailPage
