import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DialogFooter } from '@/components/ui/dialog';

const INSURANCE_TYPES = ['KVG', 'VVG', 'Leben', 'Haftpflicht', 'Hausrat', 'Rechtsschutz', 'Motorfahrzeug', 'Gebäude', 'Unfall', 'Krankentaggeld', 'BVG', 'Säule 3a', 'Sonstige'];
const PROVIDERS = ['CSS', 'Helsana', 'Swica', 'Visana', 'Concordia', 'Sanitas', 'Groupe Mutuel', 'Sympany', 'Zurich', 'AXA', 'Helvetia', 'Mobiliar', 'Allianz', 'Generali', 'Baloise', 'Swiss Life', 'Vaudoise', 'Andere'];

export default function ContractForm({ contract, customers, onSave, onCancel, saving }) {
  const [form, setForm] = useState(contract || {
    customer_id: '',
    customer_name: '',
    insurance_type: '',
    provider: '',
    policy_number: '',
    premium_monthly: '',
    premium_yearly: '',
    start_date: '',
    end_date: '',
    cancellation_deadline: '',
    status: 'aktiv',
    notes: '',
  });

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleCustomerChange = (id) => {
    const c = customers.find(c => c.id === id);
    set('customer_id', id);
    if (c) set('customer_name', `${c.first_name} ${c.last_name}`);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      premium_monthly: form.premium_monthly ? Number(form.premium_monthly) : undefined,
      premium_yearly: form.premium_yearly ? Number(form.premium_yearly) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <div>
        <Label>Kunde *</Label>
        <Select value={form.customer_id} onValueChange={handleCustomerChange}>
          <SelectTrigger><SelectValue placeholder="Kunde wählen..." /></SelectTrigger>
          <SelectContent>
            {customers.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Versicherungsart *</Label>
          <Select value={form.insurance_type} onValueChange={v => set('insurance_type', v)}>
            <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
            <SelectContent>
              {INSURANCE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Versicherungsgesellschaft *</Label>
          <Select value={form.provider} onValueChange={v => set('provider', v)}>
            <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
            <SelectContent>
              {PROVIDERS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Policen-Nummer</Label>
        <Input value={form.policy_number} onChange={e => set('policy_number', e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Monatsprämie (CHF)</Label>
          <Input type="number" step="0.05" value={form.premium_monthly} onChange={e => set('premium_monthly', e.target.value)} />
        </div>
        <div>
          <Label>Jahresprämie (CHF)</Label>
          <Input type="number" step="0.05" value={form.premium_yearly} onChange={e => set('premium_yearly', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Vertragsbeginn</Label>
          <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
        </div>
        <div>
          <Label>Vertragsende</Label>
          <Input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
        </div>
        <div>
          <Label>Kündigungsfrist</Label>
          <Input type="date" value={form.cancellation_deadline} onChange={e => set('cancellation_deadline', e.target.value)} />
        </div>
      </div>

      <div>
        <Label>Status</Label>
        <Select value={form.status} onValueChange={v => set('status', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="aktiv">Aktiv</SelectItem>
            <SelectItem value="pendent">Pendent</SelectItem>
            <SelectItem value="gekündigt">Gekündigt</SelectItem>
            <SelectItem value="abgelaufen">Abgelaufen</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Bemerkungen</Label>
        <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Speichern...' : (contract ? 'Aktualisieren' : 'Erstellen')}</Button>
      </DialogFooter>
    </form>
  );
}