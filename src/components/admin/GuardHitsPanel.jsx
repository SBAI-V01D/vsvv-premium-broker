import React, { useMemo, useState } from 'react';
import { Shield, AlertTriangle, CheckCircle2, ChevronRight, ChevronDown } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ─── Guard Row ────────────────────────────────────────────────────────────────

function GuardRow({ guard }) {
  const [open, setOpen] = useState(false);
  const blockRate = guard.total > 0 ? ((guard.blocked / guard.total) * 100).toFixed(0) : 0;
  const isActive = guard.blocked > 0;

  return (
    <div className={`border-b border-border last:border-0 transition-colors ${isActive ? 'bg-white' : 'bg-white'}`}>
      {/* Main row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/60 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        {/* Guard name */}
        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs font-semibold text-slate-700 truncate" title={guard.name}>{guard.name}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {guard.entityTypes.join(', ') || '—'}
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-5 shrink-0 text-xs">
          <div className="text-right">
            <p className="font-semibold text-slate-700">{guard.total}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </div>

          {guard.blocked > 0 ? (
            <div className="text-right">
              <p className="font-bold text-red-600">{guard.blocked}</p>
              <p className="text-[10px] text-muted-foreground">Blocked</p>
            </div>
          ) : (
            <div className="text-right">
              <p className="font-semibold text-slate-300">{guard.blocked}</p>
              <p className="text-[10px] text-muted-foreground">Blocked</p>
            </div>
          )}

          <div className="text-right">
            <p className="font-semibold text-emerald-600">{guard.allowed}</p>
            <p className="text-[10px] text-muted-foreground">Allowed</p>
          </div>

          {/* Block-rate bar */}
          <div className="w-20">
            <div className="flex items-center justify-between mb-0.5">
              <span className={`text-[10px] font-semibold ${isActive ? 'text-red-600' : 'text-slate-400'}`}>{blockRate}%</span>
            </div>
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
              {isActive && (
                <div
                  className="h-full bg-red-400 rounded-full"
                  style={{ width: `${blockRate}%` }}
                />
              )}
            </div>
          </div>

          {/* Last activity */}
          <div className="text-right hidden xl:block">
            <p className="text-[10px] text-slate-500 whitespace-nowrap">{fmt(guard.lastSeen)}</p>
            <p className="text-[10px] text-muted-foreground">Letzte Aktivität</p>
          </div>
        </div>

        {/* Expand toggle */}
        <div className="shrink-0 text-muted-foreground">
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 pb-3 pt-1 bg-slate-50/60 border-t border-slate-100 space-y-3 text-xs">
          {/* Decision codes */}
          {guard.decisionCodes.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-1.5">Decision Codes</p>
              <div className="flex flex-wrap gap-1.5">
                {guard.decisionCodes.map(([code, count]) => (
                  <span key={code} className="inline-flex items-center gap-1 font-mono text-[10px] bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded">
                    {code}
                    <span className="text-muted-foreground">×{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Business impact */}
          {guard.totalCHF > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-1">Business Impact</p>
              <p className="text-emerald-700 font-semibold">CHF {guard.totalCHF.toLocaleString('de-CH')} geschützt</p>
            </div>
          )}

          {/* Guard reasons (last 3) */}
          {guard.reasons.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-1">Letzte Entscheidungen</p>
              <div className="space-y-1">
                {guard.reasons.map((r, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    {r.result === 'blocked'
                      ? <AlertTriangle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
                      : r.result === 'allowed'
                        ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                        : <ChevronRight className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                    }
                    <span className="text-slate-500 leading-relaxed">{r.reason || r.logic || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function GuardHitsPanel({ logs }) {
  const guardStats = useMemo(() => {
    const map = {};
    logs.filter(l => l.guard_evaluated).forEach(l => {
      if (!map[l.guard_evaluated]) {
        map[l.guard_evaluated] = {
          name: l.guard_evaluated,
          blocked: 0, allowed: 0, skipped: 0, total: 0,
          entityTypes: new Set(),
          decisionCodeMap: {},
          reasons: [],
          lastSeen: null,
          totalCHF: 0,
        };
      }
      const g = map[l.guard_evaluated];
      g.total++;
      if (l.guard_result === 'blocked') g.blocked++;
      if (l.guard_result === 'allowed') g.allowed++;
      if (l.guard_result === 'skipped') g.skipped++;
      if (l.entity_type) g.entityTypes.add(l.entity_type);
      if (l.decision_code) g.decisionCodeMap[l.decision_code] = (g.decisionCodeMap[l.decision_code] || 0) + 1;
      if (l.business_impact_financial_chf) g.totalCHF += l.business_impact_financial_chf;
      if (l.timestamp && (!g.lastSeen || l.timestamp > g.lastSeen)) g.lastSeen = l.timestamp;
      if (g.reasons.length < 3 && (l.guard_reason || l.decision_logic)) {
        g.reasons.push({ result: l.guard_result, reason: l.guard_reason, logic: l.decision_logic });
      }
    });

    return Object.values(map)
      .map(g => ({
        ...g,
        entityTypes: [...g.entityTypes],
        decisionCodes: Object.entries(g.decisionCodeMap).sort((a, b) => b[1] - a[1]).slice(0, 5),
      }))
      .sort((a, b) => b.blocked - a.blocked || b.total - a.total);
  }, [logs]);

  if (guardStats.length === 0) return null;

  const totalBlocked = guardStats.reduce((s, g) => s + g.blocked, 0);
  const totalAllowed = guardStats.reduce((s, g) => s + g.allowed, 0);

  return (
    <div className="surface overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border bg-slate-50/60">
        <div className="flex items-center gap-2.5">
          <Shield className="w-4 h-4 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Guard Intelligence</h3>
            <p className="text-[11px] text-muted-foreground">{guardStats.length} Guards aktiv</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          {totalBlocked > 0 && (
            <span className="flex items-center gap-1.5 text-red-600 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />{totalBlocked} Blocks total
            </span>
          )}
          <span className="flex items-center gap-1.5 text-emerald-600">
            <CheckCircle2 className="w-3.5 h-3.5" />{totalAllowed} Allowed
          </span>
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-slate-50/30 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
        <div className="flex-1">Guard / Entity</div>
        <div className="flex gap-5 shrink-0 text-right pr-8">
          <span className="w-8">Total</span>
          <span className="w-12">Blocked</span>
          <span className="w-12">Allowed</span>
          <span className="w-20">Block-Rate</span>
          <span className="w-24 hidden xl:block">Letzte Aktivität</span>
        </div>
      </div>

      {/* Guard rows */}
      <div>
        {guardStats.map(g => <GuardRow key={g.name} guard={g} />)}
      </div>
    </div>
  );
}