import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Shield, TrendingUp, AlertTriangle, ArrowRight, CheckCircle2, XCircle,
  Home, Car, Heart, Briefcase, Scale, Umbrella, Search, Star, Filter
} from 'lucide-react'
import { analyzeCoverage, REQUIRED_COVERAGE, OPTIONAL_COVERAGE, LIFECYCLE_STATES, buildLifecycleMap } from '@/lib/lifecycle'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const ALL_CATS = [...REQUIRED_COVERAGE, ...OPTIONAL_COVERAGE]

const CAT_META = {
  kvg:                { label: 'KVG',          icon: Heart,      required: true,  desc: 'Grundversicherung (gesetzlich)' },
  vvg_zusatz:         { label: 'Zusatz VVG',   icon: Heart,      required: false, desc: 'Zusatzversicherung' },
  haftpflicht_privat: { label: 'Haftpflicht',  icon: Shield,     required: true,  desc: 'Privathaftpflicht (empfohlen)' },
  hausrat:            { label: 'Hausrat',       icon: Home,       required: false, desc: 'Hausratversicherung' },
  motorfahrzeug:      { label: 'Motorfahrzeug', icon: Car,        required: false, desc: 'Fahrzeugversicherung' },
  rechtsschutz_privat:{ label: 'Rechtsschutz', icon: Scale,      required: false, desc: 'Rechtsschutzversicherung' },
  unfall_privat:      { label: 'Unfall',        icon: Umbrella,   required: false, desc: 'Unfallversicherung Privat' },
  leben_3a:           { label: 'Säule 3a',      icon: TrendingUp, required: false, desc: 'Steueroptimierte Altersvorsorge' },
  bvg:                { label: 'BVG',           icon: Briefcase,  required: false, desc: 'Berufliche Vorsorge' },
}

