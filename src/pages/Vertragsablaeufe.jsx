/**
 * Renewal-Center — Broker-Tagescockpit
 * Priorisierte Übersicht aller Vertragsabläufe & Kündigungsfristen
 */
import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { base44 } from '@/api/base44Client'
import { getSparteLabel } from '@/lib/insuranceSparten'
import { cn } from '@/lib/utils'
import {
  Repeat2, CheckCircle2, RefreshCw, AlertTriangle, Clock,
  TrendingUp, Zap, Target, Shield, X, CalendarClock,
  User, ArrowRight, ClipboardCheck, Loader2
} from 'lucide-react'
import { format, addDays } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

const daysUntil = (d) => d ? Math.ceil((new Date(d + 'T00:00:00') - new Date()) / 86400000) : null
const fmtDate   = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('de-CH') : '–'
const fmtCHF    = (n) => n > 0 ? `CHF ${Number(n).toLocaleString('de-CH')}` : null

function analyzeContract(contract) {
  const endDays    = daysUntil(contract.end_date)
  const cancelDays = daysUntil(contract.cancellation_deadline)
  const actions = []

  const isPlaceholderEnd    = contract.end_date?.startsWith('9999')
  const isPlaceholderCancel = contract.cancellation_deadline?.startsWith('9999')
  if (isPlaceholderEnd || isPlaceholderCancel || contract.requires_review) {
    actions.push({ type: 'review_required', severity: 'review_required', days: null })
    return actions
  }

  if (contract.status === 'expired' || (endDays !== null && endDays < 0)) {
    actions.push({ type: 'expired', label: 'Abgelaufen', severity: 'expired', days: endDays ?? -1 })
  }
  if (cancelDays !== null && cancelDays <= 365) {
    const sev = cancelDays < 0 ? 'expired' : cancelDays <= 30 ? 'critical' : cancelDays <= 60 ? 'urgent' : cancelDays <= 90 ? 'warning' : cancelDays <= 150 ? 'process' : 'early'
    actions.push({ type: 'kuendigung', severity: sev, days: cancelDays })
  }
  if (endDays !== null && endDays <= 365) {
    const sev = endDays < 0 ? 'expired' : endDays <= 30 ? 'critical' : endDays <= 60 ? 'urgent' : endDays <= 90 ? 'warning' : endDays <= 150 ? 'process' : 'early'
    actions.push({ type: 'ablauf', severity: sev, days: endDays })
  }

  const order = { expired: 0, critical: 1, urgent: 2, warning: 3, process: 4, early: 5 }
  actions.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))
  return actions
}

const SEV = {
  expired:         { badge: 'bg-red-700 text-white',       countText: 'text-red-700',    rowBg: 'hover:bg-red-50/50',    borderL: 'border-l-red-500',    label: 'Abgelaufen',           barColor: 'bg-red-500',    kpiBg: 'bg-red-50',    kpiBorder: 'border-red-200',    kpiText: 'text-red-700' },
  critical:        { badge: 'bg-red-500 text-white',        countText: 'text-red-600',    rowBg: 'hover:bg-red-50/40',    borderL: 'border-l-red-400',    label: 'Kritisch',             barColor: 'bg-red-400',    kpiBg: 'bg-red-50',    kpiBorder: 'border-red-200',    kpiText: 'text-red-600' },
  urgent:          { badge: 'bg-orange-500 text-white',     countText: 'text-orange-600', rowBg: 'hover:bg-orange-50/40', borderL: 'border-l-orange-400', label: 'Dringend',             barColor: 'bg-orange-400', kpiBg: 'bg-orange-50', kpiBorder: 'border-orange-200', kpiText: 'text-orange-600' },
  warning:         { badge: 'bg-amber-400 text-white',      countText: 'text-amber-700',  rowBg: 'hover:bg-amber-50/40',  borderL: 'border-l-amber-400',  label: 'Bald fällig',          barColor: 'bg-amber-400',  kpiBg: 'bg-amber-50',  kpiBorder: 'border-amber-200',  kpiText: 'text-amber-700' },
  process:         { badge: 'bg-blue-100 text-blue-700',    countText: 'text-blue-700',   rowBg: 'hover:bg-blue-50/30',   borderL: 'border-l-blue-300',   label: 'Vorbereitung',         barColor: 'bg-blue-300',   kpiBg: 'bg-blue-50',   kpiBorder: 'border-blue-200',   kpiText: 'text-blue-700' },
  early:           { badge: 'bg-slate-100 text-slate-600',  countText: 'text-slate-600',  rowBg: 'hover:bg-slate-50/30',  borderL: 'border-l-slate-300',  label: 'Früh',                 barColor: 'bg-slate-300',  kpiBg: 'bg-slate-50',  kpiBorder: 'border-slate-200',  kpiText: 'text-slate-600' },
  review_required: { badge: 'bg-amber-100 text-amber-800',  countText: 'text-amber-700',  rowBg: 'hover:bg-amber-50/30',  borderL: 'border-l-amber-400',  label: 'Prüfung erforderlich', barColor: 'bg-amber-300',  kpiBg: 'bg-amber-50',  kpiBorder: 'border-amber-200',  kpiText: 'text-amber-700' },
}

