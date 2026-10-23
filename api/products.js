/**
 * Vercel serverless function: /api/products and (via rewrite) /api/products/*
 *
 * Production env (Vercel → Settings → Environment Variables):
 *   WIX_API_KEY
 *   WIX_SITE_ID
 */

import { createProductsApiMiddleware } from '../server/productsApi.js'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

export default async function handler(req, res) {
  try {
    // Subpaths rewritten here as ?__path=id or ?__path=id/inventory or ?__path=media
    const extra = String(req.query?.__path || '').replace(/^\/+|\/+$/g, '')
    let path = '/api/products'
    if (extra) path += `/${extra.split('/').map(decodeURIComponent).join('/')}`

    const incoming = new URL(req.url || '/', 'http://local')
    incoming.searchParams.delete('__path')
    incoming.searchParams.delete('path')
    const q = incoming.searchParams.toString()
    req.url = path + (q ? `?${q}` : '')

    const middleware = createProductsApiMiddleware(process.env)

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
    console.error('[api/products]', err)
    if (!res.writableEnded) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          message: err?.message || 'Products API failed to start',
        }),
      )
    }
  }
}
