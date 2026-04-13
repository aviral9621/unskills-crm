import Modal from './Modal'
import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
  loading?: boolean
}

const variantStyles = {
  danger: { icon: 'bg-red-100 text-red-600', btn: 'bg-red-600 hover:bg-red-700' },
  warning: { icon: 'bg-amber-100 text-amber-600', btn: 'bg-amber-600 hover:bg-amber-700' },
  info: { icon: 'bg-blue-100 text-blue-600', btn: 'bg-blue-600 hover:bg-blue-700' },
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  const style = variantStyles[variant]

  return (
    <Modal open={open} onClose={onClose} title="" size="sm" hideClose>
      <div className="flex flex-col items-center text-center pt-2">
        <div className={`h-12 w-12 rounded-full ${style.icon} flex items-center justify-center mb-4`}>
          <AlertTriangle size={24} />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 font-heading">{title}</h3>
        <p className="mt-2 text-sm text-gray-500 max-w-xs">{message}</p>
        <div className="flex items-center gap-3 mt-6 w-full">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 ${style.btn}`}
          >
            {loading ? 'Please wait...' : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}
