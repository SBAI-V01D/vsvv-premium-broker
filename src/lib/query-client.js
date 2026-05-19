import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      // Re-fetch beim Mounten der Komponente → beim Navigieren immer frische Daten
      refetchOnMount: true,
      // Re-fetch beim Focus-Wechsel (Tab wechseln & zurück)
      refetchOnWindowFocus: true,
      // Daten nach 30 Sekunden als "veraltet" markieren
      // → nächster Mount/Focus löst automatisch Re-fetch aus
      staleTime: 30 * 1000,
      // Cache 5 Minuten halten (für Schnellnavigation ohne Re-fetch wenn noch frisch)
      gcTime: 5 * 60 * 1000,
      // Kein Retry bei Navigations-Fehlern (schneller Fehler-Feedback)
      retry: 1,
      retryDelay: 1000,
    },
    mutations: {
      retry: 0,
    },
  },
});