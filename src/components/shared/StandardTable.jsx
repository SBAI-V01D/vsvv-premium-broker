import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import EmptyState, { LoadingTable } from './EmptyState'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Standardisierte Tabelle für alle Listen im CRM.
 *
 * Props:
 *  - columns: Array<{
 *      key: string,
 *      label: string,
 *      sortable?: boolean,
 *      width?: string,         // Tailwind width class e.g. 'w-32'
 *      align?: 'left' | 'right' | 'center',
 *      render?: (value, row) => ReactNode
 *    }>
 *  - data: Array<object>
 *  - isLoading?: boolean
 *  - emptyIcon?: LucideIcon
 *  - emptyTitle?: string
 *  - emptyDescription?: string
 *  - emptyAction?: ReactNode
 *  - onRowClick?: (row) => void
 *  - pageSize?: number (default 25, 0 = no pagination)
 *  - sortKey?: string
 *  - sortDir?: 'asc' | 'desc'
 *  - onSort?: (key: string) => void
 *  - className?: string
 *  - rowClassName?: (row) => string
 */
export default function StandardTable({
  columns = [],
  data = [],
  isLoading = false,
  emptyIcon,
  emptyTitle = 'Keine Daten',
  emptyDescription,
  emptyAction,
  onRowClick,
  pageSize = 25,
  sortKey,
  sortDir = 'asc',
  onSort,
  className,
  rowClassName,
}) {
  const [page, setPage] = React.useState(1)

  // Reset page when data changes
  React.useEffect(() => { setPage(1) }, [data.length])

  const totalPages = pageSize > 0 ? Math.ceil(data.length / pageSize) : 1
  const paginated = pageSize > 0
    ? data.slice((page - 1) * pageSize, page * pageSize)
    : data

  if (isLoading) return <LoadingTable rows={6} />

  if (data.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    )
  }

  const alignClass = {
    left: 'text-left',
    right: 'text-right',
    center: 'text-center',
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Scrollable table */}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              {columns.map(col => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide select-none',
                    alignClass[col.align || 'left'],
                    col.width,
                    col.sortable && onSort && 'cursor-pointer hover:text-foreground transition-colors'
                  )}
                  onClick={() => col.sortable && onSort && onSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      sortDir === 'asc'
                        ? <ChevronUp className="w-3 h-3" />
                        : <ChevronDown className="w-3 h-3" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((row, idx) => (
              <tr
                key={row.id || idx}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'border-b last:border-0 transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-muted/40',
                  rowClassName?.(row)
                )}
              >
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 py-3',
                      alignClass[col.align || 'left'],
                      col.width
                    )}
                  >
                    {col.render
                      ? col.render(row[col.key], row)
                      : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageSize > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 px-1">
          <p className="text-xs text-muted-foreground">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, data.length)} von {data.length}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="w-3 h-3" />
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              Seite {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}