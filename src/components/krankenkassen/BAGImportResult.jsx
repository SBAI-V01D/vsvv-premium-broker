import React from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export default function BAGImportResult({ uploadResult }) {
  if (!uploadResult) return null;

  return (
    <div className={`p-4 rounded-lg border ${uploadResult.error ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
      {uploadResult.error ? (
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="w-4 h-4" />
          <p className="font-medium text-sm">{uploadResult.error}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="w-5 h-5" />
            <p className="font-bold text-base">{uploadResult.message}</p>
          </div>

          {/* Import-Statistik */}
          <div className="grid grid-cols-4 gap-3 text-sm">
            <div className="p-2 bg-white rounded border">
              <p className="text-muted-foreground text-xs">Gesamt</p>
              <p className="font-bold text-lg">{uploadResult.results?.gesamt?.toLocaleString()}</p>
            </div>
            <div className="p-2 bg-emerald-50 rounded border border-emerald-200">
              <p className="text-emerald-700 text-xs">Erfolgreich</p>
              <p className="font-bold text-lg text-emerald-700">{uploadResult.results?.erfolgreich?.toLocaleString()}</p>
            </div>
            <div className="p-2 bg-red-50 rounded border border-red-200">
              <p className="text-red-700 text-xs">Fehler</p>
              <p className="font-bold text-lg text-red-700">{uploadResult.results?.fehler?.toLocaleString() || 0}</p>
            </div>
            <div className="p-2 bg-blue-50 rounded border border-blue-200">
              <p className="text-blue-700 text-xs">Dauer</p>
              <p className="font-bold text-lg text-blue-700">{uploadResult.importdauer_minuten?.toFixed(2) || '-'} Min.</p>
            </div>
          </div>

          {/* Validierung */}
          {uploadResult.validierung && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600" />
                <p className="font-semibold text-sm text-blue-700">Automatische Validierung</p>
              </div>

              {/* Vollständigkeit */}
              <div className={`p-3 rounded border ${uploadResult.validierung.vollstaendigkeit.pass ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex justify-between items-center mb-2">
                  <p className="font-semibold text-sm">Vollständigkeit</p>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${uploadResult.validierung.vollstaendigkeit.pass ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'}`}>
                    {uploadResult.validierung.vollstaendigkeit.pass ? 'PASS' : 'FAIL'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Quelle:</span> <strong>{uploadResult.validierung.vollstaendigkeit.expected?.toLocaleString()}</strong></div>
                  <div><span className="text-muted-foreground">Importiert:</span> <strong>{uploadResult.validierung.vollstaendigkeit.actual?.toLocaleString()}</strong></div>
                  <div><span className="text-muted-foreground">Differenz:</span> <strong className={uploadResult.validierung.vollstaendigkeit.difference === 0 ? 'text-emerald-700' : 'text-amber-700'}>{uploadResult.validierung.vollstaendigkeit.difference?.toLocaleString()} ({uploadResult.validierung.vollstaendigkeit.difference_percent}%)</strong></div>
                </div>
              </div>

              {/* Datenqualität */}
              <div className={`p-3 rounded border ${uploadResult.validierung.datenqualitaet.pass ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex justify-between items-center mb-2">
                  <p className="font-semibold text-sm">Datenqualität</p>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${uploadResult.validierung.datenqualitaet.pass ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'}`}>
                    {uploadResult.validierung.datenqualitaet.pass ? 'PASS' : 'FAIL'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Versicherer:</span> <strong>{uploadResult.validierung.datenqualitaet.versicherer}</strong></div>
                  <div><span className="text-muted-foreground">Kantone:</span> <strong>{uploadResult.validierung.datenqualitaet.kantone}</strong></div>
                  <div><span className="text-muted-foreground">Regionen:</span> <strong>{uploadResult.validierung.datenqualitaet.regionen}</strong></div>
                  <div><span className="text-muted-foreground">Altersklassen:</span> <strong>{uploadResult.validierung.datenqualitaet.altersklassen}</strong></div>
                  <div><span className="text-muted-foreground">Modelle:</span> <strong>{uploadResult.validierung.datenqualitaet.modelle}</strong></div>
                  <div><span className="text-muted-foreground">Franchisen:</span> <strong>{uploadResult.validierung.datenqualitaet.franchisen}</strong></div>
                </div>
              </div>

              {/* Plausibilität */}
              <div className={`p-3 rounded border ${uploadResult.validierung.plausibilitaet.pass ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex justify-between items-center mb-2">
                  <p className="font-semibold text-sm">Plausibilitätsprüfung</p>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${uploadResult.validierung.plausibilitaet.pass ? 'bg-emerald-200 text-emerald-800' : 'bg-red-200 text-red-800'}`}>
                    {uploadResult.validierung.plausibilitaet.pass ? 'PASS' : 'FAIL'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(uploadResult.validierung.plausibilitaet.checks).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center bg-white px-2 py-1 rounded">
                      <span className="text-muted-foreground">{key.replace(/_/g, ' ')}</span>
                      <span className={value ? 'text-emerald-700' : 'text-red-700'}>{value ? '✓' : '✗'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Overall Status */}
              <div className={`p-4 rounded-lg border-2 text-center ${uploadResult.validierung.overall === 'PASS' ? 'bg-emerald-100 border-emerald-300' : 'bg-red-100 border-red-300'}`}>
                <p className={`text-2xl font-bold ${uploadResult.validierung.overall === 'PASS' ? 'text-emerald-800' : 'text-red-800'}`}>
                  {uploadResult.validierung.overall}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {uploadResult.validierung.overall === 'PASS' 
                    ? 'Alle Validierungen erfolgreich. Daten können verwendet werden.' 
                    : 'Validierung fehlgeschlagen. Bitte prüfen Sie die oben stehenden Details.'}
                </p>
              </div>
            </div>
          )}

          {/* Errors */}
          {uploadResult.errors && uploadResult.errors.length > 0 && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              <p className="font-semibold mb-1">Fehler ({uploadResult.errors.length}):</p>
              <div className="space-y-0.5 max-h-32 overflow-y-auto">
                {uploadResult.errors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}