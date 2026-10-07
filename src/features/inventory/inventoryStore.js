import {
  DUMMY_ALLOCATIONS,
  DUMMY_CATEGORIES,
  DUMMY_INVENTORY,
  DUMMY_MOVEMENTS,
  DUMMY_REQUESTS,
  DUMMY_SUPPLIER_ORDERS,
  DUMMY_TRANSFERS,
  DUMMY_WAREHOUSES,
  SUPPLIERS,
} from '../../data/resourcesDummy'

const keyFor = (tenantId) => `admin_inventory_${tenantId || 'default'}`

const seed = () => ({
  inventory: structuredClone(DUMMY_INVENTORY),
  requests: structuredClone(DUMMY_REQUESTS),
  orders: structuredClone(DUMMY_SUPPLIER_ORDERS),
  movements: structuredClone(DUMMY_MOVEMENTS),
  categories: structuredClone(DUMMY_CATEGORIES),
  suppliers: structuredClone(SUPPLIERS),
  warehouses: structuredClone(DUMMY_WAREHOUSES),
  allocations: structuredClone(DUMMY_ALLOCATIONS),
  transfers: structuredClone(DUMMY_TRANSFERS),
})

export const loadInventoryState = (tenantId) => {
  try {
    const raw = localStorage.getItem(keyFor(tenantId))
    if (!raw) return seed()
    const parsed = JSON.parse(raw)
    const base = seed()
    return {
      inventory: Array.isArray(parsed.inventory) ? parsed.inventory : base.inventory,
      requests: Array.isArray(parsed.requests) ? parsed.requests : base.requests,
      orders: Array.isArray(parsed.orders) ? parsed.orders : base.orders,
      movements: Array.isArray(parsed.movements) ? parsed.movements : base.movements,
      categories: Array.isArray(parsed.categories) ? parsed.categories : base.categories,
      suppliers: Array.isArray(parsed.suppliers) ? parsed.suppliers : base.suppliers,
      warehouses: Array.isArray(parsed.warehouses) ? parsed.warehouses : base.warehouses,
      allocations: Array.isArray(parsed.allocations) ? parsed.allocations : base.allocations,
      transfers: Array.isArray(parsed.transfers) ? parsed.transfers : base.transfers,
    }
  } catch {
    return seed()
  }
}

export const saveInventoryState = (tenantId, state) => {
  localStorage.setItem(
    keyFor(tenantId),
    JSON.stringify({
      inventory: state.inventory,
      requests: state.requests,
      orders: state.orders,
      movements: state.movements,
      categories: state.categories,
      suppliers: state.suppliers,
      warehouses: state.warehouses,
      allocations: state.allocations,
      transfers: state.transfers,
    })
  )
}

export const resetInventoryState = (tenantId) => {
  const next = seed()
  saveInventoryState(tenantId, next)
  return next
}
