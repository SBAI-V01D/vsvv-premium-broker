import React, { useMemo } from 'react';
import { Shield, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';

export default function GuardHitsPanel({ logs }) {
  const guardStats = useMemo(() => {
    const map = {};
    logs.filter(l => l.guard_evaluated).forEach(l => {
      if (!map[l.guard_evaluated]) {
        map[l.guard_evaluated] = { name: l.guard_evaluated, blocked: 0, allowed: 0, skipped: 0, total: 0 };
      }
      map[l.guard_evaluated].total++;
      if (l.guard_result === 'blocked') map[l.guard_evaluated].blocked++;
      if (l.guard_result === 'allowed') map[l.guard_evaluated].allowed++;
      if (l.guard_result === 'skipped') map[l.guard_evaluated].skipped++;
    });
    return Object.values(map).sort((a, b) => b.blocked - a.blocked || b.total - a.total);
  }, [logs]);

  if (guardStats.length === 0) return null;

  return (
    <div className="surface p-4">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Guard Aktivität</h3>
        <span className="text-xs text-muted-foreground">({guardStats.length} Guards beobachtet)</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
        {guardStats.map(g => {
          const blockRate = g.total > 0 ? ((g.blocked / g.total) * 100).toFixed(0) : 0;
          const hasBlocks = g.blocked > 0;

          return (
            <div
              key={g.name}
              className={`rounded-lg border p-3 text-xs ${hasBlocks ? 'border-amber-200 bg-amber-50/50' : 'border-border bg-card'}`}
            >
              <p className="font-mono font-semibold text-slate-700 truncate mb-2" title={g.name}>{g.name}</p>
              <div className="flex items-center gap-3">
                {g.blocked > 0 && (
                  <span className="flex items-center gap-1 text-red-600 font-semibold">
                    <AlertTriangle className="w-3 h-3" />{g.blocked} blocked
                  </span>
                )}
                {g.allowed > 0 && (
                  <span className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="w-3 h-3" />{g.allowed}
                  </span>
                )}
                {g.skipped > 0 && (
                  <span className="flex items-center gap-1 text-slate-400">
                    <ChevronRight className="w-3 h-3" />{g.skipped}
                  </span>
                )}
              </div>
              {g.blocked > 0 && (
                <div className="mt-2">
                  <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-400 rounded-full transition-all"
                      style={{ width: `${blockRate}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{blockRate}% Block-Rate</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}