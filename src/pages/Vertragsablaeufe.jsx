/**
 * Renewal-Center — Kompaktes Arbeits-Cockpit
 * Alle Vertragsabläufe & Kündigungen direkt sichtbar, intelligent priorisiert
 */
import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { base44 } from '@/api/base44Client'
import { getSparteLabel } from '@/lib/insuranceSparten'
import { cn } from '@/lib/utils'
import {
  Repeat2, CheckCircle2, RefreshCw, AlertTriangle, Clock,
  TrendingUp, Zap, ChevronRight, Target, Shield, Phone, X, CalendarClock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

// ── Helpers ───────────────────────────────────────────────────────────────────
const daysUntil = (d) => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null
const fmtDate   = (d) => d ? new Date(d).toLocaleDateString('de-CH') : '–'
const fmtCHF    = (n) => n > 0 ? `CHF ${Number(n).toLocaleString('de-CH')}` : null

function analyzeContract(contract) {
  const endDays    = daysUntil(contract.end_date)
  const cancelDays = daysUntil(contract.cancellation_deadline)
  const actions = []

  if (contract.status === 'expired' || (endDays !== null && endDays < 0)) {
    const seit = endDays !== null ? Math.abs(endDays) : 0
    actions.push({ type: 'expired', label: `Seit ${seit}d abgelaufen`, severity: 'expired', days: endDays ?? -1 })
  }
  if (cancelDays !== null && cancelDays >= -30 && cancelDays <= 120) {
    let sev = cancelDays <= 0 ? 'expired' : cancelDays <= 30 ? 'critical' : cancelDays <= 60 ? 'urgent' : cancelDays <= 90 ? 'warning' : 'process'
    actions.push({ type: 'kuendigung', label: cancelDays <= 0 ? 'Kündigungsfrist abgelaufen' : `Kündigungsfrist in ${cancelDays}d`, severity: sev, days: cancelDays })
  }
  if (endDays !== null && endDays >= 0 && endDays <= 120) {
    let sev = endDays <= 30 ? 'critical' : endDays <= 60 ? 'urgent' : endDays <= 90 ? 'warning' : 'process'
    actions.push({ type: 'ablauf', label: `Ablauf in ${endDays}d`, severity: sev, days: endDays })
  }

  const order = { expired: 0, critical: 1, urgent: 2, warning: 3, process: 4 }
  actions.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))
  return actions
}

// ── Design-Tokens ─────────────────────────────────────────────────────────────
const SEV = {
  expired:  { bar: 'bg-red-700',    badge: 'bg-red-700 text-white',          countText: 'text-red-800',   rowBg: 'bg-red-50/60',   borderL: 'border-l-red-600',    label: 'Abgelaufen',      dot: 'bg-red-700' },
  critical: { bar: 'bg-red-500',    badge: 'bg-red-500 text-white',          countText: 'text-red-700',   rowBg: 'bg-red-50/40',   borderL: 'border-l-red-400',    label: 'Kritisch',        dot: 'bg-red-500' },
  urgent:   { bar: 'bg-orange-500', badge: 'bg-orange-500 text-white',       countText: 'text-orange-700',rowBg: 'bg-orange-50/40',borderL: 'border-l-orange-400', label: 'Dringend',        dot: 'bg-orange-500' },
  warning:  { bar: 'bg-amber-400',  badge: 'bg-amber-400 text-white',        countText: 'text-amber-700', rowBg: 'bg-amber-50/40', borderL: 'border-l-amber-400',  label: 'Bald fällig',     dot: 'bg-amber-400' },
  process:  { bar: 'bg-blue-400',   badge: 'bg-blue-100 text-blue-700',      countText: 'text-blue-700',  rowBg: 'bg-blue-50/30',  borderL: 'border-l-blue-300',   label: 'In Vorbereitung', dot: 'bg-blue-400' },
}

