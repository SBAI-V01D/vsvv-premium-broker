/**
 * AdminEnterpriseControlCenter — Enterprise Governance Hub
 * Admin-only. 7 Tabs: Integrity · Audit · Exports · Performance · Security · Reviews · Compliance
 */
import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Shield, AlertTriangle, CheckCircle2 } from 'lucide-react';
import TabIntegrity   from '@/components/admin/enterprise/TabIntegrity';
import TabAudit       from '@/components/admin/enterprise/TabAudit';
import TabExports     from '@/components/admin/enterprise/TabExports';
import TabPerformance from '@/components/admin/enterprise/TabPerformance';
import TabSecurity    from '@/components/admin/enterprise/TabSecurity';
import TabReviews     from '@/components/admin/enterprise/TabReviews';
import TabCompliance  from '@/components/admin/enterprise/TabCompliance';
import TabModules     from '@/components/admin/enterprise/TabModules';
import TabValidation  from '@/components/admin/enterprise/TabValidation';
import TabIncidents   from '@/components/admin/enterprise/TabIncidents';
import TabSystemCheck from '@/components/admin/enterprise/TabSystemCheck';
import TabSystemExcellence from '@/components/admin/enterprise/TabSystemExcellence';

const TABS = [
  { id: 'modules',     label: 'Alle Module', component: TabModules },
  { id: 'integrity',   label: 'Integrity',   component: TabIntegrity },
  { id: 'audit',       label: 'Audit',       component: TabAudit },
  { id: 'exports',     label: 'Exports',     component: TabExports },
  { id: 'performance', label: 'Performance', component: TabPerformance },
  { id: 'security',    label: 'Security',    component: TabSecurity },
  { id: 'reviews',     label: 'Reviews',     component: TabReviews },
  { id: 'compliance',  label: 'Compliance',  component: TabCompliance },
  { id: 'validation',  label: '▶ Live-Validation', component: TabValidation },
  { id: 'incidents',   label: '🚨 Incidents',       component: TabIncidents },
  { id: 'systemcheck', label: '✓ System Check',     component: TabSystemCheck },
  { id: 'excellence',  label: '★ Excellence Report', component: TabSystemExcellence },
];

export default function AdminEnterpriseControlCenter() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('modules');

  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <AlertTriangle className="w-10 h-10 text-amber-500" />
        <p className="text-sm font-semibold text-foreground">Zugriff verweigert — Admin erforderlich</p>
      </div>
    );
  }

  const ActiveComponent = TABS.find(t => t.id === activeTab)?.component ?? TabIntegrity;

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
           <p className="text-xs text-muted-foreground">Governance · Compliance · Audit · Security · Performance</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-full">
           <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
           Enterprise Live System
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-border bg-card shrink-0">
        <div className="flex gap-0 overflow-x-auto scrollbar-none">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <ActiveComponent />
      </div>
    </div>
  );
}