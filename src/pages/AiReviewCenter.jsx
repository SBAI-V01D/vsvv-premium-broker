import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Brain, Zap, Activity, Building2, ChevronDown, ChevronUp, ExternalLink,
  AlertTriangle, Info, TrendingUp, CheckCircle2, Loader2, RefreshCw,
  ShieldAlert, Clock, BarChart2, Settings, Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

// ── Config ─────────────────────────────────────────────────────────────────
const REVIEW_LEVELS = [
  {
    id: 'quick',
    label: 'Quick Review',
    duration: '~30 Sekunden',
    icon: Zap,
    color: 'blue',
    description: 'Datenqualität · Kritische Risiken · Renewals',
    bg: 'bg-blue-50 border-blue-200',
    activeBg: 'bg-blue-600 text-white border-blue-600',
    iconColor: 'text-blue-500',
  },
  {
    id: 'operational',
    label: 'Operational Review',
    duration: '~2 Minuten',
    icon: Activity,
    color: 'violet',
    description: 'Workflows · Aufgaben · Cross-Selling · Produktivität',
    bg: 'bg-violet-50 border-violet-200',
    activeBg: 'bg-violet-600 text-white border-violet-600',
    iconColor: 'text-violet-500',
  },
  {
    id: 'enterprise',
    label: 'Enterprise Review',
    duration: '~5 Minuten',
    icon: Building2,
    color: 'slate',
    description: 'Vollständige Analyse · Governance · Umsatzpotenziale · Systemqualität',
    bg: 'bg-slate-50 border-slate-200',
    activeBg: 'bg-slate-800 text-white border-slate-800',
    iconColor: 'text-slate-600',
  },
];

