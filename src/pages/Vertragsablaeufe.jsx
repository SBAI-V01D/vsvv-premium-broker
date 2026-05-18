/**
 * Vertragsabläufe — Renewal-Center & Kundenbindungsmanagement
 * Professionelles Prozess-Dashboard für Vertragsverlängerungen
 */
import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { base44 } from '@/api/base44Client'
import { getSparteLabel } from '@/lib/insuranceSparten'
import { cn } from '@/lib/utils'
import {
  Shield, CheckCircle2, RefreshCw, FileWarning, Phone,
  ChevronDown, TrendingUp, AlertTriangle, Clock, Repeat2,
  CalendarClock, Zap, Users, ChevronRight, Target, X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import ContractTasksPanel from '@/components/vertragsablaeufe/ContractTasksPanel'

// ── Helpers ───────────────────────────────────────────────────────────────────
const daysUntil = (d) => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('de-CH') : '–'
const fmtCHF = (n) => n > 0 ? `CHF ${n.toLocaleString('de-CH')}` : null

/**
 * Neue Prozesslogik: Renewal-Prozess startet 90 Tage vor Ablauf.
 * Severity-Skala: >120d neutral/soft, 90–120d amber, 30–90d orange, 0–30d rot, abgelaufen dunkelrot.
 */
function analyzeContract(contract) {
  const endDays    = daysUntil(contract.end_date)
  const cancelDays = daysUntil(contract.cancellation_deadline)

  const actions = []

  // ── Abgelaufen ──
  if (contract.status === 'expired' || (endDays !== null && endDays < 0)) {
    const seit = endDays !== null ? Math.abs(endDays) : 0
    actions.push({ type: 'expired', label: `Seit ${seit} Tagen abgelaufen`, severity: 'expired', days: endDays ?? -1 })
  }

  // ── Kündigungsfrist ──
  if (cancelDays !== null && cancelDays >= -30 && cancelDays <= 120) {
    let sev = 'process'
    if (cancelDays <= 0)        sev = 'expired'
    else if (cancelDays <= 30)  sev = 'critical'
    else if (cancelDays <= 60)  sev = 'urgent'
    else if (cancelDays <= 90)  sev = 'warning'
    else                        sev = 'process'
    const label = cancelDays <= 0
      ? 'Kündigungsfrist abgelaufen'
      : `Kündigungsfrist in ${cancelDays} Tagen`
    actions.push({ type: 'kuendigung', label, severity: sev, days: cancelDays })
  }

  // ── Ablaufdatum ──
  if (endDays !== null && endDays >= 0) {
    let sev = 'neutral'
    if (endDays <= 30)       sev = 'critical'
    else if (endDays <= 60)  sev = 'urgent'
    else if (endDays <= 90)  sev = 'warning'
    else if (endDays <= 120) sev = 'process'
    else                     sev = 'neutral'
    if (sev !== 'neutral') {
      const label = `Läuft in ${endDays} Tagen ab`
      actions.push({ type: 'ablauf', label, severity: sev, days: endDays })
    }
  }

  // Fehlende Police
  if (!contract.policy_document_url && contract.status === 'active' && endDays !== null && endDays <= 60) {
    actions.push({ type: 'dokument', label: 'Police fehlt', severity: 'warning', days: null })
  }

  const order = { expired: 0, critical: 1, urgent: 2, warning: 3, process: 4, neutral: 5 }
  actions.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))
  return actions
}

