/**
 * BestandsmanagementPanel — Direkt sichtbare Vertragsablauf-Tabelle im Dashboard
 * Keine Akkordeons, kein Aufklappen, alles sofort sichtbar
 */
import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { cn } from '@/lib/utils'
import { getSparteLabel } from '@/lib/insuranceSparten'
import {
  Repeat2, AlertTriangle, Zap, Clock, CalendarClock, TrendingUp,
  Phone, X, CheckCircle2
} from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

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
  if (cancelDays !== null && cancelDays >= -30 && cancelDays <= 180) {
    let sev = cancelDays <= 0 ? 'expired' : cancelDays <= 30 ? 'critical' : cancelDays <= 60 ? 'urgent' : cancelDays <= 90 ? 'warning' : cancelDays <= 150 ? 'process' : 'early'
    actions.push({ type: 'kuendigung', label: cancelDays <= 0 ? 'Kündigungsfrist abgelaufen' : `Kündigungsfrist in ${cancelDays}d`, severity: sev, days: cancelDays })
  }
  if (endDays !== null && endDays >= 0 && endDays <= 180) {
    let sev = endDays <= 30 ? 'critical' : endDays <= 60 ? 'urgent' : endDays <= 90 ? 'warning' : endDays <= 150 ? 'process' : 'early'
    actions.push({ type: 'ablauf', label: `Ablauf in ${endDays}d`, severity: sev, days: endDays })
  }

  const order = { expired: 0, critical: 1, urgent: 2, warning: 3, process: 4 }
  actions.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))
  return actions
}

const SEV = {
  expired:  { bar: 'bg-red-700',    badge: 'bg-red-700 text-white',      countText: 'text-red-800',    rowBg: 'bg-red-50/60',    borderL: 'border-l-red-600',    label: 'Abgelaufen',      dot: 'bg-red-700' },
  critical: { bar: 'bg-red-500',    badge: 'bg-red-500 text-white',      countText: 'text-red-700',    rowBg: 'bg-red-50/40',    borderL: 'border-l-red-400',    label: 'Kritisch',        dot: 'bg-red-500' },
  urgent:   { bar: 'bg-orange-500', badge: 'bg-orange-500 text-white',   countText: 'text-orange-700', rowBg: 'bg-orange-50/40', borderL: 'border-l-orange-400', label: 'Dringend',        dot: 'bg-orange-500' },
  warning:  { bar: 'bg-amber-400',  badge: 'bg-amber-400 text-white',    countText: 'text-amber-700',  rowBg: 'bg-amber-50/40',  borderL: 'border-l-amber-400',  label: 'Bald fällig',     dot: 'bg-amber-400' },
  process:  { bar: 'bg-blue-400',   badge: 'bg-blue-100 text-blue-700',  countText: 'text-blue-700',   rowBg: 'bg-blue-50/30',   borderL: 'border-l-blue-300',   label: 'In Vorbereitung', dot: 'bg-blue-400' },
  early:    { bar: 'bg-slate-300',  badge: 'bg-slate-100 text-slate-600', countText: 'text-slate-600', rowBg: 'bg-slate-50/20', borderL: 'border-l-slate-300',   label: 'Früh',            dot: 'bg-slate-300' },
}

const PROCESS_STATUS = {
  neu:                       { label: 'Neu',              color: 'bg-slate-100 text-slate-600' },
  pruefung_offen:            { label: 'Prüfung offen',    color: 'bg-amber-100 text-amber-700' },
  kunde_kontaktieren:        { label: 'Kontaktieren',     color: 'bg-blue-100 text-blue-700' },
  verlaengerung_vorbereiten: { label: 'Verlängerung',     color: 'bg-violet-100 text-violet-700' },
  beratung_erfolgt:          { label: 'Beraten',          color: 'bg-teal-100 text-teal-700' },
  erledigt:                  { label: 'Erledigt',         color: 'bg-green-100 text-green-700' },
}

