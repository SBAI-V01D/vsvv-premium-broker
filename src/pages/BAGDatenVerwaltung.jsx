import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Database, 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2,
  AlertCircle,
  TrendingDown
} from 'lucide-react';
import BAGDatenImport from '@/components/krankenkassen/BAGDatenImport';

export default function BAGDatenVerwaltung() {
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" />
            BAG-Prämiendaten Verwaltung
          </h1>
          <p className="text-muted-foreground mt-1">
            Offizielle Krankenkassen-Prämien des Bundesamts für Gesundheit
          </p>
        </div>
        <BAGDatenImport />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Datenimport
            </CardTitle>
            <CardDescription>
              Importieren Sie BAG-Prämiendaten aus Excel-Dateien
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-900 mb-1">Datenquelle</p>
              <p className="text-xs text-blue-700">
                Offizielle Prämien-Daten vom Bundesamt für Gesundheit (BAG).
                Die Daten werden jährlich aktualisiert und enthalten Prämien für alle Krankenkassen, Modelle und Franchisen.
              </p>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Kantonale Prämien (alle 26 Kantone)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Alle Versicherungsmodelle (Standard, Telmed, Hausarzt, HMO)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Alle Franchisen-Stufen (CHF 300 - 2500)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Erwachsenen- und Kinderprämien</span>
              </div>
            </div>

            <Button className="w-full" asChild>
              <a href="/krankenkassen-vergleich">
                <TrendingDown className="w-3.5 h-3.5 mr-2" />
                Zum Krankenkassenvergleich
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Datenqualität
            </CardTitle>
            <CardDescription>
              Status und Informationen zur Datenbank
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-muted-foreground">Datenbank</p>
                <p className="text-lg font-bold text-foreground">BAGPraemienDaten</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-muted-foreground">Aktuelles Jahr</p>
                <p className="text-lg font-bold text-foreground">2026</p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-900 mb-1">Manueller Import erforderlich</p>
                  <p className="text-amber-700 text-xs">
                    BAG-Daten müssen jährlich manuell importiert werden. 
                    Der Import erfolgt über Excel-Dateien direkt von bag.admin.ch.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <p className="font-medium">Unterstützte Formate:</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  Excel (.xlsx, .xls)
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  CSV (kommagetrennt)
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import-Anleitung</CardTitle>
          <CardDescription>
            So importieren Sie BAG-Prämiendaten korrekt
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
              <div>
                <p className="font-medium mb-1">Daten herunterladen</p>
                <p className="text-muted-foreground">
                  Laden Sie die offiziellen BAG-Prämiendaten von{' '}
                  <a href="https://www.bag.admin.ch/bag/de/home/versicherungen/krankenversicherung/krankenversicherung-praemien-und-oeffentliche-beitraege/pramiendaten.html" 
                     target="_blank" 
                     className="text-primary underline"
                     rel="noopener noreferrer">
                    bag.admin.ch
                  </a>{' '}
                  herunter.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
              <div>
                <p className="font-medium mb-1">Excel öffnen</p>
                <p className="text-muted-foreground">
                  Öffnen Sie die heruntergeladene Excel-Datei und prüfen Sie die Struktur. 
                  Stellen Sie sicher, dass die Spaltennamen den erwarteten Feldern entsprechen.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
              <div>
                <p className="font-medium mb-1">Import durchführen</p>
                <p className="text-muted-foreground">
                  Klicken Sie auf "BAG-Daten importieren", wählen Sie das Prämienjahr und laden Sie die Excel-Datei hoch.
                  Der Import verarbeitet alle Zeilen automatisch.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</span>
              <div>
                <p className="font-medium mb-1">Ergebnis prüfen</p>
                <p className="text-muted-foreground">
                  Nach dem Import sehen Sie eine Zusammenfassung der erfolgreich importierten Datensätze 
                  sowie eventuelle Fehlermeldungen.
                </p>
              </div>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}