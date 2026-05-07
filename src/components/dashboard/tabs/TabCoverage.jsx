import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, AlertTriangle, TrendingUp, CheckCircle2, XCircle, ArrowRight, Heart, Home, Car, Scale, Umbrella, Briefcase, Users } from 'lucide-react'
import DashboardKpiTile from '../DashboardKpiTile'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { analyzeCoverage, REQUIRED_COVERAGE, OPTIONAL_COVERAGE } from '@/lib/lifecycle'

const CAT_ICONS = {
  kvg: Heart, vvg_zusatz: Heart, haftpflicht_privat: Shield,
  hausrat: Home, motorfahrzeug: Car, rechtsschutz_privat: Scale,
  unfall_privat: Umbrella, leben_3a: TrendingUp, bvg: Briefcase,
}
const CAT_LABELS = {
  kvg: 'KVG', vvg_zusatz: 'Zusatz VVG', haftpflicht_privat: 'Haftpflicht',
  hausrat: 'Hausrat', motorfahrzeug: 'Motorfahrzeug', rechtsschutz_privat: 'Rechtsschutz',
  unfall_privat: 'Unfall', leben_3a: 'Säule 3a', bvg: 'BVG',
}

const ALL_CATS = [...REQUIRED_COVERAGE, ...OPTIONAL_COVERAGE]

export default function TabCoverage({ data }) {
  const navigate = useNavigate()
  const { activeCustomers, contracts } = data

  const analysis = useMemo(() => {
    return activeCustomers.map(customer => {
      const cc = contracts.filter(c => c.status === 'active' && (c.customer_id === customer.id || c.primary_customer_id === customer.id))
      return { customer, ...analyzeCoverage(customer, cc) }
    }).sort((a, b) => b.criticalGaps.length - a.criticalGaps.length || b.upsellGaps.length - a.upsellGaps.length)
  }, [activeCustomers, contracts])

  const kpis = useMemo(() => ({
    totalAnalyzed: analysis.length,
    withCritical: analysis.filter(a => a.criticalGaps.length > 0).length,
    withUpsell: analysis.filter(a => a.upsellGaps.length > 0).length,
    fullyOptimized: analysis.filter(a => a.criticalGaps.length === 0 && a.upsellGaps.length === 0).length,
  }), [analysis])

  return (
    <div className="space-y-8">

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Coverage Intelligence KPIs</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <DashboardKpiTile label="Analysierte Kunden" value={kpis.totalAnalyzed} sub="aktive Kunden" icon={Users} accent="border-l-blue-500" onClick={() => navigate('/coverage-intelligence')} />
          <DashboardKpiTile label="Kritische Lücken" value={kpis.withCritical} sub="Pflichtdeckung fehlt" icon={AlertTriangle} accent="border-l-red-500" onClick={() => navigate('/coverage-intelligence')} />
          <DashboardKpiTile label="Upselling-Potenzial" value={kpis.withUpsell} sub="optionale Lücken" icon={TrendingUp} accent="border-l-amber-500" onClick={() => navigate('/coverage-intelligence')} />
          <DashboardKpiTile label="Vollständig optimiert" value={kpis.fullyOptimized} sub="keine Lücken" icon={CheckCircle2} accent="border-l-emerald-500" onClick={() => navigate('/coverage-intelligence')} />
        </div>
      </div>

      {/* Priority list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Handlungsbedarf (Top 10)</h3>
          <Button size="sm" variant="outline" onClick={() => navigate('/coverage-intelligence')}>Vollständige Analyse</Button>
        </div>
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b bg-muted/30">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">Kunde</th>
                    {ALL_CATS.map(cat => {
                      const Icon = CAT_ICONS[cat]
                      return (
                        <th key={cat} className="px-2 py-2.5 text-center text-muted-foreground" title={CAT_LABELS[cat]}>
                          <Icon className="w-3.5 h-3.5 mx-auto" />
                        </th>
                      )
                    })}
                    <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">Score</th>
                    <th className="px-4 py-2.5 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {analysis.slice(0, 10).map(({ customer, covered, criticalGaps, upsellGaps, score }) => (
                    <tr key={customer.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{customer.first_name} {customer.last_name}</p>
                        {criticalGaps.length > 0 && <p className="text-red-600 text-xs">⚠ {criticalGaps.length} Pflichtlücke{criticalGaps.length > 1 ? 'n' : ''}</p>}
                      </td>
                      {ALL_CATS.map(cat => (
                        <td key={cat} className="px-2 py-2.5 text-center">
                          {covered.has(cat)
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
                            : REQUIRED_COVERAGE.includes(cat)
                              ? <XCircle className="w-3.5 h-3.5 text-red-500 mx-auto" />
                              : <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mx-auto" />
                          }
                        </td>
                      ))}
                      <td className="px-4 py-2.5 text-right">
                        <span className={`font-bold text-sm ${score >= 80 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                          {score}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => navigate(`/kunden/${customer.id}/360`)} className="text-muted-foreground hover:text-primary">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {analysis.length === 0 && (
                    <tr><td colSpan={ALL_CATS.length + 3} className="px-4 py-8 text-center text-muted-foreground">Keine aktiven Kunden gefunden</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 border-t bg-muted/10 flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Gedeckt</span>
              <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500" /> Pflichtlücke</span>
              <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-400" /> Upselling möglich</span>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  )
}