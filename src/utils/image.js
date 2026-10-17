const MAX_EDGE = 800
const TARGET_BYTES = 200 * 1024
const START_QUALITY = 0.8

/** Compress an image file for upload (max 800×800, ~200KB, JPEG). */
export async function compressLogo(file) {
  if (!file) return null
  if (!String(file.type || '').startsWith('image/')) {
    throw new Error('Logo must be an image file.')
  }

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close?.()
    throw new Error('Could not process logo image.')
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  let quality = START_QUALITY
  let blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  while (blob && blob.size > TARGET_BYTES && quality > 0.4) {
    quality = Math.round((quality - 0.1) * 10) / 10
    blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  }

  if (!blob) throw new Error('Could not compress logo.')

  const base = String(file.name || 'logo').replace(/\.[^.]+$/, '') || 'logo'
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg' })
}
