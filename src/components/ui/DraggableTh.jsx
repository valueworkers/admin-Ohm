import { useState } from 'react'
import { FiMoreVertical } from 'react-icons/fi'

/**
 * Table header cell with a drag handle to reorder columns.
 * Pass `onReorder(fromId, toId)` from useColumnOrder.moveColumn.
 */
const DraggableTh = ({
  id,
  onReorder,
  className = '',
  children,
  align = 'left',
}) => {
  const [dragging, setDragging] = useState(false)
  const [over, setOver] = useState(false)

  return (
    <th
      className={`px-3 py-3 font-medium sm:px-4 ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${over && !dragging ? 'bg-brand-50' : ''} ${dragging ? 'opacity-60' : ''} ${className}`}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const fromId = e.dataTransfer.getData('text/column-id') || e.dataTransfer.getData('text/plain')
        if (fromId) onReorder?.(fromId, id)
      }}
    >
      <div
        className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : 'justify-start'}`}
      >
        <span
          draggable
          role="button"
          tabIndex={0}
          aria-label={`Drag to reorder ${typeof children === 'string' ? children : 'column'}`}
          title="Drag to reorder"
          className="inline-flex h-7 w-5 shrink-0 cursor-grab items-center justify-center rounded text-stone-400 transition-colors duration-150 hover:bg-stone-100 hover:text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 active:cursor-grabbing"
          onDragStart={(e) => {
            e.dataTransfer.setData('text/column-id', id)
            e.dataTransfer.setData('text/plain', id)
            e.dataTransfer.effectAllowed = 'move'
            setDragging(true)
          }}
          onDragEnd={() => {
            setDragging(false)
            setOver(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') e.preventDefault()
          }}
        >
          <FiMoreVertical className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0">{children}</div>
      </div>
    </th>
  )
}

export default DraggableTh
