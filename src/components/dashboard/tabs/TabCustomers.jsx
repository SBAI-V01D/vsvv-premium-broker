import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Star, Shield, Heart, ArrowRight, AlertTriangle } from 'lucide-react'
import DashboardKpiTile from '../DashboardKpiTile'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LIFECYCLE_LABELS, LIFECYCLE_COLORS } from '@/lib/lifecycle'

export default function TabCustomers({ data }) {
  const navigate = useNavigate()
  const {
    activeCustomers, customers, vipCustomers, lifecycleMap,
    activeContracts, customersWithCriticalGaps, contracts,
  } = data

  const allPrimary = customers.filter(c => !c.is_family_member)

  // Distribution by lifecycle state
  const stateDist = {}
  allPrimary.forEach(c => {
    const state = lifecycleMap[c.id] || 'lead'
    stateDist[state] = (stateDist[state] || 0) + 1
  })

  // Customers with multiple policies (cross-sold)
  const crossSoldCount = activeCustomers.filter(c => {
    const cs = activeContracts.filter(x => x.customer_id === c.id || x.primary_customer_id === c.id)
    return cs.length >= 2
  }).length

  return (
    <div className="space-y-8">

      {/* KPIs */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Kunden-Portfolio</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <DashboardKpiTile label="Aktive Kunden" value={activeCustomers.length} sub="mit aktivem Vertrag" icon={Users} accent="border-l-emerald-500" onClick={() => navigate('/kunden')} />
          <DashboardKpiTile label="VIP Kunden" value={vipCustomers.length} sub="Prämie ≥ CHF 10'000/J" icon={Star} accent="border-l-yellow-500" onClick={() => navigate('/kunden')} />
          <DashboardKpiTile label="Krit. Deckungslücken" value={customersWithCriticalGaps.length} sub="sofort handeln" icon={AlertTriangle} accent="border-l-red-500" onClick={() => navigate('/coverage-intelligence')} />
          <DashboardKpiTile label="Cross-Selling" value={crossSoldCount} sub="Kunden mit 2+ Policen" icon={Shield} accent="border-l-blue-500" onClick={() => navigate('/kunden')} />
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
                    <div className={`flex items-center gap-1.5 mb-1`}>
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

      {/* Active Customer List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Aktive Kunden (Top 10)</h3>
          <Button size="sm" variant="outline" onClick={() => navigate('/kunden')}>Alle anzeigen</Button>
        </div>
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kunde</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Lifecycle</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Jahresprämie</th>
                  <th className="px-4 py-2.5 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {activeCustomers.slice(0, 10).map(customer => {
                  const customerContracts = activeContracts.filter(c => c.customer_id === customer.id || c.primary_customer_id === customer.id)
                  const premium = customerContracts.reduce((s, c) => s + (c.premium_yearly || (c.premium_monthly || 0) * 12), 0)
                  const state = lifecycleMap[customer.id] || 'active_customer'
                  const colors = LIFECYCLE_COLORS[state] || LIFECYCLE_COLORS['active_customer']
                  return (
                    <tr key={customer.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{customer.first_name} {customer.last_name}</p>
                        <p className="text-xs text-muted-foreground">{customer.city || ''}</p>
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
                          {LIFECYCLE_LABELS[state]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-sm">
                        {premium > 0 ? `CHF ${premium.toLocaleString('de-CH', { maximumFractionDigits: 0 })}` : '–'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => navigate(`/kunden/${customer.id}/360`)} className="text-muted-foreground hover:text-primary transition-colors">
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {activeCustomers.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">Keine aktiven Kunden</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

    </div>
  )
}