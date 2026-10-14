import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { FiX } from 'react-icons/fi'

const Modal = ({ open, title, onClose, children, footer, wide = false, xl = false }) => {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    const prevHtml = document.documentElement.style.overflow
    const prevBody = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.documentElement.style.overflow = prevHtml
      document.body.style.overflow = prevBody
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  const widthClass = xl ? 'sm:max-w-4xl' : wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      <button
        type="button"
        className="sc-modal-backdrop absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-6">
        <div
          className={`sc-modal-panel relative z-10 grid w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/15 ${widthClass}`}
          style={{ maxHeight: 'calc(100dvh - 1.5rem)' }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 transition-all duration-150 hover:bg-slate-100 hover:text-slate-700 active:scale-95"
              aria-label="Close"
            >
              <FiX className="h-4 w-4" />
            </button>
          </div>
          <div className="overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
          {footer ? (
            <div className="border-t border-slate-100 bg-white px-4 py-3">{footer}</div>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default Modal
