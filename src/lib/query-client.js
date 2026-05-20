import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: true,
      refetchOnWindowFocus: true,   // Daten beim Tab-Wechsel automatisch neu laden
      staleTime: 60 * 1000,         // 1 Minute: nach 1 Min werden Daten beim Focus neu geladen
      gcTime: 10 * 60 * 1000,
      retry: 1,
      retryDelay: 1000,
    },
    mutations: {
      retry: 0,
    },
  },
});