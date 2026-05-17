import React from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * DetailCard — standardisierte Karte für Detailseiten-Sektionen.
 *
 * Props:
 *  - title?: string | ReactNode
 *  - actions?: ReactNode           — Buttons/Links oben rechts
 *  - padding?: 'sm' | 'md' | 'lg' — Innenabstand
 *  - className?: string
 *  - children: ReactNode
 *
 * Variante <DetailField> — ein einzelnes Label+Wert-Paar.
 * Variante <DetailFieldGrid> — responsive Grid von DetailFields.
 */

export default function DetailCard({ title, actions, padding = 'md', className, children }) {
  const paddingMap = { sm: 'p-4', md: 'p-5', lg: 'p-6' }

  return (
    <Card className={cn('shadow-sm', className)}>
      {(title || actions) && (
        <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4 px-5">
          {title && (
            <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </CardHeader>
      )}
      <CardContent className={cn((title || actions) ? 'pt-0' : '', paddingMap[padding] || paddingMap.md)}>
        {children}
      </CardContent>
    </Card>
  )
}

/**
 * DetailField — einzelnes Label + Wert-Paar für Detailansichten.
 *
 * Props:
 *  - label: string
 *  - value?: string | ReactNode
 *  - fallback?: string             — Wenn value leer (Default: '—')
 *  - className?: string
 */
export function DetailField({ label, value, fallback = '—', className }) {
  const displayValue = value !== undefined && value !== null && value !== ''
    ? value
    : fallback

  return (
    <div className={cn('space-y-0.5', className)}>
      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-foreground">{displayValue}</dd>
    </div>
  )
}

/**
 * DetailFieldGrid — responsives Grid aus DetailFields.
 *
 * Props:
 *  - cols?: number (1 | 2 | 3 | 4)  — Spalten (Default: 2)
 *  - className?: string
 *  - children: ReactNode (DetailField-Elemente)
 */
export function DetailFieldGrid({ cols = 2, className, children }) {
  const colMap = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }

  return (
    <dl className={cn('grid gap-x-6 gap-y-4', colMap[cols] || colMap[2], className)}>
      {children}
    </dl>
  )
}