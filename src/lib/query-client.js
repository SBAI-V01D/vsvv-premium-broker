import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: true,
      refetchOnWindowFocus: false,      // kein Reload bei Tab-Wechsel
      staleTime: 5 * 60 * 1000,         // 5 Min: Daten bleiben warm
      gcTime: 30 * 60 * 1000,           // 30 Min: Cache bleibt erhalten
      retry: 1,
      retryDelay: 1000,
      placeholderData: (prev) => prev,  // alte Daten sichtbar während Reload (kein Flackern)
    },
    mutations: {
      retry: 0,
    },
  },
});