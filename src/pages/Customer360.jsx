import React, { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getSparteLabel } from '@/lib/insuranceSparten'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ArrowLeft, Phone, Mail, MapPin, Plus, FileText, TrendingUp, 
  CheckCircle2, Clock, AlertCircle, Download, MessageSquare 
} from 'lucide-react'
import NewOfferDialog from '@/components/customers/NewOfferDialog'
import VerkaufschanceStatusBadge from '@/components/verkaufschance/VerkaufschanceStatusBadge'
import VerkaufschanceForm from '@/components/verkaufschance/VerkaufschanceForm'
import VerkaufschanceDetail from '@/components/verkaufschance/VerkaufschanceDetail'
import CrossSellingPanel from '@/components/verkaufschance/CrossSellingPanel'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export default function Customer360() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const [contractFilter, setContractFilter] = useState('active')
  const [showOfferDialog, setShowOfferDialog] = useState(false)
  const [showVsForm, setShowVsForm] = useState(false)
  const [selectedVsId, setSelectedVsId] = useState(null)
  const queryClient = useQueryClient()

  const { data: verkaufschancen = [] } = useQuery({
    queryKey: ['verkaufschancen', customerId],
    queryFn: () => base44.entities.Verkaufschance.filter({ customer_id: customerId }),
  })

  const createVsMutation = useMutation({
    mutationFn: (data) => base44.entities.Verkaufschance.create(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['verkaufschancen', customerId] })
      setShowVsForm(false)
      setSelectedVsId(result.id)
    },
  })

  // Data fetching
  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => base44.entities.Customer.filter({ id: customerId }),
    select: (data) => data?.[0],
  })

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts', customerId],
    queryFn: () => base44.entities.Contract.list(),
    select: (data) => data.filter(c =>
      c.customer_id === customerId ||
      c.primary_customer_id === customerId
    ),
  })

  const { data: allApplications = [] } = useQuery({
    queryKey: ['applications-all'],
    queryFn: () => base44.entities.Application.list(),
  })

  const applications = useMemo(() => {
    return allApplications.filter(a =>
      a.customer_id === customerId ||
      a.primary_customer_id === customerId
    )
  }, [allApplications, customerId])

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', customerId],
    queryFn: () => base44.entities.Task.list(),
    select: (data) => data.filter(t => t.customer_id === customerId),
  })

  const { data: allDocuments = [] } = useQuery({
    queryKey: ['documents-all'],
    queryFn: () => base44.entities.Document.list(),
  })

  const documents = useMemo(() => {
    const appIds = new Set(applications.map(a => a.id))
    const contractIds = new Set(contracts.map(c => c.id))

    return allDocuments.filter(d =>
      d.customer_id === customerId ||
      d.primary_customer_id === customerId ||
      (d.linked_application_id && appIds.has(d.linked_application_id)) ||
      (d.linked_contract_id && contractIds.has(d.linked_contract_id))
    )
  }, [allDocuments, customerId, applications, contracts])

  // Computed metrics
  const metrics = useMemo(() => {
    const activeContracts = contracts.filter(c => c.status === 'active')
    const totalPremium = activeContracts.reduce((sum, c) => sum + (c.premium_yearly || 0), 0)
    const upsellPotential = activeContracts.reduce((sum, c) => sum + (c.upsell_potential_value || 0), 0)
    const renewalsSoon = activeContracts.filter(c => {
      if (!c.end_date) return false
      const daysLeft = Math.floor((new Date(c.end_date) - new Date()) / (1000 * 60 * 60 * 24))
      return daysLeft > 0 && daysLeft < 120
    }).length

    return {
      totalPolicies: activeContracts.length,
      totalPremium: Math.round(totalPremium),
      upsellPotential: Math.round(upsellPotential),
      renewalsSoon,
      openApplications: applications.filter(a => a.status !== 'approved' && a.status !== 'rejected').length,
      openTasks: tasks.filter(t => t.status === 'open' || t.status === 'in_progress').length,
      openVs: verkaufschancen.filter(v => !['gewonnen', 'verloren'].includes(v.status)).length,
    }
  }, [contracts, applications, tasks, verkaufschancen])

  const filteredContracts = useMemo(() => {
    return contracts.filter(c => {
      if (contractFilter === 'active') return c.status === 'active'
      if (contractFilter === 'expiring') {
        if (!c.end_date) return false
        const daysLeft = Math.floor((new Date(c.end_date) - new Date()) / (1000 * 60 * 60 * 24))
        return daysLeft > 0 && daysLeft < 120
      }
      return true
    })
  }, [contracts, contractFilter])

  if (customerLoading) {
    return <div className="p-6">Lädt...</div>
  }

  if (!customer) {
    return <div className="p-6">Kunde nicht gefunden</div>
  }

  return (
    <div className="space-y-6 pb-8">
      {/* HEADER + QUICK ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 bg-gradient-to-r from-slate-50 to-blue-50 p-6 rounded-lg border border-slate-200">
        <div className="flex items-start gap-4 flex-1">
          <Button variant="ghost" size="sm" onClick={() => navigate('/kunden')} className="mt-0.5">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {customer.first_name} {customer.last_name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Kundennummer: {customer.id?.slice(0, 8)}</p>
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className="flex gap-2 flex-wrap sm:flex-col">
          <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => setShowVsForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> Verkaufschance
          </Button>
          <Button size="sm" variant="outline">
            <MessageSquare className="w-4 h-4 mr-1" /> Kontakt
          </Button>
          <Button size="sm" variant="outline">
            <FileText className="w-4 h-4 mr-1" /> Mutation
          </Button>
        </div>
      </div>

      {/* CONTACT INFO + METRICS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* CONTACT INFO */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">📋 Kontaktdaten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium truncate">{customer.email}</p>
              </div>
            </div>
            {customer.phone && (
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Telefon</p>
                  <p className="text-sm font-medium">{customer.phone}</p>
                </div>
              </div>
            )}
            {customer.street && (
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Adresse</p>
                  <p className="text-sm font-medium">
                    {customer.street}<br/>
                    {customer.zip_code} {customer.city}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* KEY METRICS */}
        <div className="lg:col-span-2 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-1">Policen</p>
              <p className="text-2xl font-bold text-primary">{metrics.totalPolicies}</p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-1">Jahresprämie</p>
              <p className="text-2xl font-bold text-green-600">
                CHF {metrics.totalPremium.toLocaleString('de-CH')}
              </p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-1">Upsell-Potenzial</p>
              <p className="text-2xl font-bold text-amber-600">
                CHF {metrics.upsellPotential.toLocaleString('de-CH')}
              </p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-1">Renewals (60d)</p>
              <p className="text-2xl font-bold text-orange-600">{metrics.renewalsSoon}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* TABS: VERTRÄGE, ANTRÄGE, AUFGABEN, AKTIVITÄTEN */}
      <Tabs defaultValue="contracts" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="contracts">📜 Verträge ({filteredContracts.length})</TabsTrigger>
          <TabsTrigger value="verkaufschancen">🎯 Chancen ({metrics.openVs})</TabsTrigger>
          <TabsTrigger value="crossselling">💡 Cross-Selling</TabsTrigger>
          <TabsTrigger value="tasks">✓ Aufgaben ({metrics.openTasks})</TabsTrigger>
          <TabsTrigger value="documents">📎 Dokumente ({documents.length})</TabsTrigger>
        </TabsList>

        {/* CONTRACTS */}
        <TabsContent value="contracts" className="space-y-4">
          <div className="flex items-center gap-2">
            <Select value={contractFilter} onValueChange={setContractFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Aktiv</SelectItem>
                <SelectItem value="expiring">Ablaufend (60d)</SelectItem>
                <SelectItem value="all">Alle</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredContracts.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground text-center">Keine Verträge</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="space-y-0">
                  {filteredContracts.map((contract, idx) => {
                    const daysLeft = contract.end_date
                      ? Math.floor((new Date(contract.end_date) - new Date()) / (1000 * 60 * 60 * 24))
                      : null
                    const isCritical = daysLeft && daysLeft < 30

                    return (
                      <div key={contract.id} className={idx > 0 ? 'border-t border-border' : ''}>
                        <div className="px-4 py-3 hover:bg-muted/30 transition-colors">
                          <div className="flex justify-between items-start gap-4 flex-col sm:flex-row">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <p className="font-bold text-sm">{contract.policy_number || '–'}</p>
                                <Badge variant="outline" className="text-xs">
                                  {contract.product || contract.insurance_type || '–'}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mb-2">{contract.insurer}</p>
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div>
                                  <p className="text-muted-foreground">Prämie</p>
                                  <p className="font-semibold">CHF {(contract.premium_yearly || 0).toLocaleString('de-CH', { maximumFractionDigits: 0 })}/J.</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Gültig bis</p>
                                  <p className="font-semibold">{contract.end_date ? new Date(contract.end_date).toLocaleDateString('de-CH') : '–'}</p>
                                </div>
                              </div>
                            </div>

                            {/* STATUS BADGES */}
                            <div className="flex flex-col gap-1.5 text-right">
                              {contract.renewal_stage && contract.status === 'active' && (
                                <Badge className={
                                  contract.renewal_stage === 'renewed' ? 'bg-green-100 text-green-700' :
                                  contract.renewal_stage === 'lost' ? 'bg-red-100 text-red-700' :
                                  'bg-blue-100 text-blue-700'
                                } >
                                  {contract.renewal_stage === 'early' ? '📅 Early' :
                                   contract.renewal_stage === 'contact' ? '📞 Kontakt' :
                                   contract.renewal_stage === 'offer' ? '📄 Angebot' :
                                   contract.renewal_stage === 'negotiation' ? '🤝 Verhandlung' :
                                   contract.renewal_stage === 'renewed' ? '✅ Verlängert' : '❌ Verloren'}
                                </Badge>
                              )}
                              {contract.upsell_potential_value > 0 && (
                                <Badge className="bg-amber-100 text-amber-700 text-xs">
                                  +CHF {(contract.upsell_potential_value || 0).toLocaleString('de-CH', { maximumFractionDigits: 0 })}
                                </Badge>
                              )}
                              {isCritical && (
                                <Badge className="bg-red-100 text-red-700 text-xs">
                                  <AlertCircle className="w-3 h-3 mr-1" /> {daysLeft}d
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* VERKAUFSCHANCEN */}
        <TabsContent value="verkaufschancen" className="space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-semibold">{verkaufschancen.length} Verkaufschance(n)</p>
              <p className="text-xs text-muted-foreground">Strikt getrennt von Verträgen und Policen</p>
            </div>
            <Button size="sm" onClick={() => setShowVsForm(true)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Neue Chance
            </Button>
          </div>

          {verkaufschancen.length === 0 ? (
            <Card>
              <CardContent className="pt-8 pb-8 text-center">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm text-muted-foreground">Noch keine Verkaufschancen erfasst</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowVsForm(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Erste Chance erfassen
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {verkaufschancen.map(vs => {
                const gesellschaften = vs.gesellschaften || []
                const offerten = gesellschaften.filter(g => g.status === 'offerte_erhalten' || g.praemie_yearly)
                const bestOfferte = offerten.length > 0
                  ? Math.min(...offerten.map(g => g.praemie_yearly).filter(Boolean))
                  : null
                const NEXT_STEP = {
                  neu: 'Gesellschaften anfragen',
                  in_ausschreibung: 'Offerten abwarten',
                  offerten_erhalten: 'Vergleich erstellen & beraten',
                  beratung_erfolgt: 'Entscheid abwarten',
                  kunde_entscheidet: 'Entscheid nachfassen',
                  gewonnen: 'Vertrag erstellen',
                  verloren: '–',
                  wiedervorlage: vs.wiedervorlage_date ? `Wiedervorlage: ${new Date(vs.wiedervorlage_date).toLocaleDateString('de-CH')}` : 'Wiedervorlage prüfen',
                }
                return (
                  <Card key={vs.id}
                    className={`border-l-4 cursor-pointer transition-all hover:shadow-md ${
                      vs.status === 'gewonnen' ? 'border-l-green-500' :
                      vs.status === 'verloren' ? 'border-l-red-400' :
                      vs.status === 'wiedervorlage' ? 'border-l-orange-400' :
                      'border-l-primary'
                    }`}
                    onClick={() => setSelectedVsId(vs.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-sm">{vs.title || getSparteLabel(vs.sparte)}</p>
                            <VerkaufschanceStatusBadge status={vs.status} size="xs" />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{getSparteLabel(vs.sparte)}</p>

                          {/* Gesellschaften */}
                          {gesellschaften.length > 0 && (
                            <div className="mt-2">
                              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">
                                {gesellschaften.length} Gesellschaft(en) · {offerten.length} Offerte(n)
                              </p>
                              <div className="flex gap-1 flex-wrap">
                                {gesellschaften.map(g => (
                                  <span key={g.id} className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                                    g.status === 'ausgewaehlt' ? 'bg-green-100 text-green-700 border-green-200' :
                                    g.status === 'offerte_erhalten' ? 'bg-violet-100 text-violet-700 border-violet-200' :
                                    g.status === 'abgelehnt' ? 'bg-red-50 text-red-500 border-red-100 line-through' :
                                    'bg-slate-100 text-slate-600 border-slate-200'
                                  }`}>
                                    {g.gesellschaft}{g.praemie_yearly ? ` · CHF ${g.praemie_yearly.toLocaleString('de-CH')}` : ''}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Finanzen + nächster Schritt */}
                          <div className="flex flex-wrap gap-3 mt-2">
                            {vs.estimated_value > 0 && (
                              <div>
                                <p className="text-[10px] text-muted-foreground">Gesch. Volumen</p>
                                <p className="text-xs font-semibold text-emerald-700">CHF {vs.estimated_value.toLocaleString('de-CH')}/J.</p>
                              </div>
                            )}
                            {bestOfferte && (
                              <div>
                                <p className="text-[10px] text-muted-foreground">Beste Offerte</p>
                                <p className="text-xs font-semibold text-violet-700">CHF {bestOfferte.toLocaleString('de-CH')}/J.</p>
                              </div>
                            )}
                            {vs.expected_close_date && (
                              <div>
                                <p className="text-[10px] text-muted-foreground">Erwarteter Abschluss</p>
                                <p className="text-xs font-medium">{new Date(vs.expected_close_date).toLocaleDateString('de-CH')}</p>
                              </div>
                            )}
                            {vs.wiedervorlage_date && vs.status === 'wiedervorlage' && (
                              <div>
                                <p className="text-[10px] text-muted-foreground">Wiedervorlage</p>
                                <p className="text-xs font-medium text-orange-600">{new Date(vs.wiedervorlage_date).toLocaleDateString('de-CH')}</p>
                              </div>
                            )}
                          </div>

                          {/* Nächster Schritt */}
                          {!['gewonnen', 'verloren'].includes(vs.status) && (
                            <p className="text-xs text-primary font-medium mt-2">→ {NEXT_STEP[vs.status] || '–'}</p>
                          )}
                          {vs.notes && (
                            <p className="text-xs text-muted-foreground italic mt-1 line-clamp-1">{vs.notes}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* CROSS-SELLING */}
        <TabsContent value="crossselling" className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Cross-Selling & Beratungspotenziale</p>
              <p className="text-xs text-muted-foreground">Automatisch erkannte Lücken, Optimierungen und Beratungsbedarf</p>
            </div>
          </div>
          <CrossSellingPanel
            customer={customer}
            contracts={contracts}
            verkaufschancen={verkaufschancen}
          />
        </TabsContent>

        {/* TASKS */}
        <TabsContent value="tasks" className="space-y-3">
          {tasks.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground text-center">Keine Aufgaben</p>
              </CardContent>
            </Card>
          ) : (
            tasks.map(task => (
              <Card key={task.id} className={`border-l-4 ${task.status === 'completed' ? 'border-l-green-500 opacity-75' : 'border-l-orange-500'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {task.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : 'text-slate-900'}`}>
                        {task.title}
                      </p>
                      {task.due_date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Fällig: {new Date(task.due_date).toLocaleDateString('de-CH')}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* DOCUMENTS */}
        <TabsContent value="documents" className="space-y-3">
          {documents.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground text-center">Keine Dokumente</p>
              </CardContent>
            </Card>
          ) : (
            documents.map(doc => (
              <Card key={doc.id} className="border-l-4 border-l-purple-500">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <FileText className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{doc.category}</p>
                      </div>
                    </div>
                    {doc.file_url && (
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost">
                          <Download className="w-4 h-4" />
                        </Button>
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* NEW OFFER DIALOG (legacy, kept for compatibility) */}
      {customer && (
        <NewOfferDialog
          open={showOfferDialog}
          onOpenChange={setShowOfferDialog}
          customer={customer}
        />
      )}

      {/* NEUE VERKAUFSCHANCE */}
      <Dialog open={showVsForm} onOpenChange={setShowVsForm}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Neue Verkaufschance</DialogTitle>
          </DialogHeader>
          {customer && (
            <VerkaufschanceForm
              customer={customer}
              onSave={(data) => createVsMutation.mutate(data)}
              onCancel={() => setShowVsForm(false)}
              saving={createVsMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* VERKAUFSCHANCE DETAIL */}
      {selectedVsId && (
        <Dialog open={!!selectedVsId} onOpenChange={(o) => { if (!o) setSelectedVsId(null) }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="sr-only">Verkaufschance</DialogTitle></DialogHeader>
            {(() => {
              const vs = verkaufschancen.find(v => v.id === selectedVsId)
              return vs && customer ? (
                <VerkaufschanceDetail
                  verkaufschance={vs}
                  customer={customer}
                  onClose={() => setSelectedVsId(null)}
                  onUpdated={() => queryClient.invalidateQueries({ queryKey: ['verkaufschancen', customerId] })}
                />
              ) : null
            })()}
          </DialogContent>
        </Dialog>
      )}

      {/* AI RECOMMENDATIONS */}
      {(metrics.renewalsSoon > 0 || metrics.upsellPotential > 0) && (
        <Card className="border-l-4 border-l-yellow-500 bg-yellow-50/30">
          <CardHeader>
            <CardTitle className="text-sm">💡 Empfehlungen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {metrics.renewalsSoon > 0 && (
              <p className="text-sm text-slate-700">
                ⏰ <strong>{metrics.renewalsSoon} Verträge</strong> laufen in den nächsten 60 Tagen ab. Renewal-Prozess starten?
              </p>
            )}
            {metrics.upsellPotential > 0 && (
              <p className="text-sm text-slate-700">
                💰 <strong>CHF {metrics.upsellPotential.toLocaleString('de-CH')} Upsell-Potenzial</strong> identifiziert. Angebot erstellen?
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}