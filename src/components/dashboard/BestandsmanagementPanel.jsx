/**
 * BestandsmanagementPanel — Renewal-Center im Dashboard
 * Prozesshorizont 120 Tage, intelligente Priorisierung
 */
import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { cn } from '@/lib/utils'
import { getSparteLabel } from '@/lib/insuranceSparten'
import { ChevronRight, Repeat2, CheckCircle2, ArrowRight, AlertTriangle, Zap } from 'lucide-react'

const daysUntil = (d) => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('de-CH') : '–'

/**
 * Severity-Logik:
 * expired   = abgelaufen (dunkelrot, höchste Priorität)
 * critical  = ≤ 30 Tage (rot)
 * urgent    = 30–60 Tage (orange)
 * warning   = 60–90 Tage (amber)
 * process   = 90–120 Tage (blau/neutral)
 */
function calcTopIssue(contract) {
  const endDays    = daysUntil(contract.end_date)
  const cancelDays = daysUntil(contract.cancellation_deadline)

  if (contract.status === 'expired' || (endDays !== null && endDays < 0)) {
    const seit = endDays !== null ? Math.abs(endDays) : 0
    return { type: 'expired', label: `+${seit}d überfällig`, severity: 'expired', days: endDays ?? -1 }
  }

  // Kündigungsfrist prüfen
  if (cancelDays !== null && cancelDays >= 0 && cancelDays <= 120) {
    let sev = cancelDays <= 30 ? 'critical' : cancelDays <= 60 ? 'urgent' : cancelDays <= 90 ? 'warning' : 'process'
    return { type: 'kuendigung', label: `Kündigung in ${cancelDays}d`, severity: sev, days: cancelDays }
  }

  // Ablaufdatum
  if (endDays !== null && endDays >= 0 && endDays <= 120) {
    let sev = endDays <= 30 ? 'critical' : endDays <= 60 ? 'urgent' : endDays <= 90 ? 'warning' : 'process'
    return { type: 'ablauf', label: `Ablauf in ${endDays}d`, severity: sev, days: endDays }
  }

  return null
}

const SEV = {
  expired:  { bg: 'bg-red-950/5', border: 'border-red-300', badge: 'bg-red-700 text-white',         dot: 'bg-red-700',    text: 'text-red-800' },
  critical: { bg: 'bg-red-50',    border: 'border-red-200', badge: 'bg-red-500 text-white',          dot: 'bg-red-500',    text: 'text-red-700' },
  urgent:   { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-500 text-white',    dot: 'bg-orange-500', text: 'text-orange-700' },
  warning:  { bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-400 text-white',     dot: 'bg-amber-400',  text: 'text-amber-700' },
  process:  { bg: 'bg-blue-50/60',border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-400',   text: 'text-blue-700' },
}

const FILTER_TABS = [
  { key: 'all',      label: 'Alle' },
  { key: 'expired',  label: 'Abgelaufen' },
  { key: 'critical', label: '≤ 30 Tage' },
  { key: 'urgent',   label: '≤ 60 Tage' },
  { key: 'process',  label: '≤ 120 Tage' },
]

function ContractRow({ contract, topIssue, onCustomer, onCreateVs }) {
  const s = SEV[topIssue.severity] || SEV.process
  const isOverdue = (topIssue.days ?? 0) <= 0
  const dayAbs = Math.abs(topIssue.days ?? 0)

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer hover:shadow-xs transition-all group',
        s.bg, s.border,
        topIssue.severity === 'expired' && 'border-l-2'
      )}
      onClick={() => onCustomer(contract)}
    >
      <div className={cn('w-2 h-2 rounded-full flex-shrink-0', s.dot)} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-[12.5px] font-semibold truncate', s.text)}>{contract.customer_name || '–'}</p>
        <p className="text-[11px] text-muted-foreground truncate">
          {contract.insurer}
          {(contract.sparte || contract.insurance_type) ? ` · ${getSparteLabel(contract.sparte || contract.insurance_type)}` : ''}
        </p>
      </div>
      {/* Tag-Badge */}
      <span className={cn(
        'text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0',
        s.badge
      )}>
        {isOverdue ? `+${dayAbs}d` : `${dayAbs}d`}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onCreateVs(contract) }}
        className="flex-shrink-0 text-[10px] px-2 py-1 bg-primary/10 text-primary rounded-md font-bold hover:bg-primary/20 transition-colors"
      >
        + Chance
      </button>
    </div>
  )
}

