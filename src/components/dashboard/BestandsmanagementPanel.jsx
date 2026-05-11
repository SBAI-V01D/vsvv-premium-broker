/**
 * BestandsmanagementPanel — Vertragsabläufe (prominent im Dashboard)
 * Zeigt alle Verträge mit Handlungsbedarf, priorisiert nach Dringlichkeit.
 * Mit direkten Schnellaktionen: Kunde kontaktieren, Chance erstellen.
 */
import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { cn } from '@/lib/utils'
import { getSparteLabel } from '@/lib/insuranceSparten'
import {
  FileWarning, ChevronRight, TrendingUp, Shield, CheckCircle2,
  Phone, ArrowRight, AlertTriangle
} from 'lucide-react'

const daysUntil = (d) => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('de-CH') : '–'

function calcContractPriority(contract) {
  const issues = []
  const endDays = daysUntil(contract.end_date)
  const cancelDays = daysUntil(contract.cancellation_deadline)

  if (cancelDays !== null && cancelDays >= -30 && cancelDays <= 90) {
    if (cancelDays <= 0)       issues.push({ type: 'kuendigung', label: 'Kündigungsfrist abgelaufen', severity: 'critical', days: cancelDays })
    else if (cancelDays <= 30) issues.push({ type: 'kuendigung', label: `Kündigung in ${cancelDays}d`, severity: 'red', days: cancelDays })
    else if (cancelDays <= 60) issues.push({ type: 'kuendigung', label: `Kündigung in ${cancelDays}d`, severity: 'orange', days: cancelDays })
    else                       issues.push({ type: 'kuendigung', label: `Kündigung in ${cancelDays}d`, severity: 'yellow', days: cancelDays })
  }

  if (endDays !== null && !['cancelled', 'archived'].includes(contract.status)) {
    if (endDays >= -30 && endDays <= 0)      issues.push({ type: 'ablauf', label: 'Vertrag abgelaufen', severity: 'critical', days: endDays })
    else if (endDays > 0 && endDays <= 30)   issues.push({ type: 'ablauf', label: `Läuft in ${endDays}d ab`, severity: 'red', days: endDays })
    else if (endDays > 30 && endDays <= 60)  issues.push({ type: 'ablauf', label: `Läuft in ${endDays}d ab`, severity: 'orange', days: endDays })
    else if (endDays > 60 && endDays <= 90)  issues.push({ type: 'ablauf', label: `Läuft in ${endDays}d ab`, severity: 'yellow', days: endDays })
  }

  const order = { critical: 0, red: 1, orange: 2, yellow: 3 }
  issues.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))
  return issues
}

const SEV = {
  critical: { bg: 'bg-red-50',    border: 'border-l-red-600',    badge: 'bg-red-600 text-white',         barBg: 'bg-red-600',    text: 'text-red-700' },
  red:      { bg: 'bg-red-50',    border: 'border-l-red-400',    badge: 'bg-red-100 text-red-700',       barBg: 'bg-red-500',    text: 'text-red-600' },
  orange:   { bg: 'bg-orange-50', border: 'border-l-orange-400', badge: 'bg-orange-100 text-orange-700', barBg: 'bg-orange-500', text: 'text-orange-700' },
  yellow:   { bg: 'bg-amber-50',  border: 'border-l-amber-400',  badge: 'bg-amber-100 text-amber-700',   barBg: 'bg-amber-400',  text: 'text-amber-700' },
}

function ContractRow({ contract, topIssue, onCustomer, onCreateVs }) {
  const s = SEV[topIssue.severity] || SEV.yellow
  return (
    <div
      className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl border border-l-4 cursor-pointer hover:shadow-sm transition-all', s.bg, s.border)}
      onClick={() => onCustomer(contract)}
    >
      {/* Countdown box */}
      <div className={cn('w-11 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0 text-white font-black text-sm', s.barBg)}>
        {topIssue.days !== null ? (
          <>
            <span className="text-base leading-none">{Math.abs(topIssue.days)}</span>
            <span className="text-[7px] font-bold leading-none mt-0.5">{topIssue.days <= 0 ? 'ÜBER' : 'Tage'}</span>
          </>
        ) : <FileWarning className="w-4 h-4" />}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate leading-tight">{contract.customer_name || '–'}</p>
        <p className="text-[11px] text-muted-foreground truncate">
          {contract.insurer} · {getSparteLabel(contract.sparte || contract.insurance_type) || '–'}
        </p>
        <p className={cn('text-[11px] font-semibold mt-0.5', s.text)}>
          {topIssue.type === 'kuendigung' ? '⚠ ' : ''}{topIssue.label}
        </p>
      </div>

      {/* Quick actions */}
      <div className="flex flex-col gap-1 flex-shrink-0 items-end" onClick={e => e.stopPropagation()}>
        {contract.customer_id && (
          <button
            onClick={() => onCustomer(contract)}
            className="flex items-center gap-1 text-[10px] px-2 py-1 bg-primary/10 text-primary rounded-lg font-bold hover:bg-primary/20 transition-colors"
          >
            <Phone className="w-3 h-3" /> Kunde
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onCreateVs(contract) }}
          className="text-[10px] px-2 py-1 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 transition-colors"
        >
          + Chance
        </button>
      </div>
    </div>
  )
}

