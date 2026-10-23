import api from './axiosClient'

const asList = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.resources)) return data.resources
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.products)) return data.products
  if (Array.isArray(data?.data?.items)) return data.data.items
  if (Array.isArray(data?.data?.results)) return data.data.results
  if (Array.isArray(data?.data?.products)) return data.data.products
  return []
}

const imageFromRow = (row = {}) => {
  const media = row.image || row.media || row.cover || row.photo || row.thumbnail
  if (typeof media === 'string') return media
  if (media && typeof media === 'object') {
    // Wix Catalog V3: media.main.image.url
    const main = media.main || media.mainMedia || media
    if (typeof main === 'string') return main
    const img = main?.image || main
    const fromMain = String(img?.url || img?.src || '').trim()
    if (fromMain) return fromMain
    if (Array.isArray(media.items) && media.items[0]) {
      const item = media.items[0]
      return String(item?.image?.url || item?.url || '').trim()
    }
    return String(media.url || media.src || '').trim()
  }
  if (Array.isArray(row.images) && row.images[0]) {
    const first = row.images[0]
    return typeof first === 'string'
      ? first
      : String(first?.url || first?.src || '').trim()
  }
  return ''
}

const formatInrRange = (min, max) => {
  if (min == null || min === '') return ''
  if (max != null && max !== '' && String(min) !== String(max)) {
    return `₹${min} – ₹${max}`
  }
  return `₹${min}`
}

/**
 * Wix pricing:
 * - compareAtPriceRange = list / MRP (show struck)
 * - actualPriceRange = selling price (show next to struck)
 */
export const pricePartsFromRow = (row = {}) => {
  const sellMin = row.actualPriceRange?.minValue?.amount
  const sellMax = row.actualPriceRange?.maxValue?.amount
  const listMin = row.compareAtPriceRange?.minValue?.amount
  const listMax = row.compareAtPriceRange?.maxValue?.amount

  let actual = formatInrRange(sellMin, sellMax)
  let compareAt = formatInrRange(listMin, listMax)

  if (!actual) {
    const amount =
      row.price?.actualPrice?.amount ||
      row.price?.amount ||
      row.priceData?.price
    if (amount != null) actual = `₹${amount}`
  }
  if (!compareAt) {
    const amount = row.price?.compareAtPrice?.amount
    if (amount != null) compareAt = `₹${amount}`
  }

  // Don't strike if same as selling
  if (compareAt && actual && compareAt === actual) compareAt = ''

  return { compareAt, actual, priceLabel: actual || compareAt || '' }
}

const priceFromRow = (row = {}) => pricePartsFromRow(row).priceLabel

const optionsSummary = (options = []) =>
  (Array.isArray(options) ? options : [])
    .map((opt) => {
      const choices = opt?.choicesSettings?.choices || []
      const names = choices.map((c) => c.name || c.key).filter(Boolean)
      if (!opt?.name || !names.length) return ''
      return `${opt.name}: ${names.join(', ')}`
    })
    .filter(Boolean)
    .join(' · ')

const buildOptionChoiceLookup = (options = []) => {
  const byOptionId = new Map()
  const byChoiceId = new Map()
  ;(Array.isArray(options) ? options : []).forEach((opt) => {
    const optionName = opt.name || opt.key || ''
    if (opt.id) byOptionId.set(String(opt.id), optionName)
    ;(opt.choicesSettings?.choices || []).forEach((c) => {
      const choiceId = c.choiceId || c.id
      if (choiceId) {
        byChoiceId.set(String(choiceId), {
          optionName,
          choiceName: c.name || c.key || '',
        })
      }
    })
  })
  return { byOptionId, byChoiceId }
}

/** Read-only variants use `optionChoices`; product variantsInfo uses `choices`. */
const getVariantChoiceList = (variant = {}) => {
  if (Array.isArray(variant.optionChoices) && variant.optionChoices.length) {
    return variant.optionChoices
  }
  if (Array.isArray(variant.choices) && variant.choices.length) {
    return variant.choices
  }
  return []
}

