/**
 * EnterpriseImprovements — KI-gestützte Verbesserungsvorschläge mit Freigabe-Workflow
 * 
 * WORKFLOW:
 * 1. Audit durchführen → Issues erkennen
 * 2. KI generiert Verbesserungsvorschläge (automatisch)
 * 3. Admin prüft und genehmigt (oder lehnt ab)
 * 4. Implementation (manuell oder automatisch)
 * 5. Impact verifizieren (Audit erneut durchführen)
 */

import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Brain, TrendingUp, CheckCircle2, XCircle, Clock, AlertTriangle,
  ChevronDown, ChevronUp, Target, Zap, Shield, Activity, Smartphone,
  ThumbsUp, ThumbsDown, FileText, BarChart2, ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const PRIORITY_COLORS = {
  critical: 'bg-rose-50 text-rose-700 border-rose-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  medium: 'bg-blue-50 text-blue-700 border-blue-200',
  low: 'bg-slate-50 text-slate-600 border-slate-200',
};

const STATUS_COLORS = {
  proposed: 'bg-blue-50 text-blue-700 border-blue-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  in_progress: 'bg-violet-50 text-violet-700 border-violet-200',
  implemented: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
};

const AREA_ICONS = {
  performance: Activity,
  relationship_integrity: Shield,
  ai_quality: Brain,
  query_governance: FileText,
  design: Zap,
  mobile: Smartphone,
  workflow: TrendingUp,
};

