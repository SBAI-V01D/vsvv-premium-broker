import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

/**
 * DetailLayout — standardisiertes Layout für alle Detailseiten.
 *
 * Struktur:
 *   - Zurück-Button (optional)
 *   - Header mit Titel, Subtitle, Badge, Actions
 *   - Haupt-Content in konfigurierbarer Spaltenaufteilung
 *
 * Props:
 *  - backTo?: string                — Route für Zurück-Button (z.B. '/kunden')
 *  - backLabel?: string             — Label des Zurück-Links
 *  - title: string | ReactNode
 *  - subtitle?: string | ReactNode
 *  - badge?: ReactNode              — z.B. StatusBadge
 *  - actions?: ReactNode            — Buttons oben rechts
 *  - children: ReactNode
 *  - sidebar?: ReactNode            — Wenn gesetzt: 2-Spalten-Layout (main + sidebar)
 *  - sidebarWidth?: 'sm' | 'md' | 'lg'   — Breite der Sidebar (Default: 'md')
 *  - className?: string
 */

const SIDEBAR_WIDTHS = {
  sm: 'lg:grid-cols-[1fr_280px]',
  md: 'lg:grid-cols-[1fr_360px]',
  lg: 'lg:grid-cols-[1fr_440px]',
}

export default function DetailLayout({
  backTo,
  backLabel = 'Zurück',
  title,
  subtitle,
  badge,
  actions,
  children,
  sidebar,
  sidebarWidth = 'md',
  className,
}) {
  const navigate = useNavigate()

  return (
    <div className={cn('space-y-5', className)}>
      {/* Back navigation */}
      {backTo && (
        <button
          onClick={() => navigate(backTo)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {backLabel}
        </button>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold truncate">{title}</h1>
            {badge && <div className="flex-shrink-0">{badge}</div>}
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {actions}
          </div>
        )}
      </div>

      {/* Content */}
      {sidebar ? (
        <div className={cn('grid grid-cols-1 gap-5', SIDEBAR_WIDTHS[sidebarWidth] || SIDEBAR_WIDTHS.md)}>
          <main className="min-w-0 space-y-5">{children}</main>
          <aside className="space-y-5">{sidebar}</aside>
        </div>
      ) : (
        <div className="space-y-5">{children}</div>
      )}
    </div>
  )
}