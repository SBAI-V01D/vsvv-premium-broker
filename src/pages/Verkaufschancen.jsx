import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { base44 } from '@/api/base44Client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  Plus, Search, TrendingUp, Trophy, Target, BarChart3,
  Filter, CalendarClock, Wallet,
  ArrowRight, RefreshCw, Star, AlertTriangle, ChevronDown
} from 'lucide-react'
import VerkaufschanceStatusBadge, { ALLE_STATUS } from '@/components/verkaufschance/VerkaufschanceStatusBadge'
import VerkaufschanceDetail from '@/components/verkaufschance/VerkaufschanceDetail'
import VerkaufschanceForm from '@/components/verkaufschance/VerkaufschanceForm'
import { getSparteLabel } from '@/lib/insuranceSparten'
import { cn } from '@/lib/utils'
import { isWithinInterval, addDays, parseISO, isToday, isBefore } from 'date-fns'
import { de } from 'date-fns/locale'
import { format } from 'date-fns'
import EmptyState from '@/components/shared/EmptyState'

const COMMISSION_RATE = 0.05 // 5% default estimated courtage

export default function Verkaufschancen() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSparte, setFilterSparte] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newFormCustomer, setNewFormCustomer] = useState(null)
  const [showFilters, setShowFilters] = useState(false)

  const { data: verkaufschancen = [] } = useQuery({
    queryKey: ['verkaufschancen'],
    queryFn: () => base44.entities.Verkaufschance.list('-created_date'),
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Verkaufschance.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['verkaufschancen'] }),
  })

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Verkaufschance.create(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['verkaufschancen'] })
      setShowNewForm(false)
      setNewFormCustomer(null)
      setSelectedId(result.id)
    },
  })

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = verkaufschancen.length
    const offen = verkaufschancen.filter(v => !['gewonnen', 'verloren'].includes(v.status))
    const gewonnen = verkaufschancen.filter(v => v.status === 'gewonnen')
    const verloren = verkaufschancen.filter(v => v.status === 'verloren').length
    const inAusschreibung = verkaufschancen.filter(v => v.status === 'in_ausschreibung').length
    const winRate = (gewonnen.length + verloren) > 0 ? Math.round((gewonnen.length / (gewonnen.length + verloren)) * 100) : 0
    const pipelineWert = offen.reduce((s, v) => s + (v.estimated_value || 0), 0)
    const gewonnenWert = gewonnen.reduce((s, v) => s + (v.estimated_value || 0), 0)
    const estimatedCourtage = pipelineWert * COMMISSION_RATE
    const today = new Date()
    const wiedervorlagen = verkaufschancen.filter(v => {
      if (!v.wiedervorlage_date) return false
      try {
        const d = parseISO(v.wiedervorlage_date)
        return isToday(d) || (isBefore(d, today) && !['gewonnen', 'verloren'].includes(v.status))
      } catch { return false }
    })
    const topOpportunities = [...offen]
      .filter(v => v.estimated_value)
      .sort((a, b) => b.estimated_value - a.estimated_value)
      .slice(0, 5)

    return {
      total, offen: offen.length, gewonnen: gewonnen.length, verloren,
      winRate, pipelineWert, gewonnenWert, estimatedCourtage,
      inAusschreibung, wiedervorlagen: wiedervorlagen.length,
      topOpportunities, offenList: offen,
    }
  }, [verkaufschancen])

  // ── Filter ───────────────────────────────────────────────────────────────
  const sparten = useMemo(() => {
    const s = new Set(verkaufschancen.map(v => v.sparte).filter(Boolean))
    return Array.from(s)
  }, [verkaufschancen])

  const filtered = useMemo(() => verkaufschancen.filter(v => {
    const s = `${v.customer_name} ${v.title} ${v.sparte}`.toLowerCase()
    const matchSearch = !search.trim() || s.includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || v.status === filterStatus
    const matchSparte = filterSparte === 'all' || v.sparte === filterSparte
    return matchSearch && matchStatus && matchSparte
  }), [verkaufschancen, search, filterStatus, filterSparte])

  const selectedVs = selectedId ? verkaufschancen.find(v => v.id === selectedId) : null
  const selectedCustomer = selectedVs ? customers.find(c => c.id === selectedVs.customer_id) : null

  return (
    <div className="space-y-5 pb-10">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--primary))]">Verkaufschancen &amp; Ausschreibungen</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Pipeline · Offertmanagement · Abschluss — strikt getrennt von aktiven Policen</p>
        </div>
        <Button onClick={() => setShowNewForm(true)} className="gap-2 flex-shrink-0">
          <Plus className="w-4 h-4" /> Neue Chance
        </Button>
      </div>

      {/* ── KPI Row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={Target} label="Offene Chancen" value={kpis.offen} color="blue" />
        <KpiCard icon={TrendingUp} label="Pipeline-Wert" value={`CHF ${(kpis.pipelineWert / 1000).toFixed(0)}k`} color="emerald" sub="/Jahr" />
        <KpiCard icon={Wallet} label="Est. Courtage" value={`CHF ${Math.round(kpis.estimatedCourtage).toLocaleString('de-CH')}`} color="violet" sub="~5% der Pipeline" />
        <KpiCard icon={Trophy} label="Gewonnen" value={kpis.gewonnen} color="green" sub={`${kpis.winRate}% Win Rate`} />
        <KpiCard icon={RefreshCw} label="In Ausschreibung" value={kpis.inAusschreibung} color="amber" />
        <KpiCard
          icon={CalendarClock}
          label="Wiedervorlagen"
          value={kpis.wiedervorlagen}
          color={kpis.wiedervorlagen > 0 ? 'orange' : 'gray'}
          sub={kpis.wiedervorlagen > 0 ? 'heute/überfällig' : 'keine offen'}
        />
      </div>

      {/* ── Top Opportunities ───────────────────────────────────────────── */}
      {kpis.topOpportunities.length > 0 && (
        <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-emerald-600" />
            <p className="text-sm font-bold text-emerald-900">Top Opportunities</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {kpis.topOpportunities.map(v => (
              <button
                key={v.id}
                onClick={() => setSelectedId(v.id)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-emerald-200 rounded-lg hover:border-emerald-400 hover:shadow-sm transition-all text-xs"
              >
                <span className="font-semibold truncate max-w-[120px]">{v.customer_name}</span>
                <span className="text-emerald-700 font-bold">CHF {v.estimated_value.toLocaleString('de-CH')}</span>
                <VerkaufschanceStatusBadge status={v.status} size="xs" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Wiedervorlage Alert ──────────────────────────────────────────── */}
      {kpis.wiedervorlagen > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-orange-900">
            {kpis.wiedervorlagen} Wiedervorlage(n) heute oder überfällig — Kunden kontaktieren!
          </p>
          <button
            onClick={() => setFilterStatus('wiedervorlage')}
            className="ml-auto text-xs text-orange-700 font-medium underline hover:no-underline"
          >
            Anzeigen
          </button>
        </div>
      )}

      {/* ── Search + Filters ────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Suche (Kunde, Sparte...)" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>

        {/* Filters toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors',
            (filterStatus !== 'all' || filterSparte !== 'all')
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'border-border text-muted-foreground hover:bg-muted'
          )}
        >
          <Filter className="w-3.5 h-3.5" /> Filter
          {(filterStatus !== 'all' || filterSparte !== 'all') && <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold">!</span>}
        </button>
      </div>

      {/* ── Expanded Filters ────────────────────────────────────────────── */}
      {showFilters && (
        <div className="flex gap-3 flex-wrap p-3 bg-muted/40 rounded-lg border border-border">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="Alle Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              {ALLE_STATUS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterSparte} onValueChange={setFilterSparte}>
            <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="Alle Sparten" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Sparten</SelectItem>
              {sparten.map(s => <SelectItem key={s} value={s}>{getSparteLabel(s) || s}</SelectItem>)}
            </SelectContent>
          </Select>
          {(filterStatus !== 'all' || filterSparte !== 'all') && (
            <button onClick={() => { setFilterStatus('all'); setFilterSparte('all') }} className="text-xs text-muted-foreground hover:text-destructive underline">
              Filter zurücksetzen
            </button>
          )}
        </div>
      )}

      {/* ── List View ───────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-0">
            <div className="hidden md:grid grid-cols-[2fr_1.5fr_1.2fr_1fr_1fr_1.2fr_auto] gap-2 px-4 py-2.5 border-b bg-muted/40 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              <div>Kunde / Bezeichnung</div>
              <div>Sparte</div>
              <div>Status</div>
              <div>Gesellschaften</div>
              <div className="text-right">Volumen/J.</div>
              <div>Nächster Schritt</div>
              <div className="w-8"></div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                type="opportunities"
                title="Keine Verkaufschancen"
                description="Erfassen Sie Ihre erste Opportunity, um zu starten."
                action={
                  <Button size="sm" variant="outline" onClick={() => setShowNewForm(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Neue Chance
                  </Button>
                }
                size="lg"
              />
            ) : filtered.map((v, idx) => {
              const gesellschaften = v.gesellschaften || []
              const offerten = gesellschaften.filter(g => g.praemie_yearly).length
              const NEXT_STEP = {
                neu: '→ Gesellschaften anfragen',
                in_ausschreibung: '→ Offerten abwarten',
                offerten_erhalten: '→ Vergleich erstellen',
                beratung_erfolgt: '→ Beratung dokumentieren',
                kunde_entscheidet: '→ Entscheid nachfassen',
                gewonnen: '→ Vertrag erstellen',
                verloren: '–',
                wiedervorlage: '→ Wiedervorlage prüfen',
              }
              return (
                <div
                  key={v.id}
                  className={cn('grid grid-cols-1 md:grid-cols-[2fr_1.5fr_1.2fr_1fr_1fr_1.2fr_auto] gap-2 px-4 py-3 items-center cursor-pointer hover:bg-muted/30 transition-colors group',
                    idx > 0 && 'border-t border-border'
                  )}
                  onClick={() => setSelectedId(v.id)}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{v.customer_name || '–'}</p>
                    <p className="text-xs text-muted-foreground truncate">{v.title || '–'}</p>
                    {v.expected_close_date && (
                      <p className="text-[10px] text-muted-foreground">
                        Abschluss: {format(parseISO(v.expected_close_date), 'd.M.yyyy')}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm">{getSparteLabel(v.sparte) || v.sparte || '–'}</p>
                  </div>
                  <div>
                    <VerkaufschanceStatusBadge status={v.status} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {gesellschaften.length > 0
                        ? `${gesellschaften.length} angefragt${offerten > 0 ? `, ${offerten} Offerte(n)` : ''}`
                        : <span className="italic">Keine</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    {v.estimated_value
                      ? <span className="text-sm font-semibold text-emerald-700">CHF {v.estimated_value.toLocaleString('de-CH')}</span>
                      : <span className="text-sm text-muted-foreground">–</span>}
                  </div>
                  <div>
                    <p className="text-xs text-primary font-medium truncate">{NEXT_STEP[v.status] || '–'}</p>
                    {v.wiedervorlage_date && v.status === 'wiedervorlage' && (
                      <p className="text-[10px] text-orange-600 font-medium">
                        {format(parseISO(v.wiedervorlage_date), 'd.M.yyyy')}
                      </p>
                    )}
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => { e.stopPropagation(); if (confirm('Löschen?')) deleteMutation.mutate(v.id) }}
                      className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500"
                    >×</button>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

      {/* ── Detail Dialog ────────────────────────────────────────────────── */}
      <Dialog open={!!selectedVs} onOpenChange={(o) => { if (!o) setSelectedId(null) }}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Verkaufschance Detail</DialogTitle>
          </DialogHeader>
          {selectedVs && (
            <VerkaufschanceDetail
              verkaufschance={selectedVs}
              customer={selectedCustomer}
              onClose={() => setSelectedId(null)}
              onUpdated={() => queryClient.invalidateQueries({ queryKey: ['verkaufschancen'] })}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Neue Chance Dialog ───────────────────────────────────────────── */}
      <Dialog open={showNewForm} onOpenChange={(o) => { if (!o) { setShowNewForm(false); setNewFormCustomer(null) } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Neue Verkaufschance erfassen</DialogTitle>
            <p className="text-xs text-muted-foreground">Wird NICHT als Vertrag oder Police gespeichert — erst nach Auswahl einer Gewinnergesellschaft.</p>
          </DialogHeader>
          <VerkaufschanceForm
            customer={newFormCustomer}
            onSave={(data) => {
              createMutation.mutate(data)
              setNewFormCustomer(null)
            }}
            onCancel={() => { setShowNewForm(false); setNewFormCustomer(null) }}
            saving={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
const COLOR_MAP = {
  blue:   'text-blue-600 bg-blue-50',
  emerald:'text-emerald-600 bg-emerald-50',
  violet: 'text-violet-600 bg-violet-50',
  green:  'text-green-600 bg-green-50',
  amber:  'text-amber-600 bg-amber-50',
  orange: 'text-orange-600 bg-orange-50',
  gray:   'text-muted-foreground bg-muted',
}

function KpiCard({ icon: Icon, label, value, color, sub }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', COLOR_MAP[color] || COLOR_MAP.gray)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold leading-tight truncate">{value}</p>
          <p className="text-[10px] text-muted-foreground truncate">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}