/**
 * Customer360 — Die zentrale Kundenakte
 * Policen gruppiert nach Person (Haushalt-Ansicht)
 */
import React, { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { getSparteLabel } from '@/lib/insuranceSparten'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StandardModal, KpiCard, EmptyState } from '@/components/shared'
import {
  ArrowLeft, Phone, Mail, MapPin, Plus, FileText, TrendingUp,
  CheckCircle2, Clock, Download, Shield, Pencil
} from 'lucide-react'
import VerkaufschanceStatusBadge from '@/components/verkaufschance/VerkaufschanceStatusBadge'
import VerkaufschanceForm from '@/components/verkaufschance/VerkaufschanceForm'
import VerkaufschanceDetail from '@/components/verkaufschance/VerkaufschanceDetail'
import CrossSellingPanel from '@/components/verkaufschance/CrossSellingPanel'
import { parseISO, differenceInDays } from 'date-fns'

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

const ROLE_LABEL = { spouse: 'Partner/in', child: 'Kind', parent: 'Elternteil', other: 'Mitglied' }

export default function Customer360() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showVsForm, setShowVsForm] = useState(false)
  const [selectedVsId, setSelectedVsId] = useState(null)
  const [activeSection, setActiveSection] = useState('overview')

  // ── Data ─────────────────────────────────────────────────────────────────
  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => base44.entities.Customer.filter({ id: customerId }),
    select: d => d?.[0],
  })

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts', customerId],
    queryFn: () => base44.entities.Contract.list(),
    select: d => d.filter(c => c.customer_id === customerId),
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

  const { data: familyMembers = [] } = useQuery({
    queryKey: ['family-members', customerId],
    queryFn: () => base44.entities.Customer.filter({ primary_customer_id: customerId }),
  })

  const { data: familyContracts = [] } = useQuery({
    queryKey: ['family-contracts', customerId],
    queryFn: async () => {
      const members = await base44.entities.Customer.filter({ primary_customer_id: customerId })
      if (!members.length) return []
      const all = await base44.entities.Contract.list()
      return all.filter(c => members.some(m => m.id === c.customer_id))
    },
    enabled: !!customerId,
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

  // ── Computed ──────────────────────────────────────────────────────────────
  const allHouseholdContracts = useMemo(() => [...contracts, ...familyContracts], [contracts, familyContracts])

  const contractsByPerson = useMemo(() => {
    if (!customer) return []
    const persons = [
      { ...customer, _role: 'primary' },
      ...familyMembers.map(m => ({ ...m, _role: m.family_role || 'other' })),
    ]
    return persons
      .map(person => ({
        person,
        contracts: allHouseholdContracts.filter(c => c.customer_id === person.id),
      }))
      .filter(g => g.contracts.length > 0)
  }, [customer, familyMembers, allHouseholdContracts])

  const metrics = useMemo(() => {
    const active = allHouseholdContracts.filter(c => c.status === 'active')
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
  }, [allHouseholdContracts, verkaufschancen, tasks])

  // Cross-sell gap detection (mirrors CrossSellingPanel logic)
  const crossSellGaps = useMemo(() => {
    if (!customer) return []
    const activeContracts = allHouseholdContracts.filter(c => c.status === 'active')
    const coveredSparten = new Set(activeContracts.map(c => c.sparte).filter(Boolean))
    const openVsSparten = new Set(verkaufschancen
      .filter(v => !['gewonnen', 'verloren'].includes(v.status))
      .map(v => v.sparte).filter(Boolean))
    const recommended = customer.customer_type === 'business'
      ? ['haftpflicht_privat', 'bvg', 'uvg', 'ktg', 'cyber', 'rechtsschutz']
      : ['kvg', 'vvg_krankenzusatz', 'haftpflicht_privat', 'hausrat', 'rechtsschutz', 'leben', 'reise']
    return recommended.filter(s => !coveredSparten.has(s) && !openVsSparten.has(s))
  }, [customer, allHouseholdContracts, verkaufschancen])

  const nextStep = useMemo(() => {
    if (metrics.overdueTasks.length > 0) return { text: `${metrics.overdueTasks.length} überfällige Aufgabe(n)`, color: 'text-red-600', urgent: true }
    const entscheidVs = metrics.openVs.find(v => v.status === 'kunde_entscheidet')
    if (entscheidVs) return { text: `Entscheid nachfassen: ${entscheidVs.title || getSparteLabel(entscheidVs.sparte)}`, color: 'text-orange-600', urgent: true }
    const offertenVs = metrics.openVs.find(v => v.status === 'offerten_erhalten')
    if (offertenVs) return { text: `Vergleich erstellen: ${offertenVs.title || getSparteLabel(offertenVs.sparte)}`, color: 'text-blue-600', urgent: false }
    if (metrics.expiringSoon.length > 0) return { text: `${metrics.expiringSoon.length} Vertrag/Verträge ablaufend`, color: 'text-amber-600', urgent: false }
    if (crossSellGaps.length > 0) return { text: `${crossSellGaps.length} Versicherungslücke(n) erkannt`, color: 'text-orange-600', urgent: false }
    if (metrics.openTasks.length > 0) return { text: `${metrics.openTasks.length} offene Aufgabe(n)`, color: 'text-amber-600', urgent: false }
    if (metrics.openVs.length > 0) return { text: `${metrics.openVs.length} offene Verkaufschance(n)`, color: 'text-primary', urgent: false }
    return null
  }, [metrics, crossSellGaps])

  const selectedVs = selectedVsId ? verkaufschancen.find(v => v.id === selectedVsId) : null

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Lädt...</div>
  if (!customer) return <div className="p-6 text-muted-foreground">Kunde nicht gefunden</div>

  const SECTIONS = [
    { id: 'overview',        label: 'Übersicht',     badge: null },
    { id: 'verkaufschancen', label: 'Chancen',       badge: metrics.openVs.length || null },
    { id: 'crossselling',   label: 'Cross-Selling',  badge: null },
    { id: 'vertraege',      label: 'Verträge',       badge: metrics.active.length || null },
    { id: 'aufgaben',       label: 'Aufgaben',       badge: metrics.openTasks.length || null },
    { id: 'dokumente',      label: 'Dokumente',      badge: documents.length || null },
  ]

  // ── Reusable contract card ────────────────────────────────────────────────
  const renderContractCard = (c, withAusschreibung = false) => {
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
            <div className="flex flex-col gap-1 items-end">
              <span className={cn('text-[10px] px-2 py-1 rounded-full font-bold',
                c.status === 'active' ? 'bg-green-100 text-green-700' :
                c.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                'bg-slate-100 text-slate-600'
              )}>
                {c.status === 'active' ? 'Aktiv' : c.status === 'cancelled' ? 'Gekündigt' : c.status}
              </span>
              {withAusschreibung && isCritical && (
                <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-700 hover:bg-red-50"
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
  }

  // ── Person section (used in overview + vertraege) ─────────────────────────
  const renderPersonGroup = ({ person, contracts: pContracts }, compact = false) => {
    const activeContracts = pContracts.filter(c => c.status === 'active')
    const premium = activeContracts.reduce((s, c) => s + (c.premium_yearly || 0), 0)
    const initials = (person.first_name?.[0] || '') + (person.last_name?.[0] || '')
    return (
      <div key={person.id}>
        <div className="flex items-center gap-2 mb-2">
          <div className={cn(
            'rounded-full flex items-center justify-center font-bold text-primary bg-primary/10 flex-shrink-0',
            compact ? 'w-5 h-5 text-[9px]' : 'w-6 h-6 text-[10px]'
          )}>
            {initials}
          </div>
          <span className={cn('font-bold', compact ? 'text-[11px]' : 'text-sm')}>{person.first_name} {person.last_name}</span>
          {person._role !== 'primary' && (
            <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
              {ROLE_LABEL[person._role] || 'Mitglied'}
            </span>
          )}
          <span className="ml-auto text-xs font-semibold text-emerald-700">
            {activeContracts.length} Polic{activeContracts.length === 1 ? 'e' : 'en'} · CHF {premium.toLocaleString('de-CH')}/J
          </span>
        </div>
        <div className={cn('space-y-1.5', !compact && 'ml-8')}>
          {compact ? (
            // compact: pill-style für Übersicht
            pContracts.filter(c => c.status === 'active').map(c => {
              const today = new Date()
              const daysLeft = c.end_date ? differenceInDays(parseISO(c.end_date), today) : null
              return (
                <div key={c.id} className={cn('flex items-center gap-3 px-3 py-2 rounded-lg border text-sm ml-7',
                  daysLeft !== null && daysLeft <= 30 ? 'bg-red-50 border-red-200' : 'bg-card border-border'
                )}>
                  <Shield className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[12px] truncate">{c.insurer}</p>
                    <p className="text-[10px] text-muted-foreground">{getSparteLabel(c.sparte) || c.insurance_type || '–'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold text-emerald-700">CHF {(c.premium_yearly || 0).toLocaleString('de-CH')}</p>
                    {daysLeft !== null && daysLeft <= 30 && (
                      <p className="text-[10px] text-red-600 font-bold">Ablauf: {daysLeft}d</p>
                    )}
                  </div>
                </div>
              )
            })
          ) : (
            pContracts.map(c => renderContractCard(c, true))
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-0 pb-10">

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border pb-0">
        <div className="flex items-center gap-3 px-0 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/kunden')} className="flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
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
              {familyMembers.length > 0 && (
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                  Haushalt: {familyMembers.length + 1} Personen
                </span>
              )}
            </div>
          </div>
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
            <Button size="sm" variant="outline" onClick={() => navigate(`/kunden/${customerId}`)} className="gap-1 h-8 px-3 text-xs">
              <Pencil className="w-3.5 h-3.5" /> Bearbeiten
            </Button>
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
              <KpiCard label="Aktive Policen" value={metrics.active.length} color="blue" onClick={() => setActiveSection('vertraege')} />
              <KpiCard label="Jahresprämie" value={`CHF ${Math.round(metrics.totalPremium).toLocaleString('de-CH')}`} color="green" onClick={() => setActiveSection('vertraege')} />
              <KpiCard label="Offene Chancen" value={metrics.openVs.length} color="blue" onClick={() => setActiveSection('verkaufschancen')} />
              <KpiCard label="Aufgaben offen" value={metrics.openTasks.length} color={metrics.overdueTasks.length > 0 ? 'red' : 'amber'} onClick={() => setActiveSection('aufgaben')} />
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

            {/* Aktive Policen — per Person */}
            {metrics.active.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Aktive Policen</p>
                  <button onClick={() => setActiveSection('vertraege')} className="text-xs text-primary hover:underline">Alle →</button>
                </div>
                <div className="space-y-3">
                  {contractsByPerson.length > 0
                    ? contractsByPerson.map(g => renderPersonGroup(g, true))
                    : metrics.active.slice(0, 4).map(c => {
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
                            <p className="text-xs font-semibold text-emerald-700 flex-shrink-0">CHF {(c.premium_yearly || 0).toLocaleString('de-CH')}</p>
                          </div>
                        )
                      })
                  }
                </div>
              </div>
            )}

            {/* Verkaufschancen Kurzübersicht */}
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

            {/* Aufgaben Kurzübersicht */}
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
              <EmptyState icon={TrendingUp} title="Keine Verkaufschancen" action={<Button size="sm" variant="outline" onClick={() => setShowVsForm(true)}><Plus className="w-3.5 h-3.5 mr-1" /> Erste Chance erfassen</Button>} />
            ) : (
              <div className="space-y-2">
                {verkaufschancen.map(vs => {
                  const ges = vs.gesellschaften || []
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
            <CrossSellingPanel customer={customer} contracts={allHouseholdContracts} verkaufschancen={verkaufschancen} />
          </div>
        )}

        {/* ── VERTRÄGE — gruppiert nach Person ─────────────────────────── */}
        {activeSection === 'vertraege' && (
          <div className="space-y-5">
            {allHouseholdContracts.length === 0 ? (
              <EmptyState icon={Shield} title="Keine Verträge" />
            ) : contractsByPerson.length > 0 ? (
              contractsByPerson.map(g => renderPersonGroup(g, false))
            ) : (
              allHouseholdContracts.map(c => renderContractCard(c, true))
            )}
          </div>
        )}

        {/* ── AUFGABEN ─────────────────────────────────────────────────── */}
        {activeSection === 'aufgaben' && (
          <div className="space-y-2">
            {tasks.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Keine Aufgaben" />
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
                        {t.due_date && (
                          <p className={cn('text-xs mt-0.5', overdue ? 'text-red-500 font-semibold' : 'text-muted-foreground')}>
                            {overdue ? '⚠ Überfällig: ' : 'Fällig: '}{new Date(t.due_date).toLocaleDateString('de-CH')}
                          </p>
                        )}
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
              <EmptyState icon={FileText} title="Keine Dokumente" />
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

      <StandardModal
        open={showVsForm}
        onOpenChange={setShowVsForm}
        title={`Neue Verkaufschance für ${customer.first_name} ${customer.last_name}`}
        size="md"
        hideFooter
      >
        <VerkaufschanceForm
          customer={customer}
          onSave={d => createVsMutation.mutate(d)}
          onCancel={() => setShowVsForm(false)}
          saving={createVsMutation.isPending}
        />
      </StandardModal>

      {selectedVs && (
        <StandardModal
          open={!!selectedVs}
          onOpenChange={o => { if (!o) setSelectedVsId(null) }}
          title="Verkaufschance"
          size="xl"
          hideFooter
          className="p-0"
        >
          <VerkaufschanceDetail
            verkaufschance={selectedVs}
            customer={customer}
            onClose={() => setSelectedVsId(null)}
            onUpdated={() => queryClient.invalidateQueries({ queryKey: ['verkaufschancen', customerId] })}
          />
        </StandardModal>
      )}
    </div>
  )
}