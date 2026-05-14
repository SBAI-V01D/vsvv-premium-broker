import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Search, Plus, Edit, Trash2, Settings, Download, MoreHorizontal,
  AlertTriangle, ChevronDown, X, User, CheckCircle2, Calculator
} from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// ─── Constants ──────────────────────────────────────────────────────────────
const SWISS_INSURERS = [
  'Allianz', 'Axa', 'Baloise', 'CSS', 'Concordia', 'Die Mobiliar', 'Elvia', 'Generali',
  'Helvetia', 'Helsana', 'Mutuel', 'ÖKK', 'SWICA', 'Sanitas', 'Smile', 'Suva',
  'Swiss Life', 'Swiss Re', 'TCS', 'Visana', 'Zurich', 'Andere',
]
const ALL_SPARTEN = ['KVG', 'VVG', 'Leben', 'Sach', 'KFZ', 'BVG', 'Rechtsschutz', 'Haftpflicht', 'Hausrat']

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Ausstehend', color: 'bg-gray-100 text-gray-700' },
  { value: 'invoiced', label: 'Eingereicht', color: 'bg-blue-100 text-blue-700' },
  { value: 'received', label: 'Erhalten', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'earned', label: 'Freigegeben', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'paid', label: 'Ausbezahlt', color: 'bg-green-100 text-green-700' },
  { value: 'cancelled', label: 'Storniert', color: 'bg-red-100 text-red-700' },
]

// ─── Pure calculation logic mapped to CommissionEntry entity fields ──────────
function calcCommissionFields(data, globalStornoPct = 10) {
  const premiumYearly = parseFloat(data.premium_yearly) || 0
  const commissionPct = parseFloat(data.commission_percentage) || 0
  const commissionAmount = (premiumYearly * commissionPct) / 100

  return {
    ...data,
    premium_yearly: premiumYearly,
    commission_percentage: commissionPct,
    commission_amount: commissionAmount,
  }
}

function formatCHF(amount) {
  return (amount || 0).toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })
}

function formatDate(dateStr) {
  if (!dateStr) return '–'
  return new Date(dateStr).toLocaleDateString('de-CH')
}

function getStatusMeta(status) {
  return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0]
}

// ─── Customer Live Search component ─────────────────────────────────────────
function CustomerSearchField({ value, customerId, onChange, customers }) {
  const [query, setQuery] = useState(value || '')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    setQuery(value || '')
  }, [value])

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = useMemo(() => {
    if (!query.trim() || query.length < 2) return []
    const q = query.toLowerCase()
    return customers.filter(c => {
      const fullName = `${c.first_name || ''} ${c.last_name || ''} ${c.company_name || ''} ${c.customer_number || ''} ${c.email || ''} ${c.phone || ''}`.toLowerCase()
      return fullName.includes(q)
    }).slice(0, 10)
  }, [query, customers])

  const handleSelect = (customer) => {
    const displayName = customer.company_name || `${customer.first_name} ${customer.last_name}`
    setQuery(displayName)
    setOpen(false)
    onChange({ customer_id: customer.id, customer_name: displayName })
  }

  const handleClear = () => {
    setQuery('')
    onChange({ customer_id: '', customer_name: '' })
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="Name, Kundennummer, E-Mail suchen..."
          className={`pl-9 pr-8 mt-1 ${customerId ? 'border-green-400 bg-green-50/30' : ''}`}
        />
        {(query || customerId) && (
          <button onClick={handleClear} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {customerId && (
        <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Kunde verknüpft (ID: {customerId.slice(0, 8)}...)
        </p>
      )}
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtered.map(c => {
            const name = c.company_name || `${c.first_name} ${c.last_name}`
            return (
              <button
                key={c.id}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(c) }}
                className="w-full text-left px-3 py-2.5 hover:bg-muted/50 flex items-center gap-2 text-sm border-b last:border-0"
              >
                <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.customer_number && <span className="mr-2">{c.customer_number}</span>}
                    {c.email && <span>{c.email}</span>}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}
      {open && query.length >= 2 && filtered.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-border rounded-lg shadow-sm px-3 py-2 text-sm text-muted-foreground">
          Kein Kunde gefunden – Namen oder Kundennummer eingeben
        </div>
      )}
    </div>
  )
}

