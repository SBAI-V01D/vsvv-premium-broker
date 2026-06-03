/**
 * useRealtimeSync
 * Abonniert Echtzeit-Updates für kritische Entities und invalidiert
 * automatisch den React Query Cache bei jeder Änderung.
 * Einmal in AppLayout einbinden — wirkt global für alle Seiten.
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// Entity → QueryKey(s) die bei Änderung invalidiert werden
const ENTITY_QUERY_MAP = {
  Application:    ['applications'],
  Contract:       ['contracts'],
  Customer:       ['customers'],
  Document:       ['documents'],
  Task:           ['tasks'],
  CommissionEntry:['commissionEntries'],
  Notification:   ['notifications'],
};

export function useRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribers = Object.entries(ENTITY_QUERY_MAP).map(([entityName, queryKeys]) => {
      try {
        const entity = base44.entities[entityName];
        if (!entity?.subscribe) return null;

        return entity.subscribe(() => {
          queryKeys.forEach(key => {
            queryClient.invalidateQueries({ queryKey: [key] });
          });
        });
      } catch {
        return null;
      }
    });

    return () => {
      unsubscribers.forEach(unsub => { if (unsub) unsub(); });
    };
  }, [queryClient]);
}