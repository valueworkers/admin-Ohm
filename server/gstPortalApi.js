/**
 * Connect middleware: /api/gst/* → official GST portal Search Taxpayer
 * (https://services.gst.gov.in/services/searchtp).
 *
 * Uses Node `https` (not undici fetch) — the portal resets plain fetch TLS.
 * Captcha response cookies (CaptchaCookie + F5 TS*) must all be replayed on details.
 */

import https from 'https'

const GST_HOST = 'services.gst.gov.in'
const GST_CAPTCHA_PATH = '/services/captcha?rnd='
const GST_DETAILS_PATH = '/services/api/search/taxpayerDetails'
const INVALID_GST_CODE = 'SWEB_9035'
const INVALID_CAPTCHA_CODE = 'SWEB_9000'

const BROWSER_HEADERS = {
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Referer: 'https://services.gst.gov.in/services/searchtp',
  Origin: 'https://services.gst.gov.in',
}

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

const mergeCookies = (jar, setCookie) => {
  const next = new Map(jar)
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []
  for (const raw of list) {
    const nv = String(raw || '').split(';')[0].trim()
    const eq = nv.indexOf('=')
    if (eq <= 0) continue
    next.set(nv.slice(0, eq), nv.slice(eq + 1))
  }
  return next
}

const cookieHeaderFromJar = (jar) =>
  [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')

const hasCaptchaCookie = (cookieHeader) =>
  /(^|;\s*)CaptchaCookie=/.test(String(cookieHeader || ''))

/** Accept full jar or bare CaptchaCookie value from the client. */
const normalizeCookieHeader = (raw) => {
  const text = String(raw || '').trim()
  if (!text) return ''
  if (hasCaptchaCookie(text) || text.includes('=')) return text
  return `CaptchaCookie=${text}`
}

const looksLikePng = (buf) =>
  Buffer.isBuffer(buf) &&
  buf.length > 100 &&
  buf[0] === 0x89 &&
  buf[1] === 0x50 &&
  buf[2] === 0x4e &&
  buf[3] === 0x47

const gstRequest = (method, path, { headers = {}, body, jar } = {}) =>
  new Promise((resolve, reject) => {
    const payload = body != null ? Buffer.from(body) : null
    const cookie = jar && jar.size ? cookieHeaderFromJar(jar) : ''
    const reqHeaders = {
      ...BROWSER_HEADERS,
      ...headers,
    }
    if (cookie) reqHeaders.Cookie = cookie
    if (payload) {
      reqHeaders['Content-Type'] = reqHeaders['Content-Type'] || 'application/json'
      reqHeaders['Content-Length'] = payload.length
    }

    const req = https.request(
      {
        hostname: GST_HOST,
        path,
        method,
        headers: reqHeaders,
        servername: GST_HOST,
      },
      (upstream) => {
        const chunks = []
        upstream.on('data', (c) => chunks.push(c))
        upstream.on('end', () => {
          resolve({
            status: upstream.statusCode || 0,
            headers: upstream.headers,
            body: Buffer.concat(chunks),
            jar: mergeCookies(jar || new Map(), upstream.headers['set-cookie']),
          })
        })
      },
    )
    req.on('error', reject)
    req.setTimeout(25000, () => {
      req.destroy(new Error('GST portal request timed out.'))
    })
    if (payload) req.write(payload)
    req.end()
  })

/** Follow a few redirects while accumulating Set-Cookie into the jar. */
const gstRequestFollow = async (method, path, opts = {}, maxRedirects = 4) => {
  let currentMethod = method
  let currentPath = path
  let jar = opts.jar ? new Map(opts.jar) : new Map()
  let last = null

  for (let i = 0; i <= maxRedirects; i += 1) {
    last = await gstRequest(currentMethod, currentPath, { ...opts, jar, body: i === 0 ? opts.body : undefined })
    jar = last.jar
    if (last.status < 300 || last.status >= 400 || !last.headers.location) {
      return { ...last, jar }
    }
    const loc = String(last.headers.location)
    try {
      const abs = new URL(loc, `https://${GST_HOST}${currentPath}`)
      if (abs.hostname !== GST_HOST) {
        const err = new Error('GST portal redirected off-host.')
        err.status = 502
        throw err
      }
      currentPath = abs.pathname + abs.search
    } catch (e) {
      if (e.status) throw e
      currentPath = loc.startsWith('/') ? loc : `/${loc}`
    }
    currentMethod = 'GET'
  }
  return { ...last, jar }
}

const fetchCaptchaOnce = async () => {
  const upstream = await gstRequestFollow('GET', `${GST_CAPTCHA_PATH}${Math.random()}`, {
    headers: {
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
  })
  const captcha_cookie = cookieHeaderFromJar(upstream.jar)
  return {
    status: upstream.status,
    body: upstream.body,
    captcha_cookie,
  }
}

export function createGstPortalApiMiddleware() {
  return async function gstPortalApi(req, res, next) {
    const url = new URL(req.url || '/', 'http://local')
    if (!url.pathname.startsWith('/api/gst')) return next()

    const path = url.pathname.replace(/\/$/, '') || '/'

    try {
      if (path === '/api/gst/captcha' && (req.method === 'GET' || req.method === 'HEAD')) {
        let last = null
        for (let attempt = 0; attempt < 3; attempt += 1) {
          last = await fetchCaptchaOnce()
          if (
            last.status >= 200 &&
            last.status < 300 &&
            looksLikePng(last.body) &&
            hasCaptchaCookie(last.captcha_cookie)
          ) {
            return sendJson(res, 200, {
              captcha_image: last.body.toString('base64'),
              captcha_cookie: last.captcha_cookie,
            })
          }
        }

        if (!last || last.status < 200 || last.status >= 300) {
          return sendJson(res, 502, {
            message: `GST captcha failed (${last?.status || 'no response'}).`,
          })
        }
        if (!hasCaptchaCookie(last.captcha_cookie)) {
          return sendJson(res, 502, {
            message: 'GST portal did not return a captcha cookie. Refresh and try again.',
          })
        }
        return sendJson(res, 502, {
          message: 'GST portal returned an empty or invalid captcha image.',
        })
      }

      if (path === '/api/gst/details' && req.method === 'POST') {
        const body = await readJson(req)
        const gstin = String(body.gstin || '').trim().toUpperCase()
        const captcha = String(body.captcha || '').trim()
        const captcha_cookie = normalizeCookieHeader(
          body.captcha_cookie || body.captchaCookie || '',
        )

        if (!gstin || gstin.length !== 15) {
          return sendJson(res, 400, { message: 'Enter a valid 15-character GSTIN.' })
        }
        if (!captcha) {
          return sendJson(res, 400, { message: 'Enter the captcha text.' })
        }
        if (!hasCaptchaCookie(captcha_cookie)) {
          return sendJson(res, 400, {
            message: 'Captcha session expired. Refresh the image.',
          })
        }

        const jar = new Map()
        for (const part of captcha_cookie.split(';')) {
          const nv = part.trim()
          const eq = nv.indexOf('=')
          if (eq > 0) jar.set(nv.slice(0, eq), nv.slice(eq + 1))
        }

        const upstream = await gstRequestFollow('POST', GST_DETAILS_PATH, {
          headers: {
            Accept: 'application/json, text/plain, */*',
          },
          body: JSON.stringify({ gstin, captcha }),
          jar,
        })

        let gstData = {}
        try {
          gstData = JSON.parse(upstream.body.toString('utf8') || '{}')
        } catch {
          gstData = {}
        }

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

        if (upstream.status < 200 || upstream.status >= 300) {
          return sendJson(res, 502, {
            message: `GST details failed (${upstream.status}).`,
          })
        }

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
