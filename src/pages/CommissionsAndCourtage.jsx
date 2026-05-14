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
  { value: 'erwartet', label: 'Erwartet', color: 'bg-gray-100 text-gray-700' },
  { value: 'abgerechnet', label: 'Abgerechnet', color: 'bg-green-100 text-green-700' },
  { value: 'teilweise_abgerechnet', label: 'Teilweise', color: 'bg-orange-100 text-orange-700' },
  { value: 'storniert', label: 'Storniert', color: 'bg-red-100 text-red-700' },
]

// ─── Pure calculation logic (central, no side effects) ───────────────────────
function calcCommissionFields(data, globalStornoPct = 10) {
  const gross = parseFloat(data.gross_commission) || 0
  const companySPercent = parseFloat(data.company_share_percent) ?? 40
  const brokerSPercent = parseFloat(data.broker_share_percent) || 0
  const stornoPct = parseFloat(data.storno_percent) ?? globalStornoPct

  const companyShare = (gross * companySPercent) / 100
  const brokerShare = (gross * brokerSPercent) / 100
  const stornoAmount = (brokerShare * stornoPct) / 100
  const netPayout = brokerShare - stornoAmount

  return {
    ...data,
    gross_commission: gross,
    company_share_percent: companySPercent,
    broker_share_percent: brokerSPercent,
    storno_percent: stornoPct,
    company_share_amount: companyShare,
    broker_share_amount: brokerShare,
    storno_amount: stornoAmount,
    net_payout: netPayout,
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
function CommissionPreview({ data, globalStornoPct }) {
  const calc = calcCommissionFields(data, globalStornoPct)
  const gross = calc.gross_commission
  if (!gross) return null
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 grid grid-cols-2 gap-2 text-sm">
      <div>
        <p className="text-xs text-blue-500 uppercase font-semibold">Anteil Gesellschaft</p>
        <p className="font-bold text-blue-800">{formatCHF(calc.company_share_amount)}</p>
      </div>
      <div>
        <p className="text-xs text-blue-500 uppercase font-semibold">Anteil Berater</p>
        <p className="font-bold text-blue-800">{formatCHF(calc.broker_share_amount)}</p>
      </div>
      <div>
        <p className="text-xs text-red-500 uppercase font-semibold">Storno-Abzug</p>
        <p className="font-bold text-red-700">–{formatCHF(calc.storno_amount)}</p>
      </div>
      <div>
        <p className="text-xs text-green-600 uppercase font-semibold">Netto-Auszahlung</p>
        <p className="font-bold text-green-700">{formatCHF(calc.net_payout)}</p>
      </div>
    </div>
  )
}

// ─── Validation ──────────────────────────────────────────────────────────────
function validateForm(data) {
  const errors = {}
  if (!data.settlement_date) errors.settlement_date = 'Pflichtfeld'
  if (!data.insurer) errors.insurer = 'Pflichtfeld'
  if (!data.broker_email) errors.broker_email = 'Pflichtfeld'
  if (!data.customer_name) errors.customer_name = 'Pflichtfeld'
  if (!data.sparte) errors.sparte = 'Pflichtfeld'
  if (!data.gross_commission || parseFloat(data.gross_commission) <= 0) errors.gross_commission = 'Muss > 0 sein'
  if (parseFloat(data.gross_commission) > 500000) errors.gross_commission = 'Unrealistisch hoch – bitte prüfen'
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
    queryFn: () => base44.entities.CommissionEntry.list('-settlement_date'),
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
      company_share_percent: 40,
      storno_percent: globalStornoPct,
      status: 'erwartet',
      settlement_date: new Date().toISOString().split('T')[0],
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
      const searchStr = `${e.customer_name} ${e.insurer} ${e.sparte} ${e.broker_name}`.toLowerCase()
      const matchSearch = !search.trim() || searchStr.includes(search.toLowerCase())
      const matchBroker = filterBroker === 'all' || e.broker_email === filterBroker
      const matchInsurer = filterInsurer === 'all' || e.insurer === filterInsurer
      const matchSparte = filterSparte === 'all' || e.sparte === filterSparte
      const matchStatus = filterStatus === 'all' || e.status === filterStatus
      const entryDate = new Date(e.settlement_date)
      const matchPeriod = entryDate.getFullYear().toString() === filterYear &&
                          String(entryDate.getMonth() + 1).padStart(2, '0') === filterMonth
      return matchSearch && matchBroker && matchInsurer && matchSparte && matchStatus && matchPeriod
    })
  }, [entries, search, filterBroker, filterInsurer, filterSparte, filterStatus, filterYear, filterMonth])

  const allActiveEntries = entries.filter(e => e.status !== 'storniert')
  const kpis = {
    expectedTotal: allActiveEntries.reduce((s, e) => s + (e.gross_commission || 0), 0),
    settledTotal: filteredEntries.filter(e => e.status === 'abgerechnet').reduce((s, e) => s + (e.gross_commission || 0), 0),
    avgCommission: filteredEntries.length > 0
      ? filteredEntries.reduce((s, e) => s + (e.gross_commission || 0), 0) / filteredEntries.length : 0,
    companyShareTotal: filteredEntries.reduce((s, e) => s + (e.company_share_amount || 0), 0),
    brokerShareTotal: filteredEntries.reduce((s, e) => s + (e.broker_share_amount || 0), 0),
    stornoTotal: filteredEntries.reduce((s, e) => s + (e.storno_amount || 0), 0),
    netPayoutTotal: filteredEntries.reduce((s, e) => s + (e.net_payout || 0), 0),
  }

  const brokerStats = useMemo(() => {
    const map = {}
    entries.filter(e => e.status !== 'storniert').forEach(e => {
      const key = e.broker_email || e.broker_name || '–'
      if (!map[key]) map[key] = { name: e.broker_name || e.broker_email || '–', gross: 0, net: 0, storno: 0, count: 0, earned: 0 }
      map[key].gross += e.gross_commission || 0
      map[key].net += e.net_payout || 0
      map[key].storno += e.storno_amount || 0
      map[key].count += 1
      if (e.status === 'abgerechnet') map[key].earned += e.net_payout || 0
    })
    return Object.values(map).sort((a, b) => b.gross - a.gross)
  }, [entries])

  const stornoEntries = useMemo(() => entries.filter(e => e.status === 'storniert'), [entries])
  const stornoRisk = useMemo(() => entries.filter(e => e.status === 'erwartet').reduce((s, e) => s + (e.storno_amount || 0), 0), [entries])

  const uniqueBrokers = [...new Set(entries.map(e => e.broker_email).filter(Boolean))]
  const uniqueInsurers = [...new Set(entries.map(e => e.insurer).filter(Boolean))]

  const handleCSVExport = () => {
    const headers = ['Datum', 'Gesellschaft', 'Berater', 'Kunde', 'Sparte', 'Produkt', 'Policen-Nr.', 'Brutto (CHF)', 'Anteil Berater (CHF)', 'Storno (CHF)', 'Netto (CHF)', 'Status']
    const rows = filteredEntries.map(e => [
      e.settlement_date || '', e.insurer || '', e.broker_name || e.broker_email || '',
      e.customer_name || '', e.sparte || '', e.product || '', e.policy_number || '',
      (e.gross_commission || 0).toFixed(2), (e.broker_share_amount || 0).toFixed(2),
      (e.storno_amount || 0).toFixed(2), (e.net_payout || 0).toFixed(2), e.status || '',
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
                  {uniqueBrokers.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
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
                      <th className="text-right py-3 px-4 font-semibold">Brutto</th>
                      <th className="text-right py-3 px-4 font-semibold">Anteil Berater</th>
                      <th className="text-right py-3 px-4 font-semibold">Storno</th>
                      <th className="text-right py-3 px-4 font-semibold">Netto</th>
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
                          <td className="py-3 px-4 whitespace-nowrap">{formatDate(e.settlement_date)}</td>
                          <td className="py-3 px-4 font-medium">{e.insurer}</td>
                          <td className="py-3 px-4">{e.broker_name || e.broker_email || '–'}</td>
                          <td className="py-3 px-4">{e.customer_name || '–'}</td>
                          <td className="py-3 px-4">{e.sparte}</td>
                          <td className="text-right py-3 px-4 font-semibold">{formatCHF(e.gross_commission)}</td>
                          <td className="text-right py-3 px-4">{formatCHF(e.broker_share_amount)}</td>
                          <td className="text-right py-3 px-4 text-red-600">–{formatCHF(e.storno_amount)}</td>
                          <td className="text-right py-3 px-4 font-bold text-green-600">{formatCHF(e.net_payout)}</td>
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
                  <th className="text-right py-3 px-4 font-semibold">Brutto</th>
                  <th className="text-right py-3 px-4 font-semibold">Storno-Abzug</th>
                  <th className="text-right py-3 px-4 font-semibold">Netto</th>
                  <th className="text-right py-3 px-4 font-semibold">Abgerechnet</th>
                </tr>
              </thead>
              <tbody>
                {brokerStats.length === 0 ? (
                  <tr><td colSpan="6" className="text-center py-8 text-muted-foreground">Keine Daten</td></tr>
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
                    <td className="text-right py-3 px-4 font-semibold">{formatCHF(b.gross)}</td>
                    <td className="text-right py-3 px-4 text-red-600">–{formatCHF(b.storno)}</td>
                    <td className="text-right py-3 px-4 font-bold text-green-600">{formatCHF(b.net)}</td>
                    <td className="text-right py-3 px-4">{formatCHF(b.earned)}</td>
                  </tr>
                ))}
              </tbody>
              {brokerStats.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/40 font-bold">
                    <td className="py-3 px-4">Total</td>
                    <td className="text-right py-3 px-4">{brokerStats.reduce((s, b) => s + b.count, 0)}</td>
                    <td className="text-right py-3 px-4">{formatCHF(brokerStats.reduce((s, b) => s + b.gross, 0))}</td>
                    <td className="text-right py-3 px-4 text-red-600">–{formatCHF(brokerStats.reduce((s, b) => s + b.storno, 0))}</td>
                    <td className="text-right py-3 px-4 text-green-600">{formatCHF(brokerStats.reduce((s, b) => s + b.net, 0))}</td>
                    <td className="text-right py-3 px-4">{formatCHF(brokerStats.reduce((s, b) => s + b.earned, 0))}</td>
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
                    <td className="py-3 px-4">{formatDate(e.settlement_date)}</td>
                    <td className="py-3 px-4">{e.insurer}</td>
                    <td className="py-3 px-4">{e.broker_name || e.broker_email}</td>
                    <td className="py-3 px-4">{e.customer_name}</td>
                    <td className="text-right py-3 px-4 line-through text-muted-foreground">{formatCHF(e.gross_commission)}</td>
                    <td className="text-right py-3 px-4 font-bold text-red-600">–{formatCHF(e.net_payout)}</td>
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
                  <label className="text-sm font-semibold">Abrechnungsdatum *</label>
                  <Input type="date"
                    value={formData.settlement_date || ''}
                    onChange={e => handleFormChange({ settlement_date: e.target.value })}
                    className={`mt-1 ${formErrors.settlement_date ? 'border-red-400' : ''}`}
                  />
                  {formErrors.settlement_date && <p className="text-xs text-red-500 mt-0.5">{formErrors.settlement_date}</p>}
                </div>
                <div>
                  <label className="text-sm font-semibold">Status *</label>
                  <Select value={formData.status || 'erwartet'} onValueChange={v => handleFormChange({ status: v })}>
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
                  <Select value={formData.broker_email || ''} onValueChange={v => {
                    const broker = brokers.find(b => b.email === v)
                    handleFormChange({ broker_email: v, broker_name: broker?.name || '' })
                  }}>
                    <SelectTrigger className={`mt-1 ${formErrors.broker_email ? 'border-red-400' : ''}`}>
                      <SelectValue placeholder="Berater wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {brokers.length === 0
                        ? <SelectItem value="_none" disabled>Keine Berater vorhanden</SelectItem>
                        : brokers.map(b => <SelectItem key={b.id} value={b.email}>{b.name}</SelectItem>)
                      }
                    </SelectContent>
                  </Select>
                  {formErrors.broker_email && <p className="text-xs text-red-500 mt-0.5">{formErrors.broker_email}</p>}
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
                  <label className="text-sm font-semibold">Sparte *</label>
                  <Select value={formData.sparte || ''} onValueChange={v => handleFormChange({ sparte: v })}>
                    <SelectTrigger className={`mt-1 ${formErrors.sparte ? 'border-red-400' : ''}`}>
                      <SelectValue placeholder="Wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_SPARTEN.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {formErrors.sparte && <p className="text-xs text-red-500 mt-0.5">{formErrors.sparte}</p>}
                </div>
                <div>
                  <label className="text-sm font-semibold">Produkt / Tarif</label>
                  <Input value={formData.product || ''}
                    onChange={e => handleFormChange({ product: e.target.value })}
                    className="mt-1" placeholder="z.B. myFlex, Basis, etc." />
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
                  <label className="text-sm font-semibold">Brutto-Provision (CHF) *</label>
                  <Input type="number" step="0.01" min="0"
                    value={formData.gross_commission || ''}
                    onChange={e => handleFormChange({ gross_commission: e.target.value })}
                    className={`mt-1 ${formErrors.gross_commission ? 'border-red-400' : ''}`}
                    placeholder="0.00"
                  />
                  {formErrors.gross_commission && <p className="text-xs text-red-500 mt-0.5">{formErrors.gross_commission}</p>}
                </div>
                <div>
                  <label className="text-sm font-semibold">Anteil Gesellschaft (%)</label>
                  <Input type="number" step="1" min="0" max="100"
                    value={formData.company_share_percent ?? 40}
                    onChange={e => handleFormChange({ company_share_percent: e.target.value })}
                    className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-semibold">Anteil Berater (%)</label>
                  <Input type="number" step="1" min="0" max="100"
                    value={formData.broker_share_percent || ''}
                    onChange={e => handleFormChange({ broker_share_percent: e.target.value })}
                    className="mt-1" placeholder="z.B. 60" />
                </div>
                <div>
                  <label className="text-sm font-semibold">Storno-Abzug (%)</label>
                  <Input type="number" step="1" min="0" max="100"
                    value={formData.storno_percent ?? globalStornoPct}
                    onChange={e => handleFormChange({ storno_percent: e.target.value })}
                    className="mt-1" />
                </div>
              </div>

              {/* Live Preview */}
              <div className="mt-3">
                <CommissionPreview data={formData} globalStornoPct={globalStornoPct} />
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