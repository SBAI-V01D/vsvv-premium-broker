import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Clock, User, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

function fmtDt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-CH', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

const ACTION_ICON = {
  approved:            { icon: CheckCircle2, color: 'text-emerald-600' },
  approval_revoked:    { icon: XCircle,      color: 'text-rose-600' },
  reapproval_triggered:{ icon: RefreshCw,    color: 'text-amber-600' },
  field_changed:       { icon: AlertTriangle,color: 'text-blue-600' },
};

export default function TabAudit() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['enterprise_system_logs'],
    queryFn: () => base44.entities.SystemLog.list('-created_date', 100),
    staleTime: 30_000,
  });

  const { data: dossiers = [] } = useQuery({
    queryKey: ['enterprise_audit_dossiers'],
    queryFn: () => base44.entities.AdvisoryDossier.list('-updated_date', 50),
    staleTime: 60_000,
  });

  // Extrahiere approval_history aus allen Dossiers
  const allHistory = dossiers
    .flatMap(d => (d.approval_history || []).map(h => ({ ...h, dossier_title: d.title, dossier_id: d.id })))
    .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

  return (
    <div className="max-w-4xl space-y-6">
      {/* Approval History */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-muted/30 border-b border-border/60">
          <p className="text-sm font-semibold">Approval-Historie ({allHistory.length} Einträge)</p>
          <p className="text-xs text-muted-foreground">Alle Freigaben, Widerrufe und Reapprovals aller Dossiers</p>
        </div>
        {allHistory.length === 0 ? (
          <div className="px-5 py-6 text-center text-sm text-muted-foreground">Noch keine Approval-Aktionen.</div>
        ) : (
          <div className="divide-y divide-border/60 max-h-80 overflow-y-auto">
            {allHistory.slice(0, 50).map((entry, i) => {
              const cfg = ACTION_ICON[entry.action] || ACTION_ICON.field_changed;
              const Icon = cfg.icon;
              return (
                <div key={i} className="px-5 py-3 flex items-center gap-3 text-xs">
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-foreground">{entry.action}</span>
                    <span className="text-muted-foreground ml-2">— {entry.dossier_title}</span>
                    {entry.user_name && <span className="text-muted-foreground ml-2">von {entry.user_name}</span>}
                    {entry.changed_fields && <span className="font-mono text-muted-foreground/60 ml-2">[{entry.changed_fields}]</span>}
                  </div>
                  <span className="text-muted-foreground shrink-0">{fmtDt(entry.timestamp)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SystemLog */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-muted/30 border-b border-border/60">
          <p className="text-sm font-semibold">SystemLog — letzte 100 Einträge</p>
          <p className="text-xs text-muted-foreground">Query-Fehler, Integrity-Warnungen, Runtime-Probleme</p>
        </div>
        {isLoading ? (
          <div className="px-5 py-6 text-center text-sm text-muted-foreground">Lädt…</div>
        ) : (
          <div className="divide-y divide-border/60 max-h-80 overflow-y-auto">
            {logs.map(log => (
              <div key={log.id} className={`px-5 py-2.5 flex items-start gap-3 text-xs ${
                log.level === 'error' ? 'bg-red-50/40' : log.level === 'warn' ? 'bg-amber-50/40' : ''
              }`}>
                <span className={`font-mono font-bold shrink-0 uppercase text-[10px] mt-0.5 ${
                  log.level === 'error' ? 'text-red-600' : log.level === 'warn' ? 'text-amber-600' : 'text-muted-foreground'
                }`}>{log.level}</span>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-foreground">[{log.source}]</span>
                  <span className="text-muted-foreground ml-1.5">{log.message}</span>
                </div>
                <span className="text-muted-foreground shrink-0">{fmtDt(log.created_date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}