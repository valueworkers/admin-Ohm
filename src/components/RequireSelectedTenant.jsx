import { useNavigate, Outlet } from 'react-router-dom'
import { EmptyState, Panel } from './ui/PageState'
import { useAccess } from '../hooks/useAccess'

const RequireSelectedTenant = () => {
  const navigate = useNavigate()
  const { hasTenantSelected, tenant } = useAccess()

  if (!hasTenantSelected) {
    return (
      <Panel>
        <EmptyState
          bare
          title="Select a tenant"
          hint="Choose an active tenant from the header switcher to open this module."
          actionLabel="Go to Tenants"
          onAction={() => navigate('/tenants')}
        />
      </Panel>
    )
  }

  return <Outlet context={{ tenant }} />
}

export default RequireSelectedTenant
