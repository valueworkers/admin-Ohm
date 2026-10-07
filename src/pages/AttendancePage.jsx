import PageHeader from '../components/ui/PageHeader'
import { EmptyState, Panel } from '../components/ui/PageState'
import { useAccess } from '../hooks/useAccess'

const AttendancePage = () => {
  const { tenant, canWrite } = useAccess()

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Workforce"
        title="Attendance"
        description={`Track staff check-in and daily attendance for ${tenant?.name || 'your organization'}.`}
      />
      <Panel>
        <EmptyState
          bare
          title="Attendance module ready"
          hint={
            canWrite
              ? 'Enabled by Super Admin for this tenant. Full capture and reports will connect here.'
              : 'View only — Super Admin inspect mode.'
          }
        />
      </Panel>
    </div>
  )
}

export default AttendancePage
