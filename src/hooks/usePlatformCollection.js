import { useCallback, useEffect, useState } from 'react'
import {
  listByTenant,
  listCollection,
  removeRow,
  subscribePlatform,
  upsertRow,
} from '../store/platformStore'

export const usePlatformCollection = (collection, tenantId) => {
  const load = useCallback(() => {
    if (tenantId) return listByTenant(collection, tenantId)
    return listCollection(collection)
  }, [collection, tenantId])

  const [rows, setRows] = useState(load)

  useEffect(() => {
    const sync = () => setRows(load())
    sync()
    return subscribePlatform(sync)
  }, [load])

  const save = (row) => upsertRow(collection, { ...row, tenantId: row.tenantId || tenantId })
  const remove = (id) => removeRow(collection, id)

  return { rows, save, remove, reload: () => setRows(load()) }
}
