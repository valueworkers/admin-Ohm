/**
 * Connect middleware: /api/gst/* → official GST portal Search Taxpayer
 * (https://services.gst.gov.in/services/searchtp).
 * Same captcha + taxpayerDetails APIs the portal page uses.
 * Cookie must be read server-side (browsers cannot expose Set-Cookie to JS).
 */

const GST_CAPTCHA_URL = 'https://services.gst.gov.in/services/captcha?rnd='
const GST_DETAILS_URL =
  'https://services.gst.gov.in/services/api/search/taxpayerDetails'
const INVALID_GST_CODE = 'SWEB_9035'
const INVALID_CAPTCHA_CODE = 'SWEB_9000'

const readJson = async (req) => {
  if (req.body != null && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body
  }
  if (typeof req.body === 'string') {
    if (!req.body) return {}
    try {
      return JSON.parse(req.body)
    } catch {
      const err = new Error('Invalid JSON body')
      err.status = 400
      throw err
    }
  }
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    const err = new Error('Invalid JSON body')
    err.status = 400
    throw err
  }
}

const sendJson = (res, status, body) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

const setCookieList = (headers) => {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie()
  }
  const single = headers.get('set-cookie')
  return single ? [single] : []
}

const extractCaptchaCookie = (headers) => {
  for (const raw of setCookieList(headers)) {
    for (const part of String(raw).split(';')) {
      const eq = part.indexOf('=')
      if (eq < 0) continue
      const key = part.slice(0, eq).trim()
      if (key === 'CaptchaCookie') return part.slice(eq + 1).trim()
    }
  }
  return ''
}

export function createGstPortalApiMiddleware() {
  return async function gstPortalApi(req, res, next) {
    const url = new URL(req.url || '/', 'http://local')
    if (!url.pathname.startsWith('/api/gst')) return next()

    const path = url.pathname.replace(/\/$/, '') || '/'

    try {
      if (path === '/api/gst/captcha' && (req.method === 'GET' || req.method === 'HEAD')) {
        const upstream = await fetch(`${GST_CAPTCHA_URL}${Math.random()}`, {
          headers: { Accept: 'image/*' },
        })
        if (!upstream.ok) {
          return sendJson(res, 502, {
            message: `GST captcha failed (${upstream.status}).`,
          })
        }
        const buf = Buffer.from(await upstream.arrayBuffer())
        const captcha_cookie = extractCaptchaCookie(upstream.headers)
        if (!captcha_cookie) {
          return sendJson(res, 502, {
            message: 'GST portal did not return a captcha cookie.',
          })
        }
        return sendJson(res, 200, {
          captcha_image: buf.toString('base64'),
          captcha_cookie,
        })
      }

      if (path === '/api/gst/details' && req.method === 'POST') {
        const body = await readJson(req)
        const gstin = String(body.gstin || '').trim().toUpperCase()
        const captcha = String(body.captcha || '').trim()
        const captcha_cookie = String(body.captcha_cookie || '').trim()

        if (!gstin || gstin.length !== 15) {
          return sendJson(res, 400, { message: 'Enter a valid 15-character GSTIN.' })
        }
        if (!captcha) {
          return sendJson(res, 400, { message: 'Enter the captcha text.' })
        }
        if (!captcha_cookie) {
          return sendJson(res, 400, { message: 'Captcha session expired. Refresh the image.' })
        }

        const upstream = await fetch(GST_DETAILS_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Cookie: `CaptchaCookie=${captcha_cookie}`,
          },
          body: JSON.stringify({ gstin, captcha }),
        })

        const gstData = await upstream.json().catch(() => ({}))

        if (gstData?.message === null || gstData?.errorCode) {
          if (gstData?.errorCode === INVALID_GST_CODE) {
            return sendJson(res, 400, { message: 'Invalid GSTIN.', code: INVALID_GST_CODE })
          }
          if (gstData?.errorCode === INVALID_CAPTCHA_CODE) {
            return sendJson(res, 400, {
              message: 'Invalid captcha. Refresh and try again.',
              code: INVALID_CAPTCHA_CODE,
            })
          }
          return sendJson(res, 400, {
            message:
              gstData?.error ||
              gstData?.message ||
              'GST portal rejected this lookup.',
            code: gstData?.errorCode || undefined,
          })
        }

        if (!upstream.ok) {
          return sendJson(res, 502, {
            message: `GST details failed (${upstream.status}).`,
          })
        }

        // Pass through portal payload. Public search has no director/owner list
        // (that needs GST login). Proprietor ≈ lgnm when ctb is Proprietorship.
        return sendJson(res, 200, {
          ...gstData,
          gstin: gstData?.gstin || gstin,
          address: gstData?.pradr?.adr || '',
        })
      }

      return sendJson(res, 404, { message: 'Not found' })
    } catch (err) {
      const status = err?.status && Number.isFinite(err.status) ? err.status : 502
      return sendJson(res, status, {
        message: err?.message || 'GST portal request failed.',
      })
    }
  }
}
