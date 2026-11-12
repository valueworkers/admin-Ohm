import { useCallback, useMemo, useState } from 'react'

const mergeOrder = (saved, defaults) => {
  const def = defaults.map(String)
  const seen = new Set()
  const next = []
  for (const id of Array.isArray(saved) ? saved : []) {
    const key = String(id)
    if (!def.includes(key) || seen.has(key)) continue
    seen.add(key)
    next.push(key)
  }
  for (const id of def) {
    if (!seen.has(id)) next.push(id)
  }
  return next
}

const readStored = (storageKey, defaults) => {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return [...defaults]
    return mergeOrder(JSON.parse(raw), defaults)
  } catch {
    return [...defaults]
  }
}

/** Persist and reorder table column ids (HTML5 drag). */
export const useColumnOrder = (storageKey, defaultIds) => {
  const defaults = useMemo(() => defaultIds.map(String), [defaultIds])
  const [order, setOrder] = useState(() => readStored(storageKey, defaults))

  const syncedOrder = useMemo(() => mergeOrder(order, defaults), [order, defaults])

  const moveColumn = useCallback(
    (fromId, toId) => {
      if (!fromId || !toId || fromId === toId) return
      setOrder((prev) => {
        const base = mergeOrder(prev, defaults)
        const from = base.indexOf(String(fromId))
        const to = base.indexOf(String(toId))
        if (from < 0 || to < 0 || from === to) return base
        const next = [...base]
        next.splice(from, 1)
        next.splice(to, 0, String(fromId))
        try {
          localStorage.setItem(storageKey, JSON.stringify(next))
        } catch {
          // ignore quota
        }
        return next
      })
    },
    [defaults, storageKey],
  )

  const resetOrder = useCallback(() => {
    setOrder([...defaults])
    try {
      localStorage.setItem(storageKey, JSON.stringify(defaults))
    } catch {
      // ignore
    }
  }, [defaults, storageKey])

  return { columnOrder: syncedOrder, moveColumn, resetOrder }
}

export default useColumnOrder
