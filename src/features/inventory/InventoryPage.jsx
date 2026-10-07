import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FiCamera,
  FiCheckCircle,
  FiEdit2,
  FiGrid,
  FiInbox,
  FiPackage,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiShoppingCart,
  FiTag,
  FiTruck,
} from 'react-icons/fi'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import StatusBanner from '../../components/ui/StatusBanner'
import { LoadingState, Panel } from '../../components/ui/PageState'
import { useTenants } from '../../hooks/useTenants'
import { btnGhost, btnPrimary, btnSecondary, fieldClass, labelClass } from '../../utils/ui'
import BarcodeLabel from './components/BarcodeLabel'
import Html5Scanner from './components/Html5Scanner'
import QrLabel from './components/QrLabel'
import {
  CategoriesPanel,
  SuppliersPanel,
  WarehousesPanel,
} from './components/StocklyCatalogPanels'
import {
  availableQty,
  findByCode,
  newBarcode,
  statusBadge,
  stockStatus,
} from './helpers'
import {
  loadInventoryState,
  resetInventoryState,
  saveInventoryState,
} from './inventoryStore'

const TABS = [
  { id: 'overview', label: 'Overview', icon: FiPackage },
  { id: 'products', label: 'Products', icon: FiPackage },
  { id: 'categories', label: 'Categories', icon: FiTag },
  { id: 'suppliers', label: 'Suppliers', icon: FiTruck },
  { id: 'warehouses', label: 'Warehouses', icon: FiGrid },
  { id: 'requests', label: 'Demand', icon: FiInbox },
  { id: 'purchase', label: 'Purchase orders', icon: FiShoppingCart },
  { id: 'movements', label: 'Stock ledger', icon: FiCheckCircle },
]

const EMPTY_PRODUCT = {
  name: '',
  sku: '',
  barcode: '',
  categoryId: 'cat-mob',
  category: 'Mobility',
  supplierId: 'sup-1',
  qtyOnHand: '0',
  qtyReserved: '0',
  reorderLevel: '2',
  locationBin: '',
  unit: 'unit',
}

/**
 * Inventory management (Resources).
 * Flow aligned with Stockly (arnobt78 warehouse IMS): categories, suppliers,
 * multi-warehouse allocations, transfers, products + QR/barcode, POs, ledger.
 */
