import { Link } from 'react-router-dom'
import PageHeader from '../components/ui/PageHeader'
import { EmptyState, Panel } from '../components/ui/PageState'
import PackagesPage from './PackagesPage'
import { useAccess } from '../hooks/useAccess'
import { usePlatformCollection } from '../hooks/usePlatformCollection'
import { useVenueScope } from '../hooks/useVenueScope'
import { btnSecondary } from '../utils/ui'

/**
 * Spec: Location & Package — Single mode (or one venue) unlocks packages for the selected venue.
 */
const LocationPackagesPage = () => {
  const { tenantId, tenant } = useAccess()
  const { rows: venues } = usePlatformCollection('venues', tenantId)
  const { mode, selectedId, displayVenues, isSingle, canConfigureMode } = useVenueScope(
    tenantId,
    venues
  )
  const selected =
    displayVenues.find((v) => String(v.id) === String(selectedId)) || displayVenues[0]

  if (venues.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow={tenant?.name}
          title="Location & Package"
          description="Add a venue first, then manage locations and packages."
        />
        <Panel>
          <EmptyState
            bare
            title="No venues yet"
            hint="Create a venue for this tenant to unlock location and package setup."
          />
          <div className="flex justify-center pb-6">
            <Link to="/ops/venues" className={btnSecondary}>
              Go to Venues
            </Link>
          </div>
        </Panel>
      </div>
    )
  }

  if (mode === 'multi' && venues.length > 1) {
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow={tenant?.name}
          title="Location & Package"
          description={
            canConfigureMode
              ? 'Set Venues to Single and pick a venue to manage Location & Package for that site.'
              : 'This org is in Multi venue mode. Ask Super Admin to set Single if you need one-site packages.'
          }
        />
        <Panel className="space-y-3 p-5">
          <p className="text-sm text-stone-600">
            {venues.length} venues · mode: <span className="font-medium">Multi</span>
          </p>
          <ul className="list-inside list-disc text-sm text-stone-700">
            {venues.map((v) => (
              <li key={v.id}>{v.name}</li>
            ))}
          </ul>
          {canConfigureMode ? (
            <Link to="/ops/venues" className={btnSecondary}>
              Manage Venues
            </Link>
          ) : null}
        </Panel>
      </div>
    )
  }

  return (
    <PackagesPage
      eyebrow={`${tenant?.name || 'Tenant'} · ${selected?.name || 'Location & Package'}${
        isSingle ? ' · Single' : ''
      }`}
    />
  )
}

export default LocationPackagesPage
