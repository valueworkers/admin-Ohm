import { FiLoader } from 'react-icons/fi'
import Modal from './Modal'
import { btnDanger, btnSecondary } from '../../utils/ui'

const ConfirmDialog = ({
  open,
  title = 'Confirm',
  message,
  confirmLabel = 'Delete',
  loading = false,
  onConfirm,
  onClose,
}) => (
  <Modal
    open={open}
    title={title}
    onClose={() => {
      if (!loading) onClose?.()
    }}
    footer={
      <div className="flex justify-end gap-2">
        <button type="button" className={btnSecondary} onClick={onClose} disabled={loading}>
          Cancel
        </button>
        <button type="button" className={btnDanger} onClick={onConfirm} disabled={loading}>
          {loading ? (
            <>
              <FiLoader className="h-4 w-4 animate-spin" />
              Working…
            </>
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    }
  >
    <p className="text-sm text-slate-600">{message}</p>
  </Modal>
)

export default ConfirmDialog
