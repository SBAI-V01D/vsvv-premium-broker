/**
 * Customer360 — Die zentrale Kundenakte
 * Alles auf einen Blick. Keine versteckten Tabs. Maximale Geschwindigkeit.
 */
import React, { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { getSparteLabel } from '@/lib/insuranceSparten'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ArrowLeft, Phone, Mail, MapPin, Plus, FileText, TrendingUp,
  CheckCircle2, Clock, AlertCircle, Download, ChevronRight,
  RefreshCw, Target, Building2, CalendarClock, Star, Trophy,
  Zap, Shield
} from 'lucide-react'
import VerkaufschanceStatusBadge from '@/components/verkaufschance/VerkaufschanceStatusBadge'
import VerkaufschanceForm from '@/components/verkaufschance/VerkaufschanceForm'
import VerkaufschanceDetail from '@/components/verkaufschance/VerkaufschanceDetail'
import CrossSellingPanel from '@/components/verkaufschance/CrossSellingPanel'
import { format, parseISO, differenceInDays } from 'date-fns'

const NEXT_STEP = {
  neu: 'Gesellschaften anfragen',
  in_ausschreibung: 'Offerten abwarten',
  offerten_erhalten: 'Vergleich & Beratung',
  beratung_erfolgt: 'Entscheid abwarten',
  kunde_entscheidet: '🔥 Entscheid nachfassen',
  gewonnen: '✓ Vertrag erstellen',
  verloren: '–',
  wiedervorlage: 'Wiedervorlage prüfen',
}

