/**
 * EnterpriseSystemCheck — Vollständiger Enterprise System Check UI
 * 10 Prüfungsbereiche · Tiefenanalyse · Dokumentierte Ergebnisse
 */

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield, Activity, Brain, Zap, Layout, Smartphone, Lock,
  CheckCircle2, AlertTriangle, XCircle, Loader2, RefreshCw,
  TrendingUp, AlertCircle, FileText, Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import BrokerOpsCleanupPanel from '@/components/admin/BrokerOpsCleanupPanel';

const CATEGORY_ICONS = {
  technical_quality: Activity,
  performance: Zap,
  data_integrity: Target,
  ai_intelligence: Brain,
  ux_consistency: Layout,
  broker_operations: TrendingUp,
  mobile_readiness: Smartphone,
  governance_security: Shield,
};

const CATEGORY_LABELS = {
  technical_quality: 'Technische Qualität',
  performance: 'Performance',
  data_integrity: 'Datenintegrität',
  ai_intelligence: 'KI / Intelligence',
  ux_consistency: 'UX / Design',
  broker_operations: 'Broker-Logik',
  mobile_readiness: 'Mobile',
  governance_security: 'Governance',
};

const STATUS_COLORS = {
  pass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  critical: 'bg-rose-50 text-rose-700 border-rose-200',
  fail: 'bg-rose-50 text-rose-700 border-rose-200',
};

const STATUS_ICONS = {
  pass: CheckCircle2,
  warning: AlertTriangle,
  critical: XCircle,
  fail: XCircle,
};

