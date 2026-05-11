import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ShieldCheck, Plus, AlertTriangle, TrendingUp, Calendar, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSparteLabel } from '@/lib/insuranceSparten'
import { differenceInDays, parseISO } from 'date-fns'

// Sparten die ein Privatkunde idealerweise haben sollte
const RECOMMENDED_PRIVATE = [
  { sparte: 'kvg', label: 'KVG – Grundversicherung', priority: 'critical' },
  { sparte: 'vvg_krankenzusatz', label: 'VVG Zusatz', priority: 'high' },
  { sparte: 'haftpflicht_privat', label: 'Haftpflicht Privat', priority: 'critical' },
  { sparte: 'hausrat', label: 'Hausrat', priority: 'high' },
  { sparte: 'rechtsschutz', label: 'Rechtsschutz', priority: 'medium' },
  { sparte: 'leben', label: 'Leben / Vorsorge', priority: 'medium' },
  { sparte: 'reise', label: 'Reise / Assistance', priority: 'low' },
]

const RECOMMENDED_BUSINESS = [
  { sparte: 'haftpflicht_privat', label: 'Betriebshaftpflicht', priority: 'critical' },
  { sparte: 'bvg', label: 'BVG – Berufliche Vorsorge', priority: 'critical' },
  { sparte: 'uvg', label: 'UVG / Unfall', priority: 'critical' },
  { sparte: 'ktg', label: 'KTG – Krankentaggeld', priority: 'high' },
  { sparte: 'cyber', label: 'Cyber', priority: 'medium' },
  { sparte: 'rechtsschutz', label: 'Rechtsschutz', priority: 'medium' },
]

const PRIORITY_CONFIG = {
  critical: { label: 'Kritisch', color: 'bg-red-100 text-red-700 border-red-200' },
  high:     { label: 'Empfohlen', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  medium:   { label: 'Sinnvoll', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  low:      { label: 'Optional', color: 'bg-slate-100 text-slate-600 border-slate-200' },
}

export default function CrossSellingPanel({ customer, contracts, verkaufschancen = [] }) {
  const navigate = useNavigate()

  const activeContracts = contracts.filter(c => c.status === 'active')
  const coveredSparten = new Set(activeContracts.map(c => c.sparte).filter(Boolean))
  const openVsSparten = new Set(verkaufschancen
    .filter(v => !['gewonnen', 'verloren'].includes(v.status))
    .map(v => v.sparte).filter(Boolean))

  const isBusiness = customer?.customer_type === 'business'
  const recommended = isBusiness ? RECOMMENDED_BUSINESS : RECOMMENDED_PRIVATE

  const gaps = useMemo(() => recommended.filter(r => !coveredSparten.has(r.sparte)), [coveredSparten, recommended])
  const inProgress = useMemo(() => gaps.filter(g => openVsSparten.has(g.sparte)), [gaps, openVsSparten])
  const missing = useMemo(() => gaps.filter(g => !openVsSparten.has(g.sparte)), [gaps, openVsSparten])

  // Optimierungspotenzial: Verträge die teurer als Benchmark
  const optimizationOpps = activeContracts.filter(c =>
    c.pricing_status === 'high' || (c.premium_benchmark && c.premium_yearly > c.premium_benchmark * 1.1)
  )

  // Ablaufende Verträge (Beratungsbedarf)
  const today = new Date()
  const expiringContracts = activeContracts.filter(c => {
    if (!c.end_date) return false
    const days = differenceInDays(parseISO(c.end_date), today)
    return days > 0 && days <= 120
  })

  if (gaps.length === 0 && optimizationOpps.length === 0 && expiringContracts.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50/30">
        <CardContent className="p-4 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800">Vollständig versichert</p>
            <p className="text-xs text-green-700">Keine kritischen Lücken oder Optimierungspotenziale erkannt.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">

      {/* ── Versicherungslücken ──────────────────────────────────────────── */}
      {missing.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <p className="text-sm font-semibold">Fehlende Produkte ({missing.length})</p>
            <span className="text-xs text-muted-foreground">— Beratungsbedarf erkannt</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {missing.map(gap => {
              const cfg = PRIORITY_CONFIG[gap.priority]
              return (
                <div key={gap.sparte} className={cn('flex items-center justify-between p-3 rounded-lg border', cfg.color)}>
                  <div>
                    <p className="text-xs font-semibold">{gap.label}</p>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-bold border', cfg.color)}>{cfg.label}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 flex-shrink-0"
                    onClick={() => navigate('/verkaufschancen')}
                  >
                    <Plus className="w-3 h-3" /> Chance
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── In Bearbeitung ───────────────────────────────────────────────── */}
      {inProgress.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <p className="text-sm font-semibold">In Pipeline ({inProgress.length})</p>
            <span className="text-xs text-muted-foreground">— Verkaufschance offen</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {inProgress.map(g => (
              <span key={g.sparte} className="text-xs px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full font-medium">
                ⏳ {g.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Optimierungspotenzial ────────────────────────────────────────── */}
      {optimizationOpps.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <p className="text-sm font-semibold">Preisoptimierung ({optimizationOpps.length})</p>
          </div>
          {optimizationOpps.map(c => (
            <div key={c.id} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div>
                <p className="text-xs font-semibold">{c.insurer} · {getSparteLabel(c.sparte) || c.sparte}</p>
                <p className="text-[10px] text-amber-800">
                  Prämie CHF {(c.premium_yearly || 0).toLocaleString('de-CH')}/J.
                  {c.premium_benchmark && ` · Benchmark CHF ${c.premium_benchmark.toLocaleString('de-CH')}`}
                </p>
              </div>
              <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-300 rounded-full font-bold">OPTIMIEREN</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Ablaufende Verträge (Beratungsbedarf) ───────────────────────── */}
      {expiringContracts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-red-500" />
            <p className="text-sm font-semibold">Beratungsbedarf – Ablaufende Verträge ({expiringContracts.length})</p>
          </div>
          {expiringContracts.map(c => {
            const days = differenceInDays(parseISO(c.end_date), today)
            return (
              <div key={c.id} className="flex items-center justify-between p-3 bg-red-50/60 border border-red-200 rounded-lg">
                <div>
                  <p className="text-xs font-semibold">{c.insurer} · {getSparteLabel(c.sparte) || c.sparte}</p>
                  <p className="text-[10px] text-red-700 font-medium">Ablauf in {days} Tagen</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 border-red-200 text-red-700 hover:bg-red-50 flex-shrink-0"
                  onClick={() => navigate('/verkaufschancen')}
                >
                  <Plus className="w-3 h-3" /> Ausschreibung
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}