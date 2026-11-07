import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiExternalLink,
  FiInbox,
  FiMail,
  FiPlus,
  FiRefreshCw,
} from 'react-icons/fi'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import TenantOpsPlaceholder from '../components/TenantOpsPlaceholder'
import { EmptyState, LoadingState } from '../components/ui/PageState'
import { BENGALURU_SENIOR_CARE_LEADS } from '../data/bengaluruSeniorCareLeads'
import { useAccess } from '../hooks/useAccess'
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  fieldClass,
  labelClass,
  tableWrapClass,
} from '../utils/ui'

const LEADS_STORAGE_KEY = 'sc_platform_leads_v5'
const SCRAPE_BATCH = 3
const OHM_WEBSITE = 'https://o-hm.com'
const SENDER_NAME = 'O-HM Senior Care'
const COMPANY = 'O-HM'

const SCRAPE_CITY_OPTIONS = ['Bengaluru', 'Bangalore', 'Mysuru', 'Mysore', 'Chennai', 'Hyderabad']

/** Soft suggestions only — area stays free text for future places API. */
const SCRAPE_AREA_HINTS = {
  bengaluru: [
    'Whitefield',
    'Koramangala',
    'Jayanagar',
    'Indiranagar',
    'Hennur',
    'Banashankari',
    'Mathikere',
    'Kothanur',
    'RT Nagar',
    'Bannerghatta',
    'Domlur',
    'Kasavanahalli',
    'Banaswadi',
    'Hulimavu',
  ],
  bangalore: [
    'Whitefield',
    'Koramangala',
    'Jayanagar',
    'Indiranagar',
    'Hennur',
    'Banashankari',
    'Mathikere',
    'Kothanur',
    'RT Nagar',
    'Bannerghatta',
    'Domlur',
  ],
  mysuru: ['Gokulam', 'Vijayanagar', 'Saraswathipuram', 'Yadavagiri', 'Bannimantap'],
  mysore: ['Gokulam', 'Vijayanagar', 'Saraswathipuram', 'Yadavagiri', 'Bannimantap'],
  chennai: ['Adyar', 'T Nagar', 'Anna Nagar', 'Velachery', 'Mylapore'],
  hyderabad: ['Gachibowli', 'Banjara Hills', 'Madhapur', 'Secunderabad', 'Kukatpally'],
}

const blankScrapeForm = () => ({
  city: 'Bengaluru',
  area: '',
  query: 'senior care homes',
  pincode: '',
})

const normalizeCityKey = (city) =>
  String(city || '')
    .trim()
    .toLowerCase()

const areaHintsForCity = (city) => SCRAPE_AREA_HINTS[normalizeCityKey(city)] || []

const isBengaluruCity = (city) => {
  const c = normalizeCityKey(city)
  return c === 'bengaluru' || c === 'bangalore'
}

const scrapeAreaLabel = (form) => {
  const bits = [form.city, form.area, form.pincode]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
  return bits.join(', ')
}

const RequiredMark = () => (
  <span className="text-rose-600" aria-hidden="true">
    {' '}
    *
  </span>
)

const matchesScrapeCriteria = (raw, form) => {
  if (!isBengaluruCity(form.city)) return false
  const hay = `${raw.companyName || ''} ${raw.address || ''}`.toLowerCase()
  const pin = String(form.pincode || '').trim()
  if (pin && !hay.includes(pin)) return false

  const area = String(form.area || '').trim().toLowerCase()
  if (area) {
    const tokens = area
      .split(/[,/]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2)
    if (tokens.length && !tokens.some((t) => hay.includes(t))) return false
  }

  const query = String(form.query || '').trim().toLowerCase()
  if (query) {
    const stop = new Set(['the', 'and', 'for', 'of', 'in', 'a', 'an', 'to'])
    const tokens = query
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3 && !stop.has(t))
    const specific = tokens.filter(
      (t) => !['senior', 'care', 'home', 'homes', 'old', 'age', 'elder', 'assisted'].includes(t),
    )
    if (specific.length && !specific.some((t) => hay.includes(t))) return false
  }
  return true
}

const LEAD_TYPES = [
  {
    key: 'direct',
    label: 'Direct Lead',
    hint: 'Customer directly connects with you',
  },
  {
    key: 'partner',
    label: 'Partner / Referral',
    hint: 'Referred by vendors, partners or affiliates',
  },
  {
    key: 'self_generated',
    label: 'Self-Generated',
    hint: 'Leads your team created',
  },
  {
    key: 'exhibition',
    label: 'Exhibition / Event',
    hint: 'Leads from fairs, events and exhibitions',
  },
  {
    key: 'potential',
    label: 'Potential Leads',
    hint: 'Scraped / prospect list',
  },
]

const PIPELINE_STATUSES = [
  { key: 'yet_to_start', label: 'Yet to Start' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'quote_provided', label: 'Quote Provided' },
  { key: 'demo_completed', label: 'Demo completed' },
  { key: 'waiting_po', label: 'Waiting for PO/SO' },
]

const LEAD_STATUSES = ['Open', 'On Hold', 'Closed']
const ONBOARDING = ['Yes', 'No']
const SALUTATIONS = ['Mr', 'Mrs', 'Ms', 'Dr', '']

const splitName = (full) => {
  const parts = String(full || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return { firstName: '', middleName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], middleName: '', lastName: '' }
  if (parts.length === 2) return { firstName: parts[0], middleName: '', lastName: parts[1] }
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts[parts.length - 1],
  }
}

const displayName = (lead) => {
  const parts = [lead.salutation, lead.firstName, lead.middleName, lead.lastName]
    .map((p) => String(p || '').trim())
    .filter(Boolean)
  return parts.join(' ') || lead.primaryContactName || '—'
}

const initials = (lead) => {
  const source = lead.companyName || displayName(lead)
  const bits = String(source)
    .split(/\s+/)
    .filter(Boolean)
  if (!bits.length) return '?'
  if (bits.length === 1) return bits[0].slice(0, 2).toUpperCase()
  return `${bits[0][0] || ''}${bits[1][0] || ''}`.toUpperCase()
}

const fmtDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const fmtDateTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const leadTypeLabel = (key) => LEAD_TYPES.find((t) => t.key === key)?.label || key

const pipelineLabel = (key) => PIPELINE_STATUSES.find((p) => p.key === key)?.label || key

const newHistoryId = () =>
  `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

const makeHistoryEntry = (type, title, summary = '', payload = {}, at = null) => ({
  id: newHistoryId(),
  type,
  at: at || new Date().toISOString(),
  title,
  summary,
  payload,
})

const historyFromLegacy = (lead) => {
  const items = Array.isArray(lead.history) ? [...lead.history] : []
  if (lead.emailSentAt && !items.some((h) => h.type === 'email_sent' && h.at === lead.emailSentAt)) {
    items.push({
      id: newHistoryId(),
      type: 'email_sent',
      at: lead.emailSentAt,
      title: 'Email sent',
      summary: lead.emailSubject || '',
      payload: {
        to: lead.emailTo || '',
        subject: lead.emailSubject || '',
        body: lead.emailBodyDraft || '',
      },
    })
  }
  if (lead.leadIdentifiedDate && !items.some((h) => h.type === 'created')) {
    items.push({
      id: newHistoryId(),
      type: 'created',
      at: lead.leadIdentifiedDate,
      title: 'Lead identified',
      summary: leadTypeLabel(lead.leadType),
      payload: {},
    })
  }
  return items.sort((a, b) => new Date(b.at) - new Date(a.at))
}

const toLocalInputValue = (iso) => {
  const d = iso ? new Date(iso) : new Date()
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const toGoogleCalendarDates = (startIso, durationMins = 30) => {
  const start = new Date(startIso)
  if (Number.isNaN(start.getTime())) return ''
  const end = new Date(start.getTime() + durationMins * 60 * 1000)
  const stamp = (d) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}${String(d.getUTCSeconds()).padStart(2, '0')}Z`
  return `${stamp(start)}/${stamp(end)}`
}

const buildMeetCode = () => {
  const chunk = () => Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 3)
  return `${chunk()}-${chunk()}-${chunk()}`
}

const HISTORY_LABEL = {
  created: 'Created',
  email_sent: 'Email sent',
  email_received: 'Email received',
  meeting: 'Meeting',
  pipeline: 'Pipeline',
}

const statusChip = (status) => {
  if (status === 'Open') return 'bg-emerald-50 text-emerald-800'
  if (status === 'On Hold') return 'bg-amber-50 text-amber-900'
  if (status === 'Closed') return 'bg-stone-100 text-stone-600'
  return 'bg-stone-100 text-stone-700'
}

const onboardChip = (value) =>
  value === 'Yes' ? 'bg-teal-50 text-teal-800' : 'bg-stone-100 text-stone-600'

const leadsTheadClass =
  'border-b border-stone-200 bg-white text-xs font-medium text-stone-500'

const buildEmailSubject = (lead) =>
  `Tenant-based management software for ${lead.companyName || displayName(lead)}`