export default function CoverageIntelligence() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filterGap, setFilterGap] = useState('all') // all | critical | upsell | complete

  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list() })
  const { data: contracts = [] } = useQuery({ queryKey: ['contracts'], queryFn: () => base44.entities.Contract.list() })
  const { data: leads = [] }     = useQuery({ queryKey: ['leads'],     queryFn: () => base44.entities.Lead.list() })

  const lifecycleMap = useMemo(() => buildLifecycleMap(customers, contracts, leads), [customers, contracts, leads])

  // Only active customers
  const activeCustomers = useMemo(() =>
    customers.filter(c => !c.is_family_member && (
      lifecycleMap[c.id] === LIFECYCLE_STATES.ACTIVE_CUSTOMER ||
      lifecycleMap[c.id] === LIFECYCLE_STATES.VIP_CUSTOMER ||
      lifecycleMap[c.id] === LIFECYCLE_STATES.RENEWAL
    )),
    [customers, lifecycleMap]
  )

  const analysis = useMemo(() => {
    return activeCustomers.map(customer => {
      const cc = contracts.filter(c => c.status === 'active' && (c.customer_id === customer.id || c.primary_customer_id === customer.id))
      const result = analyzeCoverage(customer, cc)
      const isVip = lifecycleMap[customer.id] === LIFECYCLE_STATES.VIP_CUSTOMER
      return { customer, ...result, isVip }
    }).sort((a, b) => b.criticalGaps.length - a.criticalGaps.length || b.upsellGaps.length - a.upsellGaps.length || b.totalPremium - a.totalPremium)
  }, [activeCustomers, contracts, lifecycleMap])

  // Summary KPIs
  const kpis = useMemo(() => ({
    total: analysis.length,
    withCritical: analysis.filter(a => a.criticalGaps.length > 0).length,
    withUpsell: analysis.filter(a => a.upsellGaps.length > 0).length,
    complete: analysis.filter(a => a.criticalGaps.length === 0 && a.upsellGaps.length === 0).length,
    totalUpsellCount: analysis.reduce((s, a) => s + a.upsellGaps.length, 0),
    totalPremiumBase: analysis.reduce((s, a) => s + a.totalPremium, 0),
    avgScore: analysis.length > 0 ? Math.round(analysis.reduce((s, a) => s + a.score, 0) / analysis.length) : 0,
  }), [analysis])

  // Filtered list
  const filtered = useMemo(() => {
    let result = analysis
    if (filterGap === 'critical') result = result.filter(a => a.criticalGaps.length > 0)
    else if (filterGap === 'upsell') result = result.filter(a => a.upsellGaps.length > 0)
    else if (filterGap === 'complete') result = result.filter(a => a.criticalGaps.length === 0 && a.upsellGaps.length === 0)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(a => `${a.customer.first_name} ${a.customer.last_name}`.toLowerCase().includes(q))
    }
    return result
  }, [analysis, filterGap, search])

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="border-b border-border pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Coverage & Upselling Intelligence</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Analytisches Deckungslücken-Cockpit · Nur aktive Kunden mit bestehenden Verträgen
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg border border-border">
            <Shield className="w-3.5 h-3.5" />
            <span>Ø Coverage Score</span>
            <span className={`font-bold text-sm ${kpis.avgScore >= 80 ? 'text-emerald-600' : kpis.avgScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
              {kpis.avgScore}%
            </span>
          </div>
        </div>
      </div>

      {/* KPI TILES */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Kunden analysiert',       value: kpis.total,           color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200',    desc: 'aktive Kunden' },
          { label: 'Kritische Deckungslücken', value: kpis.withCritical,    color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200',     desc: 'Pflichtdeckung fehlt' },
          { label: 'Upselling-Potenzial',      value: kpis.totalUpsellCount, color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200',   desc: 'optionale Lücken total' },
          { label: 'Vollständig optimiert',    value: kpis.complete,        color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', desc: 'keine Lücken' },
        ].map(k => (
          <Card key={k.label} className={`border-2 ${k.border} ${k.bg} shadow-sm`}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
              <p className={`text-3xl font-bold mt-1 ${k.color}`}>{k.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{k.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* CATEGORY LEGEND */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Deckungskategorien</p>
          <div className="flex flex-wrap gap-3">
            {ALL_CATS.map(cat => {
              const meta = CAT_META[cat]
              const Icon = meta.icon
              return (
                <div key={cat} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${meta.required ? 'bg-red-50 border-red-200 text-red-700' : 'bg-muted/50 border-border text-muted-foreground'}`}>
                  <Icon className="w-3 h-3" />
                  {meta.label}
                  {meta.required && <span className="text-red-400">*</span>}
                </div>
              )
            })}
            <span className="text-xs text-muted-foreground self-center">* Pflichtdeckung</span>
          </div>
        </CardContent>
      </Card>

      {/* FILTER BAR */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Kunde suchen..." className="pl-8 h-9 text-sm" />
        </div>
        <Select value={filterGap} onValueChange={setFilterGap}>
          <SelectTrigger className="w-48 h-9 text-sm">
            <Filter className="w-3.5 h-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kunden ({kpis.total})</SelectItem>
            <SelectItem value="critical">Kritische Lücken ({kpis.withCritical})</SelectItem>
            <SelectItem value="upsell">Upselling möglich ({kpis.withUpsell})</SelectItem>
            <SelectItem value="complete">Vollständig optimiert ({kpis.complete})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ANALYSIS TABLE */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm font-semibold">
            Deckungsanalyse — {filtered.length} Kunden
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b bg-muted/20">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold uppercase tracking-wide text-muted-foreground">Kunde</th>
                  {ALL_CATS.map(cat => {
                    const meta = CAT_META[cat]
                    const Icon = meta.icon
                    return (
                      <th key={cat} className="px-2 py-3 text-center text-muted-foreground" title={`${meta.label}${meta.required ? ' (Pflicht)' : ''}`}>
                        <Icon className={`w-3.5 h-3.5 mx-auto ${meta.required ? 'text-red-400' : 'text-slate-400'}`} />
                      </th>
                    )
                  })}
                  <th className="px-3 py-3 text-center font-semibold uppercase tracking-wide text-muted-foreground">Score</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-muted-foreground">Prämie</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="px-3 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={ALL_CATS.length + 5} className="text-center py-16 text-muted-foreground">
                      Keine Kunden in dieser Ansicht
                    </td>
                  </tr>
                ) : filtered.map(({ customer, covered, criticalGaps, upsellGaps, totalPremium, score, isVip }) => (
                  <tr key={customer.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isVip && <Star className="w-3 h-3 text-yellow-500 flex-shrink-0" />}
                        <div>
                          <p className="font-semibold">{customer.first_name} {customer.last_name}</p>
                          <p className="text-muted-foreground">{customer.city || ''}</p>
                        </div>
                      </div>
                    </td>
                    {ALL_CATS.map(cat => (
                      <td key={cat} className="px-2 py-3 text-center">
                        {covered.has(cat)
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
                          : REQUIRED_COVERAGE.includes(cat)
                            ? <XCircle className="w-3.5 h-3.5 text-red-500 mx-auto" />
                            : <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mx-auto" />
                        }
                      </td>
                    ))}
                    <td className="px-3 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`font-bold text-sm ${score >= 80 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                          {score}%
                        </span>
                        <div className="w-10 h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {totalPremium > 0 ? `CHF ${totalPremium.toLocaleString('de-CH', { maximumFractionDigits: 0 })}` : '–'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        {criticalGaps.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">{criticalGaps.length} kritisch</span>
                        )}
                        {upsellGaps.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">+{upsellGaps.length} möglich</span>
                        )}
                        {criticalGaps.length === 0 && upsellGaps.length === 0 && (
                          <span className="text-emerald-600 font-semibold">✓ Optimal</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => navigate(`/kunden/${customer.id}/360`)}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title="Kundendetail"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* FOOTER LEGEND */}
          <div className="px-4 py-2.5 border-t bg-muted/10 flex items-center gap-5 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Gedeckt</span>
            <span className="flex items-center gap-1.5"><XCircle className="w-3 h-3 text-red-500" /> Pflichtlücke (handeln!)</span>
            <span className="flex items-center gap-1.5"><AlertTriangle className="w-3 h-3 text-amber-400" /> Upselling-Potenzial</span>
            <span className="flex items-center gap-1.5"><Star className="w-3 h-3 text-yellow-500" /> VIP Kunde</span>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}