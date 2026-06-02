/**
 * KI Analyse & Verbesserungen — Intelligenz & Optimierungsmodul
 * 
 * Nutzt ausschliesslich die zentrale Analyse-Engine.
 * Analysiert das gesamte CRM systemweit.
 * Lernfähig: speichert Admin-Entscheidungen für bessere Folge-Empfehlungen.
 */
import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import toast from 'react-hot-toast';
import {
  Brain, TrendingUp, CheckCircle2, Clock, Zap, Activity,
  ThumbsUp, ThumbsDown, BarChart2, Loader2, ChevronDown, ChevronUp,
  Archive, Inbox, Target, Sparkles, RefreshCw, AlertTriangle,
  Users, FileText, Settings, Workflow, Database
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CentralAnalysisProvider, useCentralAnalysis, getScoreColor, getScoreBg } from '@/lib/CentralAnalysisContext';
import AnalysisLauncher from '@/components/analysis/AnalysisLauncher';

const PRIORITY_COLORS = {
  critical: 'bg-rose-50 text-rose-700 border-rose-200',
  high:     'bg-orange-50 text-orange-700 border-orange-200',
  medium:   'bg-blue-50 text-blue-700 border-blue-200',
  low:      'bg-slate-50 text-slate-600 border-slate-200',
};

const STATUS_COLORS = {
  proposed:    'bg-blue-50 text-blue-700 border-blue-200',
  approved:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  in_progress: 'bg-violet-50 text-violet-700 border-violet-200',
  implemented: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  verified:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected:    'bg-rose-50 text-rose-700 border-rose-200',
};

const STATUS_LABELS = {
  proposed: 'Vorgeschlagen', approved: 'Genehmigt', in_progress: 'In Arbeit',
  implemented: 'Implementiert', verified: 'Verifiziert', rejected: 'Abgelehnt',
};

const AREA_ICONS = {
  performance: Activity, relationship_integrity: CheckCircle2, ai_quality: Brain,
  query_governance: BarChart2, design: Zap, workflow: TrendingUp,
  data_quality: Database, customer_management: Users, document_management: FileText,
  automation: Settings,
};

const ARCHIVED_STATUSES = ['verified', 'rejected'];

// CRM-Bereiche für systemweite Analyse
const CRM_DOMAINS = [
  { id: 'customers', label: 'Kundenverwaltung', icon: Users },
  { id: 'contracts', label: 'Vertragsverwaltung', icon: FileText },
  { id: 'processes', label: 'Prozesse & Workflows', icon: Workflow },
  { id: 'automation', label: 'Automationen', icon: Settings },
  { id: 'data_quality', label: 'Datenqualität', icon: Database },
  { id: 'ai_quality', label: 'KI-Qualität', icon: Brain },
];

