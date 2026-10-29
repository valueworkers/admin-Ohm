import { useLocation } from 'react-router-dom'
import PageHeader from '../components/ui/PageHeader'
import { Panel } from '../components/ui/PageState'
import { useAccess } from '../hooks/useAccess'

const TITLES = {
  '/ops/emr': 'Document Manager',
  '/ops/analytics/attendance-master': 'Attendance Master',
  '/ops/analytics/reminders': 'Reminders',
  '/ops/analytics/payment-master': 'Payment Master',
  '/ops/analytics/unmapped-payments': 'Unmapped Payments',
  '/ops/staff/payroll': 'Payroll',
  '/ops/staff/for-hire': 'Staff for hire',
  '/ops/customer-lobby': 'Customer Lobby',
  '/ops/leads': 'Leads',
  '/ops/quotations': 'Quotations',
  '/ops/invoices': 'Invoices',
  '/ops/payments': 'Payments',
  '/ops/n8n-templates': 'N8N Templates',
}

const PLATFORM_OPS = new Set([
  '/ops/leads',
  '/ops/quotations',
  '/ops/invoices',
  '/ops/payments',
])

const ModulePlaceholder = () => {
  const { pathname } = useLocation()
  const { tenant, isSuperAdmin } = useAccess()
  const title = TITLES[pathname] || 'Module'
  const platformOps = PLATFORM_OPS.has(pathname) && isSuperAdmin

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={platformOps ? 'Platform' : tenant?.name || 'Tenant'}
        title={title}
        description="Demo shell — wire live data when the API is connected."
      />
      <Panel className="p-5">
        <p className="text-sm text-slate-600">
          {platformOps ? (
            <>
              Platform-wide {title.toLowerCase()} for Super Admin. Content will appear here once
              the module is implemented.
            </>
          ) : (
            <>
              This screen is ready in the sidebar for{' '}
              <span className="font-medium text-slate-900">{tenant?.name || 'this tenant'}</span>.
              Content will appear here once the module is implemented.
            </>
          )}
        </p>
      </Panel>
    </div>
  )
}

export default ModulePlaceholder
