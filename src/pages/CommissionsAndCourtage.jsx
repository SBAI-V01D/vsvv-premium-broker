import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Search, Plus, Settings, Download, AlertTriangle, X, User, CheckCircle2,
  Calculator, TrendingUp, Clock, ShieldCheck, FileText, History, BarChart2
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import {
  calcCommissionFields, formatCHF, formatDate, validateCommissionForm,
  STATUS_TRANSITIONS, STATUS_META, canTransitionTo, getStatusDates,
  generateCSV, downloadCSV
} from '@/lib/commissionEngine'

// Subcomponents
import CommissionKPIBar from '@/components/commissions/CommissionKPIBar'
import CommissionTablePaginated from '@/components/commissions/CommissionTablePaginated'
import CommissionIntelligenceTab from '@/components/commissions/CommissionIntelligenceTab'
import AuditLogDialog from '@/components/commissions/AuditLogDialog'

// ─── Constants ───────────────────────────────────────────────────────────────
const SWISS_INSURERS = [
  'Allianz', 'Axa', 'Baloise', 'CSS', 'Concordia', 'Die Mobiliar', 'Elvia', 'Generali',
  'Helvetia', 'Helsana', 'Mutuel', 'ÖKK', 'SWICA', 'Sanitas', 'Smile', 'Suva',
  'Swiss Life', 'Swiss Re', 'TCS', 'Visana', 'Zurich', 'Andere',
]
const ALL_SPARTEN = ['KVG', 'VVG', 'Leben', 'Sach', 'KFZ', 'BVG', 'Rechtsschutz', 'Haftpflicht', 'Hausrat']

// STATUS_OPTIONS with icons for form display (engine has STATUS_META for table)
const STATUS_OPTIONS_WITH_ICONS = [
  { value: 'pending',   label: 'Ausstehend',  icon: Clock },
  { value: 'invoiced',  label: 'Eingereicht', icon: FileText },
  { value: 'received',  label: 'Erhalten',    icon: TrendingUp },
  { value: 'earned',    label: 'Freigegeben', icon: ShieldCheck },
  { value: 'paid',      label: 'Ausbezahlt',  icon: CheckCircle2 },
  { value: 'cancelled', label: 'Storniert',   icon: X },
]

// ─── Customer Search ──────────────────────────────────────────────────────────
function CustomerSearchField({ value, customerId, onChange, customers }) {
  const [query, setQuery] = useState(value || '')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => { setQuery(value || '') }, [value])
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = useMemo(() => {
    if (!query.trim() || query.length < 2) return []
    const q = query.toLowerCase()
    return customers.filter(c =>
      `${c.first_name || ''} ${c.last_name || ''} ${c.company_name || ''} ${c.customer_number || ''} ${c.email || ''}`.toLowerCase().includes(q)
    ).slice(0, 10)
  }, [query, customers])

  const handleSelect = (customer) => {
    const name = customer.company_name || `${customer.first_name} ${customer.last_name}`
    setQuery(name); setOpen(false)
    onChange({ customer_id: customer.id, customer_name: name })
  }

  const handleClear = () => { setQuery(''); onChange({ customer_id: '', customer_name: '' }) }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={query} onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="Name, Kundennummer, E-Mail suchen..."
          className={`pl-9 pr-8 mt-1 ${customerId ? 'border-green-400 bg-green-50/30' : ''}`} />
        {(query || customerId) && (
          <button onClick={handleClear} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {customerId && (
        <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Kunde verknüpft
        </p>
      )}
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtered.map(c => {
            const name = c.company_name || `${c.first_name} ${c.last_name}`
            return (
              <button key={c.id} onMouseDown={e => { e.preventDefault(); handleSelect(c) }}
                className="w-full text-left px-3 py-2.5 hover:bg-muted/50 flex items-center gap-2 text-sm border-b last:border-0">
                <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.customer_number && <span className="mr-2">{c.customer_number}</span>}
                    {c.email}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}
      {open && query.length >= 2 && filtered.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-border rounded-lg shadow-sm px-3 py-2 text-sm text-muted-foreground">
          Kein Kunde gefunden
        </div>
      )}
    </div>
  )
}

