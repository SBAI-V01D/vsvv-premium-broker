import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      // Kein Re-fetch bei Focus — spart unnötige Requests
      refetchOnWindowFocus: false,
      // Kurze Retry-Logik
      retry: 1,
      retryDelay: 1000,
      // Daten 3 Minuten als "frisch" betrachten → kein unnötiger Re-fetch
      staleTime: 3 * 60 * 1000,
      // Cache 10 Minuten halten (für Schnellnavigation)
      gcTime: 10 * 60 * 1000,
    },
    mutations: {
      retry: 0,
    },
  },
});