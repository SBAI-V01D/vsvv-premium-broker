import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STAGES = [
  { value: 'erstkontakt', label: 'Erstkontakt' },
  { value: 'bedarfsanalyse', label: 'Bedarfsanalyse' },
  { value: 'angebot_versendet', label: 'Angebot versendet' },
  { value: 'verhandlung', label: 'Verhandlung' },
  { value: 'abschluss', label: 'Abschluss' },
  { value: 'verloren', label: 'Verloren' },
];

const INSURANCE_TYPES = ['KVG', 'VVG', 'Leben', 'Haftpflicht', 'Hausrat', 'Rechtsschutz', 'Motorfahrzeug', 'Gebäude', 'Unfall', 'Krankentaggeld', 'BVG', 'Säule 3a', 'Sonstige'];
const SOURCES = [
  { value: 'empfehlung', label: 'Empfehlung' },
  { value: 'website', label: 'Website' },
  { value: 'kaltakquise', label: 'Kaltakquise' },
  { value: 'event', label: 'Event' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'sonstiges', label: 'Sonstiges' },
];

const empty = {
  title: '', customer_name: '', customer_email: '', customer_phone: '',
  stage: 'erstkontakt', insurance_type: '', estimated_premium: '',
  probability: '', assigned_broker: '', next_action: '', next_action_date: '',
  notes: '', source: 'sonstiges',
};

export default function DealForm({ deal, onSave, onCancel, saving }) {
  const [form, setForm] = useState(deal ? { ...deal, estimated_premium: deal.estimated_premium ?? '', probability: deal.probability ?? '' } : empty);

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      estimated_premium: form.estimated_premium !== '' ? Number(form.estimated_premium) : null,
      probability: form.probability !== '' ? Number(form.probability) : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Label>Titel *</Label>
          <Input value={form.title} onChange={e => set('title', e.target.value)} required placeholder="z.B. KVG-Offerte Muster AG" />
        </div>
        <div>
          <Label>Interessent / Kunde *</Label>
          <Input value={form.customer_name} onChange={e => set('customer_name', e.target.value)} required placeholder="Name" />
        </div>
        <div>
          <Label>E-Mail</Label>
          <Input type="email" value={form.customer_email} onChange={e => set('customer_email', e.target.value)} placeholder="email@beispiel.ch" />
        </div>
        <div>
          <Label>Telefon</Label>
          <Input value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} placeholder="+41 79 000 00 00" />
        </div>
        <div>
          <Label>Phase</Label>
          <Select value={form.stage} onValueChange={v => set('stage', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Versicherungsart</Label>
          <Select value={form.insurance_type || ''} onValueChange={v => set('insurance_type', v)}>
            <SelectTrigger><SelectValue placeholder="Auswählen…" /></SelectTrigger>
            <SelectContent>{INSURANCE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Geschätzte Jahresprämie (CHF)</Label>
          <Input type="number" value={form.estimated_premium} onChange={e => set('estimated_premium', e.target.value)} placeholder="0" min={0} />
        </div>
        <div>
          <Label>Abschlusswahrscheinlichkeit (%)</Label>
          <Input type="number" value={form.probability} onChange={e => set('probability', e.target.value)} placeholder="0–100" min={0} max={100} />
        </div>
        <div>
          <Label>Nächste Aktion</Label>
          <Input value={form.next_action} onChange={e => set('next_action', e.target.value)} placeholder="z.B. Offerte senden" />
        </div>
        <div>
          <Label>Datum nächste Aktion</Label>
          <Input type="date" value={form.next_action_date} onChange={e => set('next_action_date', e.target.value)} />
        </div>
        <div>
          <Label>Quelle</Label>
          <Select value={form.source} onValueChange={v => set('source', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Zuständiger Broker (E-Mail)</Label>
          <Input type="email" value={form.assigned_broker} onChange={e => set('assigned_broker', e.target.value)} placeholder="broker@firma.ch" />
        </div>
        <div className="sm:col-span-2">
          <Label>Notizen</Label>
          <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Weitere Informationen…" />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Speichern…' : deal ? 'Aktualisieren' : 'Deal erstellen'}</Button>
      </div>
    </form>
  );
}