// ─── Commission Preview ───────────────────────────────────────────────────────
function CommissionPreview({ data }) {
  const calc = calcCommissionFields(data)
  if (!calc.received_amount) return null
  return (
    <div className="rounded-lg border overflow-hidden text-sm">
      <div className="bg-blue-50 border-b border-blue-200 px-3 py-1.5">
        <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">Berechnungsvorschau</p>
      </div>
      <div className="bg-blue-50/50 p-3 grid grid-cols-2 gap-x-4 gap-y-2">
        <div>
          <p className="text-xs text-muted-foreground uppercase font-semibold">Jahresprämie (Referenz)</p>
          <p className="font-semibold text-foreground">{formatCHF(calc.premium_yearly)}</p>
        </div>
        <div>
          <p className="text-xs text-blue-600 uppercase font-semibold">Erhaltene Gesellschaftscourtage</p>
          <p className="font-bold text-blue-800">{formatCHF(calc.received_amount)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase font-semibold">Berateranteil</p>
          <p className="font-semibold text-foreground">{calc.commission_percentage}%</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded p-1.5">
          <p className="text-xs text-green-600 uppercase font-bold">= Beraterprovision</p>
          <p className="font-bold text-green-700 text-lg leading-tight">{formatCHF(calc.commission_amount)}</p>
          <p className="text-xs text-green-600 mt-0.5">{formatCHF(calc.received_amount)} × {calc.commission_percentage}%</p>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CommissionsAndCourtage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [filterBroker, setFilterBroker] = useState('all')
  const [filterInsurer, setFilterInsurer] = useState('all')
  const [filterSparte, setFilterSparte] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString())
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [showForm, setShowForm] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAuditLog, setShowAuditLog] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [formData, setFormData] = useState({})
  const [formErrors, setFormErrors] = useState({})
  const [submitAttempted, setSubmitAttempted] = useState(false)

  // ── Data queries ─────────────────────────────────────────────────────────
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

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['auditLogs-commission'],
    queryFn: () => base44.entities.AuditLog.filter({ entity_type: 'commission' }, '-changed_at', 500),
    enabled: showAuditLog,
    staleTime: 10_000,
  })

  // ── Audit log helper ─────────────────────────────────────────────────────
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
    mutationFn: (data) => base44.entities.CommissionEntry.create(calcCommissionFields(data)),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['commissionEntries'] })
      writeAuditLog(created.id, 'create',
        `Neue Provision erfasst: ${created.insurer} – ${created.customer_name} – ${formatCHF(created.commission_amount)}`,
        {}, created)
      toast({ title: 'Abrechnung gespeichert', description: `${formatCHF(created.commission_amount)} für ${created.customer_name}` })
      setShowForm(false); resetForm()
    },
    onError: (err) => {
      toast({ title: 'Fehler beim Speichern', description: err.message || 'Unbekannter Fehler', variant: 'destructive' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data, oldData }) =>
      base44.entities.CommissionEntry.update(id, calcCommissionFields(data)).then(r => ({ result: r, oldData })),
    onSuccess: ({ result, oldData }) => {
      queryClient.invalidateQueries({ queryKey: ['commissionEntries'] })
      writeAuditLog(result.id, 'update',
        `Provision bearbeitet: ${result.insurer} – ${result.customer_name} – Status: ${result.status}`,
        oldData, result)
      toast({ title: 'Änderungen gespeichert' })
      setShowForm(false); resetForm()
    },
    onError: (err) => {
      toast({ title: 'Fehler beim Aktualisieren', description: err.message || 'Unbekannter Fehler', variant: 'destructive' })
    },
  })

  const archiveMutation = useMutation({
    mutationFn: ({ id, entry }) =>
      base44.entities.CommissionEntry.update(id, { archived: true, archived_at: new Date().toISOString() })
        .then(r => ({ result: r, entry })),
    onSuccess: ({ entry }) => {
      queryClient.invalidateQueries({ queryKey: ['commissionEntries'] })
      writeAuditLog(entry.id, 'archive',
        `Provision archiviert: ${entry.insurer} – ${entry.customer_name}`,
        entry, { ...entry, archived: true })
      toast({ title: 'Eintrag archiviert', description: 'Eintrag bleibt im Audit Log erhalten.' })
    },
    onError: (err) => {
      toast({ title: 'Fehler beim Archivieren', description: err.message, variant: 'destructive' })
    },
  })

  const statusChangeMutation = useMutation({
    mutationFn: ({ id, newStatus, entry }) => {
      const updates = getStatusDates(newStatus)
      return base44.entities.CommissionEntry.update(id, updates).then(r => ({ result: r, entry, newStatus }))
    },
    onSuccess: ({ result, entry, newStatus }) => {
      queryClient.invalidateQueries({ queryKey: ['commissionEntries'] })
      const from = STATUS_META[entry.status] || STATUS_META.pending
      const to = STATUS_META[newStatus] || STATUS_META.pending
      writeAuditLog(result.id, 'update',
        `Status geändert: ${from.label} → ${to.label} (${entry.customer_name})`,
        { status: entry.status }, { status: newStatus })
      toast({ title: `Status: ${to.label}`, description: `${entry.customer_name} – ${entry.insurer}` })
    },
    onError: (err) => {
      toast({ title: 'Fehler bei Statusänderung', description: err.message, variant: 'destructive' })
    },
  })

  // ── Helpers ──────────────────────────────────────────────────────────────
  const resetForm = () => {
    setFormData({}); setEditingEntry(null); setFormErrors({}); setSubmitAttempted(false)
  }

  const handleNewEntry = () => {
    setFormData({ status: 'pending', entry_date: new Date().toISOString().split('T')[0], commission_percentage: 0, premium_yearly: 0 })
    setEditingEntry(null); setFormErrors({}); setSubmitAttempted(false); setShowForm(true)
  }

  const handleEditEntry = (entry) => {
    setFormData({ ...entry }); setEditingEntry(entry); setFormErrors({}); setSubmitAttempted(false); setShowForm(true)
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
    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data: formData, oldData: editingEntry })
    } else {
      if (formData.policy_number) {
        const dup = entries.find(e =>
          !e.archived && e.policy_number === formData.policy_number && e.insurer === formData.insurer
        )
        if (dup) {
          toast({ title: 'Mögliches Duplikat', description: `Policen-Nr. "${formData.policy_number}" bei ${formData.insurer} existiert bereits.`, variant: 'destructive' })
          return
        }
      }
      createMutation.mutate(formData)
    }
  }

  const handleStatusChange = (entry, newStatus) => {
    if (!canTransitionTo(entry.status, newStatus)) {
      toast({ title: 'Ungültiger Statuswechsel', description: `Von "${STATUS_META[entry.status]?.label}" nicht direkt zu "${STATUS_META[newStatus]?.label}" möglich.`, variant: 'destructive' })
      return
    }
    statusChangeMutation.mutate({ id: entry.id, newStatus, entry })
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  const activeEntries = useMemo(() => entries.filter(e => !e.archived), [entries])

  const filteredEntries = useMemo(() => {
    return activeEntries.filter(e => {
      const searchStr = `${e.customer_name} ${e.insurer} ${e.product_category} ${e.advisor_name} ${e.policy_number}`.toLowerCase()
      const matchSearch = !search.trim() || searchStr.includes(search.toLowerCase())
      const matchBroker = filterBroker === 'all' || e.advisor_id === filterBroker
      const matchInsurer = filterInsurer === 'all' || e.insurer === filterInsurer
      const matchSparte = filterSparte === 'all' || e.product_category === filterSparte
      const matchStatus = filterStatus === 'all' || e.status === filterStatus
      const entryDate = e.entry_date ? new Date(e.entry_date) : null
      const matchPeriod = !entryDate || (
        entryDate.getFullYear().toString() === filterYear &&
        String(entryDate.getMonth() + 1).padStart(2, '0') === filterMonth
      )
      return matchSearch && matchBroker && matchInsurer && matchSparte && matchStatus && matchPeriod
    })
  }, [activeEntries, search, filterBroker, filterInsurer, filterSparte, filterStatus, filterYear, filterMonth])

  const brokerStats = useMemo(() => {
    const map = {}
    activeEntries.filter(e => e.status !== 'cancelled').forEach(e => {
      const key = e.advisor_id || '–'
      if (!map[key]) map[key] = { name: e.advisor_name || '–', commission: 0, received: 0, count: 0, paid: 0 }
      map[key].commission += e.commission_amount || 0
      map[key].received += e.received_amount || 0
      map[key].count += 1
      if (e.status === 'paid') map[key].paid += e.commission_amount || 0
    })
    return Object.values(map).sort((a, b) => b.commission - a.commission)
  }, [activeEntries])

  const stornoEntries = useMemo(() => activeEntries.filter(e => e.status === 'cancelled'), [activeEntries])
  const uniqueBrokers = useMemo(() =>
    [...new Map(activeEntries.filter(e => e.advisor_id).map(e => [e.advisor_id, { id: e.advisor_id, name: e.advisor_name || e.advisor_id }])).values()],
    [activeEntries])
  const uniqueInsurers = useMemo(() => [...new Set(activeEntries.map(e => e.insurer).filter(Boolean))], [activeEntries])

  const handleCSVExport = () => {
    downloadCSV(generateCSV(filteredEntries), `provisionen_${filterYear}_${filterMonth}.csv`)
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Courtagen & Provisionen
            {!loadingEntries && <span className="text-muted-foreground text-lg md:text-xl font-normal ml-2">({activeEntries.length})</span>}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Gesellschaftscourtagen · Beraterprovision · Revisionssichere Verwaltung</p>
        </div>
        <div className="flex gap-2 flex-wrap">
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

      {/* Period Filter */}
      <div className="flex gap-3 items-center flex-wrap">
        <span className="text-sm font-semibold text-muted-foreground">Zeitraum:</span>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[2023, 2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
              <SelectItem key={m} value={String(m).padStart(2, '0')}>
                {new Date(2024, m - 1).toLocaleDateString('de-CH', { month: 'long' })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Bar */}
      <CommissionKPIBar entries={activeEntries} filteredEntries={filteredEntries} />

      {/* Storno Banner */}
      {stornoEntries.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span><strong>{stornoEntries.length} stornierte</strong> Einträge · Provision-Verlust Berater: <strong>{formatCHF(stornoEntries.reduce((s, e) => s + (e.commission_amount || 0), 0))}</strong></span>
        </div>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="liste">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="liste">Liste ({filteredEntries.length})</TabsTrigger>
          <TabsTrigger value="berater">Berater ({brokerStats.length})</TabsTrigger>
          <TabsTrigger value="storno">Stornos ({stornoEntries.length})</TabsTrigger>
          <TabsTrigger value="intelligence" className="flex items-center gap-1">
            <BarChart2 className="w-3.5 h-3.5" /> BI & Analytics
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Liste ── */}
        <TabsContent value="liste" className="mt-4 space-y-4">
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
                {STATUS_OPTIONS_WITH_ICONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
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

        {/* ── Tab: Berater ── */}
        <TabsContent value="berater" className="mt-4">
          <div className="rounded-xl border bg-card shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left py-3 px-4 font-semibold">Berater</th>
                  <th className="text-right py-3 px-4 font-semibold">Anzahl</th>
                  <th className="text-right py-3 px-4 font-semibold hidden md:table-cell">Provision Berater</th>
                  <th className="text-right py-3 px-4 font-semibold hidden md:table-cell text-blue-700">Courtage erhalten</th>
                  <th className="text-right py-3 px-4 font-semibold text-green-700">Ausbezahlt</th>
                  <th className="text-right py-3 px-4 font-semibold text-amber-700">Offen</th>
                </tr>
              </thead>
              <tbody>
                {brokerStats.length === 0 ? (
                  <tr><td colSpan="6" className="text-center py-8 text-muted-foreground">Keine Daten</td></tr>
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
                    <td className="text-right py-3 px-4 font-semibold hidden md:table-cell">{formatCHF(b.commission)}</td>
                    <td className="text-right py-3 px-4 text-blue-600 hidden md:table-cell">{formatCHF(b.received)}</td>
                    <td className="text-right py-3 px-4 font-bold text-green-600">{formatCHF(b.paid)}</td>
                    <td className="text-right py-3 px-4 text-amber-600">{formatCHF(b.commission - b.paid)}</td>
                  </tr>
                ))}
              </tbody>
              {brokerStats.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/40 font-bold">
                    <td className="py-3 px-4">Total</td>
                    <td className="text-right py-3 px-4">{brokerStats.reduce((s, b) => s + b.count, 0)}</td>
                    <td className="text-right py-3 px-4 hidden md:table-cell">{formatCHF(brokerStats.reduce((s, b) => s + b.commission, 0))}</td>
                    <td className="text-right py-3 px-4 text-blue-600 hidden md:table-cell">{formatCHF(brokerStats.reduce((s, b) => s + b.received, 0))}</td>
                    <td className="text-right py-3 px-4 text-green-600">{formatCHF(brokerStats.reduce((s, b) => s + b.paid, 0))}</td>
                    <td className="text-right py-3 px-4 text-amber-600">{formatCHF(brokerStats.reduce((s, b) => s + (b.commission - b.paid), 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </TabsContent>

        {/* ── Tab: Storno ── */}
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
                  <th className="text-right py-3 px-4 font-semibold hidden lg:table-cell">Jahresprämie</th>
                  <th className="text-right py-3 px-4 font-semibold text-red-600">Verlust (Provision)</th>
                </tr>
              </thead>
              <tbody>
                {stornoEntries.length === 0 ? (
                  <tr><td colSpan="7" className="text-center py-8 text-muted-foreground">Keine Storni vorhanden ✓</td></tr>
                ) : stornoEntries.map(e => (
                  <tr key={e.id} className="border-b hover:bg-red-50/40">
                    <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">{formatDate(e.entry_date)}</td>
                    <td className="py-3 px-4 hidden md:table-cell">{e.insurer}</td>
                    <td className="py-3 px-4 hidden lg:table-cell">{e.advisor_name || '–'}</td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-xs">{e.customer_name}</p>
                        <p className="text-xs text-muted-foreground md:hidden">{e.insurer}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs hidden md:table-cell">{e.product_category || '–'}</td>
                    <td className="text-right py-3 px-4 line-through text-muted-foreground hidden lg:table-cell">{formatCHF(e.premium_yearly)}</td>
                    <td className="text-right py-3 px-4 font-bold text-red-600">–{formatCHF(e.commission_amount)}</td>
                  </tr>
                ))}
              </tbody>
              {stornoEntries.length > 0 && (
                <tfoot>
                  <tr className="bg-red-50 font-bold text-red-700">
                    <td colSpan="6" className="py-3 px-4">Total Storno-Verlust (Provision Berater)</td>
                    <td className="text-right py-3 px-4">–{formatCHF(stornoEntries.reduce((s, e) => s + (e.commission_amount || 0), 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </TabsContent>

        {/* ── Tab: BI & Analytics ── */}
        <TabsContent value="intelligence" className="mt-4">
          <CommissionIntelligenceTab entries={activeEntries} />
        </TabsContent>
      </Tabs>

      {/* ── Form Dialog ── */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); resetForm() } }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              {editingEntry ? 'Abrechnung bearbeiten' : 'Neue Abrechnung erfassen'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* 1. Basisdaten */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">1. Basisdaten</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold">Buchungsdatum *</label>
                  <Input type="date" value={formData.entry_date || ''}
                    onChange={e => handleFormChange({ entry_date: e.target.value })}
                    className={`mt-1 ${formErrors.entry_date ? 'border-red-400' : ''}`} />
                  {formErrors.entry_date && <p className="text-xs text-red-500 mt-0.5">{formErrors.entry_date}</p>}
                </div>
                <div>
                  <label className="text-sm font-semibold">Status *</label>
                  <Select value={formData.status || 'pending'} onValueChange={v => handleFormChange({ status: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {editingEntry
                        ? STATUS_OPTIONS_WITH_ICONS.filter(s => s.value === formData.status || canTransitionTo(editingEntry.status, s.value))
                            .map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)
                        : STATUS_OPTIONS_WITH_ICONS.slice(0, 2).map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)
                      }
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 2. Kunde & Berater */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">2. Kunde & Berater</p>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-sm font-semibold">Kunde / Versicherungsnehmer *</label>
                  <CustomerSearchField
                    value={formData.customer_name || ''}
                    customerId={formData.customer_id || ''}
                    customers={customers}
                    onChange={({ customer_id, customer_name }) => handleFormChange({ customer_id, customer_name })}
                  />
                  {formErrors.customer_name && <p className="text-xs text-red-500 mt-0.5">{formErrors.customer_name}</p>}
                </div>
                <div>
                  <label className="text-sm font-semibold">Berater / Adressvermittler *</label>
                  <Select value={formData.advisor_id || ''} onValueChange={v => {
                    const broker = brokers.find(b => b.id === v)
                    handleFormChange({ advisor_id: v, advisor_name: broker?.name || '' })
                  }}>
                    <SelectTrigger className={`mt-1 ${formErrors.advisor_id ? 'border-red-400' : ''}`}>
                      <SelectValue placeholder="Berater wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {brokers.length === 0
                        ? <SelectItem value="_none" disabled>Keine Berater vorhanden</SelectItem>
                        : brokers.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)
                      }
                    </SelectContent>
                  </Select>
                  {formErrors.advisor_id && <p className="text-xs text-red-500 mt-0.5">{formErrors.advisor_id}</p>}
                </div>
                <div>
                  <label className="text-sm font-semibold">Organisation *</label>
                  <Select value={formData.organization_id || ''} onValueChange={v => {
                    const org = organizations.find(o => o.id === v)
                    handleFormChange({ organization_id: v, organization_name: org?.name || '' })
                  }}>
                    <SelectTrigger className={`mt-1 ${formErrors.organization_id ? 'border-red-400' : ''}`}>
                      <SelectValue placeholder="Organisation wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.length === 0
                        ? <SelectItem value="_none" disabled>Keine Organisationen vorhanden</SelectItem>
                        : organizations.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)
                      }
                    </SelectContent>
                  </Select>
                  {formErrors.organization_id && <p className="text-xs text-red-500 mt-0.5">{formErrors.organization_id}</p>}
                </div>
              </div>
            </div>

            {/* 3. Vertragsdaten */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">3. Vertragsdaten</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold">Gesellschaft *</label>
                  <Select value={formData.insurer || ''} onValueChange={v => handleFormChange({ insurer: v })}>
                    <SelectTrigger className={`mt-1 ${formErrors.insurer ? 'border-red-400' : ''}`}>
                      <SelectValue placeholder="Wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {SWISS_INSURERS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {formErrors.insurer && <p className="text-xs text-red-500 mt-0.5">{formErrors.insurer}</p>}
                </div>
                <div>
                  <label className="text-sm font-semibold">Sparte *</label>
                  <Select value={formData.product_category || ''} onValueChange={v => handleFormChange({ product_category: v })}>
                    <SelectTrigger className={`mt-1 ${formErrors.product_category ? 'border-red-400' : ''}`}>
                      <SelectValue placeholder="Wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_SPARTEN.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {formErrors.product_category && <p className="text-xs text-red-500 mt-0.5">{formErrors.product_category}</p>}
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-semibold">Policen-Nummer</label>
                  <Input value={formData.policy_number || ''}
                    onChange={e => handleFormChange({ policy_number: e.target.value })}
                    className="mt-1" placeholder="POL-2024-001" />
                </div>
              </div>
            </div>

            {/* 4. Provision */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">4. Courtage & Provision</p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3 text-xs text-amber-700">
                <strong>Formel:</strong> Gesellschaftscourtage × Berateranteil% = Beraterprovision &nbsp;|&nbsp; Jahresprämie = nur Referenz.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold">Jahresprämie Kunde (CHF) *</label>
                  <Input type="number" step="0.01" min="0"
                    value={formData.premium_yearly || ''}
                    onChange={e => handleFormChange({ premium_yearly: e.target.value })}
                    className={`mt-1 ${formErrors.premium_yearly ? 'border-red-400' : ''}`}
                    placeholder="0.00" />
                  {formErrors.premium_yearly && <p className="text-xs text-red-500 mt-0.5">{formErrors.premium_yearly}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">Nur Referenz – nicht Berechnungsgrundlage</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-blue-700">Erhaltene Gesellschaftscourtage (CHF) *</label>
                  <Input type="number" step="0.01" min="0"
                    value={formData.received_amount || ''}
                    onChange={e => handleFormChange({ received_amount: e.target.value })}
                    className={`mt-1 ${formErrors.received_amount ? 'border-red-400' : 'border-blue-300 focus:border-blue-500'}`}
                    placeholder="0.00" />
                  {formErrors.received_amount && <p className="text-xs text-red-500 mt-0.5">{formErrors.received_amount}</p>}
                  <p className="text-xs text-blue-600 mt-0.5 font-medium">← Berechnungsgrundlage</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-green-700">Berateranteil (%) *</label>
                  <Input type="number" step="0.1" min="0" max="100"
                    value={formData.commission_percentage || ''}
                    onChange={e => handleFormChange({ commission_percentage: e.target.value })}
                    className={`mt-1 ${formErrors.commission_percentage ? 'border-red-400' : 'border-green-300 focus:border-green-500'}`}
                    placeholder="z.B. 50" />
                  {formErrors.commission_percentage && <p className="text-xs text-red-500 mt-0.5">{formErrors.commission_percentage}</p>}
                  <p className="text-xs text-green-600 mt-0.5">Anteil des Beraters an der Courtage</p>
                </div>
                <div>
                  <label className="text-sm font-semibold">Datum Courtage erhalten</label>
                  <Input type="date"
                    value={formData.received_date || ''}
                    onChange={e => handleFormChange({ received_date: e.target.value })}
                    className="mt-1" />
                </div>
              </div>
              <div className="mt-3">
                <CommissionPreview data={formData} />
              </div>
            </div>

            {/* Notizen */}
            <div>
              <label className="text-sm font-semibold">Notizen</label>
              <Textarea value={formData.notes || ''}
                onChange={e => handleFormChange({ notes: e.target.value })}
                className="mt-1" rows={2} placeholder="Interne Bemerkungen..." />
            </div>

            {/* Validation Summary */}
            {submitAttempted && Object.keys(formErrors).length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                <strong>Pflichtfelder ausfüllen:</strong>
                <ul className="mt-1 list-disc list-inside space-y-0.5">
                  {Object.entries(formErrors).map(([k, v]) => <li key={k}>{v}</li>)}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowForm(false); resetForm() }}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={isSaving} className="min-w-36">
              {isSaving ? 'Speichern...' : editingEntry ? 'Änderungen speichern' : 'Abrechnung speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Audit Log Dialog ── */}
      <AuditLogDialog
        open={showAuditLog}
        onClose={() => setShowAuditLog(false)}
        auditLogs={auditLogs}
      />

      {/* ── Settings Dialog ── */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Einstellungen – Courtagen & Provisionen</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
              <p className="font-bold text-green-800">Berechnungsformel</p>
              <p className="font-mono text-green-700 bg-green-100 rounded px-2 py-1 text-xs">Beraterprovision = Erhaltene Gesellschaftscourtage × Berateranteil%</p>
              <p className="text-xs text-green-700">Beispiel: CHF 2'400 × 50% = CHF 1'200 Beraterprovision</p>
              <p className="text-xs text-muted-foreground mt-1">Die Jahresprämie ist nur ein Referenzwert und wird nicht für die Berechnung verwendet.</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-3 space-y-1">
              <p className="font-semibold text-foreground">Status-Workflow</p>
              <p className="text-muted-foreground text-xs">pending → invoiced → received → earned → paid</p>
              <p className="text-xs text-muted-foreground">Jeder Status kann zu «Storniert» wechseln. Terminal-Status: paid, cancelled.</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
              <p className="font-semibold text-blue-800">Performance</p>
              <p className="text-xs text-blue-700">Tabelle unterstützt Pagination (50 Einträge/Seite). Bis zu 5'000 Datensätze werden geladen.</p>
              <p className="text-xs text-blue-700">Audit Log unterstützt Suche und Pagination (500 Einträge).</p>
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