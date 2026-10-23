/**
 * Vercel serverless: /api/products and /api/products/*
 * Reuses the same Catalog V3 handler as the Vite dev middleware.
 *
 * Env (Project Settings → Environment Variables, Production):
 *   WIX_API_KEY
 *   WIX_SITE_ID
 * Do NOT use VITE_ prefix for these — they must stay server-only.
 */

import { createProductsApiMiddleware } from '../../server/productsApi.js'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

export default async function handler(req, res) {
  const slug = req.query?.slug
  const parts = slug == null ? [] : Array.isArray(slug) ? slug : [slug]

  // Rebuild path our Connect-style router expects
  let path = '/api/products'
  if (parts.length) path += `/${parts.join('/')}`

  try {
    const incoming = new URL(req.url || '/', 'http://local')
    incoming.searchParams.delete('slug')
    const q = incoming.searchParams.toString()
    req.url = path + (q ? `?${q}` : '')
  } catch {
    req.url = path
  }

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
}
