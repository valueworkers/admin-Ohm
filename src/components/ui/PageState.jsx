import { FiAlertTriangle, FiInbox, FiLoader } from 'react-icons/fi'
import { btnPrimary, panelClass } from '../../utils/ui'

export const LoadingState = ({ label = 'Loading…' }) => (
  <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
    <FiLoader className="h-4 w-4 animate-spin" aria-hidden />
    <span>{label}</span>
  </div>
)

export const EmptyState = ({
  title = 'Nothing here yet',
  hint,
  bare = false,
  actionLabel,
  onAction,
}) => (
  <div
    className={`grid place-items-center px-4 py-14 text-center ${
      bare ? '' : 'rounded-xl border border-dashed border-slate-200 bg-white'
    }`}
  >
    <div className="inline-flex rounded-2xl bg-slate-100 p-3.5 text-slate-400 ring-1 ring-slate-200/80">
      <FiInbox className="h-7 w-7" aria-hidden />
    </div>
    <p className="mt-3 font-medium text-slate-800">{title}</p>
    {hint ? <p className="mt-1 max-w-sm text-sm text-slate-500">{hint}</p> : null}
    {actionLabel && onAction ? (
      <button type="button" className={`${btnPrimary} mt-4`} onClick={onAction}>
        {actionLabel}
      </button>
    ) : null}
  </div>
)

export const ErrorState = ({ message, onRetry, bare = false }) => (
  <div
    className={`grid place-items-center px-4 py-14 text-center ${
      bare ? '' : 'rounded-xl border border-rose-200 bg-rose-50'
    }`}
  >
    <FiAlertTriangle className="h-6 w-6 text-rose-600" aria-hidden />
    <p className="mt-3 max-w-md font-medium text-rose-700">{message}</p>
    {onRetry ? (
      <button type="button" onClick={onRetry} className={`${btnPrimary} mt-3`}>
        Retry
      </button>
    ) : null}
  </div>
)

export const Panel = ({ children, className = '' }) => (
  <div className={`${panelClass} ${className}`}>{children}</div>
)
