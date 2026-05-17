import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Trash2, Archive, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Standardisierter Bestätigungsdialog für kritische Aktionen.
 *
 * Props:
 *  - open: boolean
 *  - onOpenChange: (open: boolean) => void
 *  - title: string
 *  - description: string
 *  - confirmLabel?: string (default 'Bestätigen')
 *  - cancelLabel?: string (default 'Abbrechen')
 *  - variant?: 'danger' | 'warning' | 'info' (default 'danger')
 *  - onConfirm: () => void | Promise<void>
 *  - loading?: boolean
 */
const VARIANT_CONFIG = {
  danger: {
    icon: Trash2,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    confirmClass: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    confirmClass: 'bg-amber-500 hover:bg-amber-600 text-white',
  },
  archive: {
    icon: Archive,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    confirmClass: '',
  },
  info: {
    icon: AlertCircle,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    confirmClass: '',
  },
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Bestätigen',
  cancelLabel = 'Abbrechen',
  variant = 'danger',
  onConfirm,
  loading = false,
}) {
  const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.danger
  const Icon = config.icon

  const handleConfirm = async () => {
    await onConfirm?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', config.iconBg)}>
              <Icon className={cn('w-5 h-5', config.iconColor)} />
            </div>
            <div>
              <DialogTitle className="text-base">{title}</DialogTitle>
              {description && (
                <DialogDescription className="mt-1 text-sm">{description}</DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="mt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            className={config.confirmClass || undefined}
            variant={config.confirmClass ? undefined : 'default'}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Bitte warten...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}