const AREA_CONFIG = {
  datenqualitaet: { label: 'Datenqualität', icon: Database, color: 'bg-amber-50 text-amber-700 border-amber-200' },
  operative_risiken: { label: 'Operative Risiken', icon: ShieldAlert, color: 'bg-rose-50 text-rose-700 border-rose-200' },
  umsatzpotenziale: { label: 'Umsatzpotenziale', icon: TrendingUp, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  prozesse: { label: 'Prozesse', icon: Settings, color: 'bg-blue-50 text-blue-700 border-blue-200' },
  systemqualitaet: { label: 'Systemqualität', icon: BarChart2, color: 'bg-slate-50 text-slate-700 border-slate-200' },
};

const SEVERITY_CONFIG = {
  critical: { label: 'Kritisch', icon: AlertTriangle, badge: 'bg-rose-100 text-rose-700 border border-rose-200', dot: 'bg-rose-500' },
  warning: { label: 'Warnung', icon: AlertTriangle, badge: 'bg-amber-100 text-amber-700 border border-amber-200', dot: 'bg-amber-500' },
  info: { label: 'Info', icon: Info, badge: 'bg-blue-100 text-blue-700 border border-blue-200', dot: 'bg-blue-500' },
  opportunity: { label: 'Potenzial', icon: TrendingUp, badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500' },
};

// ── Finding Card ────────────────────────────────────────────────────────────
function FindingCard({ finding }) {
  const [showWhy, setShowWhy] = useState(false);
  const severity = SEVERITY_CONFIG[finding.severity] || SEVERITY_CONFIG.info;
  const area = AREA_CONFIG[finding.area] || AREA_CONFIG.datenqualitaet;
  const AreaIcon = area.icon;
  const SevIcon = severity.icon;

  return (
    <div className={cn(
      'bg-white rounded-xl border transition-shadow hover:shadow-sm',
      finding.severity === 'critical' ? 'border-rose-200' : 'border-slate-200/80'
    )}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={cn('w-2 h-2 rounded-full mt-2 flex-shrink-0', severity.dot)} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', severity.badge)}>
                {severity.label}
              </span>
              <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1', area.color)}>
                <AreaIcon className="w-2.5 h-2.5" />
                {area.label}
              </span>
              {finding.id && (
                <span className="text-[9px] text-slate-400 font-mono">{finding.id}</span>
              )}
            </div>
            <h3 className="text-sm font-semibold text-slate-800 mb-1">{finding.title}</h3>
            <p className="text-xs text-slate-600 leading-relaxed">{finding.explanation}</p>
          </div>
          {finding.metric && (
            <div className="flex-shrink-0 text-right">
              <p className="text-lg font-bold text-slate-800 leading-none">{finding.metric.split(' ')[0]}</p>
              <p className="text-[9px] text-slate-500">{finding.metric.split(' ').slice(1).join(' ')}</p>
            </div>
          )}
        </div>

        {/* Recommendation */}
        <div className="mt-3 ml-5 pl-3 border-l-2 border-slate-200">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Empfehlung</p>
          <p className="text-xs text-slate-700">{finding.recommendation}</p>
        </div>

        {/* Footer */}
        <div className="mt-3 ml-5 flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowWhy(!showWhy)}
            className="flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            <Brain className="w-3 h-3" />
            Warum schlägt die KI das vor?
            {showWhy ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {finding.link && (
            <Link
              to={finding.link}
              className="flex items-center gap-1 text-[10px] font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Direkt öffnen
            </Link>
          )}
        </div>

        {/* Why AI */}
        {showWhy && (
          <div className="mt-2 ml-5 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-[10px] font-semibold text-slate-500 mb-1.5">KI-Logik / Datenbasis</p>
            <p className="text-xs text-slate-600 leading-relaxed">{finding.why_ai_suggests}</p>
            {finding.data_basis && (
              <>
                <p className="text-[10px] font-semibold text-slate-500 mt-2 mb-0.5">Datenbasis</p>
                <p className="text-xs text-slate-500">{finding.data_basis}</p>
              </>
            )}
            <p className="text-[9px] text-slate-400 mt-2 italic">
              ⚠ Diese Analyse ist eine Empfehlung. Die KI nimmt keine Änderungen vor.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Stats Bar ───────────────────────────────────────────────────────────────
function StatsBar({ stats }) {
  if (!stats) return null;
  const items = [
    { label: 'Kunden', value: stats.total_customers },
    { label: 'Aktive Verträge', value: stats.total_active_contracts },
    { label: 'Offene Tasks', value: stats.total_open_tasks },
    { label: 'Ohne Berater', value: stats.no_advisor, alert: stats.no_advisor > 0 },
    { label: 'Mandat-Issues', value: stats.mandate_issues, alert: stats.mandate_issues > 0 },
    { label: 'Ablauf <90T', value: stats.expiring_90d, alert: stats.expiring_90d > 0 },
  ];
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
      {items.map(item => (
        <div key={item.label} className={cn(
          'rounded-lg p-2.5 text-center border',
          item.alert ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'
        )}>
          <p className={cn('text-lg font-bold', item.alert ? 'text-rose-600' : 'text-slate-800')}>{item.value}</p>
          <p className="text-[9px] text-slate-500 leading-tight">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function AiReviewCenter() {
  const [selectedLevel, setSelectedLevel] = useState('quick');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterArea, setFilterArea] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');

  const runReview = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setFilterArea('all');
    setFilterSeverity('all');
    try {
      const res = await base44.functions.invoke('aiSystemReview', { level: selectedLevel });
      setResult(res.data);
    } catch (e) {
      setError(e.message || 'Review fehlgeschlagen');
    }
    setLoading(false);
  };

  const findings = result?.findings || [];
  const filtered = findings.filter(f => {
    if (filterArea !== 'all' && f.area !== filterArea) return false;
    if (filterSeverity !== 'all' && f.severity !== filterSeverity) return false;
    return true;
  });

  const criticalCount = findings.filter(f => f.severity === 'critical').length;
  const warningCount = findings.filter(f => f.severity === 'warning').length;
  const opportunityCount = findings.filter(f => f.severity === 'opportunity').length;

  return (
    <div className="min-h-full bg-[hsl(var(--surface-1))]">
      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-sm">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">AI Review Center</h1>
              <p className="text-xs text-slate-500">Intelligenter Systemberater — analysiert auf Anfrage, ändert nichts automatisch</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

        {/* ── Level Selection ── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Review-Level wählen</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {REVIEW_LEVELS.map(level => {
              const Icon = level.icon;
              const isActive = selectedLevel === level.id;
              return (
                <button
                  key={level.id}
                  onClick={() => setSelectedLevel(level.id)}
                  className={cn(
                    'text-left p-4 rounded-xl border-2 transition-all',
                    isActive ? level.activeBg : `${level.bg} hover:shadow-sm`
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={cn('w-4 h-4', isActive ? 'text-white' : level.iconColor)} />
                    <span className={cn('text-sm font-semibold', isActive ? 'text-white' : 'text-slate-800')}>{level.label}</span>
                    <span className={cn('text-[10px] ml-auto', isActive ? 'text-white/70' : 'text-slate-400')}>{level.duration}</span>
                  </div>
                  <p className={cn('text-[11px] leading-relaxed', isActive ? 'text-white/80' : 'text-slate-500')}>{level.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Start Button ── */}
        <div className="flex items-center gap-4">
          <Button
            onClick={runReview}
            disabled={loading}
            className="h-11 px-8 text-sm font-semibold bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 border-0 shadow-sm"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyse läuft…</>
            ) : (
              <><Brain className="w-4 h-4 mr-2" />AI Review starten</>
            )}
          </Button>
          {result && (
            <button onClick={runReview} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
              <RefreshCw className="w-3.5 h-3.5" />
              Erneut prüfen
            </button>
          )}
          {result && (
            <p className="text-xs text-slate-400">
              Geprüft am {new Date(result.reviewed_at).toLocaleString('de-CH')} · {result.reviewed_by}
            </p>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* ── Loading State ── */}
        {loading && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center mx-auto mb-4">
              <Brain className="w-6 h-6 text-violet-600 animate-pulse" />
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">KI analysiert Ihre Daten…</p>
            <p className="text-xs text-slate-400">
              {selectedLevel === 'quick' ? 'Schnellprüfung' : selectedLevel === 'operational' ? 'Betriebsanalyse' : 'Enterprise-Vollanalyse'} wird durchgeführt
            </p>
          </div>
        )}

        {/* ── Results ── */}
        {result && !loading && (
          <>
            {/* Stats Bar */}
            <StatsBar stats={result.stats} />

            {/* Summary Row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-800">{findings.length} Findings</span>
                <span className="text-slate-300">|</span>
              </div>
              {criticalCount > 0 && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                  ⚠ {criticalCount} Kritisch
                </span>
              )}
              {warningCount > 0 && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                  {warningCount} Warnungen
                </span>
              )}
              {opportunityCount > 0 && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                  🔵 {opportunityCount} Potenziale
                </span>
              )}
              <div className="ml-auto flex items-center gap-1 text-[10px] text-slate-400">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                Keine automatischen Änderungen vorgenommen
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterArea('all')}
                className={cn('text-[11px] px-2.5 py-1 rounded-full border transition-colors',
                  filterArea === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                )}
              >Alle Bereiche</button>
              {Object.entries(AREA_CONFIG).map(([key, val]) => {
                const count = findings.filter(f => f.area === key).length;
                if (count === 0) return null;
                return (
                  <button key={key}
                    onClick={() => setFilterArea(filterArea === key ? 'all' : key)}
                    className={cn('text-[11px] px-2.5 py-1 rounded-full border transition-colors',
                      filterArea === key ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    )}
                  >
                    {val.label} ({count})
                  </button>
                );
              })}
              <div className="w-px bg-slate-200 mx-1" />
              {['critical', 'warning', 'opportunity', 'info'].map(sev => {
                const count = findings.filter(f => f.severity === sev).length;
                if (count === 0) return null;
                const cfg = SEVERITY_CONFIG[sev];
                return (
                  <button key={sev}
                    onClick={() => setFilterSeverity(filterSeverity === sev ? 'all' : sev)}
                    className={cn('text-[11px] px-2.5 py-1 rounded-full border transition-colors',
                      filterSeverity === sev ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    )}
                  >
                    {cfg.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Findings */}
            <div className="space-y-3">
              {filtered.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400">Keine Findings für diesen Filter</div>
              ) : (
                filtered.map((f, i) => <FindingCard key={f.id || i} finding={f} />)
              )}
            </div>

            {/* Disclaimer */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-[11px] text-slate-500 text-center">
                <Brain className="w-3 h-3 inline mr-1" />
                Alle Findings sind <strong>Empfehlungen</strong> basierend auf Systemdaten. Die KI nimmt keine Änderungen vor.
                Jede Massnahme erfordert Ihre explizite Freigabe.
              </p>
            </div>
          </>
        )}

        {/* ── Empty Start State ── */}
        {!result && !loading && !error && (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-50 to-blue-50 border border-violet-100 flex items-center justify-center mx-auto mb-4">
              <Brain className="w-7 h-7 text-violet-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-700 mb-2">Bereit für die Systemanalyse</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
              Wählen Sie ein Review-Level und starten Sie die Analyse. Die KI prüft Ihre Daten und
              gibt strukturierte Empfehlungen — ohne etwas zu verändern.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}