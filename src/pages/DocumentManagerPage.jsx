import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FiArrowLeft,
  FiFileText,
  FiFolder,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiUser,
} from 'react-icons/fi'
import { fetchPatients, patientFullName } from '../api/patients'
import {
  createPatientDocument,
  deletePatientDocument,
  fetchPatientDocuments,
} from '../api/patientDocuments'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/PageState'
import { useAccess } from '../hooks/useAccess'
import { apiErrorMessage } from '../utils/errors'
import { resolveCatalogTenantSlug } from '../utils/tenantHeader'
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  fieldClass,
  labelClass,
  tableHeadClass,
  tableWrapClass,
} from '../utils/ui'

const EMPTY = { patient: '', name: '', document_type: '', files: [] }

const shortDate = (v) => {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime())
    ? String(v).slice(0, 10)
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const fileLabel = (files) => {
  if (!files?.length) return ''
  if (files.length === 1) return files[0].name || '1 file'
  return `${files.length} files selected`
}

const patientLabel = (p) => patientFullName(p) || p?.name || (p?.id ? `Patient #${p.id}` : '—')

const patientIdLabel = (p) => {
  const id = p?.patient_id || p?.id
  return id ? `ID ${id}` : '—'
}

const DocumentManagerPage = () => {
  const access = useAccess()
  const canWrite = access.canWrite
  const tenantSlug = resolveCatalogTenantSlug(access.tenant)

  const [patients, setPatients] = useState([])
  const [patientsLoading, setPatientsLoading] = useState(false)
  const [patientsError, setPatientsError] = useState('')
  const [patientQuery, setPatientQuery] = useState('')
  const [patientSearch, setPatientSearch] = useState('')

  const [titleQuery, setTitleQuery] = useState('')
  const [titleSearch, setTitleSearch] = useState('')
  const [titleHits, setTitleHits] = useState([])
  const [titleLoading, setTitleLoading] = useState(false)

  const [activePatient, setActivePatient] = useState(null)
  const [docs, setDocs] = useState([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [docsError, setDocsError] = useState('')

  const [status, setStatus] = useState({ type: '', message: '' })
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const loadPatients = useCallback(async () => {
    if (!tenantSlug) {
      setPatients([])
      setPatientsError('')
      return
    }
    setPatientsLoading(true)
    setPatientsError('')
    try {
      const { results } = await fetchPatients(tenantSlug, {
        search: patientSearch || undefined,
        pageSize: 100,
        isActive: true,
      })
      setPatients(results)
    } catch (err) {
      setPatients([])
      setPatientsError(apiErrorMessage(err, 'Could not load patient folders.'))
    } finally {
      setPatientsLoading(false)
    }
  }, [tenantSlug, patientSearch])

  useEffect(() => {
    loadPatients()
  }, [loadPatients])

  const loadFolderDocs = useCallback(
    async (patientId) => {
      if (!tenantSlug || !patientId) {
        setDocs([])
        return
      }
      setDocsLoading(true)
      setDocsError('')
      try {
        const { results } = await fetchPatientDocuments(tenantSlug, { patient: patientId })
        setDocs(results)
      } catch (err) {
        setDocs([])
        setDocsError(apiErrorMessage(err, 'Could not load documents.'))
      } finally {
        setDocsLoading(false)
      }
    },
    [tenantSlug],
  )

  useEffect(() => {
    if (!activePatient?.id) {
      setDocs([])
      return
    }
    loadFolderDocs(activePatient.id)
  }, [activePatient?.id, loadFolderDocs])

  useEffect(() => {
    if (!tenantSlug || !titleSearch.trim()) {
      setTitleHits([])
      setTitleLoading(false)
      return undefined
    }
    let alive = true
    setTitleLoading(true)
    const t = window.setTimeout(async () => {
      try {
        const { results } = await fetchPatientDocuments(tenantSlug, {
          search: titleSearch.trim(),
        })
        if (alive) setTitleHits(results)
      } catch {
        if (alive) setTitleHits([])
      } finally {
        if (alive) setTitleLoading(false)
      }
    }, 250)
    return () => {
      alive = false
      window.clearTimeout(t)
    }
  }, [tenantSlug, titleSearch])

  const openFolder = (patient) => {
    setActivePatient(patient)
    setTitleSearch('')
    setTitleQuery('')
    setTitleHits([])
  }

  const closeFolder = () => {
    setActivePatient(null)
    setDocs([])
    setDocsError('')
  }

  const openCreate = (patientId) => {
    setForm({ ...EMPTY, patient: String(patientId || activePatient?.id || '') })
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!tenantSlug) return
    if (!form.patient) {
      setStatus({ type: 'error', message: 'Patient is required.' })
      return
    }
    if (!form.name.trim()) {
      setStatus({ type: 'error', message: 'Document name is required.' })
      return
    }
    if (!form.document_type.trim()) {
      setStatus({ type: 'error', message: 'Document type is required.' })
      return
    }
    if (!form.files?.length) {
      setStatus({ type: 'error', message: 'Upload at least one file.' })
      return
    }
    setSaving(true)
    try {
      await createPatientDocument(tenantSlug, form)
      setStatus({ type: 'success', message: 'Document uploaded.' })
      setModalOpen(false)
      if (activePatient?.id) await loadFolderDocs(activePatient.id)
      if (titleSearch.trim()) {
        const { results } = await fetchPatientDocuments(tenantSlug, {
          search: titleSearch.trim(),
        })
        setTitleHits(results)
      }
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not save document.') })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget || !tenantSlug) return
    setDeleting(true)
    try {
      await deletePatientDocument(tenantSlug, deleteTarget.id)
      setStatus({ type: 'success', message: 'Document deleted.' })
      if (activePatient?.id) await loadFolderDocs(activePatient.id)
      if (titleSearch.trim()) {
        const { results } = await fetchPatientDocuments(tenantSlug, {
          search: titleSearch.trim(),
        })
        setTitleHits(results)
      }
    } catch (err) {
      setStatus({ type: 'error', message: apiErrorMessage(err, 'Could not delete document.') })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const openTitleHit = (doc) => {
    const match =
      patients.find((p) => String(p.id) === String(doc.patient)) ||
      (doc.patient
        ? {
            id: String(doc.patient),
            name: doc.patient_name || `Patient #${doc.patient}`,
            full_name: doc.patient_name || '',
            patient_id: '',
          }
        : null)
    if (match) openFolder(match)
  }

  const folderCountLabel = useMemo(() => {
    const n = patients.length
    if (!n) return '0 folders'
    if (n >= 100) return '100+ folders'
    return `${n} folder${n === 1 ? '' : 's'}`
  }, [patients.length])

  const showingTitleResults = Boolean(titleSearch.trim()) && !activePatient

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={access.tenant?.name || 'Organization'}
        title={
          <span className="inline-flex items-center gap-2">
            <FiFolder className="h-6 w-6 text-brand-500" aria-hidden />
            {activePatient ? patientLabel(activePatient) : 'Patient folders'}
          </span>
        }
        description={
          activePatient
            ? `Documents for ${patientIdLabel(activePatient)} · upload, view, and manage files in this folder.`
            : 'Open a folder to upload, view, and manage documents for that patient.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {activePatient ? (
              <button type="button" className={btnSecondary} onClick={closeFolder}>
                <FiArrowLeft className="h-4 w-4" aria-hidden />
                All folders
              </button>
            ) : (
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
                {folderCountLabel}
              </span>
            )}
            {canWrite && activePatient ? (
              <button
                type="button"
                className={btnPrimary}
                onClick={() => openCreate(activePatient.id)}
                disabled={!tenantSlug}
              >
                <FiPlus className="h-4 w-4" aria-hidden />
                Upload document
              </button>
            ) : null}
            {!canWrite ? (
              <span className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600">
                Read only
              </span>
            ) : null}
          </div>
        }
      />

      {tenantSlug ? (
        <StatusBanner type="info" message={`X-Tenant: ${tenantSlug}`} />
      ) : (
        <StatusBanner
          type="warning"
          message="Select or activate a tenant first so X-Tenant can be sent."
        />
      )}
      <StatusBanner type={status.type} message={status.message} />

      {!activePatient ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-stone-400">
              <FiUser className="h-3.5 w-3.5" aria-hidden />
              Find patient
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="search"
                className={fieldClass}
                placeholder="Name or patient ID — press Enter"
                aria-label="Find patient by name or ID"
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setPatientSearch(patientQuery.trim())
                }}
              />
              <button
                type="button"
                className={btnPrimary}
                onClick={() => setPatientSearch(patientQuery.trim())}
                disabled={!tenantSlug}
              >
                <FiSearch className="h-4 w-4" aria-hidden />
                Search
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-stone-400">
              <FiFileText className="h-3.5 w-3.5" aria-hidden />
              Search by title (all patients)
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="search"
                className={fieldClass}
                placeholder="Search document titles…"
                aria-label="Search document titles across patients"
                value={titleQuery}
                onChange={(e) => setTitleQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setTitleSearch(titleQuery.trim())
                }}
              />
              <button
                type="button"
                className={btnPrimary}
                onClick={() => setTitleSearch(titleQuery.trim())}
                disabled={!tenantSlug}
              >
                <FiSearch className="h-4 w-4" aria-hidden />
                Search
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!tenantSlug ? (
        <EmptyState title="No tenant selected" hint="Folders load once a tenant is selected." />
      ) : activePatient ? (
        <div className={tableWrapClass}>
          {docsLoading ? (
            <LoadingState label="Loading documents…" />
          ) : docsError ? (
            <ErrorState bare message={docsError} onRetry={() => loadFolderDocs(activePatient.id)} />
          ) : docs.length === 0 ? (
            <EmptyState
              bare
              title="No documents in this folder"
              hint={canWrite ? 'Upload the first document for this patient.' : 'Nothing on file.'}
              actionLabel={canWrite ? 'Upload document' : undefined}
              onAction={canWrite ? () => openCreate(activePatient.id) : undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className={tableHeadClass}>
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Files</th>
                    <th className="px-4 py-3">Updated</th>
                    {canWrite ? <th className="px-4 py-3 text-right">Actions</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {docs.map((row) => (
                    <tr key={row.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 font-semibold text-stone-900">
                          <FiFileText className="h-3.5 w-3.5 text-stone-400" aria-hidden />
                          {row.name || row.title || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-stone-600">
                        <span className="line-clamp-2 max-w-[240px]">
                          {row.document_type || row.remarks || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-stone-600">
                        {row.file_count
                          ? `${row.file_count} file${row.file_count === 1 ? '' : 's'}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-stone-600">
                        {shortDate(row.updated_at || row.created_at)}
                      </td>
                      {canWrite ? (
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              className={`${btnGhost} text-rose-600 hover:bg-rose-50`}
                              onClick={() => setDeleteTarget(row)}
                              aria-label={`Delete ${row.name || row.title || 'document'}`}
                            >
                              <FiTrash2 className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : showingTitleResults ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-stone-600">
              Title matches for “{titleSearch}”
            </p>
            <button
              type="button"
              className={btnGhost}
              onClick={() => {
                setTitleSearch('')
                setTitleQuery('')
                setTitleHits([])
              }}
            >
              Clear title search
            </button>
          </div>
          <div className={tableWrapClass}>
            {titleLoading ? (
              <LoadingState label="Searching documents…" />
            ) : titleHits.length === 0 ? (
              <EmptyState bare title="No matching documents" hint="Try another title." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className={tableHeadClass}>
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Patient</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Updated</th>
                      <th className="px-4 py-3 text-right">Open</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {titleHits.map((row) => (
                      <tr key={row.id} className="hover:bg-stone-50">
                        <td className="px-4 py-3 font-semibold text-stone-900">
                          {row.name || row.title || '—'}
                        </td>
                        <td className="px-4 py-3 text-stone-700">
                          {row.patient_name || (row.patient ? `Patient #${row.patient}` : '—')}
                        </td>
                        <td className="px-4 py-3 text-stone-600">
                          {row.document_type || row.remarks || '—'}
                        </td>
                        <td className="px-4 py-3 text-stone-600">
                          {shortDate(row.updated_at || row.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            className={btnSecondary}
                            onClick={() => openTitleHit(row)}
                          >
                            Open folder
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : patientsLoading ? (
        <LoadingState label="Loading patient folders…" />
      ) : patientsError ? (
        <ErrorState message={patientsError} onRetry={loadPatients} />
      ) : patients.length === 0 ? (
        <EmptyState
          title={patientSearch ? 'No matching patients' : 'No patient folders yet'}
          hint={
            patientSearch
              ? 'Try another name or patient ID.'
              : 'Care patients appear here as folders.'
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {patients.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => openFolder(p)}
              className="group flex flex-col items-center rounded-xl border border-stone-200 bg-white px-3 py-5 text-center shadow-sm transition-colors duration-150 hover:border-brand-300 hover:bg-brand-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
            >
              <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-amber-50 text-amber-500 transition-colors group-hover:bg-amber-100">
                <FiFolder className="h-8 w-8" aria-hidden />
              </span>
              <span className="line-clamp-2 text-sm font-semibold text-ink">
                {patientLabel(p)}
              </span>
              <span className="mt-2 inline-flex rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-semibold text-stone-600">
                {patientIdLabel(p)}
              </span>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        title="Upload document"
        onClose={() => setModalOpen(false)}
        wide
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="document-form" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : 'Upload document'}
            </button>
          </div>
        }
      >
        <form id="document-form" className="space-y-3" onSubmit={handleSave}>
          <div>
            <label className={labelClass} htmlFor="doc-patient">
              Patient folder
            </label>
            <input
              id="doc-patient"
              className={fieldClass}
              value={
                activePatient && String(form.patient) === String(activePatient.id)
                  ? `${patientLabel(activePatient)} · ${patientIdLabel(activePatient)}`
                  : form.patient
                    ? `Patient #${form.patient}`
                    : ''
              }
              readOnly
              disabled
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="doc-name">
              Name <span className="text-rose-600">*</span>
            </label>
            <input
              id="doc-name"
              className={fieldClass}
              placeholder="e.g. Post-Op Knee X-Ray Report"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="doc-type">
              Document type <span className="text-rose-600">*</span>
            </label>
            <input
              id="doc-type"
              className={fieldClass}
              placeholder="e.g. Radiology"
              value={form.document_type}
              onChange={(e) => set('document_type', e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="doc-files">
              Files <span className="text-rose-600">*</span>
            </label>
            <input
              id="doc-files"
              type="file"
              multiple
              className={`${fieldClass} file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-stone-700`}
              onChange={(e) => set('files', Array.from(e.target.files || []))}
              required
            />
            <p className="mt-1 text-xs text-stone-500">
              {fileLabel(form.files) || 'Upload one or more files (multipart form-data).'}
            </p>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete document?"
        message={`${deleteTarget?.name || deleteTarget?.title || 'This document'} will be permanently removed.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export default DocumentManagerPage
