/**
 * TabAiExplainability — AI Explainability Dashboard
 * Zeigt alle AiFindings mit voller Explainability, Confidence, Evidenz.
 * Ermöglicht manuelle Status-Updates und neue Finding-Generierung.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AiFindingCard from '@/components/ai/AiFindingCard';
import {
  Eye, RefreshCw, Filter, Zap, TrendingUp,
  AlertTriangle, CheckCircle2, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

const SEVERITY_FILTERS = [
  { value: 'all',      label: 'Alle',      color: 'slate' },
  { value: 'blocking', label: 'Blocking',  color: 'rose' },
  { value: 'critical', label: 'Kritisch',  color: 'red' },
  { value: 'warning',  label: 'Warnung',   color: 'amber' },
  { value: 'info',     label: 'Info',      color: 'blue' },
];

const STATUS_FILTERS = [
  { value: 'all',           label: 'Alle Status' },
  { value: 'new',           label: 'Neu' },
  { value: 'confirmed',     label: 'Bestätigt' },
  { value: 'false_positive',label: 'False Positive' },
  { value: 'resolved',      label: 'Gelöst' },
];

function KpiTile({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-xl border border-[hsl(var(--border-subtle))]/40 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-[hsl(var(--text-label))] uppercase">{label}</p>
        <Icon className={`w-4 h-4 text-${color}-500`} />
      </div>
      <p className={`text-2xl font-black text-${color}-600`}>{value}</p>
    </div>
  );
}

export default function TabAiExplainability() {
  const qc = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('new');

  const { data: findings = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['ai_findings'],
    queryFn: () => base44.entities.AiFinding.list('-created_date', 100),
    staleTime: 3 * 60 * 1000,
  });

  const filtered = findings.filter(f =>
    (severityFilter === 'all' || f.severity === severityFilter) &&
    (statusFilter === 'all' || f.status === statusFilter)
  );

  const avgConfidence = findings.length
    ? Math.round((findings.reduce((s, f) => s + (f.confidence_score || 0), 0) / findings.length) * 100)
    : 0;

  async function handleStatusChange(findingId, newStatus) {
    await base44.entities.AiFinding.update(findingId, { status: newStatus });
    qc.invalidateQueries({ queryKey: ['ai_findings'] });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[hsl(var(--text-heading))]">AI Explainability Layer</h2>
          <p className="text-xs text-[hsl(var(--text-muted))]">
            Vollständige Erklärbarkeit aller KI-Findings — Evidenz · Begründung · Konfidenz · Governance Impact
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(var(--surface-1))] text-xs font-medium text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--surface-2))] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
          {isFetching ? 'Lädt...' : 'Aktualisieren'}
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiTile label="Gesamt Findings" value={findings.length} icon={Eye} color="blue" />
        <KpiTile label="Kritisch / Blocking" value={findings.filter(f => ['critical','blocking'].includes(f.severity)).length} icon={AlertTriangle} color="rose" />
        <KpiTile label="Ø KI-Konfidenz" value={`${avgConfidence}%`} icon={TrendingUp} color="emerald" />
        <KpiTile label="False Positives" value={findings.filter(f => f.status === 'false_positive').length} icon={CheckCircle2} color="amber" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          {SEVERITY_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setSeverityFilter(f.value)}
              className={cn(
                'px-3 py-1 rounded-lg text-[10px] font-bold transition-colors',
                severityFilter === f.value
                  ? `bg-${f.color}-600 text-white`
                  : `bg-${f.color}-50 text-${f.color}-700 hover:bg-${f.color}-100`
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-4">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'px-3 py-1 rounded-lg text-[10px] font-semibold transition-colors',
                statusFilter === f.value
                  ? 'bg-[hsl(var(--primary))] text-white'
                  : 'bg-slate-100 text-[hsl(var(--text-muted))] hover:bg-slate-200'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Findings List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-sm text-[hsl(var(--text-muted))]">
          <Eye className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p>Keine AI Findings für diese Filter</p>
          <p className="text-xs mt-1">Führen Sie validateTenantIntegrity oder aiSystemReview aus, um Findings zu generieren.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-[hsl(var(--text-muted))]">{filtered.length} Findings</p>
          {filtered.map(f => (
            <AiFindingCard
              key={f.id}
              finding={f}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}