import { Link } from 'react-router-dom'
import PageHeader from './ui/PageHeader'
import { EmptyState, Panel } from './ui/PageState'
import { useAccess } from '../hooks/useAccess'
import { btnSecondary } from '../utils/ui'

/**
 * Tenant Operations shell for Quotes / Invoices / Payments.
 * Same nav as Super Admin, but not the platform billing UI.
 */
const TenantOpsPlaceholder = ({ title, description }) => {
  const { tenant } = useAccess()
  return (
    <div className="sc-page-enter space-y-4">
      <PageHeader
        eyebrow={tenant?.name || 'Operations'}
        title={title}
        description={description}
      />
      <Panel className="p-4 md:p-6">
        <EmptyState bare title={`${title} for your organization`} />

        <div className="mt-4 flex justify-center">
          <Link to="/" className={btnSecondary}>
            Back to home
          </Link>
        </div>
      </Panel>
    </div>
  )
}

export default TenantOpsPlaceholder
