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
    <div className="space-y-4">
      {/* STATUS */}
      {validierung && (
        <div className={`p-5 border-2 rounded-lg ${
          validierung.overall === 'PASS' 
            ? 'bg-emerald-50 border-emerald-300' 
            : 'bg-red-50 border-red-300'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {validierung.overall === 'PASS' ? (
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              ) : (
                <AlertCircle className="w-8 h-8 text-red-600" />
              )}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">STATUS</p>
                <p className={`text-3xl font-bold ${
                  validierung.overall === 'PASS' ? 'text-emerald-700' : 'text-red-700'
                }`}>
                  {validierung.overall === 'PASS' ? 'PASS' : 'FAIL'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">Importdauer</p>
              <p className="text-lg font-semibold">{importdauer_minuten?.toFixed(2)} Min.</p>
              {results?.fehler > 0 && (
                <p className="text-xs text-red-600 mt-1">{results.fehler} Fehler</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* IMPORTERGEBNIS */}
      <div className="p-4 bg-white border border-slate-200 rounded-lg">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3 font-semibold">IMPORTERGEBNIS</p>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Quelle</p>
            <p className="text-2xl font-bold text-slate-700">{stats.quelle_gesamtzeilen?.toLocaleString() || '-'}</p>
            <p className="text-xs text-muted-foreground">Datensätze</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Importiert</p>
            <p className={`text-2xl font-bold ${stats.importiert > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {stats.importiert?.toLocaleString() || '-'}
            </p>
            <p className="text-xs text-muted-foreground">Datensätze</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Differenz</p>
            <p className={`text-2xl font-bold ${
              stats.differenz === 0 ? 'text-emerald-700' : 
              stats.differenz > 0 ? 'text-amber-700' : 'text-red-700'
            }`}>
              {stats.differenz !== undefined ? (stats.differenz > 0 ? '+' : '') + stats.differenz : '-'}
            </p>
            <p className="text-xs text-muted-foreground">Datensätze</p>
          </div>
        </div>
      </div>

      {/* QUALITÄTSMETRIKEN */}
      {dq && Object.keys(dq).length > 0 && (
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3 font-semibold">QUALITÄTSMETRIKEN</p>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Versicherer</p>
              <p className="text-xl font-bold text-slate-700">{dq.versicherer || '-'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Kantone</p>
              <p className="text-xl font-bold text-slate-700">{dq.kantone || '-'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Regionen</p>
              <p className="text-xl font-bold text-slate-700">{dq.regionen || '-'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Modelle</p>
              <p className="text-xl font-bold text-slate-700">{dq.modelle || '-'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Altersklassen</p>
              <p className="text-xl font-bold text-slate-700">{dq.altersklassen || '-'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Franchisen</p>
              <p className="text-xl font-bold text-slate-700">{dq.franchisen || '-'}</p>
            </div>
          </div>
        </div>
      )}

      {/* VALIDIERUNGS-Details */}
      {validierung && (
        <div className="grid grid-cols-3 gap-3">
          <div className={`p-3 rounded-lg border-2 ${
            validierung.vollstaendigkeit?.pass 
              ? 'bg-emerald-50 border-emerald-300' 
              : 'bg-red-50 border-red-300'
          }`}>
            <p className="text-xs font-semibold mb-1">Vollständigkeit</p>
            <p className={`text-lg font-bold ${
              validierung.vollstaendigkeit?.pass ? 'text-emerald-700' : 'text-red-700'
            }`}>
              {validierung.vollstaendigkeit?.pass ? '✓' : '✗'}
            </p>
            <p className="text-xs mt-0.5">
              {validierung.vollstaendigkeit?.actual?.toLocaleString()} / {validierung.vollstaendigkeit?.expected?.toLocaleString()}
            </p>
          </div>
          <div className={`p-3 rounded-lg border-2 ${
            validierung.datenqualitaet?.pass 
              ? 'bg-emerald-50 border-emerald-300' 
              : 'bg-red-50 border-red-300'
          }`}>
            <p className="text-xs font-semibold mb-1">Datenqualität</p>
            <p className={`text-lg font-bold ${
              validierung.datenqualitaet?.pass ? 'text-emerald-700' : 'text-red-700'
            }`}>
              {validierung.datenqualitaet?.pass ? '✓' : '✗'}
            </p>
            <p className="text-xs mt-0.5">
              {validierung.datenqualitaet?.versicherer} Versicherer, {validierung.datenqualitaet?.kantone} Kantone
            </p>
          </div>
          <div className={`p-3 rounded-lg border-2 ${
            validierung.plausibilitaet?.pass 
              ? 'bg-emerald-50 border-emerald-300' 
              : 'bg-red-50 border-red-300'
          }`}>
            <p className="text-xs font-semibold mb-1">Plausibilität</p>
            <p className={`text-lg font-bold ${
              validierung.plausibilitaet?.pass ? 'text-emerald-700' : 'text-red-700'
            }`}>
              {validierung.plausibilitaet?.pass ? '✓' : '✗'}
            </p>
            <p className="text-xs mt-0.5">
              {Object.values(validierung.plausibilitaet?.checks || {}).every(v => v) ? 'Alle Checks OK' : 'Checks fehlgeschlagen'}
            </p>
          </div>
        </div>
      )}

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