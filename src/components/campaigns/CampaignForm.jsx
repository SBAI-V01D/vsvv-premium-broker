import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';

const CANTONS = ['AG','AI','AR','BE','BL','BS','FR','GE','GL','GR','JU','LU','NE','NW','OW','SG','SH','SO','SZ','TG','TI','UR','VD','VS','ZG','ZH'];

const PLACEHOLDERS = [
  { key: '{{name}}', label: 'Voller Name' },
  { key: '{{vorname}}', label: 'Vorname' },
  { key: '{{nachname}}', label: 'Nachname' },
  { key: '{{email}}', label: 'E-Mail' },
];

export default function CampaignForm({ initial = {}, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState({
    name: '',
    subject: '',
    body: '',
    filter_status: 'alle',
    filter_canton: '',
    filter_customer_type: 'alle',
    scheduled_at: '',
    is_template: false,
    template_name: '',
    template_category: 'newsletter',
    ...initial,
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const insertPlaceholder = (key) => {
    set('body', form.body + key);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Basic Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Label>Kampagnenname *</Label>
          <Input className="mt-1" value={form.name} onChange={e => set('name', e.target.value)} placeholder="z.B. Herbst-Newsletter 2026" required />
        </div>
        <div className="sm:col-span-2">
          <Label>Betreff *</Label>
          <Input className="mt-1" value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="E-Mail-Betreff" required />
        </div>
      </div>

      {/* Body */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label>Nachricht *</Label>
          <div className="flex items-center gap-1 flex-wrap">
            {PLACEHOLDERS.map(p => (
              <button key={p.key} type="button" onClick={() => insertPlaceholder(p.key)}
                className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors">
                {p.key}
              </button>
            ))}
          </div>
        </div>
        <Textarea className="mt-1 min-h-[160px] font-mono text-sm" value={form.body}
          onChange={e => set('body', e.target.value)}
          placeholder="Sehr geehrte/r {{name}},&#10;&#10;wir möchten Sie informieren..." required />
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          <Info className="w-3 h-3" /> Platzhalter werden beim Versand durch Kundendaten ersetzt.
        </p>
      </div>

      {/* Empfänger-Filter */}
      <div>
        <Label className="mb-2 block text-sm font-semibold">Empfänger-Filter</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-border">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Kundenstatus</Label>
            <Select value={form.filter_status} onValueChange={v => set('filter_status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle</SelectItem>
                <SelectItem value="aktiv">Aktiv</SelectItem>
                <SelectItem value="inaktiv">Inaktiv</SelectItem>
                <SelectItem value="interessent">Interessent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Kundentyp</Label>
            <Select value={form.filter_customer_type} onValueChange={v => set('filter_customer_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle</SelectItem>
                <SelectItem value="privat">Privatkunden</SelectItem>
                <SelectItem value="geschaeft">Geschäftskunden</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Kanton (optional)</Label>
            <Select value={form.filter_canton || ''} onValueChange={v => set('filter_canton', v === 'alle' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Alle Kantone" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Kantone</SelectItem>
                {CANTONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Scheduling */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Geplanter Versandzeitpunkt (optional – leer lassen für sofortigen Versand)</Label>
        <Input type="datetime-local" value={form.scheduled_at || ''} onChange={e => set('scheduled_at', e.target.value)} className="w-full sm:w-72" />
      </div>

      {/* Template */}
      <div className="flex items-center gap-3 p-3 border border-border rounded-lg">
        <Switch checked={form.is_template} onCheckedChange={v => set('is_template', v)} id="is-template" />
        <Label htmlFor="is-template" className="cursor-pointer">Als Vorlage speichern</Label>
        {form.is_template && (
          <div className="flex gap-2 ml-2 flex-1">
            <Input value={form.template_name} onChange={e => set('template_name', e.target.value)} placeholder="Vorlagenname" className="flex-1 h-8 text-sm" />
            <Select value={form.template_category} onValueChange={v => set('template_category', v)}>
              <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newsletter">Newsletter</SelectItem>
                <SelectItem value="information">Information</SelectItem>
                <SelectItem value="aktion">Aktion</SelectItem>
                <SelectItem value="erinnerung">Erinnerung</SelectItem>
                <SelectItem value="sonstiges">Sonstiges</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Speichern…' : 'Kampagne speichern'}
        </Button>
      </div>
    </form>
  );
}