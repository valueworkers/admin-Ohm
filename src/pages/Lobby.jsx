import { useEffect, useState } from 'react'
import { FiCheck, FiX } from 'react-icons/fi'
import OnboardTenantModal from '../components/OnboardTenantModal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import PageHeader from '../components/ui/PageHeader'
import StatusBanner from '../components/ui/StatusBanner'
import { EmptyState } from '../components/ui/PageState'
import {
  listTenantsByStatus,
  onboardTenant,
  subscribePlatform,
  updateTenantStatus,
} from '../store/platformStore'
import { btnGhost, btnPrimary, tableHeadClass, tableWrapClass } from '../utils/ui'

const Lobby = () => {
  const [pending, setPending] = useState(() => listTenantsByStatus('pending'))
  const [status, setStatus] = useState({ type: '', message: '' })
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rejectTarget, setRejectTarget] = useState(null)

  useEffect(() => subscribePlatform(() => setPending(listTenantsByStatus('pending'))), [])

  const approve = (row) => {
    updateTenantStatus(row.id, 'active', { approved_at: new Date().toISOString() })
    setStatus({
      type: 'success',
      message: row.has_ops_admin
        ? `${row.name} approved. Ops Admin can sign in with ${row.owner_email}.`
        : `${row.name} approved (no Ops Admin login yet).`,
    })
  }

  const reject = () => {
    if (!rejectTarget) return
    updateTenantStatus(rejectTarget.id, 'offboarded')
    setStatus({ type: 'success', message: `${rejectTarget.name} rejected / removed from Lobby.` })
    setRejectTarget(null)
  }

  const handleCreate = (form) => {
    setSaving(true)
    try {
      const { tenant } = onboardTenant(form)
      setStatus({
        type: 'success',
        message: tenant.has_ops_admin
          ? `${tenant.name} submitted to Lobby with Ops Admin ${tenant.owner_email}.`
          : `${tenant.name} submitted to Lobby (no Ops Admin).`,
      })
      setModalOpen(false)
    } catch (err) {
      setSaving(false)
      throw err
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Platform"
        title="Lobby"
        description="Create tenants with org profile, optional Ops Admin login, logo, and ops settings. Approve to activate under Tenants."
        actions={
          <button type="button" className={btnPrimary} onClick={() => setModalOpen(true)}>
            Create tenant
          </button>
        }
      />

      <StatusBanner type={status.type} message={status.message} />

      <div className={tableWrapClass}>
        {pending.length === 0 ? (
          <EmptyState
            bare
            title="Lobby is empty"
            hint="Create a tenant to open an onboarding request."
            actionLabel="Create tenant"
            onAction={() => setModalOpen(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Ops Admin</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pending.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-[10px] text-slate-400">
                          {row.logo_url ? (
                            <img src={row.logo_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            'Logo'
                          )}
                        </div>
                        <span className="font-medium text-slate-900">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.type || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.has_ops_admin === false ? (
                        <span className="text-amber-800">Not created</span>
                      ) : (
                        <>
                          <div>{row.owner_name || '—'}</div>
                          <div className="text-xs text-slate-400">{row.owner_email || '—'}</div>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.city || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.onboarded_at
                        ? new Date(row.onboarded_at).toLocaleDateString('en-IN')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button type="button" className={btnPrimary} onClick={() => approve(row)}>
                          <FiCheck className="h-3.5 w-3.5" aria-hidden />
                          Approve
                        </button>
                        <button
                          type="button"
                          className={`${btnGhost} text-rose-600 hover:bg-rose-50`}
                          onClick={() => setRejectTarget(row)}
                        >
                          <FiX className="h-3.5 w-3.5" aria-hidden />
                          Reject
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

      <OnboardTenantModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        saving={saving}
      />

      <ConfirmDialog
        open={Boolean(rejectTarget)}
        title="Reject onboarding?"
        message="This marks the organization as offboarded and removes it from Lobby."
        confirmLabel="Reject"
        onConfirm={reject}
        onClose={() => setRejectTarget(null)}
      />
    </div>
  )
}

export default Lobby
