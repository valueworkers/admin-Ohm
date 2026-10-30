import { IN_STATES, stateFromGstin } from '../features/quotes/states'

const GSTIN_RE =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

/** GSTIN mod-36 checksum (chars 0–14 → check char at index 14). */
const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export const isValidGstinFormat = (value) => {
  const gstin = String(value || '').trim().toUpperCase()
  if (!GSTIN_RE.test(gstin)) return false
  let factor = 1
  let sum = 0
  for (let i = 0; i < 14; i += 1) {
    const codePoint = GSTIN_CHARS.indexOf(gstin[i])
    if (codePoint < 0) return false
    let digit = factor * codePoint
    factor = factor === 1 ? 2 : 1
    digit = Math.floor(digit / 36) + (digit % 36)
    sum += digit
  }
  const check = (36 - (sum % 36)) % 36
  return GSTIN_CHARS[check] === gstin[14]
}

const joinAddressParts = (parts = []) =>
  parts
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .join(', ')

const resolveStateCode = (raw, gstin = '') => {
  const fromGst = stateFromGstin(gstin)
  if (fromGst) return fromGst.code
  const text = String(raw || '').trim()
  if (/^\d{2}$/.test(text)) return text
  const byName = IN_STATES.find((s) => s.name.toLowerCase() === text.toLowerCase())
  return byName?.code || ''
}

const cleanName = (value) => {
  const text = String(value || '').trim()
  if (!text) return ''
  if (/^(na|n\/a|null|undefined|-)$/i.test(text)) return ''
  return text
}

const firstPromoterName = (row = {}) => {
  const lists = [
    row.mbr,
    row.promoters,
    row.directors,
    row.owner_name,
    row.ownerName,
    row.proprietor,
    row.propname,
  ]
  for (const item of lists) {
    if (Array.isArray(item)) {
      for (const entry of item) {
        const name = cleanName(
          typeof entry === 'string' ? entry : entry?.name || entry?.n || entry?.nm,
        )
        if (name) return name
      }
    } else {
      const name = cleanName(item)
      if (name) return name
    }
  }
  return ''
}

export const normalizeGstinLookup = (row = {}, gstin = '') => {
  const value = String(gstin || row.gstin || '').trim().toUpperCase()
  const legalName = cleanName(row.legal_name || row.lgnm)
  const tradeName = cleanName(row.trade_name || row.tradeNam)
  // Prefer trade name for Customer; legal name is shown separately on the quote.
  const customer =
    tradeName ||
    legalName ||
    cleanName(row.business_name || row.company_name || row.name)

  const constitution = cleanName(row.ctb || row.constitution || '')
  const ownerName = firstPromoterName(row)

  let address = ''
  if (typeof row.address === 'string') address = row.address.trim()
  else if (row.pradr?.adr) address = String(row.pradr.adr).trim()
  else if (row.pradr?.addr) {
    const a = row.pradr.addr
    address = joinAddressParts([
      a.bno,
      a.bnm,
      a.flno,
      a.st,
      a.loc,
      a.dst,
      a.city,
      a.stcd,
      a.pncd,
    ])
  } else if (row.pincode || row.city) {
    address = joinAddressParts([row.address, row.city, row.pincode])
  }

  return {
    gstin: value,
    company: String(customer || legalName || '').trim(),
    legalName: String(legalName || '').trim(),
    tradeName,
    ownerName,
    constitution,
    address,
    stateCode: resolveStateCode(
      row.state_code || row.stateCode || row.state || row.pradr?.addr?.stcd,
      value,
    ),
    status: row.status || row.sts || '',
    partial: false,
  }
}

/**
 * Providers:
 * - `portal` (default) — free GST portal captcha flow via /api/gst/*
 * - `gstinapi` — paid gstinapi.in key
 * - `sandbox` — Sandbox.co.in
 * - `none` — state digits only
 */
const provider = () =>
  String(import.meta.env.VITE_GSTIN_PROVIDER || 'portal')
    .trim()
    .toLowerCase()

const apiKey = () => String(import.meta.env.VITE_GSTIN_API_KEY || '').trim()

const offlinePartial = (gstin) => {
  const st = stateFromGstin(gstin)
  return {
    gstin,
    company: '',
    legalName: '',
    address: '',
    stateCode: st?.code || '',
    status: '',
    partial: true,
  }
}

const portalUnavailableMessage =
  'GST portal API is not available on this host. Deploy the /api/gst serverless route (Vercel) or run via Vite middleware.'

const parsePortalJson = async (res) => {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    if (res.ok === false || text.trimStart().startsWith('<')) {
      const err = new Error(portalUnavailableMessage)
      err.code = 'GSTIN_PORTAL_UNAVAILABLE'
      throw err
    }
    throw new Error('GST portal returned an unexpected response.')
  }
}

