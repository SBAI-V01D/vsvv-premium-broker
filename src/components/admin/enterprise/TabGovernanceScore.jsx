/**
 * TabGovernanceScore — Governance Risk Score Dashboard
 * Mehrdimensionaler Echtzeit-Score für FINMA-Compliance,
 * Tenant Integrity, Audit Trail, AI Reliability, Incident Health, Data Quality.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Shield, RefreshCw, TrendingUp, TrendingDown, Minus,
  AlertTriangle, CheckCircle2, XCircle, Info,
  BarChart3, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

const DOMAIN_META = {
  compliance:       { label: 'Compliance',       color: 'blue',   icon: Shield },
  tenant_integrity: { label: 'Tenant Integrity',  color: 'violet', icon: Shield },
  audit_trail:      { label: 'Audit Trail',       color: 'amber',  icon: BarChart3 },
  ai_reliability:   { label: 'AI Reliability',    color: 'emerald',icon: TrendingUp },
  incident_health:  { label: 'Incident Health',   color: 'rose',   icon: AlertTriangle },
  data_quality:     { label: 'Data Quality',      color: 'sky',    icon: CheckCircle2 },
};

const COLOR_CLASSES = {
  blue:    { ring: 'text-blue-600',   bg: 'bg-blue-50',   bar: 'bg-blue-500',   border: 'border-blue-200' },
  violet:  { ring: 'text-violet-600', bg: 'bg-violet-50', bar: 'bg-violet-500', border: 'border-violet-200' },
  amber:   { ring: 'text-amber-600',  bg: 'bg-amber-50',  bar: 'bg-amber-500',  border: 'border-amber-200' },
  emerald: { ring: 'text-emerald-600',bg: 'bg-emerald-50',bar: 'bg-emerald-500',border: 'border-emerald-200' },
  rose:    { ring: 'text-rose-600',   bg: 'bg-rose-50',   bar: 'bg-rose-500',   border: 'border-rose-200' },
  sky:     { ring: 'text-sky-600',    bg: 'bg-sky-50',    bar: 'bg-sky-500',    border: 'border-sky-200' },
};

function riskColor(score) {
  if (score >= 85) return 'text-emerald-700 bg-emerald-50 border-emerald-300';
  if (score >= 70) return 'text-amber-700 bg-amber-50 border-amber-300';
  if (score >= 50) return 'text-orange-700 bg-orange-50 border-orange-300';
  return 'text-rose-700 bg-rose-50 border-rose-300';
}

function riskLabel(score) {
  if (score >= 85) return 'LOW RISK';
  if (score >= 70) return 'MEDIUM RISK';
  if (score >= 50) return 'HIGH RISK';
  return 'CRITICAL';
}

function ScoreRing({ score, size = 'lg' }) {
  const r = size === 'lg' ? 52 : 32;
  const cx = size === 'lg' ? 60 : 40;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 85 ? '#10b981' : score >= 70 ? '#f59e0b' : score >= 50 ? '#f97316' : '#ef4444';

  return (
    <svg width={cx * 2} height={cx * 2} className="transform -rotate-90">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#e5e7eb" strokeWidth={size === 'lg' ? 10 : 6} />
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke={color} strokeWidth={size === 'lg' ? 10 : 6}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s ease-out' }}
      />
      <text x={cx} y={cx} textAnchor="middle" dominantBaseline="central"
        className="rotate-90" transform={`rotate(90, ${cx}, ${cx})`}
        style={{ fill: color, fontSize: size === 'lg' ? '22px' : '14px', fontWeight: 700 }}>
        {score}
      </text>
    </svg>
  );
}

function DomainCard({ domainKey, data, weight }) {
  const meta = DOMAIN_META[domainKey] || {};
  const colorCls = COLOR_CLASSES[meta.color] || COLOR_CLASSES.blue;
  const Icon = meta.icon || Shield;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`bg-white rounded-xl border ${colorCls.border} p-4 hover:shadow-sm transition-all`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg ${colorCls.bg} flex items-center justify-center`}>
            <Icon className={`w-4 h-4 ${colorCls.ring}`} />
          </div>
          <div>
            <p className="text-xs font-bold text-[hsl(var(--text-heading))]">{meta.label}</p>
            <p className="text-[9px] text-[hsl(var(--text-subtle))]">Gewicht: {Math.round(weight * 100)}%</p>
          </div>
        </div>
        <ScoreRing score={data?.score || 0} size="sm" />
      </div>

      {/* Score bar */}
      <div className="w-full bg-slate-100 rounded-full h-1.5 mb-3">
        <div
          className={`h-1.5 rounded-full ${colorCls.bar} transition-all duration-700`}
          style={{ width: `${data?.score || 0}%` }}
        />
      </div>

      {/* Details toggle */}
      {data?.details && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[9px] text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-heading))] transition-colors"
        >
          {expanded ? '▲ weniger' : '▼ Details anzeigen'}
        </button>
      )}
      {expanded && data?.details && (
        <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
          {Object.entries(data.details).map(([k, v]) => (
            <div key={k} className="flex justify-between text-[9px]">
              <span className="text-[hsl(var(--text-muted))]">{k.replace(/_/g, ' ')}</span>
              <span className="font-medium text-[hsl(var(--text-heading))]">
                {typeof v === 'number' ? v.toLocaleString('de-CH') : (v || '—')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TabGovernanceScore() {
  const [isComputing, setIsComputing] = useState(false);

  const { data: snapshot, isLoading, refetch } = useQuery({
    queryKey: ['ecc_governance_snapshot'],
    queryFn: async () => {
      const snapshots = await base44.entities.GovernanceScoreSnapshot.list('-computed_at', 1);
      return snapshots[0] || null;
    },
    staleTime: 15 * 60 * 1000,
  });

  const data = snapshot; // backward compat

  async function handleComputeSnapshot() {
    setIsComputing(true);
    await base44.functions.invoke('snapshotGovernanceScore', {});
    await refetch();
    setIsComputing(false);
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[hsl(var(--text-heading))]">Governance Risk Score</h2>
          <p className="text-xs text-[hsl(var(--text-muted))]">
            Echtzeit-Bewertung der Enterprise-Governance-Qualität
          </p>
        </div>
        <button
          onClick={handleComputeSnapshot}
          disabled={isComputing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(var(--surface-1))] text-xs font-medium text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--surface-2))] transition-colors"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', isComputing && 'animate-spin')} />
          Neu berechnen
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
            <p className="text-xs text-[hsl(var(--text-muted))]">Score wird berechnet…</p>
          </div>
        </div>
      ) : data ? (
        <>
          {/* Overall Score */}
          <div className="bg-white rounded-2xl border border-[hsl(var(--border-subtle))]/40 p-6 flex items-center gap-8">
            <ScoreRing score={data.overall} size="lg" />
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-xl font-black text-[hsl(var(--text-heading))] tracking-tight">
                  Overall Governance Score
                </h3>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${riskColor(data.overall)}`}>
                  {riskLabel(data.overall)}
                </span>
              </div>
              <p className="text-xs text-[hsl(var(--text-muted))] mb-4">
                Berechnet: {data.computed_at ? new Date(data.computed_at).toLocaleString('de-CH') : '—'}
                {' · '}von {data.computed_by}
              </p>

              {/* Alert Summary */}
              {data.alerts?.length > 0 ? (
                <div className="space-y-1.5">
                  {data.alerts.map((alert, i) => (
                    <div key={i} className={`flex items-start gap-2 text-xs px-3 py-1.5 rounded-lg border ${
                      alert.severity === 'critical'
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}>
                      <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      {alert.message}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                  <CheckCircle2 className="w-3 h-3" />
                  Keine kritischen Governance-Warnungen
                </div>
              )}
            </div>
          </div>

          {/* Domain Scores Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(data.domains).map(([key, domainData]) => (
              <DomainCard
                key={key}
                domainKey={key}
                data={domainData}
                weight={data.weights?.[key] || 0}
              />
            ))}
          </div>

          {/* Weight Visualization */}
          <div className="bg-white rounded-xl border border-[hsl(var(--border-subtle))]/40 p-4">
            <h4 className="text-xs font-bold text-[hsl(var(--text-heading))] mb-3">Gewichtungsverteilung</h4>
            <div className="space-y-2">
              {Object.entries(data.domains).map(([key, domainData]) => {
                const meta = DOMAIN_META[key] || {};
                const colorCls = COLOR_CLASSES[meta.color] || COLOR_CLASSES.blue;
                const weight = data.weights?.[key] || 0;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-[10px] text-[hsl(var(--text-muted))] w-28 shrink-0">{meta.label}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${colorCls.bar} transition-all`}
                        style={{ width: `${domainData?.score || 0}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-[hsl(var(--text-heading))] w-8 text-right">
                      {domainData?.score || 0}
                    </span>
                    <span className="text-[9px] text-[hsl(var(--text-subtle))] w-8">({Math.round(weight * 100)}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-16 text-sm text-[hsl(var(--text-muted))]">
          Klicken Sie auf "Neu berechnen" um den Score zu generieren.
        </div>
      )}
    </div>
  );
}