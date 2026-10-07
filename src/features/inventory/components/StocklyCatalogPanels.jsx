import { useState } from 'react'
import { FiPlus } from 'react-icons/fi'
import Modal from '../../../components/ui/Modal'
import { Panel } from '../../../components/ui/PageState'
import { btnGhost, btnPrimary, btnSecondary, fieldClass, labelClass } from '../../../utils/ui'
import { allocationAvailable, transferStock, upsertAllocation } from '../warehouseLogic'

export const CategoriesPanel = ({ categories, setCategories }) => {
  const [name, setName] = useState('')

  const add = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setCategories((prev) => [
      ...prev,
      { id: `cat-${Date.now()}`, name: name.trim(), active: true },
    ])
    setName('')
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <h3 className="font-semibold text-slate-900">Categories</h3>
        <p className="mt-1 text-sm text-slate-500">Group products (Stockly catalog).</p>
        <ul className="mt-4 space-y-2">
          {categories.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
            >
              <span className="font-medium text-slate-800">{c.name}</span>
              <button
                type="button"
                className={btnGhost}
                onClick={() =>
                  setCategories((prev) =>
                    prev.map((x) => (x.id === c.id ? { ...x, active: !x.active } : x))
                  )
                }
              >
                {c.active ? 'Active' : 'Inactive'}
              </button>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel>
        <h3 className="font-semibold text-slate-900">Add category</h3>
        <form className="mt-3 space-y-3" onSubmit={add}>
          <div>
            <label className={labelClass}>Name</label>
            <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <button type="submit" className={btnPrimary}>
            <FiPlus className="h-4 w-4" />
            Add
          </button>
        </form>
      </Panel>
    </div>
  )
}