// ── Tabellenzeile ──────────────────────────────────────────────────────────────
function ContractRow({ item, onNavigate, onCreateVs, onStatusChange }) {
  const { contract, topAction } = item
  const cfg = SEV[topAction.severity] || SEV.process
  const cancelDays = daysUntil(contract.cancellation_deadline)
  const endDays    = daysUntil(contract.end_date)
  const kuendigungAction = item.actions.find(a => a.type === 'kuendigung')
  const ablaufAction     = item.actions.find(a => a.type === 'ablauf' || a.type === 'expired')
  const dayAbs = Math.abs(topAction.days ?? 0)

  return (
    <div
      className={cn(
        'grid items-center border-b border-border/50 hover:bg-muted/30 transition-colors border-l-[3px]',
        cfg.rowBg, cfg.borderL
      )}
      style={{ gridTemplateColumns: '160px 120px 1fr 100px 100px 80px 130px 110px' }}
    >
      {/* Kunde */}
      <div
        className="py-2 px-3 cursor-pointer min-w-0"
        onClick={() => contract.customer_id && onNavigate(`/kunden/${contract.customer_id}/360`)}
      >
        <p className="text-[12px] font-bold truncate hover:text-primary transition-colors leading-tight">{contract.customer_name || '–'}</p>
        <p className="text-[10px] text-muted-foreground truncate">{contract.policy_number || '–'}</p>
      </div>

      {/* Versicherer / Sparte */}
      <div className="py-2 px-2 min-w-0">
        <p className="text-[11px] font-semibold truncate">{contract.insurer || '–'}</p>
        <p className="text-[10px] text-muted-foreground truncate">{getSparteLabel(contract.sparte || contract.insurance_type) || '–'}</p>
      </div>

      {/* Countdown */}
      <div className="py-2 px-2 min-w-0">
        {ablaufAction && (
          <p className={cn('text-[11px] font-bold leading-tight', cfg.countText)}>
            {ablaufAction.type === 'expired'
              ? `Abgelaufen vor ${dayAbs} Tagen`
              : `Ablauf in ${endDays} Tagen`}
          </p>
        )}
        {kuendigungAction && (
          <p className="text-[10px] text-muted-foreground leading-tight">
            {(cancelDays ?? 0) <= 0
              ? 'Kündigungsfrist abgelaufen'
              : `Kündigung in ${cancelDays} Tagen`}
          </p>
        )}
      </div>

      {/* Ablaufdatum */}
      <div className="py-2 px-2">
        <p className="text-[11px] font-medium">{fmtDate(contract.end_date)}</p>
        <p className="text-[9px] text-muted-foreground">Ablauf</p>
      </div>

      {/* Kündigungsfrist */}
      <div className="py-2 px-2">
        <p className="text-[11px] font-medium">{fmtDate(contract.cancellation_deadline)}</p>
        <p className="text-[9px] text-muted-foreground">Kündigung</p>
      </div>

      {/* Prämie */}
      <div className="py-2 px-2">
        {fmtCHF(contract.premium_yearly) && (
          <p className="text-[10px] font-semibold text-emerald-700 leading-tight">{fmtCHF(contract.premium_yearly)}</p>
        )}
        <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-bold inline-block mt-0.5', cfg.badge)}>{cfg.label}</span>
      </div>

      {/* Prozess-Status */}
      <div className="py-2 px-2" onClick={e => e.stopPropagation()}>
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

// ── Tabellen-Header ────────────────────────────────────────────────────────────
function TableHeader() {
  return (
    <div
      className="grid text-[9px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/60 border-b border-border"
      style={{ gridTemplateColumns: '160px 120px 1fr 100px 100px 80px 130px 110px' }}
    >
      <div className="py-2 px-3">Kunde / Police</div>
      <div className="py-2 px-2">Versicherer / Sparte</div>
      <div className="py-2 px-2">Countdown</div>
      <div className="py-2 px-2">Ablauf</div>
      <div className="py-2 px-2">Kündigung</div>
      <div className="py-2 px-2">Prämie</div>
      <div className="py-2 px-2">Status</div>
      <div className="py-2 px-2 text-right">Aktion</div>
    </div>
  )
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function BestandsmanagementPanel({ contracts = [] }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('all')

  const createVsMutation = useMutation({
    mutationFn: (data) => base44.entities.Verkaufschance.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['verkaufschancen'] }); navigate('/verkaufschancen') },
  })
  const updateContractMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Contract.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contracts'] }),
  })

  const allActionable = useMemo(() => {
    return contracts
      .filter(c => {
        if (['cancelled', 'archived'].includes(c.status)) return false
        if (c.process_status === 'erledigt') return false
        if (c.status === 'expired') return true
        const endDays = daysUntil(c.end_date)
        const cancelDays = daysUntil(c.cancellation_deadline)
        if (endDays !== null && endDays <= 180) return true
        if (cancelDays !== null && cancelDays <= 180) return true
        return false
      })
      .map(c => {
        const actions = analyzeContract(c)
        return { contract: c, actions, topAction: actions[0] }
      })
      .filter(i => i.actions.length > 0)
      .sort((a, b) => {
        const ord = { expired: 0, critical: 1, urgent: 2, warning: 3, process: 4 }
        const ao = ord[a.topAction?.severity] ?? 9
        const bo = ord[b.topAction?.severity] ?? 9
        if (ao !== bo) return ao - bo
        return (a.topAction?.days ?? 999) - (b.topAction?.days ?? 999)
      })
  }, [contracts])

  const filtered = useMemo(() => {
    return allActionable.filter(item => {
      if (filterSeverity !== 'all') {
        const sev = item.topAction?.severity
        if (filterSeverity === 'critical' && !['expired', 'critical'].includes(sev)) return false
        if (filterSeverity === 'urgent' && sev !== 'urgent') return false
        if (filterSeverity === 'warning' && sev !== 'warning') return false
      }
      if (search) {
        const q = search.toLowerCase()
        const c = item.contract
        if (!(c.customer_name?.toLowerCase().includes(q) || c.insurer?.toLowerCase().includes(q) || c.policy_number?.toLowerCase().includes(q))) return false
      }
      return true
    })
  }, [allActionable, filterSeverity, search])

  const stats = useMemo(() => ({
    expired:  allActionable.filter(i => i.topAction?.severity === 'expired').length,
    critical: allActionable.filter(i => i.topAction?.severity === 'critical').length,
    urgent:   allActionable.filter(i => i.topAction?.severity === 'urgent').length,
    warning:  allActionable.filter(i => i.topAction?.severity === 'warning').length,
    process:  allActionable.filter(i => i.topAction?.severity === 'process').length,
  }), [allActionable])

  const handleCreateVs = async (contract) => {
    await createVsMutation.mutateAsync({
      customer_id:     contract.customer_id,
      customer_name:   contract.customer_name,
      organization_id: contract.organization_id,
      sparte:          contract.sparte || contract.insurance_type,
      status:          'neu',
      linked_contract_id: contract.id,
      title: `Verlängerung ${contract.insurer} – ${getSparteLabel(contract.sparte || contract.insurance_type) || ''}`,
      estimated_value: contract.premium_yearly || 0,
      notes: `Aus Dashboard erstellt. Ablauf: ${fmtDate(contract.end_date)}`,
    })
  }

  const handleStatusChange = (contractId, newStatus) => {
    updateContractMutation.mutate({ id: contractId, data: { process_status: newStatus } })
  }

  if (allActionable.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-xs">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <Repeat2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <span className="text-[13px] font-bold flex-1">Vertragsabläufe & Kündigungen</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span className="text-[11px] text-emerald-600 font-medium">Kein Handlungsbedarf in 120 Tagen ✓</span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/20">
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
          stats.expired > 0 ? 'bg-red-100' : stats.critical > 0 ? 'bg-red-100' : 'bg-orange-100'
        )}>
          <Repeat2 className={cn('w-3.5 h-3.5',
            stats.expired > 0 ? 'text-red-700' : stats.critical > 0 ? 'text-red-600' : 'text-orange-600'
          )} />
        </div>
        <span className="text-[13px] font-bold flex-1">Vertragsabläufe & Kündigungen</span>

        {/* Status-Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {stats.expired > 0 && (
            <button
              onClick={() => setFilterSeverity(f => f === 'critical' ? 'all' : 'critical')}
              className={cn('flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full transition-colors',
                filterSeverity === 'critical' ? 'bg-red-700 text-white ring-2 ring-red-300' : 'bg-red-700 text-white hover:bg-red-800'
              )}
            >
              <AlertTriangle className="w-2.5 h-2.5" /> {stats.expired} abgelaufen
            </button>
          )}
          {stats.critical > 0 && (
            <button
              onClick={() => setFilterSeverity(f => f === 'critical' ? 'all' : 'critical')}
              className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
            >
              <Zap className="w-2.5 h-2.5" /> {stats.critical} kritisch
            </button>
          )}
          {stats.urgent > 0 && (
            <button
              onClick={() => setFilterSeverity(f => f === 'urgent' ? 'all' : 'urgent')}
              className={cn('text-[9px] font-bold px-2 py-0.5 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-colors',
                filterSeverity === 'urgent' && 'ring-2 ring-orange-300'
              )}
            >
              {stats.urgent} dringend
            </button>
          )}
          {stats.warning > 0 && (
            <button
              onClick={() => setFilterSeverity(f => f === 'warning' ? 'all' : 'warning')}
              className={cn('text-[9px] font-bold px-2 py-0.5 bg-amber-400 text-white rounded-full hover:bg-amber-500 transition-colors',
                filterSeverity === 'warning' && 'ring-2 ring-amber-300'
              )}
            >
              {stats.warning} bald fällig
            </button>
          )}
          {(filterSeverity !== 'all' || search) && (
            <button
              onClick={() => { setFilterSeverity('all'); setSearch('') }}
              className="text-[9px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded-full hover:bg-muted/80 transition-colors flex items-center gap-0.5"
            >
              <X className="w-2.5 h-2.5" /> Alle
            </button>
          )}
        </div>

        {/* Suche */}
        <Input
          placeholder="Suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-32 h-7 text-xs"
        />

        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{filtered.length} / {allActionable.length}</span>
      </div>

      {/* Tabelle */}
      <div className="overflow-x-auto">
        <TableHeader />
        <div>
          {filtered.map(item => (
            <ContractRow
              key={item.contract.id}
              item={item}
              onNavigate={navigate}
              onCreateVs={handleCreateVs}
              onStatusChange={handleStatusChange}
            />
          ))}
          {filtered.length === 0 && (
            <div className="py-8 text-center text-[12px] text-muted-foreground">
              Keine Einträge für diesen Filter
            </div>
          )}
        </div>
      </div>
    </div>
  )
}