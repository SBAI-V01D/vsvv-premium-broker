import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Users, Wallet, BarChart3, AlertTriangle, TrendingDown, ShieldAlert } from 'lucide-react'
import DashboardKpiTile from '../DashboardKpiTile'
import RevenueChart from '../RevenueChart'
import TopAdvisors from '../TopAdvisors'
import ActivityFeed from '../ActivityFeed'
import { Card, CardContent } from '@/components/ui/card'
import { buildHealthMap, HEALTH_STATES } from '@/lib/healthScore'

const COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-red-500', 'bg-slate-400']

export default function TabAnalytics({ data }) {
  const navigate = useNavigate()
  const {
    filteredContracts, filteredCommissions, filteredAdvisors, organizations,
    activeContracts, activeCustomers, leads, convertedLeads, contracts,
    customers = [], documents = [], tasks = [],
  } = data

  // Insurer distribution
  const topInsurers = useMemo(() => {
    const d = {}
    activeContracts.forEach(c => { if (c.insurer) d[c.insurer] = (d[c.insurer] || 0) + 1 })
    return Object.entries(d).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [activeContracts])

  // Sparte distribution
  const topSparten = useMemo(() => {
    const d = {}
    activeContracts.forEach(c => {
      const s = c.sparte || c.insurance_type || 'Sonstige'
      d[s] = (d[s] || 0) + 1
    })
    return Object.entries(d).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [activeContracts])

  const totalPolicies = activeContracts.length || 1

  // Conversion Funnel
  const funnelStages = useMemo(() => {
    const total = leads.length
    const contacted = leads.filter(l => ['contacted','qualified','converted'].includes(l.status)).length
    const qualified = leads.filter(l => ['qualified','converted'].includes(l.status)).length
    const converted = leads.filter(l => l.status === 'converted').length
    return [
      { label: 'Neue Leads',   count: total,     color: 'bg-slate-400' },
      { label: 'Kontaktiert',  count: contacted, color: 'bg-blue-400' },
      { label: 'Qualifiziert', count: qualified, color: 'bg-violet-500' },
      { label: 'Konvertiert',  count: converted, color: 'bg-emerald-500' },
    ]
  }, [leads])

  // Portfolio Risk
  const allPrimary = customers.filter(c => !c.is_family_member)
  const healthMap = useMemo(() => buildHealthMap(allPrimary, contracts, documents, tasks), [allPrimary, contracts, documents, tasks])
  const churnCount   = Object.values(healthMap).filter(h => h.state === HEALTH_STATES.CHURN_RISK).length
  const highRiskCount= Object.values(healthMap).filter(h => h.state === HEALTH_STATES.HIGH_RISK).length

  // Today expiring in 90 days
  const today = new Date()
  const in90  = new Date(today); in90.setDate(today.getDate() + 90)
  const expiringCount = activeContracts.filter(c => {
    if (!c.end_date) return false
    const end = new Date(c.end_date)
    return end >= today && end <= in90
  }).length

  // Revenue by status
  const premiumByStatus = useMemo(() => {
    const d = {}
    contracts.forEach(c => {
      const s = c.status || 'other'
      d[s] = (d[s] || 0) + (c.premium_yearly || (c.premium_monthly || 0) * 12)
    })
    return Object.entries(d).sort((a, b) => b[1] - a[1])
  }, [contracts])
  const totalRevenue = premiumByStatus.reduce((s, [, v]) => s + v, 0) || 1

  return (
    <div className="space-y-8">

      {/* Performance KPIs */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Portfolio KPIs</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <DashboardKpiTile label="Aktive Verträge"   value={activeContracts.length}         sub="Portfolio"         icon={BarChart3}   accent="border-l-blue-500"    onClick={() => navigate('/vertraege')} />
          <DashboardKpiTile label="Aktive Kunden"     value={activeCustomers.length}          sub="mit Vertrag"       icon={Users}       accent="border-l-emerald-500" onClick={() => navigate('/kunden')} />
          <DashboardKpiTile label="Lead → Kunde"      value={`${leads.length > 0 ? ((convertedLeads.length / leads.length) * 100).toFixed(1) : '0.0'}%`} sub="Conversion" icon={TrendingUp} accent="border-l-green-500" onClick={() => navigate('/leads')} />
          <DashboardKpiTile label="Ø Policen/Kunde"   value={activeCustomers.length > 0 ? (activeContracts.length / activeCustomers.length).toFixed(1) : '0'} sub="Cross-Sell-Index" icon={Wallet} accent="border-l-amber-500" />
        </div>
      </div>

      {/* Portfolio Risk Row */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Portfolio Risiko</h3>
        <div className="grid grid-cols-3 gap-3">
          <Card className="shadow-sm border-l-4 border-l-red-400">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-red-500" />
                <span className="text-xs text-muted-foreground font-medium">Abwanderungsgefahr</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{churnCount}</p>
              <p className="text-xs text-muted-foreground">Kunden mit Churn-Risiko</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-l-4 border-l-orange-400">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                <span className="text-xs text-muted-foreground font-medium">Hochrisiko</span>
              </div>
              <p className="text-2xl font-bold text-orange-600">{highRiskCount}</p>
              <p className="text-xs text-muted-foreground">Kunden mit erhöhtem Risiko</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-l-4 border-l-amber-400">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-muted-foreground font-medium">Ablaufende Verträge</span>
              </div>
              <p className="text-2xl font-bold text-amber-600">{expiringCount}</p>
              <p className="text-xs text-muted-foreground">in den nächsten 90 Tagen</p>
            </CardContent>
          </Card>
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

      {/* Conversion Funnel */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Conversion Funnel</h3>
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-end gap-2 h-28">
              {funnelStages.map((stage, i) => {
                const maxCount = funnelStages[0].count || 1
                const heightPct = Math.max(8, Math.round((stage.count / maxCount) * 100))
                return (
                  <div key={stage.label} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-sm font-bold">{stage.count}</span>
                    <div
                      className={`w-full rounded-t-md ${stage.color} transition-all`}
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-xs text-muted-foreground text-center leading-tight">{stage.label}</span>
                  </div>
                )
              })}
            </div>
            {funnelStages[0].count > 0 && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Conversion Rate: <strong>{((funnelStages[3].count / funnelStages[0].count) * 100).toFixed(1)}%</strong> (Lead → Abschluss)
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Insurer & Sparte distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Versicherer-Verteilung</h3>
            <div className="space-y-2.5">
              {topInsurers.map(([insurer, count], i) => (
                <div key={insurer} className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${COLORS[i]}`} />
                  <span className="text-sm flex-1 truncate">{insurer}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${COLORS[i]} rounded-full`} style={{ width: `${(count / totalPolicies) * 100}%` }} />
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
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${COLORS[i]}`} />
                  <span className="text-sm flex-1 truncate">{sparte}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${COLORS[i]} rounded-full`} style={{ width: `${(count / totalPolicies) * 100}%` }} />
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