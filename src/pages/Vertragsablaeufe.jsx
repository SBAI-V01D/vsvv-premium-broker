/**
 * Vertragsabläufe — Operativer Bestandsmanagement-Bereich
 * Zeigt NUR Verträge mit echtem Handlungsbedarf.
 */
import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { base44 } from '@/api/base44Client'
import { getSparteLabel } from '@/lib/insuranceSparten'
import { cn } from '@/lib/utils'
import {
  Shield, CheckCircle2, ChevronRight,
  RefreshCw, FileWarning
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import ContractTasksPanel from '@/components/vertragsablaeufe/ContractTasksPanel'

// ── Prioritäts-Logik ──────────────────────────────────────────────────────────
const daysUntil = (d) => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null

function analyzeContract(contract) {
  const actions = []
  const endDays   = daysUntil(contract.end_date)
  const cancelDays = daysUntil(contract.cancellation_deadline)

  // Kündigungsfrist
  if (cancelDays !== null && cancelDays >= -30 && cancelDays <= 90) {
    if (cancelDays <= 0)       actions.push({ type: 'kuendigung', label: 'Kündigungsfrist abgelaufen', severity: 'critical', days: cancelDays })
    else if (cancelDays <= 30) actions.push({ type: 'kuendigung', label: `Kündigungsfrist in ${cancelDays} Tagen`, severity: 'red', days: cancelDays })
    else if (cancelDays <= 60) actions.push({ type: 'kuendigung', label: `Kündigungsfrist in ${cancelDays} Tagen`, severity: 'orange', days: cancelDays })
    else                       actions.push({ type: 'kuendigung', label: `Kündigungsfrist in ${cancelDays} Tagen`, severity: 'yellow', days: cancelDays })
  }

  // Vertragsablauf
  if (endDays !== null) {
    if (endDays >= -30 && endDays <= 0)      actions.push({ type: 'ablauf', label: 'Vertrag abgelaufen — Verlängerung prüfen', severity: 'critical', days: endDays })
    else if (endDays > 0 && endDays <= 30)   actions.push({ type: 'ablauf', label: `Läuft in ${endDays} Tagen ab`, severity: 'red', days: endDays })
    else if (endDays > 30 && endDays <= 60)  actions.push({ type: 'ablauf', label: `Läuft in ${endDays} Tagen ab`, severity: 'orange', days: endDays })
    else if (endDays > 60 && endDays <= 90)  actions.push({ type: 'ablauf', label: `Läuft in ${endDays} Tagen ab`, severity: 'yellow', days: endDays })
  }

  // Fehlende Police
  if (!contract.policy_document_url && contract.status === 'active' && endDays !== null && endDays <= 60) {
    actions.push({ type: 'dokument', label: 'Policendokument fehlt', severity: 'orange', days: null })
  }

  const order = { critical: 0, red: 1, orange: 2, yellow: 3 }
  actions.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))
  return actions
}

