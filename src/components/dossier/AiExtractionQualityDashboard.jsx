/**
 * AiExtractionQualityDashboard — Phase C
 *
 * Internes Qualitäts-Dashboard für KI-Extraktions-Metriken.
 * Liest SystemLog-Einträge mit source='ki_extraktion_korrektur'.
 *
 * Zeigt:
 *   - Durchschnittliche Konfidenz über alle Sessions
 *   - Häufig korrigierte Felder
 *   - Problematische Gesellschaften (häufige Korrekturen)
 *   - Konfidenz vs. Korrektionsrate
 *   - Letzte Sessions
 *
 * Nur für Admin sichtbar (wird im AdvisoryDossier über role-Check gesteuert).
 * Kein Write, nur Read auf SystemLog.
 */
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BarChart2, TrendingUp, AlertTriangle, CheckCircle, FileText, RefreshCw } from 'lucide-react';

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
function parseLogDetails(log) {
  try { return JSON.parse(log.details || '{}'); } catch { return {}; }
}

function confLabel(v) {
  if (v == null) return '–';
  const pct = Math.round(v * 100);
  if (pct >= 82) return { text: `${pct}%`, cls: 'text-emerald-600 font-semibold' };
  if (pct >= 60) return { text: `${pct}%`, cls: 'text-amber-600 font-semibold' };
  return { text: `${pct}%`, cls: 'text-red-600 font-semibold' };
}

