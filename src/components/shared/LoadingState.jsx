import React from 'react'
import { cn } from '@/lib/utils'

/**
 * Einheitlicher Loading State.
 * Props:
 *  - rows: number (Skeleton-Zeilen, default 5)
 *  - className: string (optional)
 */
export default function LoadingState({ rows = 5, className }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
      ))}
    </div>
  )
}