export default function BestandsmanagementPanel({ contracts = [] }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(true)
  const [activeFilter, setActiveFilter] = useState('all')

  const createVsMutation = useMutation({
    mutationFn: (data) => base44.entities.Verkaufschance.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['verkaufschancen'] }); navigate('/verkaufschancen') },
  })

  // Alle Verträge im 120-Tage-Horizont + bereits abgelaufene
  const allActionable = useMemo(() => {
    return contracts
      .filter(c => {
        if (['cancelled', 'archived'].includes(c.status)) return false
        if (c.process_status === 'erledigt') return false
        if (c.status === 'expired') return true
        const endDays = daysUntil(c.end_date)
        const cancelDays = daysUntil(c.cancellation_deadline)
        if (endDays !== null && endDays <= 120) return true
        if (cancelDays !== null && cancelDays <= 120) return true
        return false
      })
      .map(c => {
        const issue = calcTopIssue(c)
        return { contract: c, topIssue: issue }
      })
      .filter(i => i.topIssue !== null)
      .sort((a, b) => {
        const ord = { expired: 0, critical: 1, urgent: 2, warning: 3, process: 4 }
        const ao = ord[a.topIssue.severity] ?? 9
        const bo = ord[b.topIssue.severity] ?? 9
        if (ao !== bo) return ao - bo
        return (a.topIssue.days ?? 999) - (b.topIssue.days ?? 999)
      })
  }, [contracts])

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return allActionable
    if (activeFilter === 'expired') return allActionable.filter(i => i.topIssue.severity === 'expired')
    if (activeFilter === 'critical') return allActionable.filter(i => ['expired','critical'].includes(i.topIssue.severity))
    if (activeFilter === 'urgent') return allActionable.filter(i => ['expired','critical','urgent'].includes(i.topIssue.severity))
    if (activeFilter === 'process') return allActionable // already all ≤ 120d
    return allActionable
  }, [allActionable, activeFilter])

  const counts = useMemo(() => ({
    all:      allActionable.length,
    expired:  allActionable.filter(i => i.topIssue.severity === 'expired').length,
    critical: allActionable.filter(i => ['expired','critical'].includes(i.topIssue.severity)).length,
    urgent:   allActionable.filter(i => ['expired','critical','urgent'].includes(i.topIssue.severity)).length,
    process:  allActionable.length,
  }), [allActionable])

  const expiredCount  = counts.expired
  const criticalCount = allActionable.filter(i => ['expired','critical'].includes(i.topIssue.severity)).length

  const handleCustomer = (contract) => navigate(contract.customer_id ? `/kunden/${contract.customer_id}/360` : '/vertragsablaeufe')

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

  if (allActionable.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <Repeat2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <span className="text-[13px] font-bold flex-1">Renewal-Center</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <button onClick={() => navigate('/vertragsablaeufe')} className="text-[10px] text-primary font-semibold hover:underline">Übersicht →</button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors text-left"
      >
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
          expiredCount > 0 ? 'bg-red-100' : criticalCount > 0 ? 'bg-red-100' : 'bg-orange-100'
        )}>
          <Repeat2 className={cn('w-3.5 h-3.5',
            expiredCount > 0 ? 'text-red-700' : criticalCount > 0 ? 'text-red-600' : 'text-orange-600'
          )} />
        </div>
        <span className="text-[13px] font-bold flex-1">Renewal-Center</span>

        {/* Badges */}
        {expiredCount > 0 && (
          <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 bg-red-700 text-white rounded-full">
            <AlertTriangle className="w-2.5 h-2.5" /> {expiredCount} abgelaufen
          </span>
        )}
        {criticalCount > expiredCount && (
          <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 bg-red-500 text-white rounded-full">
            <Zap className="w-2.5 h-2.5" /> {criticalCount - expiredCount} kritisch
          </span>
        )}
        {criticalCount === 0 && allActionable.length > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded-full font-medium">{allActionable.length}</span>
        )}
        <ChevronRight className={cn('w-3.5 h-3.5 text-muted-foreground/60 transition-transform', expanded && 'rotate-90')} />
      </button>

      {expanded && (
        <div className="px-4 pb-3.5">
          {/* Filter Tabs */}
          <div className="flex gap-1 mb-3 overflow-x-auto scrollbar-none">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={cn(
                  'flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border whitespace-nowrap transition-colors flex-shrink-0',
                  activeFilter === tab.key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                )}
              >
                {tab.label}
                {counts[tab.key] > 0 && (
                  <span className={cn('text-[9px] font-bold', activeFilter === tab.key ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                    {counts[tab.key]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Liste */}
          <div className="space-y-1.5">
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-muted-foreground">Keine Einträge</p>
            ) : (
              filtered.map(({ contract, topIssue }) => (
                <ContractRow
                  key={contract.id}
                  contract={contract}
                  topIssue={topIssue}
                  onCustomer={handleCustomer}
                  onCreateVs={handleCreateVs}
                />
              ))
            )}
          </div>

          <div className="mt-2.5">
            <button onClick={() => navigate('/vertragsablaeufe')} className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
              <ArrowRight className="w-3 h-3" /> Renewal-Center öffnen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}