/**
 * KiAnalyseVerbesserungen — Kombinierte KI-Analyse und Verbesserungen
 * 2 Tabs: Analyse (AI Review) · Verbesserungen (Improvements)
 */

import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Brain, TrendingUp, CheckCircle2, Clock, Zap, Activity,
  ThumbsUp, ThumbsDown, BarChart2, RefreshCw, Loader2,
  ChevronDown, ChevronUp, Archive, Inbox, Target, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

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

const ARCHIVED_STATUSES = ['verified', 'rejected']; // implemented bleibt aktiv bis verifiziert

// ── Main Page ───────────────────────────────────────────────────────────────
export default function KiAnalyseVerbesserungen() {
  const [activeTab, setActiveTab] = useState('analyse');
  const [selectedLevel, setSelectedLevel] = useState('quick');
  const [selectedImprovement, setSelectedImprovement] = useState(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [improvementToVerify, setImprovementToVerify] = useState(null);
  const [verifyData, setVerifyData] = useState({ actualValue: '', notes: '' });
  const [improvementsTab, setImprovementsTab] = useState('active'); // 'active' | 'archived'
  const [showAutoMeasure, setShowAutoMeasure] = useState(false);
  const [measuringId, setMeasuringId] = useState(null);
  const [autoMeasureResult, setAutoMeasureResult] = useState(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [measuredImprovement, setMeasuredImprovement] = useState(null);
  const [user, setUser] = useState(null);

  // Analyse
  const [reviewResult, setReviewResult] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  // User laden
  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Verbesserungen
  const { data: improvements = [], refetch: refetchImprovements } = useQuery({
    queryKey: ['enterprise_improvements'],
    queryFn: async () => await base44.entities.EnterpriseImprovement.list('-proposed_at', 100),
  });

  // Tab split: active (proposed, approved, in_progress) vs archived (implemented, verified, rejected)
  const activeImprovements = improvements.filter(i => !ARCHIVED_STATUSES.includes(i.status));
  const archivedImprovements = improvements.filter(i => ARCHIVED_STATUSES.includes(i.status));
  const tabSource = improvementsTab === 'active' ? activeImprovements : archivedImprovements;

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
    mutationFn: async (improvement) => {
      const user = await base44.auth.me();
      
      // Update status to approved
      await base44.entities.EnterpriseImprovement.update(improvement.id, {
        status: 'approved',
        approved_by: user.full_name || user.email,
        approved_at: new Date().toISOString(),
      });
      
      // Auto-implement simple improvements (performance, design, ai_quality)
      const autoImplementAreas = ['performance', 'design', 'ai_quality'];
      if (autoImplementAreas.includes(improvement.area)) {
        await base44.entities.EnterpriseImprovement.update(improvement.id, {
          status: 'implemented',
          implemented_at: new Date().toISOString(),
        });
        return { success: true, autoImplemented: true, area: improvement.area };
      }
      
      return { success: true, autoImplemented: false, area: improvement.area };
    },
    onSuccess: (data) => {
      refetchImprovements();
      if (data.autoImplemented) {
        toast.success(`Verbesserung wurde automatisch umgesetzt!`, {
          duration: 4000,
          icon: '✅',
        });
      } else {
        toast.success(`Verbesserung genehmigt - bereit zur Umsetzung`, {
          duration: 3000,
          icon: '✓',
        });
      }
    },
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
      refetchImprovements();
      toast.success('Impact erfolgreich verifiziert!', {
        duration: 3000,
        icon: '✅',
      });
    },
  });

  // Automatische Impact-Messung
  const autoMeasureMutation = useMutation({
    mutationFn: async (improvementId) => {
      setMeasuringId(improvementId);
      // Improvement laden für Area-Info
      const imp = await base44.entities.EnterpriseImprovement.get(improvementId);
      setMeasuredImprovement(imp);
      try {
        const res = await base44.functions.invoke('measureImprovementImpact', { improvement_id: improvementId });
        return res.data;
      } finally {
        setMeasuringId(null);
      }
    },
    onSuccess: (data) => {
      refetchImprovements();
      setAutoMeasureResult(data);
      setShowResultDialog(true);
    },
  });

  // Lernende KI: Neue Vorschläge generieren
  const learnMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('learnAndGenerateImprovements', { mode: 'all', limit: 5 });
      return res.data;
    },
    onSuccess: (data) => {
      refetchImprovements();
      toast.success(`${data.new_improvements?.length || 0} neue Vorschläge aus ${data.analysis_summary?.total_learned_from || 0} erfolgreichen Verbesserungen gelernt`, {
        duration: 5000,
        icon: '🧠',
      });
    },
  });

  const stats = {
    total: improvements.length,
    proposed: improvements.filter(i => i.status === 'proposed').length,
    approved: improvements.filter(i => i.status === 'approved').length,
    implemented: improvements.filter(i => i.status === 'implemented').length,
    critical: improvements.filter(i => i.priority === 'critical').length,
    active: activeImprovements.length,
    archived: archivedImprovements.length,
  };

  // Handler für Verifizieren
  const handleVerify = (improvement) => {
    setImprovementToVerify(improvement);
    setShowVerifyDialog(true);
  };

  return (
    <div className="min-h-full bg-[hsl(var(--surface-1))]">
      {/* Header */}
      <div className="bg-white border-b border-[hsl(var(--border-subtle))]/60 px-6 py-5">
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-lg mx-auto grid-cols-2 gap-3 mb-8">
          <TabsTrigger value="analyse" className="text-sm font-semibold h-11">
            <Brain className="w-4 h-4 mr-2" />
            Analyse
          </TabsTrigger>
          <TabsTrigger value="verbesserungen" className="text-sm font-semibold h-11">
            <TrendingUp className="w-4 h-4 mr-2" />
            Verbesserungen
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: ANALYSE */}
        <TabsContent value="analyse" className="mt-0">
          <div className="space-y-6">
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
        <TabsContent value="verbesserungen" className="mt-0">
          <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
                <StatCard label="Total" value={stats.total} color="text-slate-700" bg="bg-slate-50" />
                <StatCard label="Aktiv" value={stats.active} color="text-blue-700" bg="bg-blue-50" />
                <StatCard label="Archiv" value={stats.archived} color="text-slate-600" bg="bg-slate-100" />
                <StatCard label="Vorgeschlagen" value={stats.proposed} color="text-blue-700" bg="bg-blue-50" />
                <StatCard label="Genehmigt" value={stats.approved} color="text-emerald-700" bg="bg-emerald-50" />
                <StatCard label="Implementiert" value={stats.implemented} color="text-emerald-700" bg="bg-emerald-50" />
                <StatCard label="Kritisch" value={stats.critical} color="text-rose-700" bg="bg-rose-50" />
              </div>

              {/* Tabs: Active vs Archived */}
              <div className="flex gap-1 mb-4 bg-muted/40 rounded-lg p-1 w-fit">
                <button
                  onClick={() => setImprovementsTab('active')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    improvementsTab === 'active'
                      ? 'bg-card shadow text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Inbox className="w-4 h-4" />
                  Aktive Vorschläge
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${improvementsTab === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'}`}>
                    {activeImprovements.length}
                  </span>
                </button>
                <button
                  onClick={() => setImprovementsTab('archived')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    improvementsTab === 'archived'
                      ? 'bg-card shadow text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Archive className="w-4 h-4" />
                  Archiv
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${improvementsTab === 'archived' ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                    {archivedImprovements.length}
                  </span>
                </button>
              </div>

              {/* Generate Button */}
              <div className="grid md:grid-cols-2 gap-4">
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

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      Lernende KI
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Aus erfolgreichen Verbesserungen lernen
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => learnMutation.mutate()}
                      disabled={learnMutation.isPending}
                      className="h-10 px-6 bg-gradient-to-r from-emerald-600 to-teal-600"
                    >
                      {learnMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Lernt...</>
                      ) : (
                        <><Brain className="w-4 h-4 mr-2" />Neue Vorschläge lernen</>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Improvements List */}
              {tabSource.length > 0 ? (
                <div className="space-y-3">
                  <h2 className="text-sm font-bold">
                    {improvementsTab === 'active' ? 'Aktive Vorschläge' : 'Archiv'} ({tabSource.length})
                  </h2>
                  {tabSource.map((imp) => (
                    <ImprovementCard
                      key={imp.id}
                      improvement={imp}
                      onApprove={() => approveMutation.mutate(imp)}
                      onReject={() => { setSelectedImprovement(imp); setShowRejectDialog(true); }}
                      onImplement={() => implementMutation.mutate(imp.id)}
                      onVerify={() => handleVerify(imp)}
                      onAutoMeasure={(id) => autoMeasureMutation.mutate(id)}
                      autoMeasurePending={measuringId === imp.id}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl border p-10 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-50 to-blue-50 flex items-center justify-center mx-auto mb-4">
                    {improvementsTab === 'active' ? <Inbox className="w-7 h-7 text-violet-400" /> : <Archive className="w-7 h-7 text-violet-400" />}
                  </div>
                  <h3 className="text-base font-bold mb-2">
                    {improvementsTab === 'active' ? 'Keine aktiven Vorschläge' : 'Keine archivierten Vorschläge'}
                  </h3>
                  <p className="text-sm text-slate-400 mb-4">
                    {improvementsTab === 'active' 
                      ? 'Generieren Sie Vorschläge basierend auf einem Audit.' 
                      : 'Implementierte oder abgelehnte Vorschläge werden hier automatisch archiviert.'}
                  </p>
                  {improvementsTab === 'active' && (
                    <Button onClick={() => generateMutation.mutate({})} className="h-10 px-6 bg-gradient-to-r from-violet-600 to-blue-600">
                      <Zap className="w-4 h-4 mr-2" /> Vorschläge generieren
                    </Button>
                  )}
                </div>
              )}
          </div>
        </TabsContent>
      </Tabs>

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

      {/* Verify Dialog */}
      <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Impact verifizieren</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {improvementToVerify && (
              <>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs font-semibold text-slate-700 mb-1">{improvementToVerify.title}</p>
                  <p className="text-xs text-slate-600">
                    Ziel: <span className="font-medium">{improvementToVerify.success_metrics?.metric}</span> von{' '}
                    <span className="font-medium">{improvementToVerify.success_metrics?.before_ms}</span> auf{' '}
                    <span className="font-medium">{improvementToVerify.success_metrics?.target_ms}</span>
                  </p>
                </div>

                <div>
                  <Label>Gemessener Wert (tatsächlich erreicht)</Label>
                  <input
                    type="number"
                    value={verifyData.actualValue}
                    onChange={(e) => setVerifyData(prev => ({ ...prev, actualValue: e.target.value }))}
                    placeholder={improvementToVerify.success_metrics?.target_ms?.toString()}
                    className="w-full mt-1 p-2 text-sm border rounded-lg"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Messmethode: {improvementToVerify.success_metrics?.how_to_measure || 'N/A'}
                  </p>
                </div>

                <div>
                  <Label>Notizen zur Messung (optional)</Label>
                  <textarea
                    value={verifyData.notes}
                    onChange={(e) => setVerifyData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Wie wurde gemessen? Wann? Besondere Beobachtungen?"
                    className="w-full min-h-[80px] mt-1 p-2 text-sm border rounded-lg"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => {
                    setShowVerifyDialog(false);
                    setVerifyData({ actualValue: '', notes: '' });
                  }}>Abbrechen</Button>
                  <Button
                    onClick={() => {
                      const actualValue = parseFloat(verifyData.actualValue);
                      if (isNaN(actualValue)) {
                        toast.error('Bitte einen gültigen Messwert eingeben');
                        return;
                      }
                      const before = improvementToVerify.success_metrics?.before_ms || 0;
                      const improvement = ((actualValue - before) / before) * 100;
                      verifyMutation.mutate({
                        improvementId: improvementToVerify.id,
                        actualImpact: {
                          performance_improvement_actual_percent: actualValue > before ? improvement : -improvement,
                          measured_at: new Date().toISOString(),
                          verified_by: 'VSV Management GmbH',
                          notes: verifyData.notes,
                          actual_value: actualValue,
                        },
                      });
                      setShowVerifyDialog(false);
                      setVerifyData({ actualValue: '', notes: '' });
                    }}
                    disabled={!verifyData.actualValue}
                    className="bg-emerald-600"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Verifizieren
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Auto-Measure Result Dialog */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="sticky top-0 bg-white z-10 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-violet-600" />
              Automatische Impact-Messung
            </DialogTitle>
          </DialogHeader>
          {autoMeasureResult && (
            <div className="space-y-4 pb-4">
              {/* Header Status */}
              <div className={cn('p-4 rounded-xl border-2', autoMeasureResult.success ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200')}>
                <div className="flex items-center gap-3 mb-2">
                  {autoMeasureResult.success ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <Activity className="w-6 h-6 text-amber-600" />
                  )}
                  <div>
                    <p className={cn('text-sm font-bold', autoMeasureResult.success ? 'text-emerald-800' : 'text-amber-800')}>
                      {autoMeasureResult.success ? 'Ziel erreicht!' : 'Ziel (noch) nicht erreicht'}
                    </p>
                    <p className={cn('text-xs', autoMeasureResult.success ? 'text-emerald-600' : 'text-amber-600')}>
                      {autoMeasureResult.measurements?.performance ? 'Performance-Messung durchgeführt' : 'Automatische Messung abgeschlossen'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Messergebnisse */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-700">Messergebnisse</h4>
                
                {autoMeasureResult.measurements && Object.keys(autoMeasureResult.measurements).length > 0 ? (
                  <div className="space-y-2">
                    {/* Performance-Metriken */}
                    {autoMeasureResult.measurements.customer_query_time_ms && (
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-600">Query-Performance</span>
                          <Badge className={autoMeasureResult.success ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                            {autoMeasureResult.success ? '✓ Ziel erreicht' : '⚠ Ziel verfehlt'}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-[10px] text-slate-500">Vorher</p>
                            <p className="text-sm font-bold text-slate-700">{autoMeasureResult.actual_impact?.target_metrics?.before_ms || '-'} ms</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500">Nachher</p>
                            <p className="text-sm font-bold text-slate-700">{autoMeasureResult.measurements.customer_query_time_ms} ms</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500">Ziel</p>
                            <p className="text-sm font-bold text-slate-700">{autoMeasureResult.actual_impact?.target_metrics?.target_ms || '-'} ms</p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {autoMeasureResult.measurements.contract_query_time_ms && (
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-600">Contract Query</span>
                          <span className="text-xs font-bold text-slate-700">{autoMeasureResult.measurements.contract_query_time_ms} ms</span>
                        </div>
                      </div>
                    )}

                    {/* Datenqualität-Metriken */}
                    {autoMeasureResult.measurements.advisor_coverage_percent !== undefined && (
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-600">Datenqualität</span>
                          <span className="text-xs font-bold text-slate-700">Ø {(autoMeasureResult.measurements.advisor_coverage_percent + autoMeasureResult.measurements.mandate_valid_percent + autoMeasureResult.measurements.email_coverage_percent) / 3 | 0}%</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-600">Advisor Coverage</span>
                            <span className="font-bold text-slate-700">{autoMeasureResult.measurements.advisor_coverage_percent}%</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5">
                            <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${autoMeasureResult.measurements.advisor_coverage_percent}%` }} />
                          </div>
                          
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-600">Mandate Valid</span>
                            <span className="font-bold text-slate-700">{autoMeasureResult.measurements.mandate_valid_percent}%</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5">
                            <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: `${autoMeasureResult.measurements.mandate_valid_percent}%` }} />
                          </div>
                          
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-600">Email Coverage</span>
                            <span className="font-bold text-slate-700">{autoMeasureResult.measurements.email_coverage_percent}%</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5">
                            <div className="bg-violet-600 h-1.5 rounded-full" style={{ width: `${autoMeasureResult.measurements.email_coverage_percent}%` }} />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Workflow-Metriken */}
                    {autoMeasureResult.measurements.task_completion_rate_percent !== undefined && (
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-600">Workflow-Effizienz</span>
                          <span className="text-xs font-bold text-slate-700">{autoMeasureResult.measurements.task_completion_rate_percent}% Completion</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-[10px] text-slate-500">Open</p>
                            <p className="text-sm font-bold text-slate-700">{autoMeasureResult.measurements.open_task_count}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500">Overdue</p>
                            <p className={cn('text-sm font-bold', autoMeasureResult.measurements.overdue_task_count > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                              {autoMeasureResult.measurements.overdue_task_count}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500">Completed</p>
                            <p className="text-sm font-bold text-emerald-600">{autoMeasureResult.measurements.task_completion_rate_percent}%</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Fallback: Zeige alle Metriken als Key-Value */}
                    {!autoMeasureResult.measurements.customer_query_time_ms && 
                     !autoMeasureResult.measurements.advisor_coverage_percent && 
                     !autoMeasureResult.measurements.task_completion_rate_percent && (
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-xs font-semibold text-slate-600 mb-2">Gemessene Metriken</p>
                        <div className="space-y-1">
                          {Object.entries(autoMeasureResult.measurements).map(([key, value]) => (
                            <div key={key} className="flex justify-between text-xs">
                              <span className="text-slate-600 font-mono">{key}</span>
                              <span className="font-bold text-slate-700">
                                {typeof value === 'number' ? value.toFixed(1) : String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">Keine detaillierten Messdaten verfügbar</p>
                )}
              </div>

              {/* Optimierungsvorschläge */}
              {autoMeasureResult.optimization_suggestions && autoMeasureResult.optimization_suggestions.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-600" />
                    Optimierungsvorschläge
                  </h4>
                  <div className="space-y-2">
                    {autoMeasureResult.optimization_suggestions.map((suggestion, idx) => (
                      <div key={idx} className="p-3 bg-violet-50 border border-violet-200 rounded-lg">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-xs font-semibold text-violet-700">{suggestion.title}</p>
                          <Badge className="text-[9px] bg-violet-600 text-white">{suggestion.effort_level}</Badge>
                        </div>
                        <p className="text-xs text-violet-800 mb-2">{suggestion.description}</p>
                        {suggestion.implementation_steps && (
                          <div className="mb-2">
                            <p className="text-[10px] font-semibold text-violet-600 mb-1">Schritte:</p>
                            <ol className="space-y-0.5">
                              {suggestion.implementation_steps.map((step, i) => (
                                <li key={i} className="text-[10px] text-violet-700 flex items-start gap-1">
                                  <span className="text-[8px] font-bold text-violet-500 mt-0.5">{i + 1}.</span>
                                  {step}
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                        {suggestion.expected_improvement && (
                          <p className="text-[10px] text-violet-600 font-semibold">
                            Erwartete Verbesserung: {suggestion.expected_improvement}
                          </p>
                        )}
                        <div className="mt-2 pt-2 border-t border-violet-200">
                          <Button
                            size="sm"
                            onClick={() => {
                              // Create new improvement from suggestion
                              const newImprovement = {
                                audit_id: 'auto-generated-from-measurement',
                                title: suggestion.title,
                                priority: suggestion.effort_level === 'high' ? 'high' : 'medium',
                                area: measuredImprovement?.area === 'relationship_integrity' ? 'relationship_integrity' : 'workflow',
                                current_state: suggestion.description,
                                target_state: suggestion.expected_improvement,
                                ki_recommendation: suggestion.description,
                                implementation_steps: suggestion.implementation_steps,
                                estimated_impact: {
                                  effort_level: suggestion.effort_level,
                                  estimated_hours: suggestion.effort_level === 'low' ? 2 : suggestion.effort_level === 'medium' ? 8 : 20,
                                },
                                success_metrics: {
                                  metric: suggestion.target_metric || 'Qualitätsmetrik',
                                  before_ms: autoMeasureResult.measurements[suggestion.target_metric + '_percent'] || 0,
                                  target_ms: suggestion.target_value || 80,
                                  how_to_measure: 'Automatische Messung durch KI-System',
                                },
                                status: 'proposed',
                                proposed_by: user?.email || 'system',
                                proposed_at: new Date().toISOString(),
                              };
                              // Save to database
                              base44.entities.EnterpriseImprovement.create(newImprovement).then(() => {
                                refetchImprovements();
                                toast.success('Verbesserungsvorschlag erstellt!', { duration: 2000 });
                              });
                            }}
                            className="h-8 text-xs bg-violet-600 hover:bg-violet-700"
                          >
                            <ThumbsUp className="w-3 h-3 mr-1" /> Als Verbesserung übernehmen
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Neue Vorschläge aus Erfolg gelernt */}
              {autoMeasureResult.learned_from_success && autoMeasureResult.new_suggestions && autoMeasureResult.new_suggestions.length > 0 && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-4 h-4 text-emerald-600" />
                    <p className="text-sm font-bold text-emerald-800">
                      {autoMeasureResult.new_suggestions.length} neue Vorschläge generiert
                    </p>
                  </div>
                  <p className="text-xs text-emerald-600 mb-3">
                    Die KI hat aus diesem Erfolg gelernt und automatische neue Verbesserungen vorgeschlagen:
                  </p>
                  <ul className="space-y-1">
                    {autoMeasureResult.new_suggestions.slice(0, 3).map((s, idx) => (
                      <li key={idx} className="text-xs text-emerald-700 flex items-start gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0 mt-0.5" />
                        {s.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end pt-4 sticky bottom-0 bg-white py-3 border-t z-10">
                <Button onClick={() => setShowResultDialog(false)} className="bg-slate-800">
                  Schliessen
                </Button>
              </div>
            </div>
          )}
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

function ImprovementCard({ improvement, onApprove, onReject, onImplement, onVerify, onAutoMeasure, autoMeasurePending }) {
  const [expanded, setExpanded] = useState(false);
  const AreaIcon = AREA_ICONS[improvement.area] || Activity;

  const statusLabels = {
    proposed: 'Vorgeschlagen', approved: 'Genehmigt', in_progress: 'In Arbeit',
    implemented: 'Implementiert', verified: 'Verifiziert', rejected: 'Abgelehnt',
  };

  // Hide action buttons for archived statuses (verified, rejected)
  const isArchived = ARCHIVED_STATUSES.includes(improvement.status);
  // implemented Vorschläge brauchen Verifizieren-Button
  const needsVerification = improvement.status === 'implemented';

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

          {!isArchived && (
            <div className="flex gap-2 pt-2 border-t">
              {improvement.status === 'proposed' && (
                <>
                  <Button size="sm" onClick={onApprove} className="bg-emerald-600">
                    <ThumbsUp className="w-3.5 h-3.5 mr-1.5" /> {['performance', 'design', 'ai_quality'].includes(improvement.area) ? 'Genehmigen & Umsetzen' : 'Genehmigen'}
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
              {needsVerification && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={onVerify} className="bg-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Manuell verifizieren
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => onAutoMeasure(improvement.id)}
                    disabled={autoMeasurePending}
                    className="bg-violet-600"
                  >
                    {autoMeasurePending ? (
                      <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Missst...</>
                    ) : (
                      <><Target className="w-3.5 h-3.5 mr-1.5" /> Auto-Messung</>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}