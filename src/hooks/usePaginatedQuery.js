/**
 * usePaginatedQuery — Enterprise Pagination Hook
 *
 * Serverseitige Pagination für alle grossen Datensätze.
 * Verhindert list()-Overload bei Audit-Logs, Incidents, Exports, Leads etc.
 *
 * Usage:
 *   const { data, page, totalPages, nextPage, prevPage, isLoading } =
 *     usePaginatedQuery('audit_logs', () => base44.entities.AuditLog, {
 *       filter: { level: 'error' },
 *       sort: '-timestamp',
 *       pageSize: 50,
 *     });
 */
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function usePaginatedQuery(queryKey, entityName, {
  filter = {},
  sort = '-created_date',
  pageSize = 50,
  staleTime = 30_000,
} = {}) {
  const [page, setPage] = useState(0); // 0-indexed

  const { data = [], isLoading, isFetching } = useQuery({
    queryKey: [queryKey, page, filter, sort, pageSize],
    queryFn: () => {
      const entity = base44.entities[entityName];
      if (!entity) return [];
      const hasFilter = Object.keys(filter).length > 0;
      if (hasFilter) {
        return entity.filter(filter, sort, pageSize, page * pageSize);
      }
      return entity.list(sort, pageSize, page * pageSize);
    },
    staleTime,
    keepPreviousData: true,
  });

  const nextPage = useCallback(() => setPage(p => p + 1), []);
  const prevPage = useCallback(() => setPage(p => Math.max(0, p - 1)), []);
  const goToPage = useCallback((p) => setPage(Math.max(0, p)), []);
  const reset    = useCallback(() => setPage(0), []);

  const hasMore = data.length === pageSize;
  const hasPrev = page > 0;

  return {
    data,
    page,
    pageSize,
    isLoading,
    isFetching,
    hasMore,
    hasPrev,
    nextPage,
    prevPage,
    goToPage,
    reset,
    // Helper: offset for display ("Einträge 1–50")
    rangeStart: page * pageSize + 1,
    rangeEnd:   page * pageSize + data.length,
  };
}

/**
 * PaginationBar — Wiederverwendbare UI-Komponente für Pagination
 */
export function PaginationBar({ page, hasMore, hasPrev, nextPage, prevPage, rangeStart, rangeEnd, isFetching }) {
  if (!hasMore && !hasPrev) return null;
  return (
    <div className="flex items-center justify-between px-1 pt-3 border-t border-border/60 mt-3">
      <span className="text-xs text-muted-foreground">
        {isFetching ? 'Lade…' : `Einträge ${rangeStart}–${rangeEnd}`}
      </span>
      <div className="flex gap-2">
        <button
          onClick={prevPage}
          disabled={!hasPrev || isFetching}
          className="text-xs px-3 py-1.5 border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Zurück
        </button>
        <span className="text-xs px-2 py-1.5 text-muted-foreground">Seite {page + 1}</span>
        <button
          onClick={nextPage}
          disabled={!hasMore || isFetching}
          className="text-xs px-3 py-1.5 border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Weiter →
        </button>
      </div>
    </div>
  );
}