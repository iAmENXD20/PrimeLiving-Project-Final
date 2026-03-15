import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ConfirmationModalProps {
  open: boolean
  isDark: boolean
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmationModal({
  open,
  isDark,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/65" onClick={() => !loading && onCancel()} />
      <div
        className={`relative w-full max-w-md rounded-2xl border p-6 shadow-2xl animate-in zoom-in-95 fade-in duration-200 ${
          isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{description}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className={isDark ? 'border-[#1E293B] text-gray-300 hover:bg-white/5' : ''}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            {loading ? 'Processing...' : confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
