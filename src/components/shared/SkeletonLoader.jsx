import React from 'react'
import { cn } from '@/lib/utils'

/**
 * Flexible Skeleton-Loader Komponenten für verschiedene UI-Bereiche.
 *
 * Exports:
 *  - SkeletonLoader   (Basis-Block, konfigurierbar)
 *  - SkeletonTable    (Tabellen-Skelett)
 *  - SkeletonCard     (Karten-Skelett)
 *  - SkeletonKpiRow   (KPI-Karten-Reihe)
 *  - SkeletonText     (Textzeilen)
 */

// ─── Basis-Block ────────────────────────────────────────────────────────────
export function SkeletonLoader({ className, style }) {
  return (
    <div
      className={cn('rounded-md bg-muted animate-pulse', className)}
      style={style}
    />
  )
}

// ─── Tabellen-Skelett ────────────────────────────────────────────────────────
export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="border-b bg-muted/40 px-4 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLoader key={i} className="h-3 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3 border-b last:border-0 flex gap-4 items-center">
          {Array.from({ length: cols }).map((_, j) => (
            <SkeletonLoader
              key={j}
              className={cn('h-4 flex-1', j === 0 && 'max-w-[8rem]')}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Karten-Skelett ──────────────────────────────────────────────────────────
export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-3">
      <SkeletonLoader className="h-4 w-2/5" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLoader key={i} className={cn('h-3', i === lines - 1 ? 'w-1/2' : 'w-full')} />
      ))}
    </div>
  )
}

// ─── KPI-Reihe ───────────────────────────────────────────────────────────────
export function SkeletonKpiRow({ count = 4 }) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-${Math.min(count, 4)} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4 flex items-start gap-3">
          <SkeletonLoader className="w-9 h-9 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonLoader className="h-3 w-3/4" />
            <SkeletonLoader className="h-6 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Textzeilen ─────────────────────────────────────────────────────────────
export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLoader
          key={i}
          className={cn('h-4', i === lines - 1 ? 'w-3/5' : 'w-full')}
        />
      ))}
    </div>
  )
}

export default SkeletonLoader