const PROCESS_STATUS = {
  neu:                       { label: 'Neu',           color: 'text-slate-500' },
  pruefung_offen:            { label: 'Prüfung offen', color: 'text-amber-600' },
  kunde_kontaktieren:        { label: 'Kontaktieren',  color: 'text-blue-600' },
  verlaengerung_vorbereiten: { label: 'Verlängerung',  color: 'text-violet-600' },
  beratung_erfolgt:          { label: 'Beraten',       color: 'text-teal-600' },
  erledigt:                  { label: 'Erledigt',      color: 'text-green-600' },
}

function CountdownBar({ days, maxDays = 180, color }) {
  const pct = Math.max(0, Math.min(100, ((maxDays - Math.max(days, 0)) / maxDays) * 100))
  return (
    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
    </div>
  )
}

function CockpitRow({ item, onNavigate, onCreateVs, onStatusChange, onFollowup, followupPending }) {
  const { contract, topAction, actions } = item
  const cfg = SEV[topAction.severity] || SEV.process
  const endDays    = daysUntil(contract.end_date)
  const cancelDays = daysUntil(contract.cancellation_deadline)
  const ablaufAction     = actions.find(a => a.type === 'ablauf' || a.type === 'expired')
  const kuendigungAction = actions.find(a => a.type === 'kuendigung')
  const isExpired = contract.status === 'expired' || (endDays !== null && endDays < 0)
  const isReview  = topAction.severity === 'review_required'

  const isExcluded = contract.exclude_from_renewal_statistics

  return (
    <div
      className={cn('grid items-center border-b border-border/40 transition-colors cursor-pointer border-l-[3px]', cfg.rowBg, cfg.borderL, isExcluded && 'opacity-50')}
      style={{ gridTemplateColumns: '200px 140px 1fr 100px 100px 100px 160px 110px' }}
    >
      <div className="py-2.5 px-3 min-w-0" onClick={() => contract.customer_id && onNavigate(`/kunden/${contract.customer_id}/360`)}>
        <p className="text-[12px] font-semibold truncate hover:text-primary transition-colors leading-tight">{contract.customer_name || '–'}</p>
        <p className="text-[10px] text-muted-foreground truncate">{contract.insurer || '–'} · {getSparteLabel(contract.sparte || contract.insurance_type) || '–'}</p>
        {isExcluded && (
          <span className="inline-block text-[9px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-500 font-semibold mt-0.5" title={contract.renewal_statistics_note || 'Aus Statistik ausgeschlossen'}>
            Statistik ausgeschl.
          </span>
        )}
      </div>
      <div className="py-2.5 px-2 min-w-0">
        <p className="text-[10px] text-muted-foreground font-mono truncate">{contract.policy_number || '–'}</p>
        {fmtCHF(contract.premium_yearly) && (
          <p className="text-[11px] font-semibold text-emerald-700 leading-tight mt-0.5">{fmtCHF(contract.premium_yearly)}</p>
        )}
      </div>
      <div className="py-2.5 px-3 min-w-0 space-y-1">
        {isReview ? (
          <p className="text-[10px] text-amber-700 font-semibold">⚠ Datum prüfen</p>
        ) : (
          <>
            {ablaufAction && (
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-muted-foreground">Ablauf</span>
                  <span className={cn('text-[11px] font-bold', cfg.countText)}>
                    {isExpired ? `vor ${Math.abs(endDays ?? 0)}d` : endDays !== null ? `${endDays}d` : fmtDate(contract.end_date)}
                  </span>
                </div>
                {!isExpired && endDays !== null && <CountdownBar days={endDays} color={cfg.barColor} />}
              </div>
            )}
            {kuendigungAction && (
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-muted-foreground">Kündigung</span>
                  <span className={cn('text-[10px] font-semibold', (cancelDays ?? 1) <= 0 ? 'text-red-600' : 'text-slate-600')}>
                    {(cancelDays ?? 1) <= 0 ? 'Abgelaufen' : `${cancelDays}d`}
                  </span>
                </div>
                {(cancelDays ?? 0) > 0 && <CountdownBar days={cancelDays} color={cfg.barColor} />}
              </div>
            )}
            {!ablaufAction && !kuendigungAction && <p className="text-[10px] text-muted-foreground">–</p>}
          </>
        )}
      </div>
      <div className="py-2.5 px-2 text-center">
        <p className="text-[11px] font-medium">{isReview ? '—' : fmtDate(contract.end_date)}</p>
        <p className="text-[9px] text-muted-foreground">Ablauf</p>
      </div>
      <div className="py-2.5 px-2 text-center">
        <p className="text-[11px] font-medium">{isReview ? '—' : fmtDate(contract.cancellation_deadline)}</p>
        <p className="text-[9px] text-muted-foreground">Kündigung bis</p>
      </div>
      <div className="py-2.5 px-2 text-center">
        <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-bold inline-block', cfg.badge)}>{cfg.label}</span>
      </div>
      <div className="py-2 px-2" onClick={e => e.stopPropagation()}>
        <Select value={contract.process_status || 'neu'} onValueChange={(v) => onStatusChange(contract.id, v)}>
          <SelectTrigger className="h-6 text-[10px] border-0 bg-transparent px-0 shadow-none focus:ring-0 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PROCESS_STATUS).map(([k, v]) => (
              <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="py-2 px-2 flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => contract.customer_id && onNavigate(`/kunden/${contract.customer_id}/360`)}
          className="text-[9px] px-2 py-1 border border-border rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors whitespace-nowrap"
        >
          <User className="w-2.5 h-2.5 inline mr-0.5" />360°
        </button>
        <button
          onClick={() => onFollowup(contract)}
          disabled={followupPending}
          className="text-[9px] px-2 py-1 border border-border rounded text-blue-600 hover:bg-blue-50 transition-colors whitespace-nowrap disabled:opacity-40"
          title="Follow-up Aufgabe erstellen"
        >
          {followupPending ? <Loader2 className="w-2.5 h-2.5 inline animate-spin" /> : <Zap className="w-2.5 h-2.5 inline mr-0.5" />}Task
        </button>
        <button
          onClick={() => onCreateVs(contract)}
          className="text-[9px] px-2 py-1 bg-primary text-primary-foreground rounded font-semibold hover:bg-primary/90 transition-colors whitespace-nowrap"
        >
          <ArrowRight className="w-2.5 h-2.5 inline mr-0.5" />Chance
        </button>
      </div>
    </div>
  )
}

