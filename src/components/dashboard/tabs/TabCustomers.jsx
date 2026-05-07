import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Star, Shield, AlertTriangle, ArrowRight, Heart, TrendingDown } from 'lucide-react'
import DashboardKpiTile from '../DashboardKpiTile'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LIFECYCLE_LABELS, LIFECYCLE_COLORS } from '@/lib/lifecycle'
import { buildHealthMap, HEALTH_LABELS, HEALTH_COLORS, HEALTH_STATES } from '@/lib/healthScore'
import HealthScoreBadge from '@/components/customers/HealthScoreBadge'

export default function TabCustomers({ data }) {
  const navigate = useNavigate()
  const {
    activeCustomers, customers, vipCustomers, lifecycleMap,
    activeContracts, customersWithCriticalGaps, contracts, documents = [], tasks = [],
  } = data

  const allPrimary = customers.filter(c => !c.is_family_member)

  // Health Score Map
  const healthMap = useMemo(() =>
    buildHealthMap(allPrimary, contracts, documents, tasks),
    [allPrimary, contracts, documents, tasks]
  )

  // Distribution by lifecycle state
  const stateDist = useMemo(() => {
    const d = {}
    allPrimary.forEach(c => {
      const state = lifecycleMap[c.id] || 'lead'
      d[state] = (d[state] || 0) + 1
    })
    return d
  }, [allPrimary, lifecycleMap])

  // Health distribution
  const healthDist = useMemo(() => {
    const d = { vip: 0, healthy: 0, attention: 0, high_risk: 0, churn_risk: 0 }
    activeCustomers.forEach(c => {
      const h = healthMap[c.id]
      if (h) d[h.state] = (d[h.state] || 0) + 1
    })
    return d
  }, [activeCustomers, healthMap])

  // Customers with multiple policies (cross-sold)
  const crossSoldCount = activeCustomers.filter(c => {
    const cs = activeContracts.filter(x => x.customer_id === c.id || x.primary_customer_id === c.id)
    return cs.length >= 2
  }).length

  const churnCount = Object.values(healthMap).filter(h => h.state === HEALTH_STATES.CHURN_RISK).length
  const atRiskCount = Object.values(healthMap).filter(h => h.state === HEALTH_STATES.HIGH_RISK || h.state === HEALTH_STATES.CHURN_RISK).length

  // Top customers by premium + health
  const topCustomers = useMemo(() => {
    return activeCustomers.map(customer => {
      const customerContracts = activeContracts.filter(c => c.customer_id === customer.id || c.primary_customer_id === customer.id)
      const premium = customerContracts.reduce((s, c) => s + (c.premium_yearly || (c.premium_monthly || 0) * 12), 0)
      const health = healthMap[customer.id] || { score: 50, state: 'healthy' }
      return { customer, premium, health, contractCount: customerContracts.length }
    }).sort((a, b) => b.premium - a.premium).slice(0, 10)
  }, [activeCustomers, activeContracts, healthMap])

  return (
    <div className="space-y-8">

      {/* KPIs */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Kunden-Portfolio</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <DashboardKpiTile label="Aktive Kunden" value={activeCustomers.length} sub="mit aktivem Vertrag" icon={Users} accent="border-l-emerald-500" onClick={() => navigate('/kunden')} />
          <DashboardKpiTile label="VIP Kunden" value={vipCustomers.length} sub="Prämie ≥ CHF 10'000/J" icon={Star} accent="border-l-yellow-500" onClick={() => navigate('/kunden')} />
          <DashboardKpiTile label="Abwanderungsrisiko" value={atRiskCount} sub="Risiko- & Abwanderungsgefahr" icon={TrendingDown} accent="border-l-red-500" onClick={() => navigate('/kunden')} />
          <DashboardKpiTile label="Cross-Selling" value={crossSoldCount} sub="Kunden mit 2+ Policen" icon={Shield} accent="border-l-blue-500" onClick={() => navigate('/kunden')} />
        </div>
      </div>

      {/* Health Score Distribution */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Customer Health Score</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries(HEALTH_LABELS).map(([state, label]) => {
            const count = healthDist[state] || 0
            const colors = HEALTH_COLORS[state]
            const pct = activeCustomers.length > 0 ? Math.round((count / activeCustomers.length) * 100) : 0
            return (
              <div key={state} className={`p-4 rounded-xl border ${colors.bg} ${colors.border}`}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                  <span className={`text-xs font-semibold ${colors.text}`}>{label}</span>
                </div>
                <p className={`text-2xl font-bold ${colors.text}`}>{count}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{pct}% der Kunden</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Lifecycle Distribution */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Lifecycle-Verteilung</h3>
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {Object.entries(stateDist).map(([state, count]) => {
                const colors = LIFECYCLE_COLORS[state] || LIFECYCLE_COLORS['lead']
                return (
                  <div key={state} className={`p-3 rounded-lg border ${colors.bg} ${colors.border}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                      <span className={`text-xs font-medium ${colors.text}`}>{LIFECYCLE_LABELS[state] || state}</span>
                    </div>
                    <p className={`text-2xl font-bold ${colors.text}`}>{count}</p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Customer List with Health Score */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Top Kunden nach Prämie</h3>
          <Button size="sm" variant="outline" onClick={() => navigate('/kunden')}>Alle anzeigen</Button>
        </div>
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kunde</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Health</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Policen</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Jahresprämie</th>
                  <th className="px-4 py-2.5 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map(({ customer, premium, health, contractCount }) => (
                  <tr key={customer.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{customer.first_name} {customer.last_name}</p>
                      <p className="text-xs text-muted-foreground">{customer.city || ''}</p>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      <HealthScoreBadge state={health.state} score={health.score} showScore />
                    </td>
                    <td className="px-4 py-2.5 text-center hidden lg:table-cell">
                      <span className="text-sm font-medium">{contractCount}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold">
                      {premium > 0 ? `CHF ${premium.toLocaleString('de-CH', { maximumFractionDigits: 0 })}` : '–'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => navigate(`/kunden/${customer.id}/360`)} className="text-muted-foreground hover:text-primary transition-colors">
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {topCustomers.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">Keine aktiven Kunden</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

    </div>
  )
}