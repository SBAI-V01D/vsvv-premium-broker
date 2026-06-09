import React from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export default function BAGImportResult({ uploadResult }) {
  if (!uploadResult) return null;

  if (!uploadResult.success) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2 text-red-700 font-semibold mb-2">
          <AlertCircle className="w-5 h-5" />
          Import fehlgeschlagen
        </div>
        <p className="text-sm text-red-600">{uploadResult.message}</p>
        {uploadResult.errors && (
          <div className="mt-3 p-2 bg-red-100 rounded text-xs text-red-700 max-h-32 overflow-y-auto">
            <p className="font-semibold mb-1">Fehler:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {uploadResult.errors.slice(0, 5).map((err, i) => (
                <li key={i}>{String(err)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  const { results, importdauer_minuten, validierung } = uploadResult;
  const stats = validierung?.statistik || {};
  const dq = validierung?.datenqualitaet || {};

  return (
    <div className="space-y-3">
      {/* STATUS */}
      {validierung && (
        <div className={`p-4 border-2 rounded-lg ${
          validierung.overall === 'PASS' 
            ? 'bg-emerald-50 border-emerald-300' 
            : 'bg-red-50 border-red-300'
        }`}>
          <div className="flex items-center gap-3">
            {validierung.overall === 'PASS' ? (
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            ) : (
              <AlertCircle className="w-7 h-7 text-red-600" />
            )}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">STATUS</p>
              <p className={`text-2xl font-bold ${
                validierung.overall === 'PASS' ? 'text-emerald-700' : 'text-red-700'
              }`}>
                {validierung.overall === 'PASS' ? 'PASS' : 'FAIL'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* METRIKEN - Kompakt */}
      <div className="grid grid-cols-4 gap-3">
        {/* IMPORTERGEBNIS */}
        <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
          <p className="text-xs text-muted-foreground font-semibold">QUELLE</p>
          <p className="text-xl font-bold text-slate-700">{stats.quelle_gesamtzeilen?.toLocaleString() || '-'}</p>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
          <p className="text-xs text-muted-foreground font-semibold">IMPORTIERT</p>
          <p className={`text-xl font-bold ${stats.importiert > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {stats.importiert?.toLocaleString() || '-'}
          </p>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
          <p className="text-xs text-muted-foreground font-semibold">DIFFERENZ</p>
          <p className={`text-xl font-bold ${
            stats.differenz === 0 ? 'text-emerald-700' : 
            stats.differenz > 0 ? 'text-amber-700' : 'text-red-700'
          }`}>
            {stats.differenz !== undefined ? (stats.differenz > 0 ? '+' : '') + stats.differenz : '-'}
          </p>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
          <p className="text-xs text-muted-foreground font-semibold">IMPORTDAUER</p>
          <p className="text-xl font-bold text-slate-700">{importdauer_minuten?.toFixed(2) || '-'} Min.</p>
        </div>

        {/* QUALITÄTSMETRIKEN */}
        <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
          <p className="text-xs text-muted-foreground font-semibold">VERSICHERER</p>
          <p className="text-xl font-bold text-slate-700">{dq.versicherer || '-'}</p>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
          <p className="text-xs text-muted-foreground font-semibold">KANTONE</p>
          <p className="text-xl font-bold text-slate-700">{dq.kantone || '-'}</p>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
          <p className="text-xs text-muted-foreground font-semibold">REGIONEN</p>
          <p className="text-xl font-bold text-slate-700">{dq.regionen || '-'}</p>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
          <p className="text-xs text-muted-foreground font-semibold">MODELLE</p>
          <p className="text-xl font-bold text-slate-700">{dq.modelle || '-'}</p>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
          <p className="text-xs text-muted-foreground font-semibold">ALTERSKLASSEN</p>
          <p className="text-xl font-bold text-slate-700">{dq.altersklassen || '-'}</p>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
          <p className="text-xs text-muted-foreground font-semibold">FRANCHISEN</p>
          <p className="text-xl font-bold text-slate-700">{dq.franchisen || '-'}</p>
        </div>
      </div>

      {/* Fehler-Liste */}
      {uploadResult.errors && uploadResult.errors.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="font-semibold text-red-700 text-sm mb-2">Import-Fehler ({uploadResult.errors.length})</p>
          <div className="max-h-32 overflow-y-auto text-xs text-red-600 space-y-0.5">
            {uploadResult.errors.map((err, i) => (
              <div key={i} className="font-mono">{String(err)}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}