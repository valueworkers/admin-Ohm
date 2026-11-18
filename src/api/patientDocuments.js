import api from './axiosClient'

const asList = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.data?.results)) return data.data.results
  if (Array.isArray(data?.data)) return data.data
  return []
}

const unwrap = (data) => data?.data || data

const tenantOpts = (tenantSlug) => {
  const slug = String(tenantSlug || '').trim()
  if (!slug) throw new Error('Select a tenant first so X-Tenant can be sent.')
  return { xTenant: slug }
}

const requireId = (id, label) => {
  const v = String(id ?? '').trim()
  if (!v) throw new Error(`${label} id is required.`)
  return v
}

const idOf = (value) =>
  value != null && typeof value === 'object' ? String(value.id ?? '') : String(value ?? '')

const asFiles = (value) => {
  if (!value) return []
  if (typeof FileList !== 'undefined' && value instanceof FileList) return Array.from(value)
  if (Array.isArray(value)) return value.filter(Boolean)
  return [value].filter(Boolean)
}

export const normalizePatientDocument = (row = {}) => {
  const patient = row.patient
  const patientName =
    row.patient_name ||
    (patient && typeof patient === 'object'
      ? [patient.first_name, patient.last_name].filter(Boolean).join(' ').trim() ||
        patient.full_name ||
        patient.name ||
        patient.email ||
        ''
      : '')
  const files = asList(row.files || row.attachments || row.documents)
  return {
    ...row,
    id: String(row.id ?? ''),
    patient: idOf(patient),
    patient_name: patientName,
    title: String(row.title || ''),
    remarks: String(row.remarks || ''),
    files,
    file_count: Number(row.file_count) || files.length,
    created_at: row.created_at || '',
    updated_at: row.updated_at || '',
  }
}

/** multipart/form-data: patient, title, remarks, files (one or more) */
export const buildPatientDocumentFormData = (form = {}, { requireFiles = false } = {}) => {
  const files = asFiles(form.files)
  if (requireFiles && !files.length) throw new Error('At least one file is required.')

  const fd = new FormData()
  fd.append('patient', String(form.patient || ''))
  fd.append('title', String(form.title || '').trim())
  fd.append('remarks', String(form.remarks || '').trim())
  files.forEach((file) => fd.append('files', file))
  return fd
}

export const buildPatientDocumentBody = (form = {}) => ({
  patient: String(form.patient || ''),
  title: String(form.title || '').trim(),
  remarks: String(form.remarks || '').trim(),
})

/** GET /api/billing/patient-documents/ */
export const fetchPatientDocuments = async (
  tenantSlug,
  { page = 1, pageSize = 100, patient, search } = {},
) => {
  const params = { page, page_size: pageSize }
  if (patient) params.patient = patient
  if (search) params.search = search
  const { data } = await api.get('api/billing/patient-documents/', {
    params,
    ...tenantOpts(tenantSlug),
  })
  const results = asList(data).map(normalizePatientDocument)
  return { count: Number(data?.count) || results.length, results }
}

/** GET /api/billing/patient-documents/:id/ */
export const fetchPatientDocument = async (tenantSlug, documentId) => {
  const id = requireId(documentId, 'Document')
  const { data } = await api.get(
    `api/billing/patient-documents/${id}/`,
    tenantOpts(tenantSlug),
  )
  return normalizePatientDocument(unwrap(data))
}

/** POST /api/billing/patient-documents/ — multipart form-data */
export const createPatientDocument = async (tenantSlug, form) => {
  const body = buildPatientDocumentFormData(form, { requireFiles: true })
  const { data } = await api.post(
    'api/billing/patient-documents/',
    body,
    tenantOpts(tenantSlug),
  )
  return normalizePatientDocument(unwrap(data))
}

/**
 * PUT /api/billing/patient-documents/:id/
 * Uses multipart when new files are attached; otherwise JSON metadata.
 */
export const updatePatientDocument = async (tenantSlug, documentId, form) => {
  const id = requireId(documentId, 'Document')
  const files = asFiles(form.files)
  const body = files.length
    ? buildPatientDocumentFormData(form)
    : buildPatientDocumentBody(form)
  const { data } = await api.put(
    `api/billing/patient-documents/${id}/`,
    body,
    tenantOpts(tenantSlug),
  )
  return normalizePatientDocument(unwrap(data))
}

/** DELETE /api/billing/patient-documents/:id/ */
export const deletePatientDocument = async (tenantSlug, documentId) => {
  const id = requireId(documentId, 'Document')
  await api.delete(`api/billing/patient-documents/${id}/`, tenantOpts(tenantSlug))
  return { id }
}
