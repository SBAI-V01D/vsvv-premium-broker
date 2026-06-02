import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function OfferteForm({ ausschreibung, offerte, onSave, onCancel }) {
  const [form, setForm] = useState({
    versicherer_name: '', offert_nummer: '', praemie_jaehrlich: '',
    praemie_monatlich: '', selbstbehalt: '', deckung_beschreibung: '',
    laufzeit: '1 Jahr', kuendigungsfrist: '3 Monate', besondere_bedingungen: '',
    gueltig_bis: '', status: 'erhalten', notizen: '',
    zusatzleistungen: [], ausschluesse: [],
    ...offerte,
  });
  const [zusatzInput, setZusatzInput] = useState('');
  const [ausschlussInput, setAusschlussInput] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addItem = (field, input, setInput) => {
    if (!input.trim()) return;
    set(field, [...(form[field] || []), input.trim()]);
    setInput('');
  };

  const removeItem = (field, idx) => set(field, form[field].filter((_, i) => i !== idx));

  const handleJaehrlich = (v) => {
    set('praemie_jaehrlich', v);
    if (v) set('praemie_monatlich', (Number(v) / 12).toFixed(2));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = {
      ...form,
      ausschreibung_id: ausschreibung.id,
      ausschreibung_titel: ausschreibung.titel,
      customer_id: ausschreibung.customer_id,
      organization_id: ausschreibung.organization_id,
      praemie_jaehrlich: form.praemie_jaehrlich ? Number(form.praemie_jaehrlich) : null,
      praemie_monatlich: form.praemie_monatlich ? Number(form.praemie_monatlich) : null,
      erfassungsdatum: new Date().toISOString().split('T')[0],
    };
    await onSave(data);
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Versicherer *</Label>
          <Input value={form.versicherer_name} onChange={e => set('versicherer_name', e.target.value)} required placeholder="Name der Versicherungsgesellschaft" />
        </div>
        <div>
          <Label>Offertnummer</Label>
          <Input value={form.offert_nummer} onChange={e => set('offert_nummer', e.target.value)} placeholder="z.B. OFF-2026-001" />
        </div>
        <div>
          <Label>Jahresprämie (CHF) *</Label>
          <Input type="number" value={form.praemie_jaehrlich} onChange={e => handleJaehrlich(e.target.value)} required placeholder="z.B. 2400" />
        </div>
        <div>
          <Label>Monatsprämie (CHF)</Label>
          <Input type="number" value={form.praemie_monatlich} onChange={e => set('praemie_monatlich', e.target.value)} placeholder="Auto-berechnet" />
        </div>
        <div>
          <Label>Selbstbehalt</Label>
          <Input value={form.selbstbehalt} onChange={e => set('selbstbehalt', e.target.value)} placeholder="z.B. CHF 500 / 10% min. 200" />
        </div>
        <div>
          <Label>Laufzeit</Label>
          <Input value={form.laufzeit} onChange={e => set('laufzeit', e.target.value)} placeholder="z.B. 1 Jahr" />
        </div>
        <div>
          <Label>Kündigungsfrist</Label>
          <Input value={form.kuendigungsfrist} onChange={e => set('kuendigungsfrist', e.target.value)} placeholder="z.B. 3 Monate" />
        </div>
        <div>
          <Label>Gültig bis</Label>
          <Input type="date" value={form.gueltig_bis} onChange={e => set('gueltig_bis', e.target.value)} />
        </div>
      </div>

      <div>
        <Label>Deckungsbeschreibung</Label>
        <Textarea value={form.deckung_beschreibung} onChange={e => set('deckung_beschreibung', e.target.value)} rows={3} placeholder="Beschreiben Sie die Deckung..." />
      </div>

      <div>
        <Label>Zusatzleistungen</Label>
        <div className="flex gap-2 mb-2">
          <Input value={zusatzInput} onChange={e => setZusatzInput(e.target.value)} placeholder="Zusatzleistung hinzufügen..." onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addItem('zusatzleistungen', zusatzInput, setZusatzInput))} />
          <Button type="button" size="sm" variant="outline" onClick={() => addItem('zusatzleistungen', zusatzInput, setZusatzInput)}><Plus className="w-4 h-4" /></Button>
        </div>
        <div className="flex flex-wrap gap-1">{form.zusatzleistungen?.map((z, i) => <Badge key={i} className="badge-success gap-1">{z}<X className="w-3 h-3 cursor-pointer" onClick={() => removeItem('zusatzleistungen', i)} /></Badge>)}</div>
      </div>

      <div>
        <Label>Ausschlüsse</Label>
        <div className="flex gap-2 mb-2">
          <Input value={ausschlussInput} onChange={e => setAusschlussInput(e.target.value)} placeholder="Ausschluss hinzufügen..." onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addItem('ausschluesse', ausschlussInput, setAusschlussInput))} />
          <Button type="button" size="sm" variant="outline" onClick={() => addItem('ausschluesse', ausschlussInput, setAusschlussInput)}><Plus className="w-4 h-4" /></Button>
        </div>
        <div className="flex flex-wrap gap-1">{form.ausschluesse?.map((z, i) => <Badge key={i} className="badge-danger gap-1">{z}<X className="w-3 h-3 cursor-pointer" onClick={() => removeItem('ausschluesse', i)} /></Badge>)}</div>
      </div>

      <div>
        <Label>Besondere Bedingungen</Label>
        <Textarea value={form.besondere_bedingungen} onChange={e => set('besondere_bedingungen', e.target.value)} rows={2} />
      </div>

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Speichern...' : 'Offerte speichern'}</Button>
      </div>
    </form>
  );
}