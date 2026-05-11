/**
 * BestandsmanagementPanel — Vertragsabläufe / Bestandsmanagement
 * Zentrale operative Ansicht für alle handlungsrelevanten Vertragsereignisse.
 */
import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { cn } from '@/lib/utils'
import { getSparteLabel } from '@/lib/insuranceSparten'
import {
  AlertTriangle, RefreshCw, CalendarClock, FileWarning,
  ChevronRight, Plus, Clock, TrendingUp, Shield, CheckCircle2
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const daysUntil = (d) => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('de-CH') : '–'

// Priorität eines Vertrags berechnen
function calcContractPriority(contract) {
  const issues = []
  const today = new Date()

  const endDays = daysUntil(contract.end_date)
  const cancelDays = daysUntil(contract.cancellation_deadline)

  // Kündigungsfrist — nur wenn relevant (max. 30 Tage überfällig, max. 90 Tage in Zukunft)
  if (cancelDays !== null && cancelDays >= -30 && cancelDays <= 90) {
    if (cancelDays <= 0)        issues.push({ type: 'kuendigung', label: 'Kündigungsfrist ABGELAUFEN', severity: 'critical', days: cancelDays })
    else if (cancelDays <= 30)  issues.push({ type: 'kuendigung', label: `Kündigungsfrist in ${cancelDays}d`, severity: 'red', days: cancelDays })
    else if (cancelDays <= 60)  issues.push({ type: 'kuendigung', label: `Kündigungsfrist in ${cancelDays}d`, severity: 'orange', days: cancelDays })
    else                        issues.push({ type: 'kuendigung', label: `Kündigungsfrist in ${cancelDays}d`, severity: 'yellow', days: cancelDays })
  }

  // Vertragsablauf — nur wenn wirklich in den nächsten 90 Tagen (oder max. 30 Tage überfällig)
  if (endDays !== null && !['cancelled', 'archived'].includes(contract.status)) {
    if (endDays >= -30 && endDays <= 0)  issues.push({ type: 'ablauf', label: 'Vertrag ABGELAUFEN', severity: 'critical', days: endDays })
    else if (endDays > 0 && endDays <= 30)  issues.push({ type: 'ablauf', label: `Läuft in ${endDays}d ab`, severity: 'red', days: endDays })
    else if (endDays > 30 && endDays <= 60) issues.push({ type: 'ablauf', label: `Läuft in ${endDays}d ab`, severity: 'orange', days: endDays })
    else if (endDays > 60 && endDays <= 90) issues.push({ type: 'ablauf', label: `Läuft in ${endDays}d ab`, severity: 'yellow', days: endDays })
  }

  const severityOrder = { critical: 0, red: 1, orange: 2, yellow: 3 }
  issues.sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9))

  return issues
}

