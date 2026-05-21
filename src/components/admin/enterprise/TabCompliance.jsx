import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, CheckCircle2, TrendingDown } from 'lucide-react';

const RISK_CFG = {
  critical: { label: 'Kritisch', color: 'text-red-600 bg-red-50 border-red-200' },
  high:     { label: 'Hoch',     color: 'text-orange-600 bg-orange-50 border-orange-200' },
  medium:   { label: 'Mittel',   color: 'text-amber-600 bg-amber-50 border-amber-200' },
  low:      { label: 'Niedrig',  color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
};

function ConfBar({ value }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 rounded-full bg-muted/60 max-w-20">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono font-semibold shrink-0">{pct}%</span>
    </div>
  );
}

export default function TabCompliance() {
  const { data: dossiers = [], isLoading } = useQuery({
    queryKey: ['enterprise_compliance_dossiers'],
    queryFn: () => base44.entities.AdvisoryDossier.filter({ archived: false }, '-updated_date', 100),
    staleTime: 30_000,
  });

  const criticalRisk    = dossiers.filter(d => d.ai_risk_level === 'critical');
  const highRisk        = dossiers.filter(d => d.ai_risk_level === 'high');
  const requiresReview  = dossiers.filter(d => d.requires_manual_review && d.review_status !== 'freigegeben');
  const lowConf         = dossiers.filter(d => d.extraction_confidence != null && d.extraction_confidence < 0.6);

  return (
    <div className="max-w-4xl space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Kritisches Risiko', criticalRisk.length,   criticalRisk.length > 0 ? 'text-red-600' : 'text-muted-foreground'],
          ['Hohes Risiko',      highRisk.length,        highRisk.length > 0 ? 'text-orange-600' : 'text-muted-foreground'],
          ['Review-Pflicht',    requiresReview.length,  requiresReview.length > 0 ? 'text-amber-600' : 'text-muted-foreground'],
          ['Niedrige Conf.',    lowConf.length,          lowConf.length > 0 ? 'text-amber-600' : 'text-muted-foreground'],
        ].map(([l, v, c]) => (
          <div key={l} className="border border-border rounded-xl px-4 py-3 text-center bg-card">
            <div className={`text-2xl font-bold ${c}`}>{v}</div>
            <div className="text-xs text-muted-foreground mt-1">{l}</div>
          </div>
        ))}
      </div>

      {/* Kritische & hohe Risiken */}
      {(criticalRisk.length > 0 || highRisk.length > 0) && (
        <div className="border-2 border-orange-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-orange-50 border-b border-orange-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-600" />
            <p className="text-sm font-semibold text-orange-800">Dossiers mit erhöhtem AI-Risiko</p>
          </div>
          <div className="divide-y divide-orange-100">
            {[...criticalRisk, ...highRisk].slice(0, 20).map(d => {
              const cfg = RISK_CFG[d.ai_risk_level] || RISK_CFG.medium;
              return (
                <div key={d.id} className="px-5 py-3 flex items-center gap-3 text-xs bg-white">
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-foreground">{d.title}</span>
                    <span className="text-muted-foreground ml-2">{d.customer_name}</span>
                    {d.confidence_reason && <p className="text-muted-foreground mt-0.5 truncate">{d.confidence_reason}</p>}
                  </div>
                  <ConfBar value={d.extraction_confidence} />
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Alle Dossiers mit Confidence */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-muted/30 border-b border-border/60 flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Confidence-Übersicht — Alle Dossiers</p>
        </div>
        {isLoading ? (
          <div className="px-5 py-6 text-center text-sm text-muted-foreground">Lädt…</div>
        ) : dossiers.length === 0 ? (
          <div className="px-5 py-6 text-center flex flex-col items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <p className="text-sm text-muted-foreground">Keine Dossiers vorhanden.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60 max-h-64 overflow-y-auto">
            {dossiers.map(d => {
              const riskCfg = d.ai_risk_level ? RISK_CFG[d.ai_risk_level] : null;
              return (
                <div key={d.id} className="px-5 py-2.5 flex items-center gap-3 text-xs">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground truncate">{d.title}</span>
                    <span className="text-muted-foreground ml-2">{d.customer_name}</span>
                  </div>
                  <ConfBar value={d.extraction_confidence} />
                  {riskCfg && (
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${riskCfg.color}`}>{riskCfg.label}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}