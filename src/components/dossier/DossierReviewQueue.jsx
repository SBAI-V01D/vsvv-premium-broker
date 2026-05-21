/**
 * DossierReviewQueue — Priorisierte Review-Warteschlange
 *
 * Sortierung:
 *   1. needs_reapproval / reapproval_required (höchste Dringlichkeit)
 *   2. critical/high ai_risk_level ohne Freigabe
 *   3. Empfehlung vorhanden aber nicht freigegeben
 *   4. Offene Entwürfe (oldest first)
 */
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, RefreshCw, Clock, CheckCircle2, AlertCircle, Shield, Filter } from 'lucide-react';
import ConfidenceBadge from '@/components/dossier/ConfidenceBadge';

const PRIORITY = {
  needs_reapproval:   { score: 100, label: 'Erneute Freigabe',  icon: RefreshCw,     color: 'text-amber-600',  bg: 'bg-amber-50',   border: 'border-amber-300' },
  critical_risk:      { score: 90,  label: 'KI-Risiko: Kritisch', icon: AlertTriangle, color: 'text-rose-600',   bg: 'bg-rose-50',    border: 'border-rose-300' },
  high_risk:          { score: 70,  label: 'KI-Risiko: Hoch',   icon: AlertCircle,   color: 'text-orange-600', bg: 'bg-orange-50',  border: 'border-orange-300' },
  awaiting_approval:  { score: 50,  label: 'Freigabe ausstehend', icon: Shield,        color: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-200' },
  open:               { score: 10,  label: 'Offen',             icon: Clock,         color: 'text-slate-500',  bg: 'bg-slate-50',   border: 'border-slate-200' },
};

const FILTER_OPTIONS = [
  { value: '',                label: 'Alle' },
  { value: 'needs_reapproval', label: '🔄 Erneute Freigabe' },
  { value: 'critical_risk',   label: '🔴 KI-Kritisch' },
  { value: 'high_risk',       label: '🟠 KI-Hoch' },
  { value: 'awaiting_approval', label: '🔵 Freigabe ausstehend' },
];

function getPriorityKey(d) {
  if (d.reapproval_required || d.review_status === 'needs_reapproval') return 'needs_reapproval';
  if (d.ai_risk_level === 'critical') return 'critical_risk';
  if (d.ai_risk_level === 'high') return 'high_risk';
  if (d.advisor_final_recommendation && !d.advisor_approved) return 'awaiting_approval';
  return 'open';
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d) / 86400000);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Gestern';
  if (diff < 7) return `vor ${diff} Tagen`;
  return d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function DossierReviewQueue({ onOpen }) {
  const [filterKey, setFilterKey] = useState('');

  const { data: dossiers = [], isLoading } = useQuery({
    queryKey: ['advisory_dossiers_queue'],
    queryFn: () => base44.entities.AdvisoryDossier.list('-updated_date', 200),
    staleTime: 30_000,
  });

  const queue = useMemo(() => {
    return dossiers
      .filter(d => !d.archived && d.status !== 'archiviert')
      .map(d => ({ ...d, _priorityKey: getPriorityKey(d) }))
      .filter(d => !filterKey || d._priorityKey === filterKey)
      .sort((a, b) => {
        const scoreDiff = (PRIORITY[b._priorityKey]?.score ?? 0) - (PRIORITY[a._priorityKey]?.score ?? 0);
        if (scoreDiff !== 0) return scoreDiff;
        // Älteste zuerst bei gleichem Score
        return (a.updated_date || '').localeCompare(b.updated_date || '');
      });
  }, [dossiers, filterKey]);

  // Zähler pro Kategorie
  const counts = useMemo(() => {
    const c = {};
    dossiers.filter(d => !d.archived).forEach(d => {
      const k = getPriorityKey(d);
      c[k] = (c[k] || 0) + 1;
    });
    return c;
  }, [dossiers]);

  const urgentCount = (counts['needs_reapproval'] || 0) + (counts['critical_risk'] || 0);

  if (isLoading) {
    return <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {/* KPI-Streifen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'needs_reapproval', label: 'Erneute Freigabe', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
          { key: 'critical_risk',    label: 'KI-Kritisch',       color: 'text-rose-700',   bg: 'bg-rose-50 border-rose-200' },
          { key: 'awaiting_approval',label: 'Freigabe offen',    color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
          { key: 'open',             label: 'Offene Entwürfe',   color: 'text-slate-600',  bg: 'bg-slate-50 border-slate-200' },
        ].map(item => (
          <button
            key={item.key}
            onClick={() => setFilterKey(f => f === item.key ? '' : item.key)}
            className={`border rounded-xl px-4 py-3 text-left transition-all hover:shadow-card-md ${item.bg} ${filterKey === item.key ? 'ring-2 ring-primary/30' : ''}`}
          >
            <div className={`text-2xl font-black ${item.color}`}>{counts[item.key] || 0}</div>
            <div className={`text-xs font-medium ${item.color} opacity-80 mt-0.5`}>{item.label}</div>
          </button>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
        {FILTER_OPTIONS.map(o => (
          <button
            key={o.value}
            onClick={() => setFilterKey(o.value)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${filterKey === o.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/40'}`}
          >
            {o.label}
            {o.value && counts[o.value] ? ` (${counts[o.value]})` : ''}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{queue.length} Einträge</span>
      </div>

      {/* Liste */}
      {queue.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-xl text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mb-3" />
          <p className="text-sm font-medium text-foreground">Review-Queue leer</p>
          <p className="text-xs text-muted-foreground mt-1">Keine offenen Review-Aufgaben.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {queue.map((d, i) => {
            const pCfg = PRIORITY[d._priorityKey] || PRIORITY.open;
            const PIcon = pCfg.icon;
            return (
              <div
                key={d.id}
                onClick={() => onOpen(d.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer hover:shadow-card-md transition-all ${pCfg.bg} ${pCfg.border}`}
              >
                {/* Prioritäts-Icon */}
                <div className={`w-8 h-8 rounded-lg bg-white/70 flex items-center justify-center shrink-0`}>
                  <PIcon className={`w-4 h-4 ${pCfg.color}`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground truncate">{d.title}</span>
                    <span className={`text-[10px] font-bold border px-2 py-0.5 rounded-full ${pCfg.color} bg-white/60 ${pCfg.border}`}>
                      {pCfg.label}
                    </span>
                    {d.extraction_confidence != null && (
                      <ConfidenceBadge confidence={d.extraction_confidence} label="KI" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    <span>{d.customer_name || '—'}</span>
                    {d.reapproval_reason && (
                      <span className="text-amber-600 truncate max-w-48">· {d.reapproval_reason}</span>
                    )}
                    <span className="ml-auto text-[11px]">{formatDate(d.updated_date)}</span>
                  </div>
                </div>

                {/* Rang */}
                <div className="text-[10px] font-mono text-muted-foreground/50 shrink-0">#{i + 1}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}