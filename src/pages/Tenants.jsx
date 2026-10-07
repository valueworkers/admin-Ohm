import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiEye, FiUserMinus } from 'react-icons/fi'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import { EmptyState } from '../components/ui/PageState'
import {
  listTenantsByStatus,
  subscribePlatform,
  updateTenantStatus,
} from '../store/platformStore'
import { btnGhost, btnPrimary, tableHeadClass, tableWrapClass } from '../utils/ui'

const Tenants = () => {
  const navigate = useNavigate()
  const [rows, setRows] = useState(() => listTenantsByStatus('active'))
  const [status, setStatus] = useState({ type: '', message: '' })
  const [offboardTarget, setOffboardTarget] = useState(null)

  useEffect(() => subscribePlatform(() => setRows(listTenantsByStatus('active'))), [])

  const offboard = () => {
    if (!offboardTarget) return
    updateTenantStatus(offboardTarget.id, 'offboarded')
    setStatus({
      type: 'success',
      message: `${offboardTarget.name} offboarded. Owner login is blocked until re-approved.`,
    })
    setOffboardTarget(null)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Platform"
        title="Tenants"
        description="Active organizations after Lobby approval. Open any tenant for a read-only view of their data. Offboarding is Super Admin only."
        actions={
          <Link to="/lobby" className={btnPrimary}>
            Go to Lobby
          </Link>
        }
      />

      <StatusBanner type={status.type} message={status.message} />

      <div className={tableWrapClass}>
        {rows.length === 0 ? (
          <EmptyState
            bare
            title="No active tenants"
            hint="Approve a pending organization from Lobby."
            actionLabel="Open Lobby"
            onAction={() => navigate('/lobby')}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-4 py-3">Tenant</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Approved</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{row.owner_name}</div>
                      <div className="text-xs text-slate-400">{row.owner_email}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.city}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.approved_at
                        ? new Date(row.approved_at).toLocaleDateString('en-IN')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link to={`/tenants/${row.id}`} className={btnGhost}>
                          <FiEye className="h-3.5 w-3.5" aria-hidden />
                          View
                        </Link>
                        <button
                          type="button"
                          className={`${btnGhost} text-rose-600 hover:bg-rose-50`}
                          onClick={() => setOffboardTarget(row)}
                        >
                          <FiUserMinus className="h-3.5 w-3.5" aria-hidden />
                          Offboard
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(offboardTarget)}
        title="Offboard tenant?"
        message="The owner will no longer be able to sign in. Data remains for inspection until you reset demo data."
        confirmLabel="Offboard"
        onConfirm={offboard}
        onClose={() => setOffboardTarget(null)}
      />
    </div>
  )
}

export default Tenants
