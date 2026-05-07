import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, FileText, TrendingUp, Wallet, UserCheck, Building2, Star, RefreshCw, AlertTriangle, ShieldCheck, Activity } from 'lucide-react'
import DashboardKpiTile from '../DashboardKpiTile'
import RevenueChart from '../RevenueChart'
import TopAdvisors from '../TopAdvisors'
import FinanceWidget from '../FinanceWidget'
import { Card, CardContent } from '@/components/ui/card'
import { buildHealthMap, HEALTH_STATES } from '@/lib/healthScore'

export default function TabExecutive({ data }) {
  const navigate = useNavigate()
  const {
    activeCustomers, customers, activeContracts, contracts,
    totalMonthlyPremium, totalYearlyPremium, mtdCommissions, yearlyCommissionForecast,
    convertedLeads, leads, conversionRate, filteredAdvisors, organizations,
    expiringContracts, vipCustomers, filteredContracts, filteredCommissions,
    documents = [], tasks = [],
  } = data

  const retentionRate = useMemo(() =>
    activeCustomers.length > 0
      ? Math.round((activeCustomers.filter(c => {
          return contracts.filter(x => x.customer_id === c.id && x.status === 'active').length > 1
        }).length / activeCustomers.length) * 100)
      : 0,
    [activeCustomers, contracts]
  )

  // Portfolio health overview
  const allPrimary = useMemo(() => customers.filter(c => !c.is_family_member), [customers])
  const healthMap = useMemo(() => buildHealthMap(allPrimary, contracts, documents, tasks), [allPrimary, contracts, documents, tasks])
  const healthCounts = useMemo(() => {
    const d = { vip: 0, healthy: 0, attention: 0, high_risk: 0, churn_risk: 0 }
    Object.values(healthMap).forEach(h => { if (h?.state) d[h.state] = (d[h.state] || 0) + 1 })
    return d
  }, [healthMap])

  // Revenue momentum (active vs total)
  const premiumGrowthIndicator = useMemo(() => {
    const activeYearly = activeContracts.reduce((s, c) => s + (c.premium_yearly || (c.premium_monthly || 0) * 12), 0)
    const allYearly = contracts.filter(c => c.status !== 'cancelled').reduce((s, c) => s + (c.premium_yearly || (c.premium_monthly || 0) * 12), 0)
    return allYearly > 0 ? Math.round((activeYearly / allYearly) * 100) : 0
  }, [activeContracts, contracts])

  const fmtChf = (n) => `CHF ${n.toLocaleString('de-CH', { maximumFractionDigits: 0 })}`

  return (
    <div className="space-y-8">

      {/* ROW 1 — Revenue KPIs */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Umsatz & Prämienvolumen</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <DashboardKpiTile label="Jahresprämienvolumen"  value={fmtChf(totalYearlyPremium)}        sub="aktive Verträge"      icon={TrendingUp} accent="border-l-emerald-500" onClick={() => navigate('/vertraege')} />
          <DashboardKpiTile label="Monatsprämien"         value={fmtChf(totalMonthlyPremium)}        sub="laufend"              icon={Wallet}     accent="border-l-blue-500"    onClick={() => navigate('/vertraege')} />
          <DashboardKpiTile label="Provisions-Forecast"   value={fmtChf(yearlyCommissionForecast)}   sub="Jahreshochrechnung"   icon={Wallet}     accent="border-l-amber-500"   onClick={() => navigate('/provisionen-courtagen')} />
          <DashboardKpiTile label="Provision MTD"         value={fmtChf(mtdCommissions)}             sub="laufender Monat"      icon={Wallet}     accent="border-l-orange-500"  onClick={() => navigate('/provisionen-courtagen')} />
        </div>
      </div>

      {/* ROW 2 — Customer & Growth */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Kunden & Wachstum</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <DashboardKpiTile label="Aktive Kunden"        value={activeCustomers.length}   sub="mit aktivem Vertrag"   icon={Users}      accent="border-l-blue-500"    onClick={() => navigate('/kunden')} />
          <DashboardKpiTile label="VIP Kunden"           value={vipCustomers.length}      sub="Prämie ≥ CHF 10'000/J" icon={Star}       accent="border-l-yellow-500"  onClick={() => navigate('/kunden')} />
          <DashboardKpiTile label="Conversion Rate"      value={`${conversionRate}%`}     sub={`${convertedLeads.length} von ${leads.length} Leads`} icon={TrendingUp} accent="border-l-green-500" onClick={() => navigate('/leads')} />
          <DashboardKpiTile label="Ablaufende Verträge"  value={expiringContracts.length} sub="nächste 90 Tage"       icon={RefreshCw}  accent="border-l-red-500"     onClick={() => navigate('/vertraege')} />
        </div>
      </div>

      {/* ROW 3 — Portfolio Health */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Portfolio Health</h3>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { key: 'vip',        label: 'VIP',               color: 'border-l-yellow-400 bg-yellow-50',  text: 'text-yellow-700' },
            { key: 'healthy',    label: 'Gesund',             color: 'border-l-emerald-500 bg-emerald-50',text: 'text-emerald-700' },
            { key: 'attention',  label: 'Achtung',            color: 'border-l-amber-400 bg-amber-50',    text: 'text-amber-700' },
            { key: 'high_risk',  label: 'Hochrisiko',         color: 'border-l-orange-500 bg-orange-50',  text: 'text-orange-700' },
            { key: 'churn_risk', label: 'Abwanderungsgefahr', color: 'border-l-red-500 bg-red-50',        text: 'text-red-700' },
          ].map(({ key, label, color, text }) => (
            <Card key={key} className={`shadow-sm border-l-4 ${color}`}>
              <CardContent className="p-4">
                <p className={`text-xs font-medium mb-1 ${text}`}>{label}</p>
                <p className={`text-2xl font-bold ${text}`}>{healthCounts[key] || 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Kunden</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ROW 4 — Organisation */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Organisation & Struktur</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <DashboardKpiTile label="Berater"             value={filteredAdvisors.length}                               sub="aktiv"                   icon={UserCheck}   accent="border-l-purple-500" onClick={() => navigate('/berater-organisation')} />
          <DashboardKpiTile label="Organisationen"      value={organizations.filter(o => o.status === 'active').length} sub="aktiv"                 icon={Building2}   accent="border-l-slate-500"  onClick={() => navigate('/berater-organisation')} />
          <DashboardKpiTile label="Aktive Policen"      value={activeContracts.length}                                sub={`von ${contracts.length} gesamt`} icon={FileText} accent="border-l-slate-400" onClick={() => navigate('/vertraege')} />
          <DashboardKpiTile label="Kundenbindung"       value={`${retentionRate}%`}                                   sub="Kunden mit 2+ Policen"   icon={Activity}    accent="border-l-teal-500"   onClick={() => navigate('/kunden')} />
        </div>
      </div>

      {/* Finance Widget */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Finanzübersicht</h3>
        <FinanceWidget />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Umsatz-Trend</h3>
          <RevenueChart contracts={filteredContracts} commissionEntries={filteredCommissions} />
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Berater Performance</h3>
          <TopAdvisors advisors={filteredAdvisors} organizations={organizations} commissionEntries={filteredCommissions} contracts={filteredContracts} />
        </div>
      </div>

    </div>
  )
}