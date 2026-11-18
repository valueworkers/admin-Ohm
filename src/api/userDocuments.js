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

export const normalizeUserDocument = (row = {}) => {
  const user = row.user
  const files = asList(row.files || row.attachments || row.documents)
  return {
    ...row,
    id: String(row.id ?? ''),
    user: idOf(user),
    title: String(row.title || ''),
    remarks: String(row.remarks || ''),
    files,
    file_count: Number(row.file_count) || files.length,
    created_at: row.created_at || '',
    updated_at: row.updated_at || '',
  }
}

/** GET /api/user-documents/ */
export const fetchUserDocuments = async (
  tenantSlug,
  { page = 1, pageSize = 100, user } = {},
) => {
  const params = { page, page_size: pageSize }
  if (user) params.user = user
  const { data } = await api.get('api/user-documents/', {
    params,
    ...tenantOpts(tenantSlug),
  })
  const results = asList(data).map(normalizeUserDocument)
  return { count: Number(data?.count) || results.length, results }
}

/** GET /api/user-documents/:id/ */
export const fetchUserDocument = async (tenantSlug, documentId) => {
  const id = requireId(documentId, 'Document')
  const { data } = await api.get(`api/user-documents/${id}/`, tenantOpts(tenantSlug))
  return normalizeUserDocument(unwrap(data))
}

/** POST /api/user-documents/ — multipart: user, title, remarks, files */
export const uploadUserDocument = async (tenantSlug, { user, title, remarks, files }) => {
  const userId = requireId(user, 'User')
  const fileList = asFiles(files)
  if (!fileList.length) throw new Error('At least one file is required.')
  if (!String(title || '').trim()) throw new Error('Title is required.')
  if (!String(remarks || '').trim()) throw new Error('Remarks are required.')

  const body = new FormData()
  body.append('user', userId)
  body.append('title', String(title).trim())
  body.append('remarks', String(remarks).trim())
  fileList.forEach((file) => body.append('files', file))

  const { data } = await api.post('api/user-documents/', body, tenantOpts(tenantSlug))
  return normalizeUserDocument(unwrap(data))
}

/** DELETE /api/user-documents/:id/ */
export const deleteUserDocument = async (tenantSlug, documentId) => {
  const id = requireId(documentId, 'Document')
  await api.delete(`api/user-documents/${id}/`, tenantOpts(tenantSlug))
  return { id }
}