export default function EnterpriseImprovements() {
  const [selectedImprovement, setSelectedImprovement] = useState(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Latest Improvements laden
  const { data: improvements = [], refetch } = useQuery({
    queryKey: ['enterprise_improvements'],
    queryFn: async () => {
      return await base44.entities.EnterpriseImprovement.list('-proposed_at', 50);
    },
  });

  // Generate Improvements Mutation
  const generateMutation = useMutation({
    mutationFn: async (auditResult) => {
      const res = await base44.functions.invoke('generateEnterpriseImprovements', {
        audit_result: auditResult,
      });
      return res.data;
    },
    onSuccess: () => {
      refetch();
    },
  });

  // Approve Mutation
  const approveMutation = useMutation({
    mutationFn: async (improvementId) => {
      const user = await base44.auth.me();
      return await base44.entities.EnterpriseImprovement.update(improvementId, {
        status: 'approved',
        approved_by: user.full_name || user.email,
        approved_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      refetch();
    },
  });

  // Reject Mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ improvementId, reason }) => {
      return await base44.entities.EnterpriseImprovement.update(improvementId, {
        status: 'rejected',
        rejection_reason: reason,
      });
    },
    onSuccess: () => {
      refetch();
      setShowRejectDialog(false);
      setRejectionReason('');
    },
  });

  // Mark as Implemented Mutation
  const implementMutation = useMutation({
    mutationFn: async (improvementId) => {
      return await base44.entities.EnterpriseImprovement.update(improvementId, {
        status: 'implemented',
        implemented_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      refetch();
    },
  });

  // Verify Impact Mutation
  const verifyMutation = useMutation({
    mutationFn: async ({ improvementId, actualImpact }) => {
      const user = await base44.auth.me();
      return await base44.entities.EnterpriseImprovement.update(improvementId, {
        status: 'verified',
        verified_at: new Date().toISOString(),
        actual_impact: actualImpact,
      });
    },
    onSuccess: () => {
      refetch();
    },
  });

  const stats = {
    total: improvements.length,
    proposed: improvements.filter(i => i.status === 'proposed').length,
    approved: improvements.filter(i => i.status === 'approved').length,
    in_progress: improvements.filter(i => i.status === 'in_progress').length,
    implemented: improvements.filter(i => i.status === 'implemented').length,
    verified: improvements.filter(i => i.status === 'verified').length,
    critical: improvements.filter(i => i.priority === 'critical').length,
  };

  return (
    <div className="min-h-full bg-[hsl(var(--surface-1))]">
      {/* Header */}
      <div className="bg-white border-b border-[hsl(var(--border-subtle))]/60 px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-sm">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[hsl(var(--text-heading))]">Enterprise Improvements</h1>
              <p className="text-xs text-[hsl(var(--text-muted))]">KI-generierte Vorschläge mit Freigabe-Workflow</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <StatCard label="Total" value={stats.total} color="text-slate-700" bg="bg-slate-50" />
            <StatCard label="Vorgeschlagen" value={stats.proposed} color="text-blue-700" bg="bg-blue-50" />
            <StatCard label="Genehmigt" value={stats.approved} color="text-emerald-700" bg="bg-emerald-50" />
            <StatCard label="In Arbeit" value={stats.in_progress} color="text-violet-700" bg="bg-violet-50" />
            <StatCard label="Implementiert" value={stats.implemented} color="text-emerald-700" bg="bg-emerald-50" />
            <StatCard label="Verifiziert" value={stats.verified} color="text-emerald-700" bg="bg-emerald-50" />
            <StatCard label="Kritisch" value={stats.critical} color="text-rose-700" bg="bg-rose-50" />
          </div>

          {/* Generate Button */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-[hsl(var(--text-heading))] flex items-center gap-2">
                <Brain className="w-4 h-4 text-violet-600" />
                KI-Verbesserungsvorschläge generieren
              </CardTitle>
              <CardDescription className="text-xs text-[hsl(var(--text-muted))]">
                Basierend auf dem letzten Enterprise Audit
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => generateMutation.mutate({})}
                disabled={generateMutation.isPending}
                className="h-10 px-6 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700"
              >
                {generateMutation.isPending ? (
                  <><Clock className="w-4 h-4 mr-2 animate-spin" />KI analysiert...</>
                ) : (
                  <><Zap className="w-4 h-4 mr-2" />Vorschläge generieren</>
                )}
              </Button>
              {generateMutation.isSuccess && (
                <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {generateMutation.data.total_count} Vorschläge generiert
                </p>
              )}
            </CardContent>
          </Card>

          {/* Improvements List */}
          {improvements.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[hsl(var(--text-heading))]">
                  Verbesserungsvorschläge ({improvements.length})
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => refetch()}
                    className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                  >
                    <TrendingUp className="w-3.5 h-3.5" /> Aktualisieren
                  </button>
                </div>
              </div>

              {improvements.map((imp) => (
                <ImprovementCard
                  key={imp.id}
                  improvement={imp}
                  onApprove={() => approveMutation.mutate(imp.id)}
                  onReject={() => {
                    setSelectedImprovement(imp);
                    setShowRejectDialog(true);
                  }}
                  onImplement={() => implementMutation.mutate(imp.id)}
                  onVerify={(actualImpact) => verifyMutation.mutate({ improvementId: imp.id, actualImpact })}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {improvements.length === 0 && (
            <div className="bg-white rounded-xl border border-[hsl(var(--border-subtle))]/40 p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-50 to-blue-50 border border-violet-100 flex items-center justify-center mx-auto mb-4">
                <Brain className="w-7 h-7 text-violet-400" />
              </div>
              <h3 className="text-base font-bold text-[hsl(var(--text-heading))] mb-2">Keine Verbesserungsvorschläge</h3>
              <p className="text-sm text-[hsl(var(--text-muted))] max-w-md mx-auto leading-relaxed mb-4">
                Generieren Sie KI-basierte Verbesserungsvorschläge basierend auf Ihrem letzten Enterprise Audit.
              </p>
              <Button
                onClick={() => generateMutation.mutate({})}
                disabled={generateMutation.isPending}
                className="h-10 px-6 bg-gradient-to-r from-violet-600 to-blue-600"
              >
                <Zap className="w-4 h-4 mr-2" /> Vorschläge generieren
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vorschlag ablehnen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-[hsl(var(--text-body))]">
              Warum möchten Sie diesen Vorschlag ablehnen?
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Ablehnungsgrund..."
              className="w-full min-h-[100px] p-3 text-sm border border-[hsl(var(--border))] rounded-lg"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                Abbrechen
              </Button>
              <Button
                variant="destructive"
                onClick={() => rejectMutation.mutate({ improvementId: selectedImprovement?.id, reason: rejectionReason })}
                disabled={!rejectionReason.trim()}
              >
                Ablehnen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, color, bg }) {
  return (
    <div className={cn('rounded-lg border p-3', bg)}>
      <p className="text-[10px] text-[hsl(var(--text-subtle))] uppercase">{label}</p>
      <p className={cn('text-2xl font-bold mt-1', color)}>{value}</p>
    </div>
  );
}

function ImprovementCard({ improvement, onApprove, onReject, onImplement, onVerify }) {
  const [expanded, setExpanded] = useState(false);
  const AreaIcon = AREA_ICONS[improvement.area] || Activity;

  const statusLabels = {
    proposed: 'Vorgeschlagen',
    approved: 'Genehmigt',
    in_progress: 'In Arbeit',
    implemented: 'Implementiert',
    verified: 'Verifiziert',
    rejected: 'Abgelehnt',
  };

  return (
    <Card className={cn(
      'border transition-shadow hover:shadow-sm',
      improvement.priority === 'critical' ? 'border-rose-200' : 'border-[hsl(var(--border-subtle))]/40'
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-1">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', PRIORITY_COLORS[improvement.priority])}>
              <AreaIcon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge className={PRIORITY_COLORS[improvement.priority]}>{improvement.priority}</Badge>
                <Badge className={STATUS_COLORS[improvement.status]}>{statusLabels[improvement.status]}</Badge>
              </div>
              <CardTitle className="text-sm font-bold text-[hsl(var(--text-heading))]">
                {improvement.title}
              </CardTitle>
              <p className="text-[10px] text-[hsl(var(--text-muted))] mt-0.5">
                {improvement.area} · Vorgeschlagen {new Date(improvement.proposed_at).toLocaleDateString('de-CH')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-heading))]"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {/* Current vs Target */}
          <div className="grid md:grid-cols-2 gap-3">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
              <p className="text-[9px] font-semibold uppercase text-rose-600 mb-1">Current State</p>
              <p className="text-xs text-rose-800">{improvement.current_state}</p>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-[9px] font-semibold uppercase text-emerald-600 mb-1">Target State</p>
              <p className="text-xs text-emerald-800">{improvement.target_state}</p>
            </div>
          </div>

          {/* KI Recommendation */}
          <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg">
            <p className="text-[9px] font-semibold uppercase text-violet-600 mb-1 flex items-center gap-1">
              <Brain className="w-3 h-3" /> KI Recommendation
            </p>
            <p className="text-xs text-violet-800">{improvement.ki_recommendation}</p>
          </div>

          {/* Implementation Steps */}
          <div>
            <p className="text-[9px] font-semibold uppercase text-[hsl(var(--text-muted))] mb-2">Implementation Steps</p>
            <ol className="space-y-1">
              {improvement.implementation_steps.map((step, i) => (
                <li key={i} className="text-xs text-[hsl(var(--text-body))] flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* Impact */}
          {improvement.estimated_impact && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-[9px] font-semibold uppercase text-blue-600 mb-2 flex items-center gap-1">
                <BarChart2 className="w-3 h-3" /> Estimated Impact
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[9px] text-blue-600">Performance:</span>
                  <span className="ml-1 font-semibold text-blue-800">+{improvement.estimated_impact.performance_improvement_percent}%</span>
                </div>
                <div>
                  <span className="text-[9px] text-blue-600">Effort:</span>
                  <span className="ml-1 font-semibold text-blue-800">{improvement.estimated_impact.effort_level} ({improvement.estimated_impact.estimated_hours}h)</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[9px] text-blue-600">UX:</span>
                  <span className="ml-1 text-blue-800">{improvement.estimated_impact.ux_improvement}</span>
                </div>
              </div>
            </div>
          )}

          {/* Success Metrics */}
          {improvement.success_metrics && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-[9px] font-semibold uppercase text-emerald-600 mb-2 flex items-center gap-1">
                <Target className="w-3 h-3" /> Success Metrics
              </p>
              <div className="text-xs text-emerald-800 space-y-1">
                <p><strong>Metric:</strong> {improvement.success_metrics.metric}</p>
                <p><strong>Before:</strong> {improvement.success_metrics.before_ms}ms → <strong>Target:</strong> {improvement.success_metrics.target_ms}ms</p>
                <p className="text-[9px] text-emerald-600"><strong>Measurement:</strong> {improvement.success_metrics.how_to_measure}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-[hsl(var(--border-subtle))]">
            {improvement.status === 'proposed' && (
              <>
                <Button size="sm" onClick={onApprove} className="bg-emerald-600 hover:bg-emerald-700">
                  <ThumbsUp className="w-3.5 h-3.5 mr-1.5" /> Genehmigen
                </Button>
                <Button size="sm" variant="outline" onClick={onReject} className="text-rose-600 border-rose-200 hover:bg-rose-50">
                  <ThumbsDown className="w-3.5 h-3.5 mr-1.5" /> Ablehnen
                </Button>
              </>
            )}
            {improvement.status === 'approved' && (
              <Button size="sm" onClick={onImplement} className="bg-violet-600 hover:bg-violet-700">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Als implementiert markieren
              </Button>
            )}
            {improvement.status === 'implemented' && (
              <Button size="sm" onClick={() => onVerify({
                performance_improvement_actual_percent: improvement.estimated_impact?.performance_improvement_percent || 0,
                measured_at: new Date().toISOString(),
                verified_by: 'System',
              })} className="bg-blue-600 hover:bg-blue-700">
                <Activity className="w-3.5 h-3.5 mr-1.5" /> Impact verifizieren
              </Button>
            )}
            {improvement.status === 'verified' && (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Verifiziert
              </Badge>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}