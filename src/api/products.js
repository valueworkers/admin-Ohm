/**
 * Client for /api/products (Vite middleware → Wix Catalog V3).
 * WIX_API_KEY never leaves the server.
 */

export const CURRENCY_FALLBACK = 'INR'

const parseJson = async (res) => {
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  return { text, data }
}

const apiError = (res, data, text) => {
  const msg =
    data?.message ||
    data?.error ||
    text ||
    `Request failed (${res.status})`
  const err = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  err.status = res.status
  err.data = data
  return err
}

const request = async (path, { method = 'GET', body } = {}) => {
  const res = await fetch(`/api/products${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  const { text, data } = await parseJson(res)
  const looksLikeHtml =
    typeof text === 'string' &&
    (text.trimStart().startsWith('<!DOCTYPE') ||
      text.trimStart().startsWith('<html'))
  if (looksLikeHtml) {
    throw new Error(
      'Products API is not available on this host. Deploy the /api/products serverless route and set WIX_API_KEY + WIX_SITE_ID (not VITE_) in production env.',
    )
  }
  if (!res.ok) throw apiError(res, data, text)
  return data
}

/** GET /api/products?cursor=&q=&limit=50 */
export const listProducts = async ({ cursor = '', q = '', limit = 50 } = {}) => {
  const qs = new URLSearchParams()
  qs.set('limit', String(limit))
  if (cursor) qs.set('cursor', cursor)
  if (q) qs.set('q', q)
  return request(`?${qs.toString()}`)
}

/** GET /api/products/:id — includes variants */
export const getProduct = async (id) =>
  request(`/${encodeURIComponent(id)}`)

/** POST /api/products */
export const createProduct = async (payload) =>
  request('', { method: 'POST', body: payload })

/** PATCH /api/products/:id */
export const updateProduct = async (id, payload) =>
  request(`/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: payload,
  })

/** DELETE /api/products/:id */
export const deleteProduct = async (id) =>
  request(`/${encodeURIComponent(id)}`, { method: 'DELETE' })

/** Retry stock only */
export const retryProductInventory = async (productId, inventoryItems) =>
  request(`/${encodeURIComponent(productId)}/inventory`, {
    method: 'POST',
    body: { inventoryItems },
  })

/** Upload a local image file to Wix Media Manager via /api/products/media */
export const uploadProductImage = async (file) => {
  if (!file) throw new Error('No file selected.')
  const mimeType = file.type || 'image/jpeg'
  const allowed = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
  ]
  if (!allowed.includes(mimeType.toLowerCase())) {
    throw new Error('Only JPEG, PNG, WebP, or GIF images are allowed.')
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('Image must be 8MB or smaller.')
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read the image file.'))
    reader.readAsDataURL(file)
  })

  return request('/media', {
    method: 'POST',
    body: {
      fileName: file.name || 'product.jpg',
      mimeType,
      data: dataUrl,
    },
  })
}

/** Cartesian product of option choices → variant rows */
export const cartesianVariants = (options = []) => {
  const clean = (options || [])
    .map((o) => ({
      name: String(o.name || '').trim(),
      choices: (o.choices || [])
        .map((c) => String(typeof c === 'string' ? c : c.name || '').trim())
        .filter(Boolean),
    }))
    .filter((o) => o.name && o.choices.length)

  if (!clean.length) return []

  return clean.reduce(
    (acc, opt) => {
      const next = []
      for (const row of acc) {
        for (const choiceName of opt.choices) {
          next.push([...row, { optionName: opt.name, choiceName }])
        }
      }
      return next
    },
    [[]],
  )
}

export const variantKey = (choices = []) =>
  choices.map((c) => `${c.optionName}:${c.choiceName}`).join('|')

export const formatPriceRange = (product, currency = CURRENCY_FALLBACK) => {
  const sym = currency === 'INR' || !currency ? '₹' : `${currency} `
  const price = product?.price
  const max = product?.maxPrice
  if (price == null && max == null) return '—'
  if (max != null && price != null && max !== price) {
    return `${sym}${price} – ${sym}${max}`
  }
  return price != null ? `${sym}${price}` : '—'
}
