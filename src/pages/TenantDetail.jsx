import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FiRefreshCw } from 'react-icons/fi'
import { fetchTenantById } from '../api/tenants'
import PageHeader from '../components/ui/PageHeader'
import { ErrorState, LoadingState, Panel } from '../components/ui/PageState'
import { apiErrorMessage } from '../utils/errors'
import { btnPrimary, btnSecondary } from '../utils/ui'

const formatDate = (value) => {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

const statusChip = (status) => {
  const s = String(status || '').toLowerCase()
  if (s === 'active' || s === 'ready') {
    return 'rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800'
  }
  if (s === 'provisioning' || s === 'pending') {
    return 'rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900'
  }
  if (s === 'failed' || s === 'suspended' || s === 'offboarded') {
    return 'rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-800'
  }
  return 'rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-600'
}

const TenantDetail = () => {
  const { tenantId } = useParams()
  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError('')
    try {
      const row = await fetchTenantById(tenantId)
      setTenant(row)
    } catch (err) {
      setTenant(null)
      setError(apiErrorMessage(err, 'Could not load tenant.'))
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="Platform" title="Tenant" description="Loading details…" />
        <LoadingState label="Loading tenant…" />
      </div>
    )
  }

  if (error || !tenant) {
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow="Platform"
          title="Tenant"
          actions={
            <Link to="/tenants" className={btnSecondary}>
              Back to tenants
            </Link>
          }
        />
        <ErrorState message={error || 'Tenant not found.'} onRetry={load} />
      </div>
    )
  }

  const domains = Array.isArray(tenant.domains) ? tenant.domains : []
  const modules = Array.isArray(tenant.modules) ? tenant.modules : []
  const subscriptions = Array.isArray(tenant.subscriptions) ? tenant.subscriptions : []

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Platform · Tenant detail"
        title={tenant.name}
        description={tenant.primary_domain || undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} onClick={load}>
              <FiRefreshCw className="h-4 w-4" aria-hidden />
              Refresh
            </button>
            <Link to={`/platform/permissions?tenantId=${tenant.id}`} className={btnPrimary}>
              Permissions
            </Link>
            <Link to="/tenants" className={btnSecondary}>
              Back to tenants
            </Link>
          </div>
        }
      />

      <Panel className="flex flex-wrap items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-dashed border-stone-300 bg-stone-50 text-xs text-stone-400">
          {tenant.logo ? (
            <img src={tenant.logo} alt="" className="h-full w-full object-cover" />
          ) : (
            'No logo'
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-stone-900">{tenant.name}</p>
            <span className={statusChip(tenant.status)}>{tenant.status || '—'}</span>
          </div>
          <p className="mt-1 text-sm text-stone-600">
            Created: {formatDate(tenant.created_at)}
          </p>
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Contact email', tenant.contact_email || '—'],
          ['Contact phone', tenant.contact_phone || '—'],
          ['Timezone', tenant.timezone || '—'],
          ['Currency', tenant.default_currency || '—'],
          [
            'Tags',
            Array.isArray(tenant.tags) && tenant.tags.length ? tenant.tags.join(', ') : '—',
          ],
          ['Owner id', tenant.owner ?? '—'],
          ['Modules', modules.length],
          ['Domains', domains.length],
          ['Subscriptions', subscriptions.length],
        ].map(([label, value]) => (
          <Panel key={label} className="!p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">{label}</p>
            <p className="mt-1 text-sm font-semibold text-stone-900">{value}</p>
          </Panel>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <p className="text-base font-semibold text-stone-900">Domains</p>
          {domains.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">No domains.</p>
          ) : (
            <ul className="mt-2 divide-y divide-stone-100">
              {domains.map((d) => (
                <li key={d.id || d.domain} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <p className="font-medium text-stone-900">{d.domain}</p>
                    <p className="text-xs text-stone-400">
                      {d.is_primary ? 'Primary' : 'Secondary'}
                      {d.verified ? ' · Verified' : ' · Unverified'}
                    </p>
                  </div>
                  <p className="text-xs text-stone-500">{formatDate(d.verified_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <p className="text-base font-semibold text-stone-900">Modules</p>
          {modules.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">No modules assigned.</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {modules.map((m, i) => (
                <li
                  key={m.id || m.key || m.name || i}
                  className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-800"
                >
                  {m.name || m.label || m.key || String(m)}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel>
        <p className="text-base font-semibold text-stone-900">Subscriptions</p>
        {subscriptions.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">No subscriptions.</p>
        ) : (
          <ul className="mt-2 divide-y divide-stone-100">
            {subscriptions.map((s, i) => (
              <li key={s.id || i} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <p className="font-medium text-stone-900">
                    {s.plan || s.name || s.plan_name || `Subscription ${i + 1}`}
                  </p>
                  <p className="text-xs text-stone-400">{s.status || '—'}</p>
                </div>
                <p className="text-xs text-stone-500">
                  {[s.starts_at || s.start_date, s.ends_at || s.end_date]
                    .filter(Boolean)
                    .map(formatDate)
                    .join(' → ') || '—'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

export default TenantDetail
