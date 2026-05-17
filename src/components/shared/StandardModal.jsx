import React from 'react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

/**
 * StandardModal — einheitliche Basis für alle Dialog-Formulare.
 *
 * Props:
 *  - open: boolean
 *  - onOpenChange: (open: boolean) => void
 *  - title: string
 *  - description?: string
 *  - size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
 *  - onSubmit?: () => void         — wenn gesetzt: Submit-Button erscheint
 *  - submitLabel?: string          — Default: 'Speichern'
 *  - onCancel?: () => void         — Default: onOpenChange(false)
 *  - cancelLabel?: string          — Default: 'Abbrechen'
 *  - isSubmitting?: boolean        — zeigt Ladeindikator auf Submit-Button
 *  - isDestructive?: boolean       — Submit-Button rot (für Lösch-Dialoge)
 *  - hideFooter?: boolean          — Kein Footer (wenn Formular eigene Buttons hat)
 *  - className?: string
 *  - children: ReactNode
 */

const SIZE_MAP = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
  full: 'sm:max-w-6xl',
}

export default function StandardModal({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  onSubmit,
  submitLabel = 'Speichern',
  onCancel,
  cancelLabel = 'Abbrechen',
  isSubmitting = false,
  isDestructive = false,
  hideFooter = false,
  className,
  children,
}) {
  const handleCancel = () => {
    if (onCancel) onCancel()
    else onOpenChange(false)
  }

  const showFooter = !hideFooter && (onSubmit || cancelLabel)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(SIZE_MAP[size] || SIZE_MAP.md, 'max-h-[90vh] overflow-y-auto', className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          {children}
        </div>

        {showFooter && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              {cancelLabel}
            </Button>
            {onSubmit && (
              <Button
                type="button"
                variant={isDestructive ? 'destructive' : 'default'}
                onClick={onSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {submitLabel}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}