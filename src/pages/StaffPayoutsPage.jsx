import PageHeader from '../components/ui/PageHeader'
import { EmptyState, Panel } from '../components/ui/PageState'
import { useAccess } from '../hooks/useAccess'

const StaffPayoutsPage = () => {
  const { tenant, canWrite } = useAccess()

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Workforce"
        title="Staff payouts"
        description={`Payout runs and payment status for ${tenant?.name || 'your organization'}.`}
      />
      <Panel>
        <EmptyState
          bare
          title="Staff payouts module ready"
          hint={
            canWrite
              ? 'Enabled by Super Admin for this tenant. Payout schedules and ledger will connect here.'
              : 'View only — Super Admin inspect mode.'
          }
        />
      </Panel>
    </div>
  )
}

export default StaffPayoutsPage
