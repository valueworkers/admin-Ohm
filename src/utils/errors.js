export const extractErrorMessage = (data, fallback = 'Something went wrong.') => {
  if (!data) return fallback
  if (typeof data === 'string' && data.trim()) return data.trim()
  if (typeof data.detail === 'string') return data.detail
  if (typeof data.message === 'string') return data.message
  if (typeof data.error === 'string') return data.error
  if (typeof data === 'object') {
    const firstKey = Object.keys(data)[0]
    const value = data[firstKey]
    if (Array.isArray(value) && value[0]) return String(value[0])
    if (typeof value === 'string') return value
  }
  return fallback
}

export const apiErrorMessage = (error, fallback) =>
  extractErrorMessage(error?.response?.data, error?.message || fallback)
