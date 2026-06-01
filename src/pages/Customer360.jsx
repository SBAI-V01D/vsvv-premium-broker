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
  CheckCircle2, Clock, Download, Shield, Pencil, Calendar, Tag,
  Building2, Edit, ChevronDown, ChevronUp, AlertTriangle, XCircle, CreditCard
} from 'lucide-react'
import StatusBadge from '@/components/status/StatusBadge'
import DateQualityBadge from '@/components/contracts/DateQualityBadge'
import ContractDocumentsPanel from '@/components/contracts/ContractDocumentsPanel'
import CancellationPanel from '@/components/contracts/CancellationPanel'
import ContractForm from '@/components/contracts/ContractForm'
import VerkaufschanceStatusBadge from '@/components/verkaufschance/VerkaufschanceStatusBadge'
import VerkaufschanceForm from '@/components/verkaufschance/VerkaufschanceForm'
import VerkaufschanceDetail from '@/components/verkaufschance/VerkaufschanceDetail'
import CrossSellingPanel from '@/components/verkaufschance/CrossSellingPanel'
import EditableField from '@/components/shared/EditableField'
import CustomerForm from '@/components/customers/CustomerForm'
import BrokerWorkflowBar from '@/components/customers/BrokerWorkflowBar'
import DocumentUploadDialog from '@/components/documents/DocumentUploadDialog'
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

const CATEGORY_LABEL = {
  contract:       'Vertrag',
  application:    'Antrag',
  identification: 'Identifikation',
  correspondence: 'Korrespondenz',
  other:          'Sonstiges',
}

