/**
 * AdminEnterpriseControlCenter — Enterprise Governance Hub
 * 
 * Konsolidiert: 14 Tabs → 6 Bereiche
 * Performance: React.lazy() + Suspense für alle Tab-Komponenten
 * 
 * Struktur:
 *  ◈ Governance Score  — Executive view, täglicher Snapshot
 *  🚨 Incidents        — Operativ kritisch, SLA-Management
 *  ⚕ System Health     — Integrity + Validation + System Check
 *  🧠 AI Quality       — AI Explainability + Reviews
 *  🔒 Audit & Security — Audit + Compliance + Security
 *  ⚙ System            — Performance + Exports + Modules + Excellence (DevOps)
 */
import { lazy, Suspense } from 'react';
import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Shield, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Lazy-loaded tab components — only bundle/load when tab is first opened
const TabGovernanceScore = lazy(() => import('@/components/admin/enterprise/TabGovernanceScore'));
const TabGovernanceRules = lazy(() => import('@/components/admin/enterprise/TabGovernanceRules'));
const TabIncidents       = lazy(() => import('@/components/admin/enterprise/TabIncidents'));
const TabSystemHealth    = lazy(() => import('@/components/admin/enterprise/TabSystemHealth'));
const TabAiQuality       = lazy(() => import('@/components/admin/enterprise/TabAiQuality'));
const TabAuditSecurity   = lazy(() => import('@/components/admin/enterprise/TabAuditSecurity'));
const TabSystemAdmin     = lazy(() => import('@/components/admin/enterprise/TabSystemAdmin'));

const TABS = [
  { id: 'governance', label: '◈ Governance Score', component: TabGovernanceScore },
  { id: 'rules',      label: '📋 Rules',             component: TabGovernanceRules },
  { id: 'incidents',  label: '🚨 Incidents',          component: TabIncidents },
  { id: 'health',     label: '⚕ System Health',       component: TabSystemHealth },
  { id: 'ai',         label: '🧠 AI Quality',          component: TabAiQuality },
  { id: 'audit',      label: '🔒 Audit & Security',    component: TabAuditSecurity },
  { id: 'system',     label: '⚙ System',               component: TabSystemAdmin },
];

function TabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-6 bg-slate-100 rounded-lg w-48" />
        <div className="h-8 bg-slate-100 rounded-lg w-28" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-slate-100 rounded-xl" />
        ))}
      </div>
      <div className="h-48 bg-slate-100 rounded-xl" />
      <div className="h-32 bg-slate-100 rounded-xl" />
    </div>
  );
}

export default function AdminEnterpriseControlCenter() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('governance');
  // hasBeenActive: keeps tabs mounted after first visit to preserve state & React Query cache
  const [visited, setVisited] = useState(() => new Set(['governance']));

  function handleTabChange(tabId) {
    setActiveTab(tabId);
    setVisited(prev => new Set([...prev, tabId]));
  }

  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <AlertTriangle className="w-10 h-10 text-amber-500" />
        <p className="text-sm font-semibold text-foreground">Zugriff verweigert — Admin erforderlich</p>
      </div>
    );
  }

  const ActiveComponent = TABS.find(t => t.id === activeTab)?.component ?? TabGovernanceScore;

  return (
    <div className="page-enter flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[hsl(var(--primary))] tracking-tight">Enterprise Control Center</h1>
            <p className="text-xs text-muted-foreground">Governance · Compliance · Audit · Security · AI Intelligence</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Enterprise Live System
          </div>
        </div>
      </div>

      {/* Tabs — 6 konsolidierte Bereiche */}
      <div className="px-6 border-b border-border bg-card shrink-0">
        <div className="flex gap-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                'px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content — hasBeenActive: visited tabs stay mounted (hidden), no remount on switch */}
      <div className="flex-1 overflow-y-auto p-6">
        {TABS.map(tab => {
          if (!visited.has(tab.id)) return null;
          const TabComp = tab.component;
          return (
            <div key={tab.id} className={activeTab !== tab.id ? 'hidden' : ''}>
              <Suspense fallback={<TabSkeleton />}>
                <TabComp />
              </Suspense>
            </div>
          );
        })}
      </div>
    </div>
  );
}