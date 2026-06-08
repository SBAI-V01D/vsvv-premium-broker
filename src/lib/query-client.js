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
      refetchOnWindowFocus: true,
      staleTime: 0,
      gcTime: 30 * 60 * 1000,
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
    const status = error?.response?.status || error?.status;
    if (status !== 401 && status !== 403) {
      logQueryError(error, event.query);
    }
  }
});

// ── Globale Real-time Subscriptions ──────────────────────────────────────────
// Alle kritischen Entities werden per Subscription überwacht.
// Bei jeder Änderung (create/update/delete) werden SOFORT alle betroffenen
// Query-Keys invalidiert — appweit, ohne manuelles Invalidieren in jeder Komponente.

function setupGlobalSubscriptions() {
  // Contract: Invalidiert alle contract-bezogenen Queries sofort
  base44.entities.Contract.subscribe((event) => {
    queryClientInstance.invalidateQueries({ queryKey: ['contracts'] });
    if (event.data?.customer_id) {
      queryClientInstance.invalidateQueries({ queryKey: ['contracts', event.data.customer_id] });
      queryClientInstance.invalidateQueries({ queryKey: ['household-contracts', event.data.customer_id] });
      queryClientInstance.invalidateQueries({ queryKey: ['household-contracts-all', event.data.customer_id] });
      // Auch primary_customer_id falls vorhanden
      if (event.data?.primary_customer_id) {
        queryClientInstance.invalidateQueries({ queryKey: ['household-contracts-all', event.data.primary_customer_id] });
      }
    }
  });

  // Application: Invalidiert alle application-bezogenen Queries sofort
  base44.entities.Application.subscribe((event) => {
    queryClientInstance.invalidateQueries({ queryKey: ['applications'] });
    if (event.data?.customer_id) {
      queryClientInstance.invalidateQueries({ queryKey: ['applications', event.data.customer_id] });
    }
  });

  // Document: Invalidiert alle document-bezogenen Queries sofort
  base44.entities.Document.subscribe((event) => {
    queryClientInstance.invalidateQueries({ queryKey: ['documents'] });
    if (event.data?.customer_id) {
      queryClientInstance.invalidateQueries({ queryKey: ['documents', event.data.customer_id] });
    }
  });

  // Task: Invalidiert alle task-bezogenen Queries sofort
  base44.entities.Task.subscribe((event) => {
    queryClientInstance.invalidateQueries({ queryKey: ['tasks'] });
    if (event.data?.customer_id) {
      queryClientInstance.invalidateQueries({ queryKey: ['tasks', event.data.customer_id] });
    }
  });

  // Customer: Invalidiert Kundendaten sofort
  base44.entities.Customer.subscribe((event) => {
    queryClientInstance.invalidateQueries({ queryKey: ['customers'] });
    if (event.data?.id) {
      queryClientInstance.invalidateQueries({ queryKey: ['customer', event.data.id] });
    }
    if (event.data?.primary_customer_id) {
      queryClientInstance.invalidateQueries({ queryKey: ['family-members', event.data.primary_customer_id] });
    }
  });
}

// Subscriptions starten — einmalig beim App-Start
setupGlobalSubscriptions();