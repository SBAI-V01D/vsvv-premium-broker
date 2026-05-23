/**
 * KiAnalyseVerbesserungen — Kombinierte KI-Analyse und Verbesserungen
 * 2 Tabs: Analyse (AI Review) · Verbesserungen (Improvements)
 */

import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Brain, TrendingUp, CheckCircle2, Clock, Zap, Activity,
  ThumbsUp, ThumbsDown, BarChart2, RefreshCw, Loader2,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// ── Review Config ───────────────────────────────────────────────────────────
const REVIEW_LEVELS = [
  { id: 'quick',       label: 'Quick Review',      duration: '~30 Sek.', icon: Zap,   desc: 'Kein Berater · Mandate · Renewals · Tasks', activeBg: 'bg-blue-600 text-white border-blue-600', passiveBg: 'bg-blue-50 border-blue-200' },
  { id: 'operational', label: 'Operational Review', duration: '~2 Min.',  icon: Activity, desc: 'Workflows · Cross-Selling · Stornos', activeBg: 'bg-violet-600 text-white border-violet-600', passiveBg: 'bg-violet-50 border-violet-200' },
  { id: 'enterprise',  label: 'Enterprise Review',  duration: '~5 Min.',  icon: Brain, desc: 'Vollanalyse · Governance · System', activeBg: 'bg-slate-800 text-white border-slate-800', passiveBg: 'bg-slate-50 border-slate-200' },
];

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
  relationship_integrity: CheckCircle2,
  ai_quality: Brain,
  query_governance: BarChart2,
  design: Zap,
  workflow: TrendingUp,
};

