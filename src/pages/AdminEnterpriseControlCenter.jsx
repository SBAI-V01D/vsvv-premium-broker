/**
 * Enterprise Control Center — Management & Governance Sicht
 * 
 * Nutzt ausschliesslich die zentrale Analyse-Engine.
 * Keine eigene Analyse-Logik.
 */
import { lazy, Suspense, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Shield, AlertTriangle, CheckCircle2, TrendingUp, Lock, Database, Users, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CentralAnalysisProvider, useCentralAnalysis, getScoreColor, getScoreBg, getRiskBadge, getRiskLabel } from '@/lib/CentralAnalysisContext';
import AnalysisLauncher from '@/components/analysis/AnalysisLauncher';
import { Badge } from '@/components/ui/badge';

// Lazy-loaded tab components
const TabGovernanceScore = lazy(() => import('@/components/admin/enterprise/TabGovernanceScore'));
const TabGovernanceRules = lazy(() => import('@/components/admin/enterprise/TabGovernanceRules'));
const TabIncidents       = lazy(() => import('@/components/admin/enterprise/TabIncidents'));
const TabSystemHealth    = lazy(() => import('@/components/admin/enterprise/TabSystemHealth'));
const TabAiQuality       = lazy(() => import('@/components/admin/enterprise/TabAiQuality'));
const TabAuditSecurity   = lazy(() => import('@/components/admin/enterprise/TabAuditSecurity'));
const TabSystemAdmin     = lazy(() => import('@/components/admin/enterprise/TabSystemAdmin'));

const TABS = [
  { id: 'overview',   label: '◈ Gesamtzustand' },
  { id: 'governance', label: '📋 Governance',    component: TabGovernanceScore },
  { id: 'rules',      label: '📜 Rules',          component: TabGovernanceRules },
  { id: 'incidents',  label: '🚨 Incidents',       component: TabIncidents },
  { id: 'health',     label: '⚕ System Health',    component: TabSystemHealth },
  { id: 'ai',         label: '🧠 AI Quality',       component: TabAiQuality },
  { id: 'audit',      label: '🔒 Audit & Security', component: TabAuditSecurity },
  { id: 'system',     label: '⚙ System',            component: TabSystemAdmin },
];

function TabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl" />)}
    </div>
  );
}