function MiniBar({ value, max, colorClass }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground w-6 text-right">{value}</span>
    </div>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function AiExtractionQualityDashboard() {
  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['ai_quality_logs'],
    queryFn: () => base44.entities.SystemLog.filter(
      { source: 'ki_extraktion_korrektur' },
      '-created_date',
      200
    ),
    staleTime: 60_000,
  });

  const metrics = useMemo(() => {
    if (logs.length === 0) return null;

    const sessions = logs.map(l => ({ ...l, _parsed: parseLogDetails(l) }));
    const allCorrections = sessions.flatMap(s => s._parsed.corrections || []);

    // ── Konfidenz-Verteilung ───────────────────────────────────────────────
    const allConfs = allCorrections.map(c => c.ai_confidence).filter(v => v != null);
    const avgConf  = allConfs.length > 0
      ? allConfs.reduce((a, b) => a + b, 0) / allConfs.length
      : null;

    // Konfidenz bei korrigierten Feldern: zeigt, ob KI sich zu sicher war
    const overconfidentCount = allCorrections.filter(c => c.ai_confidence > 0.75).length;

    // ── Häufig korrigierte Felder ─────────────────────────────────────────
    const fieldCounts = {};
    for (const c of allCorrections) {
      fieldCounts[c.field] = (fieldCounts[c.field] || 0) + 1;
    }
    const topFields = Object.entries(fieldCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const maxFieldCount = topFields[0]?.[1] || 1;

    // ── Problematische Gesellschaften ─────────────────────────────────────
    const gesellschaftCounts = {};
    for (const c of allCorrections) {
      if (c.gesellschaft && c.gesellschaft !== 'unbekannt') {
        gesellschaftCounts[c.gesellschaft] = (gesellschaftCounts[c.gesellschaft] || 0) + 1;
      }
    }
    const topGesellschaften = Object.entries(gesellschaftCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const maxGesCount = topGesellschaften[0]?.[1] || 1;

    // ── Letzte Sessions ───────────────────────────────────────────────────
    const recentSessions = sessions.slice(0, 8).map(s => ({
      date: s.created_date,
      corrections: s._parsed.total_corrections || 0,
      products: s._parsed.product_count || 0,
      docType: s._parsed.source_document_type || '?',
    }));

    // ── KPI-Summary ───────────────────────────────────────────────────────
    const totalSessions    = sessions.length;
    const totalCorrections = allCorrections.length;
    const avgCorrectionsPerSession = totalSessions > 0
      ? (totalCorrections / totalSessions).toFixed(1)
      : 0;
    const zeroCorSessions = sessions.filter(s => (s._parsed.total_corrections || 0) === 0).length;
    const cleanRate = totalSessions > 0 ? Math.round((zeroCorSessions / totalSessions) * 100) : 0;

    return {
      totalSessions, totalCorrections, avgCorrectionsPerSession,
      cleanRate, avgConf, overconfidentCount,
      topFields, maxFieldCount,
      topGesellschaften, maxGesCount,
      recentSessions,
    };
  }, [logs]);

  const FIELD_LABELS = {
    gesellschaft: 'Gesellschaft', product_name: 'Produkt', praemie_monatlich: 'Prämie/Mt.',
    franchise: 'Franchise', modell: 'Modell', deckung_details: 'Deckung',
    section: 'KVG/VVG', person_name: 'Person',
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl bg-muted/20">
        <BarChart2 className="w-8 h-8 mb-3 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground mb-1">Noch keine Qualitätsdaten</p>
        <p className="text-xs text-muted-foreground">
          Daten erscheinen sobald KI-Analysen durchgeführt und Korrekturen vorgenommen wurden.
        </p>
      </div>
    );
  }

  const confL = confLabel(metrics.avgConf);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">KI-Extraktionsqualität</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Basiert auf {metrics.totalSessions} Analyse-Sessions — anonymisiert
          </p>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-lg hover:bg-muted transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
          Aktualisieren
        </button>
      </div>

      {/* KPI-Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-3.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Sessions</p>
          <p className="text-2xl font-bold text-foreground">{metrics.totalSessions}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">⌀ Korrekturen/Session</p>
          <p className={`text-2xl font-bold ${Number(metrics.avgCorrectionsPerSession) > 3 ? 'text-amber-600' : 'text-foreground'}`}>
            {metrics.avgCorrectionsPerSession}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Clean Rate</p>
          <p className={`text-2xl font-bold ${metrics.cleanRate >= 60 ? 'text-emerald-600' : metrics.cleanRate >= 30 ? 'text-amber-600' : 'text-red-600'}`}>
            {metrics.cleanRate}%
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">ohne Korrekturen</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">⌀ Konfidenz korr. Felder</p>
          <p className={`text-2xl font-bold ${confL.cls}`}>{confL.text}</p>
          {metrics.overconfidentCount > 0 && (
            <p className="text-[10px] text-amber-600 mt-0.5">{metrics.overconfidentCount}× überkonf.</p>
          )}
        </div>
      </div>

      {/* Häufig korrigierte Felder + Gesellschaften */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Felder */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <p className="text-xs font-semibold text-foreground">Häufig korrigierte Felder</p>
          </div>
          {metrics.topFields.length === 0 ? (
            <p className="text-xs text-muted-foreground">Keine Korrekturen</p>
          ) : (
            <div className="space-y-2">
              {metrics.topFields.map(([field, count]) => (
                <div key={field}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-foreground">{FIELD_LABELS[field] || field}</span>
                    <span className="text-[10px] text-muted-foreground">{count}×</span>
                  </div>
                  <MiniBar value={count} max={metrics.maxFieldCount} colorClass="bg-amber-400" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gesellschaften */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-3.5 h-3.5 text-red-400" />
            <p className="text-xs font-semibold text-foreground">Gesellschaften mit Korrekturen</p>
          </div>
          {metrics.topGesellschaften.length === 0 ? (
            <p className="text-xs text-muted-foreground">Keine Daten</p>
          ) : (
            <div className="space-y-2">
              {metrics.topGesellschaften.map(([ges, count]) => (
                <div key={ges}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-foreground">{ges}</span>
                    <span className="text-[10px] text-muted-foreground">{count}×</span>
                  </div>
                  <MiniBar value={count} max={metrics.maxGesCount} colorClass="bg-red-300" />
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-3">
            Höhere Balken = mehr KI-Fehler bei dieser Gesellschaft
          </p>
        </div>
      </div>

      {/* Letzte Sessions */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-3.5 h-3.5 text-primary" />
          <p className="text-xs font-semibold text-foreground">Letzte Analyse-Sessions</p>
        </div>
        <div className="space-y-1.5">
          {metrics.recentSessions.map((s, i) => (
            <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border/40 last:border-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium uppercase">
                  {s.docType}
                </span>
                <span className="text-muted-foreground">
                  {s.date ? new Date(s.date).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '–'}
                </span>
                <span className="text-muted-foreground">{s.products} Produkt{s.products !== 1 ? 'e' : ''}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {s.corrections === 0 ? (
                  <span className="flex items-center gap-1 text-emerald-600 text-[10px] font-medium">
                    <CheckCircle className="w-3 h-3" /> Keine Korr.
                  </span>
                ) : (
                  <span className={`text-[10px] font-medium ${s.corrections > 3 ? 'text-red-600' : 'text-amber-600'}`}>
                    {s.corrections} Korrektur{s.corrections !== 1 ? 'en' : ''}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hinweis */}
      <p className="text-[10px] text-muted-foreground text-center">
        Alle Daten anonymisiert — keine Personen- oder Kundendaten gespeichert.
        Dient ausschliesslich zur Verbesserung der KI-Extraktionsqualität.
      </p>
    </div>
  );
}