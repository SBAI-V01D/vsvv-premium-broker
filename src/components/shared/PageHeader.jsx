import React from 'react'

/**
 * Standardisierter Seitenheader für alle Hauptseiten.
 * Props:
 *  - title: string
 *  - subtitle: string (optional)
 *  - actions: ReactNode (Buttons oben rechts)
 */
export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-1.5 flex-wrap">{actions}</div>
      )}
    </div>
  )
}