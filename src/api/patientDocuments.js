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
  const name = String(row.name || row.title || '').trim()
  const documentType = String(row.document_type || row.remarks || '').trim()
  return {
    ...row,
    id: String(row.id ?? ''),
    patient: idOf(patient),
    patient_name: patientName,
    name,
    title: name,
    document_type: documentType,
    remarks: documentType,
    files,
    file_count: Number(row.file_count) || files.length,
    created_at: row.created_at || '',
    updated_at: row.updated_at || '',
  }
}

/** multipart/form-data: patient, name, document_type, files */
export const buildPatientDocumentFormData = (form = {}, { requireFiles = false } = {}) => {
  const files = asFiles(form.files)
  if (requireFiles && !files.length) throw new Error('At least one file is required.')

  const fd = new FormData()
  fd.append('patient', String(form.patient || ''))
  fd.append('name', String(form.name || form.title || '').trim())
  fd.append(
    'document_type',
    String(form.document_type || form.remarks || '').trim(),
  )
  files.forEach((file) => fd.append('files', file))
  return fd
}

/** GET /api/care/patient-documents/ */
export const fetchPatientDocuments = async (
  tenantSlug,
  { page = 1, pageSize = 100, patient, search } = {},
) => {
  const params = { page, page_size: pageSize }
  if (patient) params.patient = patient
  if (search) params.search = search
  const { data } = await api.get('api/care/patient-documents/', {
    params,
    ...tenantOpts(tenantSlug),
  })
  const results = asList(data).map(normalizePatientDocument)
  return { count: Number(data?.count) || results.length, results }
}

/** GET /api/care/patient-documents/:id/ */
export const fetchPatientDocument = async (tenantSlug, documentId) => {
  const id = requireId(documentId, 'Document')
  const { data } = await api.get(
    `api/care/patient-documents/${id}/`,
    tenantOpts(tenantSlug),
  )
  return normalizePatientDocument(unwrap(data))
}

/** POST /api/care/patient-documents/ — multipart form-data */
export const createPatientDocument = async (tenantSlug, form) => {
  const body = buildPatientDocumentFormData(form, { requireFiles: true })
  const { data } = await api.post(
    'api/care/patient-documents/',
    body,
    tenantOpts(tenantSlug),
  )
  return normalizePatientDocument(unwrap(data))
}

/** DELETE /api/care/patient-documents/:id/ */
export const deletePatientDocument = async (tenantSlug, documentId) => {
  const id = requireId(documentId, 'Document')
  await api.delete(`api/care/patient-documents/${id}/`, tenantOpts(tenantSlug))
  return { id }
}