function KpiCard({ label, sublabel, value, icon: Icon, cfg, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn('p-3 rounded-xl border text-left transition-all hover:shadow-sm flex-1 min-w-[100px] relative', cfg.kpiBg, cfg.kpiBorder, active && 'ring-2 ring-primary ring-offset-1')}
    >
      {active && <X className="absolute top-2 right-2 w-3 h-3 text-muted-foreground" />}
      <p className={cn('text-2xl font-black leading-none', cfg.kpiText)}>{value}</p>
      <p className="text-[11px] font-semibold text-foreground mt-1 leading-tight">{label}</p>
      {sublabel && <p className="text-[9px] text-muted-foreground mt-0.5">{sublabel}</p>}
    </button>
  )
}

function SectionDivider({ label, count, cfg }) {
  return (
    <div className={cn('flex items-center gap-2 px-3 py-2 text-[11px] font-semibold', cfg.kpiBg)}>
      <div className={cn('w-1.5 h-1.5 rounded-full', cfg.barColor)} />
      <span className={cfg.kpiText}>{label}</span>
      <span className={cn('ml-auto font-bold tabular-nums', cfg.kpiText)}>{count}</span>
    </div>
  )
}

function TableHeader() {
  return (
    <div className="grid text-[9px] font-bold uppercase tracking-wider text-muted-foreground bg-slate-50/80 border-b border-border"
      style={{ gridTemplateColumns: '200px 140px 1fr 100px 100px 100px 160px 110px' }}>
      <div className="py-2.5 px-3">Kunde / Versicherer</div>
      <div className="py-2.5 px-2">Police / Prämie</div>
      <div className="py-2.5 px-3">Countdown</div>
      <div className="py-2.5 px-2 text-center">Ablauf</div>
      <div className="py-2.5 px-2 text-center">Kündigung</div>
      <div className="py-2.5 px-2 text-center">Priorität</div>
      <div className="py-2.5 px-2">Prozess-Status</div>
      <div className="py-2.5 px-2 text-right">Aktion</div>
    </div>
  )
}

