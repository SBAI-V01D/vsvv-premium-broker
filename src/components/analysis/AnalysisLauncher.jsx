/**
 * AnalysisLauncher — Shared Start/Status Panel
 * Wird von allen 3 Modulen als gemeinsamer Einstiegspunkt verwendet.
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, ShieldAlert, Zap } from 'lucide-react';
import { useCentralAnalysis, getScoreColor, getScoreBg, getRiskBadge, getRiskLabel } from '@/lib/CentralAnalysisContext';
import { cn } from '@/lib/utils';

export default function AnalysisLauncher({ compact = false }) {
  const { analysisData, loading, lastRun, runAnalysis } = useCentralAnalysis();

  if (loading) {
    return (
      <div className={cn('flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl', compact && 'py-2.5')}>
        <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-blue-800">Zentrale Analyse läuft...</p>
          <p className="text-xs text-blue-600">Daten werden analysiert — Single Source of Truth</p>
        </div>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className={cn('surface p-5 flex flex-col items-center text-center gap-3', compact && 'flex-row text-left items-center p-3.5')}>
        <div className={cn('w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow flex-shrink-0', compact && 'w-9 h-9')}>
          <Zap className={cn('w-6 h-6 text-white', compact && 'w-4 h-4')} />
        </div>
        <div className={cn('flex-1', compact && 'text-left')}>
          <p className="font-semibold text-sm">Zentrale Analyse starten</p>
          <p className="text-xs text-muted-foreground">Einheitliche Datenbasis für Enterprise Control, System Check und KI Analyse</p>
        </div>
        <Button onClick={runAnalysis} className="bg-gradient-to-r from-violet-600 to-blue-600 gap-2" size={compact ? 'sm' : 'default'}>
          <Zap className="w-3.5 h-3.5" />
          Analyse starten
        </Button>
      </div>
    );
  }

  const { scores, risk_level, summary, computed_at, duration_ms } = analysisData;

  return (
    <div className="surface p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-semibold text-slate-700">Zentrale Analyse — Single Source of Truth</span>
          <Badge className="badge-neutral text-[10px]">{new Date(computed_at).toLocaleString('de-CH')}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={runAnalysis} className="gap-1.5 text-xs h-7">
          <RefreshCw className="w-3 h-3" />
          Aktualisieren
        </Button>
      </div>

      {/* Score-Übersicht */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
        {[
          { label: 'Gesamt', value: scores.overall, key: 'overall' },
          { label: 'Governance', value: scores.governance, key: 'governance' },
          { label: 'Compliance', value: scores.compliance, key: 'compliance' },
          { label: 'Datenqualität', value: scores.data_quality, key: 'data_quality' },
          { label: 'Sicherheit', value: scores.security, key: 'security' },
        ].map(s => (
          <div key={s.key} className={cn('rounded-lg border p-2 text-center', getScoreBg(s.value))}>
            <p className={cn('text-xl font-bold', getScoreColor(s.value))}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Risk + Summary */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge className={cn('border', getRiskBadge(risk_level))}>
          Risiko: {getRiskLabel(risk_level)}
        </Badge>
        {summary.critical_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-rose-600 font-medium">
            <ShieldAlert className="w-3.5 h-3.5" />
            {summary.critical_count} kritisch
          </span>
        )}
        {summary.warning_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            {summary.warning_count} Warnungen
          </span>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{duration_ms}ms · {summary.checks_passed}/{summary.checks_total} Checks OK</span>
      </div>
    </div>
  );
}