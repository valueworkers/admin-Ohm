import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/** QR label for SKU/barcode (Stockly-style product QR). */
const QrLabel = ({ value, size = 96, className = '' }) => {
  const [src, setSrc] = useState('')

  useEffect(() => {
    let alive = true
    if (!value) {
      setSrc('')
      return undefined
    }
    QRCode.toDataURL(String(value), {
      width: size,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (alive) setSrc(url)
      })
      .catch(() => {
        if (alive) setSrc('')
      })
    return () => {
      alive = false
    }
  }, [value, size])

  if (!src) return null
  return (
    <img
      src={src}
      alt={`QR ${value}`}
      width={size}
      height={size}
      className={`rounded border border-slate-200 bg-white ${className}`}
    />
  )
}

export default QrLabel
