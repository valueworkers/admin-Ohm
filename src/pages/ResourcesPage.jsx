import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  FiChevronDown,
  FiChevronRight,
  FiEdit2,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
  FiX,
} from 'react-icons/fi'
import {
  CURRENCY_FALLBACK,
  cartesianVariants,
  createProduct,
  deleteProduct,
  formatPriceRange,
  getProduct,
  listProducts,
  updateProduct,
  uploadProductImage,
  variantKey,
} from '../api/products'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/PageState'
import { apiErrorMessage } from '../utils/errors'
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  fieldClass,
  labelClass,
  tableHeadClass,
  tableWrapClass,
} from '../utils/ui'

const NAME_MAX = 80
const DESC_MAX = 16000

const emptyCreate = () => ({
  name: '',
  brand: '',
  plainDescription: '',
  imageUrl: '',
  visible: true,
  compareAtPrice: '',
  hasOptions: false,
  price: '',
  stockQuantity: '',
  defaultPrice: '',
  options: [{ name: 'Size', choices: [] }],
  variantRows: [],
})

const choiceChipInput = (value, onChange, onAdd, disabled) => (
  <div className="flex gap-2">
    <input
      className={fieldClass}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          onAdd()
        }
      }}
      disabled={disabled}
      placeholder="Type a choice (e.g. Small)"
    />
    <button
      type="button"
      className={btnSecondary}
      onClick={onAdd}
      disabled={disabled || !String(value || '').trim()}
    >
      Add
    </button>
  </div>
)

const PriceCell = ({ product, currency }) => {
  const sell = formatPriceRange(product, currency)
  const sym = currency === 'INR' || !currency ? '₹' : `${currency} `
  const compare =
    product.compareAtPrice != null ? `${sym}${product.compareAtPrice}` : ''
  return (
    <span className="inline-flex flex-wrap items-baseline gap-1.5">
      {compare ? (
        <span className="text-stone-400 line-through decoration-stone-400">
          {compare}
        </span>
      ) : null}
      <span className="font-medium text-stone-800">{sell}</span>
    </span>
  )
}

const SkeletonRows = () => (
  <div className="space-y-2 p-4">
    {[1, 2, 3, 4].map((i) => (
      <div
        key={i}
        className="h-14 animate-pulse rounded-lg bg-stone-100"
        aria-hidden
      />
    ))}
  </div>
)

