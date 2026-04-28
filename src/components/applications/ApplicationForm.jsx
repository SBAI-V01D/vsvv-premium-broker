import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

const INSURANCE_TYPES = [
  'KVG', 'VVG', 'Leben', 'Haftpflicht', 'Hausrat', 'Rechtsschutz',
  'Motorfahrzeug', 'Gebäude', 'Unfall', 'Krankentaggeld', 'BVG', 'Säule 3a', 'Sonstige'
];

export default function ApplicationForm({ application, customers = [], onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    customer_id: application?.customer_id || '',
    insurance_type: application?.insurance_type || '',
    provider: application?.provider || '',
    estimated_premium_monthly: application?.estimated_premium_monthly || '',
    estimated_premium_yearly: application?.estimated_premium_yearly || '',
    requested_start_date: application?.requested_start_date || format(new Date(), 'yyyy-MM-dd'),
    status: application?.status || 'neu',
    notes: application?.notes || '',
  });

  const selectedCustomer = customers.find(c => c.id === form.customer_id);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      customer_name: selectedCustomer?.first_name + ' ' + selectedCustomer?.last_name,
      customer_email: selectedCustomer?.email,
      estimated_premium_monthly: form.estimated_premium_monthly ? parseFloat(form.estimated_premium_monthly) : null,
      estimated_premium_yearly: form.estimated_premium_yearly ? parseFloat(form.estimated_premium_yearly) : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Kunde *</Label>
        <Select value={form.customer_id} onValueChange={(v) => setForm(p => ({ ...p, customer_id: v }))}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Kunde auswählen" /></SelectTrigger>
          <SelectContent>
            {customers.map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.first_name} {c.last_name} ({c.email})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Versicherungsart *</Label>
          <Select value={form.insurance_type} onValueChange={(v) => setForm(p => ({ ...p, insurance_type: v }))}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {INSURANCE_TYPES.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Versicherungsgesellschaft *</Label>
          <Input
            value={form.provider}
            onChange={(e) => setForm(p => ({ ...p, provider: e.target.value }))}
            placeholder="z.B. Allianz"
            className="mt-1"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Monatsprämie (CHF)</Label>
          <Input
            type="number"
            step="0.01"
            value={form.estimated_premium_monthly}
            onChange={(e) => setForm(p => ({ ...p, estimated_premium_monthly: e.target.value }))}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Jahresprämie (CHF)</Label>
          <Input
            type="number"
            step="0.01"
            value={form.estimated_premium_yearly}
            onChange={(e) => setForm(p => ({ ...p, estimated_premium_yearly: e.target.value }))}
            className="mt-1"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Gewünschtes Startdatum</Label>
          <Input
            type="date"
            value={form.requested_start_date}
            onChange={(e) => setForm(p => ({ ...p, requested_start_date: e.target.value }))}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm(p => ({ ...p, status: v }))}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="neu">Neu</SelectItem>
              <SelectItem value="in_bearbeitung">In Bearbeitung</SelectItem>
              <SelectItem value="abgelehnt">Abgelehnt</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Anmerkungen</Label>
        <Textarea
          value={form.notes}
          onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
          rows={2}
          className="mt-1"
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={saving || !form.customer_id || !form.insurance_type || !form.provider}>
          {saving ? 'Speichern...' : 'Speichern'}
        </Button>
      </div>
    </form>
  );
}