function TodayPanel({ items }) {
  const today = items.filter(i => {
    const sev = i.topAction?.severity
    return sev === 'expired' || sev === 'critical'
  })
  if (today.length === 0) return null

  return (
    <div className="rounded-xl border border-red-200 bg-red-50/30 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-red-200/70 bg-red-50/60">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-[11px] font-bold text-red-700 uppercase tracking-wide">Heute handeln</span>
        <span className="text-[10px] text-red-600 font-semibold ml-1">{today.length} Fälle</span>
        <span className="ml-auto text-[10px] text-red-600">{fmtCHF(today.reduce((s, i) => s + (i.contract.premium_yearly || 0), 0))} Prämienvolumen</span>
      </div>
      <div className="divide-y divide-red-100">
        {today.slice(0, 5).map(item => {
          const endDays = daysUntil(item.contract.end_date)
          const cancelDays = daysUntil(item.contract.cancellation_deadline)
          return (
            <div key={item.contract.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
              <div className="flex-1 min-w-0">
                <span className="font-semibold">{item.contract.customer_name || '–'}</span>
                <span className="text-muted-foreground mx-1.5">·</span>
                <span className="text-muted-foreground">{item.contract.insurer || '–'}</span>
              </div>
              {endDays !== null && endDays < 0 && <span className="text-red-600 font-bold">Abgelaufen vor {Math.abs(endDays)}d</span>}
              {endDays !== null && endDays >= 0 && endDays <= 30 && <span className="text-red-600 font-bold">Ablauf in {endDays}d</span>}
              {cancelDays !== null && cancelDays <= 30 && cancelDays >= 0 && <span className="text-red-500">Kündigung in {cancelDays}d</span>}
              {fmtCHF(item.contract.premium_yearly) && <span className="text-emerald-700 font-semibold shrink-0">{fmtCHF(item.contract.premium_yearly)}</span>}
            </div>
          )
        })}
        {today.length > 5 && (
          <div className="px-4 py-2 text-[10px] text-red-600 font-semibold">+ {today.length - 5} weitere kritische Fälle</div>
        )}
      </div>
    </div>
  )
}

export default function Vertragsablaeufe() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filterSeverity, setFilterSeverity] = useState('all')
  const [filterProcessStatus, setFilterProcessStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [hideExcluded, setHideExcluded] = useState(false)

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['contracts', 'ablaeufe'],
    queryFn: () => base44.entities.Contract.filter({ archived: false }, '-updated_date', 1000),
    staleTime: 2 * 60 * 1000,
  })

  const { data: verkaufschancen = [] } = useQuery({
    queryKey: ['verkaufschancen'],
    queryFn: () => base44.entities.Verkaufschance.filter({ status: ['neu', 'in_ausschreibung', 'offerten_erhalten', 'beratung_erfolgt', 'kunde_entscheidet'] }, null, 200),
    staleTime: 2 * 60 * 1000,
  })

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', 'open'],
    queryFn: () => base44.entities.Task.filter({ status: ['open', 'in_progress'] }, null, 200),
    staleTime: 2 * 60 * 1000,
  })

  const createVsMutation = useMutation({
    mutationFn: (data) => base44.entities.Verkaufschance.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['verkaufschancen'] }); navigate('/verkaufschancen') },
  })
  const [followupPendingId, setFollowupPendingId] = useState(null)
  const createFollowupMutation = useMutation({
    mutationFn: (contract) => base44.entities.Task.create({
      title: `Follow-up Verlängerung: ${contract.customer_name} – ${contract.insurer}`,
      customer_id: contract.customer_id,
      customer_name: contract.customer_name,
      contract_id: contract.id,
      task_type: 'renewal',
      priority: 'high',
      status: 'open',
      due_date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'open'] })
      setFollowupPendingId(null)
    },
    onError: () => setFollowupPendingId(null),
  })
  const updateContractMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Contract.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contracts'] }),
  })

  const actionableItems = useMemo(() => {
    return contracts
      .filter(c => {
        if (c.archived) return false
        if (['cancelled', 'archived'].includes(c.status)) return false
        if (c.process_status === 'erledigt' && filterProcessStatus !== 'erledigt') return false
        if (c.requires_review || c.end_date?.startsWith('9999') || c.cancellation_deadline?.startsWith('9999')) return true
        if (c.status === 'expired') return true
        const endDays = daysUntil(c.end_date)
        const cancelDays = daysUntil(c.cancellation_deadline)
        if (endDays !== null && endDays <= 365) return true
        if (cancelDays !== null && cancelDays <= 365) return true
        return false
      })
      .map(c => {
        const actions = analyzeContract(c)
        return { contract: c, actions, topAction: actions[0] }
      })
      .filter(item => item.actions.length > 0)
      .sort((a, b) => {
        // Aktionierbare zuerst — abgelaufene zuletzt (kann nicht mehr gehandelt werden)
        const order = { critical: 0, urgent: 1, warning: 2, process: 3, early: 4, expired: 5, review_required: 6 }
        const ao = order[a.topAction?.severity] ?? 9
        const bo = order[b.topAction?.severity] ?? 9
        if (ao !== bo) return ao - bo
        // Innerhalb derselben Gruppe: nach tatsächlichem Ablaufdatum sortieren (zuerst fällig = zuerst angezeigt)
        const aDays = daysUntil(a.contract.end_date) ?? 999
        const bDays = daysUntil(b.contract.end_date) ?? 999
        return aDays - bDays
      })
  }, [contracts, filterProcessStatus])

  const excludedCount = useMemo(() => actionableItems.filter(i => i.contract.exclude_from_renewal_statistics).length, [actionableItems])

  const filtered = useMemo(() => actionableItems.filter(item => {
    if (hideExcluded && item.contract.exclude_from_renewal_statistics) return false
    if (filterSeverity !== 'all') {
      const sev = item.topAction?.severity
      if (filterSeverity === 'review_required' && sev !== 'review_required') return false
      if (filterSeverity === 'critical' && !['expired', 'critical'].includes(sev)) return false
      if (filterSeverity === 'urgent'   && sev !== 'urgent')   return false
      if (filterSeverity === 'warning'  && sev !== 'warning')  return false
      if (filterSeverity === 'process'  && sev !== 'process')  return false
      if (filterSeverity === 'early'    && sev !== 'early')    return false
    }
    if (filterProcessStatus !== 'all' && item.contract.process_status !== filterProcessStatus) return false
    if (search) {
      const q = search.toLowerCase()
      const c = item.contract
      if (!(c.customer_name?.toLowerCase().includes(q) || c.insurer?.toLowerCase().includes(q) || c.policy_number?.toLowerCase().includes(q))) return false
    }
    return true
  }), [actionableItems, filterSeverity, filterProcessStatus, search, hideExcluded])

  const stats = useMemo(() => ({
    expired:         filtered.filter(i => i.topAction?.severity === 'expired').length,
    critical:        filtered.filter(i => i.topAction?.severity === 'critical').length,
    urgent:          filtered.filter(i => i.topAction?.severity === 'urgent').length,
    warning:         filtered.filter(i => i.topAction?.severity === 'warning').length,
    process:         filtered.filter(i => i.topAction?.severity === 'process').length,
    early:           filtered.filter(i => i.topAction?.severity === 'early').length,
    review_required: filtered.filter(i => i.topAction?.severity === 'review_required').length,
    totalPremium:    filtered.filter(i => i.topAction?.severity !== 'review_required').reduce((s, i) => s + (i.contract.premium_yearly || 0), 0),
  }), [filtered])

  const groups = {
    review_required: filtered.filter(i => i.topAction?.severity === 'review_required'),
    early:           filtered.filter(i => i.topAction?.severity === 'early'),
    process:         filtered.filter(i => i.topAction?.severity === 'process'),
    warning:         filtered.filter(i => i.topAction?.severity === 'warning'),
    urgent:          filtered.filter(i => i.topAction?.severity === 'urgent'),
    critical:        filtered.filter(i => i.topAction?.severity === 'critical'),
    expired:         filtered.filter(i => i.topAction?.severity === 'expired'),
  }

  const handleCreateVs = (contract) => {
    const existingVs = verkaufschancen?.find(v =>
      v.linked_contract_id === contract.id && !['gewonnen', 'verloren'].includes(v.status)
    )
    if (existingVs) { navigate(`/verkaufschancen?detail=${existingVs.id}`); return }
    const lastContact = contract.renewal_last_activity ? fmtDate(contract.renewal_last_activity) : 'Kein Kontakt'
    createVsMutation.mutate({
      customer_id: contract.customer_id,
      customer_name: contract.customer_name,
      organization_id: contract.organization_id,
      sparte: contract.sparte || contract.insurance_type,
      status: 'neu',
      linked_contract_id: contract.id,
      title: `Verlängerung ${contract.insurer} – ${getSparteLabel(contract.sparte || contract.insurance_type) || ''}`,
      estimated_value: contract.premium_yearly || 0,
      notes: `Aus Vertragsablauf erstellt. Ablauf: ${fmtDate(contract.end_date)}. Letzter Kontakt: ${lastContact}`,
    })
  }

  const handleFollowup = (contract) => {
    setFollowupPendingId(contract.id)
    createFollowupMutation.mutate(contract)
  }

  const handleStatusChange = (contractId, newStatus) => {
    updateContractMutation.mutate({ id: contractId, data: { process_status: newStatus } })
  }

  const hasFilters = search || filterSeverity !== 'all' || filterProcessStatus !== 'all'

  const GROUP_LABELS = {
    review_required: '⚠ Manuelle Datumsprüfung ausstehend — Platzhalter 9999-12-31',
    early:           'Früh — 150 bis 180 Tage',
    process:         'In Vorbereitung — 90 bis 150 Tage',
    warning:         'Bald fällig — 60 bis 90 Tage',
    urgent:          'Dringend — 30 bis 60 Tage',
    critical:        'Kritisch — innerhalb 30 Tage',
    expired:         'Bereits abgelaufen — sofort handeln',
  }

  const renderGroup = (key) => {
    const items = groups[key]
    if (!items || items.length === 0) return null
    const cfg = SEV[key]
    return (
      <div key={key}>
        <SectionDivider label={GROUP_LABELS[key]} count={items.length} cfg={cfg} />
        {items.map(item => (
          <CockpitRow
            key={item.contract.id}
            item={item}
            onNavigate={navigate}
            onCreateVs={handleCreateVs}
            onStatusChange={handleStatusChange}
            onFollowup={handleFollowup}
            followupPending={followupPendingId === item.contract.id}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="page-enter flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border bg-card shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Repeat2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[hsl(var(--primary))] tracking-tight">Renewal-Center</h1>
              <p className="text-xs text-muted-foreground">Kundenbindung · Kündigungsfristen · Verlängerungen · 180-Tage-Horizont</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/verkaufschancen')} variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
              <Target className="w-3.5 h-3.5" /> Verkaufschancen
            </Button>
            <Button onClick={() => navigate('/vertraege')} variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
              <Shield className="w-3.5 h-3.5" /> Verträge
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* KPI Strip */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
          <KpiCard label="Kritisch"     sublabel="≤ 30 Tage"      value={stats.critical}        icon={Zap}           cfg={SEV.critical}        active={filterSeverity === 'critical'}        onClick={() => setFilterSeverity(f => f === 'critical' ? 'all' : 'critical')} />
          <KpiCard label="Dringend"     sublabel="30–60 Tage"     value={stats.urgent}          icon={Clock}         cfg={SEV.urgent}          active={filterSeverity === 'urgent'}          onClick={() => setFilterSeverity(f => f === 'urgent' ? 'all' : 'urgent')} />
          <KpiCard label="Bald fällig"  sublabel="60–90 Tage"     value={stats.warning}         icon={CalendarClock} cfg={SEV.warning}         active={filterSeverity === 'warning'}         onClick={() => setFilterSeverity(f => f === 'warning' ? 'all' : 'warning')} />
          <KpiCard label="Vorbereitung" sublabel="90–150 Tage"    value={stats.process}         icon={TrendingUp}    cfg={SEV.process}         active={filterSeverity === 'process'}         onClick={() => setFilterSeverity(f => f === 'process' ? 'all' : 'process')} />
          <KpiCard label="Früh"         sublabel="150–180 Tage"   value={stats.early}           icon={CalendarClock} cfg={SEV.early}           active={filterSeverity === 'early'}           onClick={() => setFilterSeverity(f => f === 'early' ? 'all' : 'early')} />
          <KpiCard label="Abgelaufen"   sublabel="Sofort handeln" value={stats.expired}         icon={AlertTriangle} cfg={SEV.expired}         active={filterSeverity === 'expired'}         onClick={() => setFilterSeverity(f => f === 'expired' ? 'all' : 'expired')} />
          {stats.review_required > 0 && (
            <KpiCard label="Datumsprüfung" sublabel="Platzhalter gesetzt" value={stats.review_required} icon={ClipboardCheck} cfg={SEV.review_required} active={filterSeverity === 'review_required'} onClick={() => setFilterSeverity(f => f === 'review_required' ? 'all' : 'review_required')} />
          )}
          {stats.totalPremium > 0 && (
            <div className="flex-1 min-w-[150px] p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-left">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 mb-1" />
              <p className="text-lg font-black text-emerald-800 leading-none">{fmtCHF(stats.totalPremium)}</p>
              <p className="text-[10px] font-semibold text-emerald-700 mt-1">Prämienvolumen</p>
              <p className="text-[9px] text-emerald-600">{actionableItems.length} Verträge</p>
            </div>
          )}
        </div>

        {/* Heute handeln Panel */}
        <TodayPanel items={actionableItems} />

        {/* Filter Bar */}
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative">
            <Input placeholder="Kunde, Versicherer, Police..." value={search} onChange={e => setSearch(e.target.value)} className="w-[220px] h-8 text-xs pl-3" />
          </div>
          <Select value={filterSeverity} onValueChange={setFilterSeverity}>
            <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="Dringlichkeit" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Dringlichkeiten</SelectItem>
              <SelectItem value="review_required">⚠ Datumsprüfung ausstehend</SelectItem>
              <SelectItem value="critical">Kritisch / Abgelaufen</SelectItem>
              <SelectItem value="urgent">Dringend (30–60d)</SelectItem>
              <SelectItem value="warning">Bald fällig (60–90d)</SelectItem>
              <SelectItem value="process">Vorbereitung (90–150d)</SelectItem>
              <SelectItem value="early">Früh (150–180d)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterProcessStatus} onValueChange={setFilterProcessStatus}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Prozess-Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              {Object.entries(PROCESS_STATUS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={() => setHideExcluded(h => !h)}
            className={cn(
              'h-8 px-3 rounded-md border text-xs font-medium transition-colors gap-1.5 flex items-center',
              hideExcluded
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <Shield className="w-3 h-3" />
            Statistikrelevant
            {excludedCount > 0 && (
              <span className={cn('ml-1 px-1.5 rounded-full text-[9px] font-bold', hideExcluded ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground')}>
                {excludedCount} ausgeschl.
              </span>
            )}
          </button>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterSeverity('all'); setFilterProcessStatus('all') }} className="text-muted-foreground h-8 text-xs gap-1">
              <X className="w-3 h-3" /> Zurücksetzen
            </Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} von {actionableItems.length} Verträgen</span>
        </div>

        {/* Cockpit Liste */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Lädt...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/20">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400" />
            <p className="text-base font-bold text-emerald-700">
              {actionableItems.length === 0 ? 'Alle Verträge stabil' : 'Keine Einträge für diesen Filter'}
            </p>
            <p className="text-sm text-emerald-600 mt-1">
              {actionableItems.length === 0 ? 'Kein Handlungsbedarf in den nächsten 180 Tagen ✓' : 'Filter anpassen.'}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden bg-card shadow-xs overflow-x-auto">
            <TableHeader />
            <div>
              {['critical', 'urgent', 'warning', 'process', 'early', 'expired', 'review_required'].map(renderGroup)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}