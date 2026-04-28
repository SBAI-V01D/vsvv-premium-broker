import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Phone, Mail, MapPin, Calendar, FileText, MessageSquare, Edit } from 'lucide-react';
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
            <div className="text-sm text-muted-foreground">{customer.customer_type === 'geschaeft' ? 'Geschäftskunde' : 'Privatkunde'}</div>
            {customer.tags && <div className="flex flex-wrap gap-1 mt-1">{customer.tags.split(',').map((t, i) => <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t.trim()}</span>)}</div>}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="contracts">
        <TabsList>
          <TabsTrigger value="contracts"><FileText className="w-4 h-4 mr-1" /> Verträge ({contracts.length})</TabsTrigger>
          <TabsTrigger value="interactions"><MessageSquare className="w-4 h-4 mr-1" /> Verlauf ({interactions.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="contracts" className="mt-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Versicherungsverträge</h3>
            <Button size="sm" asChild><Link to={`/vertraege?customer=${customerId}`}><Plus className="w-4 h-4 mr-1" /> Vertrag</Link></Button>
          </div>
          {contracts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Keine Verträge vorhanden</p>
          ) : (
            <div className="space-y-2">
              {contracts.map(c => (
                <Card key={c.id} className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm">{c.insurance_type} – {c.provider}</p>
                      <p className="text-xs text-muted-foreground">Policen-Nr: {c.policy_number || '–'} | CHF {c.premium_monthly?.toLocaleString('de-CH') || '–'}/Mt.</p>
                    </div>
                    <StatusBadge status={c.status} />
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
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Kunde bearbeiten</DialogTitle></DialogHeader>
          <CustomerForm customer={customer} onSave={(data) => updateMutation.mutate({ id: customer.id, data })} onCancel={() => setShowEdit(false)} saving={updateMutation.isPending} />
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
    </div>
  );
}