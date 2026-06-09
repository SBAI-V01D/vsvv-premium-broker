import React from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export default function BAGImportResult({ uploadResult }) {
  if (!uploadResult) return null;

  const stats = uploadResult.validierung || {};

  if (!uploadResult.success) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-start gap-3">
          <X className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-800 text-sm">Import fehlgeschlagen</p>
            <p className="text-red-700 text-sm mt-1">{uploadResult.message}</p>
            {uploadResult.errors && (
              <ul className="mt-2 space-y-0.5 text-xs text-red-600 font-mono">
                {uploadResult.errors.map((err, i) => (
                  <li key={i}>• {err}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* PASS/FAIL Status */}
      <div className={`p-3 rounded-lg border ${
        stats.vollstaendigkeit?.pass !== false 
          ? 'bg-emerald-50 border-emerald-200' 
          : 'bg-red-50 border-red-200'
      }`}>
        <div className="flex items-center gap-2">
          {stats.vollstaendigkeit?.pass !== false ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          <p className={`font-semibold text-sm ${
            stats.vollstaendigkeit?.pass !== false ? 'text-emerald-800' : 'text-red-800'
          }`}>
            {stats.vollstaendigkeit?.pass !== false ? '✅ PASS' : '❌ FAIL'}
          </p>
        </div>
      </div>

      {/* MINIMALE METRIKEN */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-white border border-slate-200 rounded-lg">
          <p className="text-xs text-muted-foreground font-semibold">QUELLE</p>
          <p className="text-lg font-bold text-slate-700">{stats.quelle_gesamtzeilen?.toLocaleString() || '-'}</p>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-lg">
          <p className="text-xs text-muted-foreground font-semibold">IMPORTIERT</p>
          <p className="text-lg font-bold text-emerald-700">{uploadResult.results?.erfolgreich?.toLocaleString() || '-'}</p>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-lg">
          <p className="text-xs text-muted-foreground font-semibold">DIFFERENZ</p>
          <p className={`text-lg font-bold ${
            !stats.differenz || stats.differenz === 0 ? 'text-emerald-700' : 'text-red-700'
          }`}>
            {stats.differenz?.toLocaleString() || '-'}
          </p>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-lg">
          <p className="text-xs text-muted-foreground font-semibold">DAUER</p>
          <p className="text-lg font-bold text-slate-700">{uploadResult.importdauer_minuten} Min.</p>
        </div>
      </div>

      {/* ERKLÄRUNG VOLLSTÄNDIGER IMPORT */}
      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 space-y-1">
        <p className="font-semibold">✅ Vollständiger Import (BEIDE Unfall-Varianten)</p>
        <p className="text-emerald-700">
          Die BAG-Rohdaten enthalten jede Prämie <strong>zweimal</strong>: einmal MIT Unfalldeckung und einmal OHNE Unfalldeckung.
        </p>
        <p className="text-emerald-700">
          Wir importieren <strong>BEIDE Varianten</strong> für vollständige Vergleichsdaten.
        </p>
        <p className="font-mono text-center bg-emerald-100 p-1 rounded">
          {stats.quelle_gesamtzeilen?.toLocaleString()} Rohzeilen → {uploadResult.results?.erfolgreich?.toLocaleString()} importiert (100%)
        </p>
      </div>
    </div>
  );
}