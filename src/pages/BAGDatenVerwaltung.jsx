import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, Database, TrendingUp, Calendar, AlertCircle, RefreshCcw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import BAGDatenImport from '@/components/krankenkassen/BAGDatenImport';

export default function BAGDatenVerwaltung() {
  const { data: stats, isLoading, error, refetch } = useQuery({
    queryKey: ['bag-praemien-stats'],
    queryFn: async () => {
      try {
        const data = await base44.entities.BAGPraemienDaten.list();
        const jahre = [...new Set(data.map(d => d.jahr))].sort((a, b) => b - a);
        const kantone = [...new Set(data.map(d => d.kanton))].sort();
        const krankenkassen = [...new Set(data.map(d => d.krankenkasse))].sort();
        
        return {
          gesamtDatensätze: data.length,
          jahre,
          kantone: kantone.length,
          krankenkassen: krankenkassen.length,
          latestJahr: jahre[0] || null
        };
      } catch (err) {
        console.error('BAG Daten Fehler:', err);
        throw err;
      }
    },
    retry: 1,
    staleTime: 30000
  });

  return (
    <div className="p-6 page-enter">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">BAG-Prämiendaten</h1>
            <p className="text-muted-foreground">Offizielle Krankenkassen-Prämien vom Bundesamt für Gesundheit</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Aktualisieren
            </Button>
            <BAGDatenImport />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Lade Daten...</p>
        </div>
      ) : error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-6">
            <div className="flex items-center gap-3 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <div>
                <p className="font-semibold">Fehler beim Laden der Daten</p>
                <p className="text-sm">{error.message}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
              Erneut versuchen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gesamt-Datensätze</CardTitle>
                <Database className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.gesamtDatensätze || 0}</div>
                <p className="text-xs text-muted-foreground">Alle importierten Prämien</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Prämienjahr</CardTitle>
                <Calendar className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.latestJahr || '-'}</div>
                <p className="text-xs text-muted-foreground">Aktuellstes Jahr</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Kantone</CardTitle>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.kantone || 0}</div>
                <p className="text-xs text-muted-foreground">Abgedeckte Regionen</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Krankenkassen</CardTitle>
                <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.krankenkassen || 0}</div>
                <p className="text-xs text-muted-foreground">Versicherer im System</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                Verfügbare Prämien-Daten
              </CardTitle>
              <CardDescription>
                Übersicht der importierten BAG-Prämiendaten nach Jahr und Kanton
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats && stats.jahre.length > 0 ? (
                <div className="space-y-4">
                  {stats.jahre.map(jahr => (
                    <div key={jahr} className="p-4 rounded-lg border bg-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-lg">Prämien {jahr}</h3>
                        <Badge variant="outline">Aktiv</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Daten vom Bundesamt für Gesundheit (BAG) für das Prämienjahr {jahr}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileSpreadsheet className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground mb-4">
                    Noch keine BAG-Prämiendaten importiert
                  </p>
                  <BAGDatenImport />
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-6">
            <BAGDatenImport />
          </div>
        </>
      )}
    </div>
  );
}