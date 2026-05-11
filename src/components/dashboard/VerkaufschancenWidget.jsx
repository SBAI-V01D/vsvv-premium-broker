import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { base44 } from '@/api/base44Client'
import { Card, CardContent } from '@/components/ui/card'
import { getSparteLabel } from '@/lib/insuranceSparten'
import VerkaufschanceStatusBadge from '@/components/verkaufschance/VerkaufschanceStatusBadge'
import { Target, ArrowRight, Building2, TrendingUp, Trophy, BarChart3, RefreshCw, CalendarClock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isToday, parseISO } from 'date-fns'

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

function KpiTile({ icon: Icon, label, value, color, sub }) { // eslint-disable-line
  return (
    <div className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{label}</p>
        {sub && <p className="text-[10px] text-emerald-700 font-medium mt-0.5">{sub}</p>}
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

  const offene = verkaufschancen.filter(v => !['gewonnen', 'verloren'].includes(v.status))
  const gewonnen = verkaufschancen.filter(v => v.status === 'gewonnen').length
  const inAusschreibung = verkaufschancen.filter(v => v.status === 'in_ausschreibung').length
  const total = verkaufschancen.length
  const winRate = total > 0 ? Math.round((gewonnen / total) * 100) : 0
  const pipelineWert = offene.reduce((s, v) => s + (v.estimated_value || 0), 0)

  const today = new Date()
  const wiedervorlagenHeute = verkaufschancen.filter(v => {
    if (!v.wiedervorlage_date) return false
    try { return isToday(parseISO(v.wiedervorlage_date)) } catch { return false }
  }).length

  const topOffene = offene.slice(0, 5)

  return (
    <div className="space-y-3">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <KpiTile icon={Target}       label="Offene Chancen"       value={offene.length}        color="text-blue-600 bg-blue-50" />
        <KpiTile icon={Trophy}       label="Gewonnene Abschlüsse" value={gewonnen}              color="text-green-600 bg-green-50" />
        <KpiTile icon={BarChart3}    label="Abschlussquote"       value={`${winRate}%`}         color="text-violet-600 bg-violet-50" />
        <KpiTile icon={RefreshCw}    label="In Ausschreibung"     value={inAusschreibung}        color="text-amber-600 bg-amber-50" sub={pipelineWert > 0 ? `CHF ${pipelineWert.toLocaleString('de-CH')}` : undefined} />
        <KpiTile icon={CalendarClock} label="Wiedervorlagen heute" value={wiedervorlagenHeute}  color={wiedervorlagenHeute > 0 ? 'text-orange-600 bg-orange-50' : 'text-muted-foreground bg-muted'} />
      </div>

      {/* Liste offener Chancen */}
      {topOffene.length === 0 ? (
        <div className="py-6 text-center text-muted-foreground text-sm">
          <Target className="w-6 h-6 mx-auto mb-1.5 opacity-30" />
          Keine offenen Verkaufschancen
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="hidden md:grid grid-cols-[2fr_1.5fr_1fr_1fr_1.5fr_1.5fr] gap-2 px-4 py-2 border-b bg-muted/30 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              <div>Kunde / Sparte</div>
              <div>Status</div>
              <div>Gesellschaften</div>
              <div>Volumen/J.</div>
              <div>Nächster Schritt</div>
              <div>Verantwortlicher</div>
            </div>
            {topOffene.map((v, idx) => (
              <div
                key={v.id}
                className={cn(
                  'grid grid-cols-1 md:grid-cols-[2fr_1.5fr_1fr_1fr_1.5fr_1.5fr] gap-2 px-4 py-3 items-center cursor-pointer hover:bg-muted/30 transition-colors',
                  idx > 0 && 'border-t border-border'
                )}
                onClick={() => navigate('/verkaufschancen')}
              >
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{v.customer_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{getSparteLabel(v.sparte) || v.sparte}</p>
                </div>
                <div><VerkaufschanceStatusBadge status={v.status} size="xs" /></div>
                <div>
                  <div className="flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground">{(v.gesellschaften || []).length}</span>
                  </div>
                </div>
                <div>
                  {v.estimated_value
                    ? <span className="text-xs font-semibold text-emerald-700">CHF {v.estimated_value.toLocaleString('de-CH')}</span>
                    : <span className="text-xs text-muted-foreground">–</span>
                  }
                </div>
                <div>
                  <p className="text-xs text-primary font-medium truncate">→ {NEXT_STEP[v.status] || '–'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground truncate">{v.assigned_broker || '–'}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {offene.length > 5 && (
        <button onClick={() => navigate('/verkaufschancen')} className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
          <ArrowRight className="w-3 h-3" /> +{offene.length - 5} weitere Chancen anzeigen
        </button>
      )}
    </div>
  )
}