function ImprovementCard({ improvement, onApprove, onReject, onImplement, onVerify }) {
  const [expanded, setExpanded] = useState(false);
  const AreaIcon = AREA_ICONS[improvement.area] || Activity;
  const isArchived = ARCHIVED_STATUSES.includes(improvement.status);

  return (
    <div className={cn('surface-sm border transition-all', improvement.priority === 'critical' ? 'border-rose-200' : '')}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', PRIORITY_COLORS[improvement.priority])}>
            <AreaIcon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge className={cn('text-[10px]', PRIORITY_COLORS[improvement.priority])}>{improvement.priority}</Badge>
              <Badge className={cn('text-[10px]', STATUS_COLORS[improvement.status])}>{STATUS_LABELS[improvement.status]}</Badge>
              {improvement.estimated_impact?.effort_level && (
                <Badge className="badge-neutral text-[10px]">{improvement.estimated_impact.effort_level} Aufwand</Badge>
              )}
            </div>
            <p className="text-sm font-semibold">{improvement.title}</p>
            <p className="text-[10px] text-muted-foreground">{improvement.area} · {improvement.proposed_at ? new Date(improvement.proposed_at).toLocaleDateString('de-CH') : ''}</p>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground flex-shrink-0">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {expanded && (
          <div className="mt-4 space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                <p className="text-[9px] font-semibold uppercase text-rose-600 mb-1">Ist-Zustand</p>
                <p className="text-xs text-rose-800">{improvement.current_state}</p>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-[9px] font-semibold uppercase text-emerald-600 mb-1">Ziel-Zustand</p>
                <p className="text-xs text-emerald-800">{improvement.target_state}</p>
              </div>
            </div>

            {improvement.ki_recommendation && (
              <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg">
                <p className="text-[9px] font-semibold uppercase text-violet-600 mb-1 flex items-center gap-1"><Brain className="w-3 h-3" />KI-Empfehlung</p>
                <p className="text-xs text-violet-800">{improvement.ki_recommendation}</p>
              </div>
            )}

            {improvement.implementation_steps?.length > 0 && (
              <div>
                <p className="text-[9px] font-semibold uppercase text-muted-foreground mb-2">Umsetzungsschritte</p>
                <ol className="space-y-1">
                  {improvement.implementation_steps.map((step, i) => (
                    <li key={i} className="text-xs flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold flex items-center justify-center flex-shrink-0">{i+1}</span>
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
                    <Button size="sm" onClick={onApprove} className="bg-emerald-600 gap-1.5">
                      <ThumbsUp className="w-3.5 h-3.5" />
                      {['performance', 'design', 'ai_quality'].includes(improvement.area) ? 'Genehmigen & Umsetzen' : 'Genehmigen'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={onReject} className="text-rose-600 border-rose-200 gap-1.5">
                      <ThumbsDown className="w-3.5 h-3.5" />Ablehnen
                    </Button>
                  </>
                )}
                {improvement.status === 'approved' && (
                  <Button size="sm" onClick={onImplement} className="bg-violet-600 gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />Als implementiert markieren
                  </Button>
                )}
                {improvement.status === 'implemented' && (
                  <Button size="sm" onClick={onVerify} className="bg-emerald-600 gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />Verifizieren
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function KiAnalyseContent() {
  const { analysisData, loading: engineLoading } = useCentralAnalysis();
  const [activeTab, setActiveTab] = useState('analyse');
  const [selectedImprovement, setSelectedImprovement] = useState(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [improvementsTab, setImprovementsTab] = useState('active');
  const [selectedLevel, setSelectedLevel] = useState('enterprise');

  const [reviewResult, setReviewResult] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  const { data: improvements = [], refetch: refetchImprovements } = useQuery({
    queryKey: ['enterprise_improvements'],
    queryFn: async () => base44.entities.EnterpriseImprovement.list('-proposed_at', 200),
  });

  const activeImprovements = improvements.filter(i => !ARCHIVED_STATUSES.includes(i.status));
  const archivedImprovements = improvements.filter(i => ARCHIVED_STATUSES.includes(i.status));
  const tabSource = improvementsTab === 'active' ? activeImprovements : archivedImprovements;

  // Systemweite KI-Analyse basierend auf zentralen Daten
  const runReview = async () => {
    setReviewLoading(true);
    try {
      const res = await base44.functions.invoke('aiSystemReview', { level: selectedLevel });
      setReviewResult(res.data);
    } catch (e) {
      toast.error('Review fehlgeschlagen: ' + e.message);
    }
    setReviewLoading(false);
  };

  const generateMutation = useMutation({
    mutationFn: async (auditResult) => {
      const res = await base44.functions.invoke('generateEnterpriseImprovements', { audit_result: auditResult });
      return res.data;
    },
    onSuccess: (data) => {
      refetchImprovements();
      toast.success(`${data.total_count || 0} Verbesserungen generiert`, { icon: '✅' });
    },
  });

  const learnMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('learnAndGenerateImprovements', { mode: 'all', limit: 5 });
      return res.data;
    },
    onSuccess: (data) => {
      refetchImprovements();
      toast.success(`${data.new_improvements?.length || 0} neue Vorschläge aus ${data.analysis_summary?.total_learned_from || 0} Erfolgen gelernt`, { icon: '🧠', duration: 5000 });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (imp) => {
      const me = await base44.auth.me();
      await base44.entities.EnterpriseImprovement.update(imp.id, { status: 'approved', approved_by: me?.email, approved_at: new Date().toISOString() });
      if (['performance', 'design', 'ai_quality'].includes(imp.area)) {
        await base44.entities.EnterpriseImprovement.update(imp.id, { status: 'implemented', implemented_at: new Date().toISOString() });
        return { autoImplemented: true };
      }
      return { autoImplemented: false };
    },
    onSuccess: (data) => {
      refetchImprovements();
      toast.success(data.autoImplemented ? 'Automatisch umgesetzt!' : 'Genehmigt — bereit zur Umsetzung', { icon: '✅' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }) => base44.entities.EnterpriseImprovement.update(id, { status: 'rejected', rejection_reason: reason }),
    onSuccess: () => { refetchImprovements(); setShowRejectDialog(false); setRejectionReason(''); toast.success('Abgelehnt — KI lernt aus dieser Entscheidung', { icon: '📚' }); },
  });

  const implementMutation = useMutation({
    mutationFn: async (id) => base44.entities.EnterpriseImprovement.update(id, { status: 'implemented', implemented_at: new Date().toISOString() }),
    onSuccess: () => refetchImprovements(),
  });

  const verifyMutation = useMutation({
    mutationFn: async (id) => base44.entities.EnterpriseImprovement.update(id, { status: 'verified', verified_at: new Date().toISOString() }),
    onSuccess: () => { refetchImprovements(); toast.success('Verifiziert!', { icon: '✅' }); },
  });

  const stats = {
    proposed: improvements.filter(i => i.status === 'proposed').length,
    approved: improvements.filter(i => i.status === 'approved').length,
    implemented: improvements.filter(i => i.status === 'implemented').length,
    verified: improvements.filter(i => i.status === 'verified').length,
    rejected: improvements.filter(i => i.status === 'rejected').length,
    critical: improvements.filter(i => i.priority === 'critical').length,
  };

  const successRate = (stats.verified + stats.rejected) > 0
    ? Math.round(stats.verified / (stats.verified + stats.rejected) * 100) : null;

  return (
    <div className="min-h-full bg-[hsl(var(--surface-1))]">
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-sm">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[hsl(var(--text-heading))]">KI Analyse & Verbesserungen</h1>
            <p className="text-xs text-muted-foreground">Systemweite CRM-Analyse · Lernfähige KI · One-Click Improvements</p>
          </div>
          {successRate !== null && (
            <div className="ml-auto text-xs text-muted-foreground">
              KI-Trefferquote: <span className={cn('font-bold', successRate >= 60 ? 'text-emerald-600' : 'text-amber-600')}>{successRate}%</span>
            </div>
          )}
        </div>
        <AnalysisLauncher compact />
      </div>

      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="analyse" className="gap-2"><Brain className="w-4 h-4" />CRM Analyse</TabsTrigger>
            <TabsTrigger value="verbesserungen" className="gap-2">
              <TrendingUp className="w-4 h-4" />Verbesserungen
              {stats.proposed > 0 && <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{stats.proposed}</span>}
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-2"><BarChart2 className="w-4 h-4" />CRM Insights</TabsTrigger>
          </TabsList>

          {/* TAB 1: CRM ANALYSE */}
          <TabsContent value="analyse" className="space-y-5">
            {/* Zentraler Score als Basis */}
            {analysisData && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(analysisData.scores).filter(([k]) => k !== 'overall').slice(0, 7).map(([key, val]) => (
                  <div key={key} className={cn('rounded-xl border p-3', getScoreBg(val))}>
                    <p className="text-[10px] text-muted-foreground capitalize mb-1">{key.replace(/_/g, ' ')}</p>
                    <p className={cn('text-2xl font-bold', getScoreColor(val))}>{val}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Review Level */}
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Analyse-Tiefe</p>
              <div className="grid md:grid-cols-3 gap-2">
                {[
                  { id: 'quick', label: 'Quick Review', dur: '~30 Sek.', desc: 'Mandate · Renewals · Tasks · Leads' },
                  { id: 'operational', label: 'Operational', dur: '~2 Min.', desc: 'Workflows · Cross-Selling · Stornos' },
                  { id: 'enterprise', label: 'Enterprise (Vollanalyse)', dur: '~5 Min.', desc: 'Gesamte CRM-Architektur · Governance · Systemreife' },
                ].map(lv => (
                  <button key={lv.id} onClick={() => setSelectedLevel(lv.id)}
                    className={cn('text-left p-3 rounded-xl border-2 transition-all',
                      selectedLevel === lv.id ? 'bg-primary text-white border-primary' : 'bg-white border-slate-200 hover:border-primary/50'
                    )}>
                    <div className="flex justify-between items-center mb-1">
                      <span className={cn('text-sm font-bold', selectedLevel === lv.id ? 'text-white' : '')}>{lv.label}</span>
                      <span className={cn('text-[10px]', selectedLevel === lv.id ? 'text-white/70' : 'text-slate-400')}>{lv.dur}</span>
                    </div>
                    <p className={cn('text-[11px]', selectedLevel === lv.id ? 'text-white/80' : 'text-slate-500')}>{lv.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 flex-wrap">
              <Button onClick={runReview} disabled={reviewLoading} className="bg-gradient-to-r from-violet-600 to-blue-600 gap-2">
                {reviewLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Analysiert...</> : <><Brain className="w-4 h-4" />KI-Analyse starten</>}
              </Button>
              {reviewResult && (
                <Button variant="outline" onClick={runReview} className="gap-1.5 text-xs">
                  <RefreshCw className="w-3.5 h-3.5" />Erneut
                </Button>
              )}
            </div>

            {reviewResult && (
              <div className="space-y-4">
                <div className="surface p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold">Analyse abgeschlossen</h3>
                    <p className="text-xs text-muted-foreground">{new Date(reviewResult.reviewed_at).toLocaleString('de-CH')}</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Kritisch', count: reviewResult.findings?.filter(f => f.severity === 'critical').length || 0, color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
                      { label: 'Warnungen', count: reviewResult.findings?.filter(f => f.severity === 'warning').length || 0, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Potenziale', count: reviewResult.findings?.filter(f => f.severity === 'opportunity').length || 0, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
                      { label: 'Total', count: reviewResult.findings?.length || 0, color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
                    ].map(s => (
                      <div key={s.label} className={cn('rounded-lg border p-3', s.bg)}>
                        <p className={cn('text-2xl font-bold', s.color)}>{s.count}</p>
                        <p className="text-[11px] text-muted-foreground">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={() => generateMutation.mutate({ findings: reviewResult.findings })}
                  disabled={generateMutation.isPending}
                  className="bg-gradient-to-r from-violet-600 to-blue-600 gap-2"
                >
                  {generateMutation.isPending ? <><Clock className="w-4 h-4 animate-spin" />Generiere...</> : <><Zap className="w-4 h-4" />Verbesserungen generieren</>}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* TAB 2: VERBESSERUNGEN */}
          <TabsContent value="verbesserungen" className="space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {[
                { label: 'Vorgeschlagen', value: stats.proposed, color: 'text-blue-700', bg: 'bg-blue-50' },
                { label: 'Genehmigt', value: stats.approved, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                { label: 'Implementiert', value: stats.implemented, color: 'text-violet-700', bg: 'bg-violet-50' },
                { label: 'Verifiziert', value: stats.verified, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                { label: 'Abgelehnt', value: stats.rejected, color: 'text-slate-600', bg: 'bg-slate-100' },
                { label: 'Kritisch', value: stats.critical, color: 'text-rose-700', bg: 'bg-rose-50' },
              ].map(s => (
                <div key={s.label} className={cn('rounded-lg border p-2.5 text-center', s.bg)}>
                  <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Aktionen */}
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => generateMutation.mutate({})} disabled={generateMutation.isPending}
                className="bg-gradient-to-r from-violet-600 to-blue-600 gap-2 text-xs h-9">
                {generateMutation.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />KI analysiert...</> : <><Zap className="w-3.5 h-3.5" />Vorschläge generieren</>}
              </Button>
              <Button onClick={() => learnMutation.mutate()} disabled={learnMutation.isPending}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 gap-2 text-xs h-9">
                {learnMutation.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Lernt...</> : <><Sparkles className="w-3.5 h-3.5" />KI lernt aus Erfolgen</>}
              </Button>
            </div>

            {/* Active/Archive Toggle */}
            <div className="flex gap-1 bg-muted/40 rounded-lg p-1 w-fit">
              <button onClick={() => setImprovementsTab('active')}
                className={cn('flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors', improvementsTab === 'active' ? 'bg-card shadow text-foreground' : 'text-muted-foreground')}>
                <Inbox className="w-3.5 h-3.5" />Aktiv <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-1.5">{activeImprovements.length}</span>
              </button>
              <button onClick={() => setImprovementsTab('archived')}
                className={cn('flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors', improvementsTab === 'archived' ? 'bg-card shadow text-foreground' : 'text-muted-foreground')}>
                <Archive className="w-3.5 h-3.5" />Archiv <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-1.5">{archivedImprovements.length}</span>
              </button>
            </div>

            {tabSource.length > 0 ? (
              <div className="space-y-2">
                {tabSource.map(imp => (
                  <ImprovementCard key={imp.id} improvement={imp}
                    onApprove={() => approveMutation.mutate(imp)}
                    onReject={() => { setSelectedImprovement(imp); setShowRejectDialog(true); }}
                    onImplement={() => implementMutation.mutate(imp.id)}
                    onVerify={() => verifyMutation.mutate(imp.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="surface p-10 text-center">
                <Brain className="w-10 h-10 mx-auto mb-3 text-violet-300" />
                <p className="text-sm font-semibold mb-2">{improvementsTab === 'active' ? 'Keine aktiven Vorschläge' : 'Keine archivierten Vorschläge'}</p>
                {improvementsTab === 'active' && (
                  <Button onClick={() => generateMutation.mutate({})} className="bg-gradient-to-r from-violet-600 to-blue-600">
                    <Zap className="w-4 h-4 mr-2" />Vorschläge generieren
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          {/* TAB 3: INSIGHTS */}
          <TabsContent value="insights" className="space-y-5">
            {analysisData ? (
              <>
                <div className="surface p-4 space-y-3">
                  <h3 className="text-sm font-bold">CRM-Gesamtzustand</h3>
                  <div className="space-y-2">
                    {Object.entries(analysisData.scores).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-32 capitalize">{key.replace(/_/g, ' ')}</span>
                        <div className="flex-1 bg-slate-200 rounded-full h-2">
                          <div className={cn('h-2 rounded-full transition-all', val >= 85 ? 'bg-emerald-500' : val >= 70 ? 'bg-amber-500' : 'bg-rose-500')} style={{ width: `${val}%` }} />
                        </div>
                        <span className={cn('text-xs font-bold w-8 text-right', getScoreColor(val))}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="surface p-4 space-y-2">
                    <h3 className="text-sm font-bold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-rose-600" />Kritische Bereiche</h3>
                    {analysisData.critical_issues.length === 0 ? (
                      <p className="text-xs text-emerald-600 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />Keine kritischen Probleme</p>
                    ) : analysisData.critical_issues.map((issue, i) => (
                      <div key={i} className="p-2 bg-rose-50 border border-rose-200 rounded-lg">
                        <p className="text-xs font-semibold text-rose-800">{issue.message}</p>
                      </div>
                    ))}
                  </div>
                  <div className="surface p-4 space-y-2">
                    <h3 className="text-sm font-bold flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-violet-600" />KI-Lernstatus</h3>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Verifizierte Verbesserungen</span><span className="font-bold text-emerald-600">{stats.verified}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Abgelehnte Vorschläge</span><span className="font-bold">{stats.rejected}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Trefferquote</span><span className={cn('font-bold', successRate !== null && successRate >= 60 ? 'text-emerald-600' : 'text-amber-600')}>{successRate !== null ? `${successRate}%` : 'n/a'}</span></div>
                    </div>
                    <Button size="sm" onClick={() => learnMutation.mutate()} disabled={learnMutation.isPending}
                      className="mt-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-xs h-8 gap-1.5">
                      <Brain className="w-3 h-3" />Jetzt lernen
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="surface p-10 text-center">
                <BarChart2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Starten Sie zuerst die zentrale Analyse oben.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Vorschlag ablehnen — KI lernt daraus</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Die KI speichert die Ablehnung und passt zukünftige Empfehlungen entsprechend an.</p>
            <div>
              <Label>Ablehnungsgrund</Label>
              <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
                placeholder="Warum passt dieser Vorschlag nicht?" className="w-full mt-1 min-h-[80px] p-3 text-sm border rounded-lg" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Abbrechen</Button>
              <Button variant="destructive" onClick={() => rejectMutation.mutate({ id: selectedImprovement?.id, reason: rejectionReason })} disabled={!rejectionReason.trim()}>
                Ablehnen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function KiAnalyseVerbesserungen() {
  return (
    <CentralAnalysisProvider>
      <KiAnalyseContent />
    </CentralAnalysisProvider>
  );
}