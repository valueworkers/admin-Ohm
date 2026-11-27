import { useCallback, useMemo, useState } from 'react'

const mergeVisible = (saved, defaults, allIds) => {
  const allowed = new Set(allIds.map(String))
  const def = defaults.map(String).filter((id) => allowed.has(id))
  const next = []
  const seen = new Set()
  for (const id of Array.isArray(saved) ? saved : []) {
    const key = String(id)
    if (!allowed.has(key) || seen.has(key)) continue
    seen.add(key)
    next.push(key)
  }
  if (!next.length) return [...def]
  return next
}

const readStored = (storageKey, defaults, allIds) => {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return [...defaults]
    return mergeVisible(JSON.parse(raw), defaults, allIds)
  } catch {
    return [...defaults]
  }
}

/** Persist which table columns are visible. */
export const useColumnVisibility = (storageKey, allIds, defaultIds = allIds) => {
  const all = useMemo(() => allIds.map(String), [allIds])
  const defaults = useMemo(
    () => defaultIds.map(String).filter((id) => all.includes(id)),
    [defaultIds, all],
  )
  const [visibleIds, setVisibleIds] = useState(() => readStored(storageKey, defaults, all))

  const synced = useMemo(() => mergeVisible(visibleIds, defaults, all), [visibleIds, defaults, all])

  const persist = useCallback(
    (next) => {
      const cleaned = mergeVisible(next, defaults, all)
      setVisibleIds(cleaned)
      try {
        localStorage.setItem(storageKey, JSON.stringify(cleaned))
      } catch {
        // ignore quota
      }
    },
    [all, defaults, storageKey],
  )

  const toggleColumn = useCallback(
    (id, { minVisible = 1 } = {}) => {
      const key = String(id)
      if (!all.includes(key)) return
      const cur = mergeVisible(visibleIds, defaults, all)
      if (cur.includes(key)) {
        if (cur.length <= minVisible) return
        persist(cur.filter((x) => x !== key))
        return
      }
      persist([...cur, key])
    },
    [all, defaults, persist, visibleIds],
  )

  const showAll = useCallback(() => persist(all), [all, persist])
  const showDefault = useCallback(() => persist(defaults), [defaults, persist])

  return {
    visibleIds: synced,
    setVisibleIds: persist,
    toggleColumn,
    showAll,
    showDefault,
  }
}

export default useColumnVisibility