// ── Severity-Konfiguration — modern, kein Warnblock-Gefühl ───────────────────
const SEV = {
  expired:  {
    bg: 'bg-red-950/5',   border: 'border-red-300',    barColor: '#b91c1c',
    badge: 'bg-red-700 text-white',   dot: 'bg-red-700',
    countdown: 'bg-red-700',          label: 'Abgelaufen',  text: 'text-red-800',
    countdownText: 'text-red-700'
  },
  critical: {
    bg: 'bg-red-50',      border: 'border-red-200',    barColor: '#ef4444',
    badge: 'bg-red-500 text-white',   dot: 'bg-red-500',
    countdown: 'bg-red-500',          label: 'Kritisch',    text: 'text-red-700',
    countdownText: 'text-red-600'
  },
  urgent: {
    bg: 'bg-orange-50',   border: 'border-orange-200', barColor: '#f97316',
    badge: 'bg-orange-500 text-white', dot: 'bg-orange-500',
    countdown: 'bg-orange-500',        label: 'Dringend',   text: 'text-orange-700',
    countdownText: 'text-orange-600'
  },
  warning: {
    bg: 'bg-amber-50',    border: 'border-amber-200',  barColor: '#f59e0b',
    badge: 'bg-amber-400 text-white',  dot: 'bg-amber-400',
    countdown: 'bg-amber-400',         label: 'Bald fällig', text: 'text-amber-700',
    countdownText: 'text-amber-700'
  },
  process: {
    bg: 'bg-blue-50/60',  border: 'border-blue-200',   barColor: '#3b82f6',
    badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-400',
    countdown: 'bg-blue-400',           label: 'In Vorbereitung', text: 'text-blue-700',
    countdownText: 'text-blue-600'
  },
  neutral: {
    bg: 'bg-slate-50',    border: 'border-slate-200',  barColor: '#94a3b8',
    badge: 'bg-slate-200 text-slate-600', dot: 'bg-slate-400',
    countdown: 'bg-slate-400',             label: 'Beobachten', text: 'text-slate-600',
    countdownText: 'text-slate-500'
  },
}

const PROCESS_STATUS_CONFIG = {
  neu:                       { label: 'Neu',                    color: 'bg-slate-100 text-slate-700' },
  pruefung_offen:            { label: 'Prüfung offen',          color: 'bg-amber-100 text-amber-700' },
  kunde_kontaktieren:        { label: 'Kunde kontaktieren',     color: 'bg-blue-100 text-blue-700' },
  verlaengerung_vorbereiten: { label: 'Verlängerung vorbereiten', color: 'bg-violet-100 text-violet-700' },
  beratung_erfolgt:          { label: 'Beratung erfolgt',       color: 'bg-teal-100 text-teal-700' },
  erledigt:                  { label: 'Erledigt',               color: 'bg-green-100 text-green-700' },
}

const NEXT_STEP = {
  expired:    '→ Sofortiger Handlungsbedarf: Rückgewinnung oder Abschluss',
  kuendigung: '→ Entscheid: Kündigen oder verlängern',
  ablauf:     '→ Verlängerung / Offerten einholen',
  dokument:   '→ Police hochladen',
}

