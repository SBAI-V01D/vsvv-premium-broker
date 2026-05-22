/**
 * HealthScoreRing — Circular Progress Visualization
 * Premium Financial Platform: clean · minimal · data-driven
 */
import React from 'react'
import { cn } from '@/lib/utils'

/**
 * Berechnet HealthScore basierend auf:
 * - Aktive Verträge
 * - Prämienhöhe
 * - Renewal Risks
 * - Dokumente
 * - Tasks
 * - Mandat Status
 */
export function calculateHealthScore(customer, contracts, tasks, documents) {
  let score = 70 // Base score

  // Aktive Verträge (+15)
  const activeContracts = (contracts || []).filter(c => c.status === 'active')
  if (activeContracts.length > 0) score += 15
  if (activeContracts.length >= 3) score += 5

  // Prämienhöhe (+10)
  const totalPremium = customer.total_premium || 0
  if (totalPremium >= 10000) score += 10
  else if (totalPremium >= 5000) score += 7
  else if (totalPremium >= 2000) score += 4

  // Renewal Risks (-15)
  const now = new Date()
  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
  const criticalRenewals = (contracts || []).filter(c => {
    if (!c.cancellation_deadline) return false
    const cd = new Date(c.cancellation_deadline)
    return cd >= now && cd <= in90Days && c.status === 'active'
  })
  if (criticalRenewals.length > 0) score -= 15

  // Dokumente (-10)
  const docCount = (documents || []).length
  if (docCount === 0) score -= 10
  else if (docCount < 3) score -= 5

  // Offene Tasks (-10)
  const openTasks = (tasks || []).filter(t => t.status === 'open' || t.status === 'in_progress')
  const urgentTasks = openTasks.filter(t => t.priority === 'urgent')
  if (urgentTasks.length > 0) score -= 10
  else if (openTasks.length > 0) score -= 5

  // Mandat Status (-20)
  if (['invalid', 'expired'].includes(customer.mandate_status)) score -= 20
  else if (customer.mandate_status === 'pending') score -= 10

  // Status (-15)
  if (customer.status === 'inactive') score -= 15
  else if (customer.status === 'prospect') score -= 5

  // Clamp 0-100
  return Math.max(0, Math.min(100, score))
}

export function getHealthState(score) {
  if (score >= 80) return { state: 'excellent', label: 'Exzellent', color: 'text-emerald-600', bg: 'bg-emerald-500' }
  if (score >= 60) return { state: 'good', label: 'Gut', color: 'text-green-600', bg: 'bg-green-500' }
  if (score >= 40) return { state: 'fair', label: 'OK', color: 'text-amber-600', bg: 'bg-amber-500' }
  if (score >= 20) return { state: 'at_risk', label: 'Risiko', color: 'text-orange-600', bg: 'bg-orange-500' }
  return { state: 'critical', label: 'Kritisch', color: 'text-red-600', bg: 'bg-red-500' }
}

export default function HealthScoreRing({ score, size = 'md', showLabel = true }) {
  const state = getHealthState(score)
  
  const sizeConfig = {
    sm: { ring: 32, stroke: 3, text: 'text-[9px]' },
    md: { ring: 44, stroke: 4, text: 'text-[10px]' },
    lg: { ring: 56, stroke: 5, text: 'text-[11px]' },
  }
  
  const config = sizeConfig[size]
  const radius = (config.ring - config.stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="flex items-center gap-2">
      <div className="relative" style={{ width: config.ring, height: config.ring }}>
        {/* Background ring */}
        <svg className="transform -rotate-90" width={config.ring} height={config.ring}>
          <circle
            className="text-slate-200"
            strokeWidth={config.stroke}
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx={config.ring / 2}
            cy={config.ring / 2}
          />
          {/* Progress ring */}
          <circle
            className={cn('transition-all duration-500', state.bg)}
            strokeWidth={config.stroke}
            stroke="currentColor"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            r={radius}
            cx={config.ring / 2}
            cy={config.ring / 2}
          />
        </svg>
        {/* Score number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('font-bold tabular-nums', state.color, config.text)}>
            {score}
          </span>
        </div>
      </div>
      
      {showLabel && (
        <div className="hidden sm:block">
          <p className={cn('text-[9px] uppercase tracking-widest font-semibold', state.color)}>
            {state.label}
          </p>
        </div>
      )}
    </div>
  )
}