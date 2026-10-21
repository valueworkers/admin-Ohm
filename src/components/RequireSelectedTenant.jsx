import { useNavigate, Outlet } from 'react-router-dom'
import { EmptyState, Panel } from './ui/PageState'
import { useAccess } from '../hooks/useAccess'

const RequireSelectedTenant = () => {
  const navigate = useNavigate()
  const { hasTenantSelected, isSuperAdmin, tenant } = useAccess()

  if (!hasTenantSelected) {
    return (
      <Panel>
        <EmptyState
          bare
          title={isSuperAdmin ? 'Select a tenant' : 'No organization selected'}
          hint={
            isSuperAdmin
              ? 'Choose an active tenant from the header switcher to open this module.'
              : 'Activate or select one of your tenants first.'
          }
          actionLabel={isSuperAdmin ? 'Go to Tenants' : 'My tenants'}
          onAction={() => navigate(isSuperAdmin ? '/tenants' : '/my-tenants')}
        />
      </Panel>
    )
  }

  return <Outlet context={{ tenant }} />
}

export default RequireSelectedTenant
