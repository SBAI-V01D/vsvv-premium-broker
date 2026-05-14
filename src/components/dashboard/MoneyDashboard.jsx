import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TrendingUp, AlertTriangle, Clock, Target, DollarSign, Users, Zap } from 'lucide-react'
import { formatCHF, formatPct } from '@/lib/commissionEngine'

function MoneyCard({ title, value, trend, icon: Icon, color, subtitle }) {
  return (
    <Card className={`border-0 ${color}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
          <Icon className="w-4 h-4 opacity-50" />
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <div className="flex items-center gap-1 mt-2">
          {trend && <TrendingUp className="w-3 h-3" />}
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function HotLeadRow({ lead, onSelect }) {
  return (
    <button
      onClick={() => onSelect(lead)}
      className="w-full text-left p-3 hover:bg-amber-50 border-b last:border-0 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="font-semibold text-sm">{lead.name}</p>
          <p className="text-xs text-muted-foreground">{lead.company || lead.email}</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2">
            <div className="w-16 bg-muted rounded h-2 overflow-hidden">
              <div className="bg-amber-500 h-full" style={{ width: `${lead.score}%` }} />
            </div>
            <span className="text-xs font-bold text-amber-600">{lead.score}</span>
          </div>
          <p className="text-xs text-amber-500 mt-1">{lead.recommendation}</p>
        </div>
      </div>
    </button>
  )
}

export default function MoneyDashboard() {
  const { data: entries = [] } = useQuery({
    queryKey: ['commissionEntries'],
    queryFn: () => base44.entities.CommissionEntry.list('-entry_date', 1000),
  })

  const { data: leads = [] } = useQuery({
    queryKey: ['leads-hot'],
    queryFn: async () => {
      const all = await base44.entities.Lead.list('-lead_score', 100)
      return all.filter(l => ['new', 'contacted', 'qualified'].includes(l.status))
    },
  })

  const { data: opps = [] } = useQuery({
    queryKey: ['opportunities-top'],
    queryFn: () => base44.entities.Verkaufschance.filter({ status: ['neu', 'in_ausschreibung', 'offerten_erhalten'] }, '-estimated_value', 50),
  })

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts-renewal'],
    queryFn: () => base44.entities.Contract.list('-renewal_date', 200),
  })

  // Calculate KPIs
  const kpis = useMemo(() => {
    const courtageOpen = entries.filter(e => e.courtage_status !== 'paid').reduce((s, e) => s + (e.courtage_payout_amount || 0), 0)
    const provisionOpen = entries.filter(e => e.provision_status !== 'paid').reduce((s, e) => s + (e.provision_payout_amount || 0), 0)
    
    const renewalNext30 = contracts.filter(e => {
      if (!e.renewal_date) return false
      const daysUntil = (new Date(e.renewal_date).getTime() - Date.now()) / 86400000
      return daysUntil > 0 && daysUntil < 30
    }).length

    const hotLeads = leads.filter(l => (l.lead_score || 0) >= 70).length
    const topOpps = opps.filter(o => o.estimated_value > 50000).length

    return {
      courtageOpen,
      provisionOpen,
      totalOpen: courtageOpen + provisionOpen,
      renewalNext30,
      hotLeads,
      topOpps,
    }
  }, [entries, leads, opps, contracts])

  return (
    <div className="space-y-6">
      {/* Money Section */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <DollarSign className="w-5 h-5" /> GELD & UMSATZ
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MoneyCard
            title="Offene Courtagen"
            value={formatCHF(kpis.courtageOpen)}
            subtitle={`${entries.filter(e => e.courtage_status !== 'paid').length} Abrechnungen`}
            icon={TrendingUp}
            color="bg-blue-50 border border-blue-200"
          />
          <MoneyCard
            title="Offene Provisionen"
            value={formatCHF(kpis.provisionOpen)}
            subtitle={`${entries.filter(e => e.provision_status !== 'paid').length} Abrechnungen`}
            icon={TrendingUp}
            color="bg-emerald-50 border border-emerald-200"
          />
          <MoneyCard
            title="Total Offen"
            value={formatCHF(kpis.totalOpen)}
            subtitle="Courtage + Provision"
            icon={Target}
            color="bg-amber-50 border border-amber-200"
            trend
          />
        </div>
      </div>

      {/* Hot Opportunities */}
      <Tabs defaultValue="hotleads" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="hotleads" className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leads ({kpis.hotLeads})</span>
            <span className="sm:hidden">{kpis.hotLeads}</span>
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="flex items-center gap-1">
            <Target className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Opps ({kpis.topOpps})</span>
            <span className="sm:hidden">{kpis.topOpps}</span>
          </TabsTrigger>
          <TabsTrigger value="renewals" className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Renewals ({kpis.renewalNext30})</span>
            <span className="sm:hidden">{kpis.renewalNext30}</span>
          </TabsTrigger>
          <TabsTrigger value="risks" className="flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Risiken</span>
            <span className="sm:hidden">!</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hotleads" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                Heiße Leads
              </CardTitle>
              <CardDescription>
                Leads mit höchster Abschlusswahrscheinlichkeit – heute kontaktieren
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {leads.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Keine Leads</p>
              ) : (
                leads.map(lead => (
                  <HotLeadRow key={lead.id} lead={lead} onSelect={() => {}} />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="opportunities" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Opportunities</CardTitle>
              <CardDescription>
                Größte Chancen – sortiert nach Courtage-Potenzial
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {opps.slice(0, 10).map(opp => (
                  <div key={opp.id} className="flex items-center justify-between p-2 hover:bg-muted rounded">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{opp.title}</p>
                      <p className="text-xs text-muted-foreground">{opp.customer_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">{formatCHF(opp.estimated_value)}</p>
                      <p className="text-xs text-amber-600">~{formatCHF(opp.estimated_value * 0.02)} Courtage</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="renewals" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vertragsabläufe (Nächste 30 Tage)</CardTitle>
              <CardDescription>
                Renewal Chancen – Follow-up erforderlich
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{kpis.renewalNext30} Verträge verfallen in den nächsten 30 Tagen</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risks" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                Kündigungsrisiken
              </CardTitle>
              <CardDescription>
                Gefährdete Kunden, Storno-Wahrscheinlichkeit
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Risikoanalyse wird aufgebaut...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}