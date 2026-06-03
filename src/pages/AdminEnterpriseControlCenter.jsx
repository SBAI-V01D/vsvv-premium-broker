/**
 * Admin Dashboard — Zusammengefasste Sicht
 * Gesundheitsscore · Kritische Probleme · Betriebsmetriken · KI-Verbesserungen
 */
import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import {
  Shield, AlertTriangle, CheckCircle2, TrendingUp, Zap, Brain,
  Database, Users, Clock, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp,
  RefreshCw, Loader2, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import toast from 'react-hot-toast';

// ── Score-Farben ──────────────────────────────────────────────────────────────
function scoreColor(v) {
  if (v >= 85) return 'text-emerald-600';
  if (v >= 70) return 'text-amber-600';
  if (v >= 50) return 'text-orange-600';
  return 'text-rose-600';
}
function scoreBg(v) {
  if (v >= 85) return 'bg-emerald-50 border-emerald-200';
  if (v >= 70) return 'bg-amber-50 border-amber-200';
  if (v >= 50) return 'bg-orange-50 border-orange-200';
  return 'bg-rose-50 border-rose-200';
}

// ── Mini Score-Karte ──────────────────────────────────────────────────────────
function ScoreCard({ label, value, desc }) {
  return (
    <div className={cn('rounded-xl border p-4', scoreBg(value))}>
      <p className="text-[10px] font-semibold uppercase text-slate-500 mb-1">{label}</p>
      <p className={cn('text-3xl font-bold', scoreColor(value))}>{value}</p>
      {desc && <p className="text-[10px] text-muted-foreground mt-1">{desc}</p>}
    </div>
  );
}

// ── Metrik-Zeile ─────────────────────────────────────────────────────────────
function MetricRow({ label, value, ok, warn }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-xs font-semibold', ok ? 'text-emerald-600' : warn ? 'text-rose-600' : 'text-slate-700')}>{value}</span>
    </div>
  );
}

