'use client'

import { useEffect, useId, useRef } from 'react'

interface ModalProps {
  isOpen: boolean
  title: string
  description?: string
  onConfirm: () => void
  onCancel: () => void
  confirmText?: string
  cancelText?: string
  isDangerous?: boolean
  isLoading?: boolean
}

export function Modal({
  isOpen,
  title,
  description,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDangerous = false,
  isLoading = false
}: ModalProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const cancelHandler = useRef(onCancel)
  const loadingRef = useRef(isLoading)
  cancelHandler.current = onCancel
  loadingRef.current = isLoading

  useEffect(() => {
    if (!isOpen) return
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancelRef.current?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!loadingRef.current) cancelHandler.current()
      }
      if (event.key !== 'Tab') return
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), [tabindex="0"]')
      if (!focusable?.length) {
        event.preventDefault()
        dialogRef.current?.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', handleKey)
      previous?.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && isLoading) dialogRef.current?.focus()
  }, [isOpen, isLoading])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} aria-busy={isLoading} tabIndex={-1} className="bg-surface border border-border-subtle rounded-xl shadow-2xl shadow-black/40 max-w-md w-full interaction-enter">
        {/* Header */}
        <div className="border-b border-border-subtle p-6">
          <h2 id={titleId} className="text-lg font-semibold text-text-primary">{title}</h2>
          {description && <p id={descriptionId} className="text-text-secondary text-sm mt-2">{description}</p>}
        </div>

        {/* Footer with Actions */}
        <div className="flex gap-3 p-6">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 min-h-11 px-4 py-2 bg-surface-elevated hover:bg-white/10 border border-border-subtle text-text-secondary text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 min-h-11 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isDangerous
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-primary hover:bg-primary-hover text-background'
            }`}
          >
            {isLoading ? 'Loading...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