const PROCESS_STATUS = {
  neu:                       { label: 'Neu',                    color: 'bg-slate-100 text-slate-600' },
  pruefung_offen:            { label: 'Prüfung offen',          color: 'bg-amber-100 text-amber-700' },
  kunde_kontaktieren:        { label: 'Kontaktieren',           color: 'bg-blue-100 text-blue-700' },
  verlaengerung_vorbereiten: { label: 'Verlängerung',           color: 'bg-violet-100 text-violet-700' },
  beratung_erfolgt:          { label: 'Beraten',                color: 'bg-teal-100 text-teal-700' },
  erledigt:                  { label: 'Erledigt',               color: 'bg-green-100 text-green-700' },
}

const NEXT_ACTION = {
  expired:    'Rückgewinnung prüfen',
  kuendigung: 'Kündigen oder verlängern',
  ablauf:     'Offerten einholen',
}

// ── Cockpit Row — kompakte Zeile ──────────────────────────────────────────────
function CockpitRow({ item, onNavigate, onCreateVs, onStatusChange }) {
  const { contract, topAction } = item
  const cfg = SEV[topAction.severity] || SEV.process
  const psCfg = PROCESS_STATUS[contract.process_status] || PROCESS_STATUS.neu
  const isOverdue = (topAction.days ?? 0) <= 0
  const dayAbs = Math.abs(topAction.days ?? 0)

  // Countdown-Text für Kündigungsfrist und Ablauf
  const cancelDays = daysUntil(contract.cancellation_deadline)
  const endDays    = daysUntil(contract.end_date)
  const kuendigungAction = item.actions.find(a => a.type === 'kuendigung')
  const ablaufAction     = item.actions.find(a => a.type === 'ablauf' || a.type === 'expired')

  return (
    <div className={cn(
      'grid items-center border-b border-border/50 hover:bg-muted/30 transition-colors border-l-[3px]',
      cfg.rowBg, cfg.borderL
    )}
    style={{ gridTemplateColumns: '3px 180px 130px 1fr 110px 110px 120px 150px 120px' }}
    >
      {/* Severity dot + spacer */}
      <div />

      {/* Kunde */}
      <div
        className="py-2.5 px-3 cursor-pointer min-w-0"
        onClick={() => contract.customer_id && onNavigate(`/kunden/${contract.customer_id}/360`)}
      >
        <p className="text-[12.5px] font-bold truncate hover:text-primary transition-colors leading-tight">{contract.customer_name || '–'}</p>
        <p className="text-[10px] text-muted-foreground truncate">{contract.policy_number || '–'}</p>
      </div>

      {/* Versicherer / Sparte */}
      <div className="py-2.5 px-2 min-w-0">
        <p className="text-[11.5px] font-semibold truncate">{contract.insurer || '–'}</p>
        <p className="text-[10px] text-muted-foreground truncate">{getSparteLabel(contract.sparte || contract.insurance_type) || '–'}</p>
      </div>

      {/* Countdown-Info: Ablauf + Kündigung */}
      <div className="py-2.5 px-2 min-w-0">
        {ablaufAction && (
          <p className={cn('text-[11px] font-bold leading-tight', cfg.countText)}>
            {ablaufAction.type === 'expired'
              ? `Abgelaufen vor ${dayAbs} Tagen`
              : `Ablauf in ${endDays} Tagen`}
          </p>
        )}
        {kuendigungAction && kuendigungAction !== ablaufAction && (
          <p className="text-[10px] text-muted-foreground leading-tight">
            {(cancelDays ?? 0) <= 0
              ? 'Kündigungsfrist abgelaufen'
              : `Kündigungsfrist in ${cancelDays} Tagen`}
          </p>
        )}
        {!ablaufAction && kuendigungAction && (
          <p className={cn('text-[11px] font-bold leading-tight', cfg.countText)}>
            {kuendigungAction.label}
          </p>
        )}
      </div>

      {/* Ablaufdatum */}
      <div className="py-2.5 px-2">
        <p className="text-[11px] font-medium">{fmtDate(contract.end_date)}</p>
        <p className="text-[9px] text-muted-foreground">Ablauf</p>
      </div>

      {/* Kündigungsfrist */}
      <div className="py-2.5 px-2">
        <p className="text-[11px] font-medium">{fmtDate(contract.cancellation_deadline)}</p>
        <p className="text-[9px] text-muted-foreground">Kündigung</p>
      </div>

      {/* Prämie + Dringlichkeit */}
      <div className="py-2.5 px-2">
        {fmtCHF(contract.premium_yearly) && (
          <p className="text-[11px] font-semibold text-emerald-700 leading-tight">{fmtCHF(contract.premium_yearly)}</p>
        )}
        <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-bold inline-block mt-0.5', cfg.badge)}>{cfg.label}</span>
      </div>

      {/* Prozess-Status + Nächster Schritt */}
      <div className="py-2.5 px-2" onClick={e => e.stopPropagation()}>
        <Select value={contract.process_status || 'neu'} onValueChange={(v) => onStatusChange(contract.id, v)}>
          <SelectTrigger className="h-6 text-[10px] border-border w-full bg-transparent px-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PROCESS_STATUS).map(([k, v]) => (
              <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{NEXT_ACTION[topAction.type] || '–'}</p>
      </div>

      {/* Aktionen */}
      <div className="py-2 px-2 flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
        {contract.customer_id && (
          <button
            onClick={() => onNavigate(`/kunden/${contract.customer_id}/360`)}
            className="text-[9px] px-1.5 py-1 bg-primary/10 text-primary rounded font-bold hover:bg-primary/20 transition-colors flex items-center gap-0.5 whitespace-nowrap"
          >
            <Phone className="w-2.5 h-2.5" /> Öffnen
          </button>
        )}
        <button
          onClick={() => onCreateVs(contract)}
          className="text-[9px] px-1.5 py-1 bg-primary text-primary-foreground rounded font-bold hover:bg-primary/90 transition-colors flex items-center gap-0.5 whitespace-nowrap"
        >
          <Zap className="w-2.5 h-2.5" /> Chance
        </button>
      </div>
    </div>
  )
}

