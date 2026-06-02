/**
 * Enterprise System Check — Technische Systemsicht
 * 
 * Nutzt ausschliesslich die zentrale Analyse-Engine.
 * Keine eigene Analyse-Logik.
 */
import React, { useState } from 'react';
import { CentralAnalysisProvider, useCentralAnalysis, getScoreColor, getScoreBg } from '@/lib/CentralAnalysisContext';
import AnalysisLauncher from '@/components/analysis/AnalysisLauncher';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, XCircle, Activity, Database, Shield, Zap, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import BrokerOpsCleanupPanel from '@/components/admin/BrokerOpsCleanupPanel';

const CATEGORY_LABELS = {
  data_integrity: 'Datenintegrität',
  security: 'Governance & Security',
  performance: 'Performance & Workflows',
};

const CATEGORY_ICONS = {
  data_integrity: Database,
  security: Shield,
  performance: Zap,
};

const STATUS_CONFIG = {
  pass: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', label: 'OK' },
  warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', label: 'Warnung' },
  critical: { icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200', label: 'Kritisch' },
};

function CheckItem({ check }) {
  const cfg = STATUS_CONFIG[check.status] || STATUS_CONFIG.warning;
  const Icon = cfg.icon;
  return (
    <div className={cn('p-3 rounded-lg border flex items-start gap-3', cfg.bg)}>
      <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', cfg.color)} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs font-semibold', cfg.color)}>{check.name}</p>
        <p className="text-xs text-slate-600 mt-0.5">{check.details}</p>
        {check.recommendation && check.status !== 'pass' && (
          <p className="text-xs text-slate-500 mt-1 font-medium">→ {check.recommendation}</p>
        )}
      </div>
      <Badge className={cn('text-[10px] flex-shrink-0', cfg.bg, cfg.color, 'border-current')}>{cfg.label}</Badge>
    </div>
  );
}

function SystemCheckContent() {
  const { analysisData } = useCentralAnalysis();
  const [activeCategory, setActiveCategory] = useState('all');

  if (!analysisData) return null;

  const { system_checks, scores, metrics, summary } = analysisData;

  const categories = ['all', 'data_integrity', 'security', 'performance'];

  const filtered = activeCategory === 'all'
    ? system_checks
    : system_checks.filter(c => c.category === activeCategory);

  const countByCat = (cat, status) => system_checks.filter(c => c.category === cat && c.status === status).length;

  return (
    <div className="space-y-6">
      {/* Score-Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={cn('rounded-xl border p-4', getScoreBg(scores.overall))}>
          <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Gesamt</p>
          <p className={cn('text-3xl font-bold', getScoreColor(scores.overall))}>{scores.overall}</p>
        </div>
        <div className={cn('rounded-xl border p-4', getScoreBg(scores.data_quality))}>
          <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Datenintegrität</p>
          <p className={cn('text-3xl font-bold', getScoreColor(scores.data_quality))}>{scores.data_quality}</p>
        </div>
        <div className={cn('rounded-xl border p-4', getScoreBg(scores.security))}>
          <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Sicherheit</p>
          <p className={cn('text-3xl font-bold', getScoreColor(scores.security))}>{scores.security}</p>
        </div>
        <div className="rounded-xl border p-4 bg-slate-50 border-slate-200">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Checks</p>
          <p className="text-2xl font-bold text-slate-700">{summary.checks_passed}<span className="text-sm text-muted-foreground">/{summary.checks_total}</span></p>
          <p className="text-[10px] text-muted-foreground">bestanden</p>
        </div>
      </div>

      {/* Quick-Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {[
          { label: 'Kunden', value: metrics.active_customers },
          { label: 'Verträge', value: metrics.active_contracts },
          { label: 'Unklassifiziert', value: metrics.unclassified_documents, warn: metrics.unclassified_documents > 50 },
          { label: 'Überfällige Tasks', value: metrics.overdue_tasks, warn: metrics.overdue_tasks > 0 },
          { label: 'Krit. Incidents', value: metrics.open_critical_incidents, warn: metrics.open_critical_incidents > 0 },
          { label: 'Backup (Tage)', value: metrics.last_backup_days, warn: !metrics.backup_ok },
        ].map((s, i) => (
          <div key={i} className={cn('rounded-lg border p-2.5 text-center', s.warn ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200')}>
            <p className={cn('text-lg font-bold', s.warn ? 'text-amber-700' : 'text-slate-700')}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Category Filter */}
      <div className="flex gap-1.5 flex-wrap">
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={cn('text-xs px-3 py-1.5 rounded-lg border transition-all font-medium',
              activeCategory === cat ? 'bg-primary text-white border-primary' : 'bg-white border-slate-200 text-slate-600 hover:border-primary'
            )}>
            {cat === 'all' ? `Alle (${system_checks.length})` : (
              <>
                {CATEGORY_LABELS[cat] || cat}
                {countByCat(cat, 'critical') > 0 && <span className="ml-1.5 bg-rose-100 text-rose-700 rounded-full px-1.5 py-0.5 text-[9px]">{countByCat(cat, 'critical')}</span>}
              </>
            )}
          </button>
        ))}
      </div>

      {/* Checks */}
      <div className="space-y-2">
        {filtered.map((check, i) => <CheckItem key={i} check={check} />)}
      </div>

      {/* Broker Ops Cleanup */}
      <div className="border-t border-border pt-6">
        <BrokerOpsCleanupPanel />
      </div>
    </div>
  );
}

function PageContent() {
  const { analysisData } = useCentralAnalysis();

  return (
    <div className="page-enter min-h-full bg-[hsl(var(--surface-1))]">
      <div className="px-6 py-5 border-b border-border bg-card">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[hsl(var(--text-heading))]">Enterprise System Check</h1>
            <p className="text-xs text-muted-foreground">Technische Systemsicht · Datenintegrität · Workflows · Performance</p>
          </div>
        </div>
        <AnalysisLauncher compact />
      </div>
      <div className="p-6">
        {analysisData ? <SystemCheckContent /> : (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Starten Sie die Analyse oben, um den System Check zu sehen.
          </div>
        )}
      </div>
    </div>
  );
}

export default function EnterpriseSystemCheck() {
  return (
    <CentralAnalysisProvider>
      <PageContent />
    </CentralAnalysisProvider>
  );
}