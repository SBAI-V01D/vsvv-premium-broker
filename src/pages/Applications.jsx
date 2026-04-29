import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Plus, Search, MoreHorizontal, Edit, Trash2, Filter, ChevronDown, ChevronUp, FileText, TrendingUp, Clock, CheckCircle } from 'lucide-react'
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
    await base44.entities.StatusHistory.create({
      entity_type: 'application',
      entity_id: app.id,
      customer_id: app.customer_id,
      from_status: app.custom_status || app.status,
      to_status: status,
      to_status_label: statusDef?.label || status,
      note,
      metadata: JSON.stringify(metadata),
    })
    await base44.entities.Application.update(app.id, {
      custom_status: status,
      insurer: app.insurer || '–',
      insurance_type: app.insurance_type,
      customer_id: app.customer_id,
    })
    queryClient.invalidateQueries({ queryKey: ['applications'] })
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
        <Button onClick={() => { setEditing(null); setShowForm(true) }}>
          <Plus className="w-4 h-4 mr-2" /> Neuer Antrag
        </Button>
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
            {statusDefs.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {uniqueBrokers.length > 0 && (
          <Select value={filterBroker} onValueChange={setFilterBroker}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Alle Berater" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Berater</SelectItem>
              {uniqueBrokers.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Keine Anträge gefunden
            </CardContent>
          </Card>
        ) : (
          filtered.map(app => {
            const docsOpen = expandedDocs === app.id
            return (
              <Card key={app.id} className="overflow-hidden">
                <CardContent className="p-0">
                  {/* Main row */}
                  <div className="p-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold">{app.customer_name}</p>
                            {app.assigned_broker && (
                              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                {app.assigned_broker}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-sm text-muted-foreground">
                              {getSparteLabel(app.sparte || app.insurance_type)}
                            </span>
                            {app.insurer && (
                              <>
                                <span className="text-muted-foreground">·</span>
                                <span className="text-sm text-muted-foreground">{app.insurer}</span>
                              </>
                            )}
                            {app.estimated_premium_yearly && (
                              <>
                                <span className="text-muted-foreground">·</span>
                                <span className="text-sm font-medium">
                                  CHF {app.estimated_premium_yearly.toLocaleString('de-CH', { minimumFractionDigits: 0 })}/J.
                                </span>
                              </>
                            )}
                          </div>
                          {app.notes && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{app.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => setStatusChanging(app)} className="hover:opacity-80 transition-opacity">
                        <StatusBadge statusDef={getStatusDef(app)} label={getStatusLabel(app)} />
                      </button>

                      {/* Docs toggle */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-muted-foreground"
                        onClick={() => setExpandedDocs(docsOpen ? null : app.id)}
                      >
                        <FileText className="w-4 h-4" />
                        {docsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
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

                  {/* Documents panel */}
                  {docsOpen && (
                    <div className="px-4 pb-4 border-t border-border bg-muted/20">
                      <ApplicationDocumentsPanel application={app} />
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Status Dialog */}
      <StatusChangeDialog
        open={!!statusChanging}
        onOpenChange={(open) => { if (!open) setStatusChanging(null) }}
        statusDefinitions={statusDefs}
        currentStatus={statusChanging?.custom_status || statusChanging?.status}
        onSave={handleStatusChange}
        title="Antragsstatus ändern"
      />

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Antrag bearbeiten' : 'Neuer Antrag'}</DialogTitle>
          </DialogHeader>
          <ApplicationForm
            application={editing}
            customers={customers}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditing(null) }}
            saving={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}