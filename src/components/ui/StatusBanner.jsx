const STYLES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
}

const StatusBanner = ({ type = 'error', message }) => {
  if (!message) return null
  const styles = STYLES[type] || STYLES.error
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${styles}`} role="status">
      {message}
    </div>
  )
}

export default StatusBanner
