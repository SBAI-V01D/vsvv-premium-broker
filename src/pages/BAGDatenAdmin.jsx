import React, { useState } from 'react';
import BAGDatenImport from '@/components/krankenkassen/BAGDatenImport';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Database, Calendar, Info, Trash2, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function BAGDatenAdmin() {
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState(null);
  const [deleted, setDeleted] = useState(0);
  const [totalEstimate, setTotalEstimate] = useState(0);

  const handleDeleteAll = async () => {
    if (!window.confirm('Alle BAG-Prämiendaten löschen? Dies kann nicht rückgängig gemacht werden!')) return;
    setDeleting(true);
    setDeleteResult(null);
    setDeleted(0);
    setTotalEstimate(0);

    let deletedSoFar = 0;
    const FETCH_SIZE = 500;

    while (true) {
      // Fetch a batch of IDs
      const batch = await base44.entities.BAGPraemienDaten.list('-created_date', FETCH_SIZE);
      if (!batch || batch.length === 0) break;

      if (deletedSoFar === 0) {
        // Estimate total on first batch
        setTotalEstimate(batch.length >= FETCH_SIZE ? 80000 : batch.length);
      }

      // Delete all in parallel (10 at a time)
      const CONCURRENCY = 10;
      for (let i = 0; i < batch.length; i += CONCURRENCY) {
        const chunk = batch.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map(r => base44.entities.BAGPraemienDaten.delete(r.id)));
        deletedSoFar += chunk.length;
        setDeleted(deletedSoFar);
      }

      if (batch.length < FETCH_SIZE) break;
    }

    setDeleteResult(`✅ ${deletedSoFar.toLocaleString()} Datensätze gelöscht.`);
    setDeleting(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" />
            BAG-Prämiendaten Verwaltung
          </h1>
          <p className="text-muted-foreground mt-1">
            Import und Verwaltung der offiziellen BAG-Krankenkassenprämien
          </p>
        </div>
        <Badge variant="outline" className="badge-info">
          Admin-Only
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Prämien-Datenimport
          </CardTitle>
          <CardDescription>
            Importieren Sie offizielle BAG-Prämiendaten für den Krankenkassenvergleich
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 mb-2">Datenquelle: Bundesamt für Gesundheit (BAG)</p>
                <p className="text-blue-700 mb-2">
                  Die Prämien-Daten werden jährlich vom BAG veröffentlicht und enthalten die offiziellen 
                  Krankenkassenprämien für alle Kantone, Modelle und Franchisen.
                </p>
                <ul className="list-disc list-inside text-blue-700 space-y-1">
                  <li>Alle anerkannten Krankenkassen in der Schweiz</li>
                  <li>Alle Versicherungsmodelle (Standard, Telmed, Hausarzt, HMO)</li>
                  <li>Alle Franchisen-Stufen (CHF 300 - 2500)</li>
                  <li>Differenziert nach Kanton, Region, Alter und Geschlecht</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-primary" />
                <p className="font-semibold text-sm">Jährliche Aktualisierung</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Prämien werden jedes Jahr im September/Oktober für das Folgejahr veröffentlicht
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-4 h-4 text-primary" />
                <p className="font-semibold text-sm">Zentrale Datenbank</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Alle Vergleiche nutzen die zentrale BAG-Datenbank als Single Source of Truth
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <FileSpreadsheet className="w-4 h-4 text-primary" />
                <p className="font-semibold text-sm">Excel-Import</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Einfacher Import via Excel/CSV-Dateien mit automatischer Validierung
              </p>
            </div>
          </div>

          <div className="pt-4 border-t space-y-3">
            <div className="flex items-center gap-3">
              <BAGDatenImport />
              <Button variant="destructive" size="sm" onClick={handleDeleteAll} disabled={deleting}>
                {deleting ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-2" />}
                Alle Daten löschen
              </Button>
              {deleteResult && <span className="text-xs text-emerald-700">{deleteResult}</span>}
            </div>
            {deleting && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{deleted.toLocaleString()} gelöscht{totalEstimate > 0 ? ` von ~${totalEstimate.toLocaleString()}` : ''}...</span>
                  {totalEstimate > 0 && <span>{Math.min(100, Math.round((deleted / totalEstimate) * 100))}%</span>}
                </div>
                <Progress value={totalEstimate > 0 ? Math.min(100, (deleted / totalEstimate) * 100) : undefined} className="h-2" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wichtige Termine für Krankenkassenwechsel</CardTitle>
          <CardDescription>
            Kritische Deadlines im Jahresverlauf
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
              <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />
              <div>
                <p className="text-sm font-semibold">15. Oktober - 30. November</p>
                <p className="text-xs text-muted-foreground">
                  Haupt-Kündigungsfrist für Wechsel auf den 1. Januar
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
              <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5" />
              <div>
                <p className="text-sm font-semibold">30. September</p>
                <p className="text-xs text-muted-foreground">
                  BAG veröffentlicht neue Prämien für nächstes Jahr
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
              <div>
                <p className="text-sm font-semibold">1. Januar</p>
                <p className="text-xs text-muted-foreground">
                  Inkrafttreten der neuen Prämien und Wechsel
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}