/** Free portal captcha — Vite middleware (dev) or `/api/gst` on Vercel (prod). */
export const fetchGstCaptcha = async () => {
  let res
  try {
    res = await fetch('/api/gst/captcha', { headers: { Accept: 'application/json' } })
  } catch {
    const err = new Error(portalUnavailableMessage)
    err.code = 'GSTIN_PORTAL_UNAVAILABLE'
    throw err
  }
  const data = await parsePortalJson(res)
  if (!res.ok) {
    throw new Error(data?.message || `Could not load GST captcha (${res.status}).`)
  }
  const image = String(data?.captcha_image || '').trim()
  const cookie = String(data?.captcha_cookie || '').trim()
  if (!image || !cookie) {
    throw new Error('GST captcha response was incomplete.')
  }
  return { captchaImage: image, captchaCookie: cookie }
}

const lookupViaPortal = async (gstin, { captcha, captchaCookie } = {}) => {
  if (!String(captcha || '').trim() || !String(captchaCookie || '').trim()) {
    const err = new Error('Enter the captcha from the GST portal image.')
    err.code = 'GSTIN_CAPTCHA_REQUIRED'
    throw err
  }
  let res
  try {
    res = await fetch('/api/gst/details', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        gstin,
        captcha: String(captcha).trim(),
        captcha_cookie: String(captchaCookie).trim(),
      }),
    })
  } catch {
    const err = new Error(portalUnavailableMessage)
    err.code = 'GSTIN_PORTAL_UNAVAILABLE'
    throw err
  }
  const data = await parsePortalJson(res)
  if (!res.ok) {
    const err = new Error(data?.message || `GSTIN lookup failed (${res.status}).`)
    err.code = data?.code || 'GSTIN_PORTAL_ERROR'
    throw err
  }
  return normalizeGstinLookup(data, gstin)
}

/** gstinapi.in — GET /v1/gstin/:gstin (x-api-key). */
const lookupViaGstinApi = async (gstin) => {
  const key = apiKey()
  if (!key) {
    const err = new Error(
      'Set VITE_GSTIN_API_KEY (gstinapi.in) to look up company details.',
    )
    err.code = 'GSTIN_KEY_MISSING'
    throw err
  }
  const res = await fetch(`https://www.gstinapi.in/v1/gstin/${gstin}`, {
    headers: {
      Accept: 'application/json',
      'x-api-key': key,
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      data?.error ||
      data?.message ||
      data?.detail ||
      `GSTIN lookup failed (${res.status}).`
    throw new Error(msg)
  }
  const row = data?.data || data
  return normalizeGstinLookup(row, gstin)
}

/**
 * Sandbox.co.in GST public search.
 * Needs VITE_GSTIN_API_KEY + VITE_GSTIN_API_SECRET.
 */
const lookupViaSandbox = async (gstin) => {
  const key = apiKey()
  const secret = String(import.meta.env.VITE_GSTIN_API_SECRET || '').trim()
  if (!key || !secret) {
    const err = new Error(
      'Set VITE_GSTIN_API_KEY and VITE_GSTIN_API_SECRET for Sandbox GST lookup.',
    )
    err.code = 'GSTIN_KEY_MISSING'
    throw err
  }

  const authRes = await fetch('https://api.sandbox.co.in/authenticate', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'x-api-secret': secret,
      Accept: 'application/json',
    },
  })
  const authData = await authRes.json().catch(() => ({}))
  if (!authRes.ok) {
    throw new Error(authData?.message || 'Sandbox authentication failed.')
  }
  const token = authData?.access_token || authData?.data?.access_token || authData?.authorization
  if (!token) throw new Error('Sandbox did not return an access token.')

  const res = await fetch('https://api.sandbox.co.in/gst/compliance/public/gstin/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-api-key': key,
      authorization: token,
    },
    body: JSON.stringify({ gstin }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Sandbox GST lookup failed (${res.status}).`)
  }
  const row = data?.data?.data || data?.data || data
  return normalizeGstinLookup(row, gstin)
}

/**
 * Look up taxpayer details for a GSTIN.
 * Portal mode needs `{ captcha, captchaCookie }` from `fetchGstCaptcha()`.
 */
export const lookupGstin = async (gstin, opts = {}) => {
  const value = String(gstin || '').trim().toUpperCase()
  if (!isValidGstinFormat(value)) {
    throw new Error('Enter a valid 15-character GSTIN.')
  }

  const mode = provider()
  if (mode === 'none') return offlinePartial(value)

  try {
    if (mode === 'portal') return await lookupViaPortal(value, opts)
    if (mode === 'sandbox') return await lookupViaSandbox(value)
    if (mode === 'gstinapi') return await lookupViaGstinApi(value)
    return await lookupViaPortal(value, opts)
  } catch (err) {
    if (err?.code === 'GSTIN_KEY_MISSING') {
      const partial = offlinePartial(value)
      partial.note = err.message
      return partial
    }
    throw err
  }
}

export const gstinUsesCaptcha = () => {
  const mode = provider()
  return mode === 'portal' || (mode !== 'gstinapi' && mode !== 'sandbox' && mode !== 'none')
}

export const gstinLookupConfigured = () => {
  const mode = provider()
  if (mode === 'none') return false
  if (mode === 'portal') return true
  if (mode === 'sandbox') {
    return Boolean(apiKey() && String(import.meta.env.VITE_GSTIN_API_SECRET || '').trim())
  }
  if (mode === 'gstinapi') return Boolean(apiKey())
  return true
}
