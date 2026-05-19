import React from 'react';
import { ChevronRight, X, Shield, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LEVEL_CONFIG = {
  1: { label: 'Critical', className: 'bg-red-100 text-red-700 border border-red-200' },
  2: { label: 'Lifecycle', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
  3: { label: 'Guard', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  4: { label: 'Debug', className: 'bg-slate-100 text-slate-500 border border-slate-200' },
};

const GUARD_ICON = {
  blocked: <AlertTriangle className="w-3 h-3 text-red-600" />,
  allowed: <CheckCircle2 className="w-3 h-3 text-emerald-600" />,
  skipped: <ChevronRight className="w-3 h-3 text-slate-400" />,
};

function fmt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('de-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function CorrelationChainDrawer({ correlationId, logs, onClose }) {
  const chain = logs
    .filter(l => l.correlation_id === correlationId)
    .sort((a, b) => (a.event_sequence || 0) - (b.event_sequence || 0));

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="w-[480px] bg-background border-l border-border flex flex-col shadow-modal overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card">
          <div>
            <p className="text-xs text-muted-foreground font-mono">Correlation Chain</p>
            <p className="text-sm font-bold text-primary font-mono">{correlationId}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Stats */}
        <div className="px-5 py-3 border-b border-border bg-slate-50/60 flex gap-4 text-xs text-muted-foreground">
          <span><strong className="text-foreground">{chain.length}</strong> Events</span>
          <span><strong className="text-red-600">{chain.filter(l => l.guard_result === 'blocked').length}</strong> Blocked</span>
          <span><strong className="text-emerald-600">{chain.filter(l => l.guard_result === 'allowed').length}</strong> Allowed</span>
          <span><strong className="text-foreground">{chain.filter(l => l.audit_level === 1).length}</strong> Critical</span>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-0">
          {chain.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Keine Events für diese Correlation-ID</p>
          ) : (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

              <div className="space-y-3">
                {chain.map((log, idx) => {
                  const lvl = LEVEL_CONFIG[log.audit_level] || LEVEL_CONFIG[4];
                  return (
                    <div key={log.id} className="flex gap-3 relative">
                      {/* Dot */}
                      <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 mt-1 z-10 ${
                        log.audit_level === 1 ? 'bg-red-500 border-red-500' :
                        log.audit_level === 2 ? 'bg-blue-500 border-blue-500' :
                        log.audit_level === 3 ? 'bg-amber-500 border-amber-500' :
                        'bg-slate-300 border-slate-300'
                      }`} />

                      {/* Content */}
                      <div className="flex-1 bg-card border border-border rounded-lg p-3 text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${lvl.className}`}>{lvl.label}</span>
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />{fmt(log.timestamp)}
                          </span>
                        </div>

                        <p className="font-semibold text-foreground font-mono">{log.event_type || '—'}</p>

                        {log.decision_logic && (
                          <p className="text-muted-foreground leading-relaxed">{log.decision_logic}</p>
                        )}

                        <div className="flex items-center gap-3 pt-0.5">
                          {log.guard_result && (
                            <span className="flex items-center gap-1">
                              {GUARD_ICON[log.guard_result]}
                              <span className={`font-semibold ${log.guard_result === 'blocked' ? 'text-red-600' : log.guard_result === 'allowed' ? 'text-emerald-600' : 'text-slate-500'}`}>
                                {log.guard_result}
                              </span>
                            </span>
                          )}
                          {log.entity_type && (
                            <span className="text-muted-foreground font-mono">{log.entity_type}</span>
                          )}
                          {log.business_impact_financial_chf > 0 && (
                            <span className="text-emerald-700 font-semibold">CHF {log.business_impact_financial_chf.toLocaleString('de-CH')}</span>
                          )}
                        </div>

                        {log.decision_code && (
                          <p className="font-mono text-[10px] text-slate-400 bg-slate-50 rounded px-1.5 py-0.5 inline-block">{log.decision_code}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}