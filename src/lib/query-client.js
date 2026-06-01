import { QueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// ── Silent error logger — schreibt kritische Query-Fehler in SystemLog ──
async function logQueryError(error, query) {
  try {
    const key = Array.isArray(query?.queryKey) ? query.queryKey.join('/') : String(query?.queryKey ?? 'unknown');
    await base44.entities.SystemLog.create({
      level: 'error',
      source: 'query_client',
      message: `Query-Fehler: ${error?.message ?? 'Unbekannter Fehler'}`,
      details: JSON.stringify({ queryKey: key, stack: error?.stack?.slice(0, 500) }),
      related_entity_type: key.split('/')[0] || null,
    });
  } catch { /* nie den normalen Flow unterbrechen */ }
}

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      // refetchOnMount: false — zeigt gecachte Daten sofort, kein Reload bei Seitennavigation
      // Daten werden nur neu geladen wenn: Mutation invalidiert, staleTime abgelaufen, oder manuell
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      // 15 Minuten staleTime — CRM-Daten ändern sich selten ohne eigene Aktion
      staleTime: 15 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
      retry: (failureCount, error) => {
        const status = error?.response?.status || error?.status;
        if (status === 401 || status === 403 || status === 404) return false;
        return failureCount < 1;
      },
      retryDelay: 800,
      placeholderData: (prev) => prev,
    },
    mutations: {
      retry: 0,
    },
  },
});

// ── Globaler Error-Handler: loggt Query-Fehler automatisch ──
queryClientInstance.getQueryCache().subscribe((event) => {
  if (event?.type === 'updated' && event?.query?.state?.status === 'error') {
    const error = event.query.state.error;
    // Nur echte Fehler — nicht 401/403
    const status = error?.response?.status || error?.status;
    if (status !== 401 && status !== 403) {
      logQueryError(error, event.query);
    }
  }
});