import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Star, Globe, Mail, Phone, Edit, Building2 } from 'lucide-react';

const SPARTEN = [
  'Motorfahrzeug','Motorrad','Haushalt','Privathaftpflicht','Gebäude',
  'Rechtsschutz','Cyber','Reise','Krankenzusatz','Leben','Erwerbsunfähigkeit',
  'Taggeld','BVG','Betriebshaftpflicht','Sach','Transport','D&O','Berufshaftpflicht',
];

function VersichererForm({ versicherer, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: '', kurzname: '', kontaktperson: '', funktion: '', email: '',
    telefon: '', adresse: '', plz: '', ort: '', website: '',
    bearbeitungszeit_tage: '', bewertung: '', spezialisierungen: [],
    bevorzugter_kanal: 'email', notizen: '', aktiv: true,
    ...versicherer,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleSparte = (s) => set('spezialisierungen', form.spezialisierungen?.includes(s) ? form.spezialisierungen.filter(x => x !== s) : [...(form.spezialisierungen||[]), s]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({ ...form, bearbeitungszeit_tage: form.bearbeitungszeit_tage ? Number(form.bearbeitungszeit_tage) : null, bewertung: form.bewertung ? Number(form.bewertung) : null });
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Name *</Label><Input value={form.name} onChange={e => set('name', e.target.value)} required /></div>
        <div><Label>Kurzname</Label><Input value={form.kurzname} onChange={e => set('kurzname', e.target.value)} placeholder="z.B. Helsana" /></div>
        <div><Label>Kontaktperson</Label><Input value={form.kontaktperson} onChange={e => set('kontaktperson', e.target.value)} /></div>
        <div><Label>Funktion</Label><Input value={form.funktion} onChange={e => set('funktion', e.target.value)} placeholder="z.B. Broker Manager" /></div>
        <div><Label>E-Mail</Label><Input type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
        <div><Label>Telefon</Label><Input value={form.telefon} onChange={e => set('telefon', e.target.value)} /></div>
        <div><Label>Strasse / Adresse</Label><Input value={form.adresse} onChange={e => set('adresse', e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>PLZ</Label><Input value={form.plz} onChange={e => set('plz', e.target.value)} /></div>
          <div><Label>Ort</Label><Input value={form.ort} onChange={e => set('ort', e.target.value)} /></div>
        </div>
        <div><Label>Website</Label><Input value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://..." /></div>
        <div><Label>Bearbeitungszeit (Tage)</Label><Input type="number" value={form.bearbeitungszeit_tage} onChange={e => set('bearbeitungszeit_tage', e.target.value)} /></div>
        <div>
          <Label>Bevorzugter Kanal</Label>
          <Select value={form.bevorzugter_kanal} onValueChange={v => set('bevorzugter_kanal', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="email">E-Mail</SelectItem>
              <SelectItem value="portal">Portal</SelectItem>
              <SelectItem value="telefon">Telefon</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Bewertung (1-5)</Label>
          <Select value={String(form.bewertung || '')} onValueChange={v => set('bewertung', Number(v))}>
            <SelectTrigger><SelectValue placeholder="Bewertung..." /></SelectTrigger>
            <SelectContent>{[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n} Stern{n > 1 ? 'e' : ''}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Spezialisierungen</Label>
        <div className="flex flex-wrap gap-1.5">
          {SPARTEN.map(s => (
            <button key={s} type="button" onClick={() => toggleSparte(s)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${(form.spezialisierungen||[]).includes(s) ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:border-primary'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div><Label>Notizen</Label><Textarea value={form.notizen} onChange={e => set('notizen', e.target.value)} rows={2} /></div>

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Speichern...' : (versicherer?.id ? 'Aktualisieren' : 'Erstellen')}</Button>
      </div>
    </form>
  );
}

function StarRating({ value }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(n => (
        <Star key={n} className={`w-3 h-3 ${n <= (value||0) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
      ))}
    </div>
  );
}

export default function VersichererDBPage() {
  const [versicherer, setVersicherer] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const data = await base44.entities.VersichererDB.list('-created_date', 200);
    setVersicherer(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async (data) => {
    if (editing?.id) await base44.entities.VersichererDB.update(editing.id, data);
    else await base44.entities.VersichererDB.create(data);
    setShowForm(false);
    setEditing(null);
    load();
  };

  const filtered = versicherer.filter(v =>
    !search || (v.name + ' ' + (v.kurzname||'') + ' ' + (v.ort||'')).toLowerCase().includes(search.toLowerCase())
  );

  const aktive = versicherer.filter(v => v.aktiv !== false).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading">Versicherer-Datenbank</h1>
          <p className="text-body-sm text-muted-foreground">{aktive} aktive Versicherungsgesellschaften</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="gap-2"><Plus className="w-4 h-4" />Versicherer hinzufügen</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 surface">
          <Building2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground mb-3">Noch keine Versicherer erfasst.</p>
          <Button size="sm" onClick={() => setShowForm(true)}>Ersten Versicherer hinzufügen</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(v => (
            <div key={v.id} className="surface p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{v.name}</p>
                  {v.ort && <p className="text-xs text-muted-foreground">{v.plz} {v.ort}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {v.aktiv === false && <Badge className="badge-danger">Inaktiv</Badge>}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(v); setShowForm(true); }}><Edit className="w-3.5 h-3.5" /></Button>
                </div>
              </div>

              {v.bewertung && <StarRating value={v.bewertung} />}

              <div className="space-y-1">
                {v.kontaktperson && <p className="text-xs text-slate-600"><span className="text-muted-foreground">Kontakt:</span> {v.kontaktperson}{v.funktion ? ` · ${v.funktion}` : ''}</p>}
                {v.email && <a href={`mailto:${v.email}`} className="text-xs text-primary flex items-center gap-1 hover:underline"><Mail className="w-3 h-3" />{v.email}</a>}
                {v.telefon && <p className="text-xs text-slate-600 flex items-center gap-1"><Phone className="w-3 h-3 text-muted-foreground" />{v.telefon}</p>}
                {v.website && <a href={v.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline"><Globe className="w-3 h-3" />{v.website.replace('https://','')}</a>}
              </div>

              {v.bearbeitungszeit_tage && (
                <p className="text-xs text-muted-foreground">Bearbeitungszeit: <span className="font-medium text-slate-700">{v.bearbeitungszeit_tage} Tage</span></p>
              )}

              {(v.spezialisierungen||[]).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {v.spezialisierungen.slice(0,4).map(s => <Badge key={s} className="badge-info text-[10px] py-0">{s}</Badge>)}
                  {v.spezialisierungen.length > 4 && <Badge className="badge-neutral text-[10px] py-0">+{v.spezialisierungen.length-4}</Badge>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Versicherer bearbeiten' : 'Versicherer hinzufügen'}</DialogTitle></DialogHeader>
          <VersichererForm versicherer={editing} onSave={save} onCancel={() => { setShowForm(false); setEditing(null); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}