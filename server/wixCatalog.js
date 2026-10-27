/**
 * Server-only Wix Stores Catalog V3 helpers.
 * Keys stay here — never import this from browser code.
 */

const WIX_BASE = 'https://www.wixapis.com'
const CURRENCY_FALLBACK = 'INR'

const shortWixMessage = (data, fallback = 'Wix request failed') => {
  if (!data || typeof data !== 'object') return fallback
  return (
    data.message ||
    data.errorDescription ||
    data.details?.applicationError?.description ||
    data.details?.validationError?.fieldViolations?.[0]?.description ||
    fallback
  )
}

export const createWixClient = ({ apiKey, siteId }) => {
  if (!apiKey || !siteId) {
    throw new Error('WIX_API_KEY and WIX_SITE_ID are required on the server.')
  }

  const wixFetch = async (path, { method = 'GET', body, fields } = {}) => {
    let url = `${WIX_BASE}${path}`
    if (fields?.length) {
      const qs = new URLSearchParams()
      fields.forEach((f) => qs.append('fields', f))
      url += `?${qs.toString()}`
    }
    const res = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: apiKey,
        'wix-site-id': siteId,
      },
      body: body != null ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = null
    }
    if (!res.ok) {
      const err = new Error(shortWixMessage(data, text || `Wix ${res.status}`))
      err.status = res.status
      err.wix = data
      throw err
    }
    return data
  }

  /**
   * Upload a local image to Wix Media Manager (generate-upload-url → PUT).
   * @returns {{ id: string, url: string }}
   */
  const uploadImageBuffer = async ({
    buffer,
    fileName = 'product.jpg',
    mimeType = 'image/jpeg',
  }) => {
    const safeName = String(fileName || 'product.jpg')
      .replace(/[^\w.\-]+/g, '_')
      .slice(0, 120)
    const mime = String(mimeType || 'image/jpeg')

    const gen = await wixFetch('/site-media/v1/files/generate-upload-url', {
      method: 'POST',
      body: {
        mimeType: mime,
        fileName: safeName,
      },
    })
    const uploadUrl = gen?.uploadUrl
    if (!uploadUrl) {
      const err = new Error('Wix did not return an upload URL.')
      err.status = 502
      throw err
    }

    const putUrl = new URL(uploadUrl)
    if (!putUrl.searchParams.get('filename')) {
      putUrl.searchParams.set('filename', safeName)
    }

    const putRes = await fetch(putUrl.toString(), {
      method: 'PUT',
      headers: { 'Content-Type': mime },
      body: buffer,
    })
    const putText = await putRes.text()
    let putData = null
    try {
      putData = putText ? JSON.parse(putText) : null
    } catch {
      putData = null
    }
    if (!putRes.ok) {
      const err = new Error(
        shortWixMessage(putData, putText || `Upload failed (${putRes.status})`),
      )
      err.status = putRes.status
      err.wix = putData
      throw err
    }

    const file = putData?.file || putData
    const id = file?.id || ''
    const url =
      file?.url ||
      file?.media?.image?.image?.url ||
      file?.thumbnailUrl ||
      ''
    if (!url && !id) {
      const err = new Error('Upload succeeded but no media URL was returned.')
      err.status = 502
      throw err
    }
    return {
      id: String(id || ''),
      url:
        String(url || '') ||
        (id ? `https://static.wixstatic.com/media/${id}` : ''),
    }
  }

  return { wixFetch, uploadImageBuffer }
}

/** List DTO — Catalog V3 query product → UI row */
export const mapProductListItem = (product = {}) => {
  const min = product.actualPriceRange?.minValue?.amount
  const max = product.actualPriceRange?.maxValue?.amount
  const compare = product.compareAtPriceRange?.minValue?.amount
  const price = min != null && min !== '' ? Number(min) : null
  const maxNum = max != null && max !== '' ? Number(max) : null
  const compareNum = compare != null && compare !== '' ? Number(compare) : null
  const options = Array.isArray(product.options) ? product.options : []
  const hasVariants = options.length > 0
  const brandName =
    typeof product.brand === 'string' ? product.brand : product.brand?.name
  const currency =
    product.currency ||
    product.actualPriceRange?.minValue?.formattedAmount?.match(/[A-Z]{3}/)?.[0] ||
    CURRENCY_FALLBACK

  const item = {
    id: product.id,
    name: product.name || '',
    image: product.media?.main?.image?.url || '',
    price: Number.isFinite(price) ? price : null,
    currency,
    inStock: product.inventory?.availabilityStatus === 'IN_STOCK',
    hasVariants,
    variantCount: hasVariants
      ? Number(product.variantSummary?.variantCount || 0) || options.length
      : 0,
    visible: product.visible !== false,
    revision: product.revision != null ? String(product.revision) : '',
    options,
  }
  if (maxNum != null && price != null && maxNum > price) item.maxPrice = maxNum
  if (compareNum != null && price != null && compareNum > price) {
    item.compareAtPrice = compareNum
  }
  if (brandName) item.brand = String(brandName)
  return item
}

