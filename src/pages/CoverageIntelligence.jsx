import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Shield, TrendingUp, AlertTriangle, ArrowRight, CheckCircle2, XCircle, Home, Car, Heart, Briefcase, Scale, Umbrella } from 'lucide-react'
import { getSparteLabel } from '@/lib/insuranceSparten'

// Coverage categories to check per customer
const COVERAGE_CATEGORIES = [
  { key: 'kvg',                label: 'Krankenversicherung KVG',    icon: Heart,      required: true },
  { key: 'vvg_zusatz',         label: 'Zusatzversicherung VVG',     icon: Heart,      required: false },
  { key: 'haftpflicht_privat', label: 'Privathaftpflicht',          icon: Shield,     required: true },
  { key: 'hausrat',            label: 'Hausrat',                    icon: Home,       required: false },
  { key: 'motorfahrzeug',      label: 'Motorfahrzeug',              icon: Car,        required: false },
  { key: 'rechtsschutz_privat',label: 'Rechtsschutz',               icon: Scale,      required: false },
  { key: 'unfall_privat',      label: 'Unfall Privat',              icon: Umbrella,   required: false },
  { key: 'leben_3a',           label: 'Säule 3a',                   icon: TrendingUp, required: false },
  { key: 'bvg',                label: 'BVG / Pensionskasse',        icon: Briefcase,  required: false },
]

function CoverageGapBadge({ hasCoverage, required }) {
  if (hasCoverage) return <CheckCircle2 className="w-4 h-4 text-green-500" />
  if (required) return <XCircle className="w-4 h-4 text-red-500" />
  return <AlertTriangle className="w-4 h-4 text-amber-400" />
}

export default function CoverageIntelligence() {
  const navigate = useNavigate()

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  })

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list(),
  })

  // Only active customers (have at least one active contract)
  const activeCustomerIds = useMemo(() => {
    return new Set(contracts.filter(c => c.status === 'active').map(c => c.customer_id).filter(Boolean))
  }, [contracts])

  const activeCustomers = useMemo(() =>
    customers.filter(c => !c.is_family_member && activeCustomerIds.has(c.id)),
    [customers, activeCustomerIds]
  )

  // Build coverage map per customer
  const customerCoverage = useMemo(() => {
    return activeCustomers.map(customer => {
      const customerContracts = contracts.filter(c =>
        c.status === 'active' && (c.customer_id === customer.id || c.primary_customer_id === customer.id)
      )
      const coveredSparten = new Set(customerContracts.map(c => c.sparte || c.insurance_type).filter(Boolean))

      const gaps = COVERAGE_CATEGORIES.filter(cat => !coveredSparten.has(cat.key))
      const criticalGaps = gaps.filter(g => g.required)
      const upsellOpps = gaps.filter(g => !g.required)

      const totalPremium = customerContracts.reduce((s, c) => s + (c.premium_yearly || (c.premium_monthly || 0) * 12), 0)

      return { customer, customerContracts, coveredSparten, gaps, criticalGaps, upsellOpps, totalPremium }
    })
  }, [activeCustomers, contracts])

  // Summary KPIs
  const kpis = useMemo(() => {
    const withGaps = customerCoverage.filter(c => c.gaps.length > 0).length
    const withCritical = customerCoverage.filter(c => c.criticalGaps.length > 0).length
    const totalUpsell = customerCoverage.reduce((s, c) => s + c.upsellOpps.length, 0)
    const totalPremium = customerCoverage.reduce((s, c) => s + c.totalPremium, 0)
    return { withGaps, withCritical, totalUpsell, totalPremium }
  }, [customerCoverage])

  // Sort: most gaps first
  const sorted = useMemo(() =>
    [...customerCoverage].sort((a, b) => b.criticalGaps.length - a.criticalGaps.length || b.upsellOpps.length - a.upsellOpps.length),
    [customerCoverage]
  )

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Coverage & Upselling Intelligence</h1>
        <p className="text-sm text-muted-foreground mt-1">Analyse von Deckungslücken und Upselling-Potenzial – nur für aktive Kunden</p>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Aktive Kunden analysiert', value: activeCustomers.length, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
          { label: 'Kunden mit Deckungslücken', value: kpis.withGaps, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
          { label: 'Kritische Lücken (Pflicht)', value: kpis.withCritical, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
          { label: 'Upselling-Opportunitäten', value: kpis.totalUpsell, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
        ].map(k => (
          <Card key={k.label} className={`border ${k.border} ${k.bg} shadow-sm`}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">{k.label}</p>
              <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* COVERAGE TABLE */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Deckungsanalyse pro Kunde</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold uppercase tracking-wide text-muted-foreground">Kunde</th>
                  {COVERAGE_CATEGORIES.map(cat => (
                    <th key={cat.key} className="px-2 py-3 text-center font-semibold text-muted-foreground" title={cat.label}>
                      <cat.icon className="w-3.5 h-3.5 mx-auto" />
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-muted-foreground">Jahresprämie</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-muted-foreground">Potenzial</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr><td colSpan={COVERAGE_CATEGORIES.length + 4} className="text-center py-12 text-muted-foreground">Keine aktiven Kunden gefunden</td></tr>
                ) : sorted.map(({ customer, coveredSparten, gaps, criticalGaps, upsellOpps, totalPremium }) => (
                  <tr key={customer.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{customer.first_name} {customer.last_name}</p>
                      <p className="text-muted-foreground">{customer.city || ''}</p>
                    </td>
                    {COVERAGE_CATEGORIES.map(cat => (
                      <td key={cat.key} className="px-2 py-3 text-center">
                        <CoverageGapBadge hasCoverage={coveredSparten.has(cat.key)} required={cat.required} />
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-medium">
                      {totalPremium > 0 ? `CHF ${totalPremium.toLocaleString('de-CH', { maximumFractionDigits: 0 })}` : '–'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {criticalGaps.length > 0 && (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold mr-1">
                          {criticalGaps.length} kritisch
                        </span>
                      )}
                      {upsellOpps.length > 0 && (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">
                          +{upsellOpps.length} möglich
                        </span>
                      )}
                      {gaps.length === 0 && (
                        <span className="text-green-600 font-medium">✓ Vollständig</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs"
                        onClick={() => navigate(`/kunden/${customer.id}/360`)}>
                        360° <ArrowRight className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* LEGEND */}
          <div className="px-4 py-3 border-t bg-muted/20 flex items-center gap-6 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Gedeckt</span>
            <span className="flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5 text-red-500" /> Pflicht-Lücke</span>
            <span className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Upselling-Potenzial</span>
            <span className="ml-auto">Spalten: {COVERAGE_CATEGORIES.map(c => c.label).join(' · ')}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}