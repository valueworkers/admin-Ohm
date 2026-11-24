import PageHeader from '../components/ui/PageHeader'
import { EmptyState, Panel } from '../components/ui/PageState'
import { useAccess } from '../hooks/useAccess'

const ExpensesPage = () => {
  const { tenant, canWrite, isSuperAdmin } = useAccess()

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={isSuperAdmin ? 'Operations' : tenant?.name || 'Operations'}
        title="Expenses"
        description={`Expense tracking for ${tenant?.name || 'your organization'}.`}
      />
      <Panel>
        <EmptyState
          bare
          title="Expenses module ready"
          hint={
            canWrite
              ? 'APIs will connect here next. You can start capturing expenses once the endpoints are wired.'
              : 'View only — Super Admin inspect mode.'
          }
        />
      </Panel>
    </div>
  )
}

export default ExpensesPage
