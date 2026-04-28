import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { AlertCircle, Plus, CheckCircle2, Clock, XCircle, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import PortalStatusBadge from '../../components/portal/PortalStatusBadge';
import PortalPageHeader from '../../components/portal/PortalPageHeader';

const STATUS_STEPS = ['eingereicht', 'in_pruefung', 'genehmigt', 'ausbezahlt'];

const statusInfo = {
  eingereicht:  { icon: Clock, color: 'text-slate-500', label: 'Eingereicht', bg: 'bg-slate-100' },
  in_pruefung:  { icon: Clock, color: 'text-amber-600', label: 'In Prüfung', bg: 'bg-amber-50' },
  genehmigt:    { icon: CheckCircle2, color: 'text-emerald-600', label: 'Genehmigt', bg: 'bg-emerald-50' },
  abgelehnt:    { icon: XCircle, color: 'text-red-500', label: 'Abgelehnt', bg: 'bg-red-50' },
  ausbezahlt:   { icon: CheckCircle2, color: 'text-primary', label: 'Ausbezahlt', bg: 'bg-primary/5' },
};

function ClaimTimeline({ status }) {
  const currentIdx = STATUS_STEPS.indexOf(status);
  if (status === 'abgelehnt') {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 font-medium">
        <XCircle className="w-4 h-4" /> Antrag wurde abgelehnt
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {STATUS_STEPS.map((step, i) => {
        const done = i <= currentIdx;
        return (
          <React.Fragment key={step}>
            <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${done ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'}`}>
              {done && <CheckCircle2 className="w-3 h-3" />}
              {statusInfo[step]?.label}
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <ChevronRight className={`w-3 h-3 flex-shrink-0 ${done && i < currentIdx ? 'text-primary' : 'text-slate-300'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function PortalClaims() {
  const { user } = useOutletContext();
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ['portal-claims', user?.id],
    queryFn: () => base44.entities.Claim.filter({ customer_id: user?.id }, '-created_date'),
    enabled: !!user?.id,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['portal-contracts', user?.id],
    queryFn: () => base44.entities.Contract.filter({ customer_id: user?.id }),
    enabled: !!user?.id,
  });

  const [form, setForm] = useState({
    title: '', description: '', incident_date: format(new Date(), 'yyyy-MM-dd'),
    contract_id: '', amount_claimed: '',
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Claim.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-claims', user?.id] });
      setShowForm(false);
      setForm({ title: '', description: '', incident_date: format(new Date(), 'yyyy-MM-dd'), contract_id: '', amount_claimed: '' });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const contract = contracts.find(c => c.id === form.contract_id);
    createMutation.mutate({
      ...form,
      customer_id: user.id,
      customer_name: user.full_name || user.email,
      customer_email: user.email,
      insurance_type: contract?.insurance_type || '',
      provider: contract?.provider || '',
      amount_claimed: form.amount_claimed ? Number(form.amount_claimed) : undefined,
      status: 'eingereicht',
    });
  };

  return (
    <div>
      <PortalPageHeader
        icon={<AlertCircle className="w-5 h-5 text-amber-500" />}
        title="Schadensmeldungen"
        subtitle="Status Ihrer Schadenanträge"
        action={
          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus className="w-4 h-4 mr-1.5" /> Schaden melden
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-32 bg-slate-200 animate-pulse rounded-xl" />)}</div>
      ) : claims.length === 0 ? (
        <Card className="p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-200 mx-auto mb-3" />
          <p className="font-medium text-foreground">Keine Schadensmeldungen</p>
          <p className="text-sm text-muted-foreground mt-1">Sie haben noch keine Schadensmeldungen eingereicht.</p>
          <Button onClick={() => setShowForm(true)} className="mt-4" variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-1.5" /> Schaden melden
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {claims.map(claim => {
            const info = statusInfo[claim.status] || statusInfo.eingereicht;
            const Icon = info.icon;
            return (
              <Card key={claim.id} className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg ${info.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-5 h-5 ${info.color}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{claim.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {claim.insurance_type && <>{claim.insurance_type} · </>}
                          Schadendatum: {claim.incident_date ? format(new Date(claim.incident_date), 'dd.MM.yyyy') : '–'}
                          {claim.claim_number && <> · Nr. {claim.claim_number}</>}
                        </p>
                      </div>
                    </div>
                    <PortalStatusBadge status={claim.status} />
                  </div>

                  {claim.description && (
                    <p className="text-sm text-slate-600 mb-4 bg-slate-50 rounded-lg p-3">{claim.description}</p>
                  )}

                  <ClaimTimeline status={claim.status} />

                  {claim.amount_claimed && (
                    <div className="mt-3 flex gap-6 text-sm">
                      <div>
                        <span className="text-muted-foreground">Gefordert: </span>
                        <span className="font-medium">CHF {claim.amount_claimed.toLocaleString('de-CH')}</span>
                      </div>
                      {claim.amount_approved && (
                        <div>
                          <span className="text-muted-foreground">Genehmigt: </span>
                          <span className="font-medium text-emerald-600">CHF {claim.amount_approved.toLocaleString('de-CH')}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {claim.broker_notes && (
                    <div className="mt-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 text-sm text-primary">
                      <span className="font-medium">Nachricht Ihres Brokers: </span>{claim.broker_notes}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Claim Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Neuen Schaden melden</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Betroffener Vertrag</Label>
              <Select value={form.contract_id} onValueChange={v => setForm(p => ({ ...p, contract_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Vertrag wählen..." /></SelectTrigger>
                <SelectContent>
                  {contracts.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.insurance_type} – {c.provider} {c.policy_number ? `(${c.policy_number})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Schadenstitel *</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="z.B. Wasserschaden Wohnung" required />
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Was ist passiert?" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Schadendatum *</Label>
                <Input type="date" value={form.incident_date} onChange={e => setForm(p => ({ ...p, incident_date: e.target.value }))} required />
              </div>
              <div>
                <Label>Geschätzter Betrag (CHF)</Label>
                <Input type="number" step="0.01" value={form.amount_claimed} onChange={e => setForm(p => ({ ...p, amount_claimed: e.target.value }))} placeholder="0.00" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Abbrechen</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Wird gesendet...' : 'Meldung einreichen'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}