export default function Customer360() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showVsForm, setShowVsForm] = useState(false)
  const [selectedVsId, setSelectedVsId] = useState(null)
  const [activeSection, setActiveSection] = useState('overview') // overview | verkaufschancen | vertraege | aufgaben | dokumente | crossselling

  // ── Data ─────────────────────────────────────────────────────────────────
  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => base44.entities.Customer.filter({ id: customerId }),
    select: d => d?.[0],
  })

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts', customerId],
    queryFn: () => base44.entities.Contract.list(),
    select: d => d.filter(c => c.customer_id === customerId || c.primary_customer_id === customerId),
  })

  const { data: verkaufschancen = [] } = useQuery({
    queryKey: ['verkaufschancen', customerId],
    queryFn: () => base44.entities.Verkaufschance.filter({ customer_id: customerId }),
  })

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', customerId],
    queryFn: () => base44.entities.Task.list(),
    select: d => d.filter(t => t.customer_id === customerId),
  })

  const { data: allDocuments = [] } = useQuery({
    queryKey: ['documents-all'],
    queryFn: () => base44.entities.Document.list(),
  })

  const documents = useMemo(() => {
    const contractIds = new Set(contracts.map(c => c.id))
    return allDocuments.filter(d =>
      d.customer_id === customerId ||
      d.primary_customer_id === customerId ||
      (d.linked_contract_id && contractIds.has(d.linked_contract_id))
    )
  }, [allDocuments, customerId, contracts])

  const createVsMutation = useMutation({
    mutationFn: d => base44.entities.Verkaufschance.create(d),
    onSuccess: result => {
      queryClient.invalidateQueries({ queryKey: ['verkaufschancen', customerId] })
      setShowVsForm(false)
      setSelectedVsId(result.id)
    },
  })

  // ── Metrics ──────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const active = contracts.filter(c => c.status === 'active')
    const totalPremium = active.reduce((s, c) => s + (c.premium_yearly || 0), 0)
    const today = new Date()
    const expiringSoon = active.filter(c => {
      if (!c.end_date) return false
      const d = differenceInDays(parseISO(c.end_date), today)
      return d >= 0 && d <= 90
    })
    const openVs = verkaufschancen.filter(v => !['gewonnen', 'verloren'].includes(v.status))
    const openTasks = tasks.filter(t => t.status !== 'completed')
    const overdueTasks = openTasks.filter(t => t.due_date && new Date(t.due_date) < today)
    return { active, totalPremium, expiringSoon, openVs, openTasks, overdueTasks }
  }, [contracts, verkaufschancen, tasks])

  const nextStep = useMemo(() => {
    // Priorisierter nächster Schritt für diesen Kunden
    if (metrics.overdueTasks.length > 0) return { type: 'task', text: `${metrics.overdueTasks.length} überfällige Aufgabe(n)`, color: 'text-red-600', urgent: true }
    const entscheidVs = metrics.openVs.find(v => v.status === 'kunde_entscheidet')
    if (entscheidVs) return { type: 'vs', text: `Entscheid nachfassen: ${entscheidVs.title || getSparteLabel(entscheidVs.sparte)}`, color: 'text-orange-600', urgent: true }
    const offertenVs = metrics.openVs.find(v => v.status === 'offerten_erhalten')
    if (offertenVs) return { type: 'vs', text: `Vergleich erstellen: ${offertenVs.title || getSparteLabel(offertenVs.sparte)}`, color: 'text-blue-600', urgent: false }
    if (metrics.expiringSoon.length > 0) return { type: 'contract', text: `${metrics.expiringSoon.length} Vertrag/Verträge ablaufend`, color: 'text-amber-600', urgent: false }
    if (metrics.openTasks.length > 0) return { type: 'task', text: `${metrics.openTasks.length} offene Aufgabe(n)`, color: 'text-amber-600', urgent: false }
    if (metrics.openVs.length > 0) return { type: 'vs', text: `${metrics.openVs.length} offene Verkaufschance(n)`, color: 'text-primary', urgent: false }
    return null
  }, [metrics])

  const selectedVs = selectedVsId ? verkaufschancen.find(v => v.id === selectedVsId) : null

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Lädt...</div>
  if (!customer) return <div className="p-6 text-muted-foreground">Kunde nicht gefunden</div>

  const SECTIONS = [
    { id: 'overview',        label: 'Übersicht',       badge: null },
    { id: 'verkaufschancen', label: 'Chancen',         badge: metrics.openVs.length || null },
    { id: 'crossselling',   label: 'Cross-Selling',    badge: null },
    { id: 'vertraege',      label: 'Verträge',         badge: metrics.active.length || null },
    { id: 'aufgaben',       label: 'Aufgaben',         badge: metrics.openTasks.length || null },
    { id: 'dokumente',      label: 'Dokumente',        badge: documents.length || null },
  ]

  return (
    <div className="space-y-0 pb-10">

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border pb-0">
        <div className="flex items-center gap-3 px-0 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/kunden')} className="flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>

          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary flex-shrink-0 text-sm">
            {customer.first_name?.[0]}{customer.last_name?.[0]}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold leading-tight truncate">{customer.first_name} {customer.last_name}</h1>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              {nextStep ? (
                <span className={cn('text-xs font-semibold flex items-center gap-1', nextStep.color)}>
                  {nextStep.urgent && '⚡ '}{nextStep.text}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Kein Handlungsbedarf</span>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-1.5 flex-shrink-0">
            {customer.phone && (
              <a href={`tel:${customer.phone}`} className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center hover:bg-green-200 transition-colors">
                <Phone className="w-3.5 h-3.5 text-green-700" />
              </a>
            )}
            {customer.email && (
              <a href={`mailto:${customer.email}`} className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center hover:bg-blue-200 transition-colors">
                <Mail className="w-3.5 h-3.5 text-blue-700" />
              </a>
            )}
            <Button size="sm" onClick={() => setShowVsForm(true)} className="gap-1 h-8 px-3 text-xs">
              <Plus className="w-3.5 h-3.5" /> Chance
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto gap-0 scrollbar-none border-t border-border">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors',
                activeSection === s.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {s.label}
              {s.badge != null && s.badge > 0 && (
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                  activeSection === s.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                )}>{s.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4 space-y-4">

        {/* ── OVERVIEW ──────────────────────────────────────────────────── */}
        {activeSection === 'overview' && (
          <div className="space-y-4">
            {/* KPI Streifen */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiTile label="Aktive Policen"  value={metrics.active.length}                color="text-primary" onClick={() => setActiveSection('vertraege')} />
              <KpiTile label="Jahresprämie"    value={`CHF ${Math.round(metrics.totalPremium).toLocaleString('de-CH')}`} color="text-emerald-600" onClick={() => setActiveSection('vertraege')} />
              <KpiTile label="Offene Chancen"  value={metrics.openVs.length}                color="text-blue-600" onClick={() => setActiveSection('verkaufschancen')} />
              <KpiTile label="Aufgaben offen"  value={metrics.openTasks.length}             color={metrics.overdueTasks.length > 0 ? 'text-red-600' : 'text-amber-600'} onClick={() => setActiveSection('aufgaben')} />
            </div>

            {/* Kontakt */}
            <Card>
              <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                {customer.email && (
                  <a href={`mailto:${customer.email}`} className="flex items-center gap-2 hover:text-primary">
                    <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{customer.email}</span>
                  </a>
                )}
                {customer.phone && (
                  <a href={`tel:${customer.phone}`} className="flex items-center gap-2 hover:text-primary">
                    <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span>{customer.phone}</span>
                  </a>
                )}
                {customer.city && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    <span>{customer.zip_code} {customer.city}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Aktive Verträge Kurzübersicht */}
            {metrics.active.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Aktive Policen</p>
                  <button onClick={() => setActiveSection('vertraege')} className="text-xs text-primary hover:underline">Alle →</button>
                </div>
                <div className="space-y-1.5">
                  {metrics.active.slice(0, 4).map(c => {
                    const today = new Date()
                    const daysLeft = c.end_date ? differenceInDays(parseISO(c.end_date), today) : null
                    return (
                      <div key={c.id} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm',
                        daysLeft !== null && daysLeft <= 30 ? 'bg-red-50 border-red-200' : 'bg-card border-border'
                      )}>
                        <Shield className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{c.insurer}</p>
                          <p className="text-xs text-muted-foreground">{getSparteLabel(c.sparte) || c.insurance_type || '–'}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-semibold text-emerald-700">CHF {(c.premium_yearly || 0).toLocaleString('de-CH')}</p>
                          {daysLeft !== null && daysLeft <= 30 && (
                            <p className="text-[10px] text-red-600 font-bold">Ablauf: {daysLeft}d</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Offene Verkaufschancen Kurzübersicht */}
            {metrics.openVs.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Verkaufschancen</p>
                  <button onClick={() => setActiveSection('verkaufschancen')} className="text-xs text-primary hover:underline">Alle →</button>
                </div>
                <div className="space-y-1.5">
                  {metrics.openVs.slice(0, 3).map(vs => (
                    <button
                      key={vs.id}
                      onClick={() => setSelectedVsId(vs.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all text-left"
                    >
                      <TrendingUp className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{vs.title || getSparteLabel(vs.sparte)}</p>
                        <p className="text-xs text-primary font-medium truncate">→ {NEXT_STEP[vs.status] || '–'}</p>
                      </div>
                      <VerkaufschanceStatusBadge status={vs.status} size="xs" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Offene Aufgaben Kurzübersicht */}
            {metrics.openTasks.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Offene Aufgaben</p>
                  <button onClick={() => setActiveSection('aufgaben')} className="text-xs text-primary hover:underline">Alle →</button>
                </div>
                <div className="space-y-1.5">
                  {metrics.openTasks.slice(0, 3).map(t => {
                    const overdue = t.due_date && new Date(t.due_date) < new Date()
                    return (
                      <div key={t.id} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm',
                        overdue ? 'bg-red-50 border-red-200' : 'bg-card border-border'
                      )}>
                        <Clock className={cn('w-4 h-4 flex-shrink-0', overdue ? 'text-red-500' : 'text-amber-500')} />
                        <div className="flex-1 min-w-0">
                          <p className={cn('font-semibold truncate', overdue ? 'text-red-800' : '')}>{t.title}</p>
                          {t.due_date && <p className="text-xs text-muted-foreground">{new Date(t.due_date).toLocaleDateString('de-CH')}</p>}
                        </div>
                        {overdue && <span className="text-[10px] font-bold text-red-600 flex-shrink-0">ÜBERFÄLLIG</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── VERKAUFSCHANCEN ──────────────────────────────────────────── */}
        {activeSection === 'verkaufschancen' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">{verkaufschancen.length} Verkaufschance(n)</p>
              <Button size="sm" onClick={() => setShowVsForm(true)} className="gap-1.5 h-8">
                <Plus className="w-3.5 h-3.5" /> Neue Chance
              </Button>
            </div>
            {verkaufschancen.length === 0 ? (
              <EmptyState icon={TrendingUp} text="Keine Verkaufschancen" action="Erste Chance erfassen" onAction={() => setShowVsForm(true)} />
            ) : (
              <div className="space-y-2">
                {verkaufschancen.map(vs => {
                  const ges = vs.gesellschaften || []
                  const offerten = ges.filter(g => g.praemie_yearly).length
                  const best = offerten > 0 ? Math.min(...ges.filter(g => g.praemie_yearly).map(g => g.praemie_yearly)) : null
                  return (
                    <button
                      key={vs.id}
                      onClick={() => setSelectedVsId(vs.id)}
                      className={cn('w-full flex items-start gap-3 px-4 py-3.5 rounded-xl border text-left hover:shadow-md transition-all',
                        vs.status === 'gewonnen' ? 'border-green-200 bg-green-50/40' :
                        vs.status === 'verloren' ? 'border-border bg-muted/30 opacity-70' :
                        vs.status === 'kunde_entscheidet' ? 'border-orange-300 bg-orange-50/40' :
                        'border-border bg-card'
                      )}
                    >
                      <div className={cn('w-1.5 h-12 rounded-full flex-shrink-0 mt-0.5',
                        vs.status === 'gewonnen' ? 'bg-green-500' :
                        vs.status === 'kunde_entscheidet' ? 'bg-orange-500' :
                        vs.status === 'offerten_erhalten' ? 'bg-violet-500' :
                        vs.status === 'in_ausschreibung' ? 'bg-blue-500' : 'bg-slate-300'
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-sm truncate">{vs.title || getSparteLabel(vs.sparte)}</p>
                          <VerkaufschanceStatusBadge status={vs.status} size="xs" />
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">{getSparteLabel(vs.sparte)}</p>
                        {ges.length > 0 && (
                          <div className="flex gap-1 flex-wrap mb-1">
                            {ges.slice(0, 4).map(g => (
                              <span key={g.id} className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium',
                                g.status === 'ausgewaehlt' ? 'bg-green-100 text-green-700 border-green-200' :
                                g.status === 'offerte_erhalten' ? 'bg-violet-100 text-violet-700 border-violet-200' :
                                'bg-slate-100 text-slate-600 border-slate-200'
                              )}>
                                {g.gesellschaft}{g.praemie_yearly ? ` CHF ${g.praemie_yearly.toLocaleString('de-CH')}` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-primary font-medium">→ {NEXT_STEP[vs.status] || '–'}</p>
                      </div>
                      {vs.estimated_value > 0 && (
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-bold text-emerald-700">CHF {vs.estimated_value.toLocaleString('de-CH')}</p>
                          <p className="text-[10px] text-muted-foreground">/Jahr</p>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── CROSS-SELLING ────────────────────────────────────────────── */}
        {activeSection === 'crossselling' && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-bold">Cross-Selling & Beratungspotenziale</p>
              <p className="text-xs text-muted-foreground mt-0.5">Automatisch erkannte Lücken und Optimierungspotenziale</p>
            </div>
            <CrossSellingPanel customer={customer} contracts={contracts} verkaufschancen={verkaufschancen} />
          </div>
        )}

        {/* ── VERTRÄGE ─────────────────────────────────────────────────── */}
        {activeSection === 'vertraege' && (
          <div className="space-y-2">
            {contracts.length === 0 ? (
              <EmptyState icon={Shield} text="Keine Verträge" />
            ) : contracts.map((c, idx) => {
              const today = new Date()
              const daysLeft = c.end_date ? differenceInDays(parseISO(c.end_date), today) : null
              const isCritical = daysLeft !== null && daysLeft <= 30 && daysLeft >= 0
              return (
                <Card key={c.id} className={cn('border-l-4', isCritical ? 'border-l-red-500' : c.status === 'active' ? 'border-l-green-500' : 'border-l-slate-300')}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-bold text-sm">{c.insurer}</p>
                          <Badge variant="outline" className="text-xs">{getSparteLabel(c.sparte) || c.insurance_type || '–'}</Badge>
                          {c.policy_number && <span className="text-xs text-muted-foreground">{c.policy_number}</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs mt-2">
                          <div>
                            <p className="text-muted-foreground">Prämie/Jahr</p>
                            <p className="font-semibold text-emerald-700">CHF {(c.premium_yearly || 0).toLocaleString('de-CH')}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Gültig bis</p>
                            <p className={cn('font-semibold', isCritical ? 'text-red-600' : '')}>
                              {c.end_date ? new Date(c.end_date).toLocaleDateString('de-CH') : '–'}
                              {isCritical && ` (${daysLeft}d)`}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className={cn('text-[10px] px-2 py-1 rounded-full font-bold',
                          c.status === 'active' ? 'bg-green-100 text-green-700' :
                          c.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-600'
                        )}>
                          {c.status === 'active' ? 'Aktiv' : c.status === 'cancelled' ? 'Gekündigt' : c.status}
                        </span>
                        {isCritical && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-red-200 text-red-700 hover:bg-red-50"
                            onClick={() => { setActiveSection('verkaufschancen'); setShowVsForm(true) }}
                          >
                            <Plus className="w-3 h-3 mr-1" /> Ausschreibung
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* ── AUFGABEN ─────────────────────────────────────────────────── */}
        {activeSection === 'aufgaben' && (
          <div className="space-y-2">
            {tasks.length === 0 ? (
              <EmptyState icon={CheckCircle2} text="Keine Aufgaben" />
            ) : (
              tasks.map(t => {
                const overdue = t.status !== 'completed' && t.due_date && new Date(t.due_date) < new Date()
                return (
                  <Card key={t.id} className={cn('border-l-4', t.status === 'completed' ? 'border-l-green-500 opacity-60' : overdue ? 'border-l-red-500' : 'border-l-amber-400')}>
                    <CardContent className="p-3 flex items-center gap-3">
                      {t.status === 'completed'
                        ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                        : <Clock className={cn('w-4 h-4 flex-shrink-0', overdue ? 'text-red-500' : 'text-amber-500')} />
                      }
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm font-medium', t.status === 'completed' ? 'line-through text-muted-foreground' : '')}>{t.title}</p>
                        {t.due_date && <p className={cn('text-xs mt-0.5', overdue ? 'text-red-500 font-semibold' : 'text-muted-foreground')}>
                          {overdue ? '⚠ Überfällig: ' : 'Fällig: '}{new Date(t.due_date).toLocaleDateString('de-CH')}
                        </p>}
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        )}

        {/* ── DOKUMENTE ───────────────────────────────────────────────── */}
        {activeSection === 'dokumente' && (
          <div className="space-y-2">
            {documents.length === 0 ? (
              <EmptyState icon={FileText} text="Keine Dokumente" />
            ) : documents.map(doc => (
              <Card key={doc.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">{doc.category}</p>
                  </div>
                  {doc.file_url && (
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      </div>

      {/* ── Neue Verkaufschance Dialog ──────────────────────────────────── */}
      <Dialog open={showVsForm} onOpenChange={setShowVsForm}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Neue Verkaufschance für {customer.first_name} {customer.last_name}</DialogTitle>
          </DialogHeader>
          <VerkaufschanceForm
            customer={customer}
            onSave={d => createVsMutation.mutate(d)}
            onCancel={() => setShowVsForm(false)}
            saving={createVsMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* ── Verkaufschance Detail Dialog ─────────────────────────────────── */}
      {selectedVs && (
        <Dialog open={!!selectedVs} onOpenChange={o => { if (!o) setSelectedVsId(null) }}>
          <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-0">
            <DialogHeader className="sr-only"><DialogTitle>Verkaufschance</DialogTitle></DialogHeader>
            <VerkaufschanceDetail
              verkaufschance={selectedVs}
              customer={customer}
              onClose={() => setSelectedVsId(null)}
              onUpdated={() => queryClient.invalidateQueries({ queryKey: ['verkaufschancen', customerId] })}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function KpiTile({ label, value, color, onClick }) {
  return (
    <button onClick={onClick} className="p-3 bg-card border border-border rounded-xl text-left hover:shadow-sm hover:border-primary/30 transition-all">
      <p className={cn('text-2xl font-black leading-none', color)}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </button>
  )
}

function EmptyState({ icon: Icon, text, action, onAction }) {
  return (
    <div className="py-12 text-center rounded-xl border-2 border-dashed border-border">
      <Icon className="w-8 h-8 mx-auto mb-2 opacity-20" />
      <p className="text-sm text-muted-foreground">{text}</p>
      {action && onAction && (
        <Button size="sm" variant="outline" className="mt-3" onClick={onAction}>
          <Plus className="w-3.5 h-3.5 mr-1" /> {action}
        </Button>
      )}
    </div>
  )
}