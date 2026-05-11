/**
 * DocumentTagBadge — Zeigt Dokument-Tags als farbige Badges
 */
import React from 'react'
import { cn } from '@/lib/utils'

const TAG_CONFIG = {
  police:       { label: 'Police',        color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  antrag:       { label: 'Antrag',        color: 'bg-blue-100 text-blue-700 border-blue-200' },
  offerte:      { label: 'Offerte',       color: 'bg-violet-100 text-violet-700 border-violet-200' },
  kuendigung:   { label: 'Kündigung',     color: 'bg-red-100 text-red-700 border-red-200' },
  nachtrag:     { label: 'Nachtrag',      color: 'bg-amber-100 text-amber-700 border-amber-200' },
  review:       { label: 'Review',        color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  schadensmeldung: { label: 'Schaden',    color: 'bg-red-100 text-red-700 border-red-200' },
  gesundheitsdeklaration: { label: 'Gesundheit', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  rechnung:     { label: 'Rechnung',      color: 'bg-slate-100 text-slate-600 border-slate-200' },
  mahnung:      { label: 'Mahnung',       color: 'bg-red-100 text-red-700 border-red-200' },
  vollmacht:    { label: 'Vollmacht',     color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  korrespondenz:{ label: 'Korrespondenz', color: 'bg-slate-100 text-slate-600 border-slate-200' },
}

export default function DocumentTagBadge({ tag, className }) {
  const cfg = TAG_CONFIG[tag] || { label: tag, color: 'bg-slate-100 text-slate-600 border-slate-200' }
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border', cfg.color, className)}>
      {cfg.label}
    </span>
  )
}

export { TAG_CONFIG }