const SEVERITY_CONFIG = {
  critical: { bg: 'bg-red-50',    border: 'border-red-300',    bar: 'bg-red-600',    badge: 'bg-red-600 text-white',          label: 'Kritisch' },
  red:      { bg: 'bg-red-50',    border: 'border-red-200',    bar: 'bg-red-500',    badge: 'bg-red-100 text-red-700',        label: 'Dringend' },
  orange:   { bg: 'bg-orange-50', border: 'border-orange-200', bar: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700',  label: 'Bald fällig' },
  yellow:   { bg: 'bg-amber-50',  border: 'border-amber-200',  bar: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700',   label: 'Beobachten' },
}

const ACTION_NEXT_STEP = {
  kuendigung: 'Entscheid: Kündigen oder verlängern',
  ablauf:     'Verlängerung vorbereiten',
  dokument:   'Policendokument hochladen',
}

// ── Contract Card ─────────────────────────────────────────────────────────────
function ContractCard({ item, onNavigate, onCreateVs, creating, tasks = [] }) {
  const { contract, topAction } = item
  const cfg = SEVERITY_CONFIG[topAction.severity] || SEVERITY_CONFIG.yellow

  const contractTasks = tasks.filter(t =>
    t.contract_id === contract.id ||
    (t.customer_id === contract.customer_id && t.task_type === 'renewal')
  )
  const openTaskCount = contractTasks.filter(t => t.status !== 'completed').length

  return (
    <div className={cn('rounded-xl border-l-4 border p-4 hover:shadow-md transition-all group', cfg.bg, cfg.border)}
      style={{ borderLeftColor: topAction.severity === 'critical' ? '#dc2626' : topAction.severity === 'red' ? '#ef4444' : topAction.severity === 'orange' ? '#f97316' : '#f59e0b' }}
    >
    <div className="flex gap-4 cursor-pointer" onClick={() => contract.customer_id && onNavigate(`/kunden/${contract.customer_id}/360`)}>
      {/* Countdown Box */}
      <div className={cn('w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0 text-white font-black',
        topAction.severity === 'critical' ? 'bg-red-600' :
        topAction.severity === 'red'      ? 'bg-red-500' :
        topAction.severity === 'orange'   ? 'bg-orange-500' : 'bg-amber-400'
      )}>
        {topAction.days !== null ? (
          <>
            <span className="text-xl leading-none">{Math.abs(topAction.days)}</span>
            <span className="text-[8px] font-bold leading-none mt-0.5">{topAction.days <= 0 ? 'ÜBER' : 'Tage'}</span>
          </>
        ) : (
          <FileWarning className="w-5 h-5" />
        )}
      </div>

      {/* Main Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">{contract.customer_name || '–'}</p>
            <p className="text-xs text-muted-foreground truncate">
              {contract.insurer} · {getSparteLabel(contract.sparte || contract.insurance_type) || '–'}
              {contract.policy_number && ` · ${contract.policy_number}`}
            </p>
          </div>
          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0', cfg.badge)}>
            {cfg.label}
          </span>
        </div>

        {/* Action Label */}
        <p className={cn('text-xs font-semibold mt-1',
          topAction.severity === 'critical' ? 'text-red-700' :
          topAction.severity === 'red'      ? 'text-red-600' :
          topAction.severity === 'orange'   ? 'text-orange-700' : 'text-amber-700'
        )}>
          → {ACTION_NEXT_STEP[topAction.type] || topAction.label}
        </p>

        {/* All actions */}
        {item.actions.length > 1 && (
          <div className="flex gap-1 flex-wrap mt-1.5">
            {item.actions.slice(1).map((a, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 bg-white/60 border border-border rounded text-muted-foreground">
                {a.label}
              </span>
            ))}
          </div>
        )}

        {/* Dates & Premium */}
        <div className="flex gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
          {contract.end_date && (
            <span>Ablauf: <strong>{new Date(contract.end_date).toLocaleDateString('de-CH')}</strong></span>
          )}
          {contract.cancellation_deadline && (
            <span>Kündigungsfrist: <strong>{new Date(contract.cancellation_deadline).toLocaleDateString('de-CH')}</strong></span>
          )}
          {contract.premium_yearly > 0 && (
            <span className="text-emerald-700 font-semibold">CHF {contract.premium_yearly.toLocaleString('de-CH')}/J.</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1.5 flex-shrink-0 items-end justify-between">
        <button
          onClick={(e) => { e.stopPropagation(); onCreateVs(contract) }}
          disabled={creating}
          className="text-[10px] px-2.5 py-1.5 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 transition-colors whitespace-nowrap"
        >
          + Chance
        </button>
        {openTaskCount > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full font-bold whitespace-nowrap">
            {openTaskCount} Aufgabe{openTaskCount > 1 ? 'n' : ''}
          </span>
        )}
        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
    {/* Tasks Panel — direkt verknüpft */}
    <ContractTasksPanel contract={contract} tasks={tasks} onNavigateCustomer={onNavigate} />
    </div>
  )
}

// ── KPI Tile ──────────────────────────────────────────────────────────────────
function KpiTile({ label, value, color, bg }) {
  return (
    <div className={cn('p-4 rounded-xl border border-border text-center', bg)}>
      <p className={cn('text-3xl font-black leading-none', color)}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1.5 font-medium">{label}</p>
    </div>
  )
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function Vertragsablaeufe() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filterSeverity, setFilterSeverity] = useState('all')
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verkaufschancen'] })
      setCreating(false)
    },
  })

  // Verträge mit Handlungsbedarf analysieren
  const actionableItems = useMemo(() => {
    return contracts
      .filter(c => {
        if (['cancelled', 'archived'].includes(c.status)) return false
        // expired: nur anzeigen wenn Kündigungsfrist noch relevant
        if (c.status === 'expired') {
          const cancelDays = c.cancellation_deadline ? Math.ceil((new Date(c.cancellation_deadline) - new Date()) / 86400000) : null
          return cancelDays !== null && cancelDays >= -30 && cancelDays <= 90
        }
        return true
      })
      .map(c => {
        const actions = analyzeContract(c)
        return { contract: c, actions, topAction: actions[0] }
      })
      .filter(item => item.actions.length > 0)
      .sort((a, b) => {
        const order = { critical: 0, red: 1, orange: 2, yellow: 3 }
        const ao = order[a.topAction?.severity] ?? 9
        const bo = order[b.topAction?.severity] ?? 9
        if (ao !== bo) return ao - bo
        return (a.topAction?.days ?? 999) - (b.topAction?.days ?? 999)
      })
  }, [contracts])

  // Filter anwenden
  const filtered = useMemo(() => {
    return actionableItems.filter(item => {
      if (filterSeverity !== 'all' && item.topAction?.severity !== filterSeverity) return false
      if (filterType !== 'all' && item.topAction?.type !== filterType) return false
      if (search) {
        const q = search.toLowerCase()
        const c = item.contract
        if (!(c.customer_name?.toLowerCase().includes(q) || c.insurer?.toLowerCase().includes(q) || c.policy_number?.toLowerCase().includes(q))) return false
      }
      return true
    })
  }, [actionableItems, filterSeverity, filterType, search])

  const stats = useMemo(() => ({
    critical: actionableItems.filter(i => i.topAction?.severity === 'critical').length,
    red:      actionableItems.filter(i => i.topAction?.severity === 'red').length,
    orange:   actionableItems.filter(i => i.topAction?.severity === 'orange').length,
    yellow:   actionableItems.filter(i => i.topAction?.severity === 'yellow').length,
  }), [actionableItems])

  const handleCreateVs = async (contract) => {
    setCreating(true)
    await createVsMutation.mutateAsync({
      customer_id:    contract.customer_id,
      customer_name:  contract.customer_name,
      organization_id: contract.organization_id,
      sparte:         contract.sparte || contract.insurance_type,
      status:         'neu',
      linked_contract_id: contract.id,
      title: `Verlängerung ${contract.insurer} – ${getSparteLabel(contract.sparte || contract.insurance_type) || ''}`,
      estimated_value: contract.premium_yearly || 0,
      notes: `Aus Vertragsablauf erstellt. Ablauf: ${contract.end_date ? new Date(contract.end_date).toLocaleDateString('de-CH') : '–'}`,
    })
    navigate('/verkaufschancen')
  }

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-orange-600" />
            Vertragsabläufe
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Operative Bestandsprozesse — Kündigungsfristen · Verlängerungen · Handlungsbedarf
          </p>
        </div>
        <Button onClick={() => navigate('/vertraege')} variant="outline" size="sm" className="gap-2">
          <Shield className="w-4 h-4" /> Alle Verträge
        </Button>
      </div>

      {/* ── KPI Tiles ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiTile label="Kritisch / Überfällig"  value={stats.critical} color="text-red-600"    bg="bg-red-50 border-red-200" />
        <KpiTile label="Dringend (0–30 Tage)"   value={stats.red}      color="text-red-500"    bg="bg-red-50 border-red-100" />
        <KpiTile label="Bald fällig (30–60 Tage)" value={stats.orange} color="text-orange-600" bg="bg-orange-50 border-orange-100" />
        <KpiTile label="Beobachten (60–90 Tage)" value={stats.yellow}  color="text-amber-600"  bg="bg-amber-50 border-amber-100" />
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────────────── */}
      <div className="flex gap-3 flex-wrap items-center">
        <Input
          placeholder="Suche nach Kunde, Versicherer, Police..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs h-9"
        />
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Dringlichkeit" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="critical">Kritisch</SelectItem>
            <SelectItem value="red">Dringend</SelectItem>
            <SelectItem value="orange">Bald fällig</SelectItem>
            <SelectItem value="yellow">Beobachten</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Typ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            <SelectItem value="kuendigung">Kündigungsfrist</SelectItem>
            <SelectItem value="ablauf">Vertragsablauf</SelectItem>
            <SelectItem value="dokument">Fehlende Dokumente</SelectItem>
          </SelectContent>
        </Select>
        {(search || filterSeverity !== 'all' || filterType !== 'all') && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterSeverity('all'); setFilterType('all') }} className="text-muted-foreground">
            Filter zurücksetzen
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} von {actionableItems.length} Aktionen</span>
      </div>

      {/* ── Contract List ────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Lädt...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/30">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-400" />
          <p className="text-lg font-bold text-emerald-700">
            {actionableItems.length === 0 ? 'Kein Handlungsbedarf' : 'Keine Einträge für diesen Filter'}
          </p>
          <p className="text-sm text-emerald-600 mt-1">
            {actionableItems.length === 0 ? 'Alle Verträge sind stabil — kein operativer Bedarf ✓' : 'Filter anpassen um alle Einträge zu sehen.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <ContractCard
              key={item.contract.id}
              item={item}
              onNavigate={navigate}
              onCreateVs={handleCreateVs}
              creating={creating}
              tasks={tasks}
            />
          ))}
        </div>
      )}
    </div>
  )
}