// ── Problem-Karte ─────────────────────────────────────────────────────────────
function IssueCard({ issue, type = 'critical' }) {
  const isCrit = type === 'critical';
  return (
    <div className={cn('p-3 rounded-lg border', isCrit ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200')}>
      <p className={cn('text-xs font-semibold', isCrit ? 'text-rose-800' : 'text-amber-800')}>{issue.message}</p>
      {issue.recommendation && (
        <p className={cn('text-xs mt-0.5', isCrit ? 'text-rose-600' : 'text-amber-600')}>→ {issue.recommendation}</p>
      )}
    </div>
  );
}

// ── Verbesserungs-Karte ───────────────────────────────────────────────────────
function ImprovementCard({ imp, onApprove, onReject }) {
  const [expanded, setExpanded] = useState(false);
  const prioBg = {
    critical: 'bg-rose-50 border-rose-200 text-rose-700',
    high:     'bg-orange-50 border-orange-200 text-orange-700',
    medium:   'bg-blue-50 border-blue-200 text-blue-700',
    low:      'bg-slate-50 border-slate-200 text-slate-600',
  };

  return (
    <div className="surface-sm border">
      <div className="p-3">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <Badge className={cn('text-[10px] border', prioBg[imp.priority] || prioBg.medium)}>{imp.priority}</Badge>
              <span className="text-[10px] text-muted-foreground">{imp.area?.replace(/_/g, ' ')}</span>
            </div>
            <p className="text-sm font-semibold leading-snug">{imp.title}</p>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground flex-shrink-0 mt-0.5">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {expanded && (
          <div className="mt-3 space-y-2">
            {imp.current_state && (
              <div className="p-2 bg-rose-50 border border-rose-100 rounded-lg">
                <p className="text-[9px] font-semibold uppercase text-rose-500 mb-0.5">Aktuell</p>
                <p className="text-xs text-rose-800">{imp.current_state}</p>
              </div>
            )}
            {imp.target_state && (
              <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                <p className="text-[9px] font-semibold uppercase text-emerald-500 mb-0.5">Ziel</p>
                <p className="text-xs text-emerald-800">{imp.target_state}</p>
              </div>
            )}
            {imp.ki_recommendation && (
              <div className="p-2 bg-violet-50 border border-violet-100 rounded-lg">
                <p className="text-[9px] font-semibold uppercase text-violet-500 mb-0.5">KI-Empfehlung</p>
                <p className="text-xs text-violet-800">{imp.ki_recommendation}</p>
              </div>
            )}
            {imp.status === 'proposed' && (
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="bg-emerald-600 gap-1.5 h-7 text-xs" onClick={onApprove}>
                  <ThumbsUp className="w-3 h-3" />Umsetzen
                </Button>
                <Button size="sm" variant="outline" className="text-rose-600 border-rose-200 gap-1.5 h-7 text-xs" onClick={onReject}>
                  <ThumbsDown className="w-3 h-3" />Ablehnen
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Haupt-Seite ───────────────────────────────────────────────────────────────
export default function AdminEnterpriseControlCenter() {
  const { user } = useAuth();
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAllWarnings, setShowAllWarnings] = useState(false);

  const { data: improvements = [], refetch: refetchImprovements } = useQuery({
    queryKey: ['enterprise_improvements'],
    queryFn: () => base44.entities.EnterpriseImprovement.list('-proposed_at', 100),
  });

  const activeImprovements = improvements.filter(i => !['verified', 'rejected'].includes(i.status));

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('centralAnalysisEngine', {});
      setAnalysisData(res.data);
    } catch (e) {
      toast.error('Analyse fehlgeschlagen');
    }
    setLoading(false);
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('generateEnterpriseImprovements', {});
      return res.data;
    },
    onSuccess: (data) => {
      refetchImprovements();
      toast.success(`${data.total_count || 0} Verbesserungsvorschläge generiert`);
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (imp) => {
      const me = await base44.auth.me();
      await base44.entities.EnterpriseImprovement.update(imp.id, {
        status: 'implemented',
        approved_by: me?.email,
        approved_at: new Date().toISOString(),
        implemented_at: new Date().toISOString(),
      });
    },
    onSuccess: () => { refetchImprovements(); toast.success('Umgesetzt ✅'); },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id) => base44.entities.EnterpriseImprovement.update(id, { status: 'rejected' }),
    onSuccess: () => { refetchImprovements(); toast.success('Abgelehnt'); },
  });

  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Shield className="w-10 h-10 text-amber-500" />
        <p className="text-sm font-semibold">Zugriff verweigert — Admin erforderlich</p>
      </div>
    );
  }

  const { scores, metrics, critical_issues = [], warnings = [], risk_level } = analysisData || {};

  const riskBadge = {
    low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    critical: 'bg-rose-100 text-rose-700 border-rose-200',
  };
  const riskLabel = { low: 'Tief', medium: 'Mittel', high: 'Hoch', critical: 'Kritisch' };

  const visibleWarnings = showAllWarnings ? warnings : warnings.slice(0, 3);

  return (
    <div className="page-enter flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-primary tracking-tight">Admin Dashboard</h1>
              <p className="text-xs text-muted-foreground">System-Gesundheit · Kritische Probleme · KI-Verbesserungen</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {analysisData && risk_level && (
              <Badge className={cn('border', riskBadge[risk_level] || riskBadge.medium)}>
                Risiko: {riskLabel[risk_level]} · {scores?.overall}/100
              </Badge>
            )}
            <Button onClick={runAnalysis} disabled={loading} size="sm"
              className="bg-gradient-to-r from-violet-600 to-blue-600 gap-2">
              {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Analysiert...</> : <><Zap className="w-3.5 h-3.5" />{analysisData ? 'Aktualisieren' : 'Analyse starten'}</>}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* ── KEINE DATEN ── */}
        {!analysisData && !loading && (
          <div className="surface p-12 text-center">
            <Zap className="w-10 h-10 mx-auto mb-3 text-violet-300" />
            <p className="text-sm font-semibold mb-1">Analyse noch nicht gestartet</p>
            <p className="text-xs text-muted-foreground mb-4">Starten Sie die Analyse, um Gesundheitsscore, Probleme und Metriken zu sehen.</p>
            <Button onClick={runAnalysis} className="bg-gradient-to-r from-violet-600 to-blue-600">
              <Zap className="w-4 h-4 mr-2" />Analyse starten
            </Button>
          </div>
        )}

        {loading && (
          <div className="surface p-12 text-center">
            <Loader2 className="w-8 h-8 mx-auto mb-3 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">System wird analysiert…</p>
          </div>
        )}

        {analysisData && !loading && (
          <>
            {/* ── SCORES ── */}
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-3">Gesundheitsscore</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ScoreCard label="Gesamt" value={scores.overall} desc="Gesamtscore" />
                <ScoreCard label="Governance" value={scores.governance} desc="Freigaben · Incidents" />
                <ScoreCard label="Datenqualität" value={scores.data_quality} desc="E-Mail · Berater" />
                <ScoreCard label="CRM-Betrieb" value={scores.crm_health} desc="Tasks · Pipeline" />
              </div>
            </div>

            {/* ── KRITISCHE PROBLEME ── */}
            {critical_issues.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-3 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  Kritische Probleme ({critical_issues.length})
                </p>
                <div className="space-y-2">
                  {critical_issues.map((issue, i) => <IssueCard key={i} issue={issue} type="critical" />)}
                </div>
              </div>
            )}

            {/* ── WARNUNGEN ── */}
            {warnings.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-3 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Warnungen ({warnings.length})
                </p>
                <div className="space-y-2">
                  {visibleWarnings.map((w, i) => <IssueCard key={i} issue={w} type="warning" />)}
                </div>
                {warnings.length > 3 && (
                  <button onClick={() => setShowAllWarnings(!showAllWarnings)}
                    className="mt-2 text-xs text-primary hover:underline flex items-center gap-1">
                    {showAllWarnings ? <><ChevronUp className="w-3 h-3" />Weniger anzeigen</> : <><ChevronDown className="w-3 h-3" />Alle {warnings.length} Warnungen anzeigen</>}
                  </button>
                )}
              </div>
            )}

            {/* ── METRIKEN ── */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="surface p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-3 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />Kunden & Verträge
                </p>
                <MetricRow label="Aktive Kunden" value={metrics.active_customers} />
                <MetricRow label="Aktive Verträge" value={metrics.active_contracts} />
                <MetricRow label="E-Mail Coverage" value={`${metrics.email_coverage_pct}%`} ok={metrics.email_coverage_pct >= 80} warn={metrics.email_coverage_pct < 60} />
                <MetricRow label="Berater-Abdeckung" value={`${metrics.advisor_coverage_pct}%`} ok={metrics.advisor_coverage_pct >= 80} warn={metrics.advisor_coverage_pct < 60} />
                <MetricRow label="Renewals (90 Tage)" value={metrics.renewals_next_90_days} />
              </div>
              <div className="surface p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-3 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />Betrieb
                </p>
                <MetricRow label="Offene Tasks" value={metrics.open_tasks} />
                <MetricRow label="Überfällige Tasks" value={metrics.overdue_tasks} ok={metrics.overdue_tasks === 0} warn={metrics.overdue_tasks > 0} />
                <MetricRow label="Task-Abschluss" value={`${metrics.task_completion_pct}%`} ok={metrics.task_completion_pct >= 70} />
                <MetricRow label="Aktive Leads" value={metrics.active_leads} />
                <MetricRow label="Aktive Opportunities" value={metrics.active_opportunities} />
              </div>
              <div className="surface p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-3 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />Governance
                </p>
                <MetricRow label="Admin-Konten" value={metrics.admin_count} ok={metrics.admin_count <= 5} warn={metrics.admin_count > 5} />
                <MetricRow label="Benutzer o. Rolle" value={metrics.users_no_role} ok={metrics.users_no_role === 0} warn={metrics.users_no_role > 0} />
                <MetricRow label="Krit. Incidents" value={metrics.open_critical_incidents} ok={metrics.open_critical_incidents === 0} warn={metrics.open_critical_incidents > 0} />
                <MetricRow label="Backup (Tage)" value={metrics.last_backup_days} ok={metrics.backup_ok} warn={!metrics.backup_ok} />
                <MetricRow label="Unklassif. Dokumente" value={metrics.unclassified_documents} ok={metrics.unclassified_documents === 0} warn={metrics.unclassified_documents > 20} />
              </div>
            </div>

            {/* ── KI-SCORE BALKEN (kompakt) ── */}
            <div className="surface p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-3 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />Alle Scores im Überblick
              </p>
              <div className="space-y-2">
                {Object.entries(scores).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-36 capitalize">{key.replace(/_/g, ' ')}</span>
                    <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                      <div className={cn('h-1.5 rounded-full transition-all', val >= 85 ? 'bg-emerald-500' : val >= 70 ? 'bg-amber-500' : 'bg-rose-500')}
                        style={{ width: `${val}%` }} />
                    </div>
                    <span className={cn('text-xs font-bold w-7 text-right', scoreColor(val))}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── KI-VERBESSERUNGEN ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-violet-600" />
              KI-Verbesserungsvorschläge
              {activeImprovements.length > 0 && (
                <span className="bg-violet-100 text-violet-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{activeImprovements.length}</span>
              )}
            </p>
            <Button size="sm" variant="outline" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}
              className="gap-1.5 h-7 text-xs">
              {generateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Neue Vorschläge
            </Button>
          </div>

          {activeImprovements.length === 0 ? (
            <div className="surface p-8 text-center">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
              <p className="text-sm text-muted-foreground">Keine offenen Verbesserungsvorschläge</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeImprovements.slice(0, 10).map(imp => (
                <ImprovementCard key={imp.id} imp={imp}
                  onApprove={() => approveMutation.mutate(imp)}
                  onReject={() => rejectMutation.mutate(imp.id)}
                />
              ))}
              {activeImprovements.length > 10 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  + {activeImprovements.length - 10} weitere Vorschläge
                </p>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}