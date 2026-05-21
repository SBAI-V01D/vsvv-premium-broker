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
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: (failureCount, error) => {
        // Keine Retries bei Autorisierungsfehlern
        if (error?.response?.status === 401 || error?.response?.status === 403) return false;
        return failureCount < 1;
      },
      retryDelay: 1200,
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