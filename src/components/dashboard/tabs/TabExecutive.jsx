import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, FileText, TrendingUp, Wallet, UserCheck, Building2, Star, RefreshCw } from 'lucide-react'
import DashboardKpiTile from '../DashboardKpiTile'
import RevenueChart from '../RevenueChart'
import TopAdvisors from '../TopAdvisors'
import FinanceWidget from '../FinanceWidget'

export default function TabExecutive({ data }) {
  const navigate = useNavigate()
  const {
    activeCustomers, customers, activeContracts, contracts,
    totalMonthlyPremium, totalYearlyPremium, mtdCommissions, yearlyCommissionForecast,
    convertedLeads, leads, conversionRate, filteredAdvisors, organizations,
    expiringContracts, vipCustomers, commissionEntries, filteredContracts, filteredCommissions,
  } = data

  const retentionRate = activeCustomers.length > 0
    ? Math.round((activeCustomers.filter(c => {
        const cs = contracts.filter(x => x.customer_id === c.id && x.status === 'active')
        return cs.length > 1
      }).length / activeCustomers.length) * 100)
    : 0

  return (
    <div className="space-y-8">

      {/* ROW 1 — Revenue KPIs */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Umsatz & Prämienvolumen</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <DashboardKpiTile label="Jahresprämienvolumen" value={`CHF ${totalYearlyPremium.toLocaleString('de-CH', { maximumFractionDigits: 0 })}`} sub="aktive Verträge" icon={TrendingUp} accent="border-l-emerald-500" onClick={() => navigate('/vertraege')} />
          <DashboardKpiTile label="Monatsprämien" value={`CHF ${totalMonthlyPremium.toLocaleString('de-CH', { maximumFractionDigits: 0 })}`} sub="laufend" icon={Wallet} accent="border-l-blue-500" onClick={() => navigate('/vertraege')} />
          <DashboardKpiTile label="Provisions-Forecast" value={`CHF ${yearlyCommissionForecast.toLocaleString('de-CH', { maximumFractionDigits: 0 })}`} sub="Jahreshochrechnung" icon={Wallet} accent="border-l-amber-500" onClick={() => navigate('/provisionen-courtagen')} />
          <DashboardKpiTile label="Provision MTD" value={`CHF ${mtdCommissions.toLocaleString('de-CH', { maximumFractionDigits: 0 })}`} sub="laufender Monat" icon={Wallet} accent="border-l-orange-500" onClick={() => navigate('/provisionen-courtagen')} />
        </div>
      </div>

      {/* ROW 2 — Growth & Team */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Wachstum & Team</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <DashboardKpiTile label="Aktive Kunden" value={activeCustomers.length} sub="mit aktivem Vertrag" icon={Users} accent="border-l-blue-500" onClick={() => navigate('/kunden')} />
          <DashboardKpiTile label="VIP Kunden" value={vipCustomers.length} sub="Prämie ≥ CHF 10'000/J" icon={Star} accent="border-l-yellow-500" onClick={() => navigate('/kunden')} />
          <DashboardKpiTile label="Conversion Rate" value={`${conversionRate}%`} sub={`${convertedLeads.length} von ${leads.length} Leads`} icon={TrendingUp} accent="border-l-green-500" onClick={() => navigate('/leads')} />
          <DashboardKpiTile label="Ablaufende Verträge" value={expiringContracts.length} sub="nächste 90 Tage" icon={RefreshCw} accent="border-l-red-500" onClick={() => navigate('/vertraege')} />
        </div>
      </div>

      {/* ROW 3 — Team */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Organisation</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <DashboardKpiTile label="Berater" value={filteredAdvisors.length} sub="aktiv" icon={UserCheck} accent="border-l-purple-500" onClick={() => navigate('/berater-organisation')} />
          <DashboardKpiTile label="Organisationen" value={organizations.filter(o => o.status === 'active').length} sub="aktiv" icon={Building2} accent="border-l-slate-500" onClick={() => navigate('/berater-organisation')} />
          <DashboardKpiTile label="Aktive Policen" value={activeContracts.length} sub={`von ${contracts.length} gesamt`} icon={FileText} accent="border-l-slate-400" onClick={() => navigate('/vertraege')} />
          <DashboardKpiTile label="Kundenbindung" value={`${retentionRate}%`} sub="Kunden mit 2+ Policen" icon={Users} accent="border-l-teal-500" onClick={() => navigate('/kunden')} />
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