/**
 * Settings UI primitives — modern layout without a second component library.
 * Tokens: StarAdmin brand/ink/stone (see uiux-rules). Icons: react-icons/fi.
 */

export const settingsNavBtn = (active, collapsed = false) =>
  `group relative flex w-full items-center rounded-xl text-left text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 ${
    collapsed ? 'justify-center gap-0 px-2 py-2.5' : 'gap-3 px-3 py-2.5'
  } ${
    active
      ? 'bg-brand-50 text-brand-800 shadow-sm ring-1 ring-brand-100'
      : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
  }`

export const SettingsNavIcon = ({ active, children }) => (
  <span
    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 ${
      active
        ? 'bg-white text-brand-700 shadow-sm ring-1 ring-brand-100'
        : 'bg-stone-100 text-stone-500 group-hover:bg-white group-hover:text-stone-700'
    }`}
    aria-hidden
  >
    {children}
  </span>
)

export const SectionCard = ({ title, description, action, children, className = '' }) => (
  <div
    className={`sc-fade-in overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-sm ${className}`}
  >
    {(title || description || action) && (
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 px-4 py-3.5 md:px-5">
        <div className="min-w-0">
          {title ? (
            <h4 className="text-sm font-semibold tracking-tight text-stone-900">{title}</h4>
          ) : null}
          {description ? (
            <p className="mt-0.5 max-w-prose text-xs leading-relaxed text-stone-500">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    )}
    <div className="p-4 md:p-5">{children}</div>
  </div>
)

export const StatTile = ({ label, value, hint }) => (
  <div className="rounded-2xl border border-stone-200/90 bg-gradient-to-b from-white to-stone-50/80 p-4 transition-colors duration-150 hover:border-brand-200">
    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">{label}</p>
    <p className="mt-1.5 text-base font-semibold tracking-tight text-stone-900 capitalize">
      {value || '—'}
    </p>
    {hint ? <p className="mt-1 text-[11px] text-stone-500">{hint}</p> : null}
  </div>
)

export const Segmented = ({ options, value, onChange, disabled }) => (
  <div
    role="radiogroup"
    className="inline-flex w-full flex-wrap gap-1 rounded-xl border border-stone-200 bg-stone-50 p-1 sm:w-auto"
  >
    {options.map((opt) => {
      const active = value === opt.value
      return (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={active}
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={`min-h-9 flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 sm:flex-none ${
            active
              ? 'bg-white text-ink shadow-sm ring-1 ring-stone-200'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          {opt.label}
        </button>
      )
    })}
  </div>
)

export const ToggleRow = ({
  label,
  description,
  checked,
  onChange,
  disabled,
  badge,
}) => (
  <label
    className={`flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-stone-200/90 px-3.5 py-3 transition-colors duration-150 ${
      disabled ? 'cursor-not-allowed opacity-70' : 'hover:border-stone-300 hover:bg-stone-50/80'
    }`}
  >
    <span className="min-w-0">
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-stone-800">{label}</span>
        {badge ? (
          <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
            {badge}
          </span>
        ) : null}
      </span>
      {description ? (
        <span className="mt-0.5 block text-xs leading-relaxed text-stone-500">{description}</span>
      ) : null}
    </span>
    <span className="relative mt-0.5 inline-flex shrink-0">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className={`relative h-6 w-11 rounded-full transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500/30 peer-focus-visible:ring-offset-2 ${
          checked ? 'bg-ink' : 'bg-stone-300'
        } ${disabled ? 'opacity-60' : ''}`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </span>
  </label>
)

export const SoftBadge = ({ tone = 'neutral', children }) => {
  const tones = {
    success: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    warn: 'bg-amber-50 text-amber-900 ring-amber-100',
    brand: 'bg-brand-50 text-brand-800 ring-brand-100',
    neutral: 'bg-stone-100 text-stone-600 ring-stone-200',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${tones[tone] || tones.neutral}`}
    >
      {children}
    </span>
  )
}
