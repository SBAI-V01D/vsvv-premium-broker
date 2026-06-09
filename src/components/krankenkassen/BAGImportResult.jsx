import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

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
  const diag = validierung?.diagnose || {};

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

      {/* MINIMALE METRIKEN */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-white border border-slate-200 rounded-lg">
          <p className="text-xs text-muted-foreground font-semibold">QUELLE</p>
          <p className="text-lg font-bold text-slate-700">{stats.quelle_gesamtzeilen?.toLocaleString() || '-'}</p>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-lg">
          <p className="text-xs text-muted-foreground font-semibold">IMPORTIERT</p>
          <p className={`text-lg font-bold ${stats.importiert > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {stats.importiert?.toLocaleString() || '-'}
          </p>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-lg">
          <p className="text-xs text-muted-foreground font-semibold">DIFFERENZ</p>
          <p className={`text-lg font-bold ${
            stats.differenz === 0 ? 'text-emerald-700' : 
            stats.differenz > 0 ? 'text-amber-700' : 'text-red-700'
          }`}>
            {stats.differenz !== undefined ? (stats.differenz > 0 ? '+' : '') + stats.differenz?.toLocaleString() : '-'}
          </p>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-lg">
          <p className="text-xs text-muted-foreground font-semibold">IMPORTDAUER</p>
          <p className="text-lg font-bold text-slate-700">{importdauer_minuten?.toFixed(2) || '-'} Min.</p>
        </div>
      </div>

      {/* DATENQUALITÄT */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 bg-white border border-slate-200 rounded text-center">
          <p className="text-[10px] text-muted-foreground">VERSICHERER</p>
          <p className="text-base font-bold text-slate-700">{dq.versicherer || '-'}</p>
        </div>
        <div className="p-2 bg-white border border-slate-200 rounded text-center">
          <p className="text-[10px] text-muted-foreground">KANTONE</p>
          <p className="text-base font-bold text-slate-700">{dq.kantone || '-'}</p>
        </div>
        <div className="p-2 bg-white border border-slate-200 rounded text-center">
          <p className="text-[10px] text-muted-foreground">REGIONEN</p>
          <p className="text-base font-bold text-slate-700">{dq.regionen || '-'}</p>
        </div>
        <div className="p-2 bg-white border border-slate-200 rounded text-center">
          <p className="text-[10px] text-muted-foreground">MODELLE</p>
          <p className="text-base font-bold text-slate-700">{dq.modelle || '-'}</p>
        </div>
        <div className="p-2 bg-white border border-slate-200 rounded text-center">
          <p className="text-[10px] text-muted-foreground">ALTERSKLASSEN</p>
          <p className="text-base font-bold text-slate-700">{dq.altersklassen || '-'}</p>
        </div>
        <div className="p-2 bg-white border border-slate-200 rounded text-center">
          <p className="text-[10px] text-muted-foreground">FRANCHISEN</p>
          <p className="text-base font-bold text-slate-700">{dq.franchisen || '-'}</p>
        </div>
      </div>

      {/* DIAGNOSE (FAIL) */}
      {validierung?.overall === 'FAIL' && diag && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs space-y-1">
          <p className="font-semibold text-red-700">Diagnose:</p>
          {diag.skipped_alter > 0 && <p className="text-red-600">• Unbekannte Altersklassen: {diag.skipped_alter}</p>}
          {diag.skipped_tarif > 0 && <p className="text-red-600">• Unbekannte Tariftypen: {diag.skipped_tarif}</p>}
          {diag.skipped_franchise > 0 && <p className="text-red-600">• Unbekannte Franchisen: {diag.skipped_franchise}</p>}
          {diag.skipped_pflichtfelder > 0 && <p className="text-red-600">• Leere Pflichtfelder: {diag.skipped_pflichtfelder}</p>}
          {diag.skipped_unbekannte_ids > 0 && <p className="text-red-600">• Unbekannte IDs: {diag.skipped_unbekannte_ids}</p>}
        </div>
      )}

      {/* Fehlerursachen */}
      {validierung?.overall === 'FAIL' && uploadResult.error_causes && uploadResult.error_causes.length > 0 && (
        <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg">
          <div className="flex items-center gap-2 text-red-700 font-semibold mb-3">
            <AlertCircle className="w-5 h-5" />
            <p>IMPORT FEHLGESCHLAGEN - {uploadResult.error_causes.length} Ursachen:</p>
          </div>
          <ul className="space-y-2 text-sm text-red-700">
            {uploadResult.error_causes.map((cause, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-red-600 font-bold">•</span>
                <span>{cause}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Technische Fehler */}
      {uploadResult.errors && uploadResult.errors.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="font-semibold text-red-700 text-sm mb-2">Technische Fehler ({uploadResult.errors.length})</p>
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