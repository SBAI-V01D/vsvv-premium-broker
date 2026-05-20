import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      // Stammdaten (Kunden, Berater, Org): 3 Minuten — ändern sich selten
      // Für Status-kritische Daten (Anträge, Verträge) staleTime im useQuery überschreiben:
      //   useQuery({ queryKey: [...], queryFn: ..., staleTime: 30 * 1000 })
      staleTime: 3 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      retryDelay: 1000,
    },
    mutations: {
      retry: 0,
    },
  },
});