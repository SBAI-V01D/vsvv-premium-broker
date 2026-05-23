/**
 * TabSystemExcellence — System Excellence Report
 * Zeigt detaillierten Optimierungsbericht mit Incident-Analyse
 */

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Shield, Activity, Zap, Target, Brain, Layout, Smartphone, TrendingUp,
  CheckCircle2, AlertTriangle, XCircle, Loader2, RefreshCw, AlertCircle,
  BarChart3, FileText, Layers, Users, Clock, Award
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const CATEGORY_ICONS = {
  incident_management: Shield,
  performance: Zap,
  ai_quality: Brain,
  broker_operations: TrendingUp,
  ux_consistency: Layout,
  mobile_readiness: Smartphone,
  governance: Activity,
};

const CATEGORY_LABELS = {
  incident_management: 'Incident Management',
  performance: 'Performance',
  ai_quality: 'AI / Intelligence',
  broker_operations: 'Broker Operations',
  ux_consistency: 'UX / Design',
  mobile_readiness: 'Mobile',
  governance: 'Governance',
};

export default function TabSystemExcellence() {
  const [report, setReport] = useState(null);

  const runReportMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('systemExcellenceReport', {});
      return res.data;
    },
    onSuccess: (data) => {
      setReport(data);
      toast.success('System Excellence Report generiert', { duration: 3000, icon: '✓' });
    },
    onError: (error) => {
      toast.error('Report fehlgeschlagen: ' + error.message, { duration: 4000, icon: '✗' });
    },
  });

  if (!report && !runReportMutation.isPending) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center mx-auto mb-4">
          <Award className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-base font-bold text-[hsl(var(--text-heading))] mb-2">
          System Excellence Report
        </h3>
        <p className="text-sm text-[hsl(var(--text-muted))] max-w-md mx-auto mb-6">
          Umfassende Analyse: 7 Kategorien · Kritische Incidents · Performance · AI-Qualität · Governance
        </p>
        <Button
          onClick={() => runReportMutation.mutate()}
          disabled={runReportMutation.isPending}
          className="h-11 px-6 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700"
        >
          {runReportMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyse läuft...</>
          ) : (
            <><Award className="w-4 h-4 mr-2" />Report generieren</>
          )}
        </Button>
      </div>
    );
  }

  if (runReportMutation.isPending) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-violet-600" />
        <h3 className="text-base font-bold text-[hsl(var(--text-heading))] mb-2">
          System Excellence Analyse läuft...
        </h3>
        <p className="text-sm text-[hsl(var(--text-muted))]">
          Analysiere alle Systembereiche
        </p>
      </div>
    );
  }

  const { executive_summary, category_scores, critical_incidents, recommendations } = report;

  return (
    <div className="space-y-6">
      {/* Header mit Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[hsl(var(--text-heading))]">System Excellence Report</h3>
          <p className="text-xs text-[hsl(var(--text-muted))]">
            {new Date(report.generated_at).toLocaleString('de-CH')} · {report.analysis_duration_ms}ms
          </p>
        </div>
        <Button
          onClick={() => {
            setReport(null);
            setTimeout(() => runReportMutation.mutate(), 100);
          }}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className={cn('w-4 h-4', runReportMutation.isPending && 'animate-spin')} />
          Erneut analysieren
        </Button>
      </div>

      {/* Executive Summary */}
      <Card className="border-l-4 border-l-[hsl(var(--primary))]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Award className="w-4 h-4 text-[hsl(var(--primary))]" />
            Executive Summary
          </CardTitle>
          <CardDescription className="text-xs">
            Status: {executive_summary.status}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4">
            <ScoreCard
              label="Gesamt-Score"
              value={executive_summary.overall_score}
              max={100}
              color={parseFloat(executive_summary.overall_score) >= 90 ? 'text-emerald-600' : parseFloat(executive_summary.overall_score) >= 70 ? 'text-amber-600' : 'text-rose-600'}
            />
            <ScoreCard
              label="Kritische Incidents"
              value={critical_incidents.total}
              color={critical_incidents.total > 0 ? 'text-rose-600' : 'text-emerald-600'}
            />
            <ScoreCard
              label="Platform Health"
              value={executive_summary.platform_health === 'Platform ist operativ einsetzbar' ? '✓' : '⚠'}
              color={executive_summary.platform_health === 'Platform ist operativ einsetzbar' ? 'text-emerald-600' : 'text-amber-600'}
            />
            <ScoreCard
              label="Kategorien"
              value={Object.keys(category_scores).length}
              color="text-[hsl(var(--primary))]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Category Scores */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(category_scores).map(([cat, score]) => {
          const Icon = CATEGORY_ICONS[cat];
          return (
            <Card key={cat} className="border hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-[hsl(var(--primary))]" />
                  <span className="text-xs font-semibold text-[hsl(var(--text-heading))]">
                    {CATEGORY_LABELS[cat]}
                  </span>
                </div>
                <div className="flex items-end justify-between">
                  <p className={cn(
                    'text-2xl font-bold',
                    score >= 90 ? 'text-emerald-600' : score >= 70 ? 'text-amber-600' : 'text-rose-600'
                  )}>
                    {score}
                  </p>
                  <span className="text-xs text-[hsl(var(--text-muted))]">/ 100</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Critical Incidents Analysis */}
      {critical_incidents.total > 0 && (
        <Card className="border-rose-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Kritische Incidents ({critical_incidents.total})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {critical_incidents.top_priorities.map((incident, i) => (
                <div key={incident.id} className="p-4 bg-rose-50 border border-rose-200 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs font-bold text-rose-700 mb-1">{incident.title}</p>
                      <p className="text-xs text-rose-600">{incident.root_cause}</p>
                    </div>
                    <Badge className={incident.risk_level.includes('HIGH') ? 'bg-rose-600 text-white' : 'bg-amber-100 text-amber-700'}>
                      {incident.risk_level.split(' ')[0]}
                    </Badge>
                  </div>
                  <div className="grid md:grid-cols-2 gap-2 text-xs mt-2">
                    <div>
                      <span className="font-semibold text-rose-700">Betroffene:</span>{' '}
                      {incident.affected_count || 'Multiple'} Entitäten
                    </div>
                    <div>
                      <span className="font-semibold text-rose-700">Auto-Fix:</span>{' '}
                      {incident.auto_fix_possible ? 'Ja' : 'Nein - manuell'}
                    </div>
                  </div>
                  {incident.affected_records?.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-rose-200">
                      <p className="text-[10px] font-semibold text-rose-600 mb-1">Betroffene Records:</p>
                      <ul className="space-y-0.5">
                        {incident.affected_records.slice(0, 3).map((rec, idx) => (
                          <li key={idx} className="text-[10px] text-rose-700">
                            • {rec.name || rec.id}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {recommendations && (
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-[hsl(var(--text-heading))] flex items-center gap-2">
            <Target className="w-4 h-4 text-violet-600" />
            Optimierungsempfehlungen
          </h4>
          
          {recommendations.priority_1_critical?.length > 0 && (
            <Card className="border-rose-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-bold text-rose-700">Priorität 1 — Kritisch</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {recommendations.priority_1_critical.map((rec, i) => (
                    <li key={i} className="text-xs text-rose-700 flex items-start gap-2">
                      <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {recommendations.priority_2_performance?.length > 0 && (
            <Card className="border-amber-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-bold text-amber-700">Priorität 2 — Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {recommendations.priority_2_performance.map((rec, i) => (
                    <li key={i} className="text-xs text-amber-700 flex items-start gap-2">
                      <Zap className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {recommendations.priority_3_ai_quality?.length > 0 && (
            <Card className="border-violet-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-bold text-violet-700">Priorität 3 — AI-Qualität</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {recommendations.priority_3_ai_quality.map((rec, i) => (
                    <li key={i} className="text-xs text-violet-700 flex items-start gap-2">
                      <Brain className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {recommendations.priority_4_broker_ops?.length > 0 && (
            <Card className="border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-bold text-blue-700">Priorität 4 — Broker Operations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {recommendations.priority_4_broker_ops.map((rec, i) => (
                    <li key={i} className="text-xs text-blue-700 flex items-start gap-2">
                      <TrendingUp className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Next Actions */}
      <Card className="border-[hsl(var(--border))]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <FileText className="w-4 h-4 text-[hsl(var(--primary))]" />
            Nächste Schritte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {report.next_actions.map((action, i) => (
              <li key={i} className="text-xs flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-[hsl(var(--text-body))]">{action}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function ScoreCard({ label, value, max, color }) {
  return (
    <div>
      <p className="text-[10px] text-[hsl(var(--text-muted))] uppercase mb-1">{label}</p>
      <p className={cn('text-2xl font-bold', color)}>
        {value}{max !== undefined ? ` / ${max}` : ''}
      </p>
    </div>
  );
}