/**
 * VERIFY: Query/Search omit variantsInfo.variants.
 * Source of truth for per-variant data: Get Product → variantsInfo.variants
 * (with fields VARIANT_OPTION_CHOICE_NAMES for optionName/choiceName).
 */
const choiceMediaUrl = (choice = {}) => {
  const media = Array.isArray(choice.linkedMedia) ? choice.linkedMedia[0] : null
  if (!media) return ''
  return media?.image?.url || media?.url || media?.image?.image?.url || ''
}

export const mapVariantDetail = (variant = {}, options = []) => {
  const choiceList = Array.isArray(variant.choices) ? variant.choices : []
  const lookup = new Map()
  ;(options || []).forEach((opt) => {
    ;(opt.choicesSettings?.choices || []).forEach((c) => {
      const image = choiceMediaUrl(c)
      const cid = c.choiceId || c.id
      if (cid) {
        lookup.set(String(cid), {
          optionName: opt.name || '',
          choiceName: c.name || c.key || '',
          image,
        })
      }
      const on = opt.name || ''
      const cn = c.name || c.key || ''
      if (on && cn) {
        lookup.set(`${on}::${cn}`, {
          optionName: on,
          choiceName: cn,
          image,
        })
      }
    })
  })

  const choices = choiceList
    .map((c) => {
      const names = c.optionChoiceNames
      if (names?.optionName && names?.choiceName) {
        const byName = lookup.get(`${names.optionName}::${names.choiceName}`)
        return {
          optionName: names.optionName,
          choiceName: names.choiceName,
          image: byName?.image || '',
        }
      }
      const cid = c.optionChoiceIds?.choiceId || c.choiceId
      const hit = cid ? lookup.get(String(cid)) : null
      if (hit?.optionName && hit?.choiceName) return hit
      return null
    })
    .filter(Boolean)

  const amount = variant.price?.actualPrice?.amount
  const compare = variant.price?.compareAtPrice?.amount
  const image = choices.map((c) => c.image).find(Boolean) || ''
  return {
    id: variant.id,
    choices,
    image,
    price: amount != null && amount !== '' ? Number(amount) : null,
    compareAtPrice:
      compare != null && compare !== '' ? Number(compare) : null,
    sku: variant.sku || '',
    visible: variant.visible !== false,
    inStock: variant.inventoryStatus?.inStock === true,
  }
}

export const mapProductDetail = (product = {}) => {
  const base = mapProductListItem(product)
  const variants = (product.variantsInfo?.variants || []).map((v) =>
    mapVariantDetail(v, product.options),
  )
  return {
    ...base,
    plainDescription: product.plainDescription || '',
    revision: product.revision != null ? String(product.revision) : '',
    productType: product.productType,
    options: product.options || [],
    variants,
    raw: product,
  }
}

export const amountStr = (n) => {
  if (n == null || n === '') return '0'
  return String(n)
}

/** Build create body (PHYSICAL + physicalProperties {}). */
export const buildCreateProductBody = (input = {}) => {
  const name = String(input.name || '').trim().slice(0, 80)
  if (!name) throw Object.assign(new Error('Name is required.'), { status: 400 })

  const hasOptions = Boolean(input.hasOptions && (input.options || []).length)
  const product = {
    name,
    productType: 'PHYSICAL',
    physicalProperties: {},
    visible: input.visible !== false,
  }

  const plain = String(input.plainDescription || '').trim()
  if (plain) product.plainDescription = plain.slice(0, 16000)

  const brandName = String(input.brand || '').trim()
  if (brandName) product.brand = { name: brandName }

  const imageUrl = String(input.imageUrl || '').trim()
  if (imageUrl) {
    // Prefer URL; mediaId also accepted by Catalog V3 when provided as id
    const mediaItem = input.mediaId
      ? { id: String(input.mediaId) }
      : { url: imageUrl }
    product.media = { itemsInfo: { items: [mediaItem] } }
  }

  const compareAtProduct = String(input.compareAtPrice || '').trim()

  if (!hasOptions) {
    const price = amountStr(input.price)
    const variantPrice = { actualPrice: { amount: price } }
    const compare = String(input.compareAtPrice || compareAtProduct || '').trim()
    if (compare) variantPrice.compareAtPrice = { amount: compare }
    const variant = {
      choices: [],
      price: variantPrice,
      physicalProperties: {},
    }
    const qty = input.stockQuantity
    if (qty != null && qty !== '' && Number(qty) >= 0) {
      variant.inventoryItem = { quantity: Number(qty) }
    }
    product.variantsInfo = { variants: [variant] }
    return { product, useInventoryEndpoint: Boolean(variant.inventoryItem) }
  }

  // Options + Cartesian variants via optionChoiceNames (inline options — no reuse by id)
  const options = (input.options || []).slice(0, 6).map((opt) => ({
    name: String(opt.name || '').trim(),
    optionRenderType: 'TEXT_CHOICES',
    choicesSettings: {
      choices: (opt.choices || []).map((c) => ({
        name: String(typeof c === 'string' ? c : c.name || '').trim(),
        choiceType: 'CHOICE_TEXT',
      })),
    },
  }))

  for (const opt of options) {
    if (!opt.name) {
      throw Object.assign(new Error('Every option needs a name.'), { status: 400 })
    }
    if (!opt.choicesSettings.choices.length) {
      throw Object.assign(new Error(`Option “${opt.name}” needs at least one choice.`), {
        status: 400,
      })
    }
  }
  const names = options.map((o) => o.name.toLowerCase())
  if (new Set(names).size !== names.length) {
    throw Object.assign(new Error('Option names must be unique.'), { status: 400 })
  }

  product.options = options

  const variantsIn = Array.isArray(input.variants) ? input.variants : []
  if (!variantsIn.length) {
    throw Object.assign(new Error('Variants are required when options are set.'), {
      status: 400,
    })
  }

  let useInventory = false
  product.variantsInfo = {
    variants: variantsIn.map((v) => {
      const price = amountStr(v.price)
      if (!price || price === '') {
        throw Object.assign(new Error('Every variant needs a price.'), { status: 400 })
      }
      const pricePayload = { actualPrice: { amount: price } }
      const compare = String(v.compareAtPrice || '').trim()
      if (compare) pricePayload.compareAtPrice = { amount: compare }

      const choices = (v.choices || []).map((c) => ({
        optionChoiceNames: {
          optionName: c.optionName,
          choiceName: c.choiceName,
          renderType: 'TEXT_CHOICES',
        },
      }))
      if (choices.length !== options.length) {
        throw Object.assign(
          new Error('Each variant must include one choice per option.'),
          { status: 400 },
        )
      }

      const row = {
        choices,
        price: pricePayload,
        visible: v.visible !== false,
        physicalProperties: {},
      }
      if (v.sku) row.sku = String(v.sku).trim()
      if (v.stockQuantity != null && v.stockQuantity !== '' && Number(v.stockQuantity) >= 0) {
        row.inventoryItem = { quantity: Number(v.stockQuantity) }
        useInventory = true
      }
      return row
    }),
  }

  return { product, useInventoryEndpoint: useInventory }
}