const variantChoiceLabel = (variant = {}, lookup = null) => {
  const choiceList = getVariantChoiceList(variant)
  const parts = choiceList
    .map((c) => {
      let optionName =
        c.optionChoiceNames?.optionName ||
        c.optionName ||
        c.option?.name ||
        ''
      let choiceName =
        c.optionChoiceNames?.choiceName ||
        c.choiceName ||
        c.choice?.name ||
        c.value ||
        c.key ||
        ''

      const choiceId =
        c.choiceId ||
        c.optionChoiceIds?.choiceId ||
        c.connectedOptionChoice?.choiceId ||
        c.id
      const optionId =
        c.optionId ||
        c.optionChoiceIds?.optionId ||
        c.connectedOptionChoice?.optionId

      // Prefer names from product.options (list response) via choiceId
      if (lookup && choiceId && lookup.byChoiceId.has(String(choiceId))) {
        const hit = lookup.byChoiceId.get(String(choiceId))
        optionName = hit.optionName || optionName
        choiceName = hit.choiceName || choiceName
      } else if (lookup && optionId && lookup.byOptionId.has(String(optionId))) {
        optionName = optionName || lookup.byOptionId.get(String(optionId))
      }

      if (optionName && choiceName) return `${optionName}: ${choiceName}`
      return choiceName || optionName || ''
    })
    .filter(Boolean)
  if (parts.length) return parts.join(' · ')
  return variant.sku || 'Variant'
}

/** Flatten Wix variantsInfo (or query-variants rows) into editable price rows. */
export const normalizeVariants = (productOrVariants = {}, productOptions = []) => {
  const rawList = Array.isArray(productOrVariants)
    ? productOrVariants
    : productOrVariants?.variantsInfo?.variants ||
      productOrVariants?.variants ||
      []
  const lookup = buildOptionChoiceLookup(
    productOptions.length
      ? productOptions
      : productOrVariants?.options || [],
  )

  return rawList.map((v) => {
    const nested = {
      ...(v.variant || v),
      // Keep both shapes so labeling works for query-variants + variantsInfo
      optionChoices: v.optionChoices || v.variant?.optionChoices,
      choices: v.choices || v.variant?.choices,
      price: v.price || v.variant?.price || (v.variant || v).price,
      sku: v.sku || v.variant?.sku,
      id: v.variantId || v.variant?.id || v.id || (v.variant || v).id,
    }
    const id = nested.id || nested.variantId || v.variantId || v.id
    const price = nested.price || {}
    const actual = price.actualPrice?.amount ?? price.amount ?? ''
    const compare = price.compareAtPrice?.amount ?? ''
    return {
      id: id != null ? String(id) : '',
      label: variantChoiceLabel(nested, lookup),
      sku: nested.sku || '',
      amount: actual != null ? String(actual) : '',
      compareAtAmount: compare != null && compare !== '' ? String(compare) : '',
      raw: nested,
    }
  })
}

export const normalizeResource = (row = {}) => {
  const id = row.id ?? row._id ?? row.pk ?? null
  const title = String(
    row.title || row.name || row.label || row.resource_name || '',
  ).trim()
  const visible = row.visible
  const stock = String(row.inventory?.availabilityStatus || '').trim()
  const status =
    row.status ||
    row.state ||
    (visible === false
      ? 'hidden'
      : stock
        ? stock.replace(/_/g, ' ').toLowerCase()
        : visible === true
          ? 'active'
          : row.active === false
            ? 'inactive'
            : 'active')

  const brandName =
    (typeof row.brand === 'string' ? row.brand : row.brand?.name) || ''
  const variants = normalizeVariants(row)

  return {
    ...row,
    id,
    revision: row.revision != null ? String(row.revision) : '',
    title: title || (id != null ? String(id) : 'Untitled'),
    description: String(
      row.description || row.plainDescription || row.summary || row.body || '',
    ).trim(),
    status: String(status).trim(),
    visible: visible !== false,
    brand: String(brandName).trim(),
    category: String(
      brandName ||
        row.category ||
        row.productType ||
        row.type ||
        row.resource_type ||
        (Array.isArray(row.categories) && row.categories[0]?.name) ||
        '',
    ).trim(),
    ...pricePartsFromRow(row),
    optionsLabel: optionsSummary(row.options),
    imageUrl: imageFromRow(row),
    variants,
    variantCount:
      variants.length ||
      Number(row.variantSummary?.variantCount || 0) ||
      0,
    source: row.source || 'api',
  }
}

