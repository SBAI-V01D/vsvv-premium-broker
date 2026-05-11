import React, { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ArrowLeft, Phone, Mail, MapPin, Briefcase, Plus, FileText, TrendingUp, 
  CheckCircle2, Clock, AlertCircle, Download, MessageSquare 
} from 'lucide-react'
import NewOfferDialog from '@/components/customers/NewOfferDialog'

export default function Customer360() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const [contractFilter, setContractFilter] = useState('active')
  const [showOfferDialog, setShowOfferDialog] = useState(false)

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
    }
  }, [contracts, applications, tasks])

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
          <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => setShowOfferDialog(true)}>
            <Plus className="w-4 h-4 mr-1" /> Angebot
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="contracts">📜 Verträge ({filteredContracts.length})</TabsTrigger>
          <TabsTrigger value="applications">📋 Anträge ({metrics.openApplications})</TabsTrigger>
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

        {/* APPLICATIONS */}
        <TabsContent value="applications" className="space-y-3">
          {applications.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground text-center">Keine Anträge</p>
              </CardContent>
            </Card>
          ) : (
            applications.map(app => (
              <Card key={app.id} className="border-l-4 border-l-cyan-500">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-slate-900">{app.product || app.sparte}</p>
                      <p className="text-xs text-muted-foreground">{app.insurer}</p>
                    </div>
                    <Badge className={
                      app.status === 'approved' ? 'bg-green-100 text-green-700' :
                      app.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }>
                      {app.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
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

      {/* NEW OFFER DIALOG */}
      {customer && (
        <NewOfferDialog
          open={showOfferDialog}
          onOpenChange={setShowOfferDialog}
          customer={customer}
        />
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