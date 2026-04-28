import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Phone, Mail, MapPin, Calendar, FileText, MessageSquare, Edit, Folder, Activity, ClipboardList, Send, Lock, Users } from 'lucide-react';
import DocumentsTab from '../components/documents/DocumentsTab';
import CustomerFormulare from '../components/customers/CustomerFormulare';
import EmailTemplateSender from '../components/email/EmailTemplateSender';
import ContractDetailCard from '../components/contracts/ContractDetailCard';
import ActivityFeed from '../components/customers/ActivityFeed';
import ContractSummary from '../components/customers/ContractSummary';
import ApplicationSummary from '../components/customers/ApplicationSummary';
import PortalAccessDialog from '../components/customers/PortalAccessDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import StatusBadge from '../components/shared/StatusBadge';
import CustomerForm from '../components/customers/CustomerForm';

export default function CustomerDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const customerId = window.location.pathname.split('/').pop();
  const queryClient = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [showInteraction, setShowInteraction] = useState(false);
  const [showEmailSender, setShowEmailSender] = useState(false);
  const [showPortalAccess, setShowPortalAccess] = useState(false);
  const [interactionForm, setInteractionForm] = useState({ type: 'notiz', subject: '', content: '', date: format(new Date(), 'yyyy-MM-dd') });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });
  const customer = customers.find(c => c.id === customerId);

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts', customerId],
    queryFn: () => base44.entities.Contract.filter({ customer_id: customerId }),
    enabled: !!customerId,
  });

  const { data: interactions = [] } = useQuery({
    queryKey: ['interactions', customerId],
    queryFn: () => base44.entities.Interaction.filter({ customer_id: customerId }, '-created_date'),
    enabled: !!customerId,
  });

  const { data: claims = [] } = useQuery({
    queryKey: ['claims', customerId],
    queryFn: () => base44.entities.Claim.filter({ customer_id: customerId }),
    enabled: !!customerId,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', customerId],
    queryFn: () => base44.entities.Task.filter({ customer_id: customerId }),
    enabled: !!customerId,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', customerId],
    queryFn: () => base44.entities.Message.filter({ customer_id: customerId }, '-created_date'),
    enabled: !!customerId,
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['deals', customerId],
    queryFn: () => base44.entities.Deal.filter({ customer_email: customer?.email }),
    enabled: !!customer?.email,
  });

  const { data: applications = [] } = useQuery({
    queryKey: ['applications', customerId],
    queryFn: () => base44.entities.Application.filter({ customer_id: customerId }),
    enabled: !!customerId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Customer.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); setShowEdit(false); },
  });

  const createInteraction = useMutation({
    mutationFn: (data) => base44.entities.Interaction.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['interactions', customerId] }); setShowInteraction(false); setInteractionForm({ type: 'notiz', subject: '', content: '', date: format(new Date(), 'yyyy-MM-dd') }); },
  });

  if (!customer) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Kunde wird geladen...</p>
      </div>
    );
  }

  const displayName = `${customer.first_name} ${customer.last_name}`;

  return (
    <div>
      <Link to="/kunden" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Zurück
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
              {customer.first_name?.[0]}{customer.last_name?.[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{displayName}</h1>
              {customer.company_name && <p className="text-sm text-muted-foreground">{customer.company_name}</p>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <StatusBadge status={customer.status} />
          <Button variant="outline" size="sm" onClick={() => setShowPortalAccess(true)}>
            <Lock className="w-4 h-4 mr-1" /> Portal
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowEmailSender(true)}>
            <Send className="w-4 h-4 mr-1" /> E-Mail
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
            <Edit className="w-4 h-4 mr-1" /> Bearbeiten
          </Button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-muted-foreground" /> {customer.email}</div>
            {customer.phone && <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-muted-foreground" /> {customer.phone}</div>}
            {customer.mobile && <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-muted-foreground" /> {customer.mobile}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            {customer.street && <div className="flex items-center gap-2 text-sm"><MapPin className="w-4 h-4 text-muted-foreground" /> {customer.street}, {customer.zip_code} {customer.city}</div>}
            {customer.canton && <div className="text-sm text-muted-foreground ml-6">Kanton {customer.canton}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            {customer.birthdate && <div className="flex items-center gap-2 text-sm"><Calendar className="w-4 h-4 text-muted-foreground" /> {format(new Date(customer.birthdate), 'dd.MM.yyyy')}</div>}
            {customer.ahv_number && <div className="text-sm text-muted-foreground">AHV: {customer.ahv_number}</div>}
            <div className="text-sm text-muted-foreground">{customer.customer_type === 'geschaeft' ? 'Geschäftskunde' : 'Privatkunde'}</div>
            {customer.tags && <div className="flex flex-wrap gap-1 mt-1">{customer.tags.split(',').map((t, i) => <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t.trim()}</span>)}</div>}
          </CardContent>
        </Card>
      </div>

      {/* Contract Summary */}
      <ContractSummary contracts={contracts} />

      {/* Application Summary */}
      <ApplicationSummary applications={applications} />

      {/* Family Members */}
      {customer.customer_type === 'privat' && customer.family_members && customer.family_members.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <h3 className="text-base font-semibold">Familienmitglieder</h3>
          </CardHeader>
          <CardContent className="space-y-2">
            {customer.family_members.map(member => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg border border-border">
                <div>
                  <p className="font-medium text-sm">{member.first_name} {member.last_name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">
                      {member.relationship}
                    </span>
                    {member.birthdate && <span>{format(new Date(member.birthdate), 'dd.MM.yyyy')}</span>}
                    {member.email && <span>{member.email}</span>}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="activity">
        <TabsList className="mb-2">
          <TabsTrigger value="activity"><Activity className="w-3.5 h-3.5 mr-1" />Aktivitäten</TabsTrigger>
          <TabsTrigger value="contracts">Verträge ({contracts.length})</TabsTrigger>
          <TabsTrigger value="applications">Anträge ({applications.length})</TabsTrigger>
          <TabsTrigger value="interactions">Interaktionen ({interactions.length})</TabsTrigger>
          <TabsTrigger value="documents">Dokumente</TabsTrigger>
          <TabsTrigger value="formulare"><ClipboardList className="w-3.5 h-3.5 mr-1" />Formulare</TabsTrigger>
        </TabsList>
        <TabsContent value="activity" className="mt-4">
          <ActivityFeed
            interactions={interactions}
            tasks={tasks}
            deals={deals}
            messages={messages}
            claims={claims}
          />
        </TabsContent>
        <TabsContent value="contracts" className="mt-4">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground">Versicherungsverträge</h3>
              {contracts.filter(c => {
                const days = c.end_date ? Math.ceil((new Date(c.end_date) - new Date()) / (1000 * 60 * 60 * 24)) : null;
                return days !== null && days >= 0 && days <= 90;
              }).length > 0 && (
                <p className="text-xs text-orange-600 mt-0.5">
                  ⚠️ {contracts.filter(c => { const d = c.end_date ? Math.ceil((new Date(c.end_date) - new Date()) / 86400000) : null; return d !== null && d >= 0 && d <= 90; }).length} Police(n) laufen in &lt;3 Monaten ab
                </p>
              )}
            </div>
            <Button size="sm" asChild><Link to={`/vertraege?customer=${customerId}`}><Plus className="w-4 h-4 mr-1" /> Vertrag</Link></Button>
          </div>
          {contracts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Keine Verträge vorhanden</p>
          ) : (
            <div className="space-y-2">
              {contracts.map(c => <ContractDetailCard key={c.id} contract={c} customerId={customerId} customerName={displayName} familyMembers={customer.family_members || []} />)}
            </div>
          )}
        </TabsContent>
        <TabsContent value="applications" className="mt-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Versicherungsanträge</h3>
            <Button size="sm" asChild><Link to={`/antraege?customer=${customerId}`}><Plus className="w-4 h-4 mr-1" /> Antrag</Link></Button>
          </div>
          {applications.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Keine Anträge vorhanden</p>
          ) : (
            <div className="space-y-2">
              {applications.map(app => (
                <Card key={app.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{app.insurance_type} - {app.provider}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Gew. Startdatum: {app.requested_start_date ? format(new Date(app.requested_start_date), 'dd.MM.yyyy') : '–'}
                      </p>
                      {app.notes && <p className="text-xs text-muted-foreground mt-1">{app.notes}</p>}
                    </div>
                    <div className="text-right">
                      <StatusBadge status={app.status} />
                      {app.estimated_premium_yearly && (
                        <p className="text-xs text-muted-foreground mt-1">CHF {app.estimated_premium_yearly.toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/J.</p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="interactions" className="mt-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Interaktionen</h3>
            <Button size="sm" onClick={() => setShowInteraction(true)}><Plus className="w-4 h-4 mr-1" /> Eintrag</Button>
          </div>
          {interactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Keine Einträge vorhanden</p>
          ) : (
            <div className="space-y-2">
              {interactions.map(i => (
                <Card key={i.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{i.subject}</p>
                      <p className="text-xs text-muted-foreground mt-1">{i.content}</p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={i.type} />
                      {i.date && <p className="text-xs text-muted-foreground mt-1">{format(new Date(i.date), 'dd.MM.yyyy')}</p>}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <DocumentsTab
            customerId={customerId}
            customerName={displayName}
            contracts={contracts}
            claims={claims}
          />
        </TabsContent>

        <TabsContent value="formulare" className="mt-4">
          <CustomerFormulare customerId={customerId} customerName={displayName} />
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Kunde bearbeiten</DialogTitle></DialogHeader>
          <CustomerForm customer={customer} onSave={(data) => updateMutation.mutate({ id: customer.id, data })} onCancel={() => setShowEdit(false)} saving={updateMutation.isPending} />
        </DialogContent>
      </Dialog>

      {/* Email Sender Dialog */}
      <Dialog open={showEmailSender} onOpenChange={setShowEmailSender}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>E-Mail an {customer.first_name} versenden</DialogTitle></DialogHeader>
          <EmailTemplateSender 
            customerId={customer.id}
            customer={customer}
            contracts={contracts}
            onClose={() => setShowEmailSender(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Interaction Dialog */}
      <Dialog open={showInteraction} onOpenChange={setShowInteraction}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neuer Eintrag</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createInteraction.mutate({ ...interactionForm, customer_id: customerId, customer_name: displayName }); }} className="space-y-4">
            <div>
              <Label>Typ</Label>
              <Select value={interactionForm.type} onValueChange={v => setInteractionForm(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="anruf">Anruf</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="email">E-Mail</SelectItem>
                  <SelectItem value="notiz">Notiz</SelectItem>
                  <SelectItem value="dokument">Dokument</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Betreff</Label>
              <Input value={interactionForm.subject} onChange={e => setInteractionForm(p => ({ ...p, subject: e.target.value }))} required />
            </div>
            <div>
              <Label>Inhalt</Label>
              <Textarea value={interactionForm.content} onChange={e => setInteractionForm(p => ({ ...p, content: e.target.value }))} rows={3} />
            </div>
            <div>
              <Label>Datum</Label>
              <Input type="date" value={interactionForm.date} onChange={e => setInteractionForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowInteraction(false)}>Abbrechen</Button>
              <Button type="submit" disabled={createInteraction.isPending}>Speichern</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Portal Access Dialog */}
      <PortalAccessDialog open={showPortalAccess} onOpenChange={setShowPortalAccess} customer={customer} />
    </div>
  );
}