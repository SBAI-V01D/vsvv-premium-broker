/**
 * PriorityBadge — Universelle Prioritäts-Anzeige
 * ROT = kritisch, ORANGE = dringend, GRÜN = normal
 */
import React from 'react'
import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const CONFIGS = {
  critical: {
    label: 'Kritisch',
    icon: AlertTriangle,
    badge: 'bg-red-600 text-white',
    dot: 'bg-red-600',
    ring: 'ring-2 ring-red-400 ring-offset-1',
    text: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-300',
  },
  high: {
    label: 'Dringend',
    icon: AlertTriangle,
    badge: 'bg-orange-500 text-white',
    dot: 'bg-orange-500',
    ring: '',
    text: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
  },
  medium: {
    label: 'Offen',
    icon: Clock,
    badge: 'bg-amber-100 text-amber-700 border border-amber-200',
    dot: 'bg-amber-400',
    ring: '',
    text: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  low: {
    label: 'Normal',
    icon: CheckCircle2,
    badge: 'bg-slate-100 text-slate-600',
    dot: 'bg-slate-300',
    ring: '',
    text: 'text-slate-500',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
  },
  ok: {
    label: 'OK',
    icon: CheckCircle2,
    badge: 'bg-green-100 text-green-700',
    dot: 'bg-green-500',
    ring: '',
    text: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
  },
}

/**
 * @param {'critical'|'high'|'medium'|'low'|'ok'} level
 * @param {'badge'|'dot'|'text'|'full'} variant
 */
export default function PriorityBadge({ level = 'low', variant = 'badge', className }) {
  const cfg = CONFIGS[level] || CONFIGS.low
  const Icon = cfg.icon

  if (variant === 'dot') {
    return <span className={cn('inline-block w-2.5 h-2.5 rounded-full flex-shrink-0', cfg.dot, className)} />
  }

  if (variant === 'text') {
    return (
      <span className={cn('flex items-center gap-1 text-xs font-semibold', cfg.text, className)}>
        <Icon className="w-3 h-3" />
        {cfg.label}
      </span>
    )
  }

  if (variant === 'full') {
    return (
      <span className={cn('flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold', cfg.bg, cfg.border, 'border', className)}>
        <Icon className="w-3.5 h-3.5" />
        {cfg.label}
      </span>
    )
  }

  // default: badge
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold', cfg.badge, className)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

// Helper: Maps days/urgency to priority level
export function daysToPriority(days) {
  if (days === null || days === undefined) return 'low'
  if (days <= 0) return 'critical'
  if (days <= 30) return 'high'
  if (days <= 60) return 'medium'
  return 'low'
}

// Helper: Maps task priority string to level
export function taskPriorityToLevel(priority) {
  if (priority === 'urgent') return 'critical'
  if (priority === 'high') return 'high'
  if (priority === 'medium') return 'medium'
  return 'low'
}