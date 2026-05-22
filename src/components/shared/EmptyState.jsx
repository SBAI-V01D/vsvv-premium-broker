import React from 'react'
import { cn } from '@/lib/utils'
import {
  FileText, Users, TrendingUp, CheckSquare, AlertCircle,
  Inbox, Clock, Shield, Building2, Zap, Target, FolderOpen,
  Activity, Briefcase, FileCheck, PieChart
} from 'lucide-react'

/**
 * ─────────────────────────────────────────────────────────────
 * EMPTY STATE — Global Enterprise Component
 * ─────────────────────────────────────────────────────────────
 * 
 * Konsistenter EmptyState für alle Pages:
 * - Documents, Customers, Contracts, Tasks, Leads, Opportunities
 * - Dossiers, Incidents, Validation, Household, Search
 * 
 * Verhindert:
 * - Leere Tables ohne Kontext
 * - Inkonsistente Abstände
 * - Zufällige Placeholder-Designs
 */

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
  folder: FolderOpen,
  activity: Activity,
  briefcase: Briefcase,
  fileCheck: FileCheck,
  chart: PieChart,
}

const COLOR_MAP = {
  documents: 'text-blue-600 bg-blue-50',
  customers: 'text-violet-600 bg-violet-50',
  opportunities: 'text-emerald-600 bg-emerald-50',
  tasks: 'text-amber-600 bg-amber-50',
  alerts: 'text-rose-600 bg-rose-50',
  contracts: 'text-indigo-600 bg-indigo-50',
  companies: 'text-slate-600 bg-slate-50',
  leads: 'text-pink-600 bg-pink-50',
  deals: 'text-cyan-600 bg-cyan-50',
  time: 'text-orange-600 bg-orange-50',
  empty: 'text-slate-500 bg-slate-50',
  folder: 'text-slate-600 bg-slate-50',
  activity: 'text-teal-600 bg-teal-50',
  briefcase: 'text-slate-600 bg-slate-50',
  fileCheck: 'text-green-600 bg-green-50',
  chart: 'text-blue-600 bg-blue-50',
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
    sm: 'p-4 gap-2',
    md: 'p-8 gap-3',
    lg: 'p-12 gap-4',
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
      'flex flex-col items-center justify-center text-center rounded-xl border border-dashed bg-gradient-to-br from-slate-50/80 to-white',
      sizeClasses[size],
      className
    )}>
      <div className={cn(
        'rounded-full p-2.5',
        colors
      )}>
        <Icon className={iconSizes[size]} />
      </div>

      {title && (
        <h3 className={cn(
          'font-semibold text-slate-800',
          titleSizes[size]
        )}>
          {title}
        </h3>
      )}

      {description && (
        <p className="text-sm text-slate-500 max-w-md">
          {description}
        </p>
      )}

      {action && (
        <div className="mt-1">
          {action}
        </div>
      )}
    </div>
  )
}

/**
 * ─────────────────────────────────────────────────────────────
 * LOADING STATE — Global Enterprise Component
 * ─────────────────────────────────────────────────────────────
 * 
 * Einheitliche Skeleton-Logik für alle Pages:
 * - Tables, Cards, Dashboard-KPIs, Timelines
 * - Intelligence Panels, Listen, Grids
 * 
 * Wichtig:
 * - Gleiche Höhen für alle Skeleton-Typen
 * - Gleiche Animation (pulse)
 * - Gleiche Surface-Struktur
 * - Verhindert Layout Shifts
 */

export function LoadingState({ 
  rows = 5, 
  type = 'list',
  className 
}) {
  const rowHeight = type === 'table' 
    ? 'h-12' 
    : type === 'card' 
    ? 'h-32' 
    : type === 'kpi'
    ? 'h-20'
    : 'h-14'

  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'rounded-lg bg-slate-100 animate-pulse',
            rowHeight
          )}
        />
      ))}
    </div>
  )
}

/**
 * Card-specific Loading State
 */
export function LoadingCard({ count = 3, className }) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-32 rounded-xl bg-slate-100 animate-pulse" />
      ))}
    </div>
  )
}

/**
 * Table-specific Loading State
 */
export function LoadingTable({ rows = 8, className }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 rounded-lg bg-slate-100 animate-pulse" />
      ))}
    </div>
  )
}

/**
 * KPI/Stat Loading State
 */
export function LoadingKPI({ count = 4, className }) {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
      ))}
    </div>
  )
}