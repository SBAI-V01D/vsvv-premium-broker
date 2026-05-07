import React from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Users, Wallet, BarChart3 } from 'lucide-react'
import DashboardKpiTile from '../DashboardKpiTile'
import RevenueChart from '../RevenueChart'
import TopAdvisors from '../TopAdvisors'
import ActivityFeed from '../ActivityFeed'
import { Card, CardContent } from '@/components/ui/card'

export default function TabAnalytics({ data }) {
  const navigate = useNavigate()
  const {
    filteredContracts, filteredCommissions, filteredAdvisors, organizations,
    activeContracts, activeCustomers, leads, convertedLeads, contracts,
  } = data

  // Insurer distribution
  const insurerDist = {}
  activeContracts.forEach(c => {
    if (c.insurer) insurerDist[c.insurer] = (insurerDist[c.insurer] || 0) + 1
  })
  const topInsurers = Object.entries(insurerDist).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const totalPolicies = activeContracts.length || 1

  // Sparte distribution
  const sparteDist = {}
  activeContracts.forEach(c => {
    const s = c.sparte || c.insurance_type || 'Sonstige'
    sparteDist[s] = (sparteDist[s] || 0) + 1
  })
  const topSparten = Object.entries(sparteDist).sort((a, b) => b[1] - a[1]).slice(0, 6)

  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-red-500', 'bg-slate-400']

  return (
    <div className="space-y-8">

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Performance KPIs</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <DashboardKpiTile label="Aktive Verträge" value={activeContracts.length} sub="Portfolio" icon={BarChart3} accent="border-l-blue-500" onClick={() => navigate('/vertraege')} />
          <DashboardKpiTile label="Aktive Kunden" value={activeCustomers.length} sub="mit Vertrag" icon={Users} accent="border-l-emerald-500" onClick={() => navigate('/kunden')} />
          <DashboardKpiTile label="Lead → Kunde" value={`${leads.length > 0 ? ((convertedLeads.length / leads.length) * 100).toFixed(1) : '0.0'}%`} sub="Conversion" icon={TrendingUp} accent="border-l-green-500" onClick={() => navigate('/leads')} />
          <DashboardKpiTile label="Ø Policen/Kunde" value={activeCustomers.length > 0 ? (activeContracts.length / activeCustomers.length).toFixed(1) : '0'} sub="Cross-Sell-Index" icon={Wallet} accent="border-l-amber-500" />
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Umsatz-Trend</h3>
          <RevenueChart contracts={filteredContracts} commissionEntries={filteredCommissions} />
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Berater Rankings</h3>
          <TopAdvisors advisors={filteredAdvisors} organizations={organizations} commissionEntries={filteredCommissions} contracts={filteredContracts} />
        </div>
      </div>

      {/* Insurer & Sparte distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Versicherer-Verteilung</h3>
            <div className="space-y-2.5">
              {topInsurers.map(([insurer, count], i) => (
                <div key={insurer} className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors[i]}`} />
                  <span className="text-sm flex-1 truncate">{insurer}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${colors[i]} rounded-full`} style={{ width: `${(count / totalPolicies) * 100}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-6 text-right">{count}</span>
                  </div>
                </div>
              ))}
              {topInsurers.length === 0 && <p className="text-sm text-muted-foreground">Keine Daten</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Sparten-Verteilung</h3>
            <div className="space-y-2.5">
              {topSparten.map(([sparte, count], i) => (
                <div key={sparte} className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors[i]}`} />
                  <span className="text-sm flex-1 truncate">{sparte}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${colors[i]} rounded-full`} style={{ width: `${(count / totalPolicies) * 100}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-6 text-right">{count}</span>
                  </div>
                </div>
              ))}
              {topSparten.length === 0 && <p className="text-sm text-muted-foreground">Keine Daten</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity feed */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Letzte Aktivitäten</h3>
        <ActivityFeed customers={activeCustomers} contracts={filteredContracts} commissions={filteredCommissions} />
      </div>

    </div>
  )
}