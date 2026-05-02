import React from 'react'
import { cn } from '@/lib/utils'

const COLOR_STYLES = {
  gray:   'bg-slate-100 text-slate-700 border-slate-200',
  blue:   'bg-blue-50 text-blue-700 border-blue-200',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  green:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  red:    'bg-red-50 text-red-700 border-red-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  teal:   'bg-teal-50 text-teal-700 border-teal-200',
}

const LEGACY_LABELS = {
  submitted: 'Eingereicht',
  draft: 'Entwurf',
  under_review: 'In Prüfung',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
  active: 'Aktiv',
  cancelled: 'Gekündigt',
  paused: 'Pausiert',
  expired: 'Abgelaufen',
}

export default function StatusBadge({ statusDef, label: fallbackLabel }) {
  const colorClass = COLOR_STYLES[statusDef?.color] || COLOR_STYLES.gray
  const displayLabel = statusDef?.label || LEGACY_LABELS[fallbackLabel] || fallbackLabel || '–'

  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', colorClass)}>
      {displayLabel}
    </span>
  )
}