/** Stock helpers — patterns from Stockly / typical IMS flows. */

export const availableQty = (item) =>
  Math.max(0, Number(item?.qtyOnHand || 0) - Number(item?.qtyReserved || 0))

/** Product catalog status labels (Stockly: available / stock low / stock out). */
export const stockStatus = (item) => {
  const avail = availableQty(item)
  if (avail <= 0)
    return { key: 'STOCK_OUT', label: 'Stock out', tone: 'bg-rose-50 text-rose-800' }
  if (avail <= Number(item?.reorderLevel || 0))
    return { key: 'STOCK_LOW', label: 'Stock low', tone: 'bg-amber-50 text-amber-900' }
  return { key: 'AVAILABLE', label: 'Available', tone: 'bg-emerald-50 text-emerald-800' }
}

export const findByCode = (inventory, code) => {
  const q = String(code || '').trim().toLowerCase()
  if (!q) return null
  return (
    inventory.find(
      (i) =>
        String(i.barcode || '').toLowerCase() === q ||
        String(i.sku || '').toLowerCase() === q ||
        String(i.name || '').toLowerCase() === q
    ) || null
  )
}

export const statusBadge = (status) => {
  const map = {
    FULFILLABLE: 'bg-emerald-50 text-emerald-800',
    NEEDS_SUPPLIER: 'bg-amber-50 text-amber-900',
    ORDERED: 'bg-sky-50 text-sky-800',
    RECEIVED: 'bg-teal-50 text-teal-800',
    FULFILLED: 'bg-slate-100 text-slate-700',
  }
  return map[status] || 'bg-slate-100 text-slate-700'
}

export const newBarcode = () => `8901${String(Date.now()).slice(-9)}`
