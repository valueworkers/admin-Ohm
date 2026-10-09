import { useLocation } from 'react-router-dom'
import PageHeader from '../components/ui/PageHeader'
import { Panel } from '../components/ui/PageState'
import { useAccess } from '../hooks/useAccess'

const TITLES = {
  '/ops/resources': 'Resources',
  '/ops/emr': 'EMR',
  '/ops/analytics/attendance-master': 'Attendance Master',
  '/ops/analytics/reminders': 'Reminders',
  '/ops/analytics/payment-master': 'Payment Master',
  '/ops/analytics/unmapped-payments': 'Unmapped Payments',
  '/ops/staff/payroll': 'Payroll',
  '/ops/staff/for-hire': 'Staff for hire',
  '/ops/customer-lobby': 'Customer Lobby',
  '/ops/invoices': 'Invoices',
  '/ops/payments': 'Payment',
  '/ops/n8n-templates': 'N8N Templates',
}

const ModulePlaceholder = () => {
  const { pathname } = useLocation()
  const { tenant } = useAccess()
  const title = TITLES[pathname] || 'Module'

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={tenant?.name || 'Tenant'}
        title={title}
        description="Demo shell — wire live data when the API is connected."
      />
      <Panel className="p-5">
        <p className="text-sm text-slate-600">
          This screen is ready in the sidebar for <span className="font-medium text-slate-900">{tenant?.name}</span>.
          Content will appear here once the module is implemented.
        </p>
      </Panel>
    </div>
  )
}

export default ModulePlaceholder
