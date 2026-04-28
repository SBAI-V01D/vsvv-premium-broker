import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DialogFooter } from '@/components/ui/dialog';
import FamilyMembersSection from './FamilyMembersSection';

const CANTONS = ["AG","AI","AR","BE","BL","BS","FR","GE","GL","GR","JU","LU","NE","NW","OW","SG","SH","SO","SZ","TG","TI","UR","VD","VS","ZG","ZH"];

export default function CustomerForm({ customer, onSave, onCancel, saving }) {
  const [form, setForm] = useState(customer || {
    customer_type: 'privat',
    salutation: 'Herr',
    first_name: '',
    last_name: '',
    company_name: '',
    email: '',
    phone: '',
    mobile: '',
    street: '',
    zip_code: '',
    city: '',
    canton: '',
    birthdate: '',
    ahv_number: '',
    employer: '',
    income: '',
    tags: '',
    status: 'aktiv',
    notes: '',
    family_members: customer?.family_members || [],
  });
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ 
      ...form, 
      income: form.income ? Number(form.income) : undefined,
      family_members: form.family_members
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Kundentyp</Label>
          <Select value={form.customer_type} onValueChange={v => set('customer_type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="privat">Privat</SelectItem>
              <SelectItem value="geschaeft">Geschäft</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Anrede</Label>
          <Select value={form.salutation} onValueChange={v => set('salutation', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Herr">Herr</SelectItem>
              <SelectItem value="Frau">Frau</SelectItem>
              <SelectItem value="Firma">Firma</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Vorname *</Label>
          <Input value={form.first_name} onChange={e => set('first_name', e.target.value)} required />
        </div>
        <div>
          <Label>Nachname *</Label>
          <Input value={form.last_name} onChange={e => set('last_name', e.target.value)} required />
        </div>
      </div>

      {form.customer_type === 'geschaeft' && (
        <div>
          <Label>Firmenname</Label>
          <Input value={form.company_name} onChange={e => set('company_name', e.target.value)} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>E-Mail *</Label>
          <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} required />
        </div>
        <div>
          <Label>Telefon</Label>
          <Input value={form.phone} onChange={e => set('phone', e.target.value)} />
        </div>
      </div>

      <div>
        <Label>Mobilnummer</Label>
        <Input value={form.mobile} onChange={e => set('mobile', e.target.value)} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <Label>Strasse</Label>
          <Input value={form.street} onChange={e => set('street', e.target.value)} />
        </div>
        <div>
          <Label>PLZ</Label>
          <Input value={form.zip_code} onChange={e => set('zip_code', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Ort</Label>
          <Input value={form.city} onChange={e => set('city', e.target.value)} />
        </div>
        <div>
          <Label>Kanton</Label>
          <Select value={form.canton} onValueChange={v => set('canton', v)}>
            <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
            <SelectContent>
              {CANTONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Geburtsdatum</Label>
          <Input type="date" value={form.birthdate} onChange={e => set('birthdate', e.target.value)} />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="aktiv">Aktiv</SelectItem>
              <SelectItem value="inaktiv">Inaktiv</SelectItem>
              <SelectItem value="interessent">Interessent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Tags (kommagetrennt)</Label>
        <Input value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="z.B. VIP, Familie, KMU" />
      </div>

      <div>
        <Label>Notizen</Label>
        <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} />
      </div>

      {form.customer_type === 'privat' && (
        <FamilyMembersSection 
          key="family-members"
          familyMembers={form.family_members} 
          onUpdate={(members) => set('family_members', members)} 
        />
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Speichern...' : (customer ? 'Aktualisieren' : 'Erstellen')}</Button>
      </DialogFooter>
    </form>
  );
}