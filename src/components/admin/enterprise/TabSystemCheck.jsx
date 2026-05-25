/**
 * TabSystemCheck — Enterprise System Check im Control Center
 * Startet Check und zeigt Ergebnisse direkt im Tab
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Shield, Activity, Zap, Target, Brain, Layout, Smartphone, TrendingUp,
  CheckCircle2, AlertTriangle, XCircle, Loader2, RefreshCw, AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

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

export default function TabSystemCheck() {
  const qc = useQueryClient();
  // Report wird im Query-Cache persistiert — überlebt Navigation
  const { data: report = null } = useQuery({
    queryKey: ['system_check_report'],
    queryFn: () => null,
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const runCheckMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('enterpriseSystemCheck', {});
      return res.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(['system_check_report'], data);
      toast.success('System Check abgeschlossen', { duration: 3000, icon: '✓' });
    },
    onError: (error) => {
      toast.error('Check fehlgeschlagen: ' + error.message, { duration: 4000, icon: '✗' });
    },
  });

  if (!report && !runCheckMutation.isPending) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-base font-bold text-[hsl(var(--text-heading))] mb-2">
          Enterprise System Check
        </h3>
        <p className="text-sm text-[hsl(var(--text-muted))] max-w-md mx-auto mb-6">
          Vollständiger Systemcheck: 8 Prüfungsbereiche · Keine autonomen Änderungen
        </p>
        <Button
          onClick={() => runCheckMutation.mutate()}
          disabled={runCheckMutation.isPending}
          className="h-11 px-6 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700"
        >
          {runCheckMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Check läuft...</>
          ) : (
            <><Shield className="w-4 h-4 mr-2" />Check starten</>
          )}
        </Button>
      </div>
    );
  }

  if (runCheckMutation.isPending) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-violet-600" />
        <h3 className="text-base font-bold text-[hsl(var(--text-heading))] mb-2">
          System Check läuft...
        </h3>
        <p className="text-sm text-[hsl(var(--text-muted))]">
          Analysiere alle Prüfungsbereiche
        </p>
      </div>
    );
  }

  const scores = report.scores || {};
  const avgScore = parseFloat(report.summary.average_score);

  return (
    <div className="space-y-6">
      {/* Header mit Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[hsl(var(--text-heading))]">Check-Ergebnis</h3>
          <p className="text-xs text-[hsl(var(--text-muted))]">
            {new Date(report.timestamp).toLocaleString('de-CH')} · {report.summary.duration_ms}ms
          </p>
        </div>
        <Button
          onClick={() => {
            qc.setQueryData(['system_check_report'], null);
            setTimeout(() => runCheckMutation.mutate(), 100);
          }}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className={cn('w-4 h-4', runCheckMutation.isPending && 'animate-spin')} />
          Erneut prüfen
        </Button>
      </div>

      {/* Executive Summary */}
      <Card className="border-l-4 border-l-[hsl(var(--primary))]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">Executive Summary</CardTitle>
          <CardDescription className="text-xs">
            Status: {report.executive_summary?.platform_status || report.summary.status}
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
        </CardContent>
      </Card>

      {/* Scores Grid */}
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
        <Card className="border-rose-200">
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
        <Card className="border-violet-200">
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

      {/* Detailed Checks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">Alle Prüfungen ({report.checks?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {report.checks?.map((check, i) => {
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
    </div>
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