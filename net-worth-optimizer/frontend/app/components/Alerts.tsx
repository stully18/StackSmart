'use client'

import React from 'react'
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react'

interface AlertProps {
  message: string
  onDismiss?: () => void
  autoClose?: boolean
  duration?: number
}

export function SuccessAlert({ message, onDismiss, autoClose = true, duration = 5000 }: AlertProps) {
  React.useEffect(() => {
    if (autoClose && onDismiss) {
      const timer = setTimeout(onDismiss, duration)
      return () => clearTimeout(timer)
    }
  }, [autoClose, duration, onDismiss])

  return (
    <div className="fixed top-4 right-4 bg-surface border-l-4 border-success rounded-lg p-4 max-w-md shadow-2xl shadow-black/60 animate-fade-in-up z-50">
      <div className="flex items-start gap-3">
        <CheckCircle size={18} className="text-success mt-0.5" />
        <div className="flex-1">
          <p className="text-text-primary text-sm font-medium">{message}</p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-text-muted hover:text-text-secondary transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

export function ErrorAlert({ message, onDismiss, autoClose = false }: AlertProps) {
  return (
    <div className="fixed top-4 right-4 bg-surface border-l-4 border-destructive rounded-lg p-4 max-w-md shadow-2xl shadow-black/60 animate-fade-in-up z-50">
      <div className="flex items-start gap-3">
        <XCircle size={18} className="text-destructive mt-0.5" />
        <div className="flex-1">
          <p className="text-text-primary text-sm font-medium">{message}</p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-text-muted hover:text-text-secondary transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

export function WarningAlert({ message, onDismiss, autoClose = false }: AlertProps) {
  return (
    <div className="fixed top-4 right-4 bg-surface border-l-4 border-warning rounded-lg p-4 max-w-md shadow-2xl shadow-black/60 animate-fade-in-up z-50">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="text-warning mt-0.5" />
        <div className="flex-1">
          <p className="text-text-primary text-sm font-medium">{message}</p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-text-muted hover:text-text-secondary transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
