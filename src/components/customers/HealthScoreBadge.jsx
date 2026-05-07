import React from 'react'
import { HEALTH_LABELS, HEALTH_COLORS } from '@/lib/healthScore'

/**
 * Compact health score badge.
 * Props: state (string), score (number), showScore (bool)
 */
export default function HealthScoreBadge({ state, score, showScore = false, size = 'sm' }) {
  if (!state) return null
  const colors = HEALTH_COLORS[state] || HEALTH_COLORS.healthy
  const label  = HEALTH_LABELS[state] || state

  if (size === 'xs') {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium border ${colors.badge}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
        {label}
        {showScore && <span className="opacity-70">· {score}</span>}
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${colors.badge}`}>
      <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
      {label}
      {showScore && <span className="opacity-60 font-normal">({score})</span>}
    </span>
  )
}