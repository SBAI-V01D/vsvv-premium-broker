import React, { useState } from 'react'
import { HEALTH_LABELS, HEALTH_COLORS } from '@/lib/healthScore'
import { Info, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, FileText, TrendingUp, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Erweitertes Health Score Badge mit Erklärungen.
 * Zeigt nicht nur den Score, sondern auch die Hauptfaktoren.
 */
export default function HealthScoreDetail({ state, score, factors, showDetails = false }) {
  const [expanded, setExpanded] = useState(false)
  const colors = HEALTH_COLORS[state] || HEALTH_COLORS.healthy
  const label = HEALTH_LABELS[state] || state

  if (!state || score === undefined) return null

  // Hauptfaktoren extrahieren
  const factorItems = []

  if (factors) {
    // Positive Faktoren
    if (factors.contractCount >= 2) {
      factorItems.push({
        type: 'positive',
        icon: CheckCircle2,
        label: `${factors.contractCount} aktive Verträge`,
        impact: factors.contractCount >= 4 ? '+25' : '+15'
      })
    } else if (factors.contractCount === 0) {
      factorItems.push({
        type: 'negative',
        icon: AlertCircle,
        label: 'Keine aktiven Verträge',
        impact: '-30'
      })
    }

    if (factors.totalPremium >= 5000) {
      factorItems.push({
        type: 'positive',
        icon: TrendingUp,
        label: `Prämie CHF ${factors.totalPremium.toLocaleString('de-CH')}`,
        impact: factors.totalPremium >= 10000 ? '+15' : '+10'
      })
    }

    if (factors.expiringCount > 0) {
      factorItems.push({
        type: 'negative',
        icon: Clock,
        label: `${factors.expiringCount} Vertrag${factors.expiringCount > 1 ? 'e' : ''} läuft bald ab`,
        impact: `-${factors.expiringCount * 10}`
      })
    }

    if (factors.docCount >= 2) {
      factorItems.push({
        type: 'positive',
        icon: FileText,
        label: `${factors.docCount} Dokumente vorhanden`,
        impact: '+10'
      })
    } else if (factors.docCount === 0) {
      factorItems.push({
        type: 'negative',
        icon: AlertCircle,
        label: 'Keine Dokumente',
        impact: '-10'
      })
    }

    if (factors.openUrgentTasks > 0) {
      factorItems.push({
        type: 'negative',
        icon: AlertCircle,
        label: `${factors.openUrgentTasks} offene Aufgabe(n)`,
        impact: `-${factors.openUrgentTasks * 5}`
      })
    }
  }

  const displayScore = Math.max(0, Math.min(100, score))

  return (
    <div className="inline-flex flex-col">
      {/* Badge */}
      <button
        onClick={() => showDetails && setExpanded(!expanded)}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors',
          colors.badge,
          showDetails && 'hover:opacity-90 cursor-pointer'
        )}
      >
        <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
        {label}
        <span className="opacity-60 font-normal">({displayScore})</span>
        {showDetails && (
          expanded ? <ChevronUp className="w-3 h-3 opacity-60" /> : <ChevronDown className="w-3 h-3 opacity-60" />
        )}
      </button>

      {/* Details Panel */}
      {showDetails && expanded && factorItems.length > 0 && (
        <div className="absolute top-full left-0 mt-1.5 w-72 rounded-lg border border-border bg-popover shadow-lg z-50 p-3">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border">
            <Info className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-foreground">Score-Faktoren</span>
          </div>
          <div className="space-y-1.5">
            {factorItems.map((item, idx) => {
              const Icon = item.icon
              const isPositive = item.type === 'positive'
              return (
                <div key={idx} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <Icon className={cn(
                      'w-3 h-3 shrink-0',
                      isPositive ? 'text-emerald-600' : 'text-amber-600'
                    )} />
                    <span className="text-[11px] text-muted-foreground truncate">{item.label}</span>
                  </div>
                  <span className={cn(
                    'text-[10px] font-bold shrink-0',
                    isPositive ? 'text-emerald-700' : 'text-amber-700'
                  )}>
                    {item.impact}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}