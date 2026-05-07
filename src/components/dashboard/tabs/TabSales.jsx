import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Target, FileText, TrendingUp, Users, Clock, CheckCircle2 } from 'lucide-react'
import DashboardKpiTile from '../DashboardKpiTile'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const STAGE_CONFIG = [
  { key: 'new',       label: 'Neu',          color: 'bg-slate-100 text-slate-700 border-slate-200',   bar: 'bg-slate-400' },
  { key: 'contacted', label: 'Kontaktiert',  color: 'bg-blue-50 text-blue-700 border-blue-200',       bar: 'bg-blue-500' },
  { key: 'qualified', label: 'Qualifiziert', color: 'bg-violet-50 text-violet-700 border-violet-200', bar: 'bg-violet-500' },
]

export default function TabSales({ data }) {
  const navigate = useNavigate()
  const {
    activeLeads, leads, trueLeads, pendingApplications, convertedLeads,
    conversionRate, customers,
  } = data

  const today = new Date()
  const newCustomers30d = customers.filter(c =>
    !c.is_family_member && new Date(c.created_date) > new Date(Date.now() - 30 * 86400000)
  ).length

  const funnelStages = STAGE_CONFIG.map(s => ({
    ...s,
    count: trueLeads.filter(l => l.status === s.key).length,
  }))
  const maxCount = Math.max(...funnelStages.map(s => s.count), 1)

  return (
    <div className="space-y-8">

      {/* KPIs */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Pipeline KPIs</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <DashboardKpiTile label="Aktive Leads" value={activeLeads.length} sub="in Pipeline" icon={Target} accent="border-l-blue-500" onClick={() => navigate('/leads')} />
          <DashboardKpiTile label="Conversion Rate" value={`${conversionRate}%`} sub={`${convertedLeads.length} konvertiert`} icon={TrendingUp} accent="border-l-green-500" onClick={() => navigate('/leads')} />
          <DashboardKpiTile label="Offene Anträge" value={pendingApplications.length} sub="in Bearbeitung" icon={FileText} accent="border-l-amber-500" onClick={() => navigate('/antraege')} />
          <DashboardKpiTile label="Neue Kunden (30T)" value={newCustomers30d} sub="letzten 30 Tage" icon={Users} accent="border-l-violet-500" onClick={() => navigate('/kunden')} />
        </div>
      </div>

      {/* Funnel */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Sales Funnel</h3>
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-4">
              {funnelStages.map((stage, idx) => (
                <div key={stage.key} className="text-center">
                  <div className="relative mb-3 flex justify-center">
                    {/* Funnel visual */}
                    <div className="w-full max-w-[120px]">
                      <div
                        className={`${stage.bar} rounded-md transition-all`}
                        style={{ height: `${Math.max(12, (stage.count / maxCount) * 80)}px` }}
                      />
                    </div>
                    {idx < funnelStages.length - 1 && (
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground/40 text-xs">→</div>
                    )}
                  </div>
                  <p className="text-3xl font-bold">{stage.count}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stage.label}</p>
                </div>
              ))}
            </div>

            {/* Conversion indicator */}
            <div className="mt-6 pt-4 border-t flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Gesamtkonversion</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${conversionRate}%` }} />
                </div>
                <span className="font-bold text-green-600">{conversionRate}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lead list preview */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Aktuelle Leads</h3>
          <Button size="sm" variant="outline" onClick={() => navigate('/leads')}>Alle anzeigen</Button>
        </div>
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">E-Mail</th>
                </tr>
              </thead>
              <tbody>
                {trueLeads.slice(0, 8).map(lead => (
                  <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{lead.first_name ? `${lead.first_name} ${lead.last_name}` : lead.name}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                        lead.status === 'qualified' ? 'bg-violet-50 text-violet-700 border-violet-200' :
                        lead.status === 'contacted' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        {lead.status === 'new' ? 'Neu' : lead.status === 'contacted' ? 'Kontaktiert' : 'Qualifiziert'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs hidden md:table-cell">{lead.email}</td>
                  </tr>
                ))}
                {trueLeads.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground text-sm">Keine aktiven Leads</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

    </div>
  )
}