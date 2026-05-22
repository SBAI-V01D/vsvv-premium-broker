import React from 'react'
import { cn } from '@/lib/utils'
import {
  FileText, Users, TrendingUp, CheckSquare, AlertCircle,
  Inbox, Clock, Shield, Building2, Zap, Target
} from 'lucide-react'

const ICON_MAP = {
  documents: FileText,
  customers: Users,
  opportunities: TrendingUp,
  tasks: CheckSquare,
  alerts: AlertCircle,
  contracts: Shield,
  companies: Building2,
  leads: Zap,
  deals: Target,
  time: Clock,
  empty: Inbox,
}

const COLOR_MAP = {
  documents: 'text-blue-500 bg-blue-50',
  customers: 'text-violet-500 bg-violet-50',
  opportunities: 'text-emerald-500 bg-emerald-50',
  tasks: 'text-amber-500 bg-amber-50',
  alerts: 'text-rose-500 bg-rose-50',
  contracts: 'text-indigo-500 bg-indigo-50',
  companies: 'text-slate-500 bg-slate-50',
  leads: 'text-pink-500 bg-pink-50',
  deals: 'text-cyan-500 bg-cyan-50',
  time: 'text-orange-500 bg-orange-50',
  empty: 'text-slate-400 bg-slate-50',
}

export default function EmptyState({
  type = 'empty',
  title,
  description,
  action,
  size = 'md',
  className
}) {
  const Icon = ICON_MAP[type] || ICON_MAP.empty
  const colors = COLOR_MAP[type] || COLOR_MAP.empty

  const sizeClasses = {
    sm: 'p-4',
    md: 'p-8',
    lg: 'p-12',
  }

  const titleSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  }

  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
  }

  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center rounded-xl border border-dashed bg-gradient-to-br from-slate-50/50 to-slate-50',
      sizeClasses[size],
      className
    )}>
      <div className={cn(
        'rounded-full p-3 mb-3',
        colors
      )}>
        <Icon className={iconSizes[size]} />
      </div>

      {title && (
        <h3 className={cn(
          'font-semibold text-slate-800 mb-1',
          titleSizes[size]
        )}>
          {title}
        </h3>
      )}

      {description && (
        <p className="text-sm text-slate-500 max-w-md mb-4">
          {description}
        </p>
      )}

      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </div>
  )
}

/**
 * Loading State Component
 */
export function LoadingState({ count = 3, type = 'list' }) {
  const itemClasses = type === 'card'
    ? 'h-32 rounded-xl'
    : type === 'table'
    ? 'h-12 rounded'
    : 'h-16 rounded-lg'

  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'bg-slate-100',
            itemClasses
          )}
        />
      ))}
    </div>
  )
}