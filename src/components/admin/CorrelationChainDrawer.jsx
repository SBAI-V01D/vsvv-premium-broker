import React, { useMemo } from 'react';
import { X, Clock, AlertTriangle, CheckCircle2, ChevronRight, Shield, Banknote, Layers, ArrowRight, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Config ───────────────────────────────────────────────────────────────────

const LEVEL_CONFIG = {
  1: { label: 'Critical', dot: 'bg-red-500', card: 'border-red-100 bg-red-50/40', badge: 'bg-red-100 text-red-700' },
  2: { label: 'Lifecycle', dot: 'bg-blue-500', card: 'border-slate-200 bg-white', badge: 'bg-blue-50 text-blue-700' },
  3: { label: 'Guard', dot: 'bg-amber-400', card: 'border-amber-100 bg-amber-50/30', badge: 'bg-amber-50 text-amber-700' },
  4: { label: 'Debug', dot: 'bg-slate-300', card: 'border-slate-100 bg-slate-50/50', badge: 'bg-slate-100 text-slate-500' },
};

const GUARD_RESULT = {
  blocked: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 border-red-200', label: 'Blocked' },
  allowed: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', label: 'Allowed' },
  skipped: { icon: ChevronRight, color: 'text-slate-400', bg: 'bg-slate-50 border-slate-200', label: 'Skipped' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('de-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function diffLabel(ms) {
  if (ms < 0) return null;
  if (ms < 1000) return `+${ms}ms`;
  if (ms < 60000) return `+${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `+${Math.floor(ms / 60000)}m`;
  return `+${(ms / 3600000).toFixed(1)}h`;
}

// ─── Summary bar ──────────────────────────────────────────────────────────────

function ChainSummary({ chain }) {
  const blocked = chain.filter(l => l.guard_result === 'blocked').length;
  const critical = chain.filter(l => l.audit_level === 1).length;
  const totalCHF = chain.reduce((s, l) => s + (l.business_impact_financial_chf || 0), 0);
  const processType = chain[0]?.process_type || '—';
  const duration = (() => {
    const ts = chain.map(l => new Date(l.timestamp).getTime()).filter(Boolean);
    if (ts.length < 2) return null;
    return diffLabel(Math.max(...ts) - Math.min(...ts));
  })();

  return (
    <div className="px-5 py-3.5 border-b border-border bg-slate-50/70 space-y-2 shrink-0">
      <div className="flex items-center gap-2 text-xs">
        <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="font-mono text-slate-600 font-medium">{processType}</span>
        {duration && <span className="text-muted-foreground">· Dauer {duration}</span>}
      </div>
      <div className="flex items-center gap-4 text-xs">
        <span className="text-muted-foreground"><strong className="text-foreground font-semibold">{chain.length}</strong> Events</span>
        {critical > 0 && (
          <span className="flex items-center gap-1 text-red-600 font-semibold">
            <AlertTriangle className="w-3 h-3" />{critical} Critical
          </span>
        )}
        {blocked > 0 && (
          <span className="flex items-center gap-1 text-red-600 font-medium">
            <Shield className="w-3 h-3" />{blocked} Blocked
          </span>
        )}
        {chain.filter(l => l.guard_result === 'allowed').length > 0 && (
          <span className="flex items-center gap-1 text-emerald-600">
            <CheckCircle2 className="w-3 h-3" />{chain.filter(l => l.guard_result === 'allowed').length} Allowed
          </span>
        )}
        {totalCHF > 0 && (
          <span className="flex items-center gap-1 text-emerald-700 font-semibold ml-auto">
            <Banknote className="w-3 h-3" />CHF {totalCHF.toLocaleString('de-CH')}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Single Event Card ────────────────────────────────────────────────────────

function EventCard({ log, timeDelta, isLast }) {
  const lvl = LEVEL_CONFIG[log.audit_level] || LEVEL_CONFIG[4];
  const guard = log.guard_result ? GUARD_RESULT[log.guard_result] : null;
  const GuardIcon = guard?.icon;
  const hasSideEffects = Array.isArray(log.side_effects) && log.side_effects.length > 0;
  const prevState = log.previous_state_summary && Object.keys(log.previous_state_summary).length > 0;
  const newState = log.new_state_summary && Object.keys(log.new_state_summary).length > 0;

  return (
    <div className="flex gap-3 relative">
      {/* Timeline spine */}
      <div className="flex flex-col items-center shrink-0" style={{ width: '14px' }}>
        <div className={`w-3 h-3 rounded-full border-2 border-white shadow-xs z-10 shrink-0 ${lvl.dot}`} style={{ marginTop: '14px' }} />
        {!isLast && <div className="w-px flex-1 bg-slate-200 mt-1 mb-0" style={{ minHeight: '12px' }} />}
      </div>

      {/* Card */}
      <div className={`flex-1 mb-3 rounded-lg border text-xs ${lvl.card}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${lvl.badge}`}>{lvl.label}</span>
            {log.event_sequence != null && (
              <span className="text-[10px] text-muted-foreground font-mono">#{log.event_sequence}</span>
            )}
            {guard && (
              <span className={`flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${guard.bg} ${guard.color}`}>
                <GuardIcon className="w-2.5 h-2.5" />{guard.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {timeDelta && (
              <span className="text-[10px] text-muted-foreground font-mono">{timeDelta}</span>
            )}
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 whitespace-nowrap">
              <Clock className="w-2.5 h-2.5" />{fmtTime(log.timestamp)}
            </span>
          </div>
        </div>

        {/* Event type & stage */}
        <div className="px-3 pb-2">
          <p className="font-mono font-semibold text-foreground text-[11px]">{log.event_type || '—'}</p>
          {log.process_stage && (
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{log.process_stage}</p>
          )}
        </div>

        {/* Decision Logic */}
        {log.decision_logic && (
          <div className="px-3 pb-2">
            <p className="text-slate-600 leading-relaxed">{log.decision_logic}</p>
          </div>
        )}

        {/* Guard reason (if different from decision_logic) */}
        {log.guard_reason && log.guard_reason !== log.decision_logic && (
          <div className="px-3 pb-2">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Guard: </span>
            <span className="text-slate-600">{log.guard_reason}</span>
          </div>
        )}

        {/* Decision Code */}
        {log.decision_code && (
          <div className="px-3 pb-2">
            <code className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{log.decision_code}</code>
          </div>
        )}

        {/* Business impact */}
        {(log.business_impact_description || log.business_impact_financial_chf > 0) && (
          <div className="px-3 pb-2 flex items-start gap-2">
            <Banknote className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
            <span className="text-slate-600 flex-1">{log.business_impact_description}</span>
            {log.business_impact_financial_chf > 0 && (
              <span className="font-semibold text-emerald-700 shrink-0">CHF {log.business_impact_financial_chf.toLocaleString('de-CH')}</span>
            )}
          </div>
        )}

        {/* State transition */}
        {prevState && newState && (
          <div className="px-3 pb-2 flex items-start gap-2">
            <Layers className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex items-center gap-1.5 flex-wrap text-[10px] min-w-0">
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-mono break-all">{JSON.stringify(log.previous_state_summary)}</code>
              <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
              <code className="bg-blue-50 px-1.5 py-0.5 rounded text-blue-700 font-mono border border-blue-100 break-all">{JSON.stringify(log.new_state_summary)}</code>
            </div>
          </div>
        )}

        {/* Side effects */}
        {hasSideEffects && (
          <div className="px-3 pb-3 mt-0.5">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">Side Effects</p>
            <div className="space-y-0.5">
              {log.side_effects.map((se, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <ArrowRight className="w-2.5 h-2.5 shrink-0" />
                  <span className="font-mono">{se.entity_type}</span>
                  <span className="text-slate-400">{se.action}</span>
                  {se.description && <span>— {se.description}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-3 pb-2.5 border-t border-black/5 mt-0.5 pt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
          {log.entity_type && <span className="font-mono">{log.entity_type}</span>}
          {log.business_severity_level && log.business_severity_level !== 'low' && (
            <span className={`font-semibold ${
              log.business_severity_level === 'critical' ? 'text-red-600' :
              log.business_severity_level === 'high' ? 'text-amber-600' : 'text-slate-500'
            }`}>
              {log.business_severity_level}
            </span>
          )}
          {log.actor_name && <span className="ml-auto text-slate-400">{log.actor_name}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Main Drawer ──────────────────────────────────────────────────────────────

export default function CorrelationChainDrawer({ correlationId, logs, onClose }) {
  const chain = useMemo(() =>
    logs
      .filter(l => l.correlation_id === correlationId)
      .sort((a, b) => {
        const seqDiff = (a.event_sequence || 0) - (b.event_sequence || 0);
        if (seqDiff !== 0) return seqDiff;
        return new Date(a.timestamp) - new Date(b.timestamp);
      }),
    [logs, correlationId]
  );

  const timestamps = chain.map(l => new Date(l.timestamp).getTime());

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/20 backdrop-blur-[1px]" onClick={onClose} />

      {/* Drawer panel */}
      <div className="w-[520px] bg-background border-l border-border flex flex-col shadow-modal overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-border bg-card shrink-0">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-0.5">Process Replay</p>
            <p className="text-sm font-bold text-primary font-mono leading-tight">{correlationId}</p>
            {chain[0]?.timestamp && (
              <p className="text-[11px] text-muted-foreground mt-0.5">{fmtDate(chain[0]?.timestamp)}</p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 shrink-0 mt-0.5">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Chain summary */}
        {chain.length > 0 && <ChainSummary chain={chain} />}

        {/* Timeline scroll area */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {chain.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-sm text-muted-foreground gap-2">
              <Shield className="w-8 h-8 text-slate-300" />
              <p>Keine Events für diese Correlation-ID</p>
            </div>
          ) : (
            chain.map((log, idx) => {
              const prevTs = idx > 0 ? timestamps[idx - 1] : null;
              const curTs = timestamps[idx];
              const delta = prevTs && curTs ? diffLabel(curTs - prevTs) : null;
              return (
                <EventCard
                  key={log.id}
                  log={log}
                  timeDelta={delta}
                  isLast={idx === chain.length - 1}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}