const ResourcesPage = () => {
  const [rows, setRows] = useState([])
  const [currency, setCurrency] = useState(CURRENCY_FALLBACK)
  const [nextCursor, setNextCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState({ type: '', message: '' })
  const [search, setSearch] = useState('')
  const [searchApplied, setSearchApplied] = useState('')

  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const [variantsById, setVariantsById] = useState({})
  const [expandLoading, setExpandLoading] = useState(() => new Set())

  const [modalMode, setModalMode] = useState(null)
  const [form, setForm] = useState(null)
  const [editDetail, setEditDetail] = useState(null)
  const [saving, setSaving] = useState(false)
  const [choiceDrafts, setChoiceDrafts] = useState({})

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  /** Confirm remove variant in edit: { kind: 'existing'|'new', id|key, label } */
  const [variantDeleteTarget, setVariantDeleteTarget] = useState(null)

  const toast = (type, message) => setStatus({ type, message })

  const requestRemoveEditVariant = (variant, kind = 'existing') => {
    const existingCount = (form?.variants || []).length
    const newCount = (form?.newVariantRows || []).length
    if (kind === 'existing' && existingCount <= 1 && newCount === 0) {
      toast('error', 'A product must keep at least one variant.')
      return
    }
    setVariantDeleteTarget({
      kind,
      id: variant.id,
      key: variant.key,
      label: variant.label || 'this variant',
    })
  }

  const confirmRemoveEditVariant = () => {
    if (!variantDeleteTarget) return
    const { kind, id, key, label } = variantDeleteTarget
    if (kind === 'new') {
      setForm((f) => {
        const removed = (f.newVariantRows || []).find((r) => r.key === key)
        const nextNew = (f.newVariantRows || []).filter((r) => r.key !== key)
        // Drop pending choice if no queued rows still use it
        let pending = f.pendingNewChoices || []
        if (removed?.choices?.length) {
          pending = pending.filter((pc) => {
            const stillUsed = nextNew.some((row) =>
              (row.choices || []).some(
                (c) =>
                  c.optionName === pc.optionName &&
                  c.choiceName === pc.choiceName,
              ),
            )
            return stillUsed
          })
        }
        return { ...f, newVariantRows: nextNew, pendingNewChoices: pending }
      })
    } else {
      setForm((f) => ({
        ...f,
        variants: (f.variants || []).filter((v) => String(v.id) !== String(id)),
      }))
    }
    setVariantDeleteTarget(null)
    toast(
      'info',
      `Removed “${label}”. Click Save changes to apply in Wix.`,
    )
  }

  const onPickImage = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploadingImage(true)
    try {
      const uploaded = await uploadProductImage(file)
      if (uploaded?.url || uploaded?.id) {
        setForm((f) => ({
          ...f,
          imageUrl:
            uploaded.url ||
            (uploaded.id
              ? `https://static.wixstatic.com/media/${uploaded.id}`
              : f.imageUrl),
          mediaId: uploaded.id || '',
        }))
        toast('success', 'Image uploaded.')
      } else {
        toast('error', 'Upload finished but no image URL was returned.')
      }
    } catch (err) {
      toast('error', apiErrorMessage(err, 'Could not upload image.'))
    } finally {
      setUploadingImage(false)
    }
  }

  const load = useCallback(async ({ append = false, cursor = '', q } = {}) => {
    const query = q !== undefined ? q : searchApplied
    if (append) setLoadingMore(true)
    else {
      setLoading(true)
      setError('')
    }
    try {
      const data = await listProducts({ cursor, q: query, limit: 50 })
      const list = data?.products || []
      setRows((prev) => (append ? [...prev, ...list] : list))
      if (!append) setVariantsById({})
      setNextCursor(data?.nextCursor || null)
      if (data?.currency) setCurrency(data.currency)
    } catch (err) {
      if (!append) {
        setRows([])
        setError(apiErrorMessage(err, 'Could not load products.'))
      } else {
        toast('error', apiErrorMessage(err, 'Could not load more.'))
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [searchApplied])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    // Server already searched when searchApplied set; keep client filter for empty q soft match
    return rows
  }, [rows])

  const toggleExpand = async (row) => {
    const id = String(row.id)
    if (!row.hasVariants) return
    if (expandedIds.has(id)) {
      setExpandedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      return
    }
    setExpandedIds((prev) => new Set(prev).add(id))
    if (variantsById[id]) return
    setExpandLoading((prev) => new Set(prev).add(id))
    try {
      const detail = await getProduct(id)
      setVariantsById((prev) => ({ ...prev, [id]: detail.variants || [] }))
    } catch (err) {
      toast('error', apiErrorMessage(err, 'Could not load variants.'))
      setExpandedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    } finally {
      setExpandLoading((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const rebuildVariantRows = (options, defaultPrice, prevRows = []) => {
    const combos = cartesianVariants(options)
    const prevMap = new Map(
      (prevRows || []).map((r) => [variantKey(r.choices), r]),
    )
    const fallback = String(defaultPrice ?? '').trim()
    return combos.map((choices) => {
      const key = variantKey(choices)
      const prev = prevMap.get(key)
      const price = String(prev?.price ?? '').trim() || fallback
      return {
        key,
        choices,
        label: choices.map((c) => c.choiceName).join(' / '),
        price,
        compareAtPrice: prev?.compareAtPrice ?? '',
        sku: prev?.sku ?? '',
        visible: prev?.visible !== false,
        stockQuantity: prev?.stockQuantity ?? '',
      }
    })
  }

  const openCreate = () => {
    setModalMode('create')
    setEditDetail(null)
    setForm(emptyCreate())
    setChoiceDrafts({})
    setStatus({ type: '', message: '' })
  }

  const openEdit = async (row) => {
    setModalMode('edit')
    setSaving(true)
    setStatus({ type: '', message: '' })
    try {
      const detail = await getProduct(row.id)
      setEditDetail(detail)
      const simplePrice =
        !detail.hasVariants && detail.variants?.[0]?.price != null
          ? String(detail.variants[0].price)
          : detail.price != null
            ? String(detail.price)
            : ''
      setForm({
        name: detail.name || '',
        brand: detail.brand || '',
        plainDescription: detail.plainDescription || '',
        imageUrl: detail.image || '',
        visible: detail.visible !== false,
        hasOptions: detail.hasVariants,
        price: simplePrice,
        compareAtPrice:
          !detail.hasVariants && detail.variants?.[0]?.compareAtPrice != null
            ? String(detail.variants[0].compareAtPrice)
            : '',
        variants: (detail.variants || []).map((v) => ({
          id: v.id,
          label: (v.choices || []).map((c) => c.choiceName).join(' / ') || 'Default',
          choices: v.choices || [],
          price: v.price != null ? String(v.price) : '',
          compareAtPrice: v.compareAtPrice != null ? String(v.compareAtPrice) : '',
          sku: v.sku || '',
          visible: v.visible !== false,
        })),
        // Convert simple → optioned
        convertToOptions: false,
        defaultPrice: simplePrice,
        options: [{ name: 'Size', choices: [] }],
        variantRows: [],
        // Add-choice UI (existing options only)
        addChoiceOptionName: detail.options?.[0]?.name || '',
        addChoiceName: '',
        addChoicePrice: '',
        newVariantRows: [],
        pendingNewChoices: [],
      })
      setChoiceDrafts({})
    } catch (err) {
      toast('error', apiErrorMessage(err, 'Could not load product.'))
      setModalMode(null)
    } finally {
      setSaving(false)
    }
  }

  const closeModal = () => {
    if (saving) return
    setModalMode(null)
    setForm(null)
    setEditDetail(null)
  }

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const updateCreateOptions = (nextOptions) => {
    setForm((f) => {
      const rows = rebuildVariantRows(
        nextOptions,
        f.defaultPrice,
        f.variantRows,
      )
      return { ...f, options: nextOptions, variantRows: rows }
    })
  }

  const addChoiceChip = (optIndex) => {
    const raw = String(choiceDrafts[optIndex] || '').trim()
    if (!raw) return
    setForm((f) => {
      const options = f.options.map((o, i) => {
        if (i !== optIndex) return o
        if (o.choices.some((c) => c.toLowerCase() === raw.toLowerCase())) {
          return o
        }
        return { ...o, choices: [...o.choices, raw] }
      })
      const prefill = f.defaultPrice || f.price || ''
      return {
        ...f,
        defaultPrice: prefill,
        options,
        variantRows: rebuildVariantRows(options, prefill, f.variantRows),
      }
    })
    setChoiceDrafts((d) => ({ ...d, [optIndex]: '' }))
  }

  const removeChoiceChip = (optIndex, choiceName) => {
    setForm((f) => {
      const options = f.options.map((o, i) =>
        i === optIndex
          ? { ...o, choices: o.choices.filter((c) => c !== choiceName) }
          : o,
      )
      return {
        ...f,
        options,
        variantRows: rebuildVariantRows(options, f.defaultPrice, f.variantRows),
      }
    })
  }

  const validateCreate = () => {
    const name = String(form.name || '').trim()
    if (!name) return 'Name is required.'
    if (name.length > NAME_MAX) return `Name max ${NAME_MAX} characters.`
    if (String(form.plainDescription || '').length > DESC_MAX) {
      return `Description max ${DESC_MAX} characters.`
    }
    if (!form.hasOptions) {
      if (!String(form.price || '').trim()) return 'Price is required.'
      return ''
    }
    const opts = form.options || []
    if (!opts.length) return 'Add at least one option.'
    const names = opts.map((o) => o.name.trim().toLowerCase())
    if (names.some((n) => !n)) return 'Every option needs a name.'
    if (new Set(names).size !== names.length) return 'Option names must be unique.'
    if (opts.some((o) => !o.choices.length)) {
      return 'Every option needs at least one choice.'
    }
    if ((form.variantRows || []).some((r) => !String(r.price || '').trim())) {
      return 'Every variant needs a price.'
    }
    return ''
  }

  const submitCreate = async (e) => {
    e.preventDefault()
    const errMsg = validateCreate()
    if (errMsg) {
      toast('error', errMsg)
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        brand: form.brand,
        plainDescription: form.plainDescription,
        imageUrl: form.imageUrl,
        mediaId: form.mediaId || undefined,
        visible: form.visible,
        compareAtPrice: form.compareAtPrice,
        hasOptions: form.hasOptions,
      }
      if (!form.hasOptions) {
        payload.price = form.price
        payload.stockQuantity = form.stockQuantity
      } else {
        payload.options = form.options.map((o) => ({
          name: o.name.trim(),
          choices: o.choices,
        }))
        payload.variants = form.variantRows.map((r) => ({
          choices: r.choices,
          price: r.price,
          compareAtPrice: r.compareAtPrice,
          sku: r.sku,
          visible: r.visible,
          stockQuantity: r.stockQuantity,
        }))
      }
      await createProduct(payload)
      toast('success', 'Product created.')
      closeModal()
      await load({ q: searchApplied })
    } catch (err) {
      toast('error', apiErrorMessage(err, 'Could not create product.'))
    } finally {
      setSaving(false)
    }
  }

  const submitEdit = async (e) => {
    e.preventDefault()
    if (!form || !editDetail) return
    const name = String(form.name || '').trim()
    if (!name) {
      toast('error', 'Name is required.')
      return
    }
    if (name.length > NAME_MAX) {
      toast('error', `Name max ${NAME_MAX} characters.`)
      return
    }
    setSaving(true)
    try {
      const payload = {
        name,
        brand: form.brand,
        plainDescription: form.plainDescription,
        visible: form.visible,
      }
      // Only send media when changed (avoids failed re-import on convert)
      if (form.mediaId) {
        payload.mediaId = form.mediaId
      } else if (
        form.imageUrl &&
        String(form.imageUrl) !== String(editDetail.image || '')
      ) {
        payload.imageUrl = form.imageUrl
      }

      if (!editDetail.hasVariants && form.convertToOptions) {
        const opts = (form.options || []).map((o) => ({
          name: String(o.name || '').trim(),
          choices: o.choices || [],
        }))
        if (!opts.length || opts.some((o) => !o.name || !o.choices.length)) {
          toast('error', 'Add option names and at least one choice each.')
          setSaving(false)
          return
        }
        const names = opts.map((o) => o.name.toLowerCase())
        if (new Set(names).size !== names.length) {
          toast('error', 'Option names must be unique.')
          setSaving(false)
          return
        }
        const rows = form.variantRows || []
        if (!rows.length || rows.some((r) => !String(r.price || '').trim())) {
          toast('error', 'Every variant needs a price.')
          setSaving(false)
          return
        }
        payload.convertToOptions = true
        payload.options = opts
        payload.variants = rows.map((r) => ({
          choices: r.choices,
          price: r.price,
          compareAtPrice: r.compareAtPrice,
          sku: r.sku,
          visible: r.visible !== false,
          stockQuantity: r.stockQuantity,
        }))
      } else if (!editDetail.hasVariants) {
        payload.variants = [
          {
            id: editDetail.variants?.[0]?.id,
            price: form.price,
            compareAtPrice: form.compareAtPrice,
            // Keep in sync with product visibility (Wix default variant)
            visible: form.visible !== false,
          },
        ]
      } else {
        const existing = (form.variants || []).map((v) => ({
          id: v.id,
          price: v.price,
          compareAtPrice: v.compareAtPrice,
          sku: v.sku,
          visible: v.visible,
          choices: v.choices,
        }))
        const added = (form.newVariantRows || []).map((r) => ({
          price: r.price,
          compareAtPrice: r.compareAtPrice,
          sku: r.sku,
          visible: r.visible !== false,
          choices: r.choices,
          stockQuantity: r.stockQuantity,
        }))
        if (!existing.length && !added.length) {
          toast('error', 'A product must keep at least one variant.')
          setSaving(false)
          return
        }
        payload.variants = [...existing, ...added]
        // pendingNewChoices is set when user clicks "Generate new variant rows"
        if (Array.isArray(form.pendingNewChoices) && form.pendingNewChoices.length) {
          payload.newChoices = form.pendingNewChoices
        }
      }

      const updated = await updateProduct(editDetail.id, payload)
      if (updated?.stockWarning) {
        toast(
          'warning',
          `Product saved, but stock failed: ${updated.stockWarning}`,
        )
      } else {
        toast('success', 'Product updated.')
      }
      // Refetch for next revision
      const fresh = await getProduct(editDetail.id)
      setEditDetail(fresh)
      closeModal()
      await load({ q: searchApplied })
    } catch (err) {
      toast('error', apiErrorMessage(err, 'Could not update product.'))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return
    setDeleting(true)
    try {
      await deleteProduct(deleteTarget.id)
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      setDeleteTarget(null)
      toast('success', 'Product deleted.')
    } catch (err) {
      toast('error', apiErrorMessage(err, 'Could not delete product.'))
    } finally {
      setDeleting(false)
    }
  }

  const applySearch = (e) => {
    e?.preventDefault?.()
    setSearchApplied(search.trim())
  }

  const addNewChoiceOnEdit = () => {
    const optionName = String(form.addChoiceOptionName || '').trim()
    const choiceName = String(form.addChoiceName || '').trim()
    if (!optionName || !choiceName) {
      toast('error', 'Pick an option and enter a new choice name.')
      return
    }
    const options = editDetail?.options || []
    const opt = options.find((o) => o.name === optionName)
    if (!opt) return
    const existingChoices = (opt.choicesSettings?.choices || []).map(
      (c) => c.name,
    )
    if (existingChoices.includes(choiceName)) {
      toast('error', 'That choice already exists.')
      return
    }
    const alreadyPending = (form.pendingNewChoices || []).some(
      (c) => c.optionName === optionName && c.choiceName === choiceName,
    )
    if (alreadyPending) {
      toast('error', 'That choice is already queued. Save to apply it.')
      return
    }

    // Other options stay fixed → new rows = cartesian of new choice × other options' choices
    const otherOpts = options.filter((o) => o.name !== optionName)
    const otherCombos =
      otherOpts.length === 0
        ? [[]]
        : cartesianVariants(
            otherOpts.map((o) => ({
              name: o.name,
              choices: (o.choicesSettings?.choices || []).map((c) => c.name),
            })),
          )

    const defaultPrice =
      form.addChoicePrice ||
      form.variants?.[0]?.price ||
      form.price ||
      ''

    const newRows = otherCombos.map((rest) => {
      const choices = [...rest, { optionName, choiceName }]
      // Keep option order matching product.options
      choices.sort((a, b) => {
        const ia = options.findIndex((o) => o.name === a.optionName)
        const ib = options.findIndex((o) => o.name === b.optionName)
        return ia - ib
      })
      return {
        key: variantKey(choices),
        choices,
        label: choices.map((c) => c.choiceName).join(' / '),
        price: defaultPrice,
        compareAtPrice: '',
        sku: '',
        visible: true,
        stockQuantity: '',
      }
    })

    setForm((f) => ({
      ...f,
      newVariantRows: [...(f.newVariantRows || []), ...newRows],
      pendingNewChoices: [
        ...(f.pendingNewChoices || []),
        { optionName, choiceName },
      ],
      addChoiceName: '',
    }))
    toast(
      'info',
      `Queued ${newRows.length} new variant(s) for “${optionName}: ${choiceName}”. Click Save changes.`,
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Wix catalog"
        title="Resources"
        description="Create and manage Wix Stores products (Catalog V3)."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => load({ q: searchApplied })}
              disabled={loading}
            >
              <FiRefreshCw
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                aria-hidden
              />
              Refresh
            </button>
            <button type="button" className={btnPrimary} onClick={openCreate}>
              <FiPlus className="h-4 w-4" aria-hidden />
              Add product
            </button>
          </div>
        }
      />

      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
        onSubmit={applySearch}
      >
        <input
          className={fieldClass}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name"
          aria-label="Search products"
        />
        <button type="submit" className={btnSecondary} disabled={loading}>
          Search
        </button>
      </form>

      <StatusBanner type={status.type} message={status.message} />

      {error ? (
        <ErrorState message={error} onRetry={() => load({ q: searchApplied })} />
      ) : null}
      {!error && loading ? (
        <div className={tableWrapClass}>
          <SkeletonRows />
        </div>
      ) : null}
      {!error && !loading && filtered.length === 0 ? (
        <EmptyState
          title="No products"
          hint="No products in this Wix catalog yet."
          actionLabel="Add product"
          onAction={openCreate}
        />
      ) : null}

      {/* Desktop table */}
      {!error && !loading && filtered.length > 0 ? (
        <>
          <div className={`hidden md:block ${tableWrapClass}`}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className={tableHeadClass}>
                  <tr>
                    <th className="w-10 px-2 py-3" aria-label="Expand" />
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Brand</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filtered.map((row) => {
                    const id = String(row.id)
                    const open = expandedIds.has(id)
                    const loadingV = expandLoading.has(id)
                    const variants = variantsById[id] || []
                    return (
                      <Fragment key={id}>
                        <tr className="hover:bg-stone-50/80">
                          <td className="px-2 py-3">
                            {row.hasVariants ? (
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-brand-50"
                                onClick={() => toggleExpand(row)}
                                aria-expanded={open}
                                aria-label={
                                  open ? 'Collapse variants' : 'Expand variants'
                                }
                                disabled={loadingV}
                              >
                                {loadingV ? (
                                  <FiRefreshCw className="h-3.5 w-3.5 animate-spin" />
                                ) : open ? (
                                  <FiChevronDown className="h-4 w-4" />
                                ) : (
                                  <FiChevronRight className="h-4 w-4" />
                                )}
                              </button>
                            ) : (
                              <span className="inline-block w-8" />
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {row.image ? (
                                <img
                                  src={row.image}
                                  alt=""
                                  className="h-10 w-10 rounded-lg object-cover ring-1 ring-stone-200"
                                />
                              ) : (
                                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-stone-100 text-xs text-stone-400">
                                  —
                                </span>
                              )}
                              <div className="min-w-0">
                                <p className="font-medium text-stone-900">
                                  {row.name}
                                </p>
                                <div className="mt-0.5 flex flex-wrap gap-1">
                                  {row.hasVariants ? (
                                    <span className="inline-flex rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-800">
                                      {row.variantCount || variants.length || '—'}{' '}
                                      variants
                                    </span>
                                  ) : null}
                                  {row.visible === false ? (
                                    <span className="inline-flex rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600">
                                      Hidden
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-stone-600">
                            {row.brand || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <PriceCell product={row} currency={currency} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <span
                                className={`inline-flex w-fit rounded-md px-2 py-0.5 text-xs font-semibold ${
                                  row.visible === false
                                    ? 'bg-stone-100 text-stone-600'
                                    : 'bg-emerald-50 text-emerald-800'
                                }`}
                              >
                                {row.visible === false ? 'Hidden' : 'Visible'}
                              </span>
                              <span
                                className={`inline-flex w-fit rounded-md px-2 py-0.5 text-xs font-semibold ${
                                  row.inStock
                                    ? 'bg-emerald-50 text-emerald-800'
                                    : 'bg-stone-100 text-stone-600'
                                }`}
                              >
                                {row.inStock ? 'In stock' : 'Out of stock'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                className={btnGhost}
                                onClick={() => openEdit(row)}
                                aria-label={`Edit ${row.name}`}
                              >
                                <FiEdit2 className="h-3.5 w-3.5" />
                                Edit
                              </button>
                              <button
                                type="button"
                                className={`${btnGhost} text-rose-600`}
                                onClick={() => setDeleteTarget(row)}
                                aria-label={`Delete ${row.name}`}
                              >
                                <FiTrash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {open ? (
                          <tr className="bg-stone-50/90">
                            <td colSpan={6} className="px-4 py-3">
                              {loadingV ? (
                                <p className="pl-10 text-sm text-stone-500">
                                  Loading variants…
                                </p>
                              ) : (
                                <ul className="ml-10 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
                                  {variants.map((v) => {
                                    const label =
                                      (v.choices || [])
                                        .map((c) => c.choiceName)
                                        .join(' / ') || 'Default'
                                    const img =
                                      v.image ||
                                      (v.choices || [])
                                        .map((c) => c.image)
                                        .find(Boolean) ||
                                      ''
                                    return (
                                      <li
                                        key={v.id}
                                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                                      >
                                        <div className="flex min-w-0 items-center gap-2.5">
                                          {img ? (
                                            <img
                                              src={img}
                                              alt=""
                                              className="h-9 w-9 shrink-0 rounded-md object-cover ring-1 ring-stone-200"
                                            />
                                          ) : (
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-stone-100 text-[10px] text-stone-400">
                                              —
                                            </span>
                                          )}
                                          <span className="font-medium text-stone-800">
                                            {label}
                                          </span>
                                        </div>
                                        <span className="text-stone-700">
                                          {v.price != null
                                            ? `₹${v.price}`
                                            : '—'}
                                          {v.compareAtPrice != null ? (
                                            <span className="ml-2 text-stone-400 line-through">
                                              ₹{v.compareAtPrice}
                                            </span>
                                          ) : null}
                                        </span>
                                      </li>
                                    )
                                  })}
                                </ul>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((row) => {
              const id = String(row.id)
              const open = expandedIds.has(id)
              const variants = variantsById[id] || []
              return (
                <div
                  key={id}
                  className="rounded-xl border border-stone-200 bg-white p-4"
                >
                  <div className="flex gap-3">
                    {row.image ? (
                      <img
                        src={row.image}
                        alt=""
                        className="h-14 w-14 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-stone-100 text-stone-400">
                        —
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-stone-900">{row.name}</p>
                      {row.brand ? (
                        <p className="text-xs text-stone-500">{row.brand}</p>
                      ) : null}
                      <div className="mt-1">
                        <PriceCell product={row} currency={currency} />
                      </div>
                      {row.hasVariants ? (
                        <button
                          type="button"
                          className="mt-2 text-xs font-semibold text-brand-800"
                          onClick={() => toggleExpand(row)}
                        >
                          {open ? 'Hide' : 'Show'}{' '}
                          {row.variantCount || ''} variants
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {open ? (
                    <ul className="mt-3 space-y-2 border-t border-stone-100 pt-2 text-sm">
                      {variants.map((v) => {
                        const img =
                          v.image ||
                          (v.choices || []).map((c) => c.image).find(Boolean) ||
                          ''
                        return (
                          <li
                            key={v.id}
                            className="flex items-center justify-between gap-2"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              {img ? (
                                <img
                                  src={img}
                                  alt=""
                                  className="h-8 w-8 shrink-0 rounded-md object-cover ring-1 ring-stone-200"
                                />
                              ) : (
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-stone-100 text-[10px] text-stone-400">
                                  —
                                </span>
                              )}
                              <span className="truncate">
                                {(v.choices || [])
                                  .map((c) => c.choiceName)
                                  .join(' / ')}
                              </span>
                            </div>
                            <span className="shrink-0">
                              {v.price != null ? `₹${v.price}` : '—'}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() => openEdit(row)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={`${btnGhost} text-rose-600`}
                      onClick={() => setDeleteTarget(row)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {nextCursor ? (
            <div className="flex justify-center">
              <button
                type="button"
                className={btnSecondary}
                disabled={loadingMore}
                onClick={() =>
                  load({ append: true, cursor: nextCursor, q: searchApplied })
                }
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {/* Create / Edit modal */}
      <Modal
        open={Boolean(modalMode && form)}
        title={modalMode === 'create' ? 'Add product' : 'Edit product'}
        onClose={closeModal}
        wide
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className={btnSecondary}
              onClick={closeModal}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="product-form"
              className={btnPrimary}
              disabled={saving || uploadingImage}
            >
              {saving
                ? 'Saving…'
                : uploadingImage
                  ? 'Uploading image…'
                  : modalMode === 'create'
                    ? 'Create product'
                    : 'Save changes'}
            </button>
          </div>
        }
      >
        {form ? (
          <form
            id="product-form"
            className="space-y-4 p-4"
            onSubmit={modalMode === 'create' ? submitCreate : submitEdit}
          >
            <label className="block">
              <span className={labelClass}>
                Name <span className="text-rose-600">*</span>
              </span>
              <input
                className={fieldClass}
                value={form.name}
                maxLength={NAME_MAX}
                onChange={(e) => setField('name', e.target.value)}
                disabled={saving}
                required
              />
            </label>
            <label className="block">
              <span className={labelClass}>Brand</span>
              <input
                className={fieldClass}
                value={form.brand}
                onChange={(e) => setField('brand', e.target.value)}
                disabled={saving}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Description (HTML)</span>
              <textarea
                className={`${fieldClass} min-h-[88px] resize-y`}
                value={form.plainDescription}
                maxLength={DESC_MAX}
                onChange={(e) => setField('plainDescription', e.target.value)}
                disabled={saving}
              />
            </label>
            <div className="space-y-2">
              <span className={labelClass}>Main image</span>
              <div className="flex flex-wrap items-start gap-3">
                {form.imageUrl ? (
                  <img
                    src={form.imageUrl}
                    alt=""
                    className="h-20 w-20 rounded-lg object-cover ring-1 ring-stone-200"
                  />
                ) : (
                  <span className="flex h-20 w-20 items-center justify-center rounded-lg bg-stone-100 text-xs text-stone-400">
                    No image
                  </span>
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <label className={`${btnSecondary} cursor-pointer`}>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="sr-only"
                        disabled={saving || uploadingImage}
                        onChange={onPickImage}
                      />
                      {uploadingImage ? 'Uploading…' : 'Upload from computer'}
                    </label>
                    {form.imageUrl ? (
                      <button
                        type="button"
                        className={btnGhost}
                        disabled={saving || uploadingImage}
                        onClick={() =>
                          setForm((f) => ({ ...f, imageUrl: '', mediaId: '' }))
                        }
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-stone-500">
                      Or paste image URL
                    </span>
                    <input
                      className={fieldClass}
                      value={form.imageUrl}
                      onChange={(e) => setField('imageUrl', e.target.value)}
                      disabled={saving || uploadingImage}
                      placeholder="https://"
                    />
                  </label>
                </div>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-stone-300 accent-brand-500"
                checked={form.visible}
                onChange={(e) => setField('visible', e.target.checked)}
                disabled={saving}
              />
              Visible in catalog
            </label>

            {modalMode === 'create' ? (
              <>
                <label className="flex items-center gap-2 text-sm font-medium text-stone-800">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-stone-300 accent-brand-500"
                    checked={form.hasOptions}
                    onChange={(e) => {
                      const on = e.target.checked
                      setForm((f) => ({
                        ...f,
                        hasOptions: on,
                        variantRows: on
                          ? rebuildVariantRows(
                              f.options,
                              f.defaultPrice,
                              f.variantRows,
                            )
                          : [],
                      }))
                    }}
                    disabled={saving}
                  />
                  This product has options (size, type, etc.)
                </label>

                {!form.hasOptions ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block">
                      <span className={labelClass}>Price *</span>
                      <input
                        className={fieldClass}
                        value={form.price}
                        onChange={(e) =>
                          setField(
                            'price',
                            e.target.value.replace(/[^\d.]/g, ''),
                          )
                        }
                        disabled={saving}
                        inputMode="decimal"
                      />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Compare-at</span>
                      <input
                        className={fieldClass}
                        value={form.compareAtPrice}
                        onChange={(e) =>
                          setField(
                            'compareAtPrice',
                            e.target.value.replace(/[^\d.]/g, ''),
                          )
                        }
                        disabled={saving}
                        inputMode="decimal"
                      />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Stock qty</span>
                      <input
                        className={fieldClass}
                        value={form.stockQuantity}
                        onChange={(e) =>
                          setField(
                            'stockQuantity',
                            e.target.value.replace(/[^\d]/g, ''),
                          )
                        }
                        disabled={saving}
                        inputMode="numeric"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <label className="block max-w-xs">
                      <span className={labelClass}>Default price (prefill)</span>
                      <input
                        className={fieldClass}
                        value={form.defaultPrice}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^\d.]/g, '')
                          setForm((f) => ({
                            ...f,
                            defaultPrice: v,
                            variantRows: rebuildVariantRows(
                              f.options,
                              v,
                              f.variantRows.map((r) =>
                                r.price ? r : { ...r, price: v },
                              ),
                            ),
                          }))
                        }}
                        disabled={saving}
                        inputMode="decimal"
                      />
                    </label>

                    {(form.options || []).map((opt, oi) => (
                      <div
                        key={`opt-${oi}`}
                        className="rounded-xl border border-stone-200 p-3"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <input
                            className={fieldClass}
                            value={opt.name}
                            onChange={(e) => {
                              const options = form.options.map((o, i) =>
                                i === oi ? { ...o, name: e.target.value } : o,
                              )
                              updateCreateOptions(options)
                            }}
                            disabled={saving}
                            placeholder="Option name (e.g. Size)"
                          />
                          <button
                            type="button"
                            className={btnGhost}
                            disabled={saving || form.options.length <= 1}
                            onClick={() =>
                              updateCreateOptions(
                                form.options.filter((_, i) => i !== oi),
                              )
                            }
                            aria-label="Remove option"
                          >
                            <FiX className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {opt.choices.map((c) => (
                            <button
                              key={c}
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-800"
                              onClick={() => removeChoiceChip(oi, c)}
                              disabled={saving}
                            >
                              {c}
                              <FiX className="h-3 w-3" aria-hidden />
                            </button>
                          ))}
                        </div>
                        {choiceChipInput(
                          choiceDrafts[oi] || '',
                          (v) =>
                            setChoiceDrafts((d) => ({ ...d, [oi]: v })),
                          () => addChoiceChip(oi),
                          saving,
                        )}
                      </div>
                    ))}

                    {(form.options || []).length < 6 ? (
                      <button
                        type="button"
                        className={btnGhost}
                        disabled={saving}
                        onClick={() =>
                          updateCreateOptions([
                            ...form.options,
                            { name: '', choices: [] },
                          ])
                        }
                      >
                        <FiPlus className="h-3.5 w-3.5" />
                        Add option
                      </button>
                    ) : null}

                    {form.variantRows?.length ? (
                      <div className="overflow-x-auto rounded-xl border border-stone-200">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-stone-50 text-xs uppercase text-stone-500">
                            <tr>
                              <th className="px-3 py-2">Combination</th>
                              <th className="px-3 py-2">Price</th>
                              <th className="px-3 py-2">Compare-at</th>
                              <th className="px-3 py-2">SKU</th>
                              <th className="px-3 py-2">Stock</th>
                              <th className="px-3 py-2">Visible</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100">
                            {form.variantRows.map((r, ri) => (
                              <tr key={r.key}>
                                <td className="px-3 py-2 font-medium">
                                  {r.label}
                                </td>
                                {['price', 'compareAtPrice', 'sku', 'stockQuantity'].map(
                                  (field) => (
                                    <td key={field} className="px-3 py-2">
                                      <input
                                        className={`${fieldClass} max-w-[6.5rem]`}
                                        value={r[field] || ''}
                                        onChange={(e) => {
                                          const val =
                                            field === 'sku'
                                              ? e.target.value
                                              : e.target.value.replace(
                                                  /[^\d.]/g,
                                                  '',
                                                )
                                          setForm((f) => ({
                                            ...f,
                                            variantRows: f.variantRows.map(
                                              (row, i) =>
                                                i === ri
                                                  ? { ...row, [field]: val }
                                                  : row,
                                            ),
                                          }))
                                        }}
                                        disabled={saving}
                                      />
                                    </td>
                                  ),
                                )}
                                <td className="px-3 py-2">
                                  <input
                                    type="checkbox"
                                    checked={r.visible !== false}
                                    onChange={(e) =>
                                      setForm((f) => ({
                                        ...f,
                                        variantRows: f.variantRows.map(
                                          (row, i) =>
                                            i === ri
                                              ? {
                                                  ...row,
                                                  visible: e.target.checked,
                                                }
                                              : row,
                                        ),
                                      }))
                                    }
                                    disabled={saving}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-stone-500">
                        Add choices to generate variant rows.
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : null}

            {modalMode === 'edit' && form && !form.hasOptions ? (
              <div className="space-y-4">
                {!form.convertToOptions ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className={labelClass}>Price</span>
                      <input
                        className={fieldClass}
                        value={form.price}
                        onChange={(e) =>
                          setField(
                            'price',
                            e.target.value.replace(/[^\d.]/g, ''),
                          )
                        }
                        disabled={saving}
                        inputMode="decimal"
                      />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Compare-at</span>
                      <input
                        className={fieldClass}
                        value={form.compareAtPrice}
                        onChange={(e) =>
                          setField(
                            'compareAtPrice',
                            e.target.value.replace(/[^\d.]/g, ''),
                          )
                        }
                        disabled={saving}
                        inputMode="decimal"
                      />
                    </label>
                  </div>
                ) : null}

                <div className="rounded-xl border border-stone-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className={`${labelClass} mb-0`}>Variants</p>
                      <p className="text-xs text-stone-500">
                        {form.convertToOptions
                          ? 'Define options and choices, then save to convert this product.'
                          : 'This product has a single price. Add variants (e.g. Size: S / M / L).'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={btnGhost}
                      disabled={saving}
                      onClick={() => {
                        if (form.convertToOptions) {
                          setForm((f) => ({
                            ...f,
                            convertToOptions: false,
                            variantRows: [],
                            options: [{ name: 'Size', choices: [] }],
                          }))
                          setChoiceDrafts({})
                          return
                        }
                        setForm((f) => ({
                          ...f,
                          convertToOptions: true,
                          defaultPrice: f.price || f.defaultPrice || '',
                          options: [{ name: 'Size', choices: [] }],
                          variantRows: [],
                        }))
                      }}
                    >
                      <FiPlus className="h-3.5 w-3.5" aria-hidden />
                      {form.convertToOptions ? 'Cancel' : 'Add variants'}
                    </button>
                  </div>

                  {form.convertToOptions ? (
                    <div className="mt-3 space-y-4">
                      <label className="block max-w-xs">
                        <span className={labelClass}>Default price (prefill)</span>
                        <input
                          className={fieldClass}
                          value={form.defaultPrice || ''}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^\d.]/g, '')
                            setForm((f) => ({
                              ...f,
                              defaultPrice: v,
                              variantRows: rebuildVariantRows(
                                f.options,
                                v,
                                f.variantRows,
                              ),
                            }))
                          }}
                          disabled={saving}
                          inputMode="decimal"
                        />
                      </label>

                      {(form.options || []).map((opt, oi) => (
                        <div
                          key={`edit-opt-${oi}`}
                          className="rounded-lg border border-stone-200 p-3"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <input
                              className={fieldClass}
                              value={opt.name}
                              onChange={(e) => {
                                const options = form.options.map((o, i) =>
                                  i === oi
                                    ? { ...o, name: e.target.value }
                                    : o,
                                )
                                updateCreateOptions(options)
                              }}
                              disabled={saving}
                              placeholder="Option name (e.g. Size)"
                            />
                            <button
                              type="button"
                              className={btnGhost}
                              disabled={saving || form.options.length <= 1}
                              onClick={() =>
                                updateCreateOptions(
                                  form.options.filter((_, i) => i !== oi),
                                )
                              }
                              aria-label="Remove option"
                            >
                              <FiX className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            {opt.choices.map((c) => (
                              <button
                                key={c}
                                type="button"
                                className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-800"
                                onClick={() => removeChoiceChip(oi, c)}
                                disabled={saving}
                              >
                                {c}
                                <FiX className="h-3 w-3" aria-hidden />
                              </button>
                            ))}
                          </div>
                          {choiceChipInput(
                            choiceDrafts[oi] || '',
                            (v) =>
                              setChoiceDrafts((d) => ({ ...d, [oi]: v })),
                            () => addChoiceChip(oi),
                            saving,
                          )}
                        </div>
                      ))}

                      {(form.options || []).length < 6 ? (
                        <button
                          type="button"
                          className={btnGhost}
                          disabled={saving}
                          onClick={() =>
                            updateCreateOptions([
                              ...form.options,
                              { name: '', choices: [] },
                            ])
                          }
                        >
                          <FiPlus className="h-3.5 w-3.5" />
                          Add option
                        </button>
                      ) : null}

                      {form.variantRows?.length ? (
                        <div className="overflow-x-auto rounded-lg border border-stone-200">
                          <table className="min-w-full text-left text-sm">
                            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
                              <tr>
                                <th className="px-3 py-2">Combination</th>
                                <th className="px-3 py-2">Price</th>
                                <th className="px-3 py-2">Compare-at</th>
                                <th className="px-3 py-2">SKU</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                              {form.variantRows.map((r, ri) => (
                                <tr key={r.key}>
                                  <td className="px-3 py-2 font-medium">
                                    {r.label}
                                  </td>
                                  {['price', 'compareAtPrice', 'sku'].map(
                                    (field) => (
                                      <td key={field} className="px-3 py-2">
                                        <input
                                          className={`${fieldClass} max-w-[6.5rem]`}
                                          value={r[field] || ''}
                                          onChange={(e) => {
                                            const val =
                                              field === 'sku'
                                                ? e.target.value
                                                : e.target.value.replace(
                                                    /[^\d.]/g,
                                                    '',
                                                  )
                                            setForm((f) => ({
                                              ...f,
                                              variantRows: f.variantRows.map(
                                                (row, i) =>
                                                  i === ri
                                                    ? { ...row, [field]: val }
                                                    : row,
                                              ),
                                            }))
                                          }}
                                          disabled={saving}
                                        />
                                      </td>
                                    ),
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-stone-500">
                          Type a choice and press Enter to generate variant rows.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {modalMode === 'edit' && form?.hasOptions ? (
              <div className="space-y-3">
                <p className="text-xs text-stone-500">
                  Options and existing choices are read-only. Rename/delete them
                  in the Wix dashboard (shared customizations). You can add a
                  new choice below.
                </p>
                <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-stone-200 p-3">
                  {(form.variants || []).map((v, vi) => (
                    <div
                      key={v.id || v.label}
                      className="grid gap-2 rounded-lg bg-stone-50 p-2 sm:grid-cols-[minmax(0,1fr)_1fr_1fr_1fr_auto]"
                    >
                      <div className="min-w-0 sm:col-span-5 flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-medium text-stone-800">
                          {v.label}
                        </p>
                        <button
                          type="button"
                          className={`${btnGhost} shrink-0 text-rose-600`}
                          onClick={() => requestRemoveEditVariant(v, 'existing')}
                          disabled={
                            saving ||
                            ((form.variants || []).length <= 1 &&
                              !(form.newVariantRows || []).length)
                          }
                          aria-label={`Delete variant ${v.label}`}
                          title={
                            (form.variants || []).length <= 1 &&
                            !(form.newVariantRows || []).length
                              ? 'Keep at least one variant'
                              : 'Delete variant'
                          }
                        >
                          <FiTrash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                      <label className="block">
                        <span className="mb-1 block text-[11px] text-stone-500">
                          Price
                        </span>
                        <input
                          className={fieldClass}
                          value={v.price}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              variants: f.variants.map((row, i) =>
                                i === vi
                                  ? {
                                      ...row,
                                      price: e.target.value.replace(
                                        /[^\d.]/g,
                                        '',
                                      ),
                                    }
                                  : row,
                              ),
                            }))
                          }
                          disabled={saving}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[11px] text-stone-500">
                          Compare-at
                        </span>
                        <input
                          className={fieldClass}
                          value={v.compareAtPrice}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              variants: f.variants.map((row, i) =>
                                i === vi
                                  ? {
                                      ...row,
                                      compareAtPrice: e.target.value.replace(
                                        /[^\d.]/g,
                                        '',
                                      ),
                                    }
                                  : row,
                              ),
                            }))
                          }
                          disabled={saving}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[11px] text-stone-500">
                          SKU
                        </span>
                        <input
                          className={fieldClass}
                          value={v.sku}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              variants: f.variants.map((row, i) =>
                                i === vi
                                  ? { ...row, sku: e.target.value }
                                  : row,
                              ),
                            }))
                          }
                          disabled={saving}
                        />
                      </label>
                      <label className="flex items-end gap-2 pb-2 text-sm">
                        <input
                          type="checkbox"
                          checked={v.visible !== false}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              variants: f.variants.map((row, i) =>
                                i === vi
                                  ? { ...row, visible: e.target.checked }
                                  : row,
                              ),
                            }))
                          }
                          disabled={saving}
                        />
                        Visible
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-stone-500">
                  Deleted variants are removed in Wix when you save. Keep at least one.
                </p>

                <div className="rounded-xl border border-dashed border-stone-300 p-3">
                  <p className={labelClass}>Add choice to existing option</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <select
                      className={fieldClass}
                      value={form.addChoiceOptionName}
                      onChange={(e) =>
                        setField('addChoiceOptionName', e.target.value)
                      }
                      disabled={saving}
                    >
                      {(editDetail?.options || []).map((o) => (
                        <option key={o.id || o.name} value={o.name}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                    <input
                      className={fieldClass}
                      value={form.addChoiceName}
                      onChange={(e) => setField('addChoiceName', e.target.value)}
                      placeholder="New choice name"
                      disabled={saving}
                    />
                    <input
                      className={fieldClass}
                      value={form.addChoicePrice}
                      onChange={(e) =>
                        setField(
                          'addChoicePrice',
                          e.target.value.replace(/[^\d.]/g, ''),
                        )
                      }
                      placeholder="Default price"
                      disabled={saving}
                    />
                  </div>
                  <button
                    type="button"
                    className={`${btnGhost} mt-2`}
                    onClick={addNewChoiceOnEdit}
                    disabled={saving}
                  >
                    <FiPlus className="h-3.5 w-3.5" />
                    Generate new variant rows
                  </button>
                  {(form.newVariantRows || []).length ? (
                    <ul className="mt-2 space-y-1 text-sm text-stone-700">
                      {form.newVariantRows.map((r) => (
                        <li
                          key={r.key}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="min-w-0 truncate">{r.label}</span>
                          <div className="flex items-center gap-1">
                            <input
                              className={`${fieldClass} max-w-[6rem]`}
                              value={r.price}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  newVariantRows: f.newVariantRows.map((row) =>
                                    row.key === r.key
                                      ? {
                                          ...row,
                                          price: e.target.value.replace(
                                            /[^\d.]/g,
                                            '',
                                          ),
                                        }
                                      : row,
                                  ),
                                }))
                              }
                              disabled={saving}
                            />
                            <button
                              type="button"
                              className={`${btnGhost} text-rose-600`}
                              onClick={() =>
                                requestRemoveEditVariant(r, 'new')
                              }
                              disabled={saving}
                              aria-label={`Remove queued variant ${r.label}`}
                            >
                              <FiTrash2 className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            ) : null}
          </form>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete product?"
        message={
          deleteTarget
            ? `Delete “${deleteTarget.name}”? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        loading={deleting}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={Boolean(variantDeleteTarget)}
        title="Remove variant?"
        message={
          variantDeleteTarget
            ? `Remove “${variantDeleteTarget.label}”? Click Save changes afterward to update Wix.`
            : ''
        }
        confirmLabel="Remove"
        loading={false}
        onClose={() => setVariantDeleteTarget(null)}
        onConfirm={confirmRemoveEditVariant}
      />
    </div>
  )
}

export default ResourcesPage
