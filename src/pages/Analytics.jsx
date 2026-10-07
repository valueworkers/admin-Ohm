import PageHeader from '../components/ui/PageHeader'
import { Panel } from '../components/ui/PageState'
import { useAccess } from '../hooks/useAccess'
import { listByTenant, platformStats } from '../store/platformStore'

const Analytics = () => {
  const { tenantId, tenant } = useAccess()
  const stats = platformStats(tenantId)
  const bookings = listByTenant('bookings', tenantId)
  const byStatus = bookings.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Organization"
        title="Analytics"
        description={`Operational snapshot for ${tenant?.name || 'your organization'}.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Booking value', `₹${stats.revenue.toLocaleString('en-IN')}`],
          ['Open bookings', (byStatus.pending || 0) + (byStatus.confirmed || 0)],
          ['Completed', byStatus.completed || 0],
          ['Active patients', stats.patients],
        ].map(([label, value]) => (
          <Panel key={label} className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          </Panel>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <p className="text-base font-semibold text-slate-900">Catalog mix</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li className="flex justify-between border-b border-slate-100 py-2">
              <span>Services</span>
              <span className="font-semibold text-slate-900">{stats.services}</span>
            </li>
            <li className="flex justify-between border-b border-slate-100 py-2">
              <span>Venues</span>
              <span className="font-semibold text-slate-900">{stats.venues}</span>
            </li>
            <li className="flex justify-between border-b border-slate-100 py-2">
              <span>Packages</span>
              <span className="font-semibold text-slate-900">{stats.packages}</span>
            </li>
            <li className="flex justify-between py-2">
              <span>Vendors</span>
              <span className="font-semibold text-slate-900">{stats.vendors}</span>
            </li>
          </ul>
        </Panel>
        <Panel>
          <p className="text-base font-semibold text-slate-900">Workforce</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li className="flex justify-between border-b border-slate-100 py-2">
              <span>Employees</span>
              <span className="font-semibold text-slate-900">{stats.employees}</span>
            </li>
            <li className="flex justify-between border-b border-slate-100 py-2">
              <span>Patients</span>
              <span className="font-semibold text-slate-900">{stats.patients}</span>
            </li>
            <li className="flex justify-between py-2">
              <span>Bookings</span>
              <span className="font-semibold text-slate-900">{stats.bookings}</span>
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  )
}

export default Analytics