// ─── Auto-Calc Preview component ─────────────────────────────────────────────
function CommissionPreview({ data }) {
  const calc = calcCommissionFields(data)
  if (!calc.premium_yearly) return null
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 grid grid-cols-2 gap-2 text-sm">
      <div>
        <p className="text-xs text-blue-500 uppercase font-semibold">Jahresprämie</p>
        <p className="font-bold text-blue-800">{formatCHF(calc.premium_yearly)}</p>
      </div>
      <div>
        <p className="text-xs text-blue-500 uppercase font-semibold">Provisionssatz</p>
        <p className="font-bold text-blue-800">{calc.commission_percentage}%</p>
      </div>
      <div className="col-span-2">
        <p className="text-xs text-green-600 uppercase font-semibold">Berechnete Provision</p>
        <p className="font-bold text-green-700 text-lg">{formatCHF(calc.commission_amount)}</p>
      </div>
    </div>
  )
}

// ─── Validation ──────────────────────────────────────────────────────────────
function validateForm(data) {
  const errors = {}
  if (!data.entry_date) errors.entry_date = 'Pflichtfeld'
  if (!data.insurer) errors.insurer = 'Pflichtfeld'
  if (!data.advisor_id) errors.advisor_id = 'Pflichtfeld'
  if (!data.organization_id) errors.organization_id = 'Pflichtfeld'
  if (!data.customer_name) errors.customer_name = 'Pflichtfeld'
  if (!data.product_category) errors.product_category = 'Pflichtfeld'
  if (!data.premium_yearly || parseFloat(data.premium_yearly) <= 0) errors.premium_yearly = 'Muss > 0 sein'
  if (!data.commission_percentage || parseFloat(data.commission_percentage) <= 0) errors.commission_percentage = 'Muss > 0 sein'
  if (parseFloat(data.commission_percentage) > 100) errors.commission_percentage = 'Maximal 100%'
  return errors
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CommissionsAndCourtage() {
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [filterBroker, setFilterBroker] = useState('all')
  const [filterInsurer, setFilterInsurer] = useState('all')
  const [filterSparte, setFilterSparte] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString())
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [showForm, setShowForm] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [formData, setFormData] = useState({})
  const [formErrors, setFormErrors] = useState({})
  const [submitAttempted, setSubmitAttempted] = useState(false)

  // ── Data queries ──────────────────────────────────────────────────────────
  const { data: entries = [] } = useQuery({
    queryKey: ['commissionEntries'],
    queryFn: () => base44.entities.CommissionEntry.list('-entry_date'),
  })

  const { data: organizations = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => base44.entities.Organization.filter({ status: 'active' }),
  })

  const { data: stornoConfig = {} } = useQuery({
    queryKey: ['stornoConfig'],
    queryFn: async () => {
      const configs = await base44.entities.StornoConfig.filter({ is_current: true })
      return configs[0] || { global_storno_percent: 10 }
    },
  })

  const { data: brokers = [] } = useQuery({
    queryKey: ['brokers'],
    queryFn: () => base44.entities.Broker.list(),
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-for-commission'],
    queryFn: () => base44.entities.Customer.list(null, 2000),
  })

  // ── Mutations ─────────────────────────────────────────────────────────────
  const globalStornoPct = stornoConfig.global_storno_percent || 10

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.CommissionEntry.create(calcCommissionFields(data, globalStornoPct)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissionEntries'] })
      setShowForm(false)
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CommissionEntry.update(id, calcCommissionFields(data, globalStornoPct)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissionEntries'] })
      setShowForm(false)
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CommissionEntry.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['commissionEntries'] }),
  })

  // ── Helpers ───────────────────────────────────────────────────────────────
  const resetForm = () => {
    setFormData({})
    setEditingEntry(null)
    setFormErrors({})
    setSubmitAttempted(false)
  }

  const handleNewEntry = () => {
    setFormData({
      status: 'pending',
      entry_date: new Date().toISOString().split('T')[0],
      commission_percentage: 0,
      premium_yearly: 0,
    })
    setEditingEntry(null)
    setFormErrors({})
    setSubmitAttempted(false)
    setShowForm(true)
  }

  const handleEditEntry = (entry) => {
    setFormData({ ...entry })
    setEditingEntry(entry)
    setFormErrors({})
    setSubmitAttempted(false)
    setShowForm(true)
  }

  const handleFormChange = useCallback((updates) => {
    setFormData(prev => {
      const next = { ...prev, ...updates }
      if (submitAttempted) setFormErrors(validateForm(next))
      return next
    })
  }, [submitAttempted])

  const handleSave = () => {
    setSubmitAttempted(true)
    const errors = validateForm(formData)
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    const isSaving = createMutation.isPending || updateMutation.isPending
    if (isSaving) return

    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  // ── Filters & KPIs ────────────────────────────────────────────────────────
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const searchStr = `${e.customer_name} ${e.insurer} ${e.product_category} ${e.advisor_name}`.toLowerCase()
      const matchSearch = !search.trim() || searchStr.includes(search.toLowerCase())
      const matchBroker = filterBroker === 'all' || e.advisor_id === filterBroker
      const matchInsurer = filterInsurer === 'all' || e.insurer === filterInsurer
      const matchSparte = filterSparte === 'all' || e.product_category === filterSparte
      const matchStatus = filterStatus === 'all' || e.status === filterStatus
      const entryDate = new Date(e.entry_date)
      const matchPeriod = entryDate.getFullYear().toString() === filterYear &&
                          String(entryDate.getMonth() + 1).padStart(2, '0') === filterMonth
      return matchSearch && matchBroker && matchInsurer && matchSparte && matchStatus && matchPeriod
    })
  }, [entries, search, filterBroker, filterInsurer, filterSparte, filterStatus, filterYear, filterMonth])

  const allActiveEntries = entries.filter(e => e.status !== 'cancelled')
  const kpis = {
    expectedTotal: allActiveEntries.reduce((s, e) => s + (e.commission_amount || 0), 0),
    settledTotal: filteredEntries.filter(e => e.status === 'paid').reduce((s, e) => s + (e.commission_amount || 0), 0),
    avgCommission: filteredEntries.length > 0
      ? filteredEntries.reduce((s, e) => s + (e.commission_amount || 0), 0) / filteredEntries.length : 0,
    premiumTotal: filteredEntries.reduce((s, e) => s + (e.premium_yearly || 0), 0),
    commissionTotal: filteredEntries.reduce((s, e) => s + (e.commission_amount || 0), 0),
    receivedTotal: filteredEntries.reduce((s, e) => s + (e.received_amount || 0), 0),
    netPayoutTotal: filteredEntries.filter(e => e.status === 'earned' || e.status === 'paid').reduce((s, e) => s + (e.commission_amount || 0), 0),
  }

  const brokerStats = useMemo(() => {
    const map = {}
    entries.filter(e => e.status !== 'cancelled').forEach(e => {
      const key = e.advisor_id || e.advisor_name || '–'
      if (!map[key]) map[key] = { name: e.advisor_name || '–', commission: 0, received: 0, count: 0, paid: 0 }
      map[key].commission += e.commission_amount || 0
      map[key].received += e.received_amount || 0
      map[key].count += 1
      if (e.status === 'paid') map[key].paid += e.commission_amount || 0
    })
    return Object.values(map).sort((a, b) => b.commission - a.commission)
  }, [entries])

  const stornoEntries = useMemo(() => entries.filter(e => e.status === 'cancelled'), [entries])
  const stornoRisk = useMemo(() => entries.filter(e => e.status === 'pending').reduce((s, e) => s + (e.commission_amount || 0), 0), [entries])

  const uniqueBrokers = [...new Map(entries.filter(e => e.advisor_id).map(e => [e.advisor_id, { id: e.advisor_id, name: e.advisor_name || e.advisor_id }])).values()]
  const uniqueInsurers = [...new Set(entries.map(e => e.insurer).filter(Boolean))]

  const handleCSVExport = () => {
    const headers = ['Datum', 'Gesellschaft', 'Berater', 'Kunde', 'Sparte', 'Policen-Nr.', 'Jahresprämie (CHF)', 'Provision %', 'Provision (CHF)', 'Erhalten (CHF)', 'Status']
    const rows = filteredEntries.map(e => [
      e.entry_date || '', e.insurer || '', e.advisor_name || '',
      e.customer_name || '', e.product_category || '', e.policy_number || '',
      (e.premium_yearly || 0).toFixed(2), (e.commission_percentage || 0).toFixed(2),
      (e.commission_amount || 0).toFixed(2), (e.received_amount || 0).toFixed(2), e.status || '',
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `provisionen_${filterYear}_${filterMonth}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Provisionen & Courtagen ({entries.length})</h1>
          <p className="text-muted-foreground mt-1">Verwaltung aller Provisionen und Abgeltungen</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleCSVExport} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" /> CSV Export
          </Button>
          <Button onClick={() => setShowSettings(true)} variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" /> Einstellungen
          </Button>
          <Button onClick={handleNewEntry}>
            <Plus className="w-4 h-4 mr-2" /> Neue Abrechnung
          </Button>
        </div>
      </div>

      {/* Period Filter */}
      <div className="flex gap-3 items-center flex-wrap">
        <span className="text-sm font-semibold">Zeitraum:</span>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026, 2027].map(y => (
              <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
              <SelectItem key={m} value={String(m).padStart(2, '0')}>
                {new Date(2024, m - 1).toLocaleDateString('de-CH', { month: 'long' })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Gesamte erwartete Provision</p>
          <p className="text-2xl font-bold mt-1">{formatCHF(kpis.expectedTotal)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Abgerechnete Provision</p>
          <p className="text-2xl font-bold mt-1">{formatCHF(kpis.settledTotal)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Durchschnitt</p>
          <p className="text-2xl font-bold mt-1">{formatCHF(kpis.avgCommission)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Netto-Auszahlung Berater</p>
          <p className="text-2xl font-bold mt-1 text-green-600">{formatCHF(kpis.netPayoutTotal)}</p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Anteil Gesellschaft (gesamt)</p>
          <p className="text-2xl font-bold mt-1">{formatCHF(kpis.companyShareTotal)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Anteil Berater (gesamt)</p>
          <p className="text-2xl font-bold mt-1">{formatCHF(kpis.brokerShareTotal)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Storno-Abzüge (gesamt)</p>
          <p className="text-2xl font-bold mt-1 text-red-600">–{formatCHF(kpis.stornoTotal)}</p>
        </CardContent></Card>
      </div>

      {/* Storno Risk Banner */}
      {stornoEntries.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span><strong>{stornoEntries.length} stornierte</strong> Einträge · Storno-Risiko auf offene Provisionen: <strong>{formatCHF(stornoRisk)}</strong></span>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="liste">
        <TabsList>
          <TabsTrigger value="liste">Abrechnungsliste</TabsTrigger>
          <TabsTrigger value="berater">Berater-Auswertung ({brokerStats.length})</TabsTrigger>
          <TabsTrigger value="storno">Stornos ({stornoEntries.length})</TabsTrigger>
        </TabsList>

        {/* ── Tab: Liste ── */}
        <TabsContent value="liste" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Suche (Kunde, Gesellschaft, Sparte...)" value={search}
                onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            {uniqueBrokers.length > 0 && (
              <Select value={filterBroker} onValueChange={setFilterBroker}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Alle Berater" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Berater</SelectItem>
                  {uniqueBrokers.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {uniqueInsurers.length > 0 && (
              <Select value={filterInsurer} onValueChange={setFilterInsurer}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Alle Gesellschaften" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Gesellschaften</SelectItem>
                  {uniqueInsurers.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={filterSparte} onValueChange={setFilterSparte}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Alle Sparten" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Sparten</SelectItem>
                {ALL_SPARTEN.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Alle Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left py-3 px-4 font-semibold">Datum</th>
                      <th className="text-left py-3 px-4 font-semibold">Gesellschaft</th>
                      <th className="text-left py-3 px-4 font-semibold">Berater</th>
                      <th className="text-left py-3 px-4 font-semibold">Kunde</th>
                      <th className="text-left py-3 px-4 font-semibold">Sparte</th>
                      <th className="text-right py-3 px-4 font-semibold">Jahresprämie</th>
                      <th className="text-right py-3 px-4 font-semibold">Satz %</th>
                      <th className="text-right py-3 px-4 font-semibold">Erhalten</th>
                      <th className="text-right py-3 px-4 font-semibold">Provision</th>
                      <th className="text-center py-3 px-4 font-semibold">Status</th>
                      <th className="w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.length === 0 ? (
                      <tr><td colSpan="11" className="text-center py-10 text-muted-foreground">Keine Einträge für diesen Zeitraum</td></tr>
                    ) : filteredEntries.map(e => {
                      const sm = getStatusMeta(e.status)
                      return (
                        <tr key={e.id} className="border-b hover:bg-muted/30">
                          <td className="py-3 px-4 whitespace-nowrap">{formatDate(e.entry_date)}</td>
                          <td className="py-3 px-4 font-medium">{e.insurer}</td>
                          <td className="py-3 px-4">{e.advisor_name || '–'}</td>
                          <td className="py-3 px-4">{e.customer_name || '–'}</td>
                          <td className="py-3 px-4">{e.product_category || '–'}</td>
                          <td className="text-right py-3 px-4 font-semibold">{formatCHF(e.premium_yearly)}</td>
                          <td className="text-right py-3 px-4">{e.commission_percentage ? `${e.commission_percentage}%` : '–'}</td>
                          <td className="text-right py-3 px-4 text-muted-foreground">{formatCHF(e.received_amount)}</td>
                          <td className="text-right py-3 px-4 font-bold text-green-600">{formatCHF(e.commission_amount)}</td>
                          <td className="text-center py-3 px-4">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${sm.color}`}>{sm.label}</span>
                          </td>
                          <td className="py-3 px-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditEntry(e)}>
                                  <Edit className="w-4 h-4 mr-2" /> Bearbeiten
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive"
                                  onClick={() => { if (confirm('Wirklich löschen?')) deleteMutation.mutate(e.id) }}>
                                  <Trash2 className="w-4 h-4 mr-2" /> Löschen
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Berater ── */}
        <TabsContent value="berater" className="mt-4">
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left py-3 px-4 font-semibold">Berater</th>
                  <th className="text-right py-3 px-4 font-semibold">Anzahl</th>
                  <th className="text-right py-3 px-4 font-semibold">Provision (gesamt)</th>
                  <th className="text-right py-3 px-4 font-semibold">Erhalten</th>
                  <th className="text-right py-3 px-4 font-semibold">Ausbezahlt</th>
                </tr>
              </thead>
              <tbody>
                {brokerStats.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-8 text-muted-foreground">Keine Daten</td></tr>
                ) : brokerStats.map((b, i) => (
                <tr key={i} className="border-b hover:bg-muted/30">
                  <td className="py-3 px-4 font-medium">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                        {b.name[0]}
                      </div>
                      {b.name}
                    </div>
                  </td>
                  <td className="text-right py-3 px-4 text-muted-foreground">{b.count}</td>
                  <td className="text-right py-3 px-4 font-semibold">{formatCHF(b.commission)}</td>
                  <td className="text-right py-3 px-4 text-blue-600">{formatCHF(b.received)}</td>
                  <td className="text-right py-3 px-4 font-bold text-green-600">{formatCHF(b.paid)}</td>
                </tr>
                ))}
                </tbody>
                {brokerStats.length > 0 && (
                <tfoot>
                <tr className="bg-muted/40 font-bold">
                  <td className="py-3 px-4">Total</td>
                  <td className="text-right py-3 px-4">{brokerStats.reduce((s, b) => s + b.count, 0)}</td>
                  <td className="text-right py-3 px-4">{formatCHF(brokerStats.reduce((s, b) => s + b.commission, 0))}</td>
                  <td className="text-right py-3 px-4 text-blue-600">{formatCHF(brokerStats.reduce((s, b) => s + b.received, 0))}</td>
                  <td className="text-right py-3 px-4 text-green-600">{formatCHF(brokerStats.reduce((s, b) => s + b.paid, 0))}</td>
                </tr>
                </tfoot>
                )}
            </table>
          </CardContent></Card>
        </TabsContent>

        {/* ── Tab: Storno ── */}
        <TabsContent value="storno" className="mt-4">
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left py-3 px-4 font-semibold">Datum</th>
                  <th className="text-left py-3 px-4 font-semibold">Gesellschaft</th>
                  <th className="text-left py-3 px-4 font-semibold">Berater</th>
                  <th className="text-left py-3 px-4 font-semibold">Kunde</th>
                  <th className="text-right py-3 px-4 font-semibold">Brutto</th>
                  <th className="text-right py-3 px-4 font-semibold text-red-600">Storno-Verlust</th>
                </tr>
              </thead>
              <tbody>
                {stornoEntries.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-8 text-muted-foreground">Keine Storni vorhanden ✓</td></tr>
                ) : stornoEntries.map(e => (
                <tr key={e.id} className="border-b hover:bg-red-50/40">
                  <td className="py-3 px-4">{formatDate(e.entry_date)}</td>
                  <td className="py-3 px-4">{e.insurer}</td>
                  <td className="py-3 px-4">{e.advisor_name || '–'}</td>
                  <td className="py-3 px-4">{e.customer_name}</td>
                  <td className="text-right py-3 px-4 line-through text-muted-foreground">{formatCHF(e.premium_yearly)}</td>
                  <td className="text-right py-3 px-4 font-bold text-red-600">–{formatCHF(e.commission_amount)}</td>
                </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* ── Form Dialog (outside Tabs) ── */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); resetForm() } }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              {editingEntry ? 'Abrechnung bearbeiten' : 'Neue Abrechnung erfassen'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* ─ Sektion 1: Basisdaten ─ */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">1. Basisdaten</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold">Buchungsdatum *</label>
                  <Input type="date"
                    value={formData.entry_date || ''}
                    onChange={e => handleFormChange({ entry_date: e.target.value })}
                    className={`mt-1 ${formErrors.entry_date ? 'border-red-400' : ''}`}
                  />
                  {formErrors.entry_date && <p className="text-xs text-red-500 mt-0.5">{formErrors.entry_date}</p>}
                </div>
                <div>
                  <label className="text-sm font-semibold">Status *</label>
                  <Select value={formData.status || 'pending'} onValueChange={v => handleFormChange({ status: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* ─ Sektion 2: Kunde & Berater ─ */}
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

            {/* ─ Sektion 3: Vertragsdaten ─ */}
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
                  <label className="text-sm font-semibold">Sparte / Produktkategorie *</label>
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
                <div>
                  <label className="text-sm font-semibold">Policen-Nummer</label>
                  <Input value={formData.policy_number || ''}
                    onChange={e => handleFormChange({ policy_number: e.target.value })}
                    className="mt-1" placeholder="POL-2024-001" />
                </div>
              </div>
            </div>

            {/* ─ Sektion 4: Provision ─ */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">4. Provision & Berechnung</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold">Jahresprämie (CHF) *</label>
                  <Input type="number" step="0.01" min="0"
                    value={formData.premium_yearly || ''}
                    onChange={e => handleFormChange({ premium_yearly: e.target.value })}
                    className={`mt-1 ${formErrors.premium_yearly ? 'border-red-400' : ''}`}
                    placeholder="0.00"
                  />
                  {formErrors.premium_yearly && <p className="text-xs text-red-500 mt-0.5">{formErrors.premium_yearly}</p>}
                </div>
                <div>
                  <label className="text-sm font-semibold">Provisionssatz (%) *</label>
                  <Input type="number" step="0.1" min="0" max="100"
                    value={formData.commission_percentage || ''}
                    onChange={e => handleFormChange({ commission_percentage: e.target.value })}
                    className={`mt-1 ${formErrors.commission_percentage ? 'border-red-400' : ''}`}
                    placeholder="z.B. 5"
                  />
                  {formErrors.commission_percentage && <p className="text-xs text-red-500 mt-0.5">{formErrors.commission_percentage}</p>}
                </div>
                <div>
                  <label className="text-sm font-semibold">Erhaltener Betrag (CHF)</label>
                  <Input type="number" step="0.01" min="0"
                    value={formData.received_amount || ''}
                    onChange={e => handleFormChange({ received_amount: e.target.value })}
                    className="mt-1" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-sm font-semibold">Datum erhalten</label>
                  <Input type="date"
                    value={formData.received_date || ''}
                    onChange={e => handleFormChange({ received_date: e.target.value })}
                    className="mt-1" />
                </div>
              </div>

              {/* Live Preview */}
              <div className="mt-3">
                <CommissionPreview data={formData} />
              </div>
            </div>

            {/* ─ Notizen ─ */}
            <div>
              <label className="text-sm font-semibold">Notizen</label>
              <Textarea value={formData.notes || ''}
                onChange={e => handleFormChange({ notes: e.target.value })}
                className="mt-1" rows={2} placeholder="Interne Bemerkungen..." />
            </div>

            {/* Submit errors summary */}
            {submitAttempted && Object.keys(formErrors).length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                <strong>Bitte alle Pflichtfelder ausfüllen:</strong>
                <ul className="mt-1 list-disc list-inside">
                  {Object.entries(formErrors).map(([k, v]) => <li key={k}>{v}</li>)}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowForm(false); resetForm() }}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={isSaving}
              className="min-w-32">
              {isSaving ? 'Speichern...' : editingEntry ? 'Änderungen speichern' : 'Abrechnung speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Einstellungen</DialogTitle></DialogHeader>
          <p className="text-muted-foreground text-sm">Provisionssätze und Storno-Konfiguration werden in einer separaten Ansicht verwaltet.</p>
          <DialogFooter>
            <Button onClick={() => setShowSettings(false)}>Schliessen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}