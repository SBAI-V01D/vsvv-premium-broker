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
import { STATUS_LABELS, INSURANCE_TYPE_LABELS, FAMILY_ROLE_LABELS, label } from '@/lib/labels'

export default function CustomerDetail() {
  const { id } = useParams()
  const [showEdit, setShowEdit] = useState(false)
  const queryClient = useQueryClient()

  const { data: customer } = useQuery({
    queryKey: ['customers', id],
    queryFn: () => base44.entities.Customer.list().then(c => c.find(x => x.id === id)),
  })

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts', id],
    queryFn: () => base44.entities.Contract.filter({ customer_id: id }),
    enabled: !!id,
  })

  const { data: applications = [] } = useQuery({
    queryKey: ['applications', id],
    queryFn: () => base44.entities.Application.filter({ customer_id: id }),
    enabled: !!id,
  })

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', id],
    queryFn: () => base44.entities.Message.filter({ customer_id: id }),
    enabled: !!id,
  })

  const { data: allCustomers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  })

  const familyMembers = allCustomers.filter(c => 
    c.primary_customer_id === id || (c.is_family_member === false && c.id === id)
  )

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
            {customer.birthdate && <div className="text-sm"><span className="text-muted-foreground">Geburtsdatum:</span> {customer.birthdate}</div>}
            {customer.profession && <div className="text-sm"><span className="text-muted-foreground">Beruf:</span> {customer.profession}</div>}
            <div className="text-sm"><span className="text-muted-foreground">Status:</span> {label(STATUS_LABELS, customer.status)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="vertraege">
        <TabsList className="mb-4">
          <TabsTrigger value="vertraege">Verträge ({contracts.length})</TabsTrigger>
          <TabsTrigger value="antraege">Anträge ({applications.length})</TabsTrigger>
          <TabsTrigger value="familie">Familie ({familyMembers.length - 1})</TabsTrigger>
          <TabsTrigger value="kommunikation">Kommunikation ({messages.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="vertraege">
          {contracts.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Keine Verträge vorhanden
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {contracts.map(c => (
                <Card key={c.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{c.insurance_type} - {c.insurer}</p>
                        <p className="text-sm text-muted-foreground mt-1">Policen-Nr: {c.policy_number || '–'}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">CHF {c.premium_yearly?.toLocaleString('de-CH', { minimumFractionDigits: 0 }) || '–'}/J.</p>
                        <p className="text-sm text-muted-foreground">{label(STATUS_LABELS, c.status)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="antraege">
          {applications.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Keine Anträge vorhanden
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {applications.map(a => (
                <Card key={a.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{a.insurance_type} - {a.insurer}</p>
                        <p className="text-sm text-muted-foreground mt-1">{a.product || 'Produkt nicht spezifiziert'}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">CHF {a.estimated_premium_yearly?.toLocaleString('de-CH', { minimumFractionDigits: 0 }) || '–'}/J.</p>
                        <p className="text-sm text-muted-foreground">{label(STATUS_LABELS, a.status)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
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