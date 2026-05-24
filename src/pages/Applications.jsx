import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Plus, Search, Edit, Trash2, FileText, TrendingUp, Clock, CheckCircle, Calendar, Building2, Tag, Archive, Inbox } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'

// Helper: formatDate mit Sonderfall für "unbegrenzt"
const formatDateSafe = (dateStr) => {
  if (!dateStr) return '–'
  if (dateStr.startsWith('9999')) return 'Unbegrenzt'
  return new Date(dateStr).toLocaleDateString('de-CH')
}
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ApplicationForm from '../components/applications/ApplicationForm'
import ApplicationDocumentsPanel from '../components/applications/ApplicationDocumentsPanel'
import StatusBadge from '@/components/status/StatusBadge'
import StatusChangeDialog from '@/components/status/StatusChangeDialog'
import { PageHeader, KpiCard, ActionMenu, ConfirmDialog } from '@/components/shared'
import SparteFilterButtons from '../components/applications/SparteFilterButtons'
import { getSparteLabel, ALL_SPARTEN } from '@/lib/insuranceSparten'

export default function Applications() {
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [filterSparte, setFilterSparte] = useState('all')
  const [filterKundentyp, setFilterKundentyp] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterBroker, setFilterBroker] = useState('all')
  const [statusChanging, setStatusChanging] = useState(null)
  const [expandedDocs, setExpandedDocs] = useState(null)
  const [showAuswertung, setShowAuswertung] = useState(false)
  const [activeTab, setActiveTab] = useState('pending') // 'pending' | 'archived'

  const queryClient = useQueryClient()

  const { data: statusDefs = [] } = useQuery({
    queryKey: ['statusDefinitions'],
    queryFn: () => base44.entities.StatusDefinition.filter({ type: 'application' }),
  })

  const { data: applications = [] } = useQuery({
    queryKey: ['applications'],
    queryFn: () => base44.entities.Application.filter({ archived: false }, '-created_date', 300),
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('-created_date', 500),
    staleTime: 5 * 60 * 1000,
  })

  const { data: brokers = [] } = useQuery({
    queryKey: ['brokers'],
    queryFn: () => base44.entities.Broker.filter({ is_active: true }, '-created_date', 100),
  })

  const getCustomer = (customerId) => customers.find(c => c.id === customerId)

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
   const STORNIERT_ABGELEHNT = ['abgelehnt', 'rejected', 'storniert', 'cancelled']
   const ACCEPTED_KEYS = ['angenommen', 'policiert', 'approved', 'angenommen_vorbehalt', 'bewilligung_erteilt']
   const OPEN_KEYS = ['neu', 'draft', 'submitted', 'in_bearbeitung', 'under_review', 'eingereicht', 'in_pruefung', 'rueckfrage', 'vorbehalt', 'risikopruefung', 'offen', 'new', 'in_progress', 'waiting']
   const ARCHIVED_KEYS = [...ACCEPTED_KEYS, ...STORNIERT_ABGELEHNT]
   const getStatus = (a) => {
     if (!a) return ''
     return (a.custom_status || a.status || '').toLowerCase().trim()
   }

  const activeApps = applications.filter(a => !STORNIERT_ABGELEHNT.includes(getStatus(a)))
  const openApps = applications.filter(a => OPEN_KEYS.includes(getStatus(a)))
  const approvedApps = applications.filter(a => ACCEPTED_KEYS.includes(getStatus(a)))

  // Tab split
  const pendingApps = applications.filter(a => !ARCHIVED_KEYS.includes(getStatus(a)))
  const archivedApps = applications.filter(a => ARCHIVED_KEYS.includes(getStatus(a)))
  const closureRate = activeApps.length > 0
    ? ((approvedApps.length / activeApps.length) * 100).toFixed(1)
    : '0.0'
  const uniqueBrokers = [...new Set(applications.map(a => a.assigned_broker).filter(Boolean))]
  
  // Provision: nur angenommene/policierte Anträge mit einem effektiven commission_estimate
  const commissionApps = approvedApps.filter(a => (a.commission_estimate || 0) > 0)
  const totalCommission = commissionApps.reduce((sum, a) => sum + (a.commission_estimate || 0), 0)
  const avgCommission = commissionApps.length > 0 ? (totalCommission / commissionApps.length).toFixed(2) : 0


  // Filtering
  const PRIVAT_VALUES = ['kvg','vvg_zusatz','kvg_vvg_kombi','leben_3a','leben_3b','unfall_privat','haftpflicht_privat','hausrat','gebaude_privat','motorfahrzeug','rechtsschutz_privat','reise','cyber_privat']
  const FIRMA_VALUES = ['bvg','uvg','ktg','inventar','gebaude_firma','technisch','transport','betriebshaftpflicht','berufshaftpflicht','do','rechtsschutz_firma','cyber_firma','kredit','flotte','keyman','gruppen_leben']

  const tabSource = activeTab === 'pending' ? pendingApps : archivedApps

  const filtered = tabSource.filter(a => {
    const customer = getCustomer(a.customer_id)
    const customerCompanyName = customer?.company_name || ''
    const searchStr = `${a.customer_name} ${customerCompanyName} ${a.insurer} ${a.product} ${getSparteLabel(a.sparte || a.insurance_type)}`.toLowerCase()
    const matchSearch = !search.trim() || searchStr.includes(search.toLowerCase())
    const matchSparte = filterSparte === 'all' || a.sparte === filterSparte || a.insurance_type === filterSparte
    const matchStatus = filterStatus === 'all' || getStatus(a) === filterStatus.toLowerCase().trim()
    const matchBroker = filterBroker === 'all' || a.assigned_broker === filterBroker
    const sparteKey = a.sparte || a.insurance_type
    const kundentyp = a.kundentyp || (PRIVAT_VALUES.includes(sparteKey) ? 'privat' : FIRMA_VALUES.includes(sparteKey) ? 'firma' : null)
    const matchKundentyp = filterKundentyp === 'all'
      || (filterKundentyp === 'privat' && (kundentyp === 'privat' || PRIVAT_VALUES.includes(sparteKey)))
      || (filterKundentyp === 'firma' && (kundentyp === 'firma' || FIRMA_VALUES.includes(sparteKey)))
    return matchSearch && matchSparte && matchStatus && matchBroker && matchKundentyp
  })

  const handleSave = (data) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleStatusChange = async ({ status, statusDef, note, metadata }) => {
    if (!statusChanging) return
    const app = statusChanging

    const APPROVED_KEYS = ['angenommen', 'policiert', 'approved', 'angenommen_vorbehalt', 'bewilligung_erteilt']
    const isApproval = APPROVED_KEYS.includes(status?.toLowerCase())

    setStatusChanging(null)

    // ONE-CLICK: Annehmen & Vertrag erstellen in einem Schritt
    if (isApproval) {
      setCreatingContract(true)
      try {
        const result = await base44.functions.invoke('acceptApplicationAndCreateContract', {
          application_id: app.id,
        })
        if (result.data.success) {
          await queryClient.invalidateQueries({ queryKey: ['contracts'] })
          await queryClient.invalidateQueries({ queryKey: ['applications'] })
          await queryClient.invalidateQueries({ queryKey: ['commissionEntries'] })
        }
      } catch (e) {
        console.error('One-click acceptance failed:', e)
        // Fallback: normaler Status-Update
        await base44.entities.Application.update(app.id, {
          custom_status: status,
          status_changed_at: new Date().toISOString(),
        })
      }
      setCreatingContract(false)
    } else {
      // Normaler Status-Update (nicht Genehmigung)
      await base44.entities.Application.update(app.id, {
        custom_status: status,
        status_changed_at: new Date().toISOString(),
      })
    }

    await queryClient.invalidateQueries({ queryKey: ['applications'] })
    await queryClient.invalidateQueries({ queryKey: ['contracts'] })
    await queryClient.invalidateQueries({ queryKey: ['customers'] })
    await queryClient.invalidateQueries({ queryKey: ['tasks'] })
    await queryClient.invalidateQueries({ queryKey: ['commissionEntries'] })
  }

  const getStatusDef = (app) => {
    const key = getStatus(app)
    return statusDefs.find(s => s.key === key)
  }
  const getStatusLabel = (app) => getStatusDef(app)?.label || getStatus(app)
  const formatDate = formatDateSafe

  const [confirmDeleteApp, setConfirmDeleteApp] = useState(null)
  const [creatingContract, setCreatingContract] = useState(false)

  return (
    <div className="page-enter flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border bg-card shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[hsl(var(--primary))] tracking-tight">Versicherungsanträge</h1>
              <p className="text-xs text-muted-foreground">{pendingApps.length} pendente · {archivedApps.length} archivierte Anträge</p>
            </div>
          </div>
          <Button onClick={() => { setEditing(null); setShowForm(true) }}>
            <Plus className="w-4 h-4 mr-2" /> Neuer Antrag
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {creatingContract && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 bg-card border border-border shadow-card-md rounded-xl px-4 py-3 text-sm">
          <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="font-medium text-foreground">Vertrag wird erstellt…</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard label="Total aktiv" value={activeApps.length} icon={FileText} color="blue" />
        <KpiCard label="Offen / In Bearbeitung" value={openApps.length} icon={Clock} color="amber" />
        <KpiCard label="Angenommen / Policiert" value={approvedApps.length} icon={CheckCircle} color="green" />
        <KpiCard label="Abschlussquote" value={`${closureRate}%`} icon={TrendingUp} color="purple" />
        <KpiCard
          label="Realisierte Provision"
          value={`CHF ${totalCommission.toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          icon={TrendingUp}
          color="green"
        />
        <KpiCard
          label="Ø Provision"
          value={`CHF ${Number(avgCommission).toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          icon={TrendingUp}
          color="blue"
        />
      </div>

      {/* Auswertungs-Button */}
      <div className="mb-4">
        <Button variant="outline" onClick={() => setShowAuswertung(true)}>
          📊 Auswertung nach Sparte
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-muted/40 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'pending'
              ? 'bg-card shadow text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Inbox className="w-4 h-4" />
          Pendente Anträge
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'}`}>
            {pendingApps.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('archived')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'archived'
              ? 'bg-card shadow text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Archive className="w-4 h-4" />
          Archivierte Anträge
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === 'archived' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
            {archivedApps.length}
          </span>
        </button>
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
          <div className="hidden md:grid grid-cols-[2fr_2fr_1.5fr_1.2fr_1fr_1fr_auto] gap-3 px-4 py-2 border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <div>Kunde / Berater</div>
            <div>Sparte / Versicherer</div>
            <div>Produkt / Tarif</div>
            <div>Vertragsdaten</div>
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
                  <div className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1.5fr_1.2fr_1fr_1fr_auto] gap-3 px-4 py-1.5 items-center hover:bg-muted/30 transition-colors group">
                    {/* Kunde */}
                    <div className="min-w-0">
                      <p className="font-semibold text-xs truncate">{app.customer_name || '–'}</p>
                      {(() => {
                        const cust = getCustomer(app.customer_id)
                        const ahv = cust?.ahv_number || app.sparte_data?.ahv_number
                        return ahv ? (
                          <p className="text-xs font-mono text-muted-foreground mt-0.5">{ahv}</p>
                        ) : null
                      })()}
                      {app.assigned_broker && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">Berater: {getBrokerName(app.assigned_broker)}</p>
                      )}
                    </div>

                    {/* Sparte / Versicherer / Produkt */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3 h-3 text-primary flex-shrink-0" />
                        <p className="text-xs font-medium truncate">{getSparteLabel(app.sparte || app.insurance_type)}</p>
                      </div>
                      {app.product && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{app.product}</p>
                      )}
                      {app.insurer && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Building2 className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <p className="text-xs text-muted-foreground truncate">{app.insurer}</p>
                        </div>
                      )}
                    </div>

                    {/* Produkt / Tarif */}
                    <div className="min-w-0">
                      {/* KVG/VVG: Franchise + Altersgruppe + Modell + Zusatz */}
                      {['kvg','kvg_vvg_kombi'].includes(app.sparte || app.insurance_type) && (
                        <>
                          {app.sparte_data?.franchise ? (
                            <>
                              <p className="text-sm font-medium">CHF {app.sparte_data.franchise}</p>
                              {app.sparte_data?.age_group && (
                                <p className="text-xs text-muted-foreground">{app.sparte_data.age_group}</p>
                              )}
                              {app.sparte_data?.model && (
                                <p className="text-xs text-muted-foreground">{app.sparte_data.model}</p>
                              )}
                              {app.sparte_data?.zusatz_type && (
                                <p className="text-xs text-muted-foreground">{app.sparte_data.zusatz_type}</p>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">–</span>
                          )}
                        </>
                      )}
                      {/* VVG Zusatz */}
                      {(app.sparte || app.insurance_type) === 'vvg_zusatz' && (
                        <>
                          {app.sparte_data?.zusatz_type && (
                            <p className="text-sm truncate">{app.sparte_data.zusatz_type}</p>
                          )}
                          {!app.sparte_data?.zusatz_type && (
                            <span className="text-xs text-muted-foreground">–</span>
                          )}
                        </>
                      )}
                      {/* Alle anderen Sparten */}
                      {!['kvg','kvg_vvg_kombi','vvg_zusatz'].includes(app.sparte || app.insurance_type) && (
                        <>
                          {app.product && <p className="text-sm truncate">{app.product}</p>}
                          {app.policy_number && (
                            <p className="text-xs text-muted-foreground mt-0.5">Police: {app.policy_number}</p>
                          )}
                          {!app.product && !app.policy_number && <span className="text-sm text-muted-foreground">–</span>}
                        </>
                      )}
                    </div>

                    {/* Vertragsdaten */}
                    <div>
                      {(app.contract_start_date || app.requested_start_date) && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <Calendar className="w-3 h-3 text-green-600 flex-shrink-0" />
                          <span className="text-xs text-green-600 font-medium">
                            {formatDate(app.contract_start_date || app.requested_start_date)}
                          </span>
                        </div>
                      )}
                      {app.contract_end_date && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-green-600 flex-shrink-0" />
                          <span className="text-xs text-green-600 font-medium">
                            {formatDate(app.contract_end_date)}
                          </span>
                        </div>
                      )}
                      {!app.contract_start_date && !app.requested_start_date && !app.contract_end_date && (
                       <span className="text-xs text-muted-foreground">–</span>
                      )}
                    </div>

                    {/* Prämien */}
                    <div>
                      {app.estimated_premium_yearly ? (
                        <p className="text-xs font-semibold text-foreground">
                          CHF {app.estimated_premium_yearly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/J.
                        </p>
                      ) : null}
                      {app.estimated_premium_monthly ? (
                        <p className="text-xs text-muted-foreground">
                          CHF {app.estimated_premium_monthly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/M.
                        </p>
                      ) : null}
                      {!app.estimated_premium_yearly && !app.estimated_premium_monthly && (
                        <span className="text-xs text-muted-foreground">–</span>
                      )}
                    </div>

                    {/* Status + Datum */}
                    <div>
                      <button onClick={() => setStatusChanging(app)} className="hover:opacity-80 transition-opacity mb-1">
                        <StatusBadge statusDef={getStatusDef(app)} label={getStatusLabel(app) || getStatus(app)} />
                      </button>
                      {/* ONE-CLICK ANNAHME BUTTON */}
                      {['eingereicht', 'in_pruefung', 'rueckfrage', 'vorbehalt', 'risikopruefung', 'under_review', 'neu'].includes(getStatus(app)) && (
                        <button
                          onClick={async () => {
                            setCreatingContract(true)
                            try {
                              const result = await base44.functions.invoke('acceptApplicationAndCreateContract', {
                                application_id: app.id,
                              })
                              if (result.data.success) {
                                await queryClient.invalidateQueries({ queryKey: ['contracts'] })
                                await queryClient.invalidateQueries({ queryKey: ['applications'] })
                                await queryClient.invalidateQueries({ queryKey: ['commissionEntries'] })
                                toast.success(`Vertrag erstellt für ${app.customer_name}`)
                              }
                            } catch (e) {
                              console.error('One-click acceptance failed:', e)
                              toast.error('Vertrag konnte nicht erstellt werden')
                            }
                            setCreatingContract(false)
                          }}
                          className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-semibold"
                        >
                          ✓ Annehmen &amp; Vertrag
                        </button>
                      )}
                      {app.status_changed_at && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(app.status_changed_at).toLocaleDateString('de-CH')}
                        </p>
                      )}
                      {app.sparte_data?.health_declaration && (
                        <div className="mt-1">
                          <p className={`text-xs font-medium ${app.sparte_data.health_declaration === 'Ja' ? 'text-orange-600' : 'text-green-600'}`}>
                            GD: {app.sparte_data.health_declaration === 'Ja' ? 'erforderlich' : 'nicht erforderlich'}
                          </p>
                          {app.notes && (
                            <p className="text-xs text-red-600 line-clamp-2 mt-0.5">{app.notes}</p>
                          )}
                        </div>
                      )}
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
                      <ActionMenu items={[
                        ...(app.customer_id ? [{ label: 'Kunde öffnen', onClick: () => navigate(`/kunden/${app.customer_id}`) }] : []),
                        ...(getCustomer(app.customer_id)?.email ? [{ label: 'E-Mail senden', onClick: () => window.location.href = `mailto:${getCustomer(app.customer_id).email}` }] : []),
                        ...(getCustomer(app.customer_id)?.phone ? [{ label: 'Anrufen', onClick: () => window.location.href = `tel:${getCustomer(app.customer_id).phone}` }] : []),
                        { label: 'Status ändern', onClick: () => setStatusChanging(app), separator: true },
                        { label: 'Bearbeiten', icon: Edit, onClick: () => { setEditing(app); setShowForm(true) } },
                        ...(activeTab === 'pending' && !ACCEPTED_KEYS.includes(getStatus(app))
                          ? [{ label: 'Archivieren (angenommen)', icon: Archive, onClick: () => updateMutation.mutate({ id: app.id, data: { custom_status: 'angenommen', status_changed_at: new Date().toISOString() } }) }]
                          : []),
                        ...(activeTab === 'archived' && ARCHIVED_KEYS.includes(getStatus(app))
                          ? [{ label: 'Zurück zu Pendent', icon: Inbox, onClick: () => updateMutation.mutate({ id: app.id, data: { custom_status: 'in_pruefung', status_changed_at: new Date().toISOString() } }) }]
                          : []),
                        { label: 'Löschen', icon: Trash2, variant: 'destructive', separator: true, onClick: () => setConfirmDeleteApp(app) },
                      ]} />
                    </div>
                  </div>

                  {/* Notizen (wenn vorhanden) */}
                  {app.notes && (
                    <div className="px-4 pb-2 -mt-1">
                      <p className="text-xs text-muted-foreground line-clamp-1 italic">{app.notes}</p>
                    </div>
                  )}

                  {/* Documents panel – always mounted so upload dialog works */}
                  <div className={`px-4 pb-4 border-t border-border bg-muted/20 ${docsOpen ? '' : 'hidden'}`}>
                    <ApplicationDocumentsPanel application={app} />
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!confirmDeleteApp}
        onOpenChange={(open) => { if (!open) setConfirmDeleteApp(null) }}
        title="Antrag löschen"
        description="Dieser Antrag wird unwiderruflich gelöscht. Fortfahren?"
        confirmLabel="Löschen"
        variant="danger"
        onConfirm={() => { if (confirmDeleteApp) deleteMutation.mutate(confirmDeleteApp.id) }}
      />

      {/* Status Dialog */}
      <StatusChangeDialog
        open={!!statusChanging}
        onOpenChange={(open) => { if (!open) setStatusChanging(null) }}
        statusDefinitions={statusDefs}
        currentStatus={statusChanging ? (statusDefs.find(s => s.key === getStatus(statusChanging)) ? getStatus(statusChanging) : '') : ''}
        onSave={handleStatusChange}
        title="Antragsstatus ändern"
      />



      {/* Auswertungs-Dialog */}
      <Dialog open={showAuswertung} onOpenChange={setShowAuswertung}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Auswertung nach Sparte &amp; Kundentyp</DialogTitle>
          </DialogHeader>
          <SparteFilterButtons
            applications={applications}
            activeKundentyp={filterKundentyp}
            onSelectKundentyp={setFilterKundentyp}
            filterSparte={filterSparte}
            onSelectSparte={setFilterSparte}
          />
        </DialogContent>
      </Dialog>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="application-form-description">
          <DialogHeader>
            <DialogTitle>{editing ? 'Antrag bearbeiten' : 'Neuer Antrag'}</DialogTitle>
            <div id="application-form-description" className="sr-only">
              {editing ? 'Dialog zum Bearbeiten eines Versicherungsantrags' : 'Dialog zum Erstellen eines neuen Versicherungsantrags'}
            </div>
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
    </div>
  )
}