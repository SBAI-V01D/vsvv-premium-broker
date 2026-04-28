import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DialogFooter } from '@/components/ui/dialog';
import { FileUp } from 'lucide-react';
import ContractOCRUploader from './ContractOCRUploader';

const INSURANCE_TYPES = ['KVG', 'VVG', 'Leben', 'Haftpflicht', 'Hausrat', 'Rechtsschutz', 'Motorfahrzeug', 'Gebäude', 'Unfall', 'Krankentaggeld', 'BVG', 'Säule 3a', 'Sonstige'];
const PROVIDERS = ['CSS', 'Helsana', 'Swica', 'Visana', 'Concordia', 'Sanitas', 'Groupe Mutuel', 'Sympany', 'Zurich', 'AXA', 'Helvetia', 'Mobiliar', 'Allianz', 'Generali', 'Baloise', 'Swiss Life', 'Vaudoise', 'Andere'];

export default function ContractForm({ contract, customers, onSave, onCancel, saving }) {
  const [form, setForm] = useState(contract || {
    customer_id: '',
    family_member_id: '',
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
  const [showOCR, setShowOCR] = useState(false);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const selectedCustomer = customers.find(c => c.id === form.customer_id);
  const selectedFamilyMember = selectedCustomer?.family_members?.find(m => m.id === form.family_member_id);
  
  const handleOCRExtract = (extractedData) => {
    set('insurance_type', extractedData.insurance_type || form.insurance_type);
    set('provider', extractedData.provider || form.provider);
    set('policy_number', extractedData.policy_number || form.policy_number);
    set('premium_monthly', extractedData.premium_monthly || form.premium_monthly);
    set('premium_yearly', extractedData.premium_yearly || form.premium_yearly);
    set('start_date', extractedData.start_date || form.start_date);
    set('end_date', extractedData.end_date || form.end_date);
    set('cancellation_deadline', extractedData.cancellation_deadline || form.cancellation_deadline);
  };

  const handleCustomerChange = (id) => {
    const c = customers.find(c => c.id === id);
    set('customer_id', id);
    set('family_member_id', '');
    if (c) set('customer_name', `${c.first_name} ${c.last_name}`);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const monthly = form.premium_monthly ? Number(form.premium_monthly) : undefined;
    const yearly = form.premium_yearly ? Number(form.premium_yearly) : (monthly ? Math.round(monthly * 12 * 100) / 100 : undefined);
    onSave({ ...form, premium_monthly: monthly, premium_yearly: yearly });
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

      {selectedCustomer?.family_members && selectedCustomer.family_members.length > 0 && (
        <div>
          <Label>Familienmitglied (optional)</Label>
          <Select value={form.family_member_id} onValueChange={v => set('family_member_id', v)}>
            <SelectTrigger><SelectValue placeholder="Für Hauptkunde auswählen" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>Hauptkunde ({selectedCustomer.first_name} {selectedCustomer.last_name})</SelectItem>
              {selectedCustomer.family_members.map(m => (
                <SelectItem key={m.id} value={m.id}>
                  {m.first_name} {m.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {form.customer_id && (
        <Button 
          type="button" 
          variant="outline" 
          className="w-full"
          onClick={() => setShowOCR(true)}
        >
          <FileUp className="w-4 h-4 mr-2" />
          Daten aus PDF auslesen
        </Button>
      )}

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

      {showOCR && (
        <ContractOCRUploader 
          customerId={form.customer_id}
          onExtractedData={handleOCRExtract}
          onClose={() => setShowOCR(false)}
        />
      )}
    </form>
  );
}