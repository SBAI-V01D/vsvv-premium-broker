import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Search, Plus, Edit, Trash2, Settings, Download, MoreHorizontal, TrendingUp, Users, AlertTriangle } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const SWISS_INSURERS = [
  'Allianz', 'Axa', 'Baloise', 'CSS', 'Concordia', 'Die Mobiliar', 'Elvia', 'Generali',
  'Helvetia', 'Helsana', 'Mutuel', 'ÖKK', 'SWICA', 'Sanitas', 'Smile', 'Suva',
  'Swiss Life', 'Swiss Re', 'TCS', 'Visana', 'Zurich', 'Andere',
]

const ALL_SPARTEN = ['KVG', 'VVG', 'Leben', 'Sach', 'KFZ', 'BVG', 'Rechtsschutz', 'Haftpflicht', 'Hausrat']

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

  // Data queries
  const { data: entries = [] } = useQuery({
    queryKey: ['commissionEntries'],
    queryFn: () => base44.entities.CommissionEntry.list('-settlement_date'),
  })

  const { data: rates = [] } = useQuery({
    queryKey: ['commissionRates'],
    queryFn: () => base44.entities.CommissionRate.filter({ is_active: true }),
  })

  const { data: stornoConfig = {} } = useQuery({
    queryKey: ['stornoConfig'],
    queryFn: async () => {
      const configs = await base44.entities.StornoConfig.filter({ is_current: true })
      return configs[0] || { global_storno_percent: 10 }
    },
  })

  const { data: brokers = [] } = useQuery({
    queryKey: ['advisors'],
    queryFn: () => base44.entities.Advisor.filter({ status: 'active' }),
  })

  // Create/Update mutations
  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.CommissionEntry.create(calculateFields(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissionEntries'] })
      setShowForm(false)
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CommissionEntry.update(id, calculateFields(data)),
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

  // Calculate auto-fields
  function calculateFields(data) {
    const gross = parseFloat(data.gross_commission) || 0
    const companySPercent = parseFloat(data.company_share_percent) || 40
    const brokerSPercent = parseFloat(data.broker_share_percent) || 0
    const stornoPct = parseFloat(data.storno_percent) || stornoConfig.global_storno_percent || 10

    const companyShare = (gross * companySPercent) / 100
    const brokerShare = (gross * brokerSPercent) / 100
    const stornoAmount = (brokerShare * stornoPct) / 100
    const netPayout = brokerShare - stornoAmount

    return {
      ...data,
      company_share_amount: companyShare,
      broker_share_amount: brokerShare,
      storno_amount: stornoAmount,
      net_payout: netPayout,
    }
  }

  // Filter and calculate KPIs
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const searchStr = `${e.customer_name} ${e.insurer} ${e.sparte}`.toLowerCase()
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

  // KPIs
  const allActiveEntries = entries.filter(e => !['storniert'].includes(e.status))
  const kpis = {
    expectedTotal: allActiveEntries.reduce((sum, e) => sum + (e.gross_commission || 0), 0),
    settledTotal: filteredEntries.filter(e => e.status === 'abgerechnet').reduce((sum, e) => sum + (e.gross_commission || 0), 0),
    avgCommission: filteredEntries.length > 0 ? filteredEntries.reduce((sum, e) => sum + (e.gross_commission || 0), 0) / filteredEntries.length : 0,
    companyShareTotal: filteredEntries.reduce((sum, e) => sum + (e.company_share_amount || 0), 0),
    brokerShareTotal: filteredEntries.reduce((sum, e) => sum + (e.broker_share_amount || 0), 0),
    stornoTotal: filteredEntries.reduce((sum, e) => sum + (e.storno_amount || 0), 0),
    netPayoutTotal: filteredEntries.reduce((sum, e) => sum + (e.net_payout || 0), 0),
  }

  const resetForm = () => {
    setFormData({})
    setEditingEntry(null)
  }

  const handleNewEntry = () => {
    setFormData({
      company_share_percent: 40,
      storno_percent: stornoConfig.global_storno_percent || 10,
      status: 'erwartet',
    })
    setEditingEntry(null)
    setShowForm(true)
  }

  const handleEditEntry = (entry) => {
    setFormData(entry)
    setEditingEntry(entry)
    setShowForm(true)
  }

  const handleSave = () => {
    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const formatCHF = (amount) => {
    return (amount || 0).toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '–'
    return new Date(dateStr).toLocaleDateString('de-CH')
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'erwartet':
        return 'bg-gray-100 text-gray-700'
      case 'abgerechnet':
        return 'bg-green-100 text-green-700'
      case 'teilweise_abgerechnet':
        return 'bg-orange-100 text-orange-700'
      case 'storniert':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const uniqueBrokers = [...new Set(entries.map(e => e.broker_email).filter(Boolean))]
  const uniqueInsurers = [...new Set(entries.map(e => e.insurer).filter(Boolean))]

  // Berater-Drilldown: aggregate per broker
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

  // Storno entries
  const stornoEntries = useMemo(() => entries.filter(e => e.status === 'storniert'), [entries])
  const stornoRisk = useMemo(() => entries.filter(e => e.status === 'erwartet').reduce((s, e) => s + (e.storno_amount || 0), 0), [entries])

  // CSV Export
  const handleCSVExport = () => {
    const headers = ['Datum', 'Gesellschaft', 'Berater', 'Kunde', 'Sparte', 'Produkt', 'Policen-Nr.', 'Brutto (CHF)', 'Anteil Berater (CHF)', 'Storno (CHF)', 'Netto (CHF)', 'Status']
    const rows = filteredEntries.map(e => [
      e.settlement_date || '',
      e.insurer || '',
      e.broker_name || e.broker_email || '',
      e.customer_name || '',
      e.sparte || '',
      e.product || '',
      e.policy_number || '',
      (e.gross_commission || 0).toFixed(2),
      (e.broker_share_amount || 0).toFixed(2),
      (e.storno_amount || 0).toFixed(2),
      (e.net_payout || 0).toFixed(2),
      e.status || '',
    ])
    const csvContent = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `provisionen_${filterYear}_${filterMonth}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
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
      <div className="flex gap-3 items-center">
        <span className="text-sm font-semibold">Zeitraum:</span>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026].map(y => (
              <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Gesamte erwartete Provision</p>
            <p className="text-2xl font-bold mt-1">{formatCHF(kpis.expectedTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Abgerechnete Provision</p>
            <p className="text-2xl font-bold mt-1">{formatCHF(kpis.settledTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Durchschnitt</p>
            <p className="text-2xl font-bold mt-1">{formatCHF(kpis.avgCommission)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Netto-Auszahlung Berater</p>
            <p className="text-2xl font-bold mt-1 text-green-600">{formatCHF(kpis.netPayoutTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Details KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Anteil Gesellschaft (gesamt)</p>
            <p className="text-2xl font-bold mt-1">{formatCHF(kpis.companyShareTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Anteil Berater (gesamt)</p>
            <p className="text-2xl font-bold mt-1">{formatCHF(kpis.brokerShareTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Storno-Abzüge (gesamt)</p>
            <p className="text-2xl font-bold mt-1 text-red-600">–{formatCHF(kpis.stornoTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Storno Risk Banner */}
      {stornoEntries.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span><strong>{stornoEntries.length} stornierte</strong> Einträge · Storno-Risiko auf offene Provisionen: <strong>{formatCHF(stornoRisk)}</strong></span>
        </div>
      )}

      <Tabs defaultValue="liste">
        <TabsList>
          <TabsTrigger value="liste">Abrechnungsliste</TabsTrigger>
          <TabsTrigger value="berater">Berater-Auswertung ({brokerStats.length})</TabsTrigger>
          <TabsTrigger value="storno">Stornos ({stornoEntries.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="berater" className="mt-4">
          <Card>
            <CardContent className="p-0">
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storno" className="mt-4">
          <Card>
            <CardContent className="p-0">
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="liste" className="mt-4">

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Suche (Kunde, Gesellschaft, Sparte...)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {uniqueBrokers.length > 0 && (
          <Select value={filterBroker} onValueChange={setFilterBroker}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Alle Berater" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Berater</SelectItem>
              {uniqueBrokers.map(b => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {uniqueInsurers.length > 0 && (
          <Select value={filterInsurer} onValueChange={setFilterInsurer}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Alle Gesellschaften" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Gesellschaften</SelectItem>
              {uniqueInsurers.map(i => (
                <SelectItem key={i} value={i}>{i}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={filterSparte} onValueChange={setFilterSparte}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Alle Sparten" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Sparten</SelectItem>
            {ALL_SPARTEN.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Alle Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="erwartet">Erwartet</SelectItem>
            <SelectItem value="abgerechnet">Abgerechnet</SelectItem>
            <SelectItem value="teilweise_abgerechnet">Teilweise abgerechnet</SelectItem>
            <SelectItem value="storniert">Storniert</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
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
                  <th className="text-center py-3 px-4 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="text-center py-8 text-muted-foreground">
                      Keine Einträge für diesen Zeitraum
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map(e => (
                    <tr key={e.id} className="border-b hover:bg-muted/30">
                      <td className="py-3 px-4">{formatDate(e.settlement_date)}</td>
                      <td className="py-3 px-4 font-medium">{e.insurer}</td>
                      <td className="py-3 px-4">{e.broker_name || e.broker_email}</td>
                      <td className="py-3 px-4">{e.customer_name}</td>
                      <td className="py-3 px-4">{e.sparte}</td>
                      <td className="text-right py-3 px-4 font-semibold">{formatCHF(e.gross_commission)}</td>
                      <td className="text-right py-3 px-4">{formatCHF(e.broker_share_amount)}</td>
                      <td className="text-right py-3 px-4 text-red-600">–{formatCHF(e.storno_amount)}</td>
                      <td className="text-right py-3 px-4 font-bold text-green-600">{formatCHF(e.net_payout)}</td>
                      <td className="text-center py-3 px-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(e.status)}`}>
                          {e.status === 'erwartet' ? 'Erwartet' : 
                           e.status === 'abgerechnet' ? 'Abgerechnet' :
                           e.status === 'teilweise_abgerechnet' ? 'Teilweise' : 'Storniert'}
                        </span>
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
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => { if (confirm('Wirklich löschen?')) deleteMutation.mutate(e.id) }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Löschen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEntry ? 'Eintrag bearbeiten' : 'Neue Abrechnung'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold">Abrechnungsdatum *</label>
                <Input
                  type="date"
                  value={formData.settlement_date || ''}
                  onChange={e => setFormData(p => ({ ...p, settlement_date: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-semibold">Gesellschaft *</label>
                <Select value={formData.insurer || ''} onValueChange={v => setFormData(p => ({ ...p, insurer: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SWISS_INSURERS.map(i => (
                      <SelectItem key={i} value={i}>{i}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold">Berater *</label>
                <Select value={formData.broker_email || ''} onValueChange={v => {
                  const broker = brokers.find(b => b.email === v)
                  const brokerName = broker ? `${broker.firstname} ${broker.lastname}` : ''
                  setFormData(p => ({ ...p, broker_email: v, broker_name: brokerName }))
                }}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {brokers.map(b => (
                      <SelectItem key={b.id} value={b.email}>{b.firstname} {b.lastname}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-semibold">Kunde / Versicherungsnehmer *</label>
                <Input
                  value={formData.customer_name || ''}
                  onChange={e => setFormData(p => ({ ...p, customer_name: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold">Sparte *</label>
                <Select value={formData.sparte || ''} onValueChange={v => setFormData(p => ({ ...p, sparte: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_SPARTEN.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-semibold">Produkt / Police</label>
                <Input
                  value={formData.product || ''}
                  onChange={e => setFormData(p => ({ ...p, product: e.target.value }))}
                  className="mt-1"
                  placeholder="z.B. myFlex, POL-2024-001"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold">Brutto-Provision (CHF) *</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.gross_commission || ''}
                  onChange={e => setFormData(p => ({ ...p, gross_commission: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-semibold">Anteil Gesellschaft (%)</label>
                <Input
                  type="number"
                  step="1"
                  value={formData.company_share_percent || 40}
                  onChange={e => setFormData(p => ({ ...p, company_share_percent: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold">Anteil Berater (%)</label>
                <Input
                  type="number"
                  step="1"
                  value={formData.broker_share_percent || ''}
                  onChange={e => setFormData(p => ({ ...p, broker_share_percent: e.target.value }))}
                  className="mt-1"
                  placeholder="Auto-filled from rates"
                />
              </div>
              <div>
                <label className="text-sm font-semibold">Storno-Abzug (%)</label>
                <Input
                  type="number"
                  step="1"
                  value={formData.storno_percent || (stornoConfig.global_storno_percent || 10)}
                  onChange={e => setFormData(p => ({ ...p, storno_percent: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold">Status</label>
              <Select value={formData.status || 'erwartet'} onValueChange={v => setFormData(p => ({ ...p, status: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="erwartet">Erwartet</SelectItem>
                  <SelectItem value="abgerechnet">Abgerechnet</SelectItem>
                  <SelectItem value="teilweise_abgerechnet">Teilweise abgerechnet</SelectItem>
                  <SelectItem value="storniert">Storniert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-semibold">Notizen</label>
              <Textarea
                value={formData.notes || ''}
                onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? 'Speichern...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        </TabsContent>
      </Tabs>

      {/* Settings Dialog - placeholder for now */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Einstellungen</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">Provisionssätze und Storno-Konfiguration werden in einer separaten Ansicht verwaltet.</p>
          <DialogFooter>
            <Button onClick={() => setShowSettings(false)}>Schliessen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}