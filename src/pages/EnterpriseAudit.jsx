/**
 * EnterpriseAudit — Systematische Enterprise-Prüfung
 * 
 * Führt automatisierte Audits durch für:
 * 1. Performance (Query-Zeiten, Memory)
 * 2. Relationship Integrity (Household, Verträge, Mandate)
 * 3. AI Finding Qualität (Truth Layer, Korrektheit)
 * 4. Query Governance (N+1, Caching)
 * 
 * MIT MANUELLEN CHECKLISTEN FÜR:
 * - Design-Konsistenz
 * - Mobile Reality
 * - Workflow-Reibung
 */

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, CheckCircle2, AlertTriangle, XCircle, 
  Loader2, RefreshCw, FileText, TrendingUp, Shield,
  Zap, Users, Brain, Database, Smartphone, GitPullRequest
} from 'lucide-react';
import { cn } from '@/lib/utils';

const SECTION_ICONS = {
  performance: Activity,
  relationship_integrity: Users,
  ai_quality: Brain,
  query_governance: Database,
  design_consistency: FileText,
  mobile_reality: Smartphone,
  workflow_friction: GitPullRequest,
};

const STATUS_COLORS = {
  measured: 'bg-blue-50 text-blue-700 border-blue-200',
  audited: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  manual_check_required: 'bg-amber-50 text-amber-700 border-amber-200',
  pending: 'bg-slate-50 text-slate-600 border-slate-200',
  CRITICAL: 'bg-rose-50 text-rose-700 border-rose-200',
  WARNING: 'bg-amber-50 text-amber-700 border-amber-200',
  PASS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function EnterpriseAudit() {
  const [auditResult, setAuditResult] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});

  const runAuditMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('runEnterpriseAudit', {});
      return res.data;
    },
    onSuccess: (data) => {
      setAuditResult(data);
    },
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const renderSection = (key, data) => {
    const Icon = SECTION_ICONS[key] || Activity;
    const statusColor = STATUS_COLORS[data.status] || STATUS_COLORS.pending;

    return (
      <Card key={key} className="border-[hsl(var(--border-subtle))]/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', statusColor)}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-[hsl(var(--text-heading))]">
                  {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </CardTitle>
                <p className="text-[10px] text-[hsl(var(--text-muted))] capitalize">{data.status.replace(/_/g, ' ')}</p>
              </div>
            </div>
            <Badge className={statusColor}>{data.status}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {data.metrics && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
              {Object.entries(data.metrics).map(([metric, value]) => (
                <div key={metric} className="bg-[hsl(var(--surface-1))] rounded-lg p-2">
                  <p className="text-[9px] text-[hsl(var(--text-subtle))] uppercase truncate">{metric.replace(/_/g, ' ')}</p>
                  <p className="text-sm font-bold text-[hsl(var(--text-heading))] mt-0.5">
                    {typeof value === 'number' && value > 100 ? value.toLocaleString() : value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {data.issues && data.issues.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--text-muted))]">Issues ({data.issues.length})</p>
              {data.issues.map((issue, i) => (
                <div key={i} className={cn(
                  'rounded-lg border p-2 text-xs',
                  issue.severity === 'critical' ? 'bg-rose-50 border-rose-200' :
                  issue.severity === 'warning' ? 'bg-amber-50 border-amber-200' :
                  'bg-blue-50 border-blue-200'
                )}>
                  <div className="flex items-center gap-1.5 mb-1">
                    {issue.severity === 'critical' ? <XCircle className="w-3 h-3 text-rose-600" /> :
                     issue.severity === 'warning' ? <AlertTriangle className="w-3 h-3 text-amber-600" /> :
                     <CheckCircle2 className="w-3 h-3 text-blue-600" />}
                    <span className={cn(
                      'font-semibold',
                      issue.severity === 'critical' ? 'text-rose-700' :
                      issue.severity === 'warning' ? 'text-amber-700' :
                      'text-blue-700'
                    )}>{issue.issue}</span>
                  </div>
                  <p className="text-[10px] text-slate-600 ml-4.5">
                    Actual: {issue.actual} · Expected: {issue.expected}
                  </p>
                  <p className="text-[10px] text-slate-500 ml-4.5 mt-0.5">
                    {issue.recommendation}
                  </p>
                </div>
              ))}
            </div>
          )}

          {data.checklist && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--text-muted))]">Checklist</p>
              {Object.entries(data.checklist).map(([item, status]) => (
                <div key={item} className="flex items-center gap-2 text-xs">
                  {status === 'pending' ? (
                    <div className="w-4 h-4 rounded border border-slate-300" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  )}
                  <span className="text-[hsl(var(--text-body))]">{item.replace(/_/g, ' ')}</span>
                  <Badge className={STATUS_COLORS[status]}>{status}</Badge>
                </div>
              ))}
            </div>
          )}

          {data.recommendation && (
            <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-[10px] text-blue-700">{data.recommendation}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-full bg-[hsl(var(--surface-1))]">
      {/* Header */}
      <div className="bg-white border-b border-[hsl(var(--border-subtle))]/60 px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-sm">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[hsl(var(--text-heading))]">Enterprise Audit</h1>
              <p className="text-xs text-[hsl(var(--text-muted))]">Systematische Qualitätsprüfung</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Run Audit Button */}
          <div className="flex items-center gap-4">
            <Button
              onClick={() => runAuditMutation.mutate()}
              disabled={runAuditMutation.isPending}
              className="h-11 px-8 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700"
            >
              {runAuditMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Audit läuft...</>
              ) : (
                <><RefreshCw className="w-4 h-4 mr-2" />Audit durchführen</>
              )}
            </Button>
            {auditResult && (
              <div className="flex items-center gap-2">
                <Badge className={STATUS_COLORS[auditResult.summary.overall_status]}>
                  {auditResult.summary.overall_status}
                </Badge>
                <span className="text-xs text-[hsl(var(--text-muted))]">
                  {auditResult.summary.total_audit_time_ms}ms · {auditResult.summary.critical_issues_count} critical · {auditResult.summary.warnings_count} warnings
                </span>
              </div>
            )}
          </div>

          {/* Critical Issues */}
          {auditResult && auditResult.critical_issues.length > 0 && (
            <Card className="border-rose-200 bg-rose-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-rose-700 flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Kritische Issues ({auditResult.critical_issues.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {auditResult.critical_issues.map((issue, i) => (
                    <li key={i} className="text-sm text-rose-700 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      {issue}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Audit Results */}
          {auditResult && (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-[hsl(var(--border-subtle))]/40 p-4">
                  <p className="text-[9px] text-[hsl(var(--text-subtle))] uppercase">Audit Duration</p>
                  <p className="text-2xl font-bold text-[hsl(var(--text-heading))] mt-1">
                    {auditResult.summary.total_audit_time_ms}ms
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-[hsl(var(--border-subtle))]/40 p-4">
                  <p className="text-[9px] text-[hsl(var(--text-subtle))] uppercase">Critical Issues</p>
                  <p className={cn('text-2xl font-bold mt-1', auditResult.summary.critical_issues_count > 0 ? 'text-rose-700' : 'text-emerald-700')}>
                    {auditResult.summary.critical_issues_count}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-[hsl(var(--border-subtle))]/40 p-4">
                  <p className="text-[9px] text-[hsl(var(--text-subtle))] uppercase">Warnings</p>
                  <p className={cn('text-2xl font-bold mt-1', auditResult.summary.warnings_count > 0 ? 'text-amber-700' : 'text-emerald-700')}>
                    {auditResult.summary.warnings_count}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-[hsl(var(--border-subtle))]/40 p-4">
                  <p className="text-[9px] text-[hsl(var(--text-subtle))] uppercase">Sections</p>
                  <p className="text-2xl font-bold text-[hsl(var(--text-heading))] mt-1">
                    {auditResult.summary.sections_audited_automatically} auto · {auditResult.summary.sections_requiring_manual_check} manual
                  </p>
                </div>
              </div>

              {/* Sections */}
              <div className="grid gap-4">
                {Object.entries(auditResult.sections).map(([key, data]) => renderSection(key, data))}
              </div>

              {/* Nächste Schritte - Überprüfbar */}
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold text-blue-800 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Nächste Schritte - Überprüfbar
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Automatisierte Issues */}
                    {auditResult.critical_issues.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700 mb-1.5">
                          1. Kritische Issues beheben (sofort)
                        </p>
                        <ul className="space-y-1 ml-2">
                          {auditResult.critical_issues.map((issue, i) => (
                            <li key={i} className="text-xs text-rose-700 flex items-start gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1 flex-shrink-0" />
                              {issue}
                            </li>
                          ))}
                        </ul>
                        <p className="text-[9px] text-rose-600 mt-1.5 ml-2">
                          ✓ Überprüfbar: Audit erneut durchführen → Issues sollten verschwunden sein
                        </p>
                      </div>
                    )}

                    {/* Warnings */}
                    {auditResult.warnings && auditResult.warnings.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 mb-1.5">
                          2. Warnings prüfen (innert 7 Tagen)
                        </p>
                        <ul className="space-y-1 ml-2">
                          {auditResult.warnings.slice(0, 5).map((w, i) => (
                            <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1 flex-shrink-0" />
                              {w}
                            </li>
                          ))}
                        </ul>
                        <p className="text-[9px] text-amber-600 mt-1.5 ml-2">
                          ✓ Überprüfbar: Weekly Audit → Trend sollte sinken
                        </p>
                      </div>
                    )}

                    {/* Manuelle Checklisten */}
                    {auditResult.sections.design_consistency?.checklist && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 mb-1.5">
                          3. Design-Checkliste (manuell - diese Woche)
                        </p>
                        <div className="space-y-1 ml-2">
                          {Object.entries(auditResult.sections.design_consistency.checklist).map(([item, status]) => (
                            <div key={item} className="flex items-center gap-2 text-xs">
                              {status === 'pending' ? (
                                <div className="w-3.5 h-3.5 rounded border border-blue-300" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                              )}
                              <span className="text-blue-800">{item.replace(/_/g, ' ')}</span>
                              <Badge className={STATUS_COLORS[status]}>{status}</Badge>
                            </div>
                          ))}
                        </div>
                        <p className="text-[9px] text-blue-600 mt-1.5 ml-2">
                          ✓ Überprüfbar: Checklist durchgehen → Status ändert sich auf "audited"
                        </p>
                      </div>
                    )}

                    {auditResult.sections.mobile_reality?.checklist && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 mb-1.5">
                          4. Mobile Reality Test (manuell - diese Woche)
                        </p>
                        <div className="space-y-1 ml-2">
                          {Object.entries(auditResult.sections.mobile_reality.checklist).map(([item, status]) => (
                            <div key={item} className="flex items-center gap-2 text-xs">
                              {status === 'pending' ? (
                                <div className="w-3.5 h-3.5 rounded border border-blue-300" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                              )}
                              <span className="text-blue-800">{item.replace(/_/g, ' ')}</span>
                              <Badge className={STATUS_COLORS[status]}>{status}</Badge>
                            </div>
                          ))}
                        </div>
                        <p className="text-[9px] text-blue-600 mt-1.5 ml-2">
                          ✓ Überprüfbar: Mobile testen → Checklist abhaken
                        </p>
                      </div>
                    )}

                    {auditResult.sections.workflow_friction?.checklist && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 mb-1.5">
                          5. Workflow-Observation (manuell - laufend)
                        </p>
                        <div className="space-y-1 ml-2">
                          {Object.entries(auditResult.sections.workflow_friction.checklist).map(([item, status]) => (
                            <div key={item} className="flex items-center gap-2 text-xs">
                              {status === 'pending' ? (
                                <div className="w-3.5 h-3.5 rounded border border-blue-300" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                              )}
                              <span className="text-blue-800">{item.replace(/_/g, ' ')}</span>
                              <Badge className={STATUS_COLORS[status]}>{status}</Badge>
                            </div>
                          ))}
                        </div>
                        <p className="text-[9px] text-blue-600 mt-1.5 ml-2">
                          ✓ Überprüfbar: Broker beobachten → Pain points dokumentieren
                        </p>
                      </div>
                    )}

                    {/* Zusammenfassung */}
                    <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
                      <p className="text-[10px] font-bold text-blue-800 mb-1">Überprüfbarkeit zusammengefasst:</p>
                      <ul className="space-y-1 text-[10px] text-blue-700">
                        <li className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-blue-600 mt-0.5 flex-shrink-0" />
                          <span><strong>Automatisiert:</strong> Issues werden rot/amber/grün angezeigt · Audit zeigt Fortschritt</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-blue-600 mt-0.5 flex-shrink-0" />
                          <span><strong>Manuell:</strong> Checklisten mit Status (pending → audited) · Direkte Rückmeldung</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-blue-600 mt-0.5 flex-shrink-0" />
                          <span><strong>Metriken:</strong> Query-Zeiten, Critical Counts, Truth Layer % · Alles messbar</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Empty State */}
          {!auditResult && !runAuditMutation.isPending && (
            <div className="bg-white rounded-xl border border-[hsl(var(--border-subtle))]/40 p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-50 to-blue-50 border border-violet-100 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-7 h-7 text-violet-400" />
              </div>
              <h3 className="text-base font-bold text-[hsl(var(--text-heading))] mb-2">Enterprise Audit</h3>
              <p className="text-sm text-[hsl(var(--text-muted))] max-w-md mx-auto leading-relaxed">
                Starten Sie ein systematisches Audit für Performance, Relationship Integrity, AI-Qualität und Query Governance.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}