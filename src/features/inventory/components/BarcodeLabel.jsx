import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

/** Renders a Code128 barcode (jsBarcode — common in retail IMS UIs). */
const BarcodeLabel = ({ value, height = 48, displayValue = true, className = '' }) => {
  const svgRef = useRef(null)

  useEffect(() => {
    if (!svgRef.current || !value) return
    try {
      JsBarcode(svgRef.current, String(value), {
        format: 'CODE128',
        width: 1.6,
        height,
        displayValue,
        fontSize: 12,
        margin: 4,
        background: '#ffffff',
        lineColor: '#0f172a',
      })
    } catch {
      // invalid characters — leave blank
    }
  }, [value, height, displayValue])

  if (!value) return null
  return <svg ref={svgRef} className={`max-w-full ${className}`} />
}

export default BarcodeLabel