// ── KPI Tile ──────────────────────────────────────────────────────────────────
function KpiTile({ label, value, sublabel, valueColor, bg, border, active, onClick, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'p-3 rounded-xl border text-left transition-all hover:shadow-sm flex-1',
        bg, border,
        active && 'ring-2 ring-primary ring-offset-1 shadow-sm'
      )}
    >
      <div className="flex items-center justify-between mb-1">
        {Icon && <Icon className={cn('w-3.5 h-3.5', valueColor)} />}
        {active && <X className="w-3 h-3 text-muted-foreground/60" />}
      </div>
      <p className={cn('text-2xl font-black leading-none', valueColor)}>{value}</p>
      <p className="text-[11px] font-semibold text-foreground mt-1">{label}</p>
      {sublabel && <p className="text-[9px] text-muted-foreground mt-0.5">{sublabel}</p>}
    </button>
  )
}

// ── Section Divider ───────────────────────────────────────────────────────────
function SectionDivider({ icon: Icon, label, count, colorClass, bgClass }) {
  return (
    <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold', bgClass, colorClass)}>
      <Icon className="w-3.5 h-3.5" />
      {label}
      <span className="ml-auto font-black">{count}</span>
    </div>
  )
}

// ── Table Header ──────────────────────────────────────────────────────────────
function TableHeader() {
  return (
    <div
      className="grid text-[9px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/60 border-b border-border px-0"
      style={{ gridTemplateColumns: '3px 180px 130px 1fr 110px 110px 120px 150px 120px' }}
    >
      <div />
      <div className="py-2 px-3">Kunde / Police</div>
      <div className="py-2 px-2">Versicherer / Sparte</div>
      <div className="py-2 px-2">Countdown</div>
      <div className="py-2 px-2">Ablaufdatum</div>
      <div className="py-2 px-2">Kündigung bis</div>
      <div className="py-2 px-2">Prämie / Priorität</div>
      <div className="py-2 px-2">Status / Nächster Schritt</div>
      <div className="py-2 px-2 text-right">Aktion</div>
    </div>
  )
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function Vertragsablaeufe() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filterSeverity, setFilterSeverity] = useState('all')
  const [filterProcessStatus, setFilterProcessStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list(),
  })

  const createVsMutation = useMutation({
    mutationFn: (data) => base44.entities.Verkaufschance.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['verkaufschancen'] }); setCreating(false) },
  })
  const updateContractMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Contract.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contracts'] }),
  })

  const actionableItems = useMemo(() => {
    return contracts
      .filter(c => {
        if (['cancelled', 'archived'].includes(c.status)) return false
        if (c.process_status === 'erledigt' && filterProcessStatus !== 'erledigt') return false
        if (c.status === 'expired') return true
        const endDays = daysUntil(c.end_date)
        const cancelDays = daysUntil(c.cancellation_deadline)
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
        const order = { expired: 0, critical: 1, urgent: 2, warning: 3, process: 4 }
        const ao = order[a.topAction?.severity] ?? 9
        const bo = order[b.topAction?.severity] ?? 9
        if (ao !== bo) return ao - bo
        return (a.topAction?.days ?? 999) - (b.topAction?.days ?? 999)
      })
  }, [contracts, filterProcessStatus])

  const filtered = useMemo(() => actionableItems.filter(item => {
    if (filterSeverity !== 'all') {
      const sev = item.topAction?.severity
      if (filterSeverity === 'critical' && !['expired', 'critical'].includes(sev)) return false
      if (filterSeverity === 'urgent'  && sev !== 'urgent')  return false
      if (filterSeverity === 'warning' && sev !== 'warning') return false
      if (filterSeverity === 'process' && sev !== 'process') return false
    }
    if (filterProcessStatus !== 'all' && item.contract.process_status !== filterProcessStatus) return false
    if (search) {
      const q = search.toLowerCase()
      const c = item.contract
      if (!(c.customer_name?.toLowerCase().includes(q) || c.insurer?.toLowerCase().includes(q) || c.policy_number?.toLowerCase().includes(q))) return false
    }
    return true
  }), [actionableItems, filterSeverity, filterProcessStatus, search])

  const stats = useMemo(() => ({
    expired:  actionableItems.filter(i => i.topAction?.severity === 'expired').length,
    critical: actionableItems.filter(i => i.topAction?.severity === 'critical').length,
    urgent:   actionableItems.filter(i => i.topAction?.severity === 'urgent').length,
    warning:  actionableItems.filter(i => i.topAction?.severity === 'warning').length,
    process:  actionableItems.filter(i => i.topAction?.severity === 'process').length,
    totalPremium: actionableItems.reduce((s, i) => s + (i.contract.premium_yearly || 0), 0),
  }), [actionableItems])

  const expiredItems  = filtered.filter(i => i.topAction?.severity === 'expired')
  const criticalItems = filtered.filter(i => i.topAction?.severity === 'critical')
  const urgentItems   = filtered.filter(i => i.topAction?.severity === 'urgent')
  const warningItems  = filtered.filter(i => i.topAction?.severity === 'warning')
  const processItems  = filtered.filter(i => i.topAction?.severity === 'process')

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

  const handleStatusChange = (contractId, newStatus) => {
    updateContractMutation.mutate({ id: contractId, data: { process_status: newStatus } })
  }

  const hasFilters = search || filterSeverity !== 'all' || filterProcessStatus !== 'all'

  // Render a group of rows with section header
  const renderGroup = (items, icon, label, colorClass, bgClass) => {
    if (items.length === 0) return null
    return (
      <div key={label}>
        <SectionDivider icon={icon} label={label} count={items.length} colorClass={colorClass} bgClass={bgClass} />
        {items.map(item => (
          <CockpitRow
            key={item.contract.id}
            item={item}
            onNavigate={navigate}
            onCreateVs={handleCreateVs}
            onStatusChange={handleStatusChange}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
              <Repeat2 className="w-4 h-4 text-orange-600" />
            </div>
            Renewal-Center
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Kundenbindung · Kündigungsfristen · Verlängerungen — Prozesshorizont 120 Tage
          </p>
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

      {/* ── KPI Strip ── */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
        <KpiTile label="Abgelaufen" sublabel="Sofort handeln" value={stats.expired}
          valueColor="text-red-800" bg="bg-red-50" border={stats.expired > 0 ? 'border-red-300' : 'border-red-100'}
          active={filterSeverity === 'critical'} onClick={() => setFilterSeverity(f => f === 'critical' ? 'all' : 'critical')} icon={AlertTriangle} />
        <KpiTile label="Kritisch" sublabel="≤ 30 Tage" value={stats.critical}
          valueColor="text-red-600" bg="bg-red-50" border="border-red-200"
          active={filterSeverity === 'critical'} onClick={() => setFilterSeverity(f => f === 'critical' ? 'all' : 'critical')} icon={Zap} />
        <KpiTile label="Dringend" sublabel="30–60 Tage" value={stats.urgent}
          valueColor="text-orange-600" bg="bg-orange-50" border="border-orange-200"
          active={filterSeverity === 'urgent'} onClick={() => setFilterSeverity(f => f === 'urgent' ? 'all' : 'urgent')} icon={Clock} />
        <KpiTile label="Bald fällig" sublabel="60–90 Tage" value={stats.warning}
          valueColor="text-amber-700" bg="bg-amber-50" border="border-amber-200"
          active={filterSeverity === 'warning'} onClick={() => setFilterSeverity(f => f === 'warning' ? 'all' : 'warning')} icon={CalendarClock} />
        <KpiTile label="In Vorbereitung" sublabel="90–120 Tage" value={stats.process}
          valueColor="text-blue-700" bg="bg-blue-50/60" border="border-blue-200"
          active={filterSeverity === 'process'} onClick={() => setFilterSeverity(f => f === 'process' ? 'all' : 'process')} icon={TrendingUp} />
        {stats.totalPremium > 0 && (
          <div className="flex-1 min-w-[160px] p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-left">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600 mb-1" />
            <p className="text-[13px] font-black text-emerald-800 leading-none">{fmtCHF(stats.totalPremium)}</p>
            <p className="text-[10px] font-semibold text-emerald-700 mt-1">Jahresprämien im Prozess</p>
            <p className="text-[9px] text-emerald-600">{actionableItems.length} Verträge</p>
          </div>
        )}
      </div>

      {/* ── Filter Bar ── */}
      <div className="flex gap-2 flex-wrap items-center">
        <Input
          placeholder="Kunde, Versicherer, Police..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-[220px] h-8 text-xs"
        />
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Dringlichkeit" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Dringlichkeiten</SelectItem>
            <SelectItem value="critical">Kritisch / Abgelaufen</SelectItem>
            <SelectItem value="urgent">Dringend (30–60d)</SelectItem>
            <SelectItem value="warning">Bald fällig (60–90d)</SelectItem>
            <SelectItem value="process">In Vorbereitung</SelectItem>
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
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterSeverity('all'); setFilterProcessStatus('all') }} className="text-muted-foreground h-8 text-xs gap-1">
            <X className="w-3 h-3" /> Zurücksetzen
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} von {actionableItems.length} Verträgen</span>
      </div>

      {/* ── Cockpit List ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Lädt...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/30">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400" />
          <p className="text-base font-bold text-emerald-700">
            {actionableItems.length === 0 ? 'Alle Verträge stabil' : 'Keine Einträge für diesen Filter'}
          </p>
          <p className="text-sm text-emerald-600 mt-1">
            {actionableItems.length === 0 ? 'Kein Handlungsbedarf in den nächsten 120 Tagen ✓' : 'Filter anpassen.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-card shadow-xs overflow-x-auto">
          <TableHeader />
          <div>
            {renderGroup(expiredItems,  AlertTriangle, 'Bereits abgelaufen — Sofortiger Handlungsbedarf', 'text-red-800',    'bg-red-100/80')}
            {renderGroup(criticalItems, Zap,           'Kritisch — Handlung innerhalb 30 Tage',           'text-red-700',    'bg-red-50')}
            {renderGroup(urgentItems,   Clock,         'Dringend — 30 bis 60 Tage',                       'text-orange-700', 'bg-orange-50')}
            {renderGroup(warningItems,  CalendarClock, 'Bald fällig — 60 bis 90 Tage',                    'text-amber-700',  'bg-amber-50')}
            {renderGroup(processItems,  TrendingUp,    'In Vorbereitung — 90 bis 120 Tage',               'text-blue-700',   'bg-blue-50/60')}
          </div>
        </div>
      )}
    </div>
  )
}