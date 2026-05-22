/**
 * TabModules — Systemweite Modul-Gesundheitsübersicht
 * Zeigt alle Kernmodule mit Status, KPIs und letzte Integrity-Ergebnisse.
 */
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, AlertTriangle, XCircle, Loader2, RefreshCw } from 'lucide-react';

const MODULE_META = {
  dossiers:     { label: 'Beratungsdossiers', color: 'blue' },
  customers:    { label: 'Kunden',             color: 'violet' },
  documents:    { label: 'Dokumente',          color: 'amber' },
  applications: { label: 'Anträge',            color: 'cyan' },
  contracts:    { label: 'Verträge',           color: 'emerald' },
  commissions:  { label: 'Provisionen',        color: 'rose' },
  leads:        { label: 'Leads',              color: 'orange' },
  tasks:        { label: 'Aufgaben',           color: 'slate' },
};

const STATUS_ICON = {
  ok:       { icon: CheckCircle2, cls: 'text-emerald-500' },
  warning:  { icon: AlertTriangle, cls: 'text-amber-500' },
  critical: { icon: XCircle,      cls: 'text-red-500' },
};

function ModuleCard({ moduleKey, moduleMeta, summary, issues }) {
  const statusKey = issues > 3 ? 'critical' : issues > 0 ? 'warning' : 'ok';
  const statusCfg = STATUS_ICON[statusKey];
  const Icon = statusCfg.icon;
  const cls = statusCfg.cls;

  return (
    <div className="border border-border rounded-xl p-4 bg-card hover:shadow-card-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-foreground">{moduleMeta.label}</span>
        <Icon className={`w-4 h-4 ${cls}`} />
      </div>
      <div className="text-2xl font-bold text-foreground mb-1">{issues}</div>
      <div className="text-xs text-muted-foreground">
        {issues === 0 ? 'Alle Prüfungen bestanden' : `Problem${issues !== 1 ? 'e' : ''} gefunden`}
      </div>
    </div>
  );
}

export default function TabModules() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { runCheck(); }, []);

  const runCheck = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('validateEnterpriseIntegrity', {});
      setResult(res.data);
    } finally {
      setLoading(false);
    }
  };

  const { data: systemLogs = [] } = useQuery({
    queryKey: ['modules_integrity_logs'],
    queryFn: () => base44.entities.SystemLog.filter({ source: 'enterprise_integrity_check' }, '-created_date', 10),
    staleTime: 30_000,
  });

  const moduleSummary = result?.module_summary || {};
  const moduleEntries = Object.entries(MODULE_META);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Systemweite Modul-Gesundheit</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Alle {moduleEntries.length} Kernmodule mit Integritätsstatus
            {result && ` · Zuletzt: ${new Date(result.timestamp).toLocaleTimeString('de-CH')}`}
          </p>
        </div>
        <button
          onClick={runCheck}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {loading ? 'Prüfe alle Module…' : 'Alle Module prüfen'}
        </button>
      </div>

      {/* Modul-Grid */}
      {result ? (
        <>
          {/* Gesamtstatus */}
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 ${
            result.status === 'ok' ? 'bg-emerald-50 border-emerald-200' :
            result.status === 'warning' ? 'bg-amber-50 border-amber-200' :
            'bg-red-50 border-red-200'
          }`}>
            {result.status === 'ok'
              ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              : result.status === 'warning'
                ? <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                : <XCircle className="w-5 h-5 text-red-600 shrink-0" />}
            <div>
              <p className="text-sm font-bold text-foreground">
                {result.total_issues === 0 ? 'Alle Systeme integer' : `${result.total_issues} Problem(e) systemweit`}
              </p>
              <p className="text-xs text-muted-foreground">
                {result.checks?.length} Checks · {moduleEntries.length} Module · von {result.checked_by}
              </p>
            </div>
          </div>

          {/* Modul-Kacheln */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {moduleEntries.map(([key, meta]) => (
              <ModuleCard
                key={key}
                moduleKey={key}
                moduleMeta={meta}
                summary={result.summary}
                issues={moduleSummary[key]?.issues ?? 0}
              />
            ))}
          </div>

          {/* Detail-Checks mit Problemen */}
          {result.checks?.filter(c => !c.passed).length > 0 && (
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-muted/30 border-b border-border/60">
                <p className="text-sm font-semibold">Offene Probleme — Detailansicht</p>
              </div>
              <div className="divide-y divide-border/60 max-h-80 overflow-y-auto">
                {result.checks.filter(c => !c.passed).map((check, i) => {
                  const modMeta = MODULE_META[check.module] || { label: check.module };
                  return (
                    <div key={i} className="px-5 py-3">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="text-xs font-semibold text-foreground">{modMeta.label} · {check.name}</span>
                        <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full ml-auto">
                          {check.issue_count} Problem(e)
                        </span>
                      </div>
                      {check.issues?.map((issue, j) => (
                        <div key={j} className="ml-5 text-[11px] text-muted-foreground font-mono bg-muted/40 rounded px-2 py-0.5 mt-0.5">
                          {issue.id?.slice(0, 8) || '—'} — {issue.issue || issue.missing}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Summary Stats */}
          <div className="border border-border rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Systemstatistik</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                ['Kunden',      result.summary?.total_customers],
                ['Verträge',    result.summary?.active_contracts],
                ['Dokumente',   result.summary?.total_documents],
                ['Anträge',     result.summary?.total_applications],
                ['Dossiers',    result.summary?.total_dossiers],
                ['Leads',       result.summary?.total_leads],
                ['Aufgaben',    result.summary?.total_tasks],
                ['Provisionen', result.summary?.total_commissions],
                ['Freigegeben', result.summary?.approved_dossiers],
                ['Exporte',     result.summary?.total_exports ?? '—'],
              ].map(([l, v]) => (
                <div key={l} className="text-center">
                  <div className="text-lg font-bold text-foreground">{v ?? '—'}</div>
                  <div className="text-[10px] text-muted-foreground">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="border border-dashed border-border rounded-xl px-8 py-12 text-center">
          <RefreshCw className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">Systemprüfung noch nicht gestartet</p>
          <p className="text-xs text-muted-foreground">Alle {moduleEntries.length} Kernmodule werden auf Enterprise-Integrität geprüft.</p>
        </div>
      )}

      {/* Letzte Prüfungen */}
      {systemLogs.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-muted/30 border-b border-border/60">
            <p className="text-sm font-semibold">Prüfungsprotokoll</p>
          </div>
          <div className="divide-y divide-border/60">
            {systemLogs.map(log => (
              <div key={log.id} className="px-5 py-2.5 flex items-center gap-3 text-xs">
                <span className={`font-bold uppercase text-[10px] shrink-0 ${
                  log.level === 'error' ? 'text-red-600' : log.level === 'warn' ? 'text-amber-600' : 'text-emerald-600'
                }`}>{log.level}</span>
                <span className="flex-1 text-muted-foreground">{log.message}</span>
                <span className="text-muted-foreground shrink-0">
                  {new Date(log.created_date).toLocaleString('de-CH', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}