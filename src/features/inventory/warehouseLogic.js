/** Stock allocation & transfer helpers (Stockly-style). */

export const allocationAvailable = (row) =>
  Math.max(0, Number(row?.qty || 0) - Number(row?.reserved || 0))

export const totalAllocated = (allocations, productId) =>
  allocations
    .filter((a) => a.productId === productId)
    .reduce((s, a) => s + Number(a.qty || 0), 0)

export const upsertAllocation = (allocations, { productId, warehouseId, qty, reserved = 0 }) => {
  const idx = allocations.findIndex(
    (a) => a.productId === productId && a.warehouseId === warehouseId
  )
  if (idx >= 0) {
    const next = [...allocations]
    next[idx] = { ...next[idx], qty: Number(qty), reserved: Number(reserved) }
    return next
  }
  return [
    ...allocations,
    {
      id: `alloc-${Date.now()}`,
      productId,
      warehouseId,
      qty: Number(qty),
      reserved: Number(reserved),
    },
  ]
}

export const transferStock = (allocations, { productId, fromWarehouseId, toWarehouseId, qty }) => {
  const q = Number(qty)
  if (!Number.isFinite(q) || q <= 0) return { ok: false, error: 'Invalid quantity', allocations }

  const fromIdx = allocations.findIndex(
    (a) => a.productId === productId && a.warehouseId === fromWarehouseId
  )
  if (fromIdx < 0) return { ok: false, error: 'No stock at source warehouse', allocations }

  const from = allocations[fromIdx]
  const avail = allocationAvailable(from)
  if (q > avail) return { ok: false, error: `Only ${avail} available at source`, allocations }

  let next = allocations.map((a, i) =>
    i === fromIdx ? { ...a, qty: a.qty - q } : a
  )

  next = upsertAllocation(next, {
    productId,
    warehouseId: toWarehouseId,
    qty:
      q +
      Number(
        next.find((a) => a.productId === productId && a.warehouseId === toWarehouseId)?.qty || 0
      ),
    reserved: Number(
      next.find((a) => a.productId === productId && a.warehouseId === toWarehouseId)?.reserved || 0
    ),
  })

  return { ok: true, allocations: next.filter((a) => a.qty > 0) }
}