export default function BestandsmanagementPanel({ contracts = [] }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(true)

  const createVsMutation = useMutation({
    mutationFn: (data) => base44.entities.Verkaufschance.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verkaufschancen'] })
      navigate('/verkaufschancen')
    },
  })

  const actionableContracts = useMemo(() => {
    return contracts
      .filter(c => {
        if (['cancelled', 'archived'].includes(c.status)) return false
        if (c.process_status === 'erledigt') return false
        if (c.status === 'expired') {
          const cd = c.cancellation_deadline ? Math.ceil((new Date(c.cancellation_deadline) - new Date()) / 86400000) : null
          return cd !== null && cd >= -30 && cd <= 90
        }
        return true
      })
      .map(c => ({ contract: c, issues: calcContractPriority(c) }))
      .filter(i => i.issues.length > 0)
      .map(i => ({ ...i, topIssue: i.issues[0] }))
      .sort((a, b) => {
        const ord = { critical: 0, red: 1, orange: 2, yellow: 3 }
        const ao = ord[a.topIssue?.severity] ?? 9
        const bo = ord[b.topIssue?.severity] ?? 9
        if (ao !== bo) return ao - bo
        return (a.topIssue?.days ?? 999) - (b.topIssue?.days ?? 999)
      })
  }, [contracts])

  const stats = useMemo(() => ({
    critical: actionableContracts.filter(i => i.topIssue?.severity === 'critical' || i.topIssue?.severity === 'red').length,
    medium:   actionableContracts.filter(i => i.topIssue?.severity === 'orange' || i.topIssue?.severity === 'yellow').length,
    total:    actionableContracts.length,
  }), [actionableContracts])

  const handleCustomer = (contract) => {
    navigate(contract.customer_id ? `/kunden/${contract.customer_id}/360` : '/vertragsablaeufe')
  }

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

  if (actionableContracts.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex-1">
            <span className="text-sm font-bold">Vertragsabläufe</span>
            <p className="text-[10px] text-muted-foreground">Kein Handlungsbedarf</p>
          </div>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <button onClick={() => navigate('/vertragsablaeufe')} className="text-[10px] text-primary font-semibold hover:underline">
            Übersicht →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      'rounded-2xl overflow-hidden border-2',
      stats.critical > 0 ? 'border-red-300 bg-red-50/30' : 'border-orange-200 bg-orange-50/20'
    )}>
      {/* ── Header — immer sichtbar ── */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/40 transition-colors border-b border-inherit"
      >
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
          stats.critical > 0 ? 'bg-red-100' : 'bg-orange-100'
        )}>
          <Shield className={cn('w-4 h-4', stats.critical > 0 ? 'text-red-600' : 'text-orange-600')} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold">Vertragsabläufe</span>
          <p className="text-[10px] text-muted-foreground truncate">
            Kündigungsfristen · Verlängerungen · Policenprüfungen
          </p>
        </div>

        {/* Priority summary */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {stats.critical > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-red-600 text-white rounded-full">
              <AlertTriangle className="w-3 h-3" /> {stats.critical} kritisch
            </span>
          )}
          {stats.medium > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">{stats.medium} offen</span>
          )}
        </div>
        <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform flex-shrink-0', expanded && 'rotate-90')} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-3 space-y-2">
          {actionableContracts.slice(0, 8).map(({ contract, topIssue }) => (
            <ContractRow
              key={contract.id}
              contract={contract}
              topIssue={topIssue}
              onCustomer={handleCustomer}
              onCreateVs={handleCreateVs}
            />
          ))}

          {actionableContracts.length > 8 && (
            <button
              onClick={() => navigate('/vertragsablaeufe')}
              className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 text-center hover:bg-white/50 rounded-lg transition-colors"
            >
              +{actionableContracts.length - 8} weitere → Alle anzeigen
            </button>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-inherit mt-1">
            <button onClick={() => navigate('/vertragsablaeufe')} className="flex items-center gap-1 text-xs text-primary hover:underline font-semibold">
              <ArrowRight className="w-3 h-3" /> Vertragsabläufe öffnen
            </button>
            <button onClick={() => navigate('/verkaufschancen')} className="flex items-center gap-1 text-xs text-emerald-700 hover:underline font-medium">
              <TrendingUp className="w-3 h-3" /> Verkaufschancen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}