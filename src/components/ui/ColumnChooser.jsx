import { useEffect, useRef, useState } from 'react'
import { FiColumns } from 'react-icons/fi'
import { btnSecondary } from '../../utils/ui'

/**
 * Dropdown to toggle table column visibility.
 * `columns`: [{ id, label }]
 */
const ColumnChooser = ({
  columns = [],
  visibleIds = [],
  onToggle,
  onShowAll,
  onShowDefault,
  className = '',
}) => {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        className={btnSecondary}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <FiColumns className="h-4 w-4" aria-hidden />
        Column chooser
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-stone-200 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Visible columns
            </p>
            <div className="flex gap-1">
              {onShowAll ? (
                <button
                  type="button"
                  className="text-[11px] font-semibold text-brand-700 hover:underline"
                  onClick={onShowAll}
                >
                  All
                </button>
              ) : null}
              {onShowAll && onShowDefault ? <span className="text-stone-300">·</span> : null}
              {onShowDefault ? (
                <button
                  type="button"
                  className="text-[11px] font-semibold text-brand-700 hover:underline"
                  onClick={onShowDefault}
                >
                  Default
                </button>
              ) : null}
            </div>
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {columns.map((col) => (
              <label
                key={col.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
              >
                <input
                  type="checkbox"
                  className="rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                  checked={visibleIds.includes(col.id)}
                  onChange={() => onToggle?.(col.id)}
                />
                {col.label}
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default ColumnChooser