// ── Main Page ───────────────────────────────────────────────────────────────
export default function KiAnalyseVerbesserungen() {
  const [activeTab, setActiveTab] = useState('analyse');
  const [selectedLevel, setSelectedLevel] = useState('quick');
  const [selectedImprovement, setSelectedImprovement] = useState(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Analyse
  const [reviewResult, setReviewResult] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  // Verbesserungen
  const { data: improvements = [], refetch: refetchImprovements } = useQuery({
    queryKey: ['enterprise_improvements'],
    queryFn: async () => await base44.entities.EnterpriseImprovement.list('-proposed_at', 50),
  });

  // Review starten
  const runReview = async () => {
    setReviewLoading(true);
    try {
      const res = await base44.functions.invoke('aiSystemReview', { level: selectedLevel });
      setReviewResult(res.data);
    } catch (e) {
      console.error('Review failed:', e);
    }
    setReviewLoading(false);
  };

  // Verbesserungen generieren
  const generateMutation = useMutation({
    mutationFn: async (auditResult) => {
      const res = await base44.functions.invoke('generateEnterpriseImprovements', { audit_result: auditResult });
      return res.data;
    },
    onSuccess: () => {
      refetchImprovements();
    },
  });

  // Approve/Reject/Implement
  const approveMutation = useMutation({
    mutationFn: async (improvementId) => {
      const user = await base44.auth.me();
      return await base44.entities.EnterpriseImprovement.update(improvementId, {
        status: 'approved',
        approved_by: user.full_name || user.email,
        approved_at: new Date().toISOString(),
      });
    },
    onSuccess: () => refetchImprovements(),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ improvementId, reason }) => {
      return await base44.entities.EnterpriseImprovement.update(improvementId, {
        status: 'rejected',
        rejection_reason: reason,
      });
    },
    onSuccess: () => {
      refetchImprovements();
      setShowRejectDialog(false);
      setRejectionReason('');
    },
  });

  const implementMutation = useMutation({
    mutationFn: async (improvementId) => {
      return await base44.entities.EnterpriseImprovement.update(improvementId, {
        status: 'implemented',
        implemented_at: new Date().toISOString(),
      });
    },
    onSuccess: () => refetchImprovements(),
  });

  const stats = {
    total: improvements.length,
    proposed: improvements.filter(i => i.status === 'proposed').length,
    approved: improvements.filter(i => i.status === 'approved').length,
    implemented: improvements.filter(i => i.status === 'implemented').length,
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
              <h1 className="text-lg font-bold text-[hsl(var(--text-heading))]">KI Analyse & Verbesserungen</h1>
              <p className="text-xs text-[hsl(var(--text-muted))]">Probleme erkennen · Lösungen umsetzen · Impact messen</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 py-4 border-b border-[hsl(var(--border-subtle))]/40 bg-white/50">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="analyse" className="text-sm font-semibold">
              <Brain className="w-4 h-4 mr-2" />
              Analyse
            </TabsTrigger>
            <TabsTrigger value="verbesserungen" className="text-sm font-semibold">
              <TrendingUp className="w-4 h-4 mr-2" />
              Verbesserungen
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: ANALYSE */}
          <TabsContent value="analyse" className="mt-6">
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Level Selection */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {REVIEW_LEVELS.map(lv => {
                  const Icon = lv.icon;
                  const active = selectedLevel === lv.id;
                  return (
                    <button key={lv.id} onClick={() => setSelectedLevel(lv.id)}
                      className={cn('text-left p-4 rounded-xl border-2 transition-all', active ? lv.activeBg : `${lv.passiveBg} hover:shadow-sm`)}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <Icon className={cn('w-4 h-4', active ? 'text-white' : 'text-slate-500')} />
                        <span className={cn('text-sm font-bold', active ? 'text-white' : 'text-slate-800')}>{lv.label}</span>
                        <span className={cn('text-[10px] ml-auto', active ? 'text-white/70' : 'text-slate-400')}>{lv.duration}</span>
                      </div>
                      <p className={cn('text-[11px] leading-relaxed', active ? 'text-white/80' : 'text-slate-500')}>{lv.desc}</p>
                    </button>
                  );
                })}
              </div>

              {/* Start Button */}
              <div className="flex items-center gap-4">
                <Button onClick={runReview} disabled={reviewLoading}
                  className="h-11 px-8 text-sm font-semibold bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700"
                >
                  {reviewLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyse läuft…</>
                  ) : (
                    <><Brain className="w-4 h-4 mr-2" />Review starten</>
                  )}
                </Button>
                {reviewResult && (
                  <button onClick={runReview} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
                    <RefreshCw className="w-3.5 h-3.5" /> Erneut prüfen
                  </button>
                )}
              </div>

              {/* Results */}
              {reviewResult && !reviewLoading && (
                <div className="space-y-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-6">
                    <h3 className="text-sm font-bold text-slate-800 mb-2">Analyse abgeschlossen</h3>
                    <p className="text-xs text-slate-600">
                      {reviewResult.findings?.length || 0} Findings gefunden · {new Date(reviewResult.reviewed_at).toLocaleString('de-CH')}
                    </p>
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                      {reviewResult.findings?.filter(f => f.severity === 'critical').length > 0 && (
                        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                          <p className="text-2xl font-bold text-rose-700">{reviewResult.findings.filter(f => f.severity === 'critical').length}</p>
                          <p className="text-[11px] text-rose-600">Kritisch</p>
                        </div>
                      )}
                      {reviewResult.findings?.filter(f => f.severity === 'warning').length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="text-2xl font-bold text-amber-700">{reviewResult.findings.filter(f => f.severity === 'warning').length}</p>
                          <p className="text-[11px] text-amber-600">Warnungen</p>
                        </div>
                      )}
                      {reviewResult.findings?.filter(f => f.severity === 'opportunity').length > 0 && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                          <p className="text-2xl font-bold text-emerald-700">{reviewResult.findings.filter(f => f.severity === 'opportunity').length}</p>
                          <p className="text-[11px] text-emerald-600">Potenziale</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Generate Improvements Button */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Brain className="w-4 h-4 text-violet-600" />
                        KI-Verbesserungen generieren
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Basierend auf dieser Analyse
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        onClick={() => generateMutation.mutate({ findings: reviewResult.findings })}
                        disabled={generateMutation.isPending}
                        className="h-10 px-6 bg-gradient-to-r from-violet-600 to-blue-600"
                      >
                        {generateMutation.isPending ? (
                          <><Clock className="w-4 h-4 mr-2 animate-spin" />Generiere...</>
                        ) : (
                          <><Zap className="w-4 h-4 mr-2" />Verbesserungen generieren</>
                        )}
                      </Button>
                      {generateMutation.isSuccess && (
                        <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {generateMutation.data.total_count} Vorschläge generiert → Im Tab "Verbesserungen" verfügbar
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Empty State */}
              {!reviewResult && !reviewLoading && (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-50 to-blue-50 border border-violet-100 flex items-center justify-center mx-auto mb-4">
                    <Brain className="w-7 h-7 text-violet-400" />
                  </div>
                  <h3 className="text-base font-bold text-slate-700 mb-2">KI-Analyse starten</h3>
                  <p className="text-sm text-slate-400 max-w-md mx-auto">
                    Wählen Sie ein Review-Level und starten Sie die Analyse. Die KI erkennt Probleme und Potenziale.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 2: VERBESSERUNGEN */}
          <TabsContent value="verbesserungen" className="mt-6">
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatCard label="Total" value={stats.total} color="text-slate-700" bg="bg-slate-50" />
                <StatCard label="Vorgeschlagen" value={stats.proposed} color="text-blue-700" bg="bg-blue-50" />
                <StatCard label="Genehmigt" value={stats.approved} color="text-emerald-700" bg="bg-emerald-50" />
                <StatCard label="Implementiert" value={stats.implemented} color="text-emerald-700" bg="bg-emerald-50" />
                <StatCard label="Kritisch" value={stats.critical} color="text-rose-700" bg="bg-rose-50" />
              </div>

              {/* Generate Button */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Brain className="w-4 h-4 text-violet-600" />
                    KI-Verbesserungsvorschläge generieren
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Basierend auf dem letzten Enterprise Audit
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => generateMutation.mutate({})}
                    disabled={generateMutation.isPending}
                    className="h-10 px-6 bg-gradient-to-r from-violet-600 to-blue-600"
                  >
                    {generateMutation.isPending ? (
                      <><Clock className="w-4 h-4 mr-2 animate-spin" />KI analysiert...</>
                    ) : (
                      <><Zap className="w-4 h-4 mr-2" />Vorschläge generieren</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Improvements List */}
              {improvements.length > 0 ? (
                <div className="space-y-3">
                  <h2 className="text-sm font-bold">Verbesserungsvorschläge ({improvements.length})</h2>
                  {improvements.map((imp) => (
                    <ImprovementCard
                      key={imp.id}
                      improvement={imp}
                      onApprove={() => approveMutation.mutate(imp.id)}
                      onReject={() => { setSelectedImprovement(imp); setShowRejectDialog(true); }}
                      onImplement={() => implementMutation.mutate(imp.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl border p-10 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-50 to-blue-50 flex items-center justify-center mx-auto mb-4">
                    <TrendingUp className="w-7 h-7 text-violet-400" />
                  </div>
                  <h3 className="text-base font-bold mb-2">Keine Verbesserungsvorschläge</h3>
                  <p className="text-sm text-slate-400 mb-4">Generieren Sie Vorschläge basierend auf einem Audit.</p>
                  <Button onClick={() => generateMutation.mutate({})} className="h-10 px-6 bg-gradient-to-r from-violet-600 to-blue-600">
                    <Zap className="w-4 h-4 mr-2" /> Vorschläge generieren
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vorschlag ablehnen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">Warum möchten Sie diesen Vorschlag ablehnen?</p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Ablehnungsgrund..."
              className="w-full min-h-[100px] p-3 text-sm border rounded-lg"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Abbrechen</Button>
              <Button variant="destructive" onClick={() => rejectMutation.mutate({ improvementId: selectedImprovement?.id, reason: rejectionReason })} disabled={!rejectionReason.trim()}>
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

function ImprovementCard({ improvement, onApprove, onReject, onImplement }) {
  const [expanded, setExpanded] = useState(false);
  const AreaIcon = AREA_ICONS[improvement.area] || Activity;

  const statusLabels = {
    proposed: 'Vorgeschlagen', approved: 'Genehmigt', in_progress: 'In Arbeit',
    implemented: 'Implementiert', verified: 'Verifiziert', rejected: 'Abgelehnt',
  };

  return (
    <Card className={cn('border hover:shadow-sm', improvement.priority === 'critical' ? 'border-rose-200' : 'border-[hsl(var(--border-subtle))]/40')}>
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
              <CardTitle className="text-sm font-bold">{improvement.title}</CardTitle>
              <p className="text-[10px] text-[hsl(var(--text-muted))] mt-0.5">
                {improvement.area} · {new Date(improvement.proposed_at).toLocaleDateString('de-CH')}
              </p>
            </div>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="text-[hsl(var(--text-muted))]">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
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

          <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg">
            <p className="text-[9px] font-semibold uppercase text-violet-600 mb-1 flex items-center gap-1">
              <Brain className="w-3 h-3" /> KI Recommendation
            </p>
            <p className="text-xs text-violet-800">{improvement.ki_recommendation}</p>
          </div>

          {improvement.implementation_steps && (
            <div>
              <p className="text-[9px] font-semibold uppercase text-[hsl(var(--text-muted))] mb-2">Implementation Steps</p>
              <ol className="space-y-1">
                {improvement.implementation_steps.map((step, i) => (
                  <li key={i} className="text-xs flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t">
            {improvement.status === 'proposed' && (
              <>
                <Button size="sm" onClick={onApprove} className="bg-emerald-600">
                  <ThumbsUp className="w-3.5 h-3.5 mr-1.5" /> Genehmigen
                </Button>
                <Button size="sm" variant="outline" onClick={onReject} className="text-rose-600 border-rose-200">
                  <ThumbsDown className="w-3.5 h-3.5 mr-1.5" /> Ablehnen
                </Button>
              </>
            )}
            {improvement.status === 'approved' && (
              <Button size="sm" onClick={onImplement} className="bg-violet-600">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Als implementiert markieren
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}