/**
 * TabValidation — Live-System-Validierung mit Deep Diagnostics
 * Zeigt affected_records: konkrete betroffene Datensätze mit ID, Name, Link, Detail
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, XCircle, AlertTriangle, Loader2, PlayCircle, Shield, Award, ExternalLink } from 'lucide-react';

const CATEGORY_LABELS = {
  pdf_integrity:      'PDF-Hash-Integrität',
  security:           'Security / Rollen',
  document_integrity: 'Dokumentintegrität',
  recovery:           'Recovery-Readiness',
  export_gate:        'Export-Gate',
  approval:           'Approval-Integrität',
  snapshots:          'Snapshot-Konsistenz',
  tenant_isolation:   'Tenant-Isolation',
  data_integrity:     'Datenintegrität',
  audit_trail:        'Audit-Trail',
};

const STATUS_CFG = {
  FREIGEGEBEN:               { bg: 'bg-emerald-50 border-emerald-300', text: 'text-emerald-800', label: '✓ PRODUKTIONSFREIGABE ERTEILT', icon: Award },
  FREIGEGEBEN_MIT_WARNUNGEN: { bg: 'bg-amber-50 border-amber-300',    text: 'text-amber-800',   label: '⚠ FREIGEGEBEN MIT WARNUNGEN', icon: AlertTriangle },
  NICHT_FREIGEGEBEN:         { bg: 'bg-red-50 border-red-300',        text: 'text-red-800',     label: '✗ NICHT FREIGEGEBEN — PROBLEME BEHEBEN', icon: XCircle },
};

function AffectedRecordsList({ records, severity }) {
  const [expanded, setExpanded] = useState(false);
  if (!records || records.length === 0) return null;

  const colorClass = severity === 'warning'
    ? 'border-amber-200 bg-amber-50/60'
    : 'border-red-200 bg-red-50/50';
  const badgeClass = severity === 'warning'
    ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-700';
  const labelClass = severity === 'warning' ? 'text-amber-700' : 'text-red-700';
  const rowClass = severity === 'warning'
    ? 'bg-amber-50 text-amber-900'
    : 'bg-red-50/80 text-red-900';

  const visible = expanded ? records : records.slice(0, 5);
  const hidden = records.length - 5;

  return (
    <div className={`mt-2 border rounded-lg px-3 py-2.5 ${colorClass}`}>
      <p className={`text-[10px] font-black uppercase tracking-wide mb-2 ${labelClass}`}>
        Betroffene Datensätze ({records.length}{records.length === 25 ? '+' : ''})
      </p>
      <div className="space-y-1">
        {visible.map((rec, i) => (
          <div key={i} className={`flex items-center gap-2 rounded px-2 py-1 ${rowClass}`}>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${badgeClass}`}>
              {rec.type}
            </span>
            {rec.link ? (
              <a href={rec.link} className="text-[11px] font-semibold hover:underline truncate flex items-center gap-1">
                {rec.name}
                <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-60" />
              </a>
            ) : (
              <span className="text-[11px] font-semibold truncate">{rec.name}</span>
            )}
            {rec.detail && (
              <span className="text-[10px] text-muted-foreground shrink-0 ml-auto truncate max-w-[200px]">{rec.detail}</span>
            )}
          </div>
        ))}
      </div>
      {!expanded && hidden > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className={`mt-1.5 text-[10px] font-semibold hover:underline ${labelClass}`}
        >
          + {hidden} weitere anzeigen
        </button>
      )}
      {expanded && records.length > 5 && (
        <button
          onClick={() => setExpanded(false)}
          className={`mt-1.5 text-[10px] font-semibold hover:underline ${labelClass}`}
        >
          Weniger anzeigen
        </button>
      )}
    </div>
  );
}

export default function TabValidation() {
  const qc = useQueryClient();
  // Report wird im Query-Cache persistiert — überlebt Navigation
  const { data: report = null } = useQuery({
    queryKey: ['validation_report'],
    queryFn: () => null,
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('runLiveSystemValidation', {});
      qc.setQueryData(['validation_report'], res.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const grouped = report?.tests?.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {}) ?? {};

  const statusCfg = report ? STATUS_CFG[report.production_status] || STATUS_CFG.NICHT_FREIGEGEBEN : null;
  const StatusIcon = statusCfg?.icon;

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Live-System-Validierung mit Deep Diagnostics</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Export-Gate · Approval · Snapshots · Tenant-Isolation · Datenintegrität · Audit-Trail · Security · Recovery
          </p>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
          {loading ? 'Teste System…' : 'Live-Validation starten'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
          <XCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {report && (
        <>
          {/* Produktionsfreigabe-Status */}
          <div className={`border-2 rounded-xl px-5 py-4 flex items-center gap-4 ${statusCfg.bg}`}>
            <StatusIcon className={`w-8 h-8 ${statusCfg.text} shrink-0`} />
            <div className="flex-1">
              <p className={`text-base font-black ${statusCfg.text}`}>{statusCfg.label}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {report.summary.passed} von {report.summary.total_tests} Tests bestanden ({report.summary.pass_rate}%)
                · {report.summary.failed} fehlgeschlagen · {report.summary.warnings} Warnungen
                · {report.run_by} · {new Date(report.timestamp).toLocaleString('de-CH')}
              </p>
              {report.new_incidents_created > 0 && (
                <p className="text-xs text-red-700 font-semibold mt-1">
                  {report.new_incidents_created} neue Incident(s) erstellt
                  {report.deduplicated_incidents > 0 && ` · ${report.deduplicated_incidents} bereits bekannt`}
                </p>
              )}
            </div>
          </div>

          {/* KPI */}
          <div className="grid grid-cols-4 gap-3">
            {[
              ['Tests gesamt',    report.summary.total_tests, 'text-foreground'],
              ['Bestanden',       report.summary.passed,      'text-emerald-600'],
              ['Fehlgeschlagen',  report.summary.failed,      report.summary.failed > 0 ? 'text-red-600' : 'text-muted-foreground'],
              ['Warnungen',       report.summary.warnings,    report.summary.warnings > 0 ? 'text-amber-600' : 'text-muted-foreground'],
            ].map(([l, v, c]) => (
              <div key={l} className="border border-border rounded-xl px-4 py-3 text-center bg-card">
                <div className={`text-2xl font-bold ${c}`}>{v}</div>
                <div className="text-xs text-muted-foreground mt-1">{l}</div>
              </div>
            ))}
          </div>

          {/* Tests nach Kategorie */}
          {Object.entries(grouped).map(([cat, tests]) => {
            const allPassed = tests.every(t => t.passed);
            const hasFailed = tests.some(t => !t.passed && t.severity === 'critical');
            return (
              <div key={cat} className="border border-border rounded-xl overflow-hidden">
                <div className={`px-5 py-3 border-b border-border/60 flex items-center justify-between ${
                  hasFailed ? 'bg-red-50' : !allPassed ? 'bg-amber-50' : 'bg-emerald-50/50'
                }`}>
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">{CATEGORY_LABELS[cat] || cat}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                    hasFailed ? 'text-red-700 bg-red-50 border-red-200' :
                    !allPassed ? 'text-amber-700 bg-amber-50 border-amber-200' :
                    'text-emerald-700 bg-emerald-50 border-emerald-200'
                  }`}>
                    {tests.filter(t => t.passed).length}/{tests.length} OK
                  </span>
                </div>
                <div className="divide-y divide-border/60">
                  {tests.map((test, i) => (
                    <div key={i} className="px-5 py-3 text-xs">
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 mt-0.5">
                          {test.passed
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            : test.severity === 'warning'
                              ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                              : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`font-semibold ${
                            test.passed ? 'text-foreground'
                            : test.severity === 'warning' ? 'text-amber-800' : 'text-red-800'
                          }`}>
                            {test.name}
                          </span>
                          {test.details && (
                            <p className="text-muted-foreground mt-0.5">{test.details}</p>
                          )}
                          {!test.passed && (
                            <AffectedRecordsList records={test.affected_records} severity={test.severity} />
                          )}
                        </div>
                        {!test.passed && (
                          <span className={`shrink-0 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            test.severity === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                          }`}>{test.severity}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Systemstatistik */}
          <div className="border border-border rounded-xl p-4 bg-muted/20">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Systemstatistik</p>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
              {[
                ['Dossiers',    report.summary.dossiers],
                ['Freigegeben', report.summary.approved_dossiers],
                ['Exporte',     report.summary.exports],
                ['Snapshots',   report.summary.snapshots],
                ['Benutzer',    report.summary.users],
                ['Admins',      report.summary.admin_users],
                ['Backups',     report.summary.backups],
              ].map(([l, v]) => (
                <div key={l} className="text-center">
                  <div className="text-base font-bold text-foreground">{v}</div>
                  <div className="text-[10px] text-muted-foreground">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!report && !loading && (
        <div className="border border-dashed border-border rounded-xl px-8 py-14 text-center">
          <PlayCircle className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground mb-1">Deep Diagnostics noch nicht gestartet</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Jeder fehlgeschlagene Test zeigt jetzt konkrete betroffene Datensätze mit IDs, Namen und Direktlinks — operativ lösbar.
          </p>
        </div>
      )}
    </div>
  );
}