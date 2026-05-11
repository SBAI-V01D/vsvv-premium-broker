import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertCircle, ChevronDown, ChevronUp, AlertTriangle, Clock, TrendingUp, FileText, Users } from 'lucide-react'
import { differenceInDays } from 'date-fns'

export default function CustomerDashboardCompact({ 
  customer, 
  familyMembers, 
  contracts, 
  tasks, 
  opportunities,
  onDownloadPDF,
  onNewOpportunity,
  onNewFamilyMember,
  isDownloading
}) {
  const [expanded, setExpanded] = useState({
    urgent: true,
    expirations: true,
    opportunities: true,
    contracts: false,
    family: false
  });

  const toggle = (section) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Calculations
  const urgentIssues = useMemo(() => {
    const issues = [];
    
    // Überdue contracts
    const overdueContracts = contracts.filter(c => 
      c.end_date && differenceInDays(new Date(c.end_date), new Date()) < 0
    );
    if (overdueContracts.length > 0) {
      issues.push({
        type: 'overdue',
        severity: 'critical',
        count: overdueContracts.length,
        label: `${overdueContracts.length} überfällige Verträge`
      });
    }

    // Expiring soon (< 30 days)
    const expiringCritical = contracts.filter(c => {
      if (!c.end_date) return false;
      const days = differenceInDays(new Date(c.end_date), new Date());
      return days >= 0 && days <= 30;
    });
    if (expiringCritical.length > 0) {
      issues.push({
        type: 'expiring',
        severity: 'high',
        count: expiringCritical.length,
        label: `${expiringCritical.length} Verträge in < 30 Tagen ablaufend`
      });
    }

    // Open tasks with high priority
    const urgentTasks = tasks.filter(t => 
      t.status !== 'completed' && ['urgent', 'high'].includes(t.priority)
    );
    if (urgentTasks.length > 0) {
      issues.push({
        type: 'tasks',
        severity: 'high',
        count: urgentTasks.length,
        label: `${urgentTasks.length} dringende Aufgaben`
      });
    }

    return issues;
  }, [contracts, tasks]);

  const expiringContracts = useMemo(() => {
    return contracts
      .filter(c => c.end_date && differenceInDays(new Date(c.end_date), new Date()) > 0 && differenceInDays(new Date(c.end_date), new Date()) <= 180)
      .sort((a, b) => differenceInDays(new Date(a.end_date), new Date()) - differenceInDays(new Date(b.end_date), new Date()))
      .slice(0, 5);
  }, [contracts]);

  const openOpportunities = opportunities.filter(o => !['gewonnen', 'verloren'].includes(o.status)).slice(0, 4);

  const kpis = [
    { label: 'Aktive Verträge', value: contracts.filter(c => c.status === 'active').length, icon: FileText, color: 'text-blue-600 bg-blue-50' },
    { label: 'Offene Aufgaben', value: tasks.filter(t => t.status !== 'completed').length, icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' },
    { label: 'Chancen', value: openOpportunities.length, icon: TrendingUp, color: 'text-green-600 bg-green-50' },
    { label: 'Personen', value: familyMembers.length + 1, icon: Users, color: 'text-purple-600 bg-purple-50' }
  ];

  return (
    <div className="space-y-4">
      {/* Quick Actions - Sticky, Mobile Optimized */}
      <div className="sticky top-0 z-20 bg-background/98 backdrop-blur border-b mb-4 -mx-4 px-4 py-3 md:rounded-lg md:mx-0 md:mb-4">
        <div className="flex flex-wrap gap-2 md:gap-3">
          <Button size="sm" variant="default" onClick={onDownloadPDF} disabled={isDownloading} className="flex-1 md:flex-none">
            <FileText className="w-4 h-4 mr-2" />
            {isDownloading ? 'PDF...' : 'PDF'}
          </Button>
          <Button size="sm" variant="outline" onClick={onNewOpportunity} className="flex-1 md:flex-none">
            💡 Chance
          </Button>
          <Button size="sm" variant="outline" onClick={onNewFamilyMember} className="flex-1 md:flex-none">
            👥 Mitglied
          </Button>
        </div>
      </div>

      {/* KPIs - Responsive Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          const [bgColor, textColor] = kpi.color.split(' ');
          return (
            <Card key={i} className="p-3 md:p-4">
              <div className={`flex items-center gap-2 ${bgColor} p-2 rounded mb-2`}>
                <Icon className={`w-4 h-4 ${textColor}`} />
              </div>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-xl md:text-2xl font-bold">{kpi.value}</p>
            </Card>
          );
        })}
      </div>

      {/* SECTION 1: Handlungsbedarf - Always show if exists */}
      {urgentIssues.length > 0 && (
        <Card className="border-2 border-red-300 bg-red-50 shadow-sm">
          <CardHeader className="pb-2 cursor-pointer hover:bg-red-100/50 transition-colors" onClick={() => toggle('urgent')}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm md:text-base flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                Handlungsbedarf ({urgentIssues.length})
              </CardTitle>
              {expanded.urgent ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </CardHeader>
          {expanded.urgent && (
            <CardContent className="space-y-2">
              {urgentIssues.map((issue, i) => (
                <div key={i} className="flex items-start gap-2 p-2 md:p-3 bg-white rounded border-l-4 border-red-500">
                  <div className="w-2 h-2 rounded-full bg-red-600 mt-1.5 flex-shrink-0"></div>
                  <p className="text-sm font-medium text-red-900">{issue.label}</p>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* SECTION 2: Vertragsabläufe */}
      {expiringContracts.length > 0 && (
        <Card>
          <CardHeader className="pb-2 cursor-pointer" onClick={() => toggle('expirations')}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                ⏰ Nächste Abläufe ({expiringContracts.length})
              </CardTitle>
              {expanded.expirations ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </CardHeader>
          {expanded.expirations && (
            <CardContent>
              <div className="space-y-2">
                {expiringContracts.map(c => {
                  const days = differenceInDays(new Date(c.end_date), new Date());
                  return (
                    <div key={c.id} className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{c.insurer}</p>
                        <p className="text-xs text-muted-foreground">{c.sparte || c.insurance_type || '—'}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <Badge variant={days <= 90 ? 'default' : 'secondary'} className="text-xs">
                          {days}d
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* SECTION 3: Verkaufschancen */}
      {openOpportunities.length > 0 && (
        <Card>
          <CardHeader className="pb-2 cursor-pointer" onClick={() => toggle('opportunities')}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                💡 Chancen ({openOpportunities.length})
              </CardTitle>
              {expanded.opportunities ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </CardHeader>
          {expanded.opportunities && (
            <CardContent>
              <div className="space-y-2">
                {openOpportunities.map(opp => (
                  <div key={opp.id} className="flex items-start justify-between p-2 bg-muted/30 rounded text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{opp.title}</p>
                      <p className="text-xs text-muted-foreground">{opp.sparte || '—'}</p>
                    </div>
                    <Badge variant="outline" className="text-xs flex-shrink-0">
                      {opp.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* SECTION 4: Verträge - Compact List */}
      {contracts.length > 0 && (
        <Card>
          <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggle('contracts')}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm md:text-base">
                Verträge ({contracts.length})
              </CardTitle>
              {expanded.contracts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </CardHeader>
          {expanded.contracts && (
            <CardContent>
              <div className="space-y-2">
                {contracts.slice(0, 6).map(c => (
                  <div key={c.id} className="flex items-center justify-between p-2 md:p-3 bg-muted/20 hover:bg-muted/40 rounded transition-colors text-xs md:text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{c.insurer}</p>
                      <p className="text-[11px] md:text-xs text-muted-foreground truncate">{c.sparte || c.insurance_type}</p>
                    </div>
                    <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="text-[10px] flex-shrink-0">
                      {c.status === 'active' ? '✓' : '✗'}
                    </Badge>
                  </div>
                ))}
                {contracts.length > 6 && (
                  <p className="text-xs text-muted-foreground pt-2 text-center">+{contracts.length - 6} weitere</p>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* SECTION 5: Familie */}
      {familyMembers.length > 0 && (
        <Card>
          <CardHeader className="pb-2 cursor-pointer" onClick={() => toggle('family')}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                👨‍👩‍👧‍👦 Familie ({familyMembers.length + 1})
              </CardTitle>
              {expanded.family ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </CardHeader>
          {expanded.family && (
            <CardContent>
              <div className="space-y-2">
                {/* Primary */}
                <div className="p-2 bg-primary/5 rounded border border-primary/20 text-sm">
                  <p className="font-medium">{customer.first_name} {customer.last_name}</p>
                  <p className="text-xs text-muted-foreground">Hauptkontakt</p>
                </div>
                {/* Family */}
                {familyMembers.map(m => (
                  <div key={m.id} className="p-2 bg-muted/20 rounded text-sm">
                    <p className="font-medium">{m.first_name} {m.last_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.family_role === 'spouse' ? 'Ehepartner/in' : m.family_role === 'child' ? 'Kind' : 'Mitglied'}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}