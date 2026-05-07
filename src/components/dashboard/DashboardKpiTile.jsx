import React from 'react'
import { TrendingUp, TrendingDown, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Enterprise KPI Tile — used across all dashboard tabs.
 * Supports: value, label, sub-label, trend, icon, accent color, click.
 */
export default function DashboardKpiTile({
  label,
  value,
  sub,
  trend,       // number: positive = green, negative = red
  trendLabel,
  icon: Icon,
  accent = 'border-l-slate-400',
  onClick,
  highlight = false,
}) {
  const hasTrend = trend !== undefined && trend !== null
  const trendPositive = hasTrend && trend >= 0

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group text-left w-full p-4 rounded-xl border bg-card shadow-sm transition-all duration-200',
        'border-l-4 hover:shadow-md hover:-translate-y-0.5',
        highlight && 'ring-2 ring-primary/20',
        accent,
        onClick ? 'cursor-pointer' : 'cursor-default'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground truncate leading-none">{label}</p>
          <p className="text-2xl font-bold mt-2 leading-none tracking-tight">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>}
          {hasTrend && (
            <div className={cn('flex items-center gap-1 mt-1.5 text-xs font-medium', trendPositive ? 'text-emerald-600' : 'text-red-500')}>
              {trendPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{trendPositive ? '+' : ''}{trend}% {trendLabel || ''}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-muted/50 group-hover:bg-primary/10 transition-colors">
            <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        )}
      </div>
    </button>
  )
}