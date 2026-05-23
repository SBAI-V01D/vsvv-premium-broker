import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  Brain, Zap, Activity, Building2, ChevronDown, ChevronUp, ExternalLink,
  AlertTriangle, Info, TrendingUp, CheckCircle2, Loader2, RefreshCw,
  ShieldAlert, Database, Settings, User, FileText, CheckSquare,
  ArrowRight, Target, BarChart2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ── Config ──────────────────────────────────────────────────────────────────
const REVIEW_LEVELS = [
  { id: 'quick',       label: 'Quick Review',       duration: '~30 Sek.',  icon: Zap,        desc: 'Kein Berater · Mandate · Renewals · Überfällige Tasks', activeBg: 'bg-blue-600 text-white border-blue-600',   passiveBg: 'bg-blue-50 border-blue-200',   iconActive: 'text-white', iconPassive: 'text-blue-500' },
  { id: 'operational', label: 'Operational Review',  duration: '~2 Min.',   icon: Activity,   desc: 'Workflows · Cross-Selling · Stornos · Aktivität',       activeBg: 'bg-violet-600 text-white border-violet-600', passiveBg: 'bg-violet-50 border-violet-200', iconActive: 'text-white', iconPassive: 'text-violet-500' },
  { id: 'enterprise',  label: 'Enterprise Review',   duration: '~5 Min.',   icon: Building2,  desc: 'Vollanalyse · Governance · Umsatzpotenziale · System',  activeBg: 'bg-slate-800 text-white border-slate-800',  passiveBg: 'bg-slate-50 border-slate-200',   iconActive: 'text-white', iconPassive: 'text-slate-500' },
];

