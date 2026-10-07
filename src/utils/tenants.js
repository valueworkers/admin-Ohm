const TENANTS_KEY = 'admin_tenants'
const SELECTED_TENANT_KEY = 'admin_selected_tenant_id'

export const getStoredTenants = () => {
  try {
    const raw = localStorage.getItem(TENANTS_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export const saveStoredTenants = (tenants) => {
  localStorage.setItem(TENANTS_KEY, JSON.stringify(tenants))
  window.dispatchEvent(new Event('tenants-changed'))
}

export const upsertTenant = (tenant) => {
  if (!tenant?.id && !tenant?.owner_id) return getStoredTenants()
  const id = String(tenant.id ?? tenant.owner_id)
  const list = getStoredTenants()
  const next = {
    id,
    name: tenant.name || tenant.organization_name || tenant.tenant_name || 'Unnamed tenant',
    owner_id: tenant.owner_id != null ? String(tenant.owner_id) : id,
    owner_email: tenant.owner_email || tenant.email || '',
    owner_name:
      tenant.owner_name ||
      [tenant.first_name, tenant.last_name].filter(Boolean).join(' ').trim() ||
      '',
    city: tenant.city || '',
    created_at: tenant.created_at || new Date().toISOString(),
    ...tenant,
  }
  const idx = list.findIndex((t) => String(t.id) === id)
  if (idx >= 0) list[idx] = { ...list[idx], ...next }
  else list.unshift(next)
  saveStoredTenants(list)
  return list
}

export const removeStoredTenant = (tenantId) => {
  const id = String(tenantId)
  const list = getStoredTenants().filter((t) => String(t.id) !== id)
  saveStoredTenants(list)
  if (getSelectedTenantId() === id) clearSelectedTenant()
  return list
}

export const getSelectedTenantId = () => localStorage.getItem(SELECTED_TENANT_KEY) || ''

export const getSelectedTenant = () => {
  const id = getSelectedTenantId()
  if (!id) return null
  return getStoredTenants().find((t) => String(t.id) === id) || null
}

export const setSelectedTenantId = (tenantId) => {
  if (tenantId == null || tenantId === '') {
    clearSelectedTenant()
    return
  }
  localStorage.setItem(SELECTED_TENANT_KEY, String(tenantId))
  window.dispatchEvent(new Event('tenant-selection-changed'))
}

export const clearSelectedTenant = () => {
  localStorage.removeItem(SELECTED_TENANT_KEY)
  window.dispatchEvent(new Event('tenant-selection-changed'))
}

/** Local demo tenant — Vaishnavi Medicare (used when Master Admin has no tenants yet). */
export const DEMO_TENANT = {
  id: 'demo-vaishnavi',
  owner_id: 'demo-vaishnavi',
  name: 'Vaishnavi Medicare',
  owner_email: 'owner@vaishnavi.demo',
  owner_name: 'Demo Owner',
  city: 'Pune',
  created_at: '2026-01-01T00:00:00.000Z',
  source: 'demo',
}

export const isDemoTenant = (tenantOrId) => {
  if (tenantOrId == null) return false
  if (typeof tenantOrId === 'string') {
    return tenantOrId.startsWith('demo-') || tenantOrId === DEMO_TENANT.id
  }
  const id = String(tenantOrId.id || '')
  return tenantOrId.source === 'demo' || id.startsWith('demo-') || id === DEMO_TENANT.id
}

/** Tenant IDs safe to send as X-Tenant-Id / X-Owner-Id to the care API. */
export const getApiTenantScope = () => {
  const tenant = getSelectedTenant()
  if (!tenant?.id || isDemoTenant(tenant)) return null
  return {
    tenantId: String(tenant.id),
    ownerId: String(tenant.owner_id || tenant.id),
  }
}

/** Build a tenant row from a logged-in VSRE_OWNER user. */
export const tenantFromOwnerUser = (user) => {
  if (!user) return null
  const ownerId = String(user.id ?? user.owner_id ?? '')
  if (!ownerId) return null
  const tenantId = String(
    user.tenant_id ?? user.organization_id ?? user.org_id ?? ownerId
  )
  return {
    id: tenantId,
    owner_id: ownerId,
    name:
      user.organization_name ||
      user.tenant_name ||
      user.company_name ||
      user.org_name ||
      'My organization',
    owner_email: user.email || '',
    owner_name:
      [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.email || '',
    city: user.city || '',
    created_at: user.created_at || new Date().toISOString(),
    source: 'owner-session',
  }
}

/** Ensure Master Admin has a tenant registry + selection (seeds Vaishnavi if empty). */
export const ensureTenantReady = () => {
  let list = getStoredTenants()
  if (list.length === 0) {
    list = [DEMO_TENANT]
    saveStoredTenants(list)
  }

  const real = list.filter((t) => !isDemoTenant(t))
  const selectedId = getSelectedTenantId()
  const selectedIsDemo = !selectedId || isDemoTenant(selectedId)
  const stillValid = selectedId && list.some((t) => String(t.id) === selectedId)

  // Prefer a real API tenant so catalog calls are not scoped to demo-vaishnavi.
  if (real.length > 0 && (selectedIsDemo || !stillValid)) {
    setSelectedTenantId(real[0].id)
  } else if (!stillValid && list[0]?.id) {
    setSelectedTenantId(list[0].id)
  }

  return { tenants: getStoredTenants(), selected: getSelectedTenant() }
}

/**
 * Apply role scope after login / on session sync.
 * Master Admin: all tenants. Owner: only their org, locked selection.
 */
export const applyRoleTenantScope = (user) => {
  if (!user) return ensureTenantReady()

  const type = String(user.user_type || user.userType || '').trim().toUpperCase()
  if (type === 'VSRE_OWNER') {
    const mine = tenantFromOwnerUser(user)
    if (!mine) return { tenants: [], selected: null }

    const existing = getStoredTenants().find(
      (t) =>
        String(t.id) === String(mine.id) || String(t.owner_id) === String(mine.owner_id)
    )
    if (!existing) {
      upsertTenant(mine)
    } else if (
      existing.name !== mine.name ||
      existing.owner_email !== mine.owner_email ||
      String(existing.owner_id) !== String(mine.owner_id)
    ) {
      upsertTenant({ ...existing, ...mine, id: existing.id })
    }

    const id = String(existing?.id || mine.id)
    if (getSelectedTenantId() !== id) {
      setSelectedTenantId(id)
    }
    return { tenants: getVisibleTenants(user), selected: getSelectedTenant() }
  }

  return ensureTenantReady()
}

/** Tenants visible to the current user. */
export const getVisibleTenants = (user) => {
  const type = String(user?.user_type || user?.userType || '').trim().toUpperCase()
  const all = getStoredTenants()
  if (type === 'VSRE_OWNER') {
    const mine = tenantFromOwnerUser(user)
    if (!mine) return []
    const match = all.find(
      (t) =>
        String(t.id) === String(mine.id) ||
        String(t.owner_id) === String(mine.owner_id)
    )
    return match ? [match] : [mine]
  }
  return all
}

/** Merge remote owner/tenant rows into local registry (keeps local display names when present). */
export const mergeRemoteTenants = (remoteRows = []) => {
  const local = getStoredTenants().filter((t) => !isDemoTenant(t))
  const byId = new Map(local.map((t) => [String(t.id), t]))
  remoteRows.forEach((row) => {
    const ownerId = row.id ?? row.owner_id ?? row.user_id ?? row.pk
    if (ownerId == null) return
    const id = String(ownerId)
    const existing = byId.get(id)
    byId.set(id, {
      id,
      name:
        existing?.name ||
        row.organization_name ||
        row.tenant_name ||
        row.company_name ||
        row.name ||
        [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
        row.email ||
        `Tenant #${id}`,
      owner_id: id,
      owner_email: row.email || row.owner_email || existing?.owner_email || '',
      owner_name:
        [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
        existing?.owner_name ||
        '',
      city: row.city || existing?.city || '',
      created_at: row.created_at || existing?.created_at || '',
      source: 'api',
    })
  })
  const merged = Array.from(byId.values())
  saveStoredTenants(merged)

  const selectedId = getSelectedTenantId()
  if (!selectedId || isDemoTenant(selectedId) || !merged.some((t) => String(t.id) === selectedId)) {
    if (merged[0]?.id) setSelectedTenantId(merged[0].id)
  }
  return merged
}