export default function Customer360() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showVsForm, setShowVsForm] = useState(false)
  const [selectedVsId, setSelectedVsId] = useState(null)
  const [activeSection, setActiveSection] = useState('overview')
  const [quickTaskTitle, setQuickTaskTitle] = useState('')
  const [editingContract, setEditingContract] = useState(null)
  const [editingCustomer, setEditingCustomer] = useState(false)
  const [expandedContractDocs, setExpandedContractDocs] = useState(null)
  const [expandedCancellation, setExpandedCancellation] = useState(null)
  const [showDocUpload, setShowDocUpload] = useState(false)

  // ── Data ─────────────────────────────────────────────────────────────────
  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => base44.entities.Customer.get(customerId),
  })

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts', customerId],
    queryFn: () => base44.entities.Contract.filter({ customer_id: customerId, archived: false }),
  })

  const { data: verkaufschancen = [] } = useQuery({
    queryKey: ['verkaufschancen', customerId],
    queryFn: () => base44.entities.Verkaufschance.filter({ customer_id: customerId }),
  })

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', customerId],
    queryFn: () => base44.entities.Task.filter({ customer_id: customerId }, '-due_date', 100),
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
      const results = await Promise.all(
        members.map(m => base44.entities.Contract.filter({ customer_id: m.id, archived: false }))
      )
      return results.flat()
    },
    enabled: !!customerId,
  })

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', customerId],
    queryFn: async () => {
      const [byCustomer, byPrimary] = await Promise.all([
        base44.entities.Document.filter({ customer_id: customerId }, '-uploaded_at', 100),
        base44.entities.Document.filter({ primary_customer_id: customerId }, '-uploaded_at', 50),
      ])
      const seen = new Set()
      return [...byCustomer, ...byPrimary].filter(d => {
        if (seen.has(d.id)) return false
        seen.add(d.id)
        return true
      })
    },
    enabled: !!customerId,
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-for-360'],
    queryFn: () => base44.entities.Customer.filter({ archived: false }, '-created_date', 500),
    staleTime: 5 * 60 * 1000,
  })

  const updateCustomerMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Customer.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer', customerId] }),
  })

  const updateContractMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Contract.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts', customerId] })
      queryClient.invalidateQueries({ queryKey: ['family-contracts', customerId] })
      setEditingContract(null)
    },
  })

  const createTaskMutation = useMutation({
    mutationFn: d => base44.entities.Task.create(d),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', customerId] }),
  })

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

  // ── Reusable contract card — konsistent mit Verträge-Modul ──────────────
  const formatDate = (d) => {
    if (!d) return '–'
    if (d.startsWith('9999')) return 'Unbegrenzt'
    return new Date(d).toLocaleDateString('de-CH')
  }

  const renderContractCard = (c) => {
    const today = new Date()
    const daysLeft = c.end_date && !c.end_date.startsWith('9999') ? differenceInDays(parseISO(c.end_date), today) : null
    const isCritical = daysLeft !== null && daysLeft <= 30 && daysLeft >= 0
    const isExpired  = daysLeft !== null && daysLeft < 0
    const docsOpen         = expandedContractDocs === c.id
    const cancellationOpen  = expandedCancellation === c.id
    const hasCancellation   = c.cancellation_status && c.cancellation_status !== 'none'

    return (
      <div key={c.id} className={cn(
        'rounded-xl border bg-card overflow-hidden transition-all',
        isCritical ? 'border-red-300' : isExpired ? 'border-red-200' : 'border-border'
      )}>
        {/* Main row */}
        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1.5fr_1.5fr_1fr_1fr_auto] gap-x-3 gap-y-1 px-4 py-3 items-center">

          {/* Versicherer / Sparte */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Tag className="w-3 h-3 text-primary flex-shrink-0" />
              <p className="text-xs font-semibold truncate">{getSparteLabel(c.sparte || c.insurance_type) || '–'}</p>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Building2 className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <p className="text-xs text-muted-foreground truncate">{c.insurer || '–'}</p>
            </div>
            {c.product && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{c.product}</p>}
          </div>

          {/* Vertragsnummer */}
          <div className="min-w-0">
            {c.policy_number && (
              <p className="text-xs font-mono text-muted-foreground">{c.policy_number}</p>
            )}
            {c.sparte_data?.model && <p className="text-[10px] text-muted-foreground">Modell: {c.sparte_data.model}</p>}
            {c.sparte_data?.franchise && <p className="text-[10px] text-muted-foreground">Franchise: CHF {c.sparte_data.franchise}</p>}
          </div>

          {/* Laufzeit */}
          <div className="space-y-0.5">
            {c.start_date && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-2.5 h-2.5 text-green-600 flex-shrink-0" />
                <span className="text-[10px] text-green-700 font-medium">{formatDate(c.start_date)}</span>
              </div>
            )}
            {c.end_date && (
              <div className="flex items-center gap-1.5">
                <Calendar className={cn('w-2.5 h-2.5 flex-shrink-0', isCritical || isExpired ? 'text-red-500' : 'text-muted-foreground')} />
                <span className={cn('text-[10px] font-medium', isCritical ? 'text-red-600' : isExpired ? 'text-red-500' : 'text-muted-foreground')}>
                  {formatDate(c.end_date)}{isCritical && ` (${daysLeft}d)`}{isExpired ? ' (abgelaufen)' : ''}
                </span>
              </div>
            )}
            {c.cancellation_deadline && !c.cancellation_deadline.startsWith('9999') && (
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-2.5 h-2.5 text-amber-500 flex-shrink-0" />
                <span className="text-[10px] text-amber-700">Künd.: {formatDate(c.cancellation_deadline)}</span>
              </div>
            )}
          </div>

          {/* Prämie */}
          <div>
            {c.premium_yearly != null && (
              <p className="text-xs font-semibold text-foreground">
                CHF {c.premium_yearly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/J.
              </p>
            )}
            {c.premium_monthly != null && (
              <p className="text-[10px] text-muted-foreground">
                CHF {c.premium_monthly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/M.
              </p>
            )}
          </div>

          {/* Status */}
          <div className="space-y-1">
            <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold inline-block',
              c.status === 'active' ? 'bg-green-100 text-green-700' :
              c.status === 'cancelled' ? 'bg-red-100 text-red-700' :
              c.status === 'expired' ? 'bg-red-50 text-red-600' :
              'bg-slate-100 text-slate-600'
            )}>
              {c.status === 'active' ? 'Aktiv' : c.status === 'cancelled' ? 'Gekündigt' : c.status === 'expired' ? 'Abgelaufen' : c.status}
            </span>
            {c.requires_review && (
              <DateQualityBadge dateQualityStatus={c.date_quality_status} requiresReview={c.requires_review} variant="compact" />
            )}
          </div>

          {/* Aktionen */}
          <div className="flex items-center gap-1 justify-end">
            <button
              onClick={() => setExpandedCancellation(cancellationOpen ? null : c.id)}
              className={`p-1.5 rounded-md transition-colors ${
                hasCancellation ? 'text-red-500 hover:bg-red-50' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              title="Kündigung"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setExpandedContractDocs(docsOpen ? null : c.id)}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Dokumente"
            >
              {docsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setEditingContract(c)}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Bearbeiten"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { setActiveSection('verkaufschancen'); setShowVsForm(true) }}
              className="p-1.5 rounded-md hover:bg-primary/10 text-primary transition-colors"
              title="Verkaufschance"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Kündigung Panel */}
        {cancellationOpen && (
          <div className="px-4 pb-4 border-t border-border bg-red-50/20">
            <div className="pt-3">
              <CancellationPanel
                contract={c}
                onUpdated={() => {
                  queryClient.invalidateQueries({ queryKey: ['contracts', customerId] })
                  queryClient.invalidateQueries({ queryKey: ['family-contracts', customerId] })
                }}
              />
            </div>
          </div>
        )}

        {/* Dokumente Panel */}
        {docsOpen && (
          <div className="px-4 pb-4 border-t border-border bg-muted/20">
            <ContractDocumentsPanel contract={c} />
          </div>
        )}
      </div>
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
                    <Button size="sm" variant="outline" onClick={() => setEditingCustomer(true)} className="gap-1 h-8 px-3 text-xs">
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

      {/* ── BROKER WORKFLOW BAR ─────────────────────────────────── */}
      <div className="px-0 pt-3">
        <BrokerWorkflowBar
          customer={customer}
          customerId={customerId}
          nextStep={nextStep}
          metrics={metrics}
          onNewChance={() => setShowVsForm(true)}
          onRenewalStart={() => setActiveSection('verkaufschancen')}
        />
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
                {customer.bank_account && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CreditCard className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate font-mono text-xs">{customer.bank_account}</span>
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
              <p className="text-sm font-bold">Cross-Selling &amp; Beratungspotenziale</p>
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
              contractsByPerson.map(({ person, contracts: pContracts }) => {
                const initials = (person.first_name?.[0] || '') + (person.last_name?.[0] || '')
                const activeCount = pContracts.filter(c => c.status === 'active').length
                const premium = pContracts.filter(c => c.status === 'active').reduce((s, c) => s + (c.premium_yearly || 0), 0)
                return (
                  <div key={person.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-primary bg-primary/10 flex-shrink-0 text-[10px]">{initials}</div>
                      <span className="text-sm font-bold">{person.first_name} {person.last_name}</span>
                      {person._role !== 'primary' && (
                        <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{ROLE_LABEL[person._role] || 'Mitglied'}</span>
                      )}
                      <span className="ml-auto text-xs font-semibold text-emerald-700">{activeCount} Polic{activeCount === 1 ? 'e' : 'en'} · CHF {premium.toLocaleString('de-CH')}/J</span>
                    </div>
                    <div className="space-y-2 ml-8">
                      {pContracts.map(c => renderContractCard(c))}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="space-y-2">{allHouseholdContracts.map(c => renderContractCard(c))}</div>
            )}
          </div>
        )}

        {/* ── AUFGABEN ─────────────────────────────────────────────────── */}
        {activeSection === 'aufgaben' && (
          <div className="space-y-3">
            {/* Quick Task Creation */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Neue Aufgabe..."
                value={quickTaskTitle}
                onChange={e => setQuickTaskTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && quickTaskTitle.trim()) {
                    createTaskMutation.mutate({
                      title: quickTaskTitle.trim(),
                      customer_id: customerId,
                      customer_name: `${customer.first_name} ${customer.last_name}`,
                      task_type: 'general', priority: 'medium', status: 'open',
                    })
                    setQuickTaskTitle('')
                  }
                }}
                className="flex-1 h-8 text-sm border border-border rounded-lg px-3 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <Button
                size="sm"
                disabled={!quickTaskTitle.trim() || createTaskMutation.isPending}
                onClick={() => {
                  createTaskMutation.mutate({
                    title: quickTaskTitle.trim(),
                    customer_id: customerId,
                    customer_name: `${customer.first_name} ${customer.last_name}`,
                    task_type: 'general', priority: 'medium', status: 'open',
                  })
                  setQuickTaskTitle('')
                }}
                className="h-8 px-3 text-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Erstellen
              </Button>
            </div>
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
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">{documents.length} Dokument{documents.length !== 1 ? 'e' : ''}</p>
              <Button size="sm" variant="outline" onClick={() => setShowDocUpload(true)} className="gap-1.5 h-8">
                <Plus className="w-3.5 h-3.5" /> Hochladen
              </Button>
            </div>
            {documents.length === 0 ? (
              <EmptyState icon={FileText} title="Keine Dokumente" action={<Button size="sm" variant="outline" onClick={() => setShowDocUpload(true)}><Plus className="w-3.5 h-3.5 mr-1" /> Dokument hochladen</Button>} />
            ) : documents.map(doc => (
              <Card key={doc.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">{CATEGORY_LABEL[doc.category] || doc.category}</p>
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

      {/* Customer Edit Modal */}
      {editingCustomer && (
        <StandardModal
          open={editingCustomer}
          onOpenChange={o => { if (!o) setEditingCustomer(false) }}
          title={`${customer.first_name} ${customer.last_name} bearbeiten`}
          size="xl"
          hideFooter
        >
          <CustomerForm
            customer={customer}
            onSave={data => {
              updateCustomerMutation.mutate({ id: customer.id, data })
              setEditingCustomer(false)
            }}
            onCancel={() => setEditingCustomer(false)}
            saving={updateCustomerMutation.isPending}
          />
        </StandardModal>
      )}

      {/* Contract Edit Modal */}
      {editingContract && (
        <StandardModal
          open={!!editingContract}
          onOpenChange={o => { if (!o) setEditingContract(null) }}
          title="Vertrag bearbeiten"
          size="xl"
          hideFooter
        >
          <ContractForm
            contract={editingContract}
            customers={customers}
            onSave={data => updateContractMutation.mutate({ id: editingContract.id, data })}
            onCancel={() => setEditingContract(null)}
            saving={updateContractMutation.isPending}
          />
        </StandardModal>
      )}

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

      <DocumentUploadDialog
        open={showDocUpload}
        onOpenChange={setShowDocUpload}
        preselectedCustomerId={customerId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['documents-all'] })
          setShowDocUpload(false)
        }}
      />

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