/** Writable options/variants for Update Product (full arrays). */
export const writableOptions = (options = []) =>
  (options || []).map((option) => ({
    id: option.id,
    name: option.name,
    optionRenderType: option.optionRenderType || 'TEXT_CHOICES',
    choicesSettings: {
      choices: (option.choicesSettings?.choices || []).map((choice) => {
        const row = {
          name: choice.name,
          choiceType: choice.choiceType || 'CHOICE_TEXT',
        }
        if (choice.choiceId) row.choiceId = choice.choiceId
        if (choice.colorCode) row.colorCode = choice.colorCode
        return row
      }),
    },
  }))

export const writableVariants = (variants = [], options = []) => {
  const renderByOption = new Map(
    (options || []).map((o) => [String(o.id), o.optionRenderType || 'TEXT_CHOICES']),
  )
  const byChoiceId = new Map()
  ;(options || []).forEach((opt) => {
    ;(opt.choicesSettings?.choices || []).forEach((c) => {
      const cid = c.choiceId || c.id
      if (cid) {
        byChoiceId.set(String(cid), {
          optionName: opt.name,
          choiceName: c.name,
          renderType: opt.optionRenderType || 'TEXT_CHOICES',
        })
      }
    })
  })

  return (variants || []).map((variant) => {
    const copy = {
      visible: variant.visible !== false,
      price: {
        actualPrice: {
          amount: amountStr(variant.price?.actualPrice?.amount ?? '0'),
        },
      },
    }
    if (variant.id) copy.id = variant.id
    if (variant.sku) copy.sku = variant.sku
    if (variant.barcode) copy.barcode = variant.barcode
    if (variant.physicalProperties) {
      copy.physicalProperties = { ...variant.physicalProperties }
      if (copy.physicalProperties.pricePerUnit) {
        delete copy.physicalProperties.pricePerUnit.value
      }
    }
    const compare = variant.price?.compareAtPrice?.amount
    if (compare != null && compare !== '') {
      copy.price.compareAtPrice = { amount: amountStr(compare) }
    }

    const list = variant.choices || []
    copy.choices = list
      .map((c) => {
        if (c.optionChoiceNames?.optionName && c.optionChoiceNames?.choiceName) {
          return {
            optionChoiceNames: {
              optionName: c.optionChoiceNames.optionName,
              choiceName: c.optionChoiceNames.choiceName,
              renderType:
                c.optionChoiceNames.renderType ||
                'TEXT_CHOICES',
            },
          }
        }
        const cid = c.optionChoiceIds?.choiceId
        const oid = c.optionChoiceIds?.optionId
        const hit = cid ? byChoiceId.get(String(cid)) : null
        if (!hit) return null
        return {
          optionChoiceNames: {
            optionName: hit.optionName,
            choiceName: hit.choiceName,
            renderType:
              hit.renderType ||
              (oid ? renderByOption.get(String(oid)) : null) ||
              'TEXT_CHOICES',
          },
        }
      })
      .filter(Boolean)

    return copy
  })
}

export { CURRENCY_FALLBACK, shortWixMessage }
