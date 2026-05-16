import React, { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  Search, Plus, Settings, Download, AlertTriangle, History, BarChart2, RefreshCw
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import {
  calcCommissionFields, calcStornoSaveData, calcKPIs, calcStornoByDimension, formatCHF, formatDate, validateCommissionForm,
  STATUS_META, canTransitionTo, getStatusDates, generateCSV, downloadCSV,
  normalizeLegacyEntry, DEFAULT_STORNO_PCT, roundCHF
} from '@/lib/commissionEngine'

import CommissionKPIBar from '@/components/commissions/CommissionKPIBar'
import CommissionTablePaginated from '@/components/commissions/CommissionTablePaginated'
import CommissionIntelligenceTab from '@/components/commissions/CommissionIntelligenceTab'
import AuditLogDialog from '@/components/commissions/AuditLogDialog'
import CommissionFormDialog from '@/components/commissions/CommissionFormDialog'
import PeriodSelector from '@/components/commissions/PeriodSelector'

const ALL_SPARTEN = ['KVG', 'VVG', 'Leben', 'Sach', 'KFZ', 'BVG', 'Rechtsschutz', 'Haftpflicht', 'Hausrat']

const STATUS_OPTIONS = [
  { value: 'pending',   label: 'Ausstehend' },
  { value: 'invoiced',  label: 'Eingereicht' },
  { value: 'received',  label: 'Erhalten' },
  { value: 'earned',    label: 'Freigegeben' },
  { value: 'paid',      label: 'Ausbezahlt' },
  { value: 'cancelled', label: 'Storniert' },
]

export default function CommissionsAndCourtage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [filterBroker, setFilterBroker] = useState('all')
  const [filterInsurer, setFilterInsurer] = useState('all')
  const [filterSparte, setFilterSparte] = useState('all')
  const [filterStatus, setFilterStatus] = useState('erwartet')
  const [periodFilter, setPeriodFilter] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAuditLog, setShowAuditLog] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [formData, setFormData] = useState({})
  const [formErrors, setFormErrors] = useState({})
  const [submitAttempted, setSubmitAttempted] = useState(false)

  // Initialize period with this month
  const defaultPeriod = useMemo(() => {
    const today = new Date()
    return {
      start: new Date(today.getFullYear(), today.getMonth(), 1),
      end: new Date(today.getFullYear(), today.getMonth() + 1, 0)
    }
  }, [])

  const actualPeriod = periodFilter || defaultPeriod

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ['commissionEntries'],
    queryFn: () => base44.entities.CommissionEntry.list('-entry_date', 5000),
    staleTime: 30_000,
  })
  const { data: organizations = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => base44.entities.Organization.filter({ status: 'active' }),
    staleTime: 60_000,
  })
  const { data: brokers = [] } = useQuery({
    queryKey: ['brokers'],
    queryFn: () => base44.entities.Broker.list(),
    staleTime: 60_000,
  })
  const { data: customers = [] } = useQuery({
    queryKey: ['customers-for-commission'],
    queryFn: () => base44.entities.Customer.list(null, 2000),
    staleTime: 60_000,
  })
  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts-for-commission'],
    queryFn: () => base44.entities.Contract.filter({ archived: false }, null, 5000),
    staleTime: 60_000,
  })
  const { data: auditLogs = [] } = useQuery({
    queryKey: ['auditLogs-commission'],
    queryFn: () => base44.entities.AuditLog.filter({ entity_type: 'commission' }, '-changed_at', 500),
    enabled: showAuditLog,
    staleTime: 10_000,
  })

  // ── Audit helper ─────────────────────────────────────────────────────────
  const writeAuditLog = useCallback(async (entityId, action, summary, oldValues, newValues) => {
    const user = await base44.auth.me().catch(() => null)
    base44.entities.AuditLog.create({
      entity_type: 'commission',
      entity_id: entityId,
      action,
      changed_by: user?.email || 'system',
      changed_at: new Date().toISOString(),
      summary,
      old_values: oldValues || {},
      new_values: newValues || {},
    }).catch(() => {})
  }, [])

  // ── Mutations ────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (data) => {
      // SECURITY GATE: Prüfe ob User darf erstellen
      const accessCheck = await base44.functions.invoke('guardCommissionAccess', {
        action: 'create',
        advisor_id: data.advisor_id,
      }).catch(e => ({ data: { allowed: false, reason: e.message } }));
      
      if (!accessCheck.data?.allowed) {
        throw new Error(`Zugriff verweigert: ${accessCheck.data?.reason || 'Keine Berechtigung'}`);
      }

      return base44.entities.CommissionEntry.create(data.is_storno ? data : calcCommissionFields(data));
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['commissionEntries'] })
      const c = normalizeLegacyEntry(created)
      writeAuditLog(created.id, 'create',
        `Abrechnung erfasst: ${created.insurer} – ${created.customer_name} | Courtage: ${formatCHF(c.advisor_courtage_amount)} | Provision: ${formatCHF(c.advisor_provision_amount)}`,
        {}, created)
      setShowForm(false); resetForm()
      // Keine Toast-Meldung bei erfolgreichem Speichern
    },
    onError: (err) => toast({ title: 'Fehler beim Speichern', description: err.message, variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data, oldData }) =>
      base44.entities.CommissionEntry.update(id, data.is_storno ? data : calcCommissionFields(data)).then(r => ({ result: r, oldData })),
    onSuccess: ({ result, oldData }) => {
      queryClient.invalidateQueries({ queryKey: ['commissionEntries'] })
      const c = normalizeLegacyEntry(result)
      writeAuditLog(result.id, 'update',
        `Abrechnung bearbeitet: ${result.insurer} – ${result.customer_name} | Courtage: ${formatCHF(c.advisor_courtage_amount)} | Provision: ${formatCHF(c.advisor_provision_amount)}`,
        oldData, result)
      setShowForm(false); resetForm()
      // Keine Toast-Meldung bei erfolgreichem Update
    },
    onError: (err) => toast({ title: 'Fehler beim Aktualisieren', description: err.message, variant: 'destructive' }),
  })

  const archiveMutation = useMutation({
    mutationFn: ({ id, entry }) =>
      base44.entities.CommissionEntry.update(id, { archived: true, archived_at: new Date().toISOString() })
        .then(r => ({ result: r, entry })),
    onSuccess: ({ entry }) => {
      queryClient.invalidateQueries({ queryKey: ['commissionEntries'] })
      writeAuditLog(entry.id, 'archive', `Archiviert: ${entry.insurer} – ${entry.customer_name}`, entry, { ...entry, archived: true })
      toast({ title: 'Eintrag archiviert' })
    },
    onError: (err) => toast({ title: 'Fehler beim Archivieren', description: err.message, variant: 'destructive' }),
  })

  const statusChangeMutation = useMutation({
    mutationFn: ({ id, newStatus, entry, type }) => {
      const updates = getStatusDates(newStatus, type)
      return base44.entities.CommissionEntry.update(id, updates).then(r => ({ result: r, entry, newStatus, type }))
    },
    onSuccess: ({ result, entry, newStatus, type }) => {
      queryClient.invalidateQueries({ queryKey: ['commissionEntries'] })
      const label = type === 'courtage' ? 'Courtage' : 'Provision'
      const to = STATUS_META[newStatus]?.label || newStatus
      writeAuditLog(result.id, 'update',
        `${label} Status geändert → ${to} (${entry.customer_name})`,
        { [`${type}_status`]: entry[`${type}_status`] || entry.status },
        { [`${type}_status`]: newStatus })
      // Keine Toast-Meldung bei erfolgreichem Statuswechsel
    },
    onError: (err) => toast({ title: 'Fehler bei Statusänderung', description: err.message, variant: 'destructive' }),
  })

  // ── Form helpers ─────────────────────────────────────────────────────────
  const resetForm = () => {
    setFormData({}); setEditingEntry(null); setFormErrors({}); setSubmitAttempted(false)
  }

  const handleNewEntry = () => {
    setFormData({
      status: 'pending', courtage_status: 'pending', provision_status: 'pending',
      entry_date: new Date().toISOString().split('T')[0],
      advisor_courtage_percentage: 0, advisor_provision_percentage: 0,
      courtage_storno_percentage: DEFAULT_STORNO_PCT,
      provision_storno_percentage: DEFAULT_STORNO_PCT,
      premium_yearly: 0,
    })
    setEditingEntry(null); setFormErrors({}); setSubmitAttempted(false); setShowForm(true)
  }

  const handleEditEntry = (entry) => {
    const ne = normalizeLegacyEntry(entry)
    setFormData({ ...ne })
    setEditingEntry(entry); setFormErrors({}); setSubmitAttempted(false); setShowForm(true)
  }

  const handleFormChange = useCallback((updates) => {
    setFormData(prev => {
      const next = { ...prev, ...updates }
      if (submitAttempted) setFormErrors(validateCommissionForm(next))
      return next
    })
  }, [submitAttempted])

  const handleSave = () => {
    setSubmitAttempted(true)
    const errors = validateCommissionForm(formData)
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return
    if (createMutation.isPending || updateMutation.isPending) return
    let saveData = { ...formData }
    if (saveData.is_storno) {
      // Storno: vollständige Persistierung aller Berechnungsfelder via calcStornoSaveData
      saveData = calcStornoSaveData(saveData, null)
    }

    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data: saveData, oldData: editingEntry })
    } else {
      if (formData.policy_number) {
        const dup = entries.find(e =>
          !e.archived && e.policy_number === formData.policy_number && e.insurer === formData.insurer
        )
        if (dup) {
          toast({ title: 'Mögliches Duplikat', description: `Police "${formData.policy_number}" bei ${formData.insurer} existiert bereits.`, variant: 'destructive' })
          return
        }
      }
      createMutation.mutate(saveData)
    }
  }

  const handleStatusChange = (entry, newStatus, type = 'courtage') => {
    const currentStatus = type === 'courtage'
      ? (entry.courtage_status || entry.status || 'pending')
      : (entry.provision_status || 'pending')
    if (!canTransitionTo(currentStatus, newStatus)) {
      toast({
        title: 'Ungültiger Statuswechsel',
        description: `Von "${STATUS_META[currentStatus]?.label}" nicht direkt zu "${STATUS_META[newStatus]?.label}" möglich.`,
        variant: 'destructive'
      })
      return
    }
    statusChangeMutation.mutate({ id: entry.id, newStatus, entry, type })
  }

  // ── Derived data ─────────────────────────────────────────────────────────
  const activeEntries = useMemo(() => entries.filter(e => !e.archived), [entries])

  const filteredEntries = useMemo(() => {
    return activeEntries.filter(e => {
      const ne = normalizeLegacyEntry(e)
      const searchStr = `${e.customer_name} ${e.insurer} ${e.product_category} ${e.advisor_name} ${e.policy_number}`.toLowerCase()
      const matchSearch = !search.trim() || searchStr.includes(search.toLowerCase())
      const matchBroker = filterBroker === 'all' || e.advisor_id === filterBroker
      const matchInsurer = filterInsurer === 'all' || e.insurer === filterInsurer
      const matchSparte = filterSparte === 'all' || e.product_category === filterSparte
      const cStatus = ne.courtage_status || e.status || 'pending'
      const pStatus = ne.provision_status || e.status || 'pending'
      // COMPAT: Filter "erwartet" prüft BOTH courtage_status + provision_status
      const matchStatus = filterStatus === 'all' || 
        (filterStatus === 'erwartet' && ((cStatus === 'erwartet' || cStatus === 'pending') || (pStatus === 'erwartet' || pStatus === 'pending'))) || 
        cStatus === filterStatus || pStatus === filterStatus
      
      // Dynamic period filtering — parse date as local (YYYY-MM-DD) to avoid UTC offset issues
      const rawDate = e.courtage_received_date || e.provision_received_date || e.entry_date
      const entryDate = rawDate ? (() => { const [y,m,d] = rawDate.split('-'); return new Date(+y, +m-1, +d) })() : null
      const matchPeriod = !entryDate || (entryDate >= actualPeriod.start && entryDate <= actualPeriod.end)
      
      return matchSearch && matchBroker && matchInsurer && matchSparte && matchStatus && matchPeriod
    })
  }, [activeEntries, search, filterBroker, filterInsurer, filterSparte, filterStatus, actualPeriod])

  // 🔴 CRITICAL: Broker stats now uses central calcKPIs for consistency
  const brokerStats = useMemo(() => {
    const map = {}
    // Build per-broker aggregates using same logic as calcKPIs
    const normalized = activeEntries.map(normalizeLegacyEntry).filter(e => !e.archived && (e.courtage_status || e.status) !== 'cancelled')
    normalized.forEach(e => {
      const key = e.advisor_id || '–'
      if (!map[key]) map[key] = {
        name: e.advisor_name || '–',
        courtage: 0, advisorCourtage: 0, provision: 0, advisorProvision: 0,
        courtage_paid: 0, provision_paid: 0, count: 0,
      }
      map[key].courtage          += e.company_courtage_amount || 0
      map[key].advisorCourtage   += e.advisor_courtage_amount || 0  // Brutto
      map[key].provision         += e.company_provision_amount || 0
      map[key].advisorProvision  += e.advisor_provision_amount || 0  // Brutto
      map[key].count             += 1
      if ((e.courtage_status || e.status) === 'paid')   map[key].courtage_paid  += e.courtage_payout_amount || e.advisor_courtage_amount || 0
      if ((e.provision_status || 'pending') === 'paid')   map[key].provision_paid += e.provision_payout_amount || e.advisor_provision_amount || 0
    })
    return Object.values(map).sort((a, b) => b.advisorCourtage - a.advisorCourtage)
  }, [activeEntries])

  const stornoEntries = useMemo(() =>
    activeEntries.filter(e => (e.courtage_status || e.status) === 'cancelled'),
    [activeEntries])

  const uniqueBrokers = useMemo(() =>
    [...new Map(activeEntries.filter(e => e.advisor_id)
      .map(e => [e.advisor_id, { id: e.advisor_id, name: e.advisor_name || e.advisor_id }])).values()],
    [activeEntries])
  const uniqueInsurers = useMemo(() =>
    [...new Set(activeEntries.map(e => e.insurer).filter(Boolean))],
    [activeEntries])

  const handleCSVExport = () => {
    const startStr = actualPeriod.start.toLocaleDateString('de-CH').replace(/\./g, '-')
    const endStr = actualPeriod.end.toLocaleDateString('de-CH').replace(/\./g, '-')
    // 🔴 CRITICAL: Add KPI totals row to CSV for verification
    const kpi = calcKPIs(filteredEntries)
    const csvContent = generateCSV(filteredEntries)
    const totalsRow = `"TOTALE PERIODE","","","","","",${kpi.totalCourtageReceived.toFixed(2)},${kpi.totalAdvisorCourtage.toFixed(2)},"","","","",${kpi.totalProvisionReceived.toFixed(2)},${kpi.totalAdvisorProvision.toFixed(2)},"","",""` 
    downloadCSV(csvContent + '\n' + totalsRow, `courtagen_provisionen_${startStr}_bis_${endStr}.csv`)
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Provisionen & Courtagen
            {!loadingEntries && <span className="text-muted-foreground text-lg font-normal ml-2">({activeEntries.length})</span>}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gesellschaftscourtagen · Beraterprovision · Revisionssichere Verwaltung
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['commissionEntries'] })} variant="outline" size="sm" title="Daten neu laden">
            <RefreshCw className="w-4 h-4 mr-1.5 md:mr-2" /><span className="hidden md:inline">Aktualisieren</span>
          </Button>
          <Button onClick={() => setShowAuditLog(true)} variant="outline" size="sm">
            <History className="w-4 h-4 mr-1.5 md:mr-2" /><span className="hidden md:inline">Audit Log</span>
          </Button>
          <Button onClick={handleCSVExport} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-1.5 md:mr-2" /><span className="hidden md:inline">Export</span>
          </Button>
          <Button onClick={() => setShowSettings(true)} variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-1.5 md:mr-2" /><span className="hidden md:inline">Einstellungen</span>
          </Button>
          <Button onClick={handleNewEntry}>
            <Plus className="w-4 h-4 mr-1.5 md:mr-2" /><span className="hidden sm:inline">Neue Abrechnung</span><span className="sm:hidden">Neu</span>
          </Button>
        </div>
      </div>

      {/* Expected Provisions Alert - PROMINENT */}
      {(() => {
        const expectedCount = activeEntries.filter(e => {
          const pStatus = e.provision_status || e.status || 'pending'
          return pStatus === 'erwartet' || pStatus === 'pending'
        }).length
        const expectedAmount = activeEntries
          .filter(e => {
            const pStatus = e.provision_status || e.status || 'pending'
            return pStatus === 'erwartet' || pStatus === 'pending'
          })
          .reduce((s, e) => s + (e.advisor_provision_amount || 0), 0)

        if (expectedCount > 0) {
          return (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="text-3xl">💰</div>
                <div className="flex-1">
                  <h3 className="font-bold text-amber-900 text-lg">{expectedCount} erwartete Provisionen</h3>
                  <p className="text-amber-800 text-sm mt-1">
                    Gesamtbetrag: <span className="font-bold text-base">{formatCHF(expectedAmount)}</span> · Diese Provisionen sind aus aktiven Verträgen ausstehend
                  </p>
                  <Button 
                    onClick={() => { setFilterStatus('erwartet'); document.querySelector('[value="provisions"]')?.click() }}
                    className="mt-3 bg-amber-600 hover:bg-amber-700"
                  >
                    📋 Erwartete Provisionen anzeigen
                  </Button>
                </div>
              </div>
            </div>
          )
        }
        return null
      })()}

      {/* Period Selector */}
       <div className="bg-muted/20 p-4 rounded-lg border border-border">
          <PeriodSelector 
            onPeriodChange={setPeriodFilter}
            initialPeriod="this_month"
          />
        </div>

      {/* KPI Bar */}
       <CommissionKPIBar 
         entries={filteredEntries} 
         filteredEntries={filteredEntries}
         period={actualPeriod}
       />

      {/* Storno Banner - 🔴 CRITICAL: Use central storno analysis */}
       {stornoEntries.length > 0 && (() => {
         const stornoAnalysis = calcStornoByDimension(stornoEntries, 'advisor_id', 'advisor_name')
         const totalStornoCourtage = stornoAnalysis.reduce((s, d) => s + d.commissionLost, 0)  // Total from all dimensions
         const totalStornoProvision = stornoEntries.reduce((s, e) => {
           const ne = normalizeLegacyEntry(e)
           return s + (ne.advisor_provision_amount || 0)
         }, 0)
         return (
           <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
             <AlertTriangle className="w-4 h-4 flex-shrink-0" />
             <span>
               <strong>{stornoEntries.length} stornierte</strong> Einträge ·
               Courtage-Verlust Berater: <strong>{formatCHF(totalStornoCourtage)}</strong>
               {totalStornoProvision > 0 && (
                 <span> · Provisions-Verlust: <strong>{formatCHF(totalStornoProvision)}</strong></span>
               )}
             </span>
           </div>
         )
       })()}

      {/* Main Tabs */}
      <Tabs defaultValue="provisions">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="provisions">Provisionen ({filteredEntries.length})</TabsTrigger>
          <TabsTrigger value="courtage">Courtagen ({filteredEntries.length})</TabsTrigger>
          <TabsTrigger value="berater">Berater ({brokerStats.length})</TabsTrigger>
          <TabsTrigger value="storno">Stornos ({stornoEntries.length})</TabsTrigger>
          <TabsTrigger value="intelligence" className="flex items-center gap-1">
            <BarChart2 className="w-3.5 h-3.5" /> BI & Analytics
          </TabsTrigger>
        </TabsList>

        {/* ── Provisionen ── */}
        <TabsContent value="provisions" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-44">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Suche (Kunde, Gesellschaft, Police...)" value={search}
                onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
            {uniqueBrokers.length > 0 && (
              <Select value={filterBroker} onValueChange={setFilterBroker}>
                <SelectTrigger className="w-40 h-9 text-sm"><SelectValue placeholder="Alle Berater" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Berater</SelectItem>
                  {uniqueBrokers.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {uniqueInsurers.length > 0 && (
              <Select value={filterInsurer} onValueChange={setFilterInsurer}>
                <SelectTrigger className="w-40 h-9 text-sm"><SelectValue placeholder="Alle Gesellsch." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Gesellschaften</SelectItem>
                  {uniqueInsurers.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={filterSparte} onValueChange={setFilterSparte}>
              <SelectTrigger className="w-36 h-9 text-sm"><SelectValue placeholder="Alle Sparten" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Sparten</SelectItem>
                {ALL_SPARTEN.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 h-9 text-sm"><SelectValue placeholder="Alle Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <CommissionTablePaginated
            entries={filteredEntries}
            loading={loadingEntries}
            onEdit={handleEditEntry}
            onArchive={(entry) => archiveMutation.mutate({ id: entry.id, entry })}
            onStatusChange={handleStatusChange}
          />
        </TabsContent>

        {/* ── Courtagen ── */}
        <TabsContent value="courtage" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-44">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Suche (Kunde, Gesellschaft, Police...)" value={search}
                onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
            {uniqueBrokers.length > 0 && (
              <Select value={filterBroker} onValueChange={setFilterBroker}>
                <SelectTrigger className="w-40 h-9 text-sm"><SelectValue placeholder="Alle Berater" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Berater</SelectItem>
                  {uniqueBrokers.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {uniqueInsurers.length > 0 && (
              <Select value={filterInsurer} onValueChange={setFilterInsurer}>
                <SelectTrigger className="w-40 h-9 text-sm"><SelectValue placeholder="Alle Gesellsch." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Gesellschaften</SelectItem>
                  {uniqueInsurers.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={filterSparte} onValueChange={setFilterSparte}>
              <SelectTrigger className="w-36 h-9 text-sm"><SelectValue placeholder="Alle Sparten" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Sparten</SelectItem>
                {ALL_SPARTEN.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 h-9 text-sm"><SelectValue placeholder="Alle Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <CommissionTablePaginated
            entries={filteredEntries.filter(e => {
              const ne = normalizeLegacyEntry(e);
              return ne.company_courtage_amount > 0 || ne.advisor_courtage_amount > 0;
            })}
            loading={loadingEntries}
            onEdit={handleEditEntry}
            onArchive={(entry) => archiveMutation.mutate({ id: entry.id, entry })}
            onStatusChange={handleStatusChange}
          />
        </TabsContent>

        {/* ── Berater ── */}
        <TabsContent value="berater" className="mt-4">
          <div className="rounded-xl border bg-card shadow overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left py-3 px-4 font-semibold">Berater</th>
                  <th className="text-right py-3 px-4 font-semibold">Anzahl</th>
                  <th className="text-right py-3 px-4 font-semibold text-blue-700 bg-blue-50/40">Beratercourtage</th>
                  <th className="text-right py-3 px-4 font-semibold text-blue-600 bg-blue-50/40">C. Ausbez.</th>
                  <th className="text-right py-3 px-4 font-semibold text-blue-500 bg-blue-50/40">C. Offen</th>
                  <th className="text-right py-3 px-4 font-semibold text-emerald-700 bg-emerald-50/40 border-l border-emerald-200">Beraterprovision</th>
                  <th className="text-right py-3 px-4 font-semibold text-emerald-600 bg-emerald-50/40">P. Ausbez.</th>
                  <th className="text-right py-3 px-4 font-semibold text-emerald-500 bg-emerald-50/40">P. Offen</th>
                </tr>
              </thead>
              <tbody>
                {brokerStats.length === 0 ? (
                  <tr><td colSpan="8" className="text-center py-8 text-muted-foreground">Keine Daten</td></tr>
                ) : brokerStats.map((b, i) => (
                  <tr key={i} className="border-b hover:bg-muted/30">
                    <td className="py-3 px-4 font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                          {b.name[0]?.toUpperCase()}
                        </div>
                        <span className="truncate">{b.name}</span>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 text-muted-foreground">{b.count}</td>
                    <td className="text-right py-3 px-4 font-semibold text-blue-700 bg-blue-50/20">{formatCHF(b.advisorCourtage)}</td>
                    <td className="text-right py-3 px-4 text-blue-600 bg-blue-50/20">{formatCHF(b.courtage_paid)}</td>
                    <td className="text-right py-3 px-4 text-blue-500 bg-blue-50/20">{formatCHF(b.advisorCourtage - b.courtage_paid)}</td>
                    <td className="text-right py-3 px-4 font-semibold text-emerald-700 bg-emerald-50/20 border-l border-emerald-100">{formatCHF(b.advisorProvision)}</td>
                    <td className="text-right py-3 px-4 text-emerald-600 bg-emerald-50/20">{formatCHF(b.provision_paid)}</td>
                    <td className="text-right py-3 px-4 text-emerald-500 bg-emerald-50/20">{formatCHF(b.advisorProvision - b.provision_paid)}</td>
                  </tr>
                ))}
              </tbody>
              {brokerStats.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/40 font-bold">
                    <td className="py-3 px-4">Total</td>
                    <td className="text-right py-3 px-4">{brokerStats.reduce((s, b) => s + b.count, 0)}</td>
                    <td className="text-right py-3 px-4 text-blue-700 bg-blue-50/20">{formatCHF(brokerStats.reduce((s, b) => s + b.advisorCourtage, 0))}</td>
                    <td className="text-right py-3 px-4 text-blue-600 bg-blue-50/20">{formatCHF(brokerStats.reduce((s, b) => s + b.courtage_paid, 0))}</td>
                    <td className="text-right py-3 px-4 text-blue-500 bg-blue-50/20">{formatCHF(brokerStats.reduce((s, b) => s + (b.advisorCourtage - b.courtage_paid), 0))}</td>
                    <td className="text-right py-3 px-4 text-emerald-700 bg-emerald-50/20 border-l border-emerald-100">{formatCHF(brokerStats.reduce((s, b) => s + b.advisorProvision, 0))}</td>
                    <td className="text-right py-3 px-4 text-emerald-600 bg-emerald-50/20">{formatCHF(brokerStats.reduce((s, b) => s + b.provision_paid, 0))}</td>
                    <td className="text-right py-3 px-4 text-emerald-500 bg-emerald-50/20">{formatCHF(brokerStats.reduce((s, b) => s + (b.advisorProvision - b.provision_paid), 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </TabsContent>

        {/* ── Storno ── */}
        <TabsContent value="storno" className="mt-4">
          <div className="rounded-xl border bg-card shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left py-3 px-4 font-semibold">Datum</th>
                  <th className="text-left py-3 px-4 font-semibold hidden md:table-cell">Gesellschaft</th>
                  <th className="text-left py-3 px-4 font-semibold hidden lg:table-cell">Berater</th>
                  <th className="text-left py-3 px-4 font-semibold">Kunde</th>
                  <th className="text-left py-3 px-4 font-semibold hidden md:table-cell">Sparte</th>
                  <th className="text-right py-3 px-4 font-semibold text-blue-700">Courtage-Verlust</th>
                  <th className="text-right py-3 px-4 font-semibold text-emerald-700">Provisions-Verlust</th>
                </tr>
              </thead>
              <tbody>
                {stornoEntries.length === 0 ? (
                  <tr><td colSpan="7" className="text-center py-8 text-muted-foreground">Keine Storni vorhanden ✓</td></tr>
                ) : stornoEntries.map(e => {
                  const ne = normalizeLegacyEntry(e)
                  return (
                    <tr key={e.id} className="border-b hover:bg-red-50/40">
                      <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">{formatDate(e.entry_date)}</td>
                      <td className="py-3 px-4 hidden md:table-cell">{e.insurer}</td>
                      <td className="py-3 px-4 hidden lg:table-cell">{e.advisor_name || '–'}</td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-xs">{e.customer_name}</p>
                        <p className="text-xs text-muted-foreground md:hidden">{e.insurer}</p>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs hidden md:table-cell">{e.product_category || '–'}</td>
                      <td className="text-right py-3 px-4 font-bold text-blue-600">
                        {ne.advisor_courtage_amount ? `–${formatCHF(ne.advisor_courtage_amount)}` : '–'}
                      </td>
                      <td className="text-right py-3 px-4 font-semibold text-emerald-600">
                        {ne.advisor_provision_amount ? `–${formatCHF(ne.advisor_provision_amount)}` : '–'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {stornoEntries.length > 0 && (
                <tfoot>
                  <tr className="bg-red-50 font-bold text-red-700">
                    <td colSpan="5" className="py-3 px-4">Total Storno-Verlust (Berater)</td>
                    <td className="text-right py-3 px-4 text-blue-700">
                      –{formatCHF(stornoEntries.reduce((s, e) => s + (normalizeLegacyEntry(e).advisor_courtage_amount || 0), 0))}
                    </td>
                    <td className="text-right py-3 px-4 text-emerald-700">
                      –{formatCHF(stornoEntries.reduce((s, e) => s + (normalizeLegacyEntry(e).advisor_provision_amount || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </TabsContent>

        {/* ── BI & Analytics ── */}
         <TabsContent value="intelligence" className="mt-4">
           <CommissionIntelligenceTab entries={filteredEntries} period={actualPeriod} />
         </TabsContent>
      </Tabs>

      {/* Form Dialog */}
      <CommissionFormDialog
        open={showForm}
        onClose={() => { setShowForm(false); resetForm() }}
        editingEntry={editingEntry}
        formData={formData}
        formErrors={formErrors}
        submitAttempted={submitAttempted}
        onChange={handleFormChange}
        onSave={handleSave}
        isSaving={isSaving}
        customers={customers}
        contracts={contracts}
        brokers={brokers}
        organizations={organizations}
      />

      {/* Audit Log */}
      <AuditLogDialog
        open={showAuditLog}
        onClose={() => setShowAuditLog(false)}
        auditLogs={auditLogs}
      />

      {/* Settings */}
      <Dialog open={showSettings} onOpenChange={(open) => setShowSettings(open)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Einstellungen – Courtagen & Provisionen</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm max-h-[60vh] overflow-y-auto pr-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
              <p className="font-bold text-blue-800 flex items-center gap-1.5">Courtage-Formel</p>
              <p className="font-mono text-blue-700 bg-blue-100 rounded px-2 py-1 text-xs">
                Beratercourtage = Gesellschaftscourtage × Beratercourtage-%
              </p>
              <p className="text-xs text-blue-600">Beispiel: CHF 2'400 × 50% = CHF 1'200 Beratercourtage</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-1">
              <p className="font-bold text-emerald-800">Provisions-Formel</p>
              <p className="font-mono text-emerald-700 bg-emerald-100 rounded px-2 py-1 text-xs">
                Beraterprovision = Gesellschaftsprovision × Beraterprovision-%
              </p>
              <p className="text-xs text-emerald-600">Beispiel: CHF 500 × 80% = CHF 400 Beraterprovision</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-1">
              <p className="font-bold text-orange-800">Stornoreserve-Logik</p>
              <p className="font-mono text-orange-700 bg-orange-100 rounded px-2 py-1 text-xs">
                Netto Auszahlung = Brutto − (Brutto × Storno-%)
              </p>
              <p className="text-xs text-orange-700">Standard: 10% · Beispiel: CHF 1'000 Brutto − CHF 100 Reserve = CHF 900 Netto</p>
              <p className="text-xs text-orange-600">Pro Eintrag konfigurierbar. Auszahlungen basieren immer auf Netto.</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
              <p className="font-bold text-amber-800">Fachliche Trennung</p>
              <p className="text-xs text-amber-700">Courtage und Provision werden vollständig getrennt verwaltet – inkl. separater Stornoreserven, Status und Auszahlungslogik.</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-3 space-y-1">
              <p className="font-semibold">Status-Workflow (gilt für Courtage + Provision je separat)</p>
              <p className="text-muted-foreground text-xs">pending → invoiced → received → earned → paid</p>
              <p className="text-xs text-muted-foreground">Jeder Status kann zu «Storniert» wechseln. Terminal: paid, cancelled.</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowSettings(false)}>Schliessen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}