export const SuppliersPanel = ({ suppliers, setSuppliers }) => {
  const [form, setForm] = useState({ name: '', email: '', leadDays: '2' })

  const add = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSuppliers((prev) => [
      ...prev,
      {
        id: `sup-${Date.now()}`,
        name: form.name.trim(),
        email: form.email.trim(),
        leadDays: Number(form.leadDays) || 2,
        active: true,
      },
    ])
    setForm({ name: '', email: '', leadDays: '2' })
  }

  return (
    <div className="space-y-4">
      <Panel>
        <h3 className="font-semibold text-slate-900">Suppliers</h3>
        <p className="mt-1 text-sm text-slate-500">3rd-party vendors for purchase orders.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Lead</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="py-2 pr-4 font-medium">{s.name}</td>
                  <td className="py-2 pr-4 text-slate-600">{s.email || '—'}</td>
                  <td className="py-2 pr-4">{s.leadDays}d</td>
                  <td className="py-2">
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() =>
                        setSuppliers((prev) =>
                          prev.map((x) => (x.id === s.id ? { ...x, active: !x.active } : x))
                        )
                      }
                    >
                      {s.active !== false ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel>
        <h3 className="font-semibold text-slate-900">Add supplier</h3>
        <form className="mt-3 grid gap-3 sm:grid-cols-3" onSubmit={add}>
          <div>
            <label className={labelClass}>Name</label>
            <input
              className={fieldClass}
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              className={fieldClass}
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelClass}>Lead days</label>
            <input
              type="number"
              className={fieldClass}
              value={form.leadDays}
              onChange={(e) => setForm((p) => ({ ...p, leadDays: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-3">
            <button type="submit" className={btnPrimary}>
              Add supplier
            </button>
          </div>
        </form>
      </Panel>
    </div>
  )
}

export const WarehousesPanel = ({
  warehouses,
  setWarehouses,
  inventory,
  allocations,
  setAllocations,
  transfers,
  setTransfers,
  onStatus,
}) => {
  const [whForm, setWhForm] = useState({ name: '', type: 'main', address: '' })
  const [allocOpen, setAllocOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [allocForm, setAllocForm] = useState({
    productId: inventory[0]?.id || '',
    warehouseId: warehouses[0]?.id || '',
    qty: '1',
  })
  const [xferForm, setXferForm] = useState({
    productId: inventory[0]?.id || '',
    fromWarehouseId: warehouses[0]?.id || '',
    toWarehouseId: warehouses[1]?.id || warehouses[0]?.id || '',
    qty: '1',
    notes: '',
  })

  const addWarehouse = (e) => {
    e.preventDefault()
    if (!whForm.name.trim()) return
    setWarehouses((prev) => [
      ...prev,
      {
        id: `wh-${Date.now()}`,
        name: whForm.name.trim(),
        type: whForm.type,
        address: whForm.address.trim(),
        active: true,
      },
    ])
    setWhForm({ name: '', type: 'main', address: '' })
  }

  const saveAlloc = (e) => {
    e.preventDefault()
    setAllocations((prev) =>
      upsertAllocation(prev, {
        productId: allocForm.productId,
        warehouseId: allocForm.warehouseId,
        qty: Number(allocForm.qty),
        reserved: Number(
          prev.find(
            (a) =>
              a.productId === allocForm.productId && a.warehouseId === allocForm.warehouseId
          )?.reserved || 0
        ),
      })
    )
    setAllocOpen(false)
    onStatus?.({ type: 'success', message: 'Stock allocation saved.' })
  }

  const doTransfer = (e) => {
    e.preventDefault()
    const result = transferStock(allocations, {
      productId: xferForm.productId,
      fromWarehouseId: xferForm.fromWarehouseId,
      toWarehouseId: xferForm.toWarehouseId,
      qty: xferForm.qty,
    })
    if (!result.ok) {
      onStatus?.({ type: 'error', message: result.error })
      return
    }
    setAllocations(result.allocations)
    const product = inventory.find((p) => p.id === xferForm.productId)
    setTransfers((prev) => [
      {
        id: `xfer-${Date.now()}`,
        productId: xferForm.productId,
        productName: product?.name || 'Product',
        fromWarehouseId: xferForm.fromWarehouseId,
        toWarehouseId: xferForm.toWarehouseId,
        qty: Number(xferForm.qty),
        status: 'completed',
        notes: xferForm.notes,
        at: new Date().toISOString(),
      },
      ...prev,
    ])
    setTransferOpen(false)
    onStatus?.({ type: 'success', message: 'Inter-warehouse transfer completed.' })
  }

  const whName = (id) => warehouses.find((w) => w.id === id)?.name || id

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnSecondary} onClick={() => setAllocOpen(true)}>
          Allocate stock
        </button>
        <button type="button" className={btnSecondary} onClick={() => setTransferOpen(true)}>
          Transfer between warehouses
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {warehouses.map((w) => (
          <Panel key={w.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-slate-900">{w.name}</h3>
                <p className="text-xs uppercase tracking-wide text-slate-500">{w.type}</p>
                <p className="mt-1 text-sm text-slate-600">{w.address || '—'}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                {w.active !== false ? 'Active' : 'Inactive'}
              </span>
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {allocations
                .filter((a) => a.warehouseId === w.id)
                .map((a) => {
                  const p = inventory.find((i) => i.id === a.productId)
                  return (
                    <li key={a.id} className="flex justify-between rounded bg-slate-50 px-2 py-1">
                      <span>{p?.name || a.productId}</span>
                      <span className="font-mono text-xs">
                        {allocationAvailable(a)} / {a.qty}
                      </span>
                    </li>
                  )
                })}
            </ul>
          </Panel>
        ))}
      </div>

      <Panel>
        <h3 className="font-semibold text-slate-900">Add warehouse</h3>
        <form className="mt-3 grid gap-3 sm:grid-cols-3" onSubmit={addWarehouse}>
          <div>
            <label className={labelClass}>Name</label>
            <input
              className={fieldClass}
              value={whForm.name}
              onChange={(e) => setWhForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelClass}>Type</label>
            <select
              className={fieldClass}
              value={whForm.type}
              onChange={(e) => setWhForm((p) => ({ ...p, type: e.target.value }))}
            >
              <option value="main">Main</option>
              <option value="storage">Storage</option>
              <option value="overflow">Overflow</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Address</label>
            <input
              className={fieldClass}
              value={whForm.address}
              onChange={(e) => setWhForm((p) => ({ ...p, address: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-3">
            <button type="submit" className={btnPrimary}>
              Add warehouse
            </button>
          </div>
        </form>
      </Panel>

      {transfers.length > 0 ? (
        <Panel>
          <h3 className="font-semibold text-slate-900">Recent transfers</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {transfers.slice(0, 8).map((t) => (
              <li key={t.id} className="rounded-lg border border-slate-100 px-3 py-2">
                {t.productName}: {t.qty} from {whName(t.fromWarehouseId)} →{' '}
                {whName(t.toWarehouseId)}
                <span className="ml-2 text-xs text-slate-400">
                  {new Date(t.at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Modal open={allocOpen} title="Allocate stock to warehouse" onClose={() => setAllocOpen(false)}>
        <form className="space-y-3" onSubmit={saveAlloc}>
          <div>
            <label className={labelClass}>Product</label>
            <select
              className={fieldClass}
              value={allocForm.productId}
              onChange={(e) => setAllocForm((p) => ({ ...p, productId: e.target.value }))}
            >
              {inventory.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Warehouse</label>
            <select
              className={fieldClass}
              value={allocForm.warehouseId}
              onChange={(e) => setAllocForm((p) => ({ ...p, warehouseId: e.target.value }))}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Quantity at warehouse</label>
            <input
              type="number"
              min="0"
              className={fieldClass}
              value={allocForm.qty}
              onChange={(e) => setAllocForm((p) => ({ ...p, qty: e.target.value }))}
            />
          </div>
          <button type="submit" className={btnPrimary}>
            Save allocation
          </button>
        </form>
      </Modal>

      <Modal
        open={transferOpen}
        title="Transfer stock between warehouses"
        onClose={() => setTransferOpen(false)}
      >
        <form className="space-y-3" onSubmit={doTransfer}>
          <div>
            <label className={labelClass}>Product</label>
            <select
              className={fieldClass}
              value={xferForm.productId}
              onChange={(e) => setXferForm((p) => ({ ...p, productId: e.target.value }))}
            >
              {inventory.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>From</label>
              <select
                className={fieldClass}
                value={xferForm.fromWarehouseId}
                onChange={(e) => setXferForm((p) => ({ ...p, fromWarehouseId: e.target.value }))}
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>To</label>
              <select
                className={fieldClass}
                value={xferForm.toWarehouseId}
                onChange={(e) => setXferForm((p) => ({ ...p, toWarehouseId: e.target.value }))}
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Quantity</label>
            <input
              type="number"
              min="1"
              className={fieldClass}
              value={xferForm.qty}
              onChange={(e) => setXferForm((p) => ({ ...p, qty: e.target.value }))}
            />
          </div>
          <button type="submit" className={btnPrimary}>
            Complete transfer
          </button>
        </form>
      </Modal>
    </div>
  )
}
