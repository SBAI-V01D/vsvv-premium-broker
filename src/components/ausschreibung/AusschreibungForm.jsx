import React, { useState, useEffect, useRef, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronDown, X, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import RisikoFormular from './RisikoFormular';

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

  const [sparteSearch, setSparteSearch] = useState('');
  const [sparteDropdownOpen, setSparteDropdownOpen] = useState(false);
  const sparteRef = useRef(null);
  const [expandedSparte, setExpandedSparte] = useState(null);

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
    broker_name: '', risiko_daten: {},
    ...ausschreibung,
  });
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
      if (sparteRef.current && !sparteRef.current.contains(e.target)) {
        setSparteDropdownOpen(false);
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
          <Input autoFocus tabIndex={1} value={form.titel} onChange={e => set('titel', e.target.value)} required placeholder="z.B. Motorfahrzeugversicherung Privathaushalt 2026" />
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
            <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg" onMouseDown={e => e.preventDefault()}>
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
          <Input tabIndex={3} value={form.ansprechpartner} onChange={e => set('ansprechpartner', e.target.value)} placeholder="Name Ansprechpartner" />
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
          <Input tabIndex={6} type="date" value={form.fristdatum} onChange={e => set('fristdatum', e.target.value)} />
        </div>
        <div>
          <Label>Laufende Jahresprämie (CHF)</Label>
          <Input tabIndex={7} type="number" value={form.laufende_praemie} onChange={e => set('laufende_praemie', e.target.value)} placeholder="z.B. 2400" />
        </div>
      </div>

      <div ref={sparteRef} className="relative">
        <Label className="mb-2 block">Sparten</Label>
        {/* Suchfeld */}
        <button
          type="button"
          onClick={() => { setSparteDropdownOpen(o => !o); setSparteSearch(''); }}
          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm text-left"
        >
          <span className="text-muted-foreground">
            {form.sparten.length > 0 ? `${form.sparten.length} Sparte(n) gewählt` : 'Sparte suchen & wählen...'}
          </span>
          <Search className="w-4 h-4 text-muted-foreground" />
        </button>
        {sparteDropdownOpen && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg" onMouseDown={e => e.preventDefault()}>
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  autoFocus
                  value={sparteSearch}
                  onChange={e => setSparteSearch(e.target.value)}
                  placeholder="Sparte suchen..."
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto p-1">
              {SPARTEN.filter(s => s.toLowerCase().includes(sparteSearch.toLowerCase())).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { toggleSparte(s); setSparteSearch(''); }}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center justify-between hover:bg-slate-50 ${form.sparten.includes(s) ? 'text-primary font-medium' : 'text-slate-700'}`}
                >
                  {s}
                  {form.sparten.includes(s) && <span className="text-primary text-xs">✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Gewählte Sparten als Chips */}
        {form.sparten.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {form.sparten.map(s => (
              <div key={s} className="flex flex-col w-full">
                <div
                  className="flex items-center justify-between px-3 py-2 rounded-lg border border-primary/30 bg-primary/5 cursor-pointer hover:bg-primary/10"
                  onClick={() => setExpandedSparte(expandedSparte === s ? null : s)}
                >
                  <span className="text-sm font-medium text-primary flex items-center gap-2">
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expandedSparte === s ? 'rotate-90' : ''}`} />
                    {s}
                  </span>
                  <button type="button" onClick={e => { e.stopPropagation(); toggleSparte(s); if (expandedSparte === s) setExpandedSparte(null); }} className="text-slate-400 hover:text-rose-500 p-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {expandedSparte === s && (
                  <div className="mt-1 ml-4 pl-3 border-l-2 border-primary/20">
                    <RisikoFormular
                      sparten={[s]}
                      data={form.risiko_daten || {}}
                      onChange={d => set('risiko_daten', d)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Antragsfragen ─────────────────────────────────────── */}
      <div className="border-t border-slate-200 pt-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary inline-block" />
          Antragsfragen
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {/* 1. Vorversicherer */}
          <div>
            <Label>Vorversicherer vorhanden?</Label>
            <Select value={form.antrag_vorversicherer || ''} onValueChange={v => set('antrag_vorversicherer', v)}>
              <SelectTrigger><SelectValue placeholder="Bitte wählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ja">Ja</SelectItem>
                <SelectItem value="nein">Nein</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.antrag_vorversicherer === 'ja' && (
            <div>
              <Label>Name Vorversicherer</Label>
              <Input value={form.antrag_vorversicherer_name || ''} onChange={e => set('antrag_vorversicherer_name', e.target.value)} placeholder="z.B. Mobiliar, AXA..." />
            </div>
          )}

          {/* 2. Schäden letzte 5 Jahre */}
          <div className="col-span-2">
            <Label>Schäden in den letzten 5 Jahren</Label>
            <Textarea value={form.antrag_schaeden || ''} onChange={e => set('antrag_schaeden', e.target.value)} rows={2} placeholder="Anzahl, Datum, Betrag (CHF), kurze Beschreibung..." />
          </div>

          {/* 3. Antrag abgelehnt */}
          <div>
            <Label>Antrag durch Versicherer abgelehnt?</Label>
            <Select value={form.antrag_abgelehnt || ''} onValueChange={v => set('antrag_abgelehnt', v)}>
              <SelectTrigger><SelectValue placeholder="Bitte wählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nein">Nein</SelectItem>
                <SelectItem value="ja">Ja</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.antrag_abgelehnt === 'ja' && (
            <div>
              <Label>Kommentar zur Ablehnung</Label>
              <Textarea value={form.antrag_abgelehnt_kommentar || ''} onChange={e => set('antrag_abgelehnt_kommentar', e.target.value)} rows={2} placeholder="Wann, weshalb abgelehnt..." />
            </div>
          )}

          {/* 4. Führerausweisdatum */}
          <div>
            <Label>Führerausweisdatum (Versicherungsnehmer)</Label>
            <Input type="date" value={form.antrag_fuehrerausweis_datum || ''} onChange={e => set('antrag_fuehrerausweis_datum', e.target.value)} />
          </div>
        </div>

        {/* 5. Weitere Lenker */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <Label>Weitere Lenker</Label>
            <button type="button" onClick={() => {
              const lenker = form.antrag_weitere_lenker || [];
              set('antrag_weitere_lenker', [...lenker, { name: '', vorname: '', geburtsdatum: '', fuehrerausweis_datum: '' }]);
            }} className="text-xs text-primary hover:underline font-medium">+ Lenker hinzufügen</button>
          </div>
          {(form.antrag_weitere_lenker || []).map((l, i) => (
            <div key={i} className="grid grid-cols-4 gap-2 mb-2 items-end">
              <div>
                <Label className="text-xs">Nachname</Label>
                <Input value={l.name} onChange={e => {
                  const arr = [...(form.antrag_weitere_lenker || [])];
                  arr[i] = { ...arr[i], name: e.target.value };
                  set('antrag_weitere_lenker', arr);
                }} placeholder="Nachname" />
              </div>
              <div>
                <Label className="text-xs">Vorname</Label>
                <Input value={l.vorname} onChange={e => {
                  const arr = [...(form.antrag_weitere_lenker || [])];
                  arr[i] = { ...arr[i], vorname: e.target.value };
                  set('antrag_weitere_lenker', arr);
                }} placeholder="Vorname" />
              </div>
              <div>
                <Label className="text-xs">Geburtsdatum</Label>
                <Input type="date" value={l.geburtsdatum} onChange={e => {
                  const arr = [...(form.antrag_weitere_lenker || [])];
                  arr[i] = { ...arr[i], geburtsdatum: e.target.value };
                  set('antrag_weitere_lenker', arr);
                }} />
              </div>
              <div className="flex gap-1">
                <div className="flex-1">
                  <Label className="text-xs">Führerausweis</Label>
                  <Input type="date" value={l.fuehrerausweis_datum} onChange={e => {
                    const arr = [...(form.antrag_weitere_lenker || [])];
                    arr[i] = { ...arr[i], fuehrerausweis_datum: e.target.value };
                    set('antrag_weitere_lenker', arr);
                  }} />
                </div>
                <button type="button" onClick={() => {
                  const arr = (form.antrag_weitere_lenker || []).filter((_, idx) => idx !== i);
                  set('antrag_weitere_lenker', arr);
                }} className="mt-5 text-rose-500 hover:text-rose-700 px-1">✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label>Bemerkungen</Label>
        <Textarea tabIndex={8} value={form.bemerkungen} onChange={e => set('bemerkungen', e.target.value)} rows={3} placeholder="Interne Notizen zur Ausschreibung..." />
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Speichern...' : (ausschreibung?.id ? 'Aktualisieren' : 'Erstellen')}</Button>
      </div>
    </form>
  );
}