/**
 * Connect middleware: /api/products → Wix Catalog V3
 * Mounted from vite.config.js (dev + preview). No Express dependency.
 */

import {
  buildCreateProductBody,
  createWixClient,
  mapProductDetail,
  mapProductListItem,
  shortWixMessage,
  writableOptions,
  writableVariants,
  amountStr,
} from './wixCatalog.js'

const readJson = async (req) => {
  // Vercel / some hosts pre-parse JSON onto req.body
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

const isRevisionConflict = (err) => {
  const msg = String(err?.message || '').toLowerCase()
  const code = err?.wix?.details?.applicationError?.code
  return (
    err?.status === 409 ||
    code === 'REVISION_MISMATCH' ||
    msg.includes('revision')
  )
}

export function createProductsApiMiddleware(env = {}) {
  const apiKey = String(env.WIX_API_KEY || '').trim()
  const siteId = String(env.WIX_SITE_ID || '').trim()

  return async function productsApi(req, res, next) {
    const url = new URL(req.url || '/', 'http://local')
    if (!url.pathname.startsWith('/api/products')) return next()

    // Only handle exact /api/products and /api/products/:id (+ optional stock retry)
    const path = url.pathname.replace(/\/$/, '') || '/'
    const parts = path.split('/').filter(Boolean) // ['api','products', ...]

    try {
      if (!apiKey || !siteId) {
        return sendJson(res, 503, {
          message:
            'Wix is not configured. Set WIX_API_KEY and WIX_SITE_ID in .env and restart the dev server.',
        })
      }
      const { wixFetch, uploadImageBuffer } = createWixClient({ apiKey, siteId })

      // POST /api/products/media — upload image from computer → Wix Media Manager
      if (
        parts.length === 3 &&
        parts[0] === 'api' &&
        parts[1] === 'products' &&
        parts[2] === 'media' &&
        req.method === 'POST'
      ) {
        const body = await readJson(req)
        const fileName = String(body.fileName || 'product.jpg')
        const mimeType = String(body.mimeType || 'image/jpeg')
        const b64 = String(body.data || body.base64 || '').replace(
          /^data:[^;]+;base64,/,
          '',
        )
        if (!b64) {
          return sendJson(res, 400, { message: 'Missing image data.' })
        }
        const allowed = [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/webp',
          'image/gif',
        ]
        if (!allowed.includes(mimeType.toLowerCase())) {
          return sendJson(res, 400, {
            message: 'Only JPEG, PNG, WebP, or GIF images are allowed.',
          })
        }
        const buffer = Buffer.from(b64, 'base64')
        if (!buffer.length) {
          return sendJson(res, 400, { message: 'Invalid image data.' })
        }
        if (buffer.length > 8 * 1024 * 1024) {
          return sendJson(res, 400, {
            message: 'Image must be 8MB or smaller.',
          })
        }
        const uploaded = await uploadImageBuffer({
          buffer,
          fileName,
          mimeType,
        })
        return sendJson(res, 200, uploaded)
      }

      // POST /api/products/:id/inventory — retry stock only
      if (
        parts.length === 4 &&
        parts[0] === 'api' &&
        parts[1] === 'products' &&
        parts[3] === 'inventory' &&
        req.method === 'POST'
      ) {
        const productId = parts[2]
        const body = await readJson(req)
        const items = Array.isArray(body.inventoryItems) ? body.inventoryItems : []
        const data = await wixFetch('/stores/v3/bulk/inventory-items/create', {
          method: 'POST',
          body: {
            inventoryItems: items.map((it) => ({
              productId,
              variantId: it.variantId,
              quantity: Number(it.quantity) || 0,
            })),
            returnEntity: true,
          },
        })
        return sendJson(res, 200, {
          ok: true,
          totalSuccesses: data?.bulkActionMetadata?.totalSuccesses ?? 0,
          results: data?.results || [],
        })
      }

      // Collection: /api/products
      if (parts.length === 2 && parts[0] === 'api' && parts[1] === 'products') {
        if (req.method === 'GET') {
          const limit = Math.min(Number(url.searchParams.get('limit') || 50) || 50, 100)
          const cursor = url.searchParams.get('cursor') || undefined
          const q = String(url.searchParams.get('q') || '').trim()

          let data
          if (q) {
            data = await wixFetch('/stores/v3/products/search', {
              method: 'POST',
              body: {
                search: {
                  search: {
                    expression: q,
                    fields: ['name'],
                    fuzzy: true,
                  },
                  cursorPaging: { limit, ...(cursor ? { cursor } : {}) },
                },
                fields: ['CURRENCY'],
              },
            })
          } else {
            data = await wixFetch('/stores/v3/products/query', {
              method: 'POST',
              body: {
                query: {
                  cursorPaging: { limit, ...(cursor ? { cursor } : {}) },
                },
                fields: ['CURRENCY'],
              },
            })
          }

          const products = (data?.products || []).map(mapProductListItem)
          const nextCursor =
            data?.pagingMetadata?.cursors?.next ||
            data?.metadata?.cursors?.next ||
            null
          const hasNext = Boolean(
            data?.pagingMetadata?.hasNext ?? nextCursor,
          )
          return sendJson(res, 200, {
            products,
            nextCursor: hasNext ? nextCursor : null,
            currency: products[0]?.currency || 'INR',
          })
        }

        if (req.method === 'POST') {
          const input = await readJson(req)
          const { product, useInventoryEndpoint } = buildCreateProductBody(input)
          const pathCreate = useInventoryEndpoint
            ? '/stores/v3/products-with-inventory'
            : '/stores/v3/products'
          const data = await wixFetch(pathCreate, {
            method: 'POST',
            body: { product },
            fields: [
              'CURRENCY',
              'PLAIN_DESCRIPTION',
              'VARIANT_OPTION_CHOICE_NAMES',
            ],
          })
          const created = data?.product || data
          return sendJson(res, 201, mapProductDetail(created))
        }

        return sendJson(res, 405, { message: 'Method not allowed' })
      }

      // Item: /api/products/:id
      if (parts.length === 3 && parts[0] === 'api' && parts[1] === 'products') {
        const productId = decodeURIComponent(parts[2])

        if (req.method === 'GET') {
          const data = await wixFetch(`/stores/v3/products/${encodeURIComponent(productId)}`, {
            fields: [
              'CURRENCY',
              'PLAIN_DESCRIPTION',
              'VARIANT_OPTION_CHOICE_NAMES',
              'MEDIA_ITEMS_INFO',
            ],
          })
          return sendJson(res, 200, mapProductDetail(data?.product || data))
        }

        if (req.method === 'PATCH') {
          const patchInput = await readJson(req)

          const applyPatch = async () => {
            const getData = await wixFetch(
              `/stores/v3/products/${encodeURIComponent(productId)}`,
              {
                fields: [
                  'CURRENCY',
                  'PLAIN_DESCRIPTION',
                  'VARIANT_OPTION_CHOICE_NAMES',
                  'MEDIA_ITEMS_INFO',
                  'MERCHANT_DATA',
                ],
              },
            )
            const fresh = getData?.product || getData
            const product = {
              id: String(fresh.id),
              revision: String(fresh.revision),
            }

            if (patchInput.name != null) {
              product.name = String(patchInput.name).trim().slice(0, 80)
            }
            if (patchInput.visible != null) product.visible = Boolean(patchInput.visible)
            if (patchInput.plainDescription != null) {
              product.plainDescription = String(patchInput.plainDescription)
                .trim()
                .slice(0, 16000)
            }
            if (patchInput.brand != null) {
              const b = String(patchInput.brand || '').trim()
              if (b) product.brand = { name: b }
            }
            if (patchInput.mediaId || (patchInput.imageUrl != null && String(patchInput.imageUrl).trim())) {
              // Catalog V3: first itemsInfo item becomes media.main
              const item = patchInput.mediaId
                ? { id: String(patchInput.mediaId) }
                : { url: String(patchInput.imageUrl).trim() }
              product.media = { itemsInfo: { items: [item] } }
            }

            const optionsRaw = fresh.options || []
            const variantsRaw = fresh.variantsInfo?.variants || []
            const hasOptions = optionsRaw.length > 0

            // Convert simple product → optioned (full options + optioned variants)
            if (
              !hasOptions &&
              patchInput.convertToOptions &&
              Array.isArray(patchInput.options) &&
              Array.isArray(patchInput.variants) &&
              patchInput.variants.length
            ) {
              const opts = patchInput.options.slice(0, 6).map((opt) => ({
                name: String(opt.name || '').trim(),
                optionRenderType: 'TEXT_CHOICES',
                choicesSettings: {
                  choices: (opt.choices || []).map((c) => ({
                    name: String(typeof c === 'string' ? c : c.name || '').trim(),
                    choiceType: 'CHOICE_TEXT',
                  })),
                },
              }))
              // Do not keep the choice-less default variant id — send all new optioned variants.
              const created = patchInput.variants.map((v) => {
                const pricePayload = {
                  actualPrice: { amount: amountStr(v.price) },
                }
                const compare = String(v.compareAtPrice || '').trim()
                if (compare) {
                  pricePayload.compareAtPrice = { amount: compare }
                }
                const row = {
                  visible: v.visible !== false,
                  price: pricePayload,
                  choices: (v.choices || []).map((c) => ({
                    optionChoiceNames: {
                      optionName: c.optionName,
                      choiceName: c.choiceName,
                      renderType: 'TEXT_CHOICES',
                    },
                  })),
                }
                if (v.sku) row.sku = String(v.sku)
                return row
              })
              product.options = opts
              product.variantsInfo = { variants: created }
            } else if (Array.isArray(patchInput.variants)) {
              // Variant price / sku / visible updates + optional new choices/variants
              let opts = writableOptions(optionsRaw)

              // Optional: add new choices to existing options (by option name)
              if (Array.isArray(patchInput.newChoices) && patchInput.newChoices.length) {
                patchInput.newChoices.forEach((nc) => {
                  const opt = opts.find(
                    (o) => o.name === nc.optionName || o.id === nc.optionId,
                  )
                  if (!opt) return
                  const name = String(nc.choiceName || '').trim()
                  if (!name) return
                  const exists = opt.choicesSettings.choices.some((c) => c.name === name)
                  if (!exists) {
                    opt.choicesSettings.choices.push({
                      name,
                      choiceType: 'CHOICE_TEXT',
                    })
                  }
                })
              }

              const byId = new Map(variantsRaw.map((v) => [String(v.id), v]))
              const nextVariants = []

              for (const v of patchInput.variants) {
                const isNew = !v.id || String(v.id).startsWith('new-')
                if (!isNew && byId.has(String(v.id))) {
                  const base = structuredClone(byId.get(String(v.id)))
                  if (v.price != null && v.price !== '') {
                    base.price = base.price || {}
                    base.price.actualPrice = { amount: amountStr(v.price) }
                  }
                  if (v.compareAtPrice != null) {
                    base.price = base.price || { actualPrice: { amount: '0' } }
                    const c = String(v.compareAtPrice).trim()
                    if (c) base.price.compareAtPrice = { amount: c }
                    else delete base.price.compareAtPrice
                  }
                  if (v.sku != null) base.sku = String(v.sku)
                  if (v.visible != null) base.visible = Boolean(v.visible)
                  nextVariants.push(base)
                } else if (isNew && Array.isArray(v.choices) && v.choices.length) {
                  const pricePayload = {
                    actualPrice: { amount: amountStr(v.price) },
                  }
                  if (v.compareAtPrice) {
                    pricePayload.compareAtPrice = {
                      amount: amountStr(v.compareAtPrice),
                    }
                  }
                  nextVariants.push({
                    visible: v.visible !== false,
                    sku: v.sku || undefined,
                    price: pricePayload,
                    choices: v.choices.map((c) => ({
                      optionChoiceNames: {
                        optionName: c.optionName,
                        choiceName: c.choiceName,
                        renderType: 'TEXT_CHOICES',
                      },
                    })),
                    physicalProperties: {},
                  })
                }
              }

              // Simple product (no options): update the single default variant
              if (!hasOptions && nextVariants.length === 0 && variantsRaw[0]) {
                const base = structuredClone(variantsRaw[0])
                const only = patchInput.variants[0] || {}
                if (only.price != null && only.price !== '') {
                  base.price = base.price || {}
                  base.price.actualPrice = { amount: amountStr(only.price) }
                }
                if (only.compareAtPrice != null) {
                  base.price = base.price || { actualPrice: { amount: '0' } }
                  const c = String(only.compareAtPrice).trim()
                  if (c) base.price.compareAtPrice = { amount: c }
                  else delete base.price.compareAtPrice
                }
                if (only.visible != null) base.visible = Boolean(only.visible)
                nextVariants.push(base)
              }

              // No-options products: product.visible and default variant.visible must stay in sync.
              if (!hasOptions && patchInput.visible != null) {
                const vis = Boolean(patchInput.visible)
                product.visible = vis
                nextVariants.forEach((v) => {
                  v.visible = vis
                })
              }

              if (!hasOptions) {
                product.options = []
                product.variantsInfo = {
                  variants: writableVariants(nextVariants, []),
                }
              } else {
                product.options = opts
                product.variantsInfo = {
                  variants: writableVariants(nextVariants, opts),
                }
              }
            }

            const data = await wixFetch(
              `/stores/v3/products/${encodeURIComponent(productId)}`,
              { method: 'PATCH', body: { product } },
            )
            return data?.product || data
          }

          let updated
          try {
            updated = await applyPatch()
          } catch (err) {
            if (isRevisionConflict(err)) {
              updated = await applyPatch()
            } else {
              throw err
            }
          }

          // Stock for newly added variants (by choice names) via Inventory Items API
          let stockWarning = null
          const pendingStock = (patchInput.variants || []).filter(
            (v) =>
              (!v.id || String(v.id).startsWith('new-')) &&
              v.stockQuantity != null &&
              v.stockQuantity !== '',
          )
          if (pendingStock.length && updated?.variantsInfo?.variants) {
            const choiceKey = (choices = []) =>
              (choices || [])
                .map((c) => {
                  const n = c.optionChoiceNames || c
                  return `${n.optionName}:${n.choiceName}`
                })
                .sort()
                .join('|')
            const inventoryItems = []
            for (const reqV of pendingStock) {
              const key = (reqV.choices || [])
                .map((c) => `${c.optionName}:${c.choiceName}`)
                .sort()
                .join('|')
              const match = updated.variantsInfo.variants.find(
                (rv) => choiceKey(rv.choices) === key,
              )
              if (match?.id) {
                inventoryItems.push({
                  productId,
                  variantId: match.id,
                  quantity: Number(reqV.stockQuantity) || 0,
                })
              }
            }
            if (inventoryItems.length) {
              try {
                await wixFetch('/stores/v3/bulk/inventory-items/create', {
                  method: 'POST',
                  body: { inventoryItems, returnEntity: true },
                })
              } catch (stockErr) {
                stockWarning = shortWixMessage(
                  stockErr.wix,
                  stockErr.message || 'Stock update failed',
                )
              }
            }
          }

          const detail = mapProductDetail(updated)
          if (stockWarning) detail.stockWarning = stockWarning
          return sendJson(res, 200, detail)
        }

        if (req.method === 'DELETE') {
          await wixFetch(`/stores/v3/products/${encodeURIComponent(productId)}`, {
            method: 'DELETE',
          })
          return sendJson(res, 200, { ok: true, id: productId })
        }

        return sendJson(res, 405, { message: 'Method not allowed' })
      }

      return next()
    } catch (err) {
      const status = err.status || 500
      return sendJson(res, status, {
        message: shortWixMessage(err.wix, err.message || 'Request failed'),
      })
    }
  }
}