const SEVERITY_STYLES = {
  critical: { bg: 'bg-red-50', border: 'border-red-400', bar: 'bg-red-600', badge: 'bg-red-600 text-white', text: 'text-red-700' },
  red:      { bg: 'bg-red-50', border: 'border-red-200', bar: 'bg-red-500', badge: 'bg-red-100 text-red-700', text: 'text-red-700' },
  orange:   { bg: 'bg-orange-50', border: 'border-orange-200', bar: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700', text: 'text-orange-700' },
  yellow:   { bg: 'bg-amber-50', border: 'border-amber-200', bar: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700', text: 'text-amber-700' },
}

function ContractActionRow({ contract, topIssue, onClick, onCreateVs }) {
  const style = SEVERITY_STYLES[topIssue.severity] || SEVERITY_STYLES.yellow
  const endDays = daysUntil(contract.end_date)
  const isCritical = topIssue.severity === 'critical' || topIssue.severity === 'red'

  return (
    <div className={cn('flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer hover:shadow-sm transition-all group', style.bg, style.border)}
      onClick={() => onClick(contract)}
    >
      {/* Countdown */}
      <div className={cn('w-12 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0 text-white font-black text-sm',
        topIssue.severity === 'critical' ? 'bg-red-600' :
        topIssue.severity === 'red' ? 'bg-red-500' :
        topIssue.severity === 'orange' ? 'bg-orange-500' : 'bg-amber-400'
      )}>
        {topIssue.days !== null ? (
          <>
            <span className="leading-none">{Math.abs(topIssue.days)}</span>
            <span className="text-[8px] font-bold">{topIssue.days <= 0 ? 'ÜBER' : 'Tage'}</span>
          </>
        ) : (
          <FileWarning className="w-4 h-4" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate">{contract.customer_name || '–'}</p>
        <p className="text-xs text-muted-foreground truncate">
          {contract.insurer} · {getSparteLabel(contract.sparte || contract.insurance_type) || '–'}
        </p>
        <p className={cn('text-xs font-semibold mt-0.5', style.text)}>
          {topIssue.type === 'kuendigung' ? '⚠ ' : ''}
          {topIssue.label}
        </p>
      </div>

      {/* Action */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {endDays !== null && endDays <= 30 && (
          <button
            onClick={(e) => { e.stopPropagation(); onCreateVs(contract) }}
            className="text-[10px] px-2 py-1 bg-primary text-primary-foreground rounded font-bold hover:bg-primary/90 transition-colors"
          >
            + Chance
          </button>
        )}
        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
      </div>
    </div>
  )
}

export default function BestandsmanagementPanel({ contracts = [], tasks = [], verkaufschancen = [] }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(true)
  const [creatingVs, setCreatingVs] = useState(false)

  const createVsMutation = useMutation({
    mutationFn: (data) => base44.entities.Verkaufschance.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verkaufschancen'] })
      setCreatingVs(false)
    },
  })

  // Verträge mit Handlungsbedarf analysieren
  const actionableContracts = useMemo(() => {
    const today = new Date()
    const in90 = new Date(today); in90.setDate(today.getDate() + 90)

    return contracts
      .filter(c => {
        if (['cancelled', 'archived'].includes(c.status)) return false
        if (c.status === 'expired') {
          const cancelDays = c.cancellation_deadline ? Math.ceil((new Date(c.cancellation_deadline) - new Date()) / 86400000) : null
          return cancelDays !== null && cancelDays >= -30 && cancelDays <= 90
        }
        return true
      })
      .map(c => {
        const issues = calcContractPriority(c)
        return { contract: c, issues, topIssue: issues[0] }
      })
      .filter(item => item.issues.length > 0)
      .sort((a, b) => {
        const order = { critical: 0, red: 1, orange: 2, yellow: 3 }
        const ao = order[a.topIssue?.severity] ?? 9
        const bo = order[b.topIssue?.severity] ?? 9
        if (ao !== bo) return ao - bo
        return (a.topIssue?.days ?? 999) - (b.topIssue?.days ?? 999)
      })
  }, [contracts])

  const stats = useMemo(() => {
    const critical = actionableContracts.filter(i => i.topIssue?.severity === 'critical' || i.topIssue?.severity === 'red').length
    const orange = actionableContracts.filter(i => i.topIssue?.severity === 'orange').length
    const yellow = actionableContracts.filter(i => i.topIssue?.severity === 'yellow').length
    return { critical, orange, yellow, total: actionableContracts.length }
  }, [actionableContracts])

  const handleCreateVs = async (contract) => {
    await createVsMutation.mutateAsync({
      customer_id: contract.customer_id,
      customer_name: contract.customer_name,
      organization_id: contract.organization_id,
      sparte: contract.sparte || contract.insurance_type,
      status: 'neu',
      linked_contract_id: contract.id,
      title: `Verlängerung ${contract.insurer} – ${getSparteLabel(contract.sparte || contract.insurance_type) || ''}`,
      estimated_value: contract.premium_yearly || 0,
      notes: `Automatisch aus Vertrag erstellt. Ablauf: ${fmtDate(contract.end_date)}`,
    })
    navigate('/verkaufschancen')
  }

  const handleContractClick = (contract) => {
    if (contract.customer_id) {
      navigate(`/kunden/${contract.customer_id}/360`)
    } else {
      navigate('/vertraege')
    }
  }

  if (actionableContracts.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-sm font-bold flex-1">Vertragsabläufe / Bestand</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="px-5 py-6 text-center text-sm text-muted-foreground">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
          Kein Handlungsbedarf — Bestand stabil ✓
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border-2 border-orange-200 bg-orange-50/20 overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors text-left border-b border-orange-200"
      >
        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
          <Shield className="w-4 h-4 text-orange-600" />
        </div>
        <div className="flex-1">
          <span className="text-sm font-bold">Vertragsabläufe / Bestand</span>
          <p className="text-[10px] text-muted-foreground">
            Verlängerungen · Kündigungsfristen · Handlungsbedarf
          </p>
        </div>

        {/* Severity badges */}
        <div className="flex items-center gap-1.5">
          {stats.critical > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 bg-red-600 text-white rounded-full">{stats.critical} kritisch</span>
          )}
          {stats.orange > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">{stats.orange} bald</span>
          )}
          {stats.yellow > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">{stats.yellow} prüfen</span>
          )}
        </div>

        <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
      </button>

      {expanded && (
        <div className="px-5 pb-4 pt-3">
          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-center">
              <p className="text-2xl font-black text-red-600 leading-none">{stats.critical}</p>
              <p className="text-[10px] text-red-600 font-semibold mt-0.5">Kritisch / Dringend</p>
            </div>
            <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-200 text-center">
              <p className="text-2xl font-black text-orange-600 leading-none">{stats.orange}</p>
              <p className="text-[10px] text-orange-600 font-semibold mt-0.5">Bald fällig (30–60d)</p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-center">
              <p className="text-2xl font-black text-amber-600 leading-none">{stats.yellow}</p>
              <p className="text-[10px] text-amber-600 font-semibold mt-0.5">Beobachten (60–90d)</p>
            </div>
          </div>

          {/* Contract Action Rows */}
          <div className="space-y-2">
            {actionableContracts.slice(0, 10).map(({ contract, topIssue }) => (
              <ContractActionRow
                key={contract.id}
                contract={contract}
                topIssue={topIssue}
                onClick={handleContractClick}
                onCreateVs={handleCreateVs}
              />
            ))}
          </div>

          {actionableContracts.length > 10 && (
            <p className="text-xs text-muted-foreground text-center mt-3">
              +{actionableContracts.length - 10} weitere Verträge mit Handlungsbedarf
            </p>
          )}

          {/* Footer CTA */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-orange-100">
            <button
              onClick={() => navigate('/vertraege')}
              className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
            >
              <ChevronRight className="w-3 h-3" /> Alle Verträge anzeigen
            </button>
            <button
              onClick={() => navigate('/verkaufschancen')}
              className="flex items-center gap-1 text-xs text-emerald-700 hover:underline font-medium"
            >
              <TrendingUp className="w-3 h-3" /> Verkaufschancen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}