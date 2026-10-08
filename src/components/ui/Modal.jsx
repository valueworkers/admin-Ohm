import { useEffect } from 'react'
import { FiX } from 'react-icons/fi'

const Modal = ({ open, title, onClose, children, footer, wide = false, xl = false }) => {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  const widthClass = xl ? 'sm:max-w-4xl' : wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <button
        type="button"
        className="sc-modal-backdrop absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="absolute inset-0 flex items-end justify-center p-0 sm:items-start sm:justify-center sm:px-6 sm:pt-[8vh] sm:pb-6">
        <div
          className={`sc-modal-panel relative z-10 flex h-[min(92dvh,920px)] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/15 sm:h-auto sm:max-h-[min(80dvh,820px)] sm:rounded-2xl ${widthClass}`}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
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
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            {children}
          </div>
          {footer ? (
            <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default Modal
