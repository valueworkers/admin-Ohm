import { useEffect, useRef, useState } from 'react'
import { FiImage, FiStar, FiTrash2, FiUpload } from 'react-icons/fi'
import {
  deleteCatalogPhoto,
  setCatalogPhotoPrimary,
  uploadCatalogPhoto,
} from '../api/catalog'
import Modal from './ui/Modal'
import StatusBanner from './ui/StatusBanner'
import { apiErrorMessage } from '../utils/errors'
import { btnGhost, btnPrimary, btnSecondary, labelClass } from '../utils/ui'

const ACCEPT = 'image/jpeg,image/jpg,image/png,image/webp'

/**
 * Upload / manage catalog photos after venue or service create (or from row action).
 * Sends entity_type + object_id + image + is_primary (X-Tenant via tenantSlug).
 */
const CatalogPhotosModal = ({
  open,
  onClose,
  tenantSlug,
  entityType,
  objectId,
  title,
  canWrite = true,
  initialPhotos,
}) => {
  const inputRef = useRef(null)
  const [photos, setPhotos] = useState([])

  useEffect(() => {
    if (open) setPhotos(Array.isArray(initialPhotos) ? initialPhotos : [])
  }, [open, initialPhotos])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [isPrimary, setIsPrimary] = useState(true)

  const entityLabel = entityType === 'service' ? 'service' : 'venue'
  const heading = title || `Add photos · ${entityLabel} #${objectId || '—'}`

  const resetAndClose = () => {
    if (busy) return
    setPhotos([])
    setStatus({ type: '', message: '' })
    setIsPrimary(true)
    onClose?.()
  }

  const handleUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !tenantSlug || !objectId) return

    if (!String(ACCEPT).split(',').includes(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      setStatus({ type: 'error', message: 'Use JPG, PNG, or WebP (max 10 MB).' })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setStatus({ type: 'error', message: 'Image must be 10 MB or smaller.' })
      return
    }

    setBusy(true)
    setStatus({ type: '', message: '' })
    try {
      const primary = photos.length === 0 ? true : isPrimary
      const photo = await uploadCatalogPhoto(tenantSlug, {
        entityType,
        objectId,
        image: file,
        isPrimary: primary,
      })
      setPhotos((list) => {
        const next = primary
          ? list.map((p) => ({ ...p, isPrimary: false }))
          : list
        return [{ ...photo, isPrimary: primary || photo.isPrimary }, ...next]
      })
      setIsPrimary(false)
      setStatus({ type: 'success', message: 'Photo uploaded.' })
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not upload photo.') })
    } finally {
      setBusy(false)
    }
  }

  const handleSetPrimary = async (photo) => {
    if (!photo?.id || !tenantSlug || busy) return
    setBusy(true)
    setStatus({ type: '', message: '' })
    try {
      await setCatalogPhotoPrimary(tenantSlug, photo.id)
      setPhotos((list) =>
        list.map((p) => ({ ...p, isPrimary: String(p.id) === String(photo.id) })),
      )
      setStatus({ type: 'success', message: 'Primary photo updated.' })
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not set primary photo.') })
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (photo) => {
    if (!photo?.id || !tenantSlug || busy) return
    setBusy(true)
    setStatus({ type: '', message: '' })
    try {
      await deleteCatalogPhoto(tenantSlug, photo.id)
      setPhotos((list) => list.filter((p) => String(p.id) !== String(photo.id)))
      setStatus({ type: 'success', message: 'Photo deleted.' })
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not delete photo.') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      title={heading}
      onClose={resetAndClose}
      wide
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={resetAndClose} disabled={busy}>
            {photos.length ? 'Done' : 'Skip for now'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <StatusBanner type={status.type} message={status.message} />

        <p className="text-sm text-stone-600">
          Upload images for this {entityLabel}. Requests send{' '}
          <span className="font-medium text-stone-800">entity_type={entityType}</span> and{' '}
          <span className="font-medium text-stone-800">object_id={objectId || '—'}</span>.
        </p>

        {canWrite ? (
          <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-5">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              onChange={handleUpload}
              disabled={busy || !objectId}
            />
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-stone-800">Add a photo</p>
                <p className="mt-0.5 text-xs text-stone-500">JPG, PNG, or WebP · max 10 MB</p>
              </div>
              <button
                type="button"
                className={btnPrimary}
                disabled={busy || !objectId}
                onClick={() => inputRef.current?.click()}
              >
                <FiUpload className="h-4 w-4" aria-hidden />
                {busy ? 'Uploading…' : 'Choose image'}
              </button>
            </div>
            {photos.length > 0 ? (
              <label className="mt-3 inline-flex items-center gap-2 text-xs text-stone-600">
                <input
                  type="checkbox"
                  className="accent-brand-500"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                  disabled={busy}
                />
                Mark next upload as primary
              </label>
            ) : (
              <p className="mt-3 text-xs text-stone-500">First upload is set as primary.</p>
            )}
          </div>
        ) : null}

        {photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-stone-200 bg-white px-4 py-10 text-center">
            <FiImage className="h-8 w-8 text-stone-300" aria-hidden />
            <p className="mt-2 text-sm font-medium text-stone-700">No photos yet</p>
            <p className="mt-1 text-xs text-stone-500">Upload at least one image for this {entityLabel}.</p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {photos.map((photo) => (
              <li
                key={photo.id || photo.url}
                className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm"
              >
                <div className="aspect-[4/3] bg-stone-100">
                  {photo.url ? (
                    <img
                      src={photo.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-stone-400">
                      Uploaded · #{photo.id}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      photo.isPrimary
                        ? 'bg-brand-50 text-brand-800 ring-1 ring-brand-100'
                        : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {photo.isPrimary ? (
                      <>
                        <FiStar className="h-3 w-3" aria-hidden /> Primary
                      </>
                    ) : (
                      'Gallery'
                    )}
                  </span>
                  {canWrite ? (
                    <div className="flex gap-1">
                      {!photo.isPrimary ? (
                        <button
                          type="button"
                          className={btnGhost}
                          disabled={busy}
                          onClick={() => handleSetPrimary(photo)}
                          aria-label="Set as primary"
                        >
                          <FiStar className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={`${btnGhost} text-rose-600 hover:bg-rose-50`}
                        disabled={busy}
                        onClick={() => handleDelete(photo)}
                        aria-label="Delete photo"
                      >
                        <FiTrash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className={labelClass}>
          entity_type · {entityType || '—'} · object_id · {objectId || '—'}
        </p>
      </div>
    </Modal>
  )
}

export default CatalogPhotosModal
