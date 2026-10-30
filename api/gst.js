/**
 * Vercel serverless function: /api/gst and (via rewrite) /api/gst/*
 * Proxies Indian GST portal captcha + taxpayer search (no paid API key).
 */

import { createGstPortalApiMiddleware } from '../server/gstPortalApi.js'

export default async function handler(req, res) {
  try {
    const extra = String(req.query?.__path || '').replace(/^\/+|\/+$/g, '')
    let path = '/api/gst'
    if (extra) path += `/${extra.split('/').map(decodeURIComponent).join('/')}`

    const incoming = new URL(req.url || '/', 'http://local')
    incoming.searchParams.delete('__path')
    incoming.searchParams.delete('path')
    const q = incoming.searchParams.toString()
    req.url = path + (q ? `?${q}` : '')

    const middleware = createGstPortalApiMiddleware()

    await new Promise((resolve) => {
      const originalEnd = res.end.bind(res)
      res.end = (...args) => {
        originalEnd(...args)
        resolve()
      }
      middleware(req, res, () => {
        if (!res.writableEnded) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message: 'Not found' }))
        }
        resolve()
      })
    })
  } catch (err) {
    console.error('[api/gst]', err)
    if (!res.writableEnded) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          message: err?.message || 'GST portal API failed to start',
        }),
      )
    }
  }
}
