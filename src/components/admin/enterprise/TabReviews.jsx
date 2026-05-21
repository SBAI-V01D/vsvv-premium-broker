import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Clock, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

const REVIEW_STATUS_LABEL = {
  offen:             { label: 'Offen',             color: 'text-slate-600 bg-slate-50 border-slate-200' },
  ki_analysiert:     { label: 'KI analysiert',     color: 'text-blue-600 bg-blue-50 border-blue-200' },
  in_pruefung:       { label: 'In Prüfung',        color: 'text-amber-600 bg-amber-50 border-amber-200' },
  berater_angepasst: { label: 'Berater angepasst', color: 'text-purple-600 bg-purple-50 border-purple-200' },
  freigegeben:       { label: 'Freigegeben',       color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  needs_reapproval:  { label: 'Reapproval nötig',  color: 'text-red-600 bg-red-50 border-red-200' },
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-CH');
}

export default function TabReviews() {
  const { data: dossiers = [], isLoading } = useQuery({
    queryKey: ['enterprise_review_queue'],
    queryFn: () => base44.entities.AdvisoryDossier.filter({ archived: false }, '-updated_date', 100),
    staleTime: 30_000,
  });

  const open          = dossiers.filter(d => d.review_status === 'offen' || d.review_status === 'in_pruefung');
  const needsReapproval = dossiers.filter(d => d.reapproval_required);
  const lowConf       = dossiers.filter(d => d.ai_risk_level === 'critical' || d.ai_risk_level === 'high');
  const approved      = dossiers.filter(d => d.advisor_approved);

  return (
    <div className="max-w-4xl space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Offene Reviews',    open.length,           open.length > 0 ? 'text-amber-600' : 'text-muted-foreground'],
          ['Reapproval nötig',  needsReapproval.length, needsReapproval.length > 0 ? 'text-red-600' : 'text-muted-foreground'],
          ['Kritische Conf.',   lowConf.length,         lowConf.length > 0 ? 'text-orange-600' : 'text-muted-foreground'],
          ['Freigegeben',       approved.length,        'text-emerald-600'],
        ].map(([l, v, c]) => (
          <div key={l} className="border border-border rounded-xl px-4 py-3 text-center bg-card">
            <div className={`text-2xl font-bold ${c}`}>{v}</div>
            <div className="text-xs text-muted-foreground mt-1">{l}</div>
          </div>
        ))}
      </div>

      {/* Reapproval Queue */}
      {needsReapproval.length > 0 && (
        <div className="border-2 border-red-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-red-50 border-b border-red-200 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-red-600" />
            <p className="text-sm font-semibold text-red-800">Reapproval erforderlich ({needsReapproval.length})</p>
          </div>
          <div className="divide-y divide-red-100">
            {needsReapproval.map(d => (
              <div key={d.id} className="px-5 py-3 flex items-center gap-3 text-xs bg-white">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <div className="flex-1">
                  <span className="font-semibold text-foreground">{d.title}</span>
                  <span className="text-muted-foreground ml-2">{d.customer_name}</span>
                  {d.reapproval_reason && <p className="text-red-600 mt-0.5">{d.reapproval_reason}</p>}
                </div>
                <span className="text-muted-foreground">{fmtDate(d.updated_date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alle Dossiers mit Status */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-muted/30 border-b border-border/60 flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Review Queue — Alle Dossiers</p>
        </div>
        {isLoading ? (
          <div className="px-5 py-6 text-center text-sm text-muted-foreground">Lädt…</div>
        ) : (
          <div className="divide-y divide-border/60 max-h-80 overflow-y-auto">
            {dossiers.map(d => {
              const cfg = REVIEW_STATUS_LABEL[d.review_status] || REVIEW_STATUS_LABEL.offen;
              return (
                <div key={d.id} className="px-5 py-3 flex items-center gap-3 text-xs">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground">{d.title}</span>
                    <span className="text-muted-foreground ml-2">{d.customer_name}</span>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
                  <span className="text-muted-foreground shrink-0">{fmtDate(d.updated_date)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}