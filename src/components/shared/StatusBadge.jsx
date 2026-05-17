import React from 'react'
import { cn } from '@/lib/utils'

/**
 * Zentrales StatusBadge — ein Status = überall identisch.
 *
 * Props:
 *  - status: string           (Schlüssel — z.B. 'active', 'pending', 'cancelled')
 *  - label?: string           (Override Label, sonst aus MAP)
 *  - size?: 'sm' | 'md'      (default 'md')
 *  - dot?: boolean            (zeigt farbigen Punkt vor Label)
 *
 * Unterstützte Status-Schlüssel (erweiterbar):
 *  Customer:  active, inactive, prospect
 *  Contract:  active, pending, cancelled, expired, archived
 *  Application: new, in_progress, waiting, approved, rejected, archived
 *  Lead:      new, contacted, qualified, converted, lost
 *  Mandate:   valid, invalid, pending, expired
 *  General:   open, completed, high, medium, low, urgent
 */

const STATUS_MAP = {
  // ── Customer ──────────────────────────
  active:       { label: 'Aktiv',         color: 'green'  },
  inactive:     { label: 'Inaktiv',       color: 'gray'   },
  prospect:     { label: 'Interessent',   color: 'blue'   },

  // ── Contract ──────────────────────────
  pending:      { label: 'Ausstehend',    color: 'amber'  },
  cancelled:    { label: 'Gekündigt',     color: 'red'    },
  expired:      { label: 'Abgelaufen',    color: 'orange' },
  archived:     { label: 'Archiviert',    color: 'gray'   },

  // ── Application ───────────────────────
  new:          { label: 'Neu',           color: 'blue'   },
  in_progress:  { label: 'In Bearbeitung', color: 'amber' },
  waiting:      { label: 'Wartend',       color: 'orange' },
  approved:     { label: 'Genehmigt',     color: 'green'  },
  rejected:     { label: 'Abgelehnt',     color: 'red'    },

  // ── Lead ──────────────────────────────
  contacted:    { label: 'Kontaktiert',   color: 'blue'   },
  qualified:    { label: 'Qualifiziert',  color: 'purple' },
  converted:    { label: 'Konvertiert',   color: 'green'  },
  lost:         { label: 'Verloren',      color: 'red'    },

  // ── Mandate ───────────────────────────
  valid:        { label: 'Gültig',        color: 'green'  },
  invalid:      { label: 'Ungültig',      color: 'red'    },

  // ── Task / General ────────────────────
  open:         { label: 'Offen',         color: 'blue'   },
  completed:    { label: 'Erledigt',      color: 'green'  },

  // ── Priority ──────────────────────────
  high:         { label: 'Hoch',          color: 'red'    },
  medium:       { label: 'Mittel',        color: 'amber'  },
  low:          { label: 'Tief',          color: 'gray'   },
  urgent:       { label: 'Dringend',      color: 'red'    },
}

const COLOR_CLASSES = {
  green:  'bg-green-100  text-green-800  border-green-200',
  blue:   'bg-blue-100   text-blue-800   border-blue-200',
  amber:  'bg-amber-100  text-amber-800  border-amber-200',
  orange: 'bg-orange-100 text-orange-800 border-orange-200',
  red:    'bg-red-100    text-red-800    border-red-200',
  purple: 'bg-purple-100 text-purple-800 border-purple-200',
  gray:   'bg-gray-100   text-gray-600   border-gray-200',
  teal:   'bg-teal-100   text-teal-800   border-teal-200',
}

const DOT_CLASSES = {
  green:  'bg-green-500',
  blue:   'bg-blue-500',
  amber:  'bg-amber-500',
  orange: 'bg-orange-500',
  red:    'bg-red-500',
  purple: 'bg-purple-500',
  gray:   'bg-gray-400',
  teal:   'bg-teal-500',
}

export default function StatusBadge({ status, label, size = 'md', dot = false, className }) {
  const key = (status || '').toLowerCase().replace(/ /g, '_')
  const config = STATUS_MAP[key] || { label: status || '–', color: 'gray' }
  const displayLabel = label || config.label
  const color = config.color

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        COLOR_CLASSES[color] || COLOR_CLASSES.gray,
        className
      )}
    >
      {dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', DOT_CLASSES[color] || DOT_CLASSES.gray)} />
      )}
      {displayLabel}
    </span>
  )
}