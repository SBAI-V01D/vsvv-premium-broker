import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Edit, Mail, Phone, MapPin } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import CustomerForm from '../components/customers/CustomerForm'
import DocumentsTab from '../components/documents/DocumentsTab'
import { STATUS_LABELS, INSURANCE_TYPE_LABELS, FAMILY_ROLE_LABELS, label } from '@/lib/labels'
import { getSparteLabel } from '@/lib/insuranceSparten'
import StatusBadge from '@/components/status/StatusBadge'

export default function CustomerDetail() {
  const { id } = useParams()
  const [showEdit, setShowEdit] = useState(false)
  const queryClient = useQueryClient()

  const { data: customer } = useQuery({
    queryKey: ['customers', id],
    queryFn: () => base44.entities.Customer.list().then(c => c.find(x => x.id === id)),
  })

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list(null, 1000),
  })

  const { data: applications = [] } = useQuery({
    queryKey: ['applications'],
    queryFn: () => base44.entities.Application.list(null, 1000),
  })

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', id],
    queryFn: () => base44.entities.Message.filter({ customer_id: id }),
    enabled: !!id,
  })

  const { data: allCustomers = [] } = useQuery({
    queryKey: ['customers', id],
    queryFn: () => base44.entities.Customer.list(),
  })

  const { data: allDocuments = [] } = useQuery({
    queryKey: ['documents'],
    queryFn: () => base44.entities.Document.list(null, 1000),
  })

  // If customer is a family member, show primary customer's ID too
  const primaryCustomerId = customer?.primary_customer_id || customer?.id
  const familyMembers = (Array.isArray(allCustomers) ? allCustomers : []).filter(c => 
    c.primary_customer_id === primaryCustomerId || c.id === primaryCustomerId
  )

  // Include both the customer and primary customer ID (important if viewing a family member)
  const customerIds = [customer?.id, primaryCustomerId].filter(Boolean).concat(familyMembers.map(m => m.id))
  const relatedContracts = contracts.filter(c => customerIds.includes(c.customer_id))
  const relatedApplications = applications.filter(a => customerIds.includes(a.customer_id))
  const relatedMessages = (Array.isArray(allCustomers) ? allCustomers : []).filter(c => customerIds.includes(c.id)).flatMap(c => c.messages || [])
  const relatedDocuments = allDocuments.filter(d => customerIds.includes(d.customer_id))

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Customer.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); setShowEdit(false); },
  })

  if (!customer) {
    return <div className="flex items-center justify-center h-64"><p>Laden...</p></div>
  }

  return (
    <div>
      <Link to="/kunden" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Zurück
      </Link>

      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
            {customer.first_name?.[0]}{customer.last_name?.[0]}
          </div>
          <div>
            <h1 className="text-3xl font-bold">{customer.first_name} {customer.last_name}</h1>
            <p className="text-muted-foreground mt-1">{customer.email}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setShowEdit(true)}>
          <Edit className="w-4 h-4 mr-2" /> Bearbeiten
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 space-y-2">
            {customer.email && <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-muted-foreground" /> {customer.email}</div>}
            {customer.phone && <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-muted-foreground" /> {customer.phone}</div>}
            {customer.mobile && <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-muted-foreground" /> {customer.mobile}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            {customer.street && <div className="flex items-center gap-2 text-sm"><MapPin className="w-4 h-4 text-muted-foreground" /> {customer.street}, {customer.zip_code} {customer.city}</div>}
            {customer.canton && <div className="text-sm text-muted-foreground">Kanton {customer.canton}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            {customer.birthdate && <div className="text-sm"><span className="text-muted-foreground">Geburtsdatum:</span> {new Date(customer.birthdate).toLocaleDateString('de-CH')}</div>}
            {customer.profession && <div className="text-sm"><span className="text-muted-foreground">Beruf:</span> {customer.profession}</div>}
            <div className="text-sm"><span className="text-muted-foreground">Status:</span> {label(STATUS_LABELS, customer.status)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="vertraege">
        <TabsList className="mb-4">
          <TabsTrigger value="vertraege">Verträge ({relatedContracts.length})</TabsTrigger>
          <TabsTrigger value="antraege">Anträge ({relatedApplications.length})</TabsTrigger>
          <TabsTrigger value="familie">Familie ({familyMembers.length > 1 ? familyMembers.length - 1 : 0})</TabsTrigger>
          <TabsTrigger value="dokumente">Dokumente ({relatedDocuments.length})</TabsTrigger>
          <TabsTrigger value="kommunikation">Kommunikation</TabsTrigger>
        </TabsList>

        <TabsContent value="vertraege">
          {relatedContracts.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-muted-foreground">Keine Verträge vorhanden</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="hidden md:grid grid-cols-[2fr_2fr_1.2fr_1.2fr_1.2fr_1fr_1fr] gap-3 px-4 py-2 border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <div>Kunde</div>
                  <div>Versicherer / Sparte</div>
                  <div>Policen-Nr</div>
                  <div>Produkt / Tarif</div>
                  <div>Vertragsdaten</div>
                  <div>Jahresprämie</div>
                  <div>Status</div>
                </div>
                {relatedContracts.map((c, idx) => {
                  const relatedCustomer = (Array.isArray(allCustomers) ? allCustomers : []).find(x => x.id === c.customer_id)
                  const formatDate = (dateStr) => {
                    if (!dateStr) return '–'
                    return new Date(dateStr).toLocaleDateString('de-CH')
                  }
                  return (
                    <div key={c.id} className={idx > 0 ? 'border-t border-border' : ''}>
                      <div className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1.2fr_1.2fr_1.2fr_1fr_1fr] gap-3 px-4 py-3 items-center hover:bg-muted/30 transition-colors">
                        {/* Kunde */}
                        <div className="min-w-0">
                          <p className="font-semibold text-xs truncate">{relatedCustomer ? `${relatedCustomer.first_name} ${relatedCustomer.last_name}` : c.customer_name}</p>
                          {relatedCustomer?.ahv_number && (
                            <p className="text-xs font-mono text-muted-foreground mt-0.5">{relatedCustomer.ahv_number}</p>
                          )}
                        </div>

                        {/* Versicherer / Sparte */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-medium truncate">{c.insurer}</p>
                          </div>
                          {c.sparte || c.insurance_type ? (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{getSparteLabel(c.sparte || c.insurance_type)}</p>
                          ) : null}
                          {c.sparte_data?.franchise && (
                            <p className="text-xs text-muted-foreground mt-0.5">Franchise: CHF {c.sparte_data.franchise}</p>
                          )}
                          {c.sparte_data?.model && (
                            <p className="text-xs text-muted-foreground mt-0.5">Modell: {c.sparte_data.model}</p>
                          )}
                        </div>

                        {/* Policen-Nr */}
                        <div className="min-w-0">
                          {c.policy_number && (
                            <p className="text-xs font-medium">{c.policy_number}</p>
                          )}
                          {!c.policy_number && <span className="text-xs text-muted-foreground">–</span>}
                        </div>

                        {/* Produkt / Tarif */}
                        <div className="min-w-0">
                          {c.product && (
                            <p className="text-xs font-medium">{c.product}</p>
                          )}
                          {!c.product && <span className="text-xs text-muted-foreground">–</span>}
                        </div>

                        {/* Vertragsdaten */}
                        <div>
                          {c.start_date && (
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-xs text-green-600 font-medium">{formatDate(c.start_date)}</span>
                            </div>
                          )}
                          {c.end_date && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-green-600 font-medium">{formatDate(c.end_date)}</span>
                            </div>
                          )}
                          {!c.start_date && !c.end_date && (
                            <span className="text-xs text-muted-foreground">–</span>
                          )}
                        </div>

                        {/* Jahresprämie */}
                        <div>
                          {c.premium_yearly ? (
                            <p className="text-xs font-semibold text-foreground">
                              CHF {c.premium_yearly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/J.
                            </p>
                          ) : null}
                          {c.premium_monthly ? (
                            <p className="text-xs text-muted-foreground">
                              CHF {c.premium_monthly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/M.
                            </p>
                          ) : null}
                          {!c.premium_yearly && !c.premium_monthly && (
                            <span className="text-xs text-muted-foreground">–</span>
                          )}
                        </div>

                        {/* Status */}
                        <div>
                          <StatusBadge statusDef={{ label: c.custom_status || label(STATUS_LABELS, c.status) }} label={c.custom_status || label(STATUS_LABELS, c.status)} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="anträge">
          {relatedApplications.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-muted-foreground">Keine Anträge vorhanden</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {relatedApplications.map(a => {
                const relatedCustomer = (Array.isArray(allCustomers) ? allCustomers : []).find(x => x.id === a.customer_id)
                const premiumMonthly = a.estimated_premium_monthly
                const premiumYearly = a.estimated_premium_yearly || (premiumMonthly ? Math.round(premiumMonthly * 12) : null)
                const ageGroup = a.sparte_data?.age_group
                const franchise = a.sparte_data?.franchise
                const model = a.sparte_data?.model
                const produkte = a.sparte_data?.produkte || []
                const productType = a.product || a.sparte_data?.product_type
                const statusKey = a.custom_status || a.status
                const statusColors = {
                  angenommen: 'bg-green-100 text-green-700',
                  policiert: 'bg-green-100 text-green-700',
                  approved: 'bg-green-100 text-green-700',
                  eingereicht: 'bg-blue-100 text-blue-700',
                  in_bearbeitung: 'bg-blue-100 text-blue-700',
                  in_pruefung: 'bg-amber-100 text-amber-700',
                  pruefung_erforderlich: 'bg-amber-100 text-amber-700',
                  abgelehnt: 'bg-red-100 text-red-700',
                }
                return (
                  <Card key={a.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">{relatedCustomer?.first_name && relatedCustomer?.last_name ? `${relatedCustomer.first_name} ${relatedCustomer.last_name}` : a.customer_name}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-sm">{a.insurer || '–'}</p>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                {getSparteLabel(a.sparte || a.insurance_type) || a.insurance_type}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                            {franchise && <span>Franchise: CHF {franchise}</span>}
                            {model && <span>Modell: {model}</span>}
                            {a.contract_start_date && <span>ab {new Date(a.contract_start_date).toLocaleDateString('de-CH')}</span>}
                          </div>
                          {ageGroup && <p className="text-xs text-muted-foreground mt-1">{ageGroup}</p>}
                          {produkte.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {produkte.map((p, i) => (
                                <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  {p.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          {productType && (
                            <p className="text-xs text-muted-foreground mb-2">{productType}</p>
                          )}
                          {premiumMonthly && (
                            <p className="text-sm text-muted-foreground">CHF {premiumMonthly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/M.</p>
                          )}
                          {premiumYearly && (
                            <p className="font-bold text-sm">CHF {premiumYearly.toLocaleString('de-CH', { minimumFractionDigits: 0 })}/J.</p>
                          )}
                          <p className="text-xs mt-1">
                            <span className={`px-2 py-0.5 rounded-full font-medium ${statusColors[statusKey] || 'bg-muted text-muted-foreground'}`}>
                              {statusKey}
                            </span>
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="familie">
          {familyMembers.length <= 1 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Keine Familienmitglieder vorhanden
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {familyMembers.filter(m => m.id !== id).map(member => (
                <Card key={member.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium">{member.first_name} {member.last_name}</p>
                        <p className="text-sm text-muted-foreground mt-1">{member.email} • {label(FAMILY_ROLE_LABELS, member.family_role)}</p>
                        <p className="text-xs text-muted-foreground mt-2">{member.city}, {member.canton}</p>
                      </div>
                      <a href={`/kunden/${member.id}`} className="text-primary hover:underline text-sm font-medium">
                        Öffnen →
                      </a>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="dokumente">
          <DocumentsTab
            customerId={id}
            customerName={`${customer.first_name} ${customer.last_name}`}
            contracts={relatedContracts}
          />
        </TabsContent>

        <TabsContent value="kommunikation">
          {messages.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Keine Kommunikation vorhanden
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {messages.map(msg => (
                <Card key={msg.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-medium text-sm">{msg.sender_name}</p>
                      <p className="text-xs text-muted-foreground">{new Date(msg.created_date).toLocaleDateString('de-CH')}</p>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{msg.content}</p>
                    {msg.reference_title && (
                      <p className="text-xs bg-muted p-2 rounded">📎 Bezug: {msg.reference_title}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kunde bearbeiten</DialogTitle>
          </DialogHeader>
          <CustomerForm
            customer={customer}
            onSave={(data) => updateMutation.mutate({ id: customer.id, data })}
            onCancel={() => setShowEdit(false)}
            saving={updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}