import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Plus, Search, MoreHorizontal, Edit, Trash2, FileText, TrendingUp, Clock, CheckCircle, Calendar, Building2, Tag, BarChart2, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ApplicationForm from '../components/applications/ApplicationForm'
import ApplicationDocumentsPanel from '../components/applications/ApplicationDocumentsPanel'
import StatusBadge from '@/components/status/StatusBadge'
import StatusChangeDialog from '@/components/status/StatusChangeDialog'
import { getSparteLabel, ALL_SPARTEN } from '@/lib/insuranceSparten'

export default function Applications() {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [filterSparte, setFilterSparte] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterBroker, setFilterBroker] = useState('all')
  const [statusChanging, setStatusChanging] = useState(null)
  const [expandedDocs, setExpandedDocs] = useState(null)
  const [showStats, setShowStats] = useState(false)
  const queryClient = useQueryClient()

  const { data: statusDefs = [] } = useQuery({
    queryKey: ['statusDefinitions'],
    queryFn: () => base44.entities.StatusDefinition.filter({ type: 'application' }),
  })

  const { data: applications = [] } = useQuery({
    queryKey: ['applications'],
    queryFn: () => base44.entities.Application.list('-created_date'),
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  })

  const { data: brokers = [] } = useQuery({
    queryKey: ['brokers'],
    queryFn: () => base44.entities.Broker.filter({ is_active: true }),
  })

  const getBrokerName = (brokerValue) => {
    if (!brokerValue) return null
    const found = brokers.find(b => b.name === brokerValue || b.email === brokerValue)
    return found?.name || brokerValue
  }

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Application.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['applications'] }); setShowForm(false); setEditing(null) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Application.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['applications'] }); setShowForm(false); setEditing(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Application.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
  })

  // KPIs
  const CLOSED_POSITIVE = ['angenommen', 'policiert', 'approved']
  const CLOSED_NEGATIVE = ['abgelehnt', 'rejected']
  const getStatus = (a) => a.custom_status || a.status

  const openApps = applications.filter(a => ![...CLOSED_POSITIVE, ...CLOSED_NEGATIVE].includes(getStatus(a)))
  const approvedApps = applications.filter(a => CLOSED_POSITIVE.includes(getStatus(a)))
  const rejectedApps = applications.filter(a => CLOSED_NEGATIVE.includes(getStatus(a)))
  const closedTotal = approvedApps.length + rejectedApps.length
  const closureRate = closedTotal > 0
    ? Math.round((approvedApps.length / closedTotal) * 100)
    : 0
  const uniqueBrokers = [...new Set(applications.map(a => a.assigned_broker).filter(Boolean))]
  // resolve broker display names
  

  // Filtering
  const filtered = applications.filter(a => {
    const searchStr = `${a.customer_name} ${a.insurer} ${a.product} ${getSparteLabel(a.sparte || a.insurance_type)}`.toLowerCase()
    const matchSearch = !search.trim() || searchStr.includes(search.toLowerCase())
    const matchSparte = filterSparte === 'all' || a.sparte === filterSparte || a.insurance_type === filterSparte
    const matchStatus = filterStatus === 'all' || (a.custom_status || a.status) === filterStatus
    const matchBroker = filterBroker === 'all' || a.assigned_broker === filterBroker
    return matchSearch && matchSparte && matchStatus && matchBroker
  })

  const handleSave = (data) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleStatusChange = async ({ status, statusDef, note, metadata }) => {
    const app = statusChanging
    const prevStatus = app.custom_status || app.status
    const ACCEPTED_STATUSES = ['angenommen', 'policiert', 'approved']

    await base44.entities.StatusHistory.create({
      entity_type: 'application',
      entity_id: app.id,
      customer_id: app.customer_id,
      from_status: prevStatus,
      to_status: status,
      to_status_label: statusDef?.label || status,
      note,
      metadata: JSON.stringify(metadata),
    })

    // Auto-create contract if newly accepted and no contract linked yet
    let linkedContractId = app.linked_contract_id
    if (ACCEPTED_STATUSES.includes(status) && !ACCEPTED_STATUSES.includes(prevStatus) && !app.linked_contract_id) {
      const newContract = await base44.entities.Contract.create({
        customer_id: app.customer_id,
        customer_name: app.customer_name,
        primary_customer_id: app.primary_customer_id,
        is_family_member: app.is_family_member || false,
        insurer: app.insurer,
        insurance_type: app.insurance_type,
        product: app.product,
        policy_number: app.policy_number || '',
        premium_yearly: app.estimated_premium_yearly,
        premium_monthly: app.estimated_premium_monthly,
        start_date: app.contract_start_date || app.requested_start_date || '',
        end_date: app.contract_end_date || '',
        assigned_broker: app.assigned_broker,
        custom_status: 'aktiv',
        status: 'active',
        notes: `Automatisch erstellt aus Antrag. ${app.notes || ''}`.trim(),
      })
      linkedContractId = newContract.id
    }

    await base44.entities.Application.update(app.id, {
      custom_status: status,
      insurer: app.insurer || '–',
      insurance_type: app.insurance_type,
      customer_id: app.customer_id,
      linked_contract_id: linkedContractId,
    })
    queryClient.invalidateQueries({ queryKey: ['applications'] })
    queryClient.invalidateQueries({ queryKey: ['contracts'] })
    setStatusChanging(null)
  }

  const getStatusDef = (app) => {
    const key = app.custom_status || app.status
    return statusDefs.find(s => s.key === key)
  }
  const getStatusLabel = (app) => getStatusDef(app)?.label || app.status

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Versicherungsanträge</h1>
          <p className="text-muted-foreground mt-1">{applications.length} Anträge insgesamt</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowStats(true)}>
            <BarChart2 className="w-4 h-4 mr-2" /> Auswertung
          </Button>
          <Button onClick={() => { setEditing(null); setShowForm(true) }}>
            <Plus className="w-4 h-4 mr-2" /> Neuer Antrag
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{applications.length}</p>
                <p className="text-xs text-muted-foreground">Total Anträge</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{openApps.length}</p>
                <p className="text-xs text-muted-foreground">Offen / In Bearbeitung</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{approvedApps.length}</p>
                <p className="text-xs text-muted-foreground">Genehmigt / Policiert</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{closureRate}%</p>
                <p className="text-xs text-muted-foreground">Abschlussquote</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Suche (Kunde, Sparte, Versicherer...)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterSparte} onValueChange={setFilterSparte}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Alle Sparten" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Sparten</SelectItem>
            {ALL_SPARTEN.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Alle Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {statusDefs.map(s => <SelectItem key={s.id} value={s.key}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {uniqueBrokers.length > 0 && (
          <Select value={filterBroker} onValueChange={setFilterBroker}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Alle Berater" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Berater</SelectItem>
              {uniqueBrokers.map(b => <SelectItem key={b} value={b}>{getBrokerName(b)}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-[2fr_2fr_1.5fr_1fr_1fr_1fr_auto] gap-3 px-4 py-2 border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <div>Kunde / Berater</div>
            <div>Sparte / Versicherer</div>
            <div>Produkt / Police</div>
            <div>Vertragsbeginn</div>
            <div>Jahresprämie</div>
            <div>Status</div>
            <div className="w-20"></div>
          </div>

          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">Keine Anträge gefunden</div>
          ) : (
            filtered.map((app, idx) => {
              const docsOpen = expandedDocs === app.id
              return (
                <div key={app.id} className={idx > 0 ? 'border-t border-border' : ''}>
                  {/* Main row */}
                  <div className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1.5fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3 items-center hover:bg-muted/30 transition-colors">
                    {/* Kunde */}
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{app.customer_name || '–'}</p>
                      {app.assigned_broker && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{getBrokerName(app.assigned_broker)}</p>
                      )}
                    </div>

                    {/* Sparte / Versicherer */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3 h-3 text-primary flex-shrink-0" />
                        <p className="text-sm font-medium truncate">{getSparteLabel(app.sparte || app.insurance_type)}</p>
                      </div>
                      {app.insurer && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Building2 className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <p className="text-xs text-muted-foreground truncate">{app.insurer}</p>
                        </div>
                      )}
                    </div>

                    {/* Produkt / Police */}
                    <div className="min-w-0">
                      {app.product && <p className="text-sm truncate">{app.product}</p>}
                      {app.policy_number && (
                        <p className="text-xs text-muted-foreground mt-0.5">Police: {app.policy_number}</p>
                      )}
                      {!app.product && !app.policy_number && <span className="text-sm text-muted-foreground">–</span>}
                    </div>

                    {/* Startdatum */}
                    <div>
                      {(app.contract_start_date || app.requested_start_date) ? (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm">
                            {new Date(app.contract_start_date || app.requested_start_date).toLocaleDateString('de-CH')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">–</span>
                      )}
                    </div>

                    {/* Jahresprämie */}
                    <div>
                      {app.estimated_premium_yearly ? (
                        <p className="text-sm font-semibold text-foreground">
                          CHF {app.estimated_premium_yearly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      ) : app.estimated_premium_monthly ? (
                        <p className="text-sm font-medium text-foreground">
                          CHF {app.estimated_premium_monthly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/M.
                        </p>
                      ) : (
                        <span className="text-sm text-muted-foreground">–</span>
                      )}
                    </div>

                    {/* Status */}
                    <div>
                      <button onClick={() => setStatusChanging(app)} className="hover:opacity-80 transition-opacity">
                        <StatusBadge statusDef={getStatusDef(app)} label={getStatusLabel(app)} />
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => setExpandedDocs(docsOpen ? null : app.id)}
                        title="Dokumente"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setStatusChanging(app)}>Status ändern</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setEditing(app); setShowForm(true) }}>
                            <Edit className="w-4 h-4 mr-2" /> Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => { if (confirm('Antrag wirklich löschen?')) deleteMutation.mutate(app.id) }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Notizen (wenn vorhanden) */}
                  {app.notes && (
                    <div className="px-4 pb-2 -mt-1">
                      <p className="text-xs text-muted-foreground line-clamp-1 italic">{app.notes}</p>
                    </div>
                  )}

                  {/* Documents panel */}
                  {docsOpen && (
                    <div className="px-4 pb-4 border-t border-border bg-muted/20">
                      <ApplicationDocumentsPanel application={app} />
                    </div>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Status Dialog */}
      <StatusChangeDialog
        open={!!statusChanging}
        onOpenChange={(open) => { if (!open) setStatusChanging(null) }}
        statusDefinitions={statusDefs}
        currentStatus={statusChanging?.custom_status || statusChanging?.status}
        onSave={handleStatusChange}
        title="Antragsstatus ändern"
      />

      {/* Auswertungs-Dialog */}
      <Dialog open={showStats} onOpenChange={setShowStats}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Auswertung: Anträge nach Sparte</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2 max-h-[60vh] overflow-y-auto">
            {(() => {
              const counts = {}
              applications.forEach(a => {
                const label = getSparteLabel(a.sparte || a.insurance_type) || 'Unbekannt'
                counts[label] = (counts[label] || 0) + 1
              })
              const sorted = Object.entries(counts).sort((x, y) => y[1] - x[1])
              const total = applications.length
              return sorted.map(([label, count]) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium truncate">{label}</span>
                      <span className="text-muted-foreground ml-2 flex-shrink-0">{count} ({Math.round(count / total * 100)}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(count / total) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))
            })()}
            <div className="pt-3 border-t border-border flex justify-between text-sm font-semibold">
              <span>Total</span>
              <span>{applications.length} Anträge</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Antrag bearbeiten' : 'Neuer Antrag'}</DialogTitle>
          </DialogHeader>
          <ApplicationForm
          application={editing}
          customers={customers}
          brokers={brokers}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditing(null) }}
            saving={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}