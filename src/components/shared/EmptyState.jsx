import React from 'react'
import { cn } from '@/lib/utils'

/**
 * Einheitlicher Empty State für Listen, Tabellen, Panels.
 * Props:
 *  - icon: LucideIcon (optional)
 *  - title: string
 *  - description: string (optional)
 *  - action: ReactNode (Button etc., optional)
 *  - className: string (optional)
 */
export default function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-16 px-6 text-center',
      className
    )}>
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-muted-foreground" />
        </div>
      )}
      <p className="text-sm font-medium text-foreground mb-1">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}