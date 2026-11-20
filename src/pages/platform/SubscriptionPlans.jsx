import { useRef, useState } from 'react'
import { FiCheck, FiPlus, FiTrash2, FiX } from 'react-icons/fi'
import PageHeader from '../../components/ui/PageHeader'
import { btnGhost, btnPrimary, btnSecondary, fieldClass, labelClass } from '../../utils/ui'

const CURRENCIES = [
  { code: 'INR', symbol: '₹' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
]

const SEED = [
  {
    id: 'tier-free',
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    badge: '',
    features: ['Up to 3 projects', 'Basic analytics', 'Community support'],
    ctaText: 'Get Started',
    highlighted: false,
  },
  {
    id: 'tier-pro',
    name: 'Pro',
    monthlyPrice: 29,
    yearlyPrice: 290,
    badge: 'Most Popular',
    features: ['Unlimited projects', 'Advanced analytics', 'Priority support', 'Custom integrations'],
    ctaText: 'Start Free Trial',
    highlighted: true,
  },
  {
    id: 'tier-ent',
    name: 'Enterprise',
    monthlyPrice: 99,
    yearlyPrice: 990,
    badge: 'Best Value',
    features: [
      'Everything in Pro',
      'Dedicated account manager',
      'Custom contracts',
      'SLA guarantee',
      'Advanced security',
    ],
    ctaText: 'Contact Sales',
    highlighted: false,
  },
]

const blankTier = () => ({
  id: `tier-${Date.now()}`,
  name: 'New Tier',
  monthlyPrice: 0,
  yearlyPrice: 0,
  badge: '',
  features: ['Feature 1'],
  ctaText: 'Get Started',
  highlighted: false,
})

const SubscriptionPlans = () => {
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [currency, setCurrency] = useState('INR')
  const [tiers, setTiers] = useState(SEED)
  const [draftFeature, setDraftFeature] = useState({})
  const editorRef = useRef(null)

  const symbol = CURRENCIES.find((c) => c.code === currency)?.symbol || '₹'

  const addTier = () => {
    const tier = blankTier()
    setTiers((t) => [...t, tier])
    window.requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.setTimeout(() => {
        document.getElementById(`tier-editor-${tier.id}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        })
        document
          .querySelector(`#tier-editor-${tier.id} input[aria-label="Tier name"]`)
          ?.focus()
      }, 280)
    })
  }

  const updateTier = (id, field, value) => {
    setTiers((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)))
  }

  const addFeature = (tierId) => {
    const text = String(draftFeature[tierId] || '').trim()
    if (!text) return
    setTiers((prev) =>
      prev.map((t) => (t.id === tierId ? { ...t, features: [...t.features, text] } : t)),
    )
    setDraftFeature((d) => ({ ...d, [tierId]: '' }))
  }

  const removeFeature = (tierId, index) => {
    setTiers((prev) =>
      prev.map((t) =>
        t.id === tierId ? { ...t, features: t.features.filter((_, i) => i !== index) } : t,
      ),
    )
  }

  return (
    <div className="sc-page-enter space-y-4">
      <PageHeader
        eyebrow="Platform · Billing"
        title="Plans"
        description="Build pricing tiers and preview the public plan cards. Save API will land with the new plans contract."
        actions={
          <button type="button" className={btnPrimary} onClick={addTier}>
            <FiPlus className="h-4 w-4" aria-hidden />
            Add tier
          </button>
        }
      />

      <div className="space-y-4">
        <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">Live preview</h2>
            <div
              role="tablist"
              aria-label="Billing cycle"
              className="inline-flex rounded-xl border border-stone-200 bg-stone-50 p-1"
            >
              {['monthly', 'yearly'].map((cycle) => {
                const on = billingCycle === cycle
                return (
                  <button
                    key={cycle}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setBillingCycle(cycle)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 ${
                      on ? 'bg-ink text-white shadow-sm' : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    {cycle === 'monthly' ? 'Monthly' : 'Yearly'}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tiers.map((tier) => {
              const price = billingCycle === 'monthly' ? tier.monthlyPrice : tier.yearlyPrice
              const savings =
                tier.monthlyPrice > 0 && billingCycle === 'yearly'
                  ? Math.round(
                      ((tier.monthlyPrice * 12 - tier.yearlyPrice) / (tier.monthlyPrice * 12)) *
                        100,
                    )
                  : 0

              return (
                <article
                  key={tier.id}
                  className={`relative flex flex-col rounded-xl border-2 p-5 transition-shadow ${
                    tier.highlighted
                      ? 'border-brand-500 shadow-md'
                      : 'border-stone-200 shadow-sm'
                  }`}
                >
                  {tier.badge ? (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-3 py-0.5 text-[11px] font-semibold text-white">
                      {tier.badge}
                    </span>
                  ) : null}

                  <h3 className="text-lg font-bold text-ink">{tier.name}</h3>
                  <p className="mt-2 mb-4">
                    <span className="text-3xl font-bold text-ink">
                      {symbol}
                      {price}
                    </span>
                    <span className="text-sm text-stone-500">
                      /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                    </span>
                  </p>
                  {savings > 0 ? (
                    <p className="mb-3 text-xs font-medium text-emerald-700">
                      Save {savings}% with yearly billing
                    </p>
                  ) : null}

                  <button
                    type="button"
                    className={`mb-4 w-full rounded-lg px-4 py-2.5 text-sm font-semibold ${
                      tier.highlighted
                        ? 'bg-ink text-white hover:bg-stone-800'
                        : 'bg-stone-100 text-ink hover:bg-stone-200'
                    }`}
                  >
                    {tier.ctaText}
                  </button>

                  <ul className="space-y-2">
                    {tier.features.map((feature, index) => (
                      <li key={`${tier.id}-p-${index}`} className="flex gap-2 text-sm text-stone-600">
                        <FiCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              )
            })}
          </div>
        </section>

        <section
          ref={editorRef}
          id="plans-editor"
          className="space-y-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm md:p-5"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">Editor</h2>
            <label className="block sm:w-40">
              <span className={labelClass}>Currency</span>
              <select
                className={fieldClass}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                aria-label="Currency"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                id={`tier-editor-${tier.id}`}
                className="rounded-xl border border-stone-200 p-4"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <input
                    className="min-w-0 flex-1 border-b border-transparent bg-transparent text-base font-semibold text-ink outline-none focus:border-brand-500"
                    value={tier.name}
                    onChange={(e) => updateTier(tier.id, 'name', e.target.value)}
                    aria-label="Tier name"
                  />
                  <button
                    type="button"
                    className={`${btnGhost} text-rose-600 hover:bg-rose-50`}
                    onClick={() => setTiers((prev) => prev.filter((t) => t.id !== tier.id))}
                    aria-label={`Delete ${tier.name}`}
                  >
                    <FiTrash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>

                <div className="mb-3 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>Monthly ({symbol})</span>
                    <input
                      type="number"
                      min={0}
                      className={fieldClass}
                      value={tier.monthlyPrice}
                      onChange={(e) =>
                        updateTier(tier.id, 'monthlyPrice', Number(e.target.value) || 0)
                      }
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Yearly ({symbol})</span>
                    <input
                      type="number"
                      min={0}
                      className={fieldClass}
                      value={tier.yearlyPrice}
                      onChange={(e) =>
                        updateTier(tier.id, 'yearlyPrice', Number(e.target.value) || 0)
                      }
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Badge</span>
                    <input
                      className={fieldClass}
                      placeholder="e.g. Most Popular"
                      value={tier.badge}
                      onChange={(e) => updateTier(tier.id, 'badge', e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>CTA text</span>
                    <input
                      className={fieldClass}
                      value={tier.ctaText}
                      onChange={(e) => updateTier(tier.id, 'ctaText', e.target.value)}
                    />
                  </label>
                </div>

                <label className="mb-3 inline-flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-stone-300 text-ink focus:ring-brand-500/30"
                    checked={tier.highlighted}
                    onChange={(e) => updateTier(tier.id, 'highlighted', e.target.checked)}
                  />
                  Highlight this tier
                </label>

                <div>
                  <span className={labelClass}>Features</span>
                  <ul className="mb-2 space-y-1.5">
                    {tier.features.map((feature, index) => (
                      <li key={`${tier.id}-f-${index}`} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 text-sm text-stone-600">{feature}</span>
                        <button
                          type="button"
                          className={`${btnGhost} text-rose-600 hover:bg-rose-50`}
                          onClick={() => removeFeature(tier.id, index)}
                          aria-label={`Remove ${feature}`}
                        >
                          <FiX className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <input
                      className={fieldClass}
                      placeholder="Add feature…"
                      value={draftFeature[tier.id] || ''}
                      onChange={(e) =>
                        setDraftFeature((d) => ({ ...d, [tier.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addFeature(tier.id)
                        }
                      }}
                    />
                    <button type="button" className={btnSecondary} onClick={() => addFeature(tier.id)}>
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default SubscriptionPlans
