import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      // Nur neu laden wenn explizit invalidiert (z.B. nach Mutation)
      // Verhindert unnötige Re-fetches bei Tab-Wechsel in einem CRM
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      // Stammdaten (Kunden, Verträge) sind 3 Minuten gültig — kein Re-fetch beim Navigieren
      staleTime: 3 * 60 * 1000,
      // Cache 10 Minuten halten — schnelle Rücknavigation ohne Reload
      gcTime: 10 * 60 * 1000,
      retry: 1,
      retryDelay: 1000,
    },
    mutations: {
      retry: 0,
    },
  },
});