function OverviewTab() {
  const { analysisData } = useCentralAnalysis();
  if (!analysisData) return null;
  
  const { scores, metrics, critical_issues, warnings, risk_level } = analysisData;

  const scoreItems = [
    { label: 'Gesamt-CRM-Health', value: scores.overall, icon: TrendingUp, desc: 'Gewichteter Gesamtscore' },
    { label: 'Governance', value: scores.governance, icon: Shield, desc: 'Freigaben, Audit-Trail, Incidents' },
    { label: 'Compliance', value: scores.compliance, icon: Lock, desc: 'Tenant-Isolation, Backup, Storno' },
    { label: 'Datenqualität', value: scores.data_quality, icon: Database, desc: 'E-Mail, Berater, Haushalte' },
    { label: 'CRM-Betrieb', value: scores.crm_health, icon: Zap, desc: 'Tasks, Pipeline, Opportunities' },
    { label: 'Prozessqualität', value: scores.process_quality, icon: CheckCircle2, desc: 'Abschlussraten, Workflow' },
    { label: 'Sicherheit', value: scores.security, icon: Lock, desc: 'Rollen, Hash-Integrität' },
    { label: 'Dokumentation', value: scores.documentation, icon: Database, desc: 'Polizendokumente, PDFs' },
  ];

  return (
    <div className="space-y-6">
      {/* Scores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {scoreItems.map(s => (
          <div key={s.label} className={cn('rounded-xl border p-4', getScoreBg(s.value))}>
            <div className="flex items-center gap-1.5 mb-2">
              <s.icon className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-slate-700">{s.label}</p>
            </div>
            <p className={cn('text-3xl font-bold', getScoreColor(s.value))}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Metriken-Übersicht */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="surface p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />Kunden & Verträge</p>
          <div className="space-y-1">
            <MetricRow label="Aktive Kunden" value={metrics.active_customers} />
            <MetricRow label="Aktive Verträge" value={metrics.active_contracts} />
            <MetricRow label="E-Mail Coverage" value={`${metrics.email_coverage_pct}%`} ok={metrics.email_coverage_pct >= 80} />
            <MetricRow label="Berater-Abdeckung" value={`${metrics.advisor_coverage_pct}%`} ok={metrics.advisor_coverage_pct >= 80} />
            <MetricRow label="Renewals (90 Tage)" value={metrics.renewals_next_90_days} />
          </div>
        </div>
        <div className="surface p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" />Betrieb</p>
          <div className="space-y-1">
            <MetricRow label="Offene Tasks" value={metrics.open_tasks} />
            <MetricRow label="Überfällige Tasks" value={metrics.overdue_tasks} ok={metrics.overdue_tasks === 0} warn={metrics.overdue_tasks > 0} />
            <MetricRow label="Task-Abschluss" value={`${metrics.task_completion_pct}%`} ok={metrics.task_completion_pct >= 70} />
            <MetricRow label="Aktive Leads" value={metrics.active_leads} />
            <MetricRow label="Aktive Opportunities" value={metrics.active_opportunities} />
          </div>
        </div>
        <div className="surface p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" />Governance</p>
          <div className="space-y-1">
            <MetricRow label="Admin-Konten" value={metrics.admin_count} ok={metrics.admin_count <= 5} warn={metrics.admin_count > 5} />
            <MetricRow label="Benutzer o. Rolle" value={metrics.users_no_role} ok={metrics.users_no_role === 0} warn={metrics.users_no_role > 0} />
            <MetricRow label="Krit. Incidents" value={metrics.open_critical_incidents} ok={metrics.open_critical_incidents === 0} warn={metrics.open_critical_incidents > 0} />
            <MetricRow label="Backup (Tage alt)" value={metrics.last_backup_days} ok={metrics.backup_ok} warn={!metrics.backup_ok} />
            <MetricRow label="Dossiers o. Audit" value={metrics.dossiers_without_audit} ok={metrics.dossiers_without_audit === 0} warn={metrics.dossiers_without_audit > 0} />
          </div>
        </div>
      </div>

      {/* Critical Issues */}
      {critical_issues.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-rose-700 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" />Kritische Probleme ({critical_issues.length})</h3>
          {critical_issues.map((issue, i) => (
            <div key={i} className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
              <p className="text-xs font-semibold text-rose-800">{issue.message}</p>
              {issue.recommendation && <p className="text-xs text-rose-600 mt-0.5">→ {issue.recommendation}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-amber-700 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" />Warnungen ({warnings.length})</h3>
          {warnings.slice(0, 8).map((w, i) => (
            <div key={i} className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-semibold text-amber-800">{w.message}</p>
              {w.recommendation && <p className="text-xs text-amber-600 mt-0.5">→ {w.recommendation}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricRow({ label, value, ok, warn }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-xs font-semibold', ok ? 'text-emerald-600' : warn ? 'text-rose-600' : 'text-slate-700')}>{value}</span>
    </div>
  );
}

function EnterpriseContent() {
  const { user } = useAuth();
  const { analysisData } = useCentralAnalysis();
  const [activeTab, setActiveTab] = useState('overview');
  const [visited, setVisited] = useState(() => new Set(['overview']));

  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <AlertTriangle className="w-10 h-10 text-amber-500" />
        <p className="text-sm font-semibold">Zugriff verweigert — Admin erforderlich</p>
      </div>
    );
  }

  function handleTabChange(id) {
    setActiveTab(id);
    setVisited(prev => new Set([...prev, id]));
  }

  return (
    <div className="page-enter flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border bg-card shrink-0 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-primary tracking-tight">Enterprise Control Center</h1>
            <p className="text-xs text-muted-foreground">Management-Sicht · Governance · Compliance · Sicherheit</p>
          </div>
          {analysisData && (
            <div className="ml-auto">
              <Badge className={cn('border', getRiskBadge(analysisData.risk_level))}>
                Risiko: {getRiskLabel(analysisData.risk_level)} · {analysisData.scores.overall}/100
              </Badge>
            </div>
          )}
        </div>
        <AnalysisLauncher compact />
      </div>

      <div className="px-6 border-b border-border bg-card shrink-0">
        <div className="flex gap-0 overflow-x-auto scrollbar-none">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => handleTabChange(tab.id)}
              className={cn('px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'overview' ? (
          <OverviewTab />
        ) : (
          TABS.filter(t => t.id !== 'overview').map(tab => {
            if (!visited.has(tab.id)) return null;
            const TabComp = tab.component;
            if (!TabComp) return null;
            return (
              <div key={tab.id} className={activeTab !== tab.id ? 'hidden' : ''}>
                <Suspense fallback={<TabSkeleton />}>
                  <TabComp />
                </Suspense>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function AdminEnterpriseControlCenter() {
  return (
    <CentralAnalysisProvider>
      <EnterpriseContent />
    </CentralAnalysisProvider>
  );
}