const formatWaitDuration = (totalSeconds) => {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  if (seconds < 60) {
    return seconds === 1 ? '1 second' : `${seconds} seconds`
  }
  const minutes = Math.floor(seconds / 60)
  const rem = seconds % 60
  const minLabel = minutes === 1 ? '1 minute' : `${minutes} minutes`
  if (rem === 0) return minLabel
  const secLabel = rem === 1 ? '1 second' : `${rem} seconds`
  return `${minLabel} ${secLabel}`
}

/** Turn DRF throttle text like "…available in 356 seconds" into exact wait time. */
export const humanizeThrottleMessage = (raw) => {
  const text = String(raw || '')
  if (!/throttl/i.test(text) && !/too many/i.test(text) && !/rate limit/i.test(text)) {
    return null
  }
  const match =
    text.match(/available in (\d+)\s*seconds?/i) ||
    text.match(/(\d+)\s*seconds?/i) ||
    text.match(/available in (\d+)\s*minutes?/i)
  if (!match) {
    return 'Too many requests. Please wait a few minutes, then try again.'
  }
  const amount = Number(match[1])
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Too many requests. Please wait a few minutes, then try again.'
  }

  const totalSeconds = /minutes?/i.test(match[0]) ? amount * 60 : amount
  return `Too many requests. Please try again in ${formatWaitDuration(totalSeconds)}.`
}
const FIELD_LABELS = {
  buyer_email: 'Buyer email',
  cc_emails: 'CC emails',
  bcc_emails: 'BCC emails',
  company: 'Customer',
  attention: 'Attention',
  address: 'Address',
  state: 'State',
  gstin: 'GSTIN',
  ship_to: 'Ship to',
  your_ref: 'Your ref',
  valid_days: 'Valid days',
  notes: 'Notes',
  terms: 'Terms',
  freight: 'Freight',
  packing: 'Packing',
  charges_gst_rate: 'Charges GST rate',
  lines: 'Line',
  kind: 'Kind',
  item: 'Item',
  specification: 'Specification',
  hsn_sac: 'HSN/SAC',
  uom: 'UOM',
  qty: 'Qty',
  unit_price: 'Unit price',
  discount_percent: 'Discount %',
  gst_rate: 'GST rate',
  non_field_errors: '',
  detail: '',
}

const humanFieldLabel = (key) => {
  if (key == null || key === '') return ''
  if (Object.prototype.hasOwnProperty.call(FIELD_LABELS, key)) {
    return FIELD_LABELS[key]
  }
  return String(key)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Flatten DRF validation payloads into "Field: message" lines.
 * Supports nested line errors: lines.0.hsn_sac → "Line 1 · HSN/SAC: …"
 */
export const flattenApiErrors = (data, path = []) => {
  if (data == null) return []
  if (typeof data === 'string') {
    const text = data.trim()
    if (!text) return []
    const labelParts = path
      .map((p, i) => {
        if (/^\d+$/.test(p)) {
          const parent = path[i - 1]
          if (parent === 'lines') return `Line ${Number(p) + 1}`
          return `#${Number(p) + 1}`
        }
        return humanFieldLabel(p)
      })
      .filter(Boolean)
    const prefix = labelParts.join(' · ')
    return [prefix ? `${prefix}: ${text}` : text]
  }
  if (Array.isArray(data)) {
    return data.flatMap((item) => flattenApiErrors(item, path))
  }
  if (typeof data === 'object') {
    return Object.entries(data).flatMap(([key, value]) =>
      flattenApiErrors(value, [...path, key]),
    )
  }
  return []
}

export const extractErrorMessage = (data, fallback = 'Something went wrong.') => {
  if (!data) return fallback
  if (typeof data === 'string' && data.trim()) {
    return humanizeThrottleMessage(data) || data.trim()
  }
  if (typeof data.detail === 'string') {
    return humanizeThrottleMessage(data.detail) || data.detail
  }
  if (Array.isArray(data.detail)) {
    const lines = flattenApiErrors(data.detail)
    if (lines.length) return lines.join('\n')
  }
  if (typeof data.message === 'string') {
    return humanizeThrottleMessage(data.message) || data.message
  }
  if (typeof data.error === 'string') {
    return humanizeThrottleMessage(data.error) || data.error
  }
  if (typeof data === 'object') {
    const lines = flattenApiErrors(data)
    if (lines.length) {
      const joined = lines.join('\n')
      return humanizeThrottleMessage(joined) || joined
    }
  }
  return fallback
}

export const apiErrorMessage = (error, fallback) => {
  const raw = extractErrorMessage(error?.response?.data, error?.message || fallback)
  return humanizeThrottleMessage(raw) || raw
}

const isBlankRequiredMsg = (msg) =>
  /may not be blank|is required|this field is required|cannot be (empty|blank)/i.test(
    String(msg || ''),
  )

/**
 * Map DRF field errors → { fieldKey: message } for form highlighting.
 * Nested line errors use keys like "lines.0.hsn_sac".
 * requiredKeys lists fields that failed as blank/required.
 */
export const extractApiFieldErrors = (error) => {
  const data = error?.response?.data
  const errors = {}
  const requiredKeys = []
  if (!data || typeof data !== 'object' || typeof data === 'string') {
    return { errors, requiredKeys }
  }

  const walk = (node, path = []) => {
    if (node == null) return
    if (typeof node === 'string') {
      const text = node.trim()
      if (!text || !path.length) return
      const key = path.join('.')
      if (!errors[key]) errors[key] = text
      if (isBlankRequiredMsg(text)) requiredKeys.push(key)
      return
    }
    if (Array.isArray(node)) {
      const texts = node
        .filter((x) => typeof x === 'string')
        .map((x) => x.trim())
        .filter(Boolean)
      if (texts.length && path.length) {
        const key = path.join('.')
        if (!errors[key]) errors[key] = texts[0]
        if (texts.some(isBlankRequiredMsg)) requiredKeys.push(key)
        return
      }
      node.forEach((item) => walk(item, path))
      return
    }
    if (typeof node === 'object') {
      Object.entries(node).forEach(([k, v]) => {
        if (k === 'detail' || k === 'message' || k === 'error') {
          if (typeof v === 'string' || Array.isArray(v)) return
        }
        walk(v, [...path, k])
      })
    }
  }

  walk(data)
  return { errors, requiredKeys: [...new Set(requiredKeys)] }
}
