import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { base44 } from '@/api/base44Client'
import { Card, CardContent } from '@/components/ui/card'
import { getSparteLabel } from '@/lib/insuranceSparten'
import VerkaufschanceStatusBadge from '@/components/verkaufschance/VerkaufschanceStatusBadge'
import { Target, ArrowRight, Building2, TrendingUp, Trophy, BarChart3, RefreshCw, CalendarClock, Wallet, Star, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isToday, isBefore, parseISO } from 'date-fns'

const COMMISSION_RATE = 0.05
const NEXT_STEP = {
  neu: 'Gesellschaften anfragen',
  in_ausschreibung: 'Offerten abwarten',
  offerten_erhalten: 'Vergleich erstellen',
  beratung_erfolgt: 'Beratung dokumentieren',
  kunde_entscheidet: 'Entscheid nachfassen',
  gewonnen: 'Vertrag erstellen',
  verloren: '–',
  wiedervorlage: 'Wiedervorlage prüfen',
}

function KpiTile({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-none truncate">{value}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{label}</p>
        {sub && <p className="text-[10px] text-emerald-700 font-medium mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  )
}

export default function VerkaufschancenWidget() {
  const navigate = useNavigate()

  const { data: verkaufschancen = [] } = useQuery({
    queryKey: ['verkaufschancen'],
    queryFn: () => base44.entities.Verkaufschance.list('-created_date'),
  })

  const metrics = useMemo(() => {
    const today = new Date()
    const offen = verkaufschancen.filter(v => !['gewonnen', 'verloren'].includes(v.status))
    const gewonnen = verkaufschancen.filter(v => v.status === 'gewonnen').length
    const verloren = verkaufschancen.filter(v => v.status === 'verloren').length
    const total = verkaufschancen.length
    const winRate = (gewonnen + verloren) > 0 ? Math.round((gewonnen / (gewonnen + verloren)) * 100) : 0
    const pipelineWert = offen.reduce((s, v) => s + (v.estimated_value || 0), 0)
    const estimatedCourtage = Math.round(pipelineWert * COMMISSION_RATE)
    const inAusschreibung = offen.filter(v => v.status === 'in_ausschreibung').length
    const wiedervorlagen = verkaufschancen.filter(v => {
      if (!v.wiedervorlage_date) return false
      try {
        const d = parseISO(v.wiedervorlage_date)
        return (isToday(d) || isBefore(d, today)) && !['gewonnen', 'verloren'].includes(v.status)
      } catch { return false }
    }).length

    const topOpps = [...offen]
      .filter(v => v.estimated_value)
      .sort((a, b) => b.estimated_value - a.estimated_value)
      .slice(0, 3)

    const topOffene = offen.slice(0, 6)

    return { offen: offen.length, gewonnen, verloren, total, winRate, pipelineWert, estimatedCourtage, inAusschreibung, wiedervorlagen, topOpps, topOffene }
  }, [verkaufschancen])

  return (
    <div className="space-y-4">

      {/* ── Wiedervorlage Alert ──────────────────────────────────────────── */}
      {metrics.wiedervorlagen > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
          <p className="text-xs font-semibold text-orange-800">
            {metrics.wiedervorlagen} Wiedervorlage(n) heute/überfällig
          </p>
          <button onClick={() => navigate('/verkaufschancen')} className="ml-auto text-xs text-orange-700 underline">
            Öffnen
          </button>
        </div>
      )}

      {/* ── KPI Grid: 6 Kacheln ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <KpiTile icon={Target}       label="Offene Chancen"    value={metrics.offen}           color="text-blue-600 bg-blue-50" />
        <KpiTile icon={TrendingUp}   label="Verkaufsvolumen"   value={`CHF ${(metrics.pipelineWert/1000).toFixed(0)}k`}  color="text-emerald-600 bg-emerald-50" sub="/Jahr Pipeline" />
        <KpiTile icon={Wallet}       label="Est. Courtage"     value={`CHF ${metrics.estimatedCourtage.toLocaleString('de-CH')}`} color="text-violet-600 bg-violet-50" sub="~5% der Pipeline" />
        <KpiTile icon={Trophy}       label="Gewonnen"          value={metrics.gewonnen}         color="text-green-600 bg-green-50" sub={`${metrics.winRate}% Win Rate`} />
        <KpiTile icon={RefreshCw}    label="In Ausschreibung"  value={metrics.inAusschreibung}  color="text-amber-600 bg-amber-50" />
        <KpiTile icon={CalendarClock} label="Wiedervorlagen"   value={metrics.wiedervorlagen}   color={metrics.wiedervorlagen > 0 ? 'text-orange-600 bg-orange-50' : 'text-muted-foreground bg-muted'} />
      </div>

      {/* ── Top Opportunities ────────────────────────────────────────────── */}
      {metrics.topOpps.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
            <Star className="w-3 h-3 text-amber-500" /> Top Opportunities
          </p>
          <div className="flex flex-wrap gap-2">
            {metrics.topOpps.map(v => (
              <button
                key={v.id}
                onClick={() => navigate('/verkaufschancen')}
                className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg hover:border-primary/40 hover:shadow-sm transition-all text-xs"
              >
                <span className="font-semibold truncate max-w-[100px]">{v.customer_name}</span>
                <span className="text-emerald-700 font-bold">CHF {v.estimated_value.toLocaleString('de-CH')}</span>
                <VerkaufschanceStatusBadge status={v.status} size="xs" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Liste offener Chancen ─────────────────────────────────────────── */}
      {metrics.topOffene.length === 0 ? (
        <div className="py-6 text-center text-muted-foreground text-sm">
          <Target className="w-6 h-6 mx-auto mb-1.5 opacity-30" />
          Keine offenen Verkaufschancen
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="hidden md:grid grid-cols-[2fr_1.5fr_1fr_1fr_1.5fr] gap-2 px-4 py-2 border-b bg-muted/30 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              <div>Kunde / Sparte</div>
              <div>Status</div>
              <div>Ges.</div>
              <div>Volumen/J.</div>
              <div>Nächster Schritt</div>
            </div>
            {metrics.topOffene.map((v, idx) => (
              <div
                key={v.id}
                className={cn(
                  'grid grid-cols-1 md:grid-cols-[2fr_1.5fr_1fr_1fr_1.5fr] gap-2 px-4 py-2.5 items-center cursor-pointer hover:bg-muted/30 transition-colors',
                  idx > 0 && 'border-t border-border'
                )}
                onClick={() => navigate('/verkaufschancen')}
              >
                <div className="min-w-0">
                  <p className="font-semibold text-xs truncate">{v.customer_name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{getSparteLabel(v.sparte) || v.sparte}</p>
                </div>
                <div><VerkaufschanceStatusBadge status={v.status} size="xs" /></div>
                <div>
                  <div className="flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{(v.gesellschaften || []).length}</span>
                  </div>
                </div>
                <div>
                  {v.estimated_value
                    ? <span className="text-xs font-semibold text-emerald-700">CHF {v.estimated_value.toLocaleString('de-CH')}</span>
                    : <span className="text-xs text-muted-foreground">–</span>}
                </div>
                <div>
                  <p className="text-xs text-primary font-medium truncate">→ {NEXT_STEP[v.status] || '–'}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <button onClick={() => navigate('/verkaufschancen')} className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
        <ArrowRight className="w-3 h-3" />
        {metrics.offen > 6 ? `+${metrics.offen - 6} weitere · ` : ''}Alle Verkaufschancen öffnen
      </button>
    </div>
  )
}