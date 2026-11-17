import { useEffect, useState } from 'react'
import { FiPlus, FiTrash2 } from 'react-icons/fi'
import { fetchServices } from '../../api/catalog'
import { fetchBillingPatients } from '../../api/tenantBilling'
import StatusBanner from '../../components/ui/StatusBanner'
import { IN_STATES } from '../quotes/states'
import { UOM_OPTIONS } from './gstLines'
import { btnGhost, btnSecondary, fieldClass, labelClass } from '../../utils/ui'

export const money = (n, currency = 'INR') =>
  n == null || n === ''
    ? '—'
    : Number(n).toLocaleString('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 })

export const shortDate = (v) => {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime())
    ? String(v).slice(0, 10)
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const XTenantBanner = ({ slug }) =>
  slug ? (
    <StatusBanner type="info" message={`X-Tenant: ${slug}`} />
  ) : (
    <StatusBanner type="warning" message="Select or activate a tenant first so X-Tenant can be sent." />
  )

const STATUS_TONE = {
  DRAFT: 'bg-stone-100 text-stone-700',
  SENT: 'bg-blue-50 text-blue-800',
  ISSUED: 'bg-blue-50 text-blue-800',
  RAISED: 'bg-blue-50 text-blue-800',
  ACCEPTED: 'bg-emerald-50 text-emerald-800',
  PAID: 'bg-emerald-50 text-emerald-800',
  PARTIALLY_PAID: 'bg-amber-50 text-amber-800',
  OVERDUE: 'bg-amber-50 text-amber-800',
  EXPIRED: 'bg-amber-50 text-amber-800',
  REJECTED: 'bg-rose-50 text-rose-700',
  VOID: 'bg-rose-50 text-rose-700',
  VOIDED: 'bg-rose-50 text-rose-700',
}

export const StatusChip = ({ status }) => (
  <span
    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
      STATUS_TONE[status] || 'bg-stone-100 text-stone-700'
    }`}
  >
    {String(status || '—').replace(/_/g, ' ')}
  </span>
)

/** Patients + services for the selected tenant (dropdown sources). */
export const useBillingRefs = (tenantSlug, enabled = true) => {
  const [patients, setPatients] = useState([])
  const [services, setServices] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!tenantSlug || !enabled) return undefined
    let alive = true
    Promise.allSettled([fetchBillingPatients(tenantSlug), fetchServices(tenantSlug)]).then(
      ([p, s]) => {
        if (!alive) return
        setPatients(p.status === 'fulfilled' ? p.value : [])
        setServices(s.status === 'fulfilled' ? s.value : [])
        setError(
          p.status === 'rejected' || s.status === 'rejected'
            ? 'Could not load patients or services. You can still type IDs manually.'
            : '',
        )
      },
    )
    return () => {
      alive = false
    }
  }, [tenantSlug, enabled])

  return { patients, services, error }
}

export const Field = ({ id, label, required, children, className = '' }) => (
  <div className={className}>
    <label className={labelClass} htmlFor={id}>
      {label} {required ? <span className="text-rose-600">*</span> : null}
    </label>
    {children}
  </div>
)

export const RefSelect = ({ id, value, onChange, rows, placeholder, required }) =>
  rows.length ? (
    <select
      id={id}
      className={fieldClass}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
    >
      <option value="">{placeholder}</option>
      {rows.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
      {value && !rows.some((r) => String(r.id) === String(value)) ? (
        <option value={value}>#{value}</option>
      ) : null}
    </select>
  ) : (
    <input
      id={id}
      className={fieldClass}
      placeholder={`${placeholder} (ID)`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
    />
  )

export const StateSelect = ({ id, value, onChange }) => (
  <select id={id} className={fieldClass} value={value} onChange={(e) => onChange(e.target.value)} required>
    <option value="">Select state</option>
    {IN_STATES.map((s) => (
      <option key={s.code} value={s.name}>
        {s.name}
      </option>
    ))}
    {value && !IN_STATES.some((s) => s.name === value) ? <option value={value}>{value}</option> : null}
  </select>
)

export const lineTotal = (ln, qtyKey) => {
  const qty = Number(ln[qtyKey]) || 0
  const price = Number(ln.unit_price) || 0
  const disc = Math.min(100, Math.max(0, Number(ln.discount_percent) || 0))
  const taxable = qty * price * (1 - disc / 100)
  return taxable * (1 + (Number(ln.gst_rate) || 0) / 100)
}

/**
 * Editable GST line table.
 * columns: [{ key, label, type: 'text'|'number'|'select'|'uom', options?, className? }]
 */
export const LinesEditor = ({ lines, onChange, columns, emptyLine, qtyKey }) => {
  const update = (i, key, value) =>
    onChange(lines.map((ln, idx) => (idx === i ? { ...ln, [key]: value } : ln)))
  const add = () => onChange([...lines, { ...emptyLine, key: `new-${Date.now()}` }])
  const remove = (i) => onChange(lines.filter((_, idx) => idx !== i))
  const total = lines.reduce((sum, ln) => sum + lineTotal(ln, qtyKey), 0)

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-stone-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-2 py-2">#</th>
              {columns.map((c) => (
                <th key={c.key} className="px-2 py-2">
                  {c.label}
                </th>
              ))}
              <th className="px-2 py-2 text-right">Total</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {lines.map((ln, i) => (
              <tr key={ln.key || i}>
                <td className="px-2 py-2 text-stone-500">{i + 1}</td>
                {columns.map((c) => (
                  <td key={c.key} className={`px-1 py-1.5 ${c.className || ''}`}>
                    {c.type === 'select' || c.type === 'uom' ? (
                      <select
                        className={`${fieldClass} py-1.5`}
                        aria-label={`${c.label} line ${i + 1}`}
                        value={ln[c.key]}
                        onChange={(e) => update(i, c.key, e.target.value)}
                      >
                        {(c.type === 'uom'
                          ? UOM_OPTIONS
                          : c.options.map((o) => ({ value: o, label: o.replace(/_/g, ' ') }))
                        ).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className={`${fieldClass} py-1.5`}
                        aria-label={`${c.label} line ${i + 1}`}
                        type={c.type === 'number' ? 'number' : 'text'}
                        step={c.type === 'number' ? '0.01' : undefined}
                        min={c.type === 'number' ? '0' : undefined}
                        value={ln[c.key]}
                        onChange={(e) => update(i, c.key, e.target.value)}
                      />
                    )}
                  </td>
                ))}
                <td className="whitespace-nowrap px-2 py-2 text-right font-medium text-stone-800">
                  {money(lineTotal(ln, qtyKey))}
                </td>
                <td className="px-1 py-1.5">
                  <button
                    type="button"
                    className={`${btnGhost} text-rose-600 hover:bg-rose-50`}
                    onClick={() => remove(i)}
                    disabled={lines.length <= 1}
                    aria-label={`Remove line ${i + 1}`}
                  >
                    <FiTrash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className={btnSecondary} onClick={add}>
          <FiPlus className="h-4 w-4" aria-hidden />
          Add line
        </button>
        <p className="text-sm text-stone-600">
          Lines total (incl. GST): <span className="font-semibold text-ink">{money(total)}</span>
        </p>
      </div>
    </div>
  )
}
