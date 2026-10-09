import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import StatusBanner from '../../components/ui/StatusBanner'
import { EmptyState, Panel } from '../../components/ui/PageState'
import {
  FEATURE_CATALOG,
  FEATURE_GROUPS,
  getFeaturesForRole,
  normalizeRoleFeatures,
  TENANT_ROLE_OPTIONS,
} from '../../config/features'
import {
  getTenantRoleFeatures,
  listCollection,
  setTenantFeature,
  subscribePlatform,
} from '../../store/platformStore'
import { fieldClass, labelClass } from '../../utils/ui'

const RoleSwitch = ({ on, label, onToggle }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    onClick={onToggle}
    className={`relative mx-auto h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
      on ? 'bg-brand-500' : 'bg-stone-300'
    }`}
  >
    <span
      className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ease-out ${
        on ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
)

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
  const [roleFeatures, setRoleFeatures] = useState(() =>
    normalizeRoleFeatures(getTenantRoleFeatures(tenantId))
  )
  const [status, setStatus] = useState({ type: '', message: '' })

  const refresh = (id) => {
    setRoleFeatures(normalizeRoleFeatures(getTenantRoleFeatures(id)))
  }

  useEffect(() => {
    return subscribePlatform(() => {
      setTenants(listCollection('tenants'))
      if (tenantId) refresh(tenantId)
    })
  }, [tenantId])

  useEffect(() => {
    if (!tenantId) return
    refresh(tenantId)
    setStatus({ type: '', message: '' })
  }, [tenantId])

  const selected = useMemo(
    () => tenants.find((t) => String(t.id) === String(tenantId)) || null,
    [tenants, tenantId]
  )

  const roleCounts = useMemo(
    () =>
      TENANT_ROLE_OPTIONS.map((role) => {
        const map = getFeaturesForRole(roleFeatures, role.id)
        const on = FEATURE_CATALOG.filter((f) => map[f.key]).length
        return { ...role, on, total: FEATURE_CATALOG.length }
      }),
    [roleFeatures]
  )

  const toggle = (featureKey, roleId, next) => {
    if (!tenantId) return
    setTenantFeature(tenantId, featureKey, next, roleId)
    refresh(tenantId)
    const featureLabel = FEATURE_CATALOG.find((f) => f.key === featureKey)?.label || featureKey
    const roleLabel = TENANT_ROLE_OPTIONS.find((r) => r.id === roleId)?.label || roleId
    setStatus({
      type: 'success',
      message: next
        ? `${featureLabel} enabled for ${selected?.name || 'tenant'} · ${roleLabel}.`
        : `${featureLabel} disabled for ${selected?.name || 'tenant'} · ${roleLabel}.`,
    })
  }

  const roleColClass = `grid shrink-0 gap-2`
  const roleColStyle = {
    gridTemplateColumns: `repeat(${TENANT_ROLE_OPTIONS.length}, minmax(4.5rem, 5.5rem))`,
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Platform"
        title="Permissions"
        description="Pick a tenant, then enable modules per login role. Add roles in the catalog to show more columns."
      />
      <StatusBanner type={status.type} message={status.message} />

      <Panel className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-[14rem] flex-1 sm:max-w-md">
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
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-600">
              {roleCounts.map((role) => (
                <span key={role.id}>
                  <span className="font-medium text-stone-900">{role.on}</span>
                  {' / '}
                  {role.total} {role.shortLabel}
                </span>
              ))}
              {selected.status === 'active' ? (
                <Link
                  to={`/tenants/${selected.id}`}
                  className="font-medium text-brand-700 hover:underline"
                >
                  Inspect tenant
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>

        {selected ? (
          <p className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2 text-xs text-stone-600">
            Demo: Admin <span className="font-medium text-stone-800">owner@vaishnavi.com</span>
            {' · '}
            Ops Admin <span className="font-medium text-stone-800">ops@vaishnavi.com</span>
            . Each column is that role’s module access.
          </p>
        ) : null}
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
            <Panel key={group} className="overflow-x-auto">
              <div className="mb-3 flex min-w-[28rem] items-end justify-between gap-3">
                <p className="text-base font-semibold text-stone-900">{group}</p>
                <div className={roleColClass} style={roleColStyle} aria-hidden>
                  {TENANT_ROLE_OPTIONS.map((role) => (
                    <p
                      key={role.id}
                      className="text-center text-[11px] font-bold uppercase tracking-wide text-stone-400"
                      title={role.hint}
                    >
                      {role.shortLabel}
                    </p>
                  ))}
                </div>
              </div>
              <ul className="min-w-[28rem] divide-y divide-stone-100">
                {items.map((feature) => (
                  <li
                    key={feature.key}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-stone-900">{feature.label}</p>
                        {feature.core ? (
                          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-800">
                            Core
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                            Add-on
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-stone-500">{feature.description}</p>
                    </div>
                    <div className={roleColClass} style={roleColStyle}>
                      {TENANT_ROLE_OPTIONS.map((role) => {
                        const map = getFeaturesForRole(roleFeatures, role.id)
                        const on = Boolean(map[feature.key])
                        return (
                          <RoleSwitch
                            key={role.id}
                            on={on}
                            label={`${on ? 'Disable' : 'Enable'} ${feature.label} for ${role.label}`}
                            onToggle={() => toggle(feature.key, role.id, !on)}
                          />
                        )
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )
        })
      )}
    </div>
  )
}

export default PlatformPermissions
