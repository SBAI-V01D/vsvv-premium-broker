/**
 * EnterpriseIntegrityPanel — Admin-only
 * Führt validateEnterpriseIntegrity aus und zeigt Ergebnisse strukturiert an.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, AlertTriangle, XCircle, Loader2, Shield, RefreshCw } from 'lucide-react';

const STATUS_CFG = {
  ok:       { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', label: 'Alle Prüfungen bestanden' },
  warning:  { icon: AlertTriangle, color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-200',   label: 'Warnungen vorhanden' },
  critical: { icon: XCircle,      color: 'text-red-600',     bg: 'bg-red-50 border-red-200',       label: 'Kritische Probleme' },
};

export default function EnterpriseIntegrityPanel() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('validateEnterpriseIntegrity', {});
      setResult(res.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const cfg = result ? (STATUS_CFG[result.status] || STATUS_CFG.ok) : null;
  const Icon = cfg?.icon;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 bg-muted/30 border-b border-border/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Shield className="w-4 h-4 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">Enterprise-Integritätsprüfung</p>
            <p className="text-xs text-muted-foreground">PDF-Governance · Approval · Snapshots · Confidence · Reapproval</p>
          </div>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {loading ? 'Prüfe…' : 'Prüfung starten'}
        </button>
      </div>

      {error && (
        <div className="px-5 py-4 text-sm text-destructive flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {result && (
        <div className="p-5 space-y-4">
          {/* Gesamtergebnis */}
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${cfg.bg}`}>
            <Icon className={`w-5 h-5 ${cfg.color} shrink-0`} />
            <div className="flex-1">
              <p className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {result.total_issues} Problem(e) · {result.summary?.total_dossiers} Dossiers · {result.summary?.approved_dossiers} freigegeben · geprüft von {result.checked_by}
              </p>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {new Date(result.timestamp).toLocaleTimeString('de-CH')}
            </span>
          </div>

          {/* Einzel-Checks */}
          <div className="space-y-2">
            {result.checks?.map((check) => (
              <div key={check.name} className="border border-border rounded-lg px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {check.passed
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
                    <span className="text-sm font-medium text-foreground">{check.name}</span>
                  </div>
                  {!check.passed && (
                    <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      {check.issue_count} Problem(e)
                    </span>
                  )}
                  {check.passed && (
                    <span className="text-xs text-emerald-600">✓ OK</span>
                  )}
                </div>

                {!check.passed && check.issues?.length > 0 && (
                  <div className="mt-2 space-y-1 pl-6">
                    {check.issues.map((issue, i) => (
                      <div key={i} className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 font-mono">
                        {issue.dossier_id || issue.log_id || issue.snapshot_id} — {issue.issue || issue.missing}
                      </div>
                    ))}
                    {check.issue_count > 10 && (
                      <p className="text-xs text-muted-foreground">+ {check.issue_count - 10} weitere…</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ['Dossiers', result.summary?.total_dossiers],
              ['Freigegeben', result.summary?.approved_dossiers],
              ['Exports', result.summary?.total_exports],
              ['Snapshots', result.summary?.total_snapshots],
            ].map(([label, val]) => (
              <div key={label} className="bg-muted/40 rounded-lg px-3 py-2 text-center">
                <div className="text-lg font-bold text-foreground">{val ?? '—'}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!result && !loading && (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
          Starten Sie die Prüfung, um alle Enterprise-Invarianten zu validieren.
        </div>
      )}
    </div>
  );
}