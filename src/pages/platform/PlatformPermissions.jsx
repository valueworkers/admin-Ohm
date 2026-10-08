import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FiCheck, FiSlash } from 'react-icons/fi'
import PageHeader from '../../components/ui/PageHeader'
import StatusBanner from '../../components/ui/StatusBanner'
import { EmptyState, Panel } from '../../components/ui/PageState'
import {
  FEATURE_CATALOG,
  FEATURE_GROUPS,
  mergeTenantFeatures,
} from '../../config/features'
import {
  getTenantFeatures,
  listCollection,
  setTenantFeature,
  subscribePlatform,
} from '../../store/platformStore'
import { fieldClass, labelClass } from '../../utils/ui'

const statusChip = (active) =>
  active
    ? 'inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800'
    : 'inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500'

const PlatformPermissions = () => {
  const [searchParams] = useSearchParams()
  const [tenants, setTenants] = useState(() => listCollection('tenants'))
  const [tenantId, setTenantId] = useState(() => {
    const fromUrl = searchParams.get('tenantId')
    const all = listCollection('tenants')
    if (fromUrl && all.some((t) => String(t.id) === String(fromUrl))) return fromUrl
    const active = all.find((t) => t.status === 'active')
    return active?.id || all[0]?.id || ''
  })
  const [features, setFeatures] = useState(() =>
    mergeTenantFeatures(getTenantFeatures(tenantId))
  )
  const [status, setStatus] = useState({ type: '', message: '' })

  useEffect(() => {
    return subscribePlatform(() => {
      const next = listCollection('tenants')
      setTenants(next)
      if (tenantId) setFeatures(mergeTenantFeatures(getTenantFeatures(tenantId)))
    })
  }, [tenantId])

  useEffect(() => {
    if (!tenantId) return
    setFeatures(mergeTenantFeatures(getTenantFeatures(tenantId)))
    setStatus({ type: '', message: '' })
  }, [tenantId])

  const selected = useMemo(
    () => tenants.find((t) => String(t.id) === String(tenantId)) || null,
    [tenants, tenantId]
  )

  const enabledCount = FEATURE_CATALOG.filter((f) => features[f.key]).length

  const toggle = (key, next) => {
    if (!tenantId) return
    setTenantFeature(tenantId, key, next)
    setFeatures(mergeTenantFeatures(getTenantFeatures(tenantId)))
    const label = FEATURE_CATALOG.find((f) => f.key === key)?.label || key
    setStatus({
      type: 'success',
      message: next
        ? `${label} enabled for ${selected?.name || 'tenant'}.`
        : `${label} disabled for ${selected?.name || 'tenant'}.`,
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Platform"
        title="Permissions"
        description="Toggle which modules each tenant is entitled to. Super Admin uses this when inspecting orgs; tenant accounts cannot sign in to this panel."
      />
      <StatusBanner type={status.type} message={status.message} />

      <Panel className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <label htmlFor="perm-tenant" className={labelClass}>
              Tenant
            </label>
            <select
              id="perm-tenant"
              className={fieldClass}
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
            >
              {tenants.length === 0 ? <option value="">No tenants</option> : null}
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.status})
                </option>
              ))}
            </select>
          </div>
          {selected ? (
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-900">{enabledCount}</span>
              {' / '}
              {FEATURE_CATALOG.length} features on
              {selected.status === 'active' ? (
                <>
                  {' · '}
                  <Link
                    to={`/tenants/${selected.id}`}
                    className="font-medium text-sky-700 hover:underline"
                  >
                    Inspect tenant
                  </Link>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </Panel>

      {!selected ? (
        <EmptyState
          title="No tenant selected"
          hint="Onboard a tenant in Lobby, then assign feature access here."
        />
      ) : (
        FEATURE_GROUPS.map((group) => {
          const items = FEATURE_CATALOG.filter((f) => f.group === group)
          return (
            <Panel key={group}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-base font-semibold text-slate-900">{group}</p>
                <p className="text-xs text-slate-500">
                  {group === 'Add-ons'
                    ? 'Optional modules — off by default for new tenants'
                    : 'Recommended for most tenants'}
                </p>
              </div>
              <ul className="divide-y divide-slate-100">
                {items.map((feature) => {
                  const on = Boolean(features[feature.key])
                  return (
                    <li
                      key={feature.key}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{feature.label}</p>
                          <span className={statusChip(on)}>
                            {on ? (
                              <>
                                <FiCheck className="h-3 w-3" aria-hidden /> Enabled
                              </>
                            ) : (
                              <>
                                <FiSlash className="h-3 w-3" aria-hidden /> Off
                              </>
                            )}
                          </span>
                          {feature.core ? (
                            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
                              Core
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                              Add-on
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">{feature.description}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">Route {feature.route}</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={`${on ? 'Disable' : 'Enable'} ${feature.label}`}
                        onClick={() => toggle(feature.key, !on)}
                        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 ${
                          on ? 'bg-sky-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ease-out ${
                            on ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </Panel>
          )
        })
      )}
    </div>
  )
}

export default PlatformPermissions
