import React, { useState, useEffect, useRef, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Search, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';

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
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const customerRef = useRef(null);

  // Advisor des eingeloggten Users automatisch vorausfüllen
  const { data: advisors = [] } = useQuery({
    queryKey: ['advisors-all'],
    queryFn: () => base44.entities.Advisor.list(),
    staleTime: 60_000,
  });
  const defaultBrokerName = React.useMemo(() => {
    if (!user || !advisors.length) return user?.full_name || '';
    const match = advisors.find(a => a.email === user.email);
    return match ? `${match.firstname} ${match.lastname}` : (user?.full_name || '');
  }, [user, advisors]);

  const [form, setForm] = useState({
    titel: '', customer_id: '', customer_name: '', ansprechpartner: '',
    versicherungsbereich: 'privat', sparten: [], status: 'entwurf',
    prioritaet: 'mittel', fristdatum: '', bemerkungen: '', laufende_praemie: '',
    broker_name: '',
    ...ausschreibung,
  });
  const [spartInput, setSpartInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.entities.Customer.list().then(setCustomers).catch(() => {});
  }, []);

  // Standardberater setzen (nur für neue Ausschreibungen)
  useEffect(() => {
    if (!ausschreibung?.id && defaultBrokerName && !form.broker_name) {
      setForm(f => ({ ...f, broker_name: defaultBrokerName }));
    }
  }, [defaultBrokerName]);

  useEffect(() => {
    const handleClick = (e) => {
      if (customerRef.current && !customerRef.current.contains(e.target)) {
        setCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredCustomers = customers.filter(c => {
    const name = `${c.first_name} ${c.last_name}`.toLowerCase();
    const company = (c.company_name || '').toLowerCase();
    const q = customerSearch.toLowerCase();
    return name.includes(q) || company.includes(q);
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleSparte = (s) => {
    set('sparten', form.sparten.includes(s) ? form.sparten.filter(x => x !== s) : [...form.sparten, s]);
  };

  const handleCustomer = (id) => {
    const c = customers.find(x => x.id === id);
    if (c) {
      setForm(f => ({
        ...f,
        customer_id: id,
        customer_name: c.company_name || `${c.first_name} ${c.last_name}`.trim(),
        organization_id: c.organization_id || f.organization_id || '',
      }));
    }
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
        <div ref={customerRef} className="relative">
          <Label>Kunde *</Label>
          <button
            type="button"
            onClick={() => { setCustomerDropdownOpen(o => !o); setCustomerSearch(''); }}
            className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm text-left"
          >
            <span className={form.customer_name ? 'text-foreground' : 'text-muted-foreground'}>
              {form.customer_name || 'Kunde wählen...'}
            </span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
          {customerDropdownOpen && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg">
              <div className="p-2 border-b border-slate-100">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    autoFocus
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    placeholder="Name suchen..."
                    className="pl-8 h-8 text-sm"
                  />
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredCustomers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">Keine Kunden gefunden</p>
                ) : filteredCustomers.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { handleCustomer(c.id); setCustomerDropdownOpen(false); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
                  >
                    <span className="font-medium">{c.first_name} {c.last_name}</span>
                    {c.company_name && <span className="text-xs text-muted-foreground">· {c.company_name}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
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