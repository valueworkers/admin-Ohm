import { useEffect, useId, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { FiCamera, FiX } from 'react-icons/fi'

/**
 * Camera barcode/QR scanner via html5-qrcode
 * (standard lib used across open-source inventory apps).
 */
const Html5Scanner = ({ onScan, active = true }) => {
  const reactId = useId().replace(/:/g, '')
  const elementId = `html5-qr-${reactId}`
  const scannerRef = useRef(null)
  const lastRef = useRef('')
  const onScanRef = useRef(onScan)
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)

  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  useEffect(() => {
    if (!active) return undefined

    let cancelled = false
    const scanner = new Html5Qrcode(elementId)
    scannerRef.current = scanner

    const start = async () => {
      setError('')
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 8, qrbox: { width: 220, height: 220 } },
          (decoded) => {
            if (!decoded || decoded === lastRef.current) return
            lastRef.current = decoded
            onScanRef.current?.(decoded)
            window.setTimeout(() => {
              lastRef.current = ''
            }, 1500)
          },
          () => {}
        )
        if (!cancelled) setRunning(true)
      } catch (e) {
        if (!cancelled) {
          setRunning(false)
          setError(
            e?.message?.includes('Permission')
              ? 'Camera permission denied. Allow camera or use a USB scanner / type the code.'
              : 'Could not start camera scanner. Use USB scanner or type the code.'
          )
        }
      }
    }

    start()

    return () => {
      cancelled = true
      const s = scannerRef.current
      scannerRef.current = null
      if (s) {
        s.stop()
          .catch(() => {})
          .finally(() => {
            try {
              s.clear()
            } catch {
              // ignore
            }
          })
      }
      setRunning(false)
    }
  }, [active, elementId])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Camera scanner (html5-qrcode)
        </p>
        {running ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700">
            <FiCamera className="h-3.5 w-3.5" /> Live
          </span>
        ) : null}
      </div>
      <div
        id={elementId}
        className="overflow-hidden rounded-lg border border-slate-200 bg-slate-900 [&_video]:max-h-56 [&_video]:w-full [&_video]:object-cover"
      />
      {error ? (
        <p className="flex items-start gap-1.5 text-xs text-amber-800">
          <FiX className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : (
        <p className="text-xs text-slate-500">
          Point at a barcode or QR on the product label. USB wedge scanners also work in the code
          field.
        </p>
      )}
    </div>
  )
}

export default Html5Scanner