const buildEmailBody = (lead) => {
  const who = lead.companyName || displayName(lead)
  const greeting = lead.firstName
    ? `Hi ${lead.firstName},`
    : `Hi ${lead.primaryContactName || 'there'},`
  return `${greeting}

I came across ${who} while researching senior care providers in Bengaluru.

We have built OHM, a tenant-based management system made for senior care services: care homes, caregiver agencies and therapy providers. Each organisation gets its own workspace to manage residents or clients, caregivers, schedules, billing and reports in one place.

You can see more here: ${OHM_WEBSITE}

If this looks useful, reply to this email and we will set up a short walkthrough.

Warm regards,
${SENDER_NAME}
${COMPANY}

If you would rather not hear from us, reply "unsubscribe" and we will not contact you again.`
}

const EMAIL_SPLIT = /[,;\s]+/

const parseEmailList = (value) =>
  String(value || '')
    .split(EMAIL_SPLIT)
    .map((part) => part.trim())
    .filter(Boolean)

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

const defaultToEmails = (lead) =>
  [lead.primaryEmailId, lead.secondaryEmailId].map((v) => String(v || '').trim()).filter(Boolean)

const openMailto = (to, subject, body) => {
  const recipients = Array.isArray(to) ? to : parseEmailList(to)
  const href = `mailto:${recipients.map(encodeURIComponent).join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  window.location.href = href
}

const makeLead = (partial, seq) => {
  const contact = partial.primaryContactName || ''
  const names = splitName(contact)
  const firstName = partial.firstName ?? names.firstName
  const middleName = partial.middleName ?? names.middleName
  const lastName = partial.lastName ?? names.lastName
  const salutation = partial.salutation ?? ''
  return {
    leadId: partial.leadId || `LD-${String(1000 + seq).padStart(4, '0')}`,
    salutation,
    firstName,
    middleName,
    lastName,
    companyName: partial.companyName || '',
    primaryContactName:
      contact ||
      displayName({ salutation, firstName, middleName, lastName }) ||
      '',
    primaryContactNumber: partial.primaryContactNumber || '',
    alternateContactName: partial.alternateContactName || '',
    alternateContactNumber: partial.alternateContactNumber || '',
    primaryEmailId: partial.primaryEmailId || '',
    secondaryEmailId: partial.secondaryEmailId || '',
    address: partial.address || '',
    website: partial.website || '',
    leadIdentifiedDate: partial.leadIdentifiedDate || new Date().toISOString(),
    status: partial.status || 'Open',
    leadType: partial.leadType || 'direct',
    affiliate: partial.affiliate || '',
    onboardingStatus: partial.onboardingStatus || 'No',
    pipelineStatus: partial.pipelineStatus || 'yet_to_start',
    history: historyFromLegacy({
      ...partial,
      leadType: partial.leadType || 'direct',
      leadIdentifiedDate: partial.leadIdentifiedDate || new Date().toISOString(),
      history: partial.history,
    }),
  }
}

const blankLeadForm = (leadType = 'direct') => ({
  salutation: '',
  firstName: '',
  middleName: '',
  lastName: '',
  companyName: '',
  primaryContactName: '',
  primaryContactNumber: '',
  alternateContactName: '',
  alternateContactNumber: '',
  primaryEmailId: '',
  secondaryEmailId: '',
  address: '',
  website: '',
  leadIdentifiedDate: new Date().toISOString().slice(0, 10),
  status: 'Open',
  leadType,
  affiliate: '',
  onboardingStatus: 'No',
  pipelineStatus: 'yet_to_start',
})

const AddLeadModal = ({ initialType, onClose, onSave }) => {
  const [form, setForm] = useState(() => blankLeadForm(initialType))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const hasIdentity =
      form.companyName.trim() ||
      form.primaryContactName.trim() ||
      form.firstName.trim() ||
      form.lastName.trim()
    if (!hasIdentity) {
      setError('Add a company name or contact name.')
      return
    }
    if (!form.leadType) {
      setError('Select a lead type.')
      return
    }
    setPending(true)
    try {
      await onSave(form)
    } catch {
      setError('Could not save the lead. Try again.')
      setPending(false)
    }
  }

  return (
    <Modal
      open
      xl
      title="Add lead"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" form="add-lead-form" className={btnPrimary} disabled={pending}>
            {pending ? 'Saving…' : 'Save lead'}
          </button>
        </div>
      }
    >
      <form id="add-lead-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error ? <StatusBanner type="error" message={error} /> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className={labelClass}>Lead type</span>
            <select className={fieldClass} value={form.leadType} onChange={set('leadType')} required>
              {LEAD_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Status</span>
            <select className={fieldClass} value={form.status} onChange={set('status')}>
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Pipeline status</span>
            <select
              className={fieldClass}
              value={form.pipelineStatus}
              onChange={set('pipelineStatus')}
            >
              {PIPELINE_STATUSES.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Onboarding</span>
            <select
              className={fieldClass}
              value={form.onboardingStatus}
              onChange={set('onboardingStatus')}
            >
              {ONBOARDING.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className={labelClass}>Salutation</span>
            <select className={fieldClass} value={form.salutation} onChange={set('salutation')}>
              <option value="">—</option>
              {SALUTATIONS.filter(Boolean).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>First name</span>
            <input className={fieldClass} value={form.firstName} onChange={set('firstName')} />
          </label>
          <label className="block">
            <span className={labelClass}>Middle name</span>
            <input className={fieldClass} value={form.middleName} onChange={set('middleName')} />
          </label>
          <label className="block">
            <span className={labelClass}>Last name</span>
            <input className={fieldClass} value={form.lastName} onChange={set('lastName')} />
          </label>
        </div>

        <label className="block">
          <span className={labelClass}>Company name</span>
          <input className={fieldClass} value={form.companyName} onChange={set('companyName')} />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Primary contact name</span>
            <input
              className={fieldClass}
              value={form.primaryContactName}
              onChange={set('primaryContactName')}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Primary contact number</span>
            <input
              className={fieldClass}
              type="tel"
              value={form.primaryContactNumber}
              onChange={set('primaryContactNumber')}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Alternate contact name</span>
            <input
              className={fieldClass}
              value={form.alternateContactName}
              onChange={set('alternateContactName')}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Alternate contact number</span>
            <input
              className={fieldClass}
              type="tel"
              value={form.alternateContactNumber}
              onChange={set('alternateContactNumber')}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Primary email</span>
            <input
              className={fieldClass}
              type="email"
              value={form.primaryEmailId}
              onChange={set('primaryEmailId')}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Secondary email</span>
            <input
              className={fieldClass}
              type="email"
              value={form.secondaryEmailId}
              onChange={set('secondaryEmailId')}
            />
          </label>
        </div>

        <label className="block">
          <span className={labelClass}>Address</span>
          <textarea
            className={`${fieldClass} min-h-[72px]`}
            rows={2}
            value={form.address}
            onChange={set('address')}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className={labelClass}>Website</span>
            <input className={fieldClass} value={form.website} onChange={set('website')} />
          </label>
          <label className="block">
            <span className={labelClass}>Lead identified date</span>
            <input
              className={fieldClass}
              type="date"
              value={form.leadIdentifiedDate}
              onChange={set('leadIdentifiedDate')}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Affiliate</span>
            <input className={fieldClass} value={form.affiliate} onChange={set('affiliate')} />
          </label>
        </div>
      </form>
    </Modal>
  )
}

const ScrapeLeadsModal = ({ initial, onClose, onRun, running }) => {
  const [form, setForm] = useState(() => {
    const base = { ...blankScrapeForm(), ...initial }
    // Migrate old dropdown values stored as "All areas" / "Custom"
    if (base.area === 'All areas' || base.area === 'Custom') base.area = base.customArea || ''
    delete base.customArea
    return base
  })
  const [error, setError] = useState('')
  const areaListId = 'scrape-area-options'
  const areaHints = areaHintsForCity(form.city)

  const setCity = (value) => {
    setForm((prev) => {
      const nextCity = value
      const prevKey = normalizeCityKey(prev.city)
      const nextKey = normalizeCityKey(nextCity)
      // City change clears locality — ready for places API per city
      if (prevKey !== nextKey) {
        return { ...prev, city: nextCity, area: '', pincode: '' }
      }
      return { ...prev, city: nextCity }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!String(form.city || '').trim()) {
      setError('Enter a city.')
      return
    }
    if (form.pincode && !/^\d{6}$/.test(String(form.pincode).trim())) {
      setError('Pincode must be 6 digits, or leave it blank.')
      return
    }
    try {
      await onRun({
        city: String(form.city || '').trim(),
        area: String(form.area || '').trim(),
        query: String(form.query || '').trim(),
        pincode: String(form.pincode || '').trim(),
      })
    } catch {
      setError('Could not start scrape. Try again.')
    }
  }

  return (
    <Modal
      open
      wide
      title="Scrape potential leads"
      onClose={() => {
        if (!running) onClose?.()
      }}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className={btnSecondary}
            onClick={onClose}
            disabled={running}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="scrape-leads-form"
            className={btnPrimary}
            disabled={running}
          >
            {running ? 'Scraping…' : 'Run scrape'}
          </button>
        </div>
      }
    >
      <form id="scrape-leads-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error ? <StatusBanner type="error" message={error} /> : null}
        <p className="text-sm text-stone-600">
          Enter city and locality as text. Changing the city clears area and pincode so you can
          set the right place for that city.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>
              City
              <RequiredMark />
            </span>
            <input
              className={fieldClass}
              list="scrape-city-options"
              value={form.city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Bengaluru"
              autoComplete="address-level2"
              required
            />
            <datalist id="scrape-city-options">
              {SCRAPE_CITY_OPTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className={labelClass}>Area / locality</span>
            <input
              className={fieldClass}
              list={areaHints.length ? areaListId : undefined}
              value={form.area}
              onChange={(e) => setForm((prev) => ({ ...prev, area: e.target.value }))}
              placeholder={
                form.city.trim()
                  ? `e.g. locality in ${form.city.trim()}`
                  : 'e.g. Whitefield, Gokulam'
              }
              autoComplete="address-level3"
            />
            {areaHints.length ? (
              <datalist id={areaListId}>
                {areaHints.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            ) : null}
            <span className="mt-1 block text-xs text-stone-500">
              Free text for any city. Optional city hints appear when available; a places API can
              replace this later.
            </span>
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>What to find</span>
            <input
              className={fieldClass}
              value={form.query}
              onChange={(e) => setForm((prev) => ({ ...prev, query: e.target.value }))}
              placeholder="senior care homes, day care, assisted living"
            />
            <span className="mt-1 block text-xs text-stone-500">
              Optional keywords. Generic terms like “senior care” keep the full list.
            </span>
          </label>
          <label className="block">
            <span className={labelClass}>Pincode</span>
            <input
              className={fieldClass}
              inputMode="numeric"
              maxLength={6}
              value={form.pincode}
              onChange={(e) => setForm((prev) => ({ ...prev, pincode: e.target.value }))}
              placeholder="560076"
              autoComplete="postal-code"
            />
          </label>
        </div>
      </form>
    </Modal>
  )
}

const EmailLeadModal = ({ lead, onClose, onSend }) => {
  const [to, setTo] = useState(() => defaultToEmails(lead).join(', '))
  const [subject, setSubject] = useState(() => buildEmailSubject(lead))
  const [body, setBody] = useState(() => buildEmailBody(lead))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const recipients = parseEmailList(to)
    if (!recipients.length) {
      setError('Add at least one email address.')
      return
    }
    const invalid = recipients.filter((email) => !isValidEmail(email))
    if (invalid.length) {
      setError(`Check these addresses: ${invalid.join(', ')}`)
      return
    }
    if (!subject.trim()) {
      setError('Add a subject line.')
      return
    }
    if (!body.trim()) {
      setError('Write a message before sending.')
      return
    }
    setPending(true)
    try {
      await onSend(lead, {
        subject: subject.trim(),
        body: body.trim(),
        to: recipients,
      })
    } catch {
      setError('Could not open email. Your draft is still here — try again.')
      setPending(false)
    }
  }

  return (
    <Modal
      open
      wide
      title={`Email ${lead.companyName || displayName(lead)}`}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button
            type="submit"
            form="email-lead-form"
            className={btnPrimary}
            disabled={pending || !to.trim()}
          >
            {pending ? 'Opening…' : 'Send email'}
          </button>
        </div>
      }
    >
      <form id="email-lead-form" onSubmit={handleSubmit} className="space-y-3" noValidate>
        {error ? <StatusBanner type="error" message={error} /> : null}
        <p className="text-sm text-stone-600">
          Opens your mail app with this draft. After you send, the lead moves to{' '}
          <span className="font-medium text-ink">In progress</span>.
        </p>
        <label className="block">
          <span className={labelClass}>To</span>
          <input
            className={fieldClass}
            type="text"
            inputMode="email"
            autoComplete="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="name@company.com, other@company.com"
            aria-describedby="email-to-hint"
          />
          <span id="email-to-hint" className="mt-1 block text-xs text-stone-500">
            Edit freely. Separate multiple addresses with commas.
          </span>
        </label>
        <label className="block">
          <span className={labelClass}>Subject</span>
          <input
            className={fieldClass}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Message</span>
          <textarea
            className={`${fieldClass} min-h-[220px] text-sm`}
            rows={12}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
      </form>
    </Modal>
  )
}

const HISTORY_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'email_sent', label: 'Sent' },
  { key: 'email_received', label: 'Received' },
  { key: 'meeting', label: 'Meetings' },
  { key: 'pipeline', label: 'Pipeline' },
]

const FieldError = ({ id, message }) =>
  message ? (
    <p id={id} className="mt-1 text-xs text-rose-700" role="alert">
      {message}
    </p>
  ) : null

const DetailField = ({ label, children }) => (
  <div className="min-w-0">
    <p className="text-xs font-medium text-stone-500">{label}</p>
    <div className="mt-0.5 text-sm text-ink [overflow-wrap:anywhere]">{children || '—'}</div>
  </div>
)

const historyIcon = (type) => {
  if (type === 'email_sent') return FiMail
  if (type === 'email_received') return FiInbox
  if (type === 'meeting') return FiCalendar
  if (type === 'pipeline') return FiCheckCircle
  return FiClock
}

const HistoryTimelineItem = ({ item, isLast }) => {
  const [expanded, setExpanded] = useState(false)
  const Icon = historyIcon(item.type)
  const body = item.payload?.body || ''
  const longBody = body.length > 280

  return (
    <li className="relative pb-5 pl-11 last:pb-0">
      <span className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600">
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      {!isLast ? (
        <span
          className="absolute bottom-0 left-[15px] top-8 w-px bg-stone-200"
          aria-hidden
        />
      ) : null}
      <div className="min-w-0 rounded-xl border border-stone-200 bg-white px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink text-balance">
              {item.title || HISTORY_LABEL[item.type] || item.type}
            </p>
            <p className="mt-0.5 text-xs text-stone-500">{fmtDateTime(item.at)}</p>
          </div>
          <span className="shrink-0 whitespace-nowrap rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
            {HISTORY_LABEL[item.type] || item.type}
          </span>
        </div>
        {item.summary ? <p className="mt-2 text-sm text-stone-700">{item.summary}</p> : null}
        {item.payload?.to ? (
          <p className="mt-1 text-xs text-stone-500 [overflow-wrap:anywhere]">
            To: {item.payload.to}
          </p>
        ) : null}
        {item.payload?.from ? (
          <p className="mt-1 text-xs text-stone-500 [overflow-wrap:anywhere]">
            From: {item.payload.from}
          </p>
        ) : null}
        {body ? (
          <div className="mt-2">
            <p
              className={`whitespace-pre-wrap rounded-lg bg-stone-50 p-3 text-xs leading-relaxed text-stone-700 [overflow-wrap:anywhere] ${
                expanded || !longBody ? '' : 'line-clamp-4'
              }`}
            >
              {body}
            </p>
            {longBody ? (
              <button
                type="button"
                className={`${btnGhost} mt-2 min-h-10`}
                aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? 'Show less' : 'Show full message'}
              </button>
            ) : null}
          </div>
        ) : null}
        {item.payload?.meetingLink ? (
          <a
            href={item.payload.meetingLink}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex min-h-10 max-w-full items-center gap-1 text-sm text-brand-800 underline-offset-2 [overflow-wrap:anywhere] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
          >
            <span className="min-w-0">{item.payload.meetingLink}</span>
            <FiExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </a>
        ) : null}
        {item.payload?.startsAt ? (
          <p className="mt-1 text-xs text-stone-500">
            Starts {fmtDateTime(item.payload.startsAt)}
            {item.payload.durationMins ? ` (${item.payload.durationMins} min)` : ''}
          </p>
        ) : null}
      </div>
    </li>
  )
}

const LeadDetailModal = ({
  lead,
  canWrite,
  onClose,
  onEmail,
  onLogReply,
  onCreateMeeting,
  onMovePipeline,
}) => {
  const emailBtnRef = useRef(null)
  const [tab, setTab] = useState('overview')
  const [panel, setPanel] = useState(null)
  const [historyFilter, setHistoryFilter] = useState('all')
  const [replyForm, setReplyForm] = useState({
    from: lead.primaryEmailId || '',
    subject: '',
    body: '',
    receivedAt: toLocalInputValue(new Date().toISOString()),
  })
  const [meetingForm, setMeetingForm] = useState({
    title: `Demo with ${lead.companyName || displayName(lead)}`,
    startsAt: toLocalInputValue(new Date(Date.now() + 86400000).toISOString()),
    durationMins: '30',
    meetingLink: `https://meet.google.com/${buildMeetCode()}`,
    notes: '',
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => emailBtnRef.current?.focus(), 40)
    return () => window.clearTimeout(t)
  }, [])

  const history = useMemo(
    () => [...(lead.history || [])].sort((a, b) => new Date(b.at) - new Date(a.at)),
    [lead.history],
  )

  const filteredHistory = useMemo(
    () =>
      historyFilter === 'all' ? history : history.filter((h) => h.type === historyFilter),
    [history, historyFilter],
  )

  const counts = useMemo(() => {
    const base = { all: history.length, email_sent: 0, email_received: 0, meeting: 0, pipeline: 0 }
    history.forEach((h) => {
      if (base[h.type] != null) base[h.type] += 1
    })
    return base
  }, [history])

  const websiteHref = lead.website
    ? lead.website.startsWith('http')
      ? lead.website
      : `https://${lead.website}`
    : ''

  const openPanel = (next) => {
    setFormError('')
    setFieldErrors({})
    setPanel((prev) => (prev === next ? null : next))
    if (next) setTab('activity')
  }

  const submitReply = async (e) => {
    e.preventDefault()
    setFormError('')
    const errors = {}
    if (!replyForm.from.trim() || !isValidEmail(replyForm.from.trim())) {
      errors.from = 'Enter a valid email address.'
    }
    if (!replyForm.subject.trim()) errors.subject = 'Add a subject.'
    if (!replyForm.body.trim()) errors.body = 'Paste or type the message they sent.'
    setFieldErrors(errors)
    if (Object.keys(errors).length) return

    setPending(true)
    try {
      await onLogReply(lead, {
        from: replyForm.from.trim(),
        subject: replyForm.subject.trim(),
        body: replyForm.body.trim(),
        receivedAt: replyForm.receivedAt
          ? new Date(replyForm.receivedAt).toISOString()
          : new Date().toISOString(),
      })
      setPanel(null)
      setTab('activity')
      setHistoryFilter('email_received')
      setReplyForm({
        from: lead.primaryEmailId || '',
        subject: '',
        body: '',
        receivedAt: toLocalInputValue(new Date().toISOString()),
      })
    } catch {
      setFormError('Could not save the reply. Try again.')
    } finally {
      setPending(false)
    }
  }

  const submitMeeting = async (e) => {
    e.preventDefault()
    setFormError('')
    const errors = {}
    if (!meetingForm.title.trim()) errors.title = 'Add a meeting title.'
    if (!meetingForm.startsAt) errors.startsAt = 'Pick a start time.'
    if (!meetingForm.meetingLink.trim()) errors.meetingLink = 'Add a meeting link.'
    setFieldErrors(errors)
    if (Object.keys(errors).length) return

    setPending(true)
    try {
      await onCreateMeeting(lead, {
        title: meetingForm.title.trim(),
        startsAt: new Date(meetingForm.startsAt).toISOString(),
        durationMins: Number(meetingForm.durationMins) || 30,
        meetingLink: meetingForm.meetingLink.trim(),
        notes: meetingForm.notes.trim(),
      })
      setPanel(null)
      setTab('activity')
      setHistoryFilter('meeting')
    } catch {
      setFormError('Could not save the meeting. Try again.')
    } finally {
      setPending(false)
    }
  }

  const openCalendar = () => {
    const dates = toGoogleCalendarDates(
      meetingForm.startsAt,
      Number(meetingForm.durationMins) || 30,
    )
    if (!dates) return
    const details = [
      meetingForm.notes.trim(),
      meetingForm.meetingLink.trim() ? `Join: ${meetingForm.meetingLink.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')
    const guests = defaultToEmails(lead).join(',')
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(meetingForm.title.trim())}&dates=${dates}&details=${encodeURIComponent(details)}${guests ? `&add=${encodeURIComponent(guests)}` : ''}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <Modal
      open
      xl
      title={lead.companyName || displayName(lead)}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={`${btnSecondary} min-h-11`} onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-stone-500">Lead summary</p>
              <p className="mt-1 text-base font-semibold text-ink text-balance">
                {lead.companyName || displayName(lead)}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {displayName(lead)}
                {lead.primaryContactNumber ? (
                  <span className="tabular-nums text-stone-500">
                    {' '}
                    {lead.primaryContactNumber}
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-sm text-stone-600 [overflow-wrap:anywhere]">
                {lead.primaryEmailId || 'No primary email'}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="whitespace-nowrap rounded-md bg-white px-2 py-1 text-xs font-medium tabular-nums text-stone-600 ring-1 ring-stone-200">
                {lead.leadId}
              </span>
              <span
                className={`whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ${statusChip(lead.status)}`}
              >
                {lead.status}
              </span>
              <span className="whitespace-nowrap rounded-md bg-white px-2 py-1 text-xs font-medium text-stone-700 ring-1 ring-stone-200">
                {leadTypeLabel(lead.leadType)}
              </span>
              <span className="whitespace-nowrap rounded-md bg-white px-2 py-1 text-xs font-medium text-stone-700 ring-1 ring-stone-200">
                {pipelineLabel(lead.pipelineStatus)}
              </span>
            </div>
          </div>

          {canWrite !== false ? (
            <div className="mt-4 flex max-w-sm flex-col gap-1.5">
              <label htmlFor="lead-pipeline-select" className={labelClass}>
                Pipeline stage
              </label>
              <select
                id="lead-pipeline-select"
                className={fieldClass}
                value={lead.pipelineStatus}
                onChange={(e) => onMovePipeline(lead.leadId, e.target.value)}
              >
                {PIPELINE_STATUSES.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        {canWrite !== false ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Lead actions">
            <button
              ref={emailBtnRef}
              type="button"
              className={`${btnPrimary} min-h-11`}
              onClick={() => onEmail(lead)}
            >
              <FiMail className="h-4 w-4 shrink-0" aria-hidden />
              Email
            </button>
            <button
              type="button"
              className={`${btnSecondary} min-h-11`}
              aria-pressed={panel === 'reply'}
              onClick={() => openPanel('reply')}
            >
              <FiInbox className="h-4 w-4 shrink-0" aria-hidden />
              Log reply
            </button>
            <button
              type="button"
              className={`${btnSecondary} min-h-11`}
              aria-pressed={panel === 'meeting'}
              onClick={() => openPanel('meeting')}
            >
              <FiCalendar className="h-4 w-4 shrink-0" aria-hidden />
              Create meeting
            </button>
          </div>
        ) : null}

        {panel === 'reply' ? (
          <form
            onSubmit={submitReply}
            className="space-y-3 rounded-xl border border-stone-200 bg-white p-4"
            noValidate
            aria-labelledby="log-reply-heading"
          >
            <p id="log-reply-heading" className="text-sm font-semibold text-ink">
              Log email received
            </p>
            <p className="text-xs text-stone-500">
              Paste a reply you got from this lead. Fields marked * are required.
            </p>
            {formError ? <StatusBanner type="error" message={formError} /> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>
                  From
                  <RequiredMark />
                </span>
                <input
                  className={fieldClass}
                  type="email"
                  autoComplete="email"
                  value={replyForm.from}
                  aria-invalid={Boolean(fieldErrors.from)}
                  aria-describedby={fieldErrors.from ? 'reply-from-error' : undefined}
                  onBlur={() => {
                    if (!replyForm.from.trim() || !isValidEmail(replyForm.from.trim())) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        from: 'Enter a valid email address.',
                      }))
                    } else {
                      setFieldErrors((prev) => ({ ...prev, from: '' }))
                    }
                  }}
                  onChange={(e) => setReplyForm((f) => ({ ...f, from: e.target.value }))}
                />
                <FieldError id="reply-from-error" message={fieldErrors.from} />
              </label>
              <label className="block">
                <span className={labelClass}>Received at</span>
                <input
                  className={fieldClass}
                  type="datetime-local"
                  value={replyForm.receivedAt}
                  onChange={(e) => setReplyForm((f) => ({ ...f, receivedAt: e.target.value }))}
                />
              </label>
            </div>
            <label className="block">
              <span className={labelClass}>
                Subject
                <RequiredMark />
              </span>
              <input
                className={fieldClass}
                value={replyForm.subject}
                aria-invalid={Boolean(fieldErrors.subject)}
                aria-describedby={fieldErrors.subject ? 'reply-subject-error' : undefined}
                onChange={(e) => setReplyForm((f) => ({ ...f, subject: e.target.value }))}
              />
              <FieldError id="reply-subject-error" message={fieldErrors.subject} />
            </label>
            <label className="block">
              <span className={labelClass}>
                Message
                <RequiredMark />
              </span>
              <textarea
                className={`${fieldClass} min-h-[120px]`}
                rows={5}
                value={replyForm.body}
                aria-invalid={Boolean(fieldErrors.body)}
                aria-describedby={fieldErrors.body ? 'reply-body-error' : undefined}
                onChange={(e) => setReplyForm((f) => ({ ...f, body: e.target.value }))}
              />
              <FieldError id="reply-body-error" message={fieldErrors.body} />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={`${btnGhost} min-h-11`}
                onClick={() => setPanel(null)}
                disabled={pending}
              >
                Cancel
              </button>
              <button type="submit" className={`${btnPrimary} min-h-11`} disabled={pending}>
                {pending ? 'Saving…' : 'Save reply'}
              </button>
            </div>
          </form>
        ) : null}

        {panel === 'meeting' ? (
          <form
            onSubmit={submitMeeting}
            className="space-y-3 rounded-xl border border-stone-200 bg-white p-4"
            noValidate
            aria-labelledby="meeting-heading"
          >
            <p id="meeting-heading" className="text-sm font-semibold text-ink">
              Create meeting link
            </p>
            <p className="text-xs text-stone-500">
              Generate a link, optionally open Google Calendar, then save it to history.
            </p>
            {formError ? <StatusBanner type="error" message={formError} /> : null}
            <label className="block">
              <span className={labelClass}>
                Title
                <RequiredMark />
              </span>
              <input
                className={fieldClass}
                value={meetingForm.title}
                aria-invalid={Boolean(fieldErrors.title)}
                aria-describedby={fieldErrors.title ? 'meeting-title-error' : undefined}
                onChange={(e) => setMeetingForm((f) => ({ ...f, title: e.target.value }))}
              />
              <FieldError id="meeting-title-error" message={fieldErrors.title} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>
                  Starts
                  <RequiredMark />
                </span>
                <input
                  className={fieldClass}
                  type="datetime-local"
                  value={meetingForm.startsAt}
                  aria-invalid={Boolean(fieldErrors.startsAt)}
                  aria-describedby={fieldErrors.startsAt ? 'meeting-starts-error' : undefined}
                  onChange={(e) => setMeetingForm((f) => ({ ...f, startsAt: e.target.value }))}
                />
                <FieldError id="meeting-starts-error" message={fieldErrors.startsAt} />
              </label>
              <label className="block">
                <span className={labelClass}>Duration (minutes)</span>
                <select
                  className={fieldClass}
                  value={meetingForm.durationMins}
                  onChange={(e) =>
                    setMeetingForm((f) => ({ ...f, durationMins: e.target.value }))
                  }
                >
                  {['15', '30', '45', '60'].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className={labelClass}>
                Meeting link
                <RequiredMark />
              </span>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <input
                  className={`${fieldClass} min-w-0`}
                  type="url"
                  value={meetingForm.meetingLink}
                  aria-invalid={Boolean(fieldErrors.meetingLink)}
                  aria-describedby={
                    fieldErrors.meetingLink ? 'meeting-link-error' : 'meeting-link-hint'
                  }
                  onChange={(e) =>
                    setMeetingForm((f) => ({ ...f, meetingLink: e.target.value }))
                  }
                />
                <button
                  type="button"
                  className={`${btnGhost} min-h-11 shrink-0`}
                  onClick={() =>
                    setMeetingForm((f) => ({
                      ...f,
                      meetingLink: `https://meet.google.com/${buildMeetCode()}`,
                    }))
                  }
                >
                  New link
                </button>
              </div>
              <span id="meeting-link-hint" className="mt-1 block text-xs text-stone-500">
                Edit freely or generate a fresh Meet-style URL.
              </span>
              <FieldError id="meeting-link-error" message={fieldErrors.meetingLink} />
            </label>
            <label className="block">
              <span className={labelClass}>Notes</span>
              <textarea
                className={`${fieldClass} min-h-[72px]`}
                rows={2}
                value={meetingForm.notes}
                onChange={(e) => setMeetingForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={`${btnGhost} min-h-11`}
                onClick={openCalendar}
                disabled={pending}
              >
                <FiExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                Open calendar
              </button>
              <button
                type="button"
                className={`${btnGhost} min-h-11`}
                onClick={() => setPanel(null)}
                disabled={pending}
              >
                Cancel
              </button>
              <button type="submit" className={`${btnPrimary} min-h-11`} disabled={pending}>
                {pending ? 'Saving…' : 'Save meeting'}
              </button>
            </div>
          </form>
        ) : null}

        <div
          role="tablist"
          aria-label="Lead detail sections"
          className="flex gap-1 border-b border-stone-200"
        >
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'activity', label: `Activity (${history.length})` },
          ].map((t) => {
            const on = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                className={`min-h-11 border-b-2 px-3 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 ${
                  on
                    ? 'border-ink font-semibold text-ink'
                    : 'border-transparent font-medium text-stone-500 hover:text-stone-800'
                }`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {tab === 'overview' ? (
          <section className="space-y-4" aria-label="Lead overview">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label="Name">{displayName(lead)}</DetailField>
              <DetailField label="Company">{lead.companyName}</DetailField>
              <DetailField label="Primary contact">{lead.primaryContactName}</DetailField>
              <DetailField label="Primary number">
                <span className="tabular-nums">{lead.primaryContactNumber || '—'}</span>
              </DetailField>
              <DetailField label="Alternate contact">{lead.alternateContactName}</DetailField>
              <DetailField label="Alternate number">
                <span className="tabular-nums">{lead.alternateContactNumber || '—'}</span>
              </DetailField>
              <DetailField label="Primary email">{lead.primaryEmailId}</DetailField>
              <DetailField label="Secondary email">{lead.secondaryEmailId}</DetailField>
              <DetailField label="Website">
                {websiteHref ? (
                  <a
                    href={websiteHref}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-800 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
                  >
                    {lead.website.replace(/^https?:\/\//, '')}
                  </a>
                ) : (
                  '—'
                )}
              </DetailField>
              <DetailField label="Address">{lead.address}</DetailField>
              <DetailField label="Identified">{fmtDate(lead.leadIdentifiedDate)}</DetailField>
              <DetailField label="Affiliate">{lead.affiliate}</DetailField>
              <DetailField label="Onboarding">
                <span
                  className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${onboardChip(lead.onboardingStatus)}`}
                >
                  {lead.onboardingStatus}
                </span>
              </DetailField>
            </div>
          </section>
        ) : (
          <section className="space-y-4" aria-label="Lead activity">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter activity">
              {HISTORY_FILTERS.map((f) => {
                const on = historyFilter === f.key
                const count = counts[f.key] ?? 0
                return (
                  <button
                    key={f.key}
                    type="button"
                    aria-pressed={on}
                    className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 ${
                      on
                        ? 'bg-ink text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                    onClick={() => setHistoryFilter(f.key)}
                  >
                    <span className="whitespace-nowrap">{f.label}</span>
                    <span
                      className={`tabular-nums ${on ? 'text-white/80' : 'text-stone-500'}`}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            {filteredHistory.length === 0 ? (
              <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-8 text-center">
                <p className="text-sm font-medium text-ink">
                  {history.length === 0 ? 'No activity yet' : 'No items in this filter'}
                </p>
                <p className="mt-1 text-sm text-stone-600">
                  {history.length === 0
                    ? 'Send an email, log a reply, or create a meeting to start the timeline.'
                    : 'Try another filter or clear back to All.'}
                </p>
                {canWrite !== false && history.length === 0 ? (
                  <button
                    type="button"
                    className={`${btnPrimary} mt-4 min-h-11`}
                    onClick={() => onEmail(lead)}
                  >
                    <FiMail className="h-4 w-4 shrink-0" aria-hidden />
                    Email this lead
                  </button>
                ) : null}
              </div>
            ) : (
              <ol className="m-0 list-none p-0">
                {filteredHistory.map((item, index) => (
                  <HistoryTimelineItem
                    key={item.id}
                    item={item}
                    isLast={index === filteredHistory.length - 1}
                  />
                ))}
              </ol>
            )}
          </section>
        )}
      </div>
    </Modal>
  )
}

const SEED_LEADS = [
  makeLead(
    {
      leadId: 'LD-1001',
      salutation: 'Ms',
      firstName: 'Anitha',
      lastName: 'Reddy',
      companyName: 'Serene Years Elder Care',
      primaryContactName: 'Anitha Reddy',
      primaryContactNumber: '+91 80 4125 3380',
      alternateContactName: 'Ramesh Reddy',
      alternateContactNumber: '+91 98765 43210',
      primaryEmailId: 'hello@sereneyears.in',
      secondaryEmailId: 'anitha.reddy@gmail.com',
      address: 'Indiranagar, Bengaluru 560038',
      website: 'www.sereneyears.in',
      leadIdentifiedDate: '2026-11-06T06:00:00+05:30',
      status: 'Open',
      leadType: 'direct',
      affiliate: '',
      onboardingStatus: 'No',
      pipelineStatus: 'in_progress',
    },
    1,
  ),
  makeLead(
    {
      leadId: 'LD-1002',
      salutation: 'Mr',
      firstName: 'Vikram',
      lastName: 'Shah',
      companyName: 'Golden Hearth Homes',
      primaryContactName: 'Vikram Shah',
      primaryContactNumber: '+91 80 2845 1192',
      primaryEmailId: 'contact@goldenhearthhomes.com',
      address: 'Whitefield, Bengaluru 560066',
      website: 'www.goldenhearthhomes.com',
      leadIdentifiedDate: '2026-11-05T09:00:00+05:30',
      status: 'Open',
      leadType: 'partner',
      affiliate: 'CarePlus Network',
      onboardingStatus: 'No',
      pipelineStatus: 'quote_provided',
    },
    2,
  ),
  makeLead(
    {
      leadId: 'LD-1003',
      salutation: 'Dr',
      firstName: 'Sneha',
      middleName: 'K',
      lastName: 'Pillai',
      companyName: 'Sukhi Elder Physiotherapy',
      primaryContactName: 'Sneha K Pillai',
      primaryContactNumber: '+91 80 2663 5488',
      primaryEmailId: 'appointments@sukhiphysio.com',
      address: 'Jayanagar, Bengaluru 560041',
      website: 'www.sukhiphysio.com',
      leadIdentifiedDate: '2026-11-04T11:30:00+05:30',
      status: 'Open',
      leadType: 'self_generated',
      affiliate: '',
      onboardingStatus: 'Yes',
      pipelineStatus: 'demo_completed',
    },
    3,
  ),
  makeLead(
    {
      leadId: 'LD-1004',
      salutation: 'Mr',
      firstName: 'Arjun',
      lastName: 'Mehta',
      companyName: 'Nirmala Care Home',
      primaryContactName: 'Arjun Mehta',
      primaryContactNumber: '+91 80 2334 9207',
      primaryEmailId: 'nirmala@nirmalacarehome.in',
      address: 'Malleshwaram, Bengaluru 560003',
      website: 'www.nirmalacarehome.in',
      leadIdentifiedDate: '2026-11-03T14:00:00+05:30',
      status: 'Open',
      leadType: 'exhibition',
      affiliate: 'Senior Care Expo 2026',
      onboardingStatus: 'No',
      pipelineStatus: 'waiting_po',
    },
    4,
  ),
  makeLead(
    {
      leadId: 'LD-1005',
      salutation: 'Mrs',
      firstName: 'Kavitha',
      lastName: 'Rao',
      companyName: 'Shanti Senior Services',
      primaryContactName: 'Kavitha Rao',
      primaryContactNumber: '+91 80 2856 4033',
      primaryEmailId: 'team@shantiseniorservices.in',
      address: 'Yelahanka, Bengaluru 560064',
      website: 'www.shantiseniorservices.in',
      leadIdentifiedDate: '2026-11-02T10:00:00+05:30',
      status: 'On Hold',
      leadType: 'direct',
      affiliate: '',
      onboardingStatus: 'No',
      pipelineStatus: 'yet_to_start',
    },
    5,
  ),
  makeLead(
    {
      ...BENGALURU_SENIOR_CARE_LEADS[0],
      leadId: 'LD-1006',
      leadIdentifiedDate: '2026-11-06T07:00:00+05:30',
      status: 'Open',
      leadType: 'potential',
      affiliate: '',
      onboardingStatus: 'No',
      pipelineStatus: 'yet_to_start',
    },
    6,
  ),
  makeLead(
    {
      ...BENGALURU_SENIOR_CARE_LEADS[1],
      leadId: 'LD-1007',
      leadIdentifiedDate: '2026-11-06T07:15:00+05:30',
      status: 'Open',
      leadType: 'potential',
      affiliate: '',
      onboardingStatus: 'No',
      pipelineStatus: 'yet_to_start',
    },
    7,
  ),
  makeLead(
    {
      leadId: 'LD-1008',
      salutation: 'Ms',
      firstName: 'Deepa',
      lastName: 'Joshi',
      companyName: 'Anand Home Nursing',
      primaryContactName: 'Deepa Joshi',
      primaryContactNumber: '+91 80 2668 1154',
      primaryEmailId: 'anand@anandhomenursing.com',
      address: 'BTM Layout, Bengaluru 560076',
      website: 'www.anandhomenursing.com',
      leadIdentifiedDate: '2026-11-01T12:00:00+05:30',
      status: 'Closed',
      leadType: 'partner',
      affiliate: 'Vaishnavi Medicare',
      onboardingStatus: 'Yes',
      pipelineStatus: 'waiting_po',
    },
    8,
  ),
]

const normalizeStoredLead = (lead) => ({
  ...lead,
  history: historyFromLegacy(lead),
})

const loadStored = () => {
  try {
    const raw =
      localStorage.getItem(LEADS_STORAGE_KEY) ||
      localStorage.getItem('sc_platform_leads_v4')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed?.leads)) return null
    return {
      ...parsed,
      leads: parsed.leads.map(normalizeStoredLead),
    }
  } catch {
    return null
  }
}

const PipelineBoard = ({ leads, onMove, onEmail, onOpen, canWrite }) => {
  const columns = useMemo(
    () =>
      PIPELINE_STATUSES.map((col) => ({
        ...col,
        items: leads.filter((l) => l.pipelineStatus === col.key),
      })),
    [leads],
  )

  return (
    <section className="space-y-3" aria-labelledby="leads-pipeline-heading">
      <div className="min-w-0">
        <h2 id="leads-pipeline-heading" className="text-base font-semibold text-ink">
          Pipeline
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          All lead types share these stages. From Yet to Start, email the contact to move them to In
          progress.
        </p>
        <p className="mt-1 text-xs text-stone-500 tabular-nums">
          {leads.length} lead{leads.length === 1 ? '' : 's'} across the board
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-3">
          {columns.map((col) => (
            <div
              key={col.key}
              className="flex w-56 shrink-0 flex-col rounded-xl border border-stone-200 bg-stone-50"
            >
              <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                <h3 className="min-w-0 text-sm font-medium text-stone-800">{col.label}</h3>
                <span className="shrink-0 rounded-md bg-white px-2 py-0.5 text-xs font-medium tabular-nums text-stone-600">
                  {col.items.length}
                </span>
              </div>
              <ul className="max-h-72 space-y-2 overflow-y-auto border-t border-stone-200 px-2 py-2">
                {col.items.length === 0 ? (
                  <li className="rounded-lg bg-white px-3 py-6 text-center text-xs text-stone-400">
                    No leads here
                  </li>
                ) : (
                  col.items.map((lead) => {
                    const colIdx = PIPELINE_STATUSES.findIndex((p) => p.key === lead.pipelineStatus)
                    const next = PIPELINE_STATUSES[colIdx + 1]
                    const prev = PIPELINE_STATUSES[colIdx - 1]
                    const isYetToStart = lead.pipelineStatus === 'yet_to_start'
                    const hasEmail = Boolean(lead.primaryEmailId || lead.secondaryEmailId)
                    return (
                      <li key={lead.leadId}>
                        <div className="rounded-lg border border-stone-200 bg-white px-2.5 py-2">
                          <button
                            type="button"
                            className="flex w-full items-start gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
                            onClick={() => onOpen?.(lead)}
                          >
                            <span
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-stone-100 text-xs font-semibold text-stone-700"
                              aria-hidden
                            >
                              {initials(lead)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-ink">
                                {lead.companyName || displayName(lead)}
                              </p>
                              <p className="truncate text-xs text-stone-500">
                                <span className="tabular-nums">{lead.leadId}</span>
                                <span className="text-stone-400"> / </span>
                                {leadTypeLabel(lead.leadType)}
                              </p>
                            </div>
                          </button>
                          {canWrite !== false ? (
                            <div className="mt-2 flex flex-col gap-1.5">
                              {isYetToStart ? (
                                <button
                                  type="button"
                                  className={`${btnPrimary} w-full`}
                                  disabled={!hasEmail}
                                  onClick={() => onEmail?.(lead)}
                                  title={
                                    hasEmail ? 'Compose outreach email' : 'No email on this lead'
                                  }
                                >
                                  {hasEmail ? 'Email' : 'No email'}
                                </button>
                              ) : null}
                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  className={`${btnGhost} min-h-9 flex-1`}
                                  disabled={!prev}
                                  onClick={() => prev && onMove(lead.leadId, prev.key)}
                                  aria-label={`Move ${lead.companyName || displayName(lead)} to ${prev?.label || 'previous stage'}`}
                                >
                                  Back
                                </button>
                                <button
                                  type="button"
                                  className={`${btnGhost} min-h-9 flex-1`}
                                  disabled={!next}
                                  onClick={() => next && onMove(lead.leadId, next.key)}
                                  aria-label={`Move ${lead.companyName || displayName(lead)} to ${next?.label || 'next stage'}`}
                                >
                                  Advance
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </li>
                    )
                  })
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const LeadsPage = () => {
  const { isSuperAdmin, canWrite } = useAccess()
  const stored = useMemo(() => loadStored(), [])
  const [leads, setLeads] = useState(() => stored?.leads || SEED_LEADS)
  const [leadType, setLeadType] = useState('direct')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [onboardFilter, setOnboardFilter] = useState('All')
  const [scraping, setScraping] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [scrapeOpen, setScrapeOpen] = useState(false)
  const [emailFor, setEmailFor] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [loading] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [scrapeCursor, setScrapeCursor] = useState(() => stored?.scrapeCursor || 0)
  const [nextSeq, setNextSeq] = useState(() => stored?.nextSeq || SEED_LEADS.length + 1)
  const [scrapeForm, setScrapeForm] = useState(() => {
    const saved = stored?.scrapeForm || blankScrapeForm()
    const next = { ...blankScrapeForm(), ...saved }
    if (next.area === 'All areas' || next.area === 'Custom') next.area = next.customArea || ''
    delete next.customArea
    return next
  })

  const selectedLead = useMemo(
    () => leads.find((l) => l.leadId === selectedId) || null,
    [leads, selectedId],
  )

  const appendHistory = (leadId, entry, extra = {}) => {
    setLeads((prev) =>
      prev.map((l) =>
        l.leadId === leadId
          ? {
              ...l,
              ...extra,
              history: [entry, ...(Array.isArray(l.history) ? l.history : [])],
            }
          : l,
      ),
    )
  }

  const deferredQuery = useDeferredValue(query)
  const q = deferredQuery.trim().toLowerCase()

  const typeMeta = LEAD_TYPES.find((t) => t.key === leadType) || LEAD_TYPES[0]

  const counts = useMemo(
    () => Object.fromEntries(LEAD_TYPES.map((t) => [t.key, leads.filter((l) => l.leadType === t.key).length])),
    [leads],
  )

  const typeLeads = useMemo(
    () => leads.filter((l) => l.leadType === leadType),
    [leads, leadType],
  )

  const visible = useMemo(
    () =>
      typeLeads.filter((l) => {
        if (statusFilter !== 'All' && l.status !== statusFilter) return false
        if (onboardFilter !== 'All' && l.onboardingStatus !== onboardFilter) return false
        if (!q) return true
        const hay = [
          l.leadId,
          l.firstName,
          l.middleName,
          l.lastName,
          l.companyName,
          l.primaryContactName,
          l.primaryContactNumber,
          l.alternateContactName,
          l.alternateContactNumber,
          l.primaryEmailId,
          l.secondaryEmailId,
          l.address,
          l.website,
          l.affiliate,
          leadTypeLabel(l.leadType),
          pipelineLabel(l.pipelineStatus),
        ]
          .map((v) => String(v || '').toLowerCase())
          .join(' ')
        return hay.includes(q)
      }),
    [typeLeads, statusFilter, onboardFilter, q],
  )

  const filtering = Boolean(q) || statusFilter !== 'All' || onboardFilter !== 'All'

  useEffect(() => {
    try {
      localStorage.setItem(
        LEADS_STORAGE_KEY,
        JSON.stringify({ leads, scrapeCursor, nextSeq, scrapeForm }),
      )
    } catch {
      // ignore quota
    }
  }, [leads, scrapeCursor, nextSeq, scrapeForm])

  useEffect(() => {
    if (!status.message) return undefined
    const t = window.setTimeout(() => setStatus({ type: '', message: '' }), 4500)
    return () => window.clearTimeout(t)
  }, [status])

  const movePipeline = (leadId, pipelineStatus) => {
    const lead = leads.find((l) => l.leadId === leadId)
    if (!lead || lead.pipelineStatus === pipelineStatus) return
    const from = lead.pipelineStatus
    appendHistory(
      leadId,
      makeHistoryEntry(
        'pipeline',
        `Moved to ${pipelineLabel(pipelineStatus)}`,
        `From ${pipelineLabel(from)}`,
        { fromStatus: from, toStatus: pipelineStatus },
      ),
      { pipelineStatus },
    )
  }

  const sendLeadEmail = async (lead, message) => {
    const recipients = Array.isArray(message.to) ? message.to : parseEmailList(message.to)
    openMailto(recipients, message.subject, message.body)
    const sentAt = new Date().toISOString()
    const entry = makeHistoryEntry(
      'email_sent',
      message.subject || 'Email sent',
      `To ${recipients.join(', ')}`,
      {
        to: recipients.join(', '),
        subject: message.subject,
        body: message.body,
      },
      sentAt,
    )
    appendHistory(lead.leadId, entry, {
      pipelineStatus:
        lead.pipelineStatus === 'yet_to_start' ? 'in_progress' : lead.pipelineStatus,
      emailSentAt: sentAt,
      emailTo: recipients.join(', '),
      emailSubject: message.subject,
      emailBodyDraft: message.body,
    })
    setEmailFor(null)
    setStatus({
      type: 'success',
      message: `Email draft opened for ${lead.companyName || displayName(lead)}.`,
    })
  }

  const logLeadReply = async (lead, reply) => {
    const entry = makeHistoryEntry(
      'email_received',
      reply.subject || 'Email received',
      `From ${reply.from}`,
      {
        from: reply.from,
        subject: reply.subject,
        body: reply.body,
      },
      reply.receivedAt,
    )
    appendHistory(lead.leadId, entry)
    setStatus({
      type: 'success',
      message: `Saved reply from ${reply.from}.`,
    })
  }

  const createLeadMeeting = async (lead, meeting) => {
    const entry = makeHistoryEntry(
      'meeting',
      meeting.title,
      meeting.notes || meeting.meetingLink,
      {
        meetingLink: meeting.meetingLink,
        startsAt: meeting.startsAt,
        durationMins: meeting.durationMins,
        notes: meeting.notes,
      },
    )
    appendHistory(lead.leadId, entry)
    setStatus({
      type: 'success',
      message: `Meeting saved for ${lead.companyName || displayName(lead)}.`,
    })
  }

  const saveNewLead = async (form) => {
    await new Promise((r) => window.setTimeout(r, 280))
    const identified = form.leadIdentifiedDate
      ? new Date(`${form.leadIdentifiedDate}T12:00:00`).toISOString()
      : new Date().toISOString()
    const lead = makeLead(
      {
        ...form,
        leadIdentifiedDate: identified,
      },
      nextSeq,
    )
    setNextSeq((n) => n + 1)
    setLeads((prev) => [lead, ...prev])
    setLeadType(lead.leadType)
    setCreateOpen(false)
    setStatus({
      type: 'success',
      message: `Added ${lead.companyName || displayName(lead)} (${lead.leadId}).`,
    })
  }

  const scrapeNow = async (criteria) => {
    const form = { ...blankScrapeForm(), ...criteria }
    setScrapeForm(form)
    setScraping(true)
    setStatus({ type: '', message: '' })
    try {
      await new Promise((r) => window.setTimeout(r, 650))
      if (!isBengaluruCity(form.city)) {
        setStatus({
          type: 'info',
          message: `No public listings loaded for ${form.city.trim()} yet. Try Bengaluru.`,
        })
        setScrapeOpen(false)
        return
      }

      const existing = new Set(leads.map((l) => String(l.companyName || '').toLowerCase()))
      const matched = BENGALURU_SENIOR_CARE_LEADS.filter((raw) =>
        matchesScrapeCriteria(raw, form),
      )
      const areaTag = scrapeAreaLabel(form)
      const batch = []
      let cursor = scrapeCursor
      let seq = nextSeq

      if (!matched.length) {
        setStatus({
          type: 'info',
          message: `No listings matched ${areaTag || form.city}. Try All areas or another locality.`,
        })
        setScrapeOpen(false)
        return
      }

      for (let i = 0; i < matched.length && batch.length < SCRAPE_BATCH; i += 1) {
        const raw = matched[(cursor + i) % matched.length]
        if (existing.has(raw.companyName.toLowerCase())) continue
        existing.add(raw.companyName.toLowerCase())
        batch.push(
          makeLead(
            {
              ...raw,
              leadType: 'potential',
              status: 'Open',
              onboardingStatus: 'No',
              pipelineStatus: 'yet_to_start',
              affiliate: areaTag || form.query || 'Scrape',
              leadIdentifiedDate: new Date().toISOString(),
            },
            seq,
          ),
        )
        seq += 1
      }

      setScrapeCursor(matched.length ? (cursor + Math.max(batch.length, 1)) % matched.length : 0)
      setNextSeq(seq)
      setLeadType('potential')
      setScrapeOpen(false)

      if (!batch.length) {
        setStatus({
          type: 'info',
          message: `All matched listings for ${areaTag || form.city} are already in Potential Leads.`,
        })
        return
      }

      setLeads((prev) => [...batch, ...prev])
      setStatus({
        type: 'success',
        message: `Added ${batch.length} provider${batch.length === 1 ? '' : 's'} for ${areaTag || form.city}.`,
      })
    } catch {
      setStatus({ type: 'error', message: 'Could not run scrape. Try again.' })
    } finally {
      setScraping(false)
    }
  }

  if (!isSuperAdmin) {
    return (
      <TenantOpsPlaceholder
        title="Leads"
        description="Lead outreach for senior care providers will appear here when enabled for your organization."
      />
    )
  }

  return (
    <div className="sc-page-enter space-y-5">
      <PageHeader
        eyebrow=""
        title="Leads"
        description={`${typeMeta.hint} ${counts[leadType]} in this type, ${leads.length} total.`}
        actions={
          canWrite !== false ? (
            <div className="flex flex-wrap gap-2">
              {leadType === 'potential' ? (
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => setScrapeOpen(true)}
                  disabled={scraping}
                >
                  <FiRefreshCw
                    className={`h-4 w-4 ${scraping ? 'motion-safe:animate-spin' : ''}`}
                    aria-hidden
                  />
                  {scraping ? 'Scraping…' : 'Scrape now'}
                </button>
              ) : null}
              <button type="button" className={btnPrimary} onClick={() => setCreateOpen(true)}>
                <FiPlus className="h-4 w-4" aria-hidden />
                Add lead
              </button>
            </div>
          ) : null
        }
      />

      <StatusBanner type={status.type} message={status.message} />

      <div
        role="tablist"
        aria-label="Lead types"
        className="flex gap-1 overflow-x-auto border-b border-stone-200 pb-px"
      >
        {LEAD_TYPES.map((t) => {
          const on = leadType === t.key
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              title={t.hint}
              onClick={() => setLeadType(t.key)}
              className={`shrink-0 border-b-2 px-3 py-2.5 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 ${
                on
                  ? 'border-ink font-semibold text-ink'
                  : 'border-transparent font-medium text-stone-500 hover:text-stone-800'
              }`}
            >
              {t.label}
              <span className="ml-1.5 tabular-nums text-stone-400">{counts[t.key]}</span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="block min-w-0 flex-1 sm:min-w-[12rem]">
          <span className={labelClass}>Search</span>
          <input
            type="search"
            className={fieldClass}
            placeholder="ID, name, company, email, phone"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="block sm:w-40">
          <span className={labelClass}>Status</span>
          <select
            className={fieldClass}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:w-40">
          <span className={labelClass}>Onboarding</span>
          <select
            className={fieldClass}
            value={onboardFilter}
            onChange={(e) => setOnboardFilter(e.target.value)}
          >
            <option value="All">All</option>
            {ONBOARDING.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        {filtering ? (
          <button
            type="button"
            className={`${btnGhost} min-h-10 sm:mb-0.5`}
            onClick={() => {
              setQuery('')
              setStatusFilter('All')
              setOnboardFilter('All')
            }}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {loading ? (
        <LoadingState label="Loading leads…" />
      ) : visible.length === 0 ? (
        <EmptyState
          title={
            filtering
              ? 'No matching leads'
              : leadType === 'potential'
                ? 'No potential leads yet'
                : `No ${typeMeta.label.toLowerCase()}s yet`
          }
          hint={
            filtering
              ? 'Try another search or clear filters.'
              : leadType === 'potential'
                ? 'Set a city and area, then scrape public senior-care listings into Potential Leads.'
                : typeMeta.hint
          }
          actionLabel={
            !filtering && canWrite !== false
              ? leadType === 'potential' && !scraping
                ? 'Scrape now'
                : 'Add lead'
              : undefined
          }
          onAction={
            !filtering && canWrite !== false
              ? leadType === 'potential'
                ? () => setScrapeOpen(true)
                : () => setCreateOpen(true)
              : undefined
          }
        />
      ) : (
        <>
          <ul className="space-y-2 md:hidden">
            {visible.map((lead) => {
              const hasEmail = Boolean(lead.primaryEmailId || lead.secondaryEmailId)
              return (
                <li key={lead.leadId}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(lead.leadId)}
                    className="min-w-0 w-full rounded-xl border border-stone-200 bg-white p-4 text-left transition-colors duration-150 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">
                          {lead.companyName || displayName(lead)}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-stone-500">
                          <span className="tabular-nums">{lead.leadId}</span>
                          <span className="text-stone-400"> / </span>
                          {fmtDate(lead.leadIdentifiedDate)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${statusChip(lead.status)}`}
                      >
                        {lead.status}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-sm text-stone-700">
                      {lead.primaryContactName || displayName(lead)}
                      {lead.primaryContactNumber ? (
                        <span className="text-stone-500"> {lead.primaryContactNumber}</span>
                      ) : null}
                    </p>
                    <p className="mt-1 truncate text-xs text-stone-500">
                      {lead.primaryEmailId || 'No email'}
                      <span className="text-stone-400"> / </span>
                      {pipelineLabel(lead.pipelineStatus)}
                    </p>
                  </button>
                  {canWrite !== false && lead.pipelineStatus === 'yet_to_start' ? (
                    <button
                      type="button"
                      className={`${btnPrimary} mt-2 w-full`}
                      disabled={!hasEmail}
                      onClick={() => setEmailFor(lead)}
                    >
                      {hasEmail ? 'Email' : 'No email'}
                    </button>
                  ) : null}
                </li>
              )
            })}
          </ul>

          <div className={`${tableWrapClass} hidden md:block`}>
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-left text-sm">
                <thead className={leadsTheadClass}>
                  <tr>
                    <th className="px-3 py-3 font-medium">Lead ID</th>
                    <th className="px-3 py-3 font-medium">Name</th>
                    <th className="px-3 py-3 font-medium">Company</th>
                    <th className="px-3 py-3 font-medium">Primary contact</th>
                    <th className="px-3 py-3 font-medium">Alt. contact</th>
                    <th className="px-3 py-3 font-medium">Email</th>
                    <th className="px-3 py-3 font-medium">Address</th>
                    <th className="px-3 py-3 font-medium">Website</th>
                    <th className="px-3 py-3 font-medium">Identified</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Type</th>
                    <th className="px-3 py-3 font-medium">Affiliate</th>
                    <th className="px-3 py-3 font-medium">Onboarded</th>
                    <th className="px-3 py-3 font-medium">Pipeline</th>
                    <th className="px-3 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((lead) => (
                    <tr
                      key={lead.leadId}
                      className="cursor-pointer border-t border-stone-100 transition-colors duration-150 hover:bg-stone-50"
                      onClick={() => setSelectedId(lead.leadId)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedId(lead.leadId)
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open ${lead.companyName || displayName(lead)}`}
                    >
                      <td className="whitespace-nowrap px-3 py-3 font-medium tabular-nums text-ink">
                        {lead.leadId}
                      </td>
                      <td className="min-w-0 px-3 py-3 text-stone-800">
                        <div className="max-w-[10rem]">
                          <p className="truncate font-medium">{displayName(lead)}</p>
                          {(lead.firstName || lead.lastName) && lead.primaryContactName ? (
                            <p className="truncate text-xs text-stone-500">
                              {[lead.salutation, lead.firstName, lead.middleName, lead.lastName]
                                .filter(Boolean)
                                .join(' ')}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <p className="max-w-[11rem] truncate font-medium text-ink">
                          {lead.companyName || '—'}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-stone-700">
                        <p className="max-w-[9rem] truncate">{lead.primaryContactName || '—'}</p>
                        <p className="truncate text-xs tabular-nums text-stone-500">
                          {lead.primaryContactNumber || '—'}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-stone-700">
                        <p className="max-w-[9rem] truncate">{lead.alternateContactName || '—'}</p>
                        <p className="truncate text-xs tabular-nums text-stone-500">
                          {lead.alternateContactNumber || '—'}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-stone-700">
                        <p className="max-w-[12rem] truncate">{lead.primaryEmailId || '—'}</p>
                        {lead.secondaryEmailId ? (
                          <p className="max-w-[12rem] truncate text-xs text-stone-500">
                            {lead.secondaryEmailId}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <p className="max-w-[12rem] truncate text-stone-600">{lead.address || '—'}</p>
                      </td>
                      <td className="px-3 py-3">
                        {lead.website ? (
                          <a
                            href={
                              lead.website.startsWith('http')
                                ? lead.website
                                : `https://${lead.website}`
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block max-w-[9rem] truncate text-brand-800 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
                          >
                            {lead.website.replace(/^https?:\/\//, '')}
                          </a>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-stone-600">
                        {fmtDate(lead.leadIdentifiedDate)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${statusChip(lead.status)}`}
                        >
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-stone-600">
                        {leadTypeLabel(lead.leadType)}
                      </td>
                      <td className="px-3 py-3">
                        <p className="max-w-[8rem] truncate text-stone-600">
                          {lead.affiliate || '—'}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${onboardChip(lead.onboardingStatus)}`}
                        >
                          {lead.onboardingStatus}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-stone-600">
                        {pipelineLabel(lead.pipelineStatus)}
                      </td>
                      <td className="px-3 py-3">
                        {canWrite !== false && lead.pipelineStatus === 'yet_to_start' ? (
                          <button
                            type="button"
                            className={btnGhost}
                            disabled={!lead.primaryEmailId && !lead.secondaryEmailId}
                            onClick={(e) => {
                              e.stopPropagation()
                              setEmailFor(lead)
                            }}
                            title={
                              lead.primaryEmailId || lead.secondaryEmailId
                                ? 'Compose outreach email'
                                : 'No email on this lead'
                            }
                          >
                            Email
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={btnGhost}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedId(lead.leadId)
                            }}
                          >
                            Open
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <PipelineBoard
        leads={leads}
        onMove={movePipeline}
        onEmail={setEmailFor}
        onOpen={(lead) => setSelectedId(lead.leadId)}
        canWrite={canWrite}
      />

      {createOpen ? (
        <AddLeadModal
          initialType={leadType}
          onClose={() => setCreateOpen(false)}
          onSave={saveNewLead}
        />
      ) : null}

      {scrapeOpen ? (
        <ScrapeLeadsModal
          initial={scrapeForm}
          running={scraping}
          onClose={() => !scraping && setScrapeOpen(false)}
          onRun={scrapeNow}
        />
      ) : null}

      {selectedLead ? (
        <LeadDetailModal
          lead={selectedLead}
          canWrite={canWrite}
          onClose={() => setSelectedId(null)}
          onEmail={(lead) => setEmailFor(lead)}
          onLogReply={logLeadReply}
          onCreateMeeting={createLeadMeeting}
          onMovePipeline={movePipeline}
        />
      ) : null}

      {emailFor ? (
        <EmailLeadModal
          lead={emailFor}
          onClose={() => setEmailFor(null)}
          onSend={sendLeadEmail}
        />
      ) : null}
    </div>
  )
}

export default LeadsPage