// ── Contract Card ─────────────────────────────────────────────────────────────
function ContractCard({ item, onNavigate, onCreateVs, onStatusChange, tasks = [] }) {
  const { contract, topAction } = item
  const cfg = SEV[topAction.severity] || SEV.neutral
  const psCfg = PROCESS_STATUS_CONFIG[contract.process_status] || PROCESS_STATUS_CONFIG.neu
  const [showTasks, setShowTasks] = useState(false)

  const contractTasks = tasks.filter(t =>
    t.contract_id === contract.id ||
    (t.customer_id === contract.customer_id && t.task_type === 'renewal')
  )
  const openTaskCount = contractTasks.filter(t => t.status !== 'completed').length
  const isOverdue = (topAction.days ?? 0) <= 0
  const dayAbs = Math.abs(topAction.days ?? 0)

  return (
    <div className={cn('rounded-xl border-l-[3px] border overflow-hidden transition-all hover:shadow-md', cfg.bg, cfg.border)}
      style={{ borderLeftColor: cfg.barColor }}
    >
      <div className="flex gap-0 p-3.5">
        {/* Countdown Box */}
        <div className={cn(
          'w-16 h-16 rounded-xl flex flex-col items-center justify-center flex-shrink-0 mr-4 text-white font-black',
          cfg.countdown
        )}>
          {topAction.days !== null ? (
            <>
              <span className="text-2xl leading-none">{isOverdue ? `+${dayAbs}` : dayAbs}</span>
              <span className="text-[8px] font-bold leading-none mt-0.5 opacity-90">
                {isOverdue ? 'ÜBER' : 'Tage'}
              </span>
            </>
          ) : (
            <FileWarning className="w-5 h-5" />
          )}
        </div>

        {/* Info Area */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0 cursor-pointer" onClick={() => contract.customer_id && onNavigate(`/kunden/${contract.customer_id}/360`)}>
              <p className="font-bold text-sm truncate hover:text-primary transition-colors">{contract.customer_name || '–'}</p>
              <p className="text-xs text-muted-foreground truncate">
                {contract.insurer} · {getSparteLabel(contract.sparte || contract.insurance_type) || '–'}
                {contract.policy_number && ` · ${contract.policy_number}`}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
              <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold', cfg.badge)}>{cfg.label}</span>
              <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold', psCfg.color)}>{psCfg.label}</span>
            </div>
          </div>

          {/* Next Step */}
          <p className={cn('text-xs font-semibold mb-2', cfg.countdownText)}>
            {NEXT_STEP[topAction.type] || topAction.label}
          </p>

          {/* Secondary badges */}
          {item.actions.length > 1 && (
            <div className="flex gap-1 flex-wrap mb-2">
              {item.actions.slice(1, 3).map((a, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 bg-white/70 border border-border rounded-full text-muted-foreground">{a.label}</span>
              ))}
            </div>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-3 flex-wrap">
            {contract.end_date && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarClock className="w-3 h-3" /> Ablauf: <strong className={cfg.countdownText}>{fmtDate(contract.end_date)}</strong>
              </span>
            )}
            {contract.cancellation_deadline && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> Kündigung: <strong>{fmtDate(contract.cancellation_deadline)}</strong>
              </span>
            )}
            {fmtCHF(contract.premium_yearly) && (
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> {fmtCHF(contract.premium_yearly)}/J.
              </span>
            )}
          </div>
        </div>

        {/* Action Column */}
        <div className="flex flex-col gap-2 ml-3 flex-shrink-0 items-end" onClick={e => e.stopPropagation()}>
          <Select value={contract.process_status || 'neu'} onValueChange={(v) => onStatusChange(contract.id, v)}>
            <SelectTrigger className="h-7 text-[10px] w-44 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PROCESS_STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-1.5">
            {contract.customer_id && (
              <button
                onClick={() => onNavigate(`/kunden/${contract.customer_id}/360`)}
                className="text-[10px] px-2.5 py-1.5 bg-primary/10 text-primary rounded-lg font-bold hover:bg-primary/20 transition-colors flex items-center gap-1"
              >
                <Phone className="w-3 h-3" /> Kunde
              </button>
            )}
            <button
              onClick={() => onCreateVs(contract)}
              className="text-[10px] px-2.5 py-1.5 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 transition-colors flex items-center gap-1"
            >
              <Zap className="w-3 h-3" /> Chance
            </button>
          </div>

          {openTaskCount > 0 && (
            <button
              onClick={() => setShowTasks(!showTasks)}
              className="text-[9px] px-2 py-1 bg-orange-100 text-orange-700 rounded-full font-bold flex items-center gap-1 hover:bg-orange-200 transition-colors"
            >
              <Clock className="w-3 h-3" /> {openTaskCount} Aufgabe{openTaskCount > 1 ? 'n' : ''}
              <ChevronDown className={cn('w-3 h-3 transition-transform', showTasks && 'rotate-180')} />
            </button>
          )}
        </div>
      </div>

      {showTasks && (
        <div className="px-4 pb-3 border-t border-border/40 bg-white/50">
          <ContractTasksPanel contract={contract} tasks={tasks} onNavigateCustomer={onNavigate} />
        </div>
      )}
    </div>
  )
}

// ── KPI Tile ──────────────────────────────────────────────────────────────────
function KpiTile({ label, value, sublabel, color, bg, border, active, onClick, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'p-4 rounded-xl border text-left transition-all hover:shadow-md',
        bg, border,
        active && 'ring-2 ring-offset-1 ring-primary shadow-md'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        {Icon && <Icon className={cn('w-4 h-4', color)} />}
        {active && <X className="w-3 h-3 text-muted-foreground" />}
      </div>
      <p className={cn('text-3xl font-black leading-none', color)}>{value}</p>
      <p className="text-xs font-semibold text-foreground mt-1.5">{label}</p>
      {sublabel && <p className="text-[10px] text-muted-foreground mt-0.5">{sublabel}</p>}
    </button>
  )
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, label, count, color, bg }) {
  return (
    <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg', bg)}>
      <Icon className={cn('w-4 h-4', color)} />
      <span className={cn('text-xs font-bold', color)}>{label}</span>
      <span className={cn('ml-auto text-xs font-bold', color)}>{count}</span>
    </div>
  )
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function Vertragsablaeufe() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filterSeverity, setFilterSeverity] = useState('all')
  const [filterProcessStatus, setFilterProcessStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list(),
  })
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list(),
  })

  const createVsMutation = useMutation({
    mutationFn: (data) => base44.entities.Verkaufschance.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['verkaufschancen'] }); setCreating(false) },
  })
  const updateContractMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Contract.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contracts'] }),
  })

  // Verträge analysieren — Prozesshorizont 120 Tage
  const actionableItems = useMemo(() => {
    return contracts
      .filter(c => {
        if (['cancelled', 'archived'].includes(c.status)) return false
        if (c.process_status === 'erledigt' && filterProcessStatus !== 'erledigt') return false
        if (c.status === 'expired') return true
        const endDays = daysUntil(c.end_date)
        const cancelDays = daysUntil(c.cancellation_deadline)
        // Prozess startet 120 Tage vor Ablauf
        if (endDays !== null && endDays <= 120) return true
        if (cancelDays !== null && cancelDays <= 120) return true
        return false
      })
      .map(c => {
        const actions = analyzeContract(c)
        return { contract: c, actions, topAction: actions[0] }
      })
      .filter(item => item.actions.length > 0)
      .sort((a, b) => {
        const order = { expired: 0, critical: 1, urgent: 2, warning: 3, process: 4, neutral: 5 }
        const ao = order[a.topAction?.severity] ?? 9
        const bo = order[b.topAction?.severity] ?? 9
        if (ao !== bo) return ao - bo
        return (a.topAction?.days ?? 999) - (b.topAction?.days ?? 999)
      })
  }, [contracts, filterProcessStatus])

  const filtered = useMemo(() => actionableItems.filter(item => {
    if (filterSeverity !== 'all') {
      // Group: "kritisch" = expired + critical, "dringend" = urgent, etc.
      const sev = item.topAction?.severity
      if (filterSeverity === 'critical' && !['expired','critical'].includes(sev)) return false
      if (filterSeverity === 'urgent'   && sev !== 'urgent')   return false
      if (filterSeverity === 'warning'  && sev !== 'warning')  return false
      if (filterSeverity === 'process'  && !['process','neutral'].includes(sev)) return false
    }
    if (filterProcessStatus !== 'all' && item.contract.process_status !== filterProcessStatus) return false
    if (filterType !== 'all' && item.topAction?.type !== filterType) return false
    if (search) {
      const q = search.toLowerCase()
      const c = item.contract
      if (!(c.customer_name?.toLowerCase().includes(q) || c.insurer?.toLowerCase().includes(q) || c.policy_number?.toLowerCase().includes(q))) return false
    }
    return true
  }), [actionableItems, filterSeverity, filterProcessStatus, filterType, search])

  const stats = useMemo(() => ({
    expired:  actionableItems.filter(i => i.topAction?.severity === 'expired').length,
    critical: actionableItems.filter(i => ['expired','critical'].includes(i.topAction?.severity)).length,
    urgent:   actionableItems.filter(i => i.topAction?.severity === 'urgent').length,
    warning:  actionableItems.filter(i => i.topAction?.severity === 'warning').length,
    process:  actionableItems.filter(i => ['process','neutral'].includes(i.topAction?.severity)).length,
    totalPremium: actionableItems.reduce((s, i) => s + (i.contract.premium_yearly || 0), 0),
  }), [actionableItems])

  // Expired-Gruppe separat anzeigen
  const expiredItems  = filtered.filter(i => i.topAction?.severity === 'expired')
  const activeItems   = filtered.filter(i => i.topAction?.severity !== 'expired')

  const handleCreateVs = async (contract) => {
    setCreating(true)
    await createVsMutation.mutateAsync({
      customer_id:     contract.customer_id,
      customer_name:   contract.customer_name,
      organization_id: contract.organization_id,
      sparte:          contract.sparte || contract.insurance_type,
      status:          'neu',
      linked_contract_id: contract.id,
      title: `Verlängerung ${contract.insurer} – ${getSparteLabel(contract.sparte || contract.insurance_type) || ''}`,
      estimated_value: contract.premium_yearly || 0,
      notes: `Aus Vertragsablauf erstellt. Ablauf: ${fmtDate(contract.end_date)}`,
    })
    navigate('/verkaufschancen')
  }

  const handleStatusChange = (contractId, newProcessStatus) => {
    updateContractMutation.mutate({ id: contractId, data: { process_status: newProcessStatus } })
  }

  const hasFilters = search || filterSeverity !== 'all' || filterProcessStatus !== 'all' || filterType !== 'all'

  return (
    <div className="space-y-6 pb-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
              <Repeat2 className="w-5 h-5 text-orange-600" />
            </div>
            Renewal-Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kundenbindung · Vertragsverlängerungen · Kündigungsfristen — Prozesshorizont 120 Tage
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/verkaufschancen')} variant="outline" size="sm" className="gap-2">
            <Target className="w-4 h-4" /> Verkaufschancen
          </Button>
          <Button onClick={() => navigate('/vertraege')} variant="outline" size="sm" className="gap-2">
            <Shield className="w-4 h-4" /> Alle Verträge
          </Button>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <KpiTile
          label="Abgelaufen"
          sublabel="Sofortiger Handlungsbedarf"
          value={stats.expired}
          color="text-red-800"
          bg="bg-red-50"
          border={stats.expired > 0 ? 'border-red-300' : 'border-red-100'}
          active={filterSeverity === 'critical' && stats.expired > 0}
          onClick={() => setFilterSeverity(f => f === 'critical' ? 'all' : 'critical')}
          icon={AlertTriangle}
        />
        <KpiTile
          label="Kritisch"
          sublabel="≤ 30 Tage"
          value={stats.critical - stats.expired}
          color="text-red-600"
          bg="bg-red-50"
          border="border-red-200"
          active={filterSeverity === 'critical'}
          onClick={() => setFilterSeverity(f => f === 'critical' ? 'all' : 'critical')}
          icon={Zap}
        />
        <KpiTile
          label="Dringend"
          sublabel="30–60 Tage"
          value={stats.urgent}
          color="text-orange-600"
          bg="bg-orange-50"
          border="border-orange-200"
          active={filterSeverity === 'urgent'}
          onClick={() => setFilterSeverity(f => f === 'urgent' ? 'all' : 'urgent')}
          icon={Clock}
        />
        <KpiTile
          label="Bald fällig"
          sublabel="60–90 Tage"
          value={stats.warning}
          color="text-amber-700"
          bg="bg-amber-50"
          border="border-amber-200"
          active={filterSeverity === 'warning'}
          onClick={() => setFilterSeverity(f => f === 'warning' ? 'all' : 'warning')}
          icon={CalendarClock}
        />
        <KpiTile
          label="In Vorbereitung"
          sublabel="90–120 Tage"
          value={stats.process}
          color="text-blue-700"
          bg="bg-blue-50/60"
          border="border-blue-200"
          active={filterSeverity === 'process'}
          onClick={() => setFilterSeverity(f => f === 'process' ? 'all' : 'process')}
          icon={TrendingUp}
        />
      </div>

      {/* Umsatzpotenzial */}
      {stats.totalPremium > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
          <TrendingUp className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-emerald-800">
              CHF {stats.totalPremium.toLocaleString('de-CH')} Jahresprämien im Renewal-Prozess
            </p>
            <p className="text-xs text-emerald-600">{actionableItems.length} Verträge — aktives Kundenbindungspotenzial</p>
          </div>
          <div className="ml-auto">
            <button onClick={() => navigate('/verkaufschancen')} className="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1">
              Chancen erstellen <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* ── Filter Bar ── */}
      <div className="flex gap-2 flex-wrap items-center p-3 bg-muted/40 rounded-xl border border-border">
        <Input
          placeholder="Kunde, Versicherer, Police..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs h-8 bg-white text-sm"
        />
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="w-38 h-8 bg-white text-xs"><SelectValue placeholder="Dringlichkeit" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Dringlichkeiten</SelectItem>
            <SelectItem value="critical">Kritisch / Abgelaufen</SelectItem>
            <SelectItem value="urgent">Dringend (30–60d)</SelectItem>
            <SelectItem value="warning">Bald fällig (60–90d)</SelectItem>
            <SelectItem value="process">In Vorbereitung</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterProcessStatus} onValueChange={setFilterProcessStatus}>
          <SelectTrigger className="w-44 h-8 bg-white text-xs"><SelectValue placeholder="Prozess-Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {Object.entries(PROCESS_STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40 h-8 bg-white text-xs"><SelectValue placeholder="Typ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            <SelectItem value="expired">Abgelaufen</SelectItem>
            <SelectItem value="kuendigung">Kündigungsfrist</SelectItem>
            <SelectItem value="ablauf">Vertragsablauf</SelectItem>
            <SelectItem value="dokument">Fehlende Police</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterSeverity('all'); setFilterProcessStatus('all'); setFilterType('all') }} className="text-muted-foreground h-8">
            Zurücksetzen
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground font-medium">
          {filtered.length} von {actionableItems.length} Verträgen
        </span>
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Lädt...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/30">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-400" />
          <p className="text-lg font-bold text-emerald-700">
            {actionableItems.length === 0 ? 'Alle Verträge stabil' : 'Keine Einträge für diesen Filter'}
          </p>
          <p className="text-sm text-emerald-600 mt-1">
            {actionableItems.length === 0 ? 'Kein Handlungsbedarf in den nächsten 120 Tagen ✓' : 'Filter anpassen um alle Einträge zu sehen.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">

          {/* Abgelaufene — separat, priorisiert oben */}
          {expiredItems.length > 0 && (
            <div className="space-y-2">
              <SectionHeader
                icon={AlertTriangle}
                label="Bereits abgelaufen — Sofortiger Handlungsbedarf"
                count={expiredItems.length}
                color="text-red-800"
                bg="bg-red-100 border border-red-200"
              />
              <div className="space-y-2">
                {expiredItems.map(item => (
                  <ContractCard
                    key={item.contract.id}
                    item={item}
                    onNavigate={navigate}
                    onCreateVs={handleCreateVs}
                    onStatusChange={handleStatusChange}
                    creating={creating}
                    tasks={tasks}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Aktive Renewal-Items */}
          {activeItems.length > 0 && (
            <div className="space-y-2">
              {expiredItems.length > 0 && (
                <SectionHeader
                  icon={Repeat2}
                  label="Kommende Abläufe — Renewal-Prozess aktiv"
                  count={activeItems.length}
                  color="text-orange-800"
                  bg="bg-orange-50 border border-orange-200"
                />
              )}
              <div className="space-y-2">
                {activeItems.map(item => (
                  <ContractCard
                    key={item.contract.id}
                    item={item}
                    onNavigate={navigate}
                    onCreateVs={handleCreateVs}
                    onStatusChange={handleStatusChange}
                    creating={creating}
                    tasks={tasks}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}