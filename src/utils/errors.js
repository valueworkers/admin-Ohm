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
export const extractErrorMessage = (data, fallback = 'Something went wrong.') => {
  if (!data) return fallback
  if (typeof data === 'string' && data.trim()) {
    return humanizeThrottleMessage(data) || data.trim()
  }
  if (typeof data.detail === 'string') {
    return humanizeThrottleMessage(data.detail) || data.detail
  }
  if (typeof data.message === 'string') {
    return humanizeThrottleMessage(data.message) || data.message
  }
  if (typeof data.error === 'string') {
    return humanizeThrottleMessage(data.error) || data.error
  }
  if (typeof data === 'object') {
    const firstKey = Object.keys(data)[0]
    const value = data[firstKey]
    if (Array.isArray(value) && value[0]) {
      const first = String(value[0])
      return humanizeThrottleMessage(first) || first
    }
    if (typeof value === 'string') {
      return humanizeThrottleMessage(value) || value
    }
  }
  return fallback
}

export const apiErrorMessage = (error, fallback) => {
  const raw = extractErrorMessage(error?.response?.data, error?.message || fallback)
  return humanizeThrottleMessage(raw) || raw
}