const normalizeWixProduct = (product = {}) =>
  normalizeResource({
    ...product,
    source: 'wix',
    title: product.name || product.title,
    description:
      (typeof product.description === 'string' && product.description) ||
      product.plainDescription ||
      '',
  })

/** True when Resources should hit Wix Stores via the Vite `/wix-api` proxy (local check). */
export const useWixCatalogDirect = () =>
  Boolean(import.meta.env.DEV) &&
  String(import.meta.env.VITE_RESOURCES_FROM_WIX || '').toLowerCase() === 'true'

const parseJsonSafe = async (res) => {
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  return { text, data }
}

const wixRequest = async (path, { method = 'GET', body } = {}) => {
  const res = await fetch(`/wix-api${path}`, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  const { text, data } = await parseJsonSafe(res)
  if (!res.ok) {
    const msg =
      data?.message ||
      data?.errorDescription ||
      data?.error ||
      data?.details?.applicationError?.description ||
      text ||
      `Wix request failed (${res.status})`
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  return data
}

/**
 * Query products from the configured Wix site (Stores Catalog V3) through Vite proxy.
 * Includes hidden products so editors can change visibility.
 */
export const fetchWixCatalogProducts = async () => {
  const data = await wixRequest('/stores/v3/products/query', {
    method: 'POST',
    body: {
      query: {
        cursorPaging: { limit: 100 },
      },
    },
  })
  return asList(data).map(normalizeWixProduct)
}

/** Load variants via read-only query (prices per Size/Type combo). */
export const fetchWixProductVariants = async (productId, productOptions = []) => {
  // query-variants only allows: CURRENCY, MERCHANT_DATA, SUBSCRIPTION_PRICES_INFO,
  // WEIGHT_MEASUREMENT_UNIT_INFO, DISCOUNT_INFO (not VARIANT_OPTION_CHOICE_NAMES).
  const data = await wixRequest('/stores/v3/products/query-variants', {
    method: 'POST',
    body: {
      query: {
        filter: {
          'productData.productId': { $eq: String(productId) },
        },
        cursorPaging: { limit: 100 },
      },
      fields: ['CURRENCY'],
    },
  })
  const list = Array.isArray(data?.variants) ? data.variants : asList(data)
  return normalizeVariants(
    list.map((row) => {
      const nested = row.variant || row
      return {
        ...nested,
        id: row.variantId || nested.variantId || nested.id || row.id,
        variantId: row.variantId || nested.variantId,
        // query-variants uses optionChoices (with optionChoiceIds)
        optionChoices:
          row.optionChoices ||
          nested.optionChoices ||
          row.choices ||
          nested.choices ||
          [],
        choices: row.choices || nested.choices || [],
        price: row.price || nested.price,
        sku: row.sku || nested.sku,
      }
    }),
    productOptions,
  )
}

const withFieldsQuery = (path, fields = []) => {
  if (!fields.length) return path
  const qs = new URLSearchParams()
  fields.forEach((f) => qs.append('fields', f))
  return `${path}?${qs.toString()}`
}

/** GET one product (revision, description, variantsInfo). Query/Search omit variants. */
export const fetchWixProduct = async (productId) => {
  const path = `/stores/v3/products/${encodeURIComponent(productId)}`
  // Catalog V3: request projected fields needed to display + later PATCH variants.
  const fieldSets = [
    [
      'DESCRIPTION',
      'PLAIN_DESCRIPTION',
      'MEDIA_ITEMS_INFO',
      'VARIANT_OPTION_CHOICE_NAMES',
      'MERCHANT_DATA',
      'PRODUCT_CHOICES_MEDIA_REFERENCES',
      'PRODUCT_CHOICES_DISPLAY_IMAGE',
      'CURRENCY',
    ],
    [
      'VARIANT_OPTION_CHOICE_NAMES',
      'MERCHANT_DATA',
      'PRODUCT_CHOICES_MEDIA_REFERENCES',
      'PRODUCT_CHOICES_DISPLAY_IMAGE',
    ],
    ['VARIANT_OPTION_CHOICE_NAMES'],
    [],
  ]
  let product = null
  for (const fields of fieldSets) {
    try {
      const data = await wixRequest(withFieldsQuery(path, fields))
      product = data?.product || data
      break
    } catch {
      // try next field set
    }
  }
  if (!product) throw new Error('Could not load Wix product.')

  let normalized = normalizeWixProduct(product)
  // Prefer Get Product variantsInfo; fall back to query-variants for amounts/labels.
  if (!normalized.variants?.length) {
    try {
      const variants = await fetchWixProductVariants(
        productId,
        product.options || [],
      )
      if (variants.length) {
        normalized = { ...normalized, variants, variantCount: variants.length }
      }
    } catch {
      // keep whatever Get Product returned
    }
  }
  return normalized
}

/** POST /stores/v3/products — create catalog product (single default variant). */
export const createWixProduct = async ({
  name,
  description = '',
  visible = true,
  price = '0.00',
  compareAtPrice = '',
}) => {
  const amount = String(price || '0.00').trim() || '0.00'
  const compare = String(compareAtPrice || '').trim()
  const pricePayload = { actualPrice: { amount } }
  if (compare) pricePayload.compareAtPrice = { amount: compare }

  const product = {
    name: String(name || '').trim(),
    productType: 'PHYSICAL',
    visible: Boolean(visible),
    // Catalog V3: productType PHYSICAL must include physical_properties (can be empty).
    physicalProperties: {},
    variantsInfo: {
      variants: [
        {
          choices: [],
          physicalProperties: {},
          price: pricePayload,
        },
      ],
    },
  }
  const plain = String(description || '').trim()
  if (plain) product.plainDescription = plain

  const data = await wixRequest('/stores/v3/products', {
    method: 'POST',
    body: { product },
  })
  return normalizeWixProduct(data?.product || data)
}

/** Pick defined keys (Catalog V3 update-product-with-options recipe). */
const pickKeys = (source, keys) =>
  Object.fromEntries(
    keys
      .filter((key) => source?.[key] !== undefined)
      .map((key) => [key, structuredClone(source[key])]),
  )

const amountOnly = (value) => ({ amount: String(value?.amount ?? '0') })

/**
 * Writable options for Update Product — keep option/choice ids; omit read-only keys.
 * @see https://dev.wix.com/docs/api-reference/business-solutions/stores/skills/update-product-with-options-catalog-v3
 */
const writableOptionsFromProduct = (options = []) =>
  (Array.isArray(options) ? options : []).map((option) => ({
    ...pickKeys(option, ['id', 'name', 'optionRenderType']),
    choicesSettings: {
      choices: (option.choicesSettings?.choices || []).map((choice) =>
        pickKeys(choice, [
          'choiceId',
          'name',
          'choiceType',
          'colorCode',
          'media',
          'displayImage',
        ]),
      ),
    },
  }))

/**
 * Writable variants from Get Product — retain id/choices/price; strip calculated money.
 * Choices use optionChoiceNames (recipe); fall back to names resolved from optionChoiceIds.
 */
const writableVariantsFromProduct = (variants = [], options = []) => {
  const renderByOptionId = new Map(
    (options || []).map((o) => [String(o.id), o.optionRenderType || 'TEXT_CHOICES']),
  )
  const lookup = buildOptionChoiceLookup(options)

  return (Array.isArray(variants) ? variants : []).map((variant) => {
    const copy = pickKeys(variant, [
      'id',
      'visible',
      'sku',
      'barcode',
      'physicalProperties',
    ])

    const choiceList = getVariantChoiceList(variant)
    copy.choices = choiceList
      .map((choice) => {
        const choiceId = choice.choiceId || choice.optionChoiceIds?.choiceId
        const optionId = choice.optionId || choice.optionChoiceIds?.optionId
        const hit = choiceId ? lookup.byChoiceId.get(String(choiceId)) : null
        const optionName =
          choice.optionChoiceNames?.optionName ||
          hit?.optionName ||
          choice.optionName ||
          ''
        const choiceName =
          choice.optionChoiceNames?.choiceName ||
          hit?.choiceName ||
          choice.choiceName ||
          ''
        const renderType =
          choice.optionChoiceNames?.renderType ||
          (optionId ? renderByOptionId.get(String(optionId)) : null) ||
          'TEXT_CHOICES'
        if (!optionName || !choiceName) return null
        return {
          optionChoiceNames: { optionName, choiceName, renderType },
        }
      })
      .filter(Boolean)

    const priceSrc = variant.price || {}
    copy.price = {
      actualPrice: amountOnly(priceSrc.actualPrice || { amount: '0' }),
    }
    if (priceSrc.compareAtPrice?.amount != null && priceSrc.compareAtPrice.amount !== '') {
      copy.price.compareAtPrice = amountOnly(priceSrc.compareAtPrice)
    }
    if (variant.revenueDetails?.cost) {
      copy.revenueDetails = { cost: amountOnly(variant.revenueDetails.cost) }
    }
    if (variant.digitalProperties) {
      copy.digitalProperties = variant.digitalProperties.digitalFile
        ? { digitalFile: { id: variant.digitalProperties.digitalFile.id } }
        : {}
    }
    if (copy.physicalProperties?.pricePerUnit) {
      delete copy.physicalProperties.pricePerUnit.value
    }
    return copy
  })
}

/** Fields required before any options/variants PATCH (recipe Prepare a Price or SKU Update). */
const PRODUCT_UPDATE_FIELDS = [
  'VARIANT_OPTION_CHOICE_NAMES',
  'MERCHANT_DATA',
  'PRODUCT_CHOICES_MEDIA_REFERENCES',
  'PRODUCT_CHOICES_DISPLAY_IMAGE',
]

/** GET product with revision + variantsInfo (Query/Search omit variants). */
const getWixProductRawForUpdate = async (productId) => {
  const path = `/stores/v3/products/${encodeURIComponent(productId)}`
  const fieldSets = [PRODUCT_UPDATE_FIELDS, ['VARIANT_OPTION_CHOICE_NAMES'], []]
  let lastError = null
  for (const fields of fieldSets) {
    try {
      const data = await wixRequest(withFieldsQuery(path, fields))
      return data?.product || data
    } catch (err) {
      lastError = err
    }
  }
  throw lastError || new Error('Could not load Wix product for update.')
}

/**
 * PATCH /stores/v3/products/:id — Catalog V3 revisioned update.
 * Variant/price saves: Get Product → full options + variantsInfo → PATCH.
 * Description replace uses plainDescription (not RICOS string).
 * @see https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/products-v3/introduction
 * @see https://dev.wix.com/docs/api-reference/business-solutions/stores/skills/update-product-with-options-catalog-v3
 */
export const updateWixProduct = async (
  productId,
  { revision, name, description, visible, variants },
) => {
  const path = `/stores/v3/products/${encodeURIComponent(productId)}`
  const fresh = await getWixProductRawForUpdate(productId)

  const product = {
    id: String(fresh?.id || productId),
    revision: String(fresh?.revision || revision || ''),
  }

  if (name != null && String(name).trim()) {
    product.name = String(name).trim()
  }
  if (visible != null) product.visible = Boolean(visible)
  // Whole-description replace → plainDescription (RICOS `description` only for in-place edits).
  if (description != null && String(description).trim()) {
    product.plainDescription = String(description).trim()
  }

  if (Array.isArray(variants) && variants.length) {
    const isNewVariant = (v) =>
      Boolean(v?.isNew) || String(v?.id || '').startsWith('new-')

    const keepExistingIds = new Set(
      variants
        .filter((v) => v.id && !isNewVariant(v))
        .map((v) => String(v.id)),
    )
    // When the client lists existing variants, omissions are deletions (full-array overwrite).
    const syncExistingList = variants.some((v) => !isNewVariant(v))

    const amountById = new Map(
      variants
        .filter((v) => v.id && !isNewVariant(v))
        .map((v) => [String(v.id), String(v.amount ?? '').trim()]),
    )
    const compareById = new Map(
      variants
        .filter((v) => v.id && !isNewVariant(v))
        .map((v) => [String(v.id), String(v.compareAtAmount ?? '').trim()]),
    )
    const newVariants = variants.filter(isNewVariant)

    let existingRaw = fresh?.variantsInfo?.variants || []
    const optionsRaw = fresh?.options || []

    // Last resort: query-variants never replaces a proper Get Product variantsInfo.
    if (!existingRaw.length) {
      try {
        const fromQuery = await fetchWixProductVariants(productId, optionsRaw)
        existingRaw = fromQuery.map((v) => ({
          id: v.id,
          sku: v.sku,
          visible: true,
          optionChoices: v.raw?.optionChoices || [],
          choices: v.raw?.choices || v.raw?.optionChoices || [],
          price: {
            actualPrice: { amount: v.amount || '0' },
            ...(v.compareAtAmount
              ? { compareAtPrice: { amount: v.compareAtAmount } }
              : {}),
          },
        }))
      } catch {
        existingRaw = []
      }
    }

    if (!existingRaw.length && !newVariants.length) {
      throw new Error(
        'Could not load product variantsInfo. Re-open the product and try again.',
      )
    }

    // Always send complete options (even []) — omitting causes MISSING_OPTIONS_ON_UPDATE_VARIANTS.
    const opts = writableOptionsFromProduct(optionsRaw)

    // Create missing options/choices from new variants (simple → optioned convert).
    newVariants.forEach((nv) => {
      ;(nv.choiceNames || []).forEach((cn) => {
        const optionName = String(cn.optionName || '').trim()
        if (!optionName) return
        let opt = opts.find((o) => o.name === optionName)
        if (!opt) {
          opt = {
            name: optionName,
            optionRenderType: cn.renderType || 'TEXT_CHOICES',
            choicesSettings: { choices: [] },
          }
          opts.push(opt)
        }
        if (!opt.choicesSettings) opt.choicesSettings = { choices: [] }
        const choiceName = String(cn.choiceName || '').trim()
        if (!choiceName) return
        const exists = opt.choicesSettings.choices.some(
          (c) => c.name === choiceName,
        )
        if (!exists) {
          opt.choicesSettings.choices.push({
            name: choiceName,
            choiceType:
              (cn.renderType || opt.optionRenderType) === 'SWATCH_CHOICES'
                ? 'ONE_COLOR'
                : 'CHOICE_TEXT',
          })
        }
      })
    })

    product.options = opts

    let prepared = writableVariantsFromProduct(existingRaw, optionsRaw)
    if (syncExistingList) {
      prepared = prepared.filter((v) => keepExistingIds.has(String(v.id || '')))
    }

    prepared.forEach((v) => {
      const id = String(v.id || '')
      if (amountById.has(id)) {
        const amount = amountById.get(id) || '0'
        v.price = v.price || {}
        v.price.actualPrice = { amount }
      }
      if (compareById.has(id)) {
        const compare = compareById.get(id)
        if (compare) {
          v.price = v.price || { actualPrice: { amount: '0' } }
          v.price.compareAtPrice = { amount: compare }
        } else if (v.price?.compareAtPrice) {
          delete v.price.compareAtPrice
        }
      }
    })

    const created = newVariants.map((nv) => {
      const amount = String(nv.amount ?? '0').trim() || '0'
      const price = { actualPrice: { amount } }
      const compare = String(nv.compareAtAmount ?? '').trim()
      if (compare) price.compareAtPrice = { amount: compare }

      return {
        visible: true,
        price,
        choices: (nv.choiceNames || []).map((cn) => ({
          optionChoiceNames: {
            optionName: cn.optionName,
            choiceName: cn.choiceName,
            renderType: cn.renderType || 'TEXT_CHOICES',
          },
        })),
      }
    })

    // Simple → optioned: do not keep the choice-less default variant.
    const hadNoOptions = !(optionsRaw || []).length
    const converting =
      hadNoOptions && created.length > 0 && opts.length > 0
    if (converting) {
      const firstId = existingRaw[0]?.id
      if (firstId && created[0]) created[0].id = firstId
      product.variantsInfo = { variants: created }
    } else {
      const nextVariants = [...prepared, ...created]
      if (!nextVariants.length) {
        throw new Error('A product must keep at least one variant.')
      }
      product.variantsInfo = { variants: nextVariants }
    }
  }

  const data = await wixRequest(path, {
    method: 'PATCH',
    body: { product },
  })
  return normalizeWixProduct(data?.product || data)
}

/** DELETE /stores/v3/products/:id */
export const deleteWixProduct = async (productId) => {
  await wixRequest(`/stores/v3/products/${encodeURIComponent(productId)}`, {
    method: 'DELETE',
  })
  return true
}

/**
 * GET /api/resources/ — care API proxies Wix for the tenant (production path).
 */
export const fetchResourcesFromCareApi = async ({
  tenantSlug = '',
  tenantId = '',
} = {}) => {
  const params = {}
  if (tenantSlug) params.tenant = tenantSlug
  if (tenantId) params.tenant_id = tenantId
  const { data } = await api.get('api/resources/', { params })
  return asList(data).map(normalizeResource)
}

export const createResourceOnCareApi = async (payload, { tenantSlug = '', tenantId = '' } = {}) => {
  const params = {}
  if (tenantSlug) params.tenant = tenantSlug
  if (tenantId) params.tenant_id = tenantId
  const { data } = await api.post('api/resources/', payload, { params })
  return normalizeResource(data?.data || data)
}

export const updateResourceOnCareApi = async (
  resourceId,
  payload,
  { tenantSlug = '', tenantId = '' } = {},
) => {
  const params = {}
  if (tenantSlug) params.tenant = tenantSlug
  if (tenantId) params.tenant_id = tenantId
  const { data } = await api.patch(`api/resources/${resourceId}/`, payload, { params })
  return normalizeResource(data?.data || data)
}

export const deleteResourceOnCareApi = async (
  resourceId,
  { tenantSlug = '', tenantId = '' } = {},
) => {
  const params = {}
  if (tenantSlug) params.tenant = tenantSlug
  if (tenantId) params.tenant_id = tenantId
  await api.delete(`api/resources/${resourceId}/`, { params })
  return true
}

/** Prefer direct Wix catalog in local check mode; otherwise care API. */
export const fetchResources = async (opts = {}) => {
  if (useWixCatalogDirect()) return fetchWixCatalogProducts()
  return fetchResourcesFromCareApi(opts)
}

export const createResource = async (form, opts = {}) => {
  if (useWixCatalogDirect()) {
    return createWixProduct({
      name: form.title || form.name,
      description: form.description,
      visible: form.visible !== false,
      price: form.price || '0.00',
      compareAtPrice: form.compareAtPrice || form.compareAtAmount || '',
    })
  }
  return createResourceOnCareApi(
    {
      title: form.title || form.name,
      description: form.description,
      status: form.visible === false ? 'hidden' : 'active',
    },
    opts,
  )
}

export const updateResource = async (row, form, opts = {}) => {
  if (useWixCatalogDirect()) {
    const payload = {
      revision: row.revision || form.revision,
      variants: form.variants,
    }
    // Only include when form actually carries them (price-only save omits these).
    if (form.title != null || form.name != null) {
      payload.name = form.title || form.name
    }
    if (form.description != null) payload.description = form.description
    if (form.visible != null) payload.visible = form.visible !== false
    return updateWixProduct(row.id, payload)
  }
  return updateResourceOnCareApi(
    row.id,
    {
      title: form.title || form.name,
      description: form.description,
      status: form.visible === false ? 'hidden' : 'active',
    },
    opts,
  )
}

export const deleteResource = async (row, opts = {}) => {
  if (useWixCatalogDirect()) return deleteWixProduct(row.id)
  return deleteResourceOnCareApi(row.id, opts)
}