const InventoryPage = () => {
  const { selected } = useTenants()
  const tenantId = selected?.id || 'default'

  const [tab, setTab] = useState('overview')
  const [inventory, setInventory] = useState([])
  const [requests, setRequests] = useState([])
  const [orders, setOrders] = useState([])
  const [movements, setMovements] = useState([])
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [allocations, setAllocations] = useState([])
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [query, setQuery] = useState('')

  const [scanOpen, setScanOpen] = useState(false)
  const [scanDirection, setScanDirection] = useState('OUT')
  const [scanCode, setScanCode] = useState('')
  const [scanQty, setScanQty] = useState('1')
  const [scanNote, setScanNote] = useState('')
  const [useCamera, setUseCamera] = useState(true)
  const scanInputRef = useRef(null)

  const [productOpen, setProductOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT)
  const [labelItem, setLabelItem] = useState(null)

  const [orderOpen, setOrderOpen] = useState(false)
  const [orderForm, setOrderForm] = useState({
    requestId: '',
    supplierId: '',
    itemName: '',
    sku: '',
    barcode: '',
    qty: '1',
  })

  const persist = useCallback(
    (next) => {
      saveInventoryState(tenantId, next)
    },
    [tenantId]
  )

  const hydrate = useCallback(() => {
    setLoading(true)
    const state = loadInventoryState(tenantId)
    setInventory(state.inventory)
    setRequests(state.requests)
    setOrders(state.orders)
    setMovements(state.movements)
    setCategories(state.categories)
    setSuppliers(state.suppliers)
    setWarehouses(state.warehouses)
    setAllocations(state.allocations)
    setTransfers(state.transfers)
    setOrderForm((p) => ({
      ...p,
      supplierId: p.supplierId || state.suppliers[0]?.id || '',
    }))
    setLoading(false)
  }, [tenantId])

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    if (!loading) {
      persist({
        inventory,
        requests,
        orders,
        movements,
        categories,
        suppliers,
        warehouses,
        allocations,
        transfers,
      })
    }
  }, [
    inventory,
    requests,
    orders,
    movements,
    categories,
    suppliers,
    warehouses,
    allocations,
    transfers,
    loading,
    persist,
  ])

  useEffect(() => {
    if (!scanOpen) return undefined
    const t = window.setTimeout(() => scanInputRef.current?.focus(), 80)
    return () => window.clearTimeout(t)
  }, [scanOpen])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return inventory
    return inventory.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.sku.toLowerCase().includes(q) ||
        i.barcode.toLowerCase().includes(q) ||
        String(i.category || '').toLowerCase().includes(q)
    )
  }, [inventory, query])

  const kpis = useMemo(() => {
    const counts = { AVAILABLE: 0, STOCK_LOW: 0, STOCK_OUT: 0 }
    inventory.forEach((i) => {
      const k = stockStatus(i).key
      if (counts[k] != null) counts[k] += 1
    })
    const needPo = requests.filter((r) => r.status === 'NEEDS_SUPPLIER').length
    const openPo = orders.filter((o) => o.status === 'ORDERED').length
    const units = inventory.reduce((s, i) => s + availableQty(i), 0)
    return {
      skus: inventory.length,
      units,
      available: counts.AVAILABLE,
      stockLow: counts.STOCK_LOW,
      stockOut: counts.STOCK_OUT,
      needPo,
      openPo,
      warehouses: warehouses.length,
    }
  }, [inventory, requests, orders, warehouses.length])

  const resetSeed = () => {
    const next = resetInventoryState(tenantId)
    setInventory(next.inventory)
    setRequests(next.requests)
    setOrders(next.orders)
    setMovements(next.movements)
    setCategories(next.categories)
    setSuppliers(next.suppliers)
    setWarehouses(next.warehouses)
    setAllocations(next.allocations)
    setTransfers(next.transfers)
    setStatus({
      type: 'success',
      message: `Reset inventory seed for ${selected?.name || 'tenant'}.`,
    })
  }

  const openScan = (direction) => {
    setScanDirection(direction)
    setScanCode('')
    setScanQty('1')
    setScanNote('')
    setUseCamera(true)
    setScanOpen(true)
    setStatus({ type: '', message: '' })
  }

  const applyMovement = ({ direction, code, qty, note }) => {
    const q = Number(qty)
    if (!code.trim()) {
      setStatus({ type: 'error', message: 'Scan or enter a barcode / SKU / QR value.' })
      return false
    }
    if (!Number.isFinite(q) || q <= 0) {
      setStatus({ type: 'error', message: 'Quantity must be a positive number.' })
      return false
    }

    let item = findByCode(inventory, code)
    let receivedFromSupplier = false

    if (!item && direction === 'IN') {
      const pending = orders.find(
        (o) =>
          o.status === 'ORDERED' &&
          (o.barcode === code || o.sku.toLowerCase() === code.toLowerCase())
      )
      if (pending) {
        const newItem = {
          id: `inv-${Date.now()}`,
          sku: pending.sku,
          barcode: pending.barcode || code,
          name: pending.itemName,
          category: 'Incoming',
          qtyOnHand: q,
          qtyReserved: 0,
          reorderLevel: 1,
          unit: 'unit',
          locationBin: 'RECV',
        }
        setInventory((prev) => [newItem, ...prev])
        setOrders((prev) =>
          prev.map((o) => (o.id === pending.id ? { ...o, status: 'RECEIVED' } : o))
        )
        setRequests((prev) =>
          prev.map((r) =>
            r.id === pending.linkedRequestId ? { ...r, status: 'FULFILLABLE' } : r
          )
        )
        item = newItem
        receivedFromSupplier = true
      }
    }

    if (!item) {
      setStatus({
        type: 'error',
        message: `No product match for "${code}". Create a product or PO with that barcode first.`,
      })
      return false
    }

    if (direction === 'OUT') {
      const avail = availableQty(item)
      if (q > avail) {
        setStatus({
          type: 'error',
          message: `Only ${avail} available for ${item.name}. Raise a purchase order if short.`,
        })
        return false
      }
      setInventory((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, qtyOnHand: row.qtyOnHand - q } : row))
      )
    } else if (!receivedFromSupplier) {
      setInventory((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, qtyOnHand: row.qtyOnHand + q } : row))
      )
    }

    setMovements((prev) => [
      {
        id: `mov-${Date.now()}`,
        direction,
        sku: item.sku,
        barcode: item.barcode,
        itemName: item.name,
        qty: q,
        customerName: note.trim() || (direction === 'OUT' ? 'Stock out' : 'Stock in'),
        at: new Date().toISOString(),
      },
      ...prev,
    ])

    setStatus({
      type: 'success',
      message: receivedFromSupplier
        ? `PO received — ${item.name} added to inventory.`
        : `${direction === 'OUT' ? 'Stock out' : 'Stock in'}: ${q} × ${item.name}`,
    })
    return true
  }

  const confirmScan = (e) => {
    e?.preventDefault?.()
    const ok = applyMovement({
      direction: scanDirection,
      code: scanCode,
      qty: scanQty,
      note: scanNote,
    })
    if (ok) {
      setScanOpen(false)
      setTab('movements')
    }
  }

  const openProduct = (row = null) => {
    if (row) {
      setEditing(row)
      setProductForm({
        name: row.name,
        sku: row.sku,
        barcode: row.barcode,
        categoryId: row.categoryId || '',
        category: row.category,
        supplierId: row.supplierId || '',
        qtyOnHand: String(row.qtyOnHand),
        qtyReserved: String(row.qtyReserved || 0),
        reorderLevel: String(row.reorderLevel),
        locationBin: row.locationBin || '',
        unit: row.unit || 'unit',
      })
    } else {
      setEditing(null)
      setProductForm({ ...EMPTY_PRODUCT, barcode: newBarcode(), sku: `SC-${Date.now().toString().slice(-6)}` })
    }
    setProductOpen(true)
  }

  const saveProduct = (e) => {
    e.preventDefault()
    if (!productForm.name.trim() || !productForm.sku.trim() || !productForm.barcode.trim()) {
      setStatus({ type: 'error', message: 'Name, SKU, and barcode are required.' })
      return
    }
    const cat = categories.find((c) => c.id === productForm.categoryId)
    const payload = {
      name: productForm.name.trim(),
      sku: productForm.sku.trim(),
      barcode: productForm.barcode.trim(),
      categoryId: productForm.categoryId || cat?.id || '',
      category: cat?.name || productForm.category.trim() || 'General',
      supplierId: productForm.supplierId || suppliers[0]?.id || '',
      qtyOnHand: Number(productForm.qtyOnHand) || 0,
      qtyReserved: Number(productForm.qtyReserved) || 0,
      reorderLevel: Number(productForm.reorderLevel) || 0,
      locationBin: productForm.locationBin.trim() || '—',
      unit: productForm.unit || 'unit',
    }
    if (editing) {
      setInventory((prev) => prev.map((r) => (r.id === editing.id ? { ...r, ...payload } : r)))
      setStatus({ type: 'success', message: `Updated ${payload.name}.` })
    } else {
      setInventory((prev) => [{ id: `inv-${Date.now()}`, ...payload }, ...prev])
      setStatus({ type: 'success', message: `Added ${payload.name} to inventory.` })
    }
    setProductOpen(false)
    setTab('products')
  }

  const openSupplierOrder = (req) => {
    setOrderForm({
      requestId: req?.id || '',
      supplierId: suppliers[0]?.id || '',
      itemName: req?.itemName || '',
      sku: req?.sku || '',
      barcode: newBarcode(),
      qty: String(req?.qty || 1),
    })
    setOrderOpen(true)
  }

  const saveSupplierOrder = (e) => {
    e.preventDefault()
    if (!orderForm.itemName.trim() || !orderForm.sku.trim() || !orderForm.supplierId) {
      setStatus({ type: 'error', message: 'Item, SKU, and supplier are required.' })
      return
    }
    const qty = Number(orderForm.qty)
    if (!Number.isFinite(qty) || qty <= 0) {
      setStatus({ type: 'error', message: 'Quantity must be positive.' })
      return
    }
    const order = {
      id: `so-${Date.now()}`,
      supplierId: orderForm.supplierId,
      itemName: orderForm.itemName.trim(),
      sku: orderForm.sku.trim(),
      barcode: orderForm.barcode.trim() || orderForm.sku.trim(),
      qty,
      status: 'ORDERED',
      linkedRequestId: orderForm.requestId || null,
      orderedAt: new Date().toISOString(),
    }
    setOrders((prev) => [order, ...prev])
    if (orderForm.requestId) {
      setRequests((prev) =>
        prev.map((r) => (r.id === orderForm.requestId ? { ...r, status: 'ORDERED' } : r))
      )
    }
    setOrderOpen(false)
    setTab('purchase')
    setStatus({
      type: 'success',
      message: `PO placed for ${order.itemName}. Scan barcode ${order.barcode} on receive.`,
    })
  }

  const fulfillFromStock = (req) => {
    const item = inventory.find((i) => i.sku === req.sku)
    if (!item || availableQty(item) < req.qty) {
      setStatus({ type: 'error', message: 'Not enough stock — create a purchase order.' })
      return
    }
    setInventory((prev) =>
      prev.map((row) =>
        row.id === item.id
          ? {
              ...row,
              qtyOnHand: row.qtyOnHand - req.qty,
              qtyReserved: Math.max(0, (row.qtyReserved || 0) - req.qty),
            }
          : row
      )
    )
    setRequests((prev) =>
      prev.map((r) => (r.id === req.id ? { ...r, status: 'FULFILLED' } : r))
    )
    setMovements((prev) => [
      {
        id: `mov-${Date.now()}`,
        direction: 'OUT',
        sku: item.sku,
        barcode: item.barcode,
        itemName: item.name,
        qty: req.qty,
        customerName: req.customerName,
        at: new Date().toISOString(),
      },
      ...prev,
    ])
    setStatus({ type: 'success', message: `Fulfilled ${req.itemName} for ${req.customerName}.` })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Tenant catalog"
        title="Inventory"
        description="Stock for senior-care items booked on the main website. Fulfill from products, raise purchase orders when demand is missing, then scan barcode/QR on stock in and stock out."
        actions={
          <>
            <button type="button" className={btnGhost} onClick={resetSeed}>
              <FiRefreshCw className="h-3.5 w-3.5" aria-hidden />
              Reset seed
            </button>
            <button type="button" className={btnSecondary} onClick={() => openProduct(null)}>
              <FiPlus className="h-4 w-4" aria-hidden />
              Add product
            </button>
            <button type="button" className={btnSecondary} onClick={() => openScan('IN')}>
              <FiCamera className="h-4 w-4" aria-hidden />
              Stock in
            </button>
            <button type="button" className={btnPrimary} onClick={() => openScan('OUT')}>
              <FiCamera className="h-4 w-4" aria-hidden />
              Stock out
            </button>
          </>
        }
      />

      <StatusBanner type={status.type} message={status.message} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        <Panel className="!p-4">
          <p className="text-xs text-slate-500">SKUs</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{kpis.skus}</p>
        </Panel>
        <Panel className="!p-4">
          <p className="text-xs text-slate-500">Available</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{kpis.available}</p>
        </Panel>
        <Panel className="!p-4">
          <p className="text-xs text-slate-500">Stock low</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">{kpis.stockLow}</p>
        </Panel>
        <Panel className="!p-4">
          <p className="text-xs text-slate-500">Stock out</p>
          <p className="mt-1 text-2xl font-bold text-rose-700">{kpis.stockOut}</p>
        </Panel>
        <Panel className="!p-4">
          <p className="text-xs text-slate-500">Units (avail.)</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{kpis.units}</p>
        </Panel>
        <Panel className="!p-4">
          <p className="text-xs text-slate-500">Warehouses</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{kpis.warehouses}</p>
        </Panel>
        <Panel className="!p-4">
          <p className="text-xs text-slate-500">Open POs</p>
          <p className="mt-1 text-2xl font-bold text-sky-700">{kpis.openPo}</p>
        </Panel>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:flex-none ${
              tab === id ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <LoadingState label="Loading inventory…" />
        </div>
      ) : null}

      {!loading && tab === 'overview' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel>
            <h3 className="font-semibold text-slate-900">Low stock watchlist</h3>
            <ul className="mt-3 space-y-2">
              {inventory.filter((i) => stockStatus(i).key !== 'AVAILABLE').length === 0 ? (
                <li className="text-sm text-slate-500">All products above reorder level.</li>
              ) : (
                inventory
                  .filter((i) => stockStatus(i).key !== 'AVAILABLE')
                  .map((i) => {
                    const st = stockStatus(i)
                    return (
                      <li
                        key={i.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-slate-800">{i.name}</span>
                        <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${st.tone}`}>
                          {st.label} · {availableQty(i)}
                        </span>
                      </li>
                    )
                  })
              )}
            </ul>
          </Panel>
          <Panel>
            <h3 className="font-semibold text-slate-900">How this inventory works</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-slate-600">
              <li>Set up categories, suppliers, and warehouses (Stockly catalog).</li>
              <li>Allocate product qty per warehouse; transfer between locations when needed.</li>
              <li>Website demand → fulfill from stock or raise a purchase order.</li>
              <li>Receive goods → stock in (barcode/QR); dispatch → stock out; ledger audit.</li>
            </ol>
          </Panel>
        </div>
      ) : null}

      {!loading && tab === 'categories' ? (
        <CategoriesPanel categories={categories} setCategories={setCategories} />
      ) : null}

      {!loading && tab === 'suppliers' ? (
        <SuppliersPanel suppliers={suppliers} setSuppliers={setSuppliers} />
      ) : null}

      {!loading && tab === 'warehouses' ? (
        <WarehousesPanel
          warehouses={warehouses}
          setWarehouses={setWarehouses}
          inventory={inventory}
          allocations={allocations}
          setAllocations={setAllocations}
          transfers={transfers}
          setTransfers={setTransfers}
          onStatus={setStatus}
        />
      ) : null}

      {!loading && tab === 'products' ? (
        <div className="space-y-3">
          <div className="relative max-w-md">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className={`${fieldClass} pl-9`}
              placeholder="Search name, SKU, barcode, category…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Product</th>
                    <th className="px-4 py-3 font-semibold">SKU / barcode</th>
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 font-semibold">Stock</th>
                    <th className="px-4 py-3 font-semibold">Bin</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const st = stockStatus(item)
                    return (
                      <tr key={item.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs text-slate-800">{item.sku}</div>
                          <div className="font-mono text-[11px] text-slate-500">{item.barcode}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{item.category}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${st.tone}`}>
                            {availableQty(item)} avail
                          </span>
                          <div className="mt-0.5 text-[11px] text-slate-400">
                            on hand {item.qtyOnHand}
                            {item.qtyReserved ? ` · reserved ${item.qtyReserved}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{item.locationBin}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            <button type="button" className={btnGhost} onClick={() => setLabelItem(item)}>
                              Label
                            </button>
                            <button type="button" className={btnGhost} onClick={() => openProduct(item)}>
                              <FiEdit2 className="h-3.5 w-3.5" />
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && tab === 'requests' ? (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{req.itemName}</h3>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${statusBadge(req.status)}`}
                    >
                      {req.status.replaceAll('_', ' ')}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {req.customerName} · qty {req.qty} · needed {req.neededBy}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-slate-500">{req.sku}</p>
                  <p className="mt-1 text-xs text-slate-500">{req.notes}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {req.status === 'FULFILLABLE' ? (
                    <button type="button" className={btnPrimary} onClick={() => fulfillFromStock(req)}>
                      Fulfill from stock
                    </button>
                  ) : null}
                  {req.status === 'NEEDS_SUPPLIER' ? (
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={() => openSupplierOrder(req)}
                    >
                      <FiShoppingCart className="h-4 w-4" />
                      Purchase order
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && tab === 'purchase' ? (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button type="button" className={btnPrimary} onClick={() => openSupplierOrder(null)}>
              <FiPlus className="h-4 w-4" />
              New purchase order
            </button>
          </div>
          {orders.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              No purchase orders yet.
            </p>
          ) : (
            orders.map((order) => {
              const supplier = suppliers.find((s) => s.id === order.supplierId)
              return (
                <div
                  key={order.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{order.itemName}</h3>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${statusBadge(order.status)}`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {supplier?.name || 'Supplier'} · qty {order.qty}
                      {supplier ? ` · ~${supplier.leadDays}d lead` : ''}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-slate-500">
                      {order.sku} · barcode {order.barcode}
                    </p>
                  </div>
                  {order.status === 'ORDERED' ? (
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={() => {
                        setScanDirection('IN')
                        setScanCode(order.barcode)
                        setScanQty(String(order.qty))
                        setScanNote(`PO receive · ${order.sku}`)
                        setScanOpen(true)
                      }}
                    >
                      <FiCamera className="h-4 w-4" />
                      Receive (scan)
                    </button>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      ) : null}

      {!loading && tab === 'movements' ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 font-semibold">Dir</th>
                  <th className="px-4 py-3 font-semibold">Item</th>
                  <th className="px-4 py-3 font-semibold">Code</th>
                  <th className="px-4 py-3 font-semibold">Qty</th>
                  <th className="px-4 py-3 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 text-slate-600">{new Date(m.at).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          m.direction === 'IN' ? 'bg-teal-50 text-teal-800' : 'bg-rose-50 text-rose-800'
                        }`}
                      >
                        {m.direction}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{m.itemName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {m.sku}
                      <br />
                      {m.barcode}
                    </td>
                    <td className="px-4 py-3">{m.qty}</td>
                    <td className="px-4 py-3 text-slate-600">{m.customerName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <Modal
        open={scanOpen}
        title={scanDirection === 'OUT' ? 'Stock out (dispatch)' : 'Stock in (receiving)'}
        onClose={() => setScanOpen(false)}
        wide
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setScanOpen(false)}>
              Cancel
            </button>
            <button type="button" className={btnPrimary} onClick={confirmScan}>
              Confirm {scanDirection === 'OUT' ? 'stock out' : 'stock in'}
            </button>
          </div>
        }
      >
        <form className="space-y-3" onSubmit={confirmScan}>
          <p className="text-sm text-slate-500">
            Try inventory barcode <span className="font-mono">8901001001001</span> (wheelchair).
          </p>
          <div>
            <label className={labelClass} htmlFor="scan-code">
              Barcode / QR / SKU
            </label>
            <input
              id="scan-code"
              ref={scanInputRef}
              className={fieldClass}
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              placeholder="Scan or paste code"
              autoComplete="off"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="scan-qty">
                Quantity
              </label>
              <input
                id="scan-qty"
                type="number"
                min="1"
                className={fieldClass}
                value={scanQty}
                onChange={(e) => setScanQty(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="scan-note">
                Note
              </label>
              <input
                id="scan-note"
                className={fieldClass}
                value={scanNote}
                onChange={(e) => setScanNote(e.target.value)}
                placeholder="Customer / PO"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-600">Live camera</p>
            <button
              type="button"
              className={btnGhost}
              onClick={() => setUseCamera((v) => !v)}
            >
              {useCamera ? 'Hide camera' : 'Show camera'}
            </button>
          </div>
          {useCamera ? (
            <Html5Scanner active={scanOpen && useCamera} onScan={(code) => setScanCode(code)} />
          ) : null}
        </form>
      </Modal>

      <Modal
        open={productOpen}
        title={editing ? 'Edit product' : 'Add product'}
        onClose={() => setProductOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setProductOpen(false)}>
              Cancel
            </button>
            <button type="button" className={btnPrimary} onClick={saveProduct}>
              Save
            </button>
          </div>
        }
      >
        <form className="space-y-3" onSubmit={saveProduct}>
          <div>
            <label className={labelClass}>Name</label>
            <input
              className={fieldClass}
              value={productForm.name}
              onChange={(e) => setProductForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>SKU</label>
              <input
                className={fieldClass}
                value={productForm.sku}
                onChange={(e) => setProductForm((p) => ({ ...p, sku: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>Barcode</label>
              <input
                className={fieldClass}
                value={productForm.barcode}
                onChange={(e) => setProductForm((p) => ({ ...p, barcode: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Category</label>
              <select
                className={fieldClass}
                value={productForm.categoryId}
                onChange={(e) => {
                  const cat = categories.find((c) => c.id === e.target.value)
                  setProductForm((p) => ({
                    ...p,
                    categoryId: e.target.value,
                    category: cat?.name || p.category,
                  }))
                }}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Supplier</label>
              <select
                className={fieldClass}
                value={productForm.supplierId}
                onChange={(e) => setProductForm((p) => ({ ...p, supplierId: e.target.value }))}
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Bin</label>
            <input
              className={fieldClass}
              value={productForm.locationBin}
              onChange={(e) => setProductForm((p) => ({ ...p, locationBin: e.target.value }))}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass}>On hand</label>
              <input
                type="number"
                className={fieldClass}
                value={productForm.qtyOnHand}
                onChange={(e) => setProductForm((p) => ({ ...p, qtyOnHand: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>Reserved</label>
              <input
                type="number"
                className={fieldClass}
                value={productForm.qtyReserved}
                onChange={(e) => setProductForm((p) => ({ ...p, qtyReserved: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>Reorder at</label>
              <input
                type="number"
                className={fieldClass}
                value={productForm.reorderLevel}
                onChange={(e) => setProductForm((p) => ({ ...p, reorderLevel: e.target.value }))}
              />
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={orderOpen}
        title="Purchase order (3rd-party supplier)"
        onClose={() => setOrderOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setOrderOpen(false)}>
              Cancel
            </button>
            <button type="button" className={btnPrimary} onClick={saveSupplierOrder}>
              Place PO
            </button>
          </div>
        }
      >
        <form className="space-y-3" onSubmit={saveSupplierOrder}>
          <div>
            <label className={labelClass}>Supplier</label>
            <select
              className={fieldClass}
              value={orderForm.supplierId}
              onChange={(e) => setOrderForm((p) => ({ ...p, supplierId: e.target.value }))}
            >
              {suppliers.filter((s) => s.active !== false).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (~{s.leadDays}d)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Item name</label>
            <input
              className={fieldClass}
              value={orderForm.itemName}
              onChange={(e) => setOrderForm((p) => ({ ...p, itemName: e.target.value }))}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>SKU</label>
              <input
                className={fieldClass}
                value={orderForm.sku}
                onChange={(e) => setOrderForm((p) => ({ ...p, sku: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>Expected barcode</label>
              <input
                className={fieldClass}
                value={orderForm.barcode}
                onChange={(e) => setOrderForm((p) => ({ ...p, barcode: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Quantity</label>
            <input
              type="number"
              min="1"
              className={fieldClass}
              value={orderForm.qty}
              onChange={(e) => setOrderForm((p) => ({ ...p, qty: e.target.value }))}
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(labelItem)}
        title={labelItem ? `Label · ${labelItem.name}` : 'Label'}
        onClose={() => setLabelItem(null)}
        wide
      >
        {labelItem ? (
          <div className="flex flex-wrap items-start gap-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">QR</p>
              <QrLabel value={labelItem.barcode || labelItem.sku} size={140} />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Barcode</p>
              <BarcodeLabel value={labelItem.barcode || labelItem.sku} height={56} />
              <p className="font-mono text-xs text-slate-600">
                {labelItem.sku} · {labelItem.barcode}
              </p>
              <p className="text-sm text-slate-500">
                Print or show this label on the physical item for stock in/out scanning.
              </p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

export default InventoryPage