export default function EnterpriseSystemCheck() {
  const [report, setReport] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('overview');

  const runCheckMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('enterpriseSystemCheck', {});
      return res.data;
    },
    onSuccess: (data) => {
      setReport(data);
      toast.success('Enterprise System Check abgeschlossen', {
        duration: 3000,
        icon: '✓',
      });
    },
    onError: (error) => {
      toast.error('System Check fehlgeschlagen: ' + error.message, {
        duration: 4000,
        icon: '✗',
      });
    },
  });

  if (!report && !runCheckMutation.isPending) {
    return (
      <div className="min-h-screen bg-[hsl(var(--surface-1))] p-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[hsl(var(--text-heading))] mb-3">
              Enterprise System Check
            </h1>
            <p className="text-sm text-[hsl(var(--text-muted))] max-w-lg mx-auto mb-8">
              Vollständiger, tiefgehender Systemcheck der Broker Operating Platform.
              <br />
              10 Prüfungsbereiche · Keine autonomen Änderungen · Nur Analyse &amp; Dokumentation
            </p>
            <Button
              onClick={() => runCheckMutation.mutate()}
              className="h-12 px-8 text-base font-semibold bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700"
            >
              <Shield className="w-5 h-5 mr-2" />
              System Check starten
            </Button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            <InfoCard
              title="Technische Qualität"
              desc="Re-Render, Memory, Queries"
              icon={Activity}
            />
            <InfoCard
              title="Performance"
              desc="Ladezeiten, Pipeline, Cache"
              icon={Zap}
            />
            <InfoCard
              title="Datenintegrität"
              desc="Truth Layer, Relationships"
              icon={Target}
            />
            <InfoCard
              title="Governance"
              desc="Security, Audit, Compliance"
              icon={Shield}
            />
          </div>
        </div>
      </div>
    );
  }

  if (runCheckMutation.isPending) {
    return (
      <div className="min-h-screen bg-[hsl(var(--surface-1))] p-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center py-20">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-violet-600" />
            <h2 className="text-xl font-bold text-[hsl(var(--text-heading))] mb-2">
              Enterprise System Check läuft...
            </h2>
            <p className="text-sm text-[hsl(var(--text-muted))]">
              Analysiere {report?.summary?.total_checks || 'alle'} Prüfungsbereiche
            </p>
          </div>
        </div>
      </div>
    );
  }

  const scores = report.scores || {};
  const avgScore = parseFloat(report.summary.average_score);

  return (
    <div className="min-h-screen bg-[hsl(var(--surface-1))] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-sm">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[hsl(var(--text-heading))]">Enterprise System Check</h1>
              <p className="text-xs text-[hsl(var(--text-muted))]">
                {new Date(report.timestamp).toLocaleString('de-CH')} · {report.summary.duration_ms}ms
              </p>
            </div>
          </div>
          <Button
            onClick={() => runCheckMutation.mutate()}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={cn('w-4 h-4', runCheckMutation.isPending && 'animate-spin')} />
            Erneut prüfen
          </Button>
        </div>

        {/* Executive Summary */}
        <Card className="mb-8 border-l-4 border-l-[hsl(var(--primary))]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <FileText className="w-4 h-4 text-violet-600" />
              Executive Summary
            </CardTitle>
            <CardDescription className="text-xs">
              {report.executive_summary?.platform_status}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <ScoreCard
                label="Gesamt-Score"
                value={avgScore}
                max={100}
                color={avgScore >= 90 ? 'text-emerald-600' : avgScore >= 70 ? 'text-amber-600' : 'text-rose-600'}
              />
              <ScoreCard
                label="Bestanden"
                value={report.summary.passed}
                total={report.summary.total_checks}
                color="text-emerald-600"
              />
              <ScoreCard
                label="Kritisch"
                value={report.summary.critical}
                color="text-rose-600"
              />
              <ScoreCard
                label="Warnungen"
                value={report.summary.warnings}
                color="text-amber-600"
              />
            </div>

            {report.executive_summary?.top_critical_issues?.length > 0 && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg">
                <p className="text-xs font-semibold text-rose-700 mb-2 flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  Kritische Probleme ({report.executive_summary.top_critical_issues.length})
                </p>
                <ul className="space-y-1">
                  {report.executive_summary.top_critical_issues.slice(0, 3).map((issue, i) => (
                    <li key={i} className="text-xs text-rose-800">• {issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="grid w-full grid-cols-5 gap-2 mb-6">
            <TabsTrigger value="overview" className="text-xs font-semibold h-10">
              <Activity className="w-3.5 h-3.5 mr-1.5" />
              Übersicht
            </TabsTrigger>
            {Object.keys(CATEGORY_LABELS).map(cat => (
              <TabsTrigger key={cat} value={cat} className="text-xs font-semibold h-10">
                {React.createElement(CATEGORY_ICONS[cat], { className: 'w-3.5 h-3.5 mr-1.5' })}
                {CATEGORY_LABELS[cat]}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="mt-0">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(scores).map(([cat, score]) => {
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

            {/* Critical Issues */}
            {report.critical_issues?.length > 0 && (
              <Card className="mt-6 border-rose-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold text-rose-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Kritische Probleme ({report.critical_issues.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {report.critical_issues.slice(0, 10).map((issue, i) => (
                      <div key={i} className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                        <p className="text-xs font-semibold text-rose-700 mb-1">{issue.name}</p>
                        <p className="text-xs text-rose-600">{issue.impact}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recommendations */}
            {report.recommendations?.length > 0 && (
              <Card className="mt-6 border-violet-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold text-violet-700 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Empfehlungen ({report.recommendations.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {report.recommendations.slice(0, 10).map((rec, i) => (
                      <div key={i} className="p-3 bg-violet-50 border border-violet-200 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-semibold text-violet-700">{rec.name}</p>
                          <Badge className={rec.priority === 'high' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}>
                            {rec.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-violet-600">{rec.recommendation}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* CATEGORY DETAILS */}
          {Object.keys(CATEGORY_LABELS).map(cat => (
            <TabsContent key={cat} value={cat} className="mt-0">
              <div className="space-y-6">
                <CategoryDetail category={cat} report={report} />
                {cat === 'broker_operations' && (
                  <div className="border-t border-border pt-6">
                    <BrokerOpsCleanupPanel />
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}

function InfoCard({ title, desc, icon: Icon }) {
  return (
    <Card className="border hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <Icon className="w-5 h-5 text-[hsl(var(--primary))] mb-2" />
        <p className="text-xs font-semibold text-[hsl(var(--text-heading))] mb-1">{title}</p>
        <p className="text-xs text-[hsl(var(--text-muted))]">{desc}</p>
      </CardContent>
    </Card>
  );
}

function ScoreCard({ label, value, total, max, color }) {
  return (
    <div>
      <p className="text-[10px] text-[hsl(var(--text-muted))] uppercase mb-1">{label}</p>
      <p className={cn('text-2xl font-bold', color)}>
        {value}{total !== undefined ? ` / ${total}` : max !== undefined ? ` / ${max}` : ''}
      </p>
    </div>
  );
}

function CategoryDetail({ category, report }) {
  const categoryData = report.categories?.[category];
  const checks = report.checks?.filter(c => c.category === category) || [];
  const Icon = CATEGORY_ICONS[category];

  if (!categoryData) {
    return <div className="text-center py-10 text-sm text-[hsl(var(--text-muted))]">Keine Daten verfügbar</div>;
  }

  return (
    <div className="space-y-4">
      {/* Score */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Icon className="w-4 h-4 text-[hsl(var(--primary))]" />
            {CATEGORY_LABELS[category]}
          </CardTitle>
          <CardDescription className="text-xs">
            Score: {categoryData.score} / 100
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className={cn(
                'h-2 rounded-full transition-all',
                categoryData.score >= 90 ? 'bg-emerald-600' : categoryData.score >= 70 ? 'bg-amber-600' : 'bg-rose-600'
              )}
              style={{ width: `${categoryData.score}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Checks */}
      {checks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold">Prüfungen ({checks.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {checks.map((check, i) => {
                const StatusIcon = STATUS_ICONS[check.status];
                return (
                  <div key={i} className={cn('p-3 rounded-lg border', STATUS_COLORS[check.status])}>
                    <div className="flex items-center gap-2 mb-1">
                      <StatusIcon className="w-3.5 h-3.5" />
                      <p className="text-xs font-semibold">{check.name}</p>
                    </div>
                    {check.findings?.length > 0 && (
                      <p className="text-xs opacity-80 mb-1">
                        {check.findings.length} Befund{check.findings.length > 1 ? 'e' : ''}
                      </p>
                    )}
                    {check.impact && (
                      <p className="text-xs opacity-70">{check.impact}</p>
                    )}
                    {check.recommendation && (
                      <p className="text-xs mt-2 pt-2 border-t border-current/20 font-semibold">
                        → {check.recommendation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}