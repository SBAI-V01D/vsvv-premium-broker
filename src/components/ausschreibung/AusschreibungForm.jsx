import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';

const SPARTEN = [
  'Motorfahrzeug','Motorrad','Oldtimer','Flotte','Haushalt','Privathaftpflicht',
  'Gebäude','Rechtsschutz','Cyber','Reise','Krankenzusatz','Leben',
  'Erwerbsunfähigkeit','Taggeld','BVG','Betriebshaftpflicht','Sach',
  'Transport','Technik','D&O','Berufshaftpflicht','Spezialrisiken',
];

const STATUS_OPTIONS = [
  { value: 'entwurf', label: 'Entwurf' },
  { value: 'vorbereitung', label: 'In Vorbereitung' },
  { value: 'versendet', label: 'Versendet' },
  { value: 'offerten_ausstehend', label: 'Offerten ausstehend' },
];

export default function AusschreibungForm({ ausschreibung, onSave, onCancel }) {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({
    titel: '', customer_id: '', customer_name: '', ansprechpartner: '',
    versicherungsbereich: 'privat', sparten: [], status: 'entwurf',
    prioritaet: 'mittel', fristdatum: '', bemerkungen: '', laufende_praemie: '',
    ...ausschreibung,
  });
  const [spartInput, setSpartInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.entities.Customer.list().then(setCustomers).catch(() => {});
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleSparte = (s) => {
    set('sparten', form.sparten.includes(s) ? form.sparten.filter(x => x !== s) : [...form.sparten, s]);
  };

  const handleCustomer = (id) => {
    const c = customers.find(x => x.id === id);
    if (c) { set('customer_id', id); set('customer_name', c.first_name + ' ' + c.last_name); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = { ...form, laufende_praemie: form.laufende_praemie ? Number(form.laufende_praemie) : null };
    if (!data.ausschreibung_nummer) {
      data.ausschreibung_nummer = 'AUS-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-4);
    }
    await onSave(data);
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Titel *</Label>
          <Input value={form.titel} onChange={e => set('titel', e.target.value)} required placeholder="z.B. Motorfahrzeugversicherung Privathaushalt 2026" />
        </div>
        <div>
          <Label>Kunde *</Label>
          <Select value={form.customer_id} onValueChange={handleCustomer}>
            <SelectTrigger><SelectValue placeholder="Kunde wählen..." /></SelectTrigger>
            <SelectContent>
              {customers.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Ansprechpartner</Label>
          <Input value={form.ansprechpartner} onChange={e => set('ansprechpartner', e.target.value)} placeholder="Name Ansprechpartner" />
        </div>
        <div>
          <Label>Versicherungsbereich</Label>
          <Select value={form.versicherungsbereich} onValueChange={v => set('versicherungsbereich', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="privat">Privat</SelectItem>
              <SelectItem value="gewerbe">Gewerbe</SelectItem>
              <SelectItem value="industrie">Industrie</SelectItem>
              <SelectItem value="landwirtschaft">Landwirtschaft</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Priorität</Label>
          <Select value={form.prioritaet} onValueChange={v => set('prioritaet', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="niedrig">Niedrig</SelectItem>
              <SelectItem value="mittel">Mittel</SelectItem>
              <SelectItem value="hoch">Hoch</SelectItem>
              <SelectItem value="dringend">Dringend</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Fristdatum</Label>
          <Input type="date" value={form.fristdatum} onChange={e => set('fristdatum', e.target.value)} />
        </div>
        <div>
          <Label>Laufende Jahresprämie (CHF)</Label>
          <Input type="number" value={form.laufende_praemie} onChange={e => set('laufende_praemie', e.target.value)} placeholder="z.B. 2400" />
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Sparten</Label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {SPARTEN.map(s => (
            <button key={s} type="button" onClick={() => toggleSparte(s)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${form.sparten.includes(s) ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:border-primary hover:text-primary'}`}>
              {s}
            </button>
          ))}
        </div>
        {form.sparten.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {form.sparten.map(s => (
              <Badge key={s} variant="secondary" className="gap-1">
                {s} <X className="w-3 h-3 cursor-pointer" onClick={() => toggleSparte(s)} />
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div>
        <Label>Bemerkungen</Label>
        <Textarea value={form.bemerkungen} onChange={e => set('bemerkungen', e.target.value)} rows={3} placeholder="Interne Notizen zur Ausschreibung..." />
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Speichern...' : (ausschreibung?.id ? 'Aktualisieren' : 'Erstellen')}</Button>
      </div>
    </form>
  );
}