const AREA_CONFIG = {
  operative_risiken: { label: 'Operative Risiken', icon: ShieldAlert, color: 'bg-rose-50 text-rose-700 border-rose-200' },
  umsatzpotenziale:  { label: 'Umsatzpotenziale',  icon: TrendingUp,  color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  datenqualitaet:    { label: 'Datenqualität',     icon: Database,    color: 'bg-amber-50 text-amber-700 border-amber-200' },
  prozesse:          { label: 'Prozesse',           icon: Settings,    color: 'bg-blue-50 text-blue-700 border-blue-200' },
};

const SEVERITY_CONFIG = {
  critical:    { label: 'Kritisch', dot: 'bg-rose-500',    badge: 'bg-rose-100 text-rose-700 border-rose-200' },
  warning:     { label: 'Warnung',  dot: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  opportunity: { label: 'Potenzial',dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  info:        { label: 'Info',     dot: 'bg-blue-400',    badge: 'bg-blue-100 text-blue-700 border-blue-200' },
};

const AREA_PRIORITY = { umsatzpotenziale: 0, operative_risiken: 1, datenqualitaet: 2, prozesse: 3 };
const SEV_PRIORITY  = { critical: 0, warning: 1, opportunity: 2, info: 3 };
function sortFindings(findings) {
  return [...findings].sort((a, b) => {
    const ap = (AREA_PRIORITY[a.area] ?? 5) - (AREA_PRIORITY[b.area] ?? 5);
    if (ap !== 0) return ap;
    return (SEV_PRIORITY[a.severity] ?? 4) - (SEV_PRIORITY[b.severity] ?? 4);
  });
}

// ── Quick Action Button ─────────────────────────────────────────────────────
function QuickActionBtn({ action }) {
  const navigate = useNavigate();
  const icons = {
    open_customer:      User,
    open_contracts:     FileText,
    create_task:        CheckSquare,
    open_opportunities: Target,
    open_documents:     FileText,
    open_tasks:         CheckSquare,
  };
  const Icon = icons[action.type] || ArrowRight;
  
  const handleClick = (e) => {
    e.preventDefault();
    if (action.link && action.link.startsWith('/')) {
      navigate(action.link);
    } else {
      window.location.href = action.link || '/';
    }
  };
  
  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 transition-all"
    >
      <Icon className="w-3 h-3 text-slate-400" />
      {action.label}
    </button>
  );
}

// ── Affected Entity Chip ────────────────────────────────────────────────────
function EntityChip({ entity }) {
  const navigate = useNavigate();
  
  const handleClick = (e) => {
    e.preventDefault();
    if (entity.link && entity.link.startsWith('/')) {
      navigate(entity.link);
    } else {
      window.location.href = entity.link || '/';
    }
  };
  
  return (
    <button
      onClick={handleClick}
      className="w-full flex items-start gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-all group text-left"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-slate-800 truncate group-hover:text-blue-700 transition-colors">{entity.name}</p>
        {entity.detail && <p className="text-[10px] text-slate-500 truncate mt-0.5">{entity.detail}</p>}
      </div>
      <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-blue-500 flex-shrink-0 mt-0.5 transition-colors" />
    </button>
  );
}

// ── Finding Card ────────────────────────────────────────────────────────────
function FindingCard({ finding }) {
  const [showWhy, setShowWhy] = useState(false);
  const [showAllEntities, setShowAllEntities] = useState(false);

  const severity = SEVERITY_CONFIG[finding.severity] || SEVERITY_CONFIG.info;
  const area     = AREA_CONFIG[finding.area]         || AREA_CONFIG.datenqualitaet;
  const AreaIcon = area.icon;

  const entities    = finding.affected_entities || [];
  const visibleEnts = showAllEntities ? entities : entities.slice(0, 3);
  const hasMore     = entities.length > 3;

  return (
    <div className={cn(
      'bg-white rounded-xl border overflow-hidden transition-shadow hover:shadow-sm',
      finding.severity === 'critical' ? 'border-rose-200' : 'border-slate-200/80'
    )}>
      {/* Top accent bar */}
      <div className={cn('h-0.5 w-full', {
        'bg-rose-400': finding.severity === 'critical',
        'bg-amber-400': finding.severity === 'warning',
        'bg-emerald-400': finding.severity === 'opportunity',
        'bg-blue-400': finding.severity === 'info',
      })} />

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', severity.dot)} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', severity.badge)}>{severity.label}</span>
              <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1', area.color)}>
                <AreaIcon className="w-2.5 h-2.5" />{area.label}
              </span>
              {finding.id && <span className="text-[9px] text-slate-400 font-mono">{finding.id}</span>}
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">{finding.title}</h3>
            <p className="text-xs text-slate-600 leading-relaxed">{finding.explanation}</p>
          </div>
        </div>

        {/* Business Impact */}
        {finding.business_impact && (
          <div className="flex items-center gap-2 ml-5">
            <TrendingUp className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <p className="text-xs font-semibold text-slate-700">{finding.business_impact}</p>
          </div>
        )}

        {/* Affected Entities */}
        {entities.length > 0 && (
          <div className="ml-5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Betroffen ({entities.length})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {visibleEnts.map((e, i) => <EntityChip key={e.id || i} entity={e} />)}
            </div>
            {hasMore && (
              <button
                onClick={() => setShowAllEntities(!showAllEntities)}
                className="mt-2 text-[11px] font-medium text-blue-600 hover:text-blue-700"
              >
                {showAllEntities ? 'Weniger anzeigen' : `+${entities.length - visibleEnts.length} weitere anzeigen`}
              </button>
            )}
          </div>
        )}

        {/* Recommendation */}
        <div className="ml-5 pl-3 border-l-2 border-slate-200">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Empfehlung</p>
          <p className="text-xs text-slate-700">{finding.recommendation}</p>
        </div>

        {/* Quick Actions */}
        {finding.quick_actions?.length > 0 && (
          <div className="ml-5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Quick Actions</p>
            <div className="flex flex-wrap gap-2">
              {finding.quick_actions.map((a, i) => <QuickActionBtn key={i} action={a} />)}
            </div>
          </div>
        )}

        {/* Why AI */}
        <div className="ml-5">
          <button
            onClick={() => setShowWhy(!showWhy)}
            className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Brain className="w-3 h-3" />
            Warum schlägt die KI das vor?
            {showWhy ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showWhy && (
            <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-600 leading-relaxed">{finding.why_ai_suggests}</p>
              <p className="text-[9px] text-slate-400 mt-2 italic">
                AI Intelligence unterstützt Entscheidungen. Änderungen erfolgen ausschliesslich nach Benutzerfreigabe.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Executive Summary ───────────────────────────────────────────────────────
function ExecutiveSummary({ findings, level, reviewedAt }) {
  const critical     = findings.filter(f => f.severity === 'critical').length;
  const warnings     = findings.filter(f => f.severity === 'warning').length;
  const opportunities= findings.filter(f => f.severity === 'opportunity').length;
  const renewalRisk  = findings.filter(f => f.area === 'operative_risiken').length;

  const items = [
    critical > 0      && { value: critical,      label: 'Kritische Findings',  color: 'text-rose-700',    bg: 'bg-rose-50 border-rose-200' },
    warnings > 0      && { value: warnings,       label: 'Warnungen',           color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' },
    renewalRisk > 0   && { value: renewalRisk,    label: 'Operative Risiken',   color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200' },
    opportunities > 0 && { value: opportunities,  label: 'Umsatzpotenziale',   color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  ].filter(Boolean);

  const levelLabel = { quick: 'Quick Review', operational: 'Operational Review', enterprise: 'Enterprise Review' }[level] || level;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{levelLabel} · Executive Summary</p>
          <p className="text-xs text-slate-500 mt-0.5">{reviewedAt}</p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-semibold">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Keine automatischen Änderungen
        </div>
      </div>
      <div className="p-4">
        {items.length === 0 ? (
          <p className="text-sm text-emerald-700 font-semibold">✓ Keine kritischen Findings — System in gutem Zustand</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {items.map((item, i) => (
              <div key={i} className={`rounded-lg border p-3.5 ${item.bg}`}>
                <p className={`text-3xl font-bold leading-none mb-1 ${item.color}`}>{item.value}</p>
                <p className="text-[11px] text-slate-600 font-medium">{item.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100">
        <p className="text-[11px] text-slate-500">
          <span className="font-semibold text-slate-700">AI Intelligence</span> unterstützt Entscheidungen.
          Änderungen erfolgen ausschliesslich nach Benutzerfreigabe.
        </p>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function AiReviewCenter() {
  const [selectedLevel, setSelectedLevel] = useState('quick');
  const [result, setResult]               = useState(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);
  const [filterArea, setFilterArea]       = useState('all');
  const [filterSev, setFilterSev]         = useState('all');

  // ── Persistentes Review laden ────────────────────────────────────────────
  useEffect(() => {
    const loadLastReview = async () => {
      try {
        const reviews = await base44.entities.AiReview.list('-reviewed_at', 1);
        if (reviews.length > 0) {
          const lastReview = reviews[0];
          setResult({
            findings: lastReview.findings,
            level: lastReview.level,
            reviewed_at: lastReview.reviewed_at,
            reviewed_by: lastReview.reviewed_by,
            review_id: lastReview.id,
          });
        }
      } catch (e) {
        console.error('Failed to load last review:', e);
      }
    };
    loadLastReview();
  }, []);

  const runReview = async () => {
    setLoading(true); setError(null); setResult(null);
    setFilterArea('all'); setFilterSev('all');
    try {
      const res = await base44.functions.invoke('aiSystemReview', { level: selectedLevel });
      setResult(res.data);
    } catch (e) {
      setError(e.message || 'Review fehlgeschlagen');
    }
    setLoading(false);
  };

  const findings = result?.findings || [];
  const filtered = sortFindings(findings.filter(f => {
    if (filterArea !== 'all' && f.area !== filterArea) return false;
    if (filterSev !== 'all' && f.severity !== filterSev) return false;
    return true;
  }));

  return (
    <div className="min-h-full bg-[hsl(var(--surface-1))]">
      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-sm flex-shrink-0">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">AI Review Center</h1>
            <p className="text-xs text-slate-500">Operative Broker Intelligence — analysiert auf Anfrage, erklärt Zusammenhänge, ermöglicht direkte Handlung</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">

        {/* ── Level Selection ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {REVIEW_LEVELS.map(lv => {
            const Icon = lv.icon;
            const active = selectedLevel === lv.id;
            return (
              <button key={lv.id} onClick={() => setSelectedLevel(lv.id)}
                className={cn('text-left p-4 rounded-xl border-2 transition-all', active ? lv.activeBg : `${lv.passiveBg} hover:shadow-sm`)}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className={cn('w-4 h-4', active ? lv.iconActive : lv.iconPassive)} />
                  <span className={cn('text-sm font-bold', active ? 'text-white' : 'text-slate-800')}>{lv.label}</span>
                  <span className={cn('text-[10px] ml-auto', active ? 'text-white/70' : 'text-slate-400')}>{lv.duration}</span>
                </div>
                <p className={cn('text-[11px] leading-relaxed', active ? 'text-white/80' : 'text-slate-500')}>{lv.desc}</p>
              </button>
            );
          })}
        </div>

        {/* ── Start ── */}
        <div className="flex items-center gap-4 flex-wrap">
          <Button onClick={runReview} disabled={loading}
            className="h-11 px-8 text-sm font-semibold bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 border-0 shadow-sm"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyse läuft…</>
              : <><Brain className="w-4 h-4 mr-2" />Review starten</>
            }
          </Button>
          {result && (
            <button onClick={runReview} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
              <RefreshCw className="w-3.5 h-3.5" /> Erneut prüfen
            </button>
          )}
          {result && (
            <p className="text-xs text-slate-400">
              {new Date(result.reviewed_at).toLocaleString('de-CH')} · {result.reviewed_by}
            </p>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">{error}</div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center mx-auto mb-4">
              <Brain className="w-6 h-6 text-violet-600 animate-pulse" />
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">Operative Daten werden analysiert…</p>
            <p className="text-xs text-slate-400">Betroffene Kunden, Verträge und Handlungsoptionen werden ermittelt</p>
          </div>
        )}

        {/* ── Results ── */}
        {result && !loading && (
          <>
            <ExecutiveSummary
              findings={findings}
              level={result.level}
              reviewedAt={new Date(result.reviewed_at).toLocaleString('de-CH')}
            />

            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mr-1">{findings.length} Findings</span>
              {['all', ...Object.keys(AREA_CONFIG)].map(k => {
                const count = k === 'all' ? findings.length : findings.filter(f => f.area === k).length;
                if (k !== 'all' && count === 0) return null;
                const label = k === 'all' ? 'Alle' : AREA_CONFIG[k]?.label;
                return (
                  <button key={k} onClick={() => setFilterArea(k)}
                    className={cn('text-[11px] px-2.5 py-1 rounded-full border transition-colors',
                      filterArea === k ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    )}
                  >{label} {k !== 'all' && `(${count})`}</button>
                );
              })}
              <div className="w-px h-4 bg-slate-200" />
              {['critical','warning','opportunity'].map(s => {
                const count = findings.filter(f => f.severity === s).length;
                if (count === 0) return null;
                const cfg = SEVERITY_CONFIG[s];
                return (
                  <button key={s} onClick={() => setFilterSev(filterSev === s ? 'all' : s)}
                    className={cn('text-[11px] px-2.5 py-1 rounded-full border transition-colors',
                      filterSev === s ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    )}
                  >{cfg.label} ({count})</button>
                );
              })}
            </div>

            {/* Findings */}
            <div className="space-y-3">
              {filtered.length === 0
                ? <div className="text-center py-10 text-sm text-slate-400">Keine Findings für diesen Filter</div>
                : filtered.map((f, i) => <FindingCard key={f.id || i} finding={f} />)
              }
            </div>
          </>
        )}

        {/* ── Empty Start ── */}
        {!result && !loading && !error && (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-50 to-blue-50 border border-violet-100 flex items-center justify-center mx-auto mb-4">
              <Brain className="w-7 h-7 text-violet-400" />
            </div>
            <h3 className="text-base font-bold text-slate-700 mb-2">Operative Broker Intelligence</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
              Starten Sie einen Review. Die KI analysiert Ihre Kunden, Verträge und Daten und liefert
              konkrete Findings mit direkten Handlungsoptionen — ohne etwas automatisch zu verändern.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}