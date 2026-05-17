import React from 'react'
import { cn } from '@/lib/utils'

/**
 * Einheitliche KPI-Kachel für alle Dashboards.
 * Props:
 *  - label: string
 *  - value: string | number
 *  - sub: string (optional, Unterzeile)
 *  - icon: LucideIcon (optional)
 *  - color: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'default'
 *  - onClick: () => void (optional)
 */
const COLOR_MAP = {
  blue:    { bg: 'bg-blue-50',   icon: 'text-blue-500',   value: 'text-blue-700'   },
  green:   { bg: 'bg-green-50',  icon: 'text-green-500',  value: 'text-green-700'  },
  amber:   { bg: 'bg-amber-50',  icon: 'text-amber-500',  value: 'text-amber-700'  },
  red:     { bg: 'bg-red-50',    icon: 'text-red-500',    value: 'text-red-700'    },
  purple:  { bg: 'bg-purple-50', icon: 'text-purple-500', value: 'text-purple-700' },
  default: { bg: 'bg-muted',     icon: 'text-muted-foreground', value: 'text-foreground' },
}

export default function KpiCard({ label, value, sub, icon: Icon, color = 'default', onClick }) {
  const colors = COLOR_MAP[color] || COLOR_MAP.default

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border bg-card p-4 flex items-start gap-3',
        onClick && 'cursor-pointer hover:shadow-md transition-shadow'
      )}
    >
      {Icon && (
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', colors.bg)}>
          <Icon className={cn('w-4 h-4', colors.icon)} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium truncate">{label}</p>
        <p className={cn('text-xl font-bold leading-tight', colors.value)}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  )
}