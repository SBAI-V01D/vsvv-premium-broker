import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';

function fmtDt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-CH', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

export default function TabPerformance() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['enterprise_perf_logs'],
    queryFn: () => base44.entities.SystemLog.filter({ source: 'enterprise_monitoring' }, '-created_date', 100),
    staleTime: 30_000,
  });

  const { data: errorLogs = [] } = useQuery({
    queryKey: ['enterprise_error_logs'],
    queryFn: () => base44.entities.SystemLog.filter({ source: 'query_client' }, '-created_date', 50),
    staleTime: 30_000,
  });

  const renderWarnings = logs.filter(l => l.message?.includes('Render'));
  const queryWarnings  = logs.filter(l => l.message?.includes('Query'));

  return (
    <div className="max-w-4xl space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          ['Render-Warnungen',   renderWarnings.length, renderWarnings.length > 0 ? 'text-amber-600' : 'text-emerald-600'],
          ['Query-Warnungen',    queryWarnings.length,  queryWarnings.length  > 0 ? 'text-amber-600' : 'text-emerald-600'],
          ['Query-Fehler',       errorLogs.length,      errorLogs.length      > 0 ? 'text-red-600'   : 'text-emerald-600'],
        ].map(([l, v, c]) => (
          <div key={l} className="border border-border rounded-xl px-4 py-3 text-center bg-card">
            <div className={`text-2xl font-bold ${c}`}>{v}</div>
            <div className="text-xs text-muted-foreground mt-1">{l}</div>
          </div>
        ))}
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-muted/30 border-b border-border/60">
          <p className="text-sm font-semibold">Performance-Warnungen</p>
          <p className="text-xs text-muted-foreground">Render &gt;300ms / Query &gt;1s</p>
        </div>
        {isLoading ? (
          <div className="px-5 py-6 text-center text-sm text-muted-foreground">Lädt…</div>
        ) : logs.length === 0 ? (
          <div className="px-5 py-6 text-center flex flex-col items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            <p className="text-sm text-muted-foreground">Keine Performance-Probleme erkannt.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60 max-h-64 overflow-y-auto">
            {logs.map(log => {
              let details = {};
              try { details = JSON.parse(log.details || '{}'); } catch {}
              return (
                <div key={log.id} className="px-5 py-2.5 flex items-center gap-3 text-xs">
                  <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <div className="flex-1">
                    <span className="font-medium text-foreground">{log.message}</span>
                    {details.duration_ms && (
                      <span className="ml-2 font-mono text-amber-600">{details.duration_ms}ms</span>
                    )}
                  </div>
                  <span className="text-muted-foreground shrink-0">{fmtDt(log.created_date)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-muted/30 border-b border-border/60">
          <p className="text-sm font-semibold">Query-Fehler (automatisch geloggt)</p>
        </div>
        {errorLogs.length === 0 ? (
          <div className="px-5 py-6 text-center flex flex-col items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            <p className="text-sm text-muted-foreground">Keine Query-Fehler.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60 max-h-48 overflow-y-auto">
            {errorLogs.map(log => (
              <div key={log.id} className="px-5 py-2.5 flex items-center gap-3 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <div className="flex-1"><span className="text-foreground">{log.message}</span></div>
                <span className="text-muted-foreground shrink-0">{fmtDt(log.created_date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}