import { useEffect, type ReactNode } from 'react'
import { useI18n } from '../../shared/useI18n'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  const { t } = useI18n()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="w-[420px] max-w-[90vw] rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-medium text-ink">{title}</h2>
        <div className="space-y-3">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          {footer ?? (
            <button
              className="rounded-lg bg-canvas px-4 py-2 text-sm text-ink hover:bg-line"
              onClick={onClose}
            >
              {t('close')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      {children}
    </label>
  )
}

export const inputCls =
  'w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent'

export const btnPrimary =
  'rounded-lg bg-accent px-4 py-2 text-sm text-white hover:opacity-90'
export const btnGhost =
  'rounded-lg bg-canvas px-4 py-2 text-sm text-ink hover:bg-line'
