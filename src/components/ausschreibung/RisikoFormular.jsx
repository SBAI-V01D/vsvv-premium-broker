import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

const AUTO_MARKEN = [
  'Alfa Romeo','Audi','BMW','Citroën','Dacia','Ferrari','Fiat','Ford','Honda',
  'Hyundai','Jaguar','Jeep','Kia','Lamborghini','Land Rover','Lexus','Maserati',
  'Mazda','Mercedes-Benz','Mini','Mitsubishi','Nissan','Opel','Peugeot','Porsche',
  'Renault','SEAT','Skoda','Smart','Subaru','Suzuki','Tesla','Toyota','Volkswagen',
  'Volvo','Other / Sonstige',
];

const DECKUNGEN_HAUPTAUSWAHL = [
  { key: 'haftpflicht', label: 'Haftpflicht' },
  { key: 'teilkasko', label: 'Teilkasko' },
  { key: 'vollkasko', label: 'Vollkasko' },
  { key: 'parkschaden', label: 'Parkschaden' },
  { key: 'unfallinsassen', label: 'Unfallinsassen' },
  { key: 'pannenhilfe', label: 'Pannenhilfe' },
  { key: 'verkehrsrechtsschutz', label: 'Verkehrsrechtsschutz' },
  { key: 'grobfahrlaessigkeitsschutz', label: 'Grobfahrlässigkeitsschutz' },
];

const MOTORFAHRZEUG_SECTIONS = [
  {
    title: 'Fahrzeugdaten',
    fields: [
      { key: 'kategorie', label: 'Kategorie', type: 'select', options: ['Neu', 'Fahrzeugwechsel', 'WIK', 'Sonstige'] },
      { key: 'marke', label: 'Marke', type: 'marke' },
      { key: 'modell', label: 'Modell / Typ', type: 'text' },
      { key: 'jahrgang', label: 'Jahrgang', type: 'number' },
      { key: 'erstzulassung', label: 'Erstzulassung (Monat/Jahr)', type: 'text', placeholder: 'z.B. 03/2021' },
      { key: 'fahrzeugwert', label: 'Fahrzeugwert (CHF)', type: 'number' },
      { key: 'hubraum', label: 'Hubraum (ccm)', type: 'number' },
      { key: 'leistung_kw', label: 'Leistung (kW)', type: 'number' },
      { key: 'schildernummer', label: 'Kontrollschild', type: 'text', placeholder: 'z.B. ZH 123456' },
      { key: 'stammnummer', label: 'Stammnummer', type: 'text', placeholder: 'z.B. 12345678' },
      { key: 'fahrgestellnummer', label: 'Fahrgestellnummer (VIN)', type: 'text', placeholder: 'z.B. WBA1234...' },
      { key: 'aktueller_km_stand', label: 'Aktueller Kilometerstand', type: 'number', placeholder: 'km' },
      { key: 'leasing', label: 'Leasing', type: 'select', options: ['Nein', 'Ja'] },
      { key: 'e_fahrzeug', label: 'Elektrofahrzeug', type: 'select', options: ['Nein', 'Ja'] },
      { key: 'parkierungsort', label: 'Parkierungsort', type: 'select', options: ['Privatgarage', 'Sammelgarage', 'Strasse', 'Firmengelände'] },
    ],
  },
  {
    title: 'Nutzung & Fahrer',
    fields: [
      { key: 'km_pro_jahr', label: 'Kilometer pro Jahr', type: 'select', options: ['bis 5\'000 km', '5\'001–10\'000 km', '10\'001–15\'000 km', '15\'001–20\'000 km', '20\'001–25\'000 km', 'über 25\'000 km'] },
      { key: 'fahrerkreis', label: 'Fahrerkreis', type: 'select', options: ['Nur Halter', 'Halter + Ehepartner', 'Alle Fahrer über 25', 'Unbeschränkt'] },
      { key: 'juengster_fahrer_jg', label: 'Jüngster Fahrer (Jahrgang)', type: 'number' },
      { key: 'bonusstufe', label: 'Bonusstufe / Schadenfreiheit', type: 'text', placeholder: 'z.B. Stufe 3 / 5 schadenfrei' },
    ],
  },
  {
    title: 'Vertragsbedingungen',
    fields: [
      { key: 'vertrag_beginn', label: 'Beginn', type: 'date' },
      { key: 'vertrag_laufzeit', label: 'Vertragslaufzeit', type: 'laufzeit' },
      { key: 'vertrag_ablauf', label: 'Ablauf', type: 'date' },
      { key: 'zahlungsart', label: 'Zahlungsart', type: 'select', options: ['Jährlich', 'Halbjährlich', 'Vierteljährlich', 'Monatlich'] },
      { key: 'jaehrliches_kuendigungsrecht', label: 'Jährliches Kündigungsrecht', type: 'select', options: ['Ja', 'Nein'] },
    ],
  },
  {
    title: 'Bemerkungen',
    fields: [
      { key: 'bemerkungen', label: 'Bemerkungen', type: 'textarea', fullWidth: true },
    ],
  },
];

const FORMS = {
  'Motorfahrzeug': [], // handled via MOTORFAHRZEUG_SECTIONS
  'Haushalt': [
    { key: 'wohnflaeche', label: 'Wohnfläche (m²)', type: 'number' },
    { key: 'zimmer', label: 'Zimmeranzahl', type: 'number' },
    { key: 'baujahr', label: 'Baujahr Gebäude', type: 'number' },
    { key: 'versicherungssumme', label: 'Versicherungssumme (CHF)', type: 'number' },
    { key: 'wertsachen', label: 'Wertsachen (CHF)', type: 'number' },
    { key: 'glasdeckung', label: 'Glasdeckung', type: 'select', options: ['Nein', 'Ja'] },
    { key: 'fahrraeder', label: 'Fahrräder (CHF)', type: 'number' },
    { key: 'elementar', label: 'Elementarschäden', type: 'select', options: ['Inklusive', 'Nicht versichert'] },
    { key: 'grobfahrlaessigkeit', label: 'Grobfahrlässigkeit', type: 'select', options: ['Nicht gedeckt', 'Gedeckt'] },
  ],
  'Privathaftpflicht': [
    { key: 'versicherungssumme', label: 'Versicherungssumme (CHF)', type: 'select', options: ['1\'000\'000', '3\'000\'000', '5\'000\'000', '10\'000\'000'] },
    { key: 'haustiere', label: 'Haustiere', type: 'select', options: ['Keine', 'Hund', 'Katze', 'Sonstige'] },
    { key: 'eigentuemer', label: 'Eigentümer/Mieter', type: 'select', options: ['Mieter', 'Eigentümer'] },
  ],
  'Gebäude': [
    { key: 'baujahr', label: 'Baujahr', type: 'number' },
    { key: 'gebaeudeart', label: 'Gebäudeart', type: 'select', options: ['Einfamilienhaus', 'Mehrfamilienhaus', 'Stockwerkeigentum', 'Gewerbe'] },
    { key: 'versicherungswert', label: 'Versicherungswert (CHF)', type: 'number' },
    { key: 'wohnflaeche', label: 'Wohnfläche (m²)', type: 'number' },
    { key: 'standort', label: 'Standort/PLZ', type: 'text' },
    { key: 'elementar', label: 'Elementarschäden', type: 'select', options: ['Kantonale Police', 'Inklusive', 'Separat versichert'] },
  ],
  'Betriebshaftpflicht': [
    { key: 'branche', label: 'Branche', type: 'text' },
    { key: 'mitarbeiter', label: 'Mitarbeiteranzahl', type: 'number' },
    { key: 'umsatz', label: 'Jahresumsatz (CHF)', type: 'number' },
    { key: 'lohnsumme', label: 'Lohnsumme (CHF)', type: 'number' },
    { key: 'versicherungssumme', label: 'Versicherungssumme (CHF)', type: 'text' },
    { key: 'schadenhistorie', label: 'Schadenhistorie (letzte 5 Jahre)', type: 'textarea' },
  ],
  'Cyber': [
    { key: 'branche', label: 'Branche', type: 'text' },
    { key: 'umsatz', label: 'Jahresumsatz (CHF)', type: 'number' },
    { key: 'mitarbeiter', label: 'Mitarbeiteranzahl', type: 'number' },
    { key: 'it_dienstleister', label: 'IT-Dienstleister vorhanden', type: 'select', options: ['Ja', 'Nein'] },
    { key: 'backups', label: 'Regelmässige Backups', type: 'select', options: ['Ja - täglich', 'Ja - wöchentlich', 'Nein'] },
    { key: 'versicherungssumme', label: 'Gewünschte Versicherungssumme (CHF)', type: 'number' },
  ],
};

function CheckboxGroup({ items, values = [], onChange }) {
  const toggle = (key) => {
    const next = values.includes(key) ? values.filter(v => v !== key) : [...values, key];
    onChange(next);
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(item => (
        <label key={item.key} className="flex items-center gap-2 cursor-pointer text-sm">
          <Checkbox checked={values.includes(item.key)} onCheckedChange={() => toggle(item.key)} />
          {item.label}
        </label>
      ))}
    </div>
  );
}

function RadioGroup({ options, value, onChange }) {
  return (
    <div className="flex gap-4">
      {options.map(opt => (
        <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm">
          <input type="radio" className="accent-primary" checked={value === opt} onChange={() => onChange(opt)} />
          {opt}
        </label>
      ))}
    </div>
  );
}

function SectionHeader({ title }) {
  return <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 border-b border-slate-100 pb-1 mt-5">{title}</p>;
}

function MFZDeckungFormular({ d, set }) {
  const deckungen = d.deckungen || [];
  const hasDeckung = (k) => deckungen.includes(k);

  return (
    <div className="space-y-1">
      {/* Gewünschte Deckungen */}
      <SectionHeader title="Gewünschte Deckungen" />
      <CheckboxGroup
        items={DECKUNGEN_HAUPTAUSWAHL}
        values={deckungen}
        onChange={v => set('deckungen', v)}
      />

      {/* Haftpflicht */}
      {hasDeckung('haftpflicht') && (
        <div className="mt-4 pl-4 border-l-2 border-blue-200 space-y-3">
          <p className="text-sm font-semibold text-primary">Haftpflicht</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1 block">Versicherungssumme</Label>
              <Select value={d.hp_summe || ''} onValueChange={v => set('hp_summe', v)}>
                <SelectTrigger><SelectValue placeholder="Bitte wählen..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="50mio">CHF 50 Mio.</SelectItem>
                  <SelectItem value="100mio">CHF 100 Mio.</SelectItem>
                  <SelectItem value="200mio">CHF 200 Mio.</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <Checkbox checked={!!d.hp_bonusschutz} onCheckedChange={v => set('hp_bonusschutz', !!v)} />
              Bonus-Schutz
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <Checkbox checked={!!d.hp_grobfahrlaessigkeit} onCheckedChange={v => set('hp_grobfahrlaessigkeit', !!v)} />
              Grobfahrlässigkeitsschutz
            </label>
          </div>
        </div>
      )}

      {/* Teilkasko */}
      {hasDeckung('teilkasko') && (
        <div className="mt-4 pl-4 border-l-2 border-emerald-200 space-y-3">
          <p className="text-sm font-semibold text-emerald-700">Teilkasko</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1 block">Variante</Label>
              <RadioGroup options={['Standard', 'Plus']} value={d.tk_variante || ''} onChange={v => set('tk_variante', v)} />
            </div>
            <div>
              <Label className="mb-1 block">Selbstbehalt</Label>
              <Select value={d.tk_selbstbehalt || ''} onValueChange={v => set('tk_selbstbehalt', v)}>
                <SelectTrigger><SelectValue placeholder="Bitte wählen..." /></SelectTrigger>
                <SelectContent>
                  {["CHF 0","CHF 200","CHF 300","CHF 500","CHF 1'000"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="mb-2 block text-xs text-muted-foreground">Deckungen</Label>
            <CheckboxGroup
              items={[
                {key:'diebstahl',label:'Diebstahl'},{key:'feuer',label:'Feuer'},{key:'elementar',label:'Elementarschäden'},
                {key:'glas',label:'Glasbruch'},{key:'marder',label:'Marder'},{key:'tiere',label:'Kollision mit Tieren'},
                {key:'vandalismus',label:'Vandalismus'},{key:'schluessel',label:'Schlüsselverlust'},
                {key:'ladekabel',label:'Ladekabel (E-Fahrzeuge)'},{key:'wallbox',label:'Wallbox'},
              ]}
              values={d.tk_deckungen || []}
              onChange={v => set('tk_deckungen', v)}
            />
          </div>
        </div>
      )}

      {/* Vollkasko */}
      {hasDeckung('vollkasko') && (
        <div className="mt-4 pl-4 border-l-2 border-violet-200 space-y-3">
          <p className="text-sm font-semibold text-violet-700">Vollkasko</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1 block">Variante</Label>
              <RadioGroup options={['Standard', 'Plus']} value={d.vk_variante || ''} onChange={v => set('vk_variante', v)} />
            </div>
            <div>
              <Label className="mb-1 block">Selbstbehalt Kollisionsschäden</Label>
              <Select value={d.vk_selbstbehalt || ''} onValueChange={v => set('vk_selbstbehalt', v)}>
                <SelectTrigger><SelectValue placeholder="Bitte wählen..." /></SelectTrigger>
                <SelectContent>
                  {["CHF 0","CHF 500","CHF 1'000","CHF 2'000","CHF 5'000"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="mb-2 block text-xs text-muted-foreground">Zusatzoptionen</Label>
            <CheckboxGroup
              items={[
                {key:'bonusschutz',label:'Bonusschutz'},{key:'neuwert',label:'Neuwertentschädigung'},
                {key:'kaufwert',label:'Kaufwertentschädigung'},{key:'gap',label:'GAP-Deckung Leasing'},
                {key:'mitsachen',label:'Mitgeführte Sachen'},{key:'grobfahrlaessigkeit',label:'Grobfahrlässigkeit'},
              ]}
              values={d.vk_optionen || []}
              onChange={v => set('vk_optionen', v)}
            />
          </div>
        </div>
      )}

      {/* Parkschaden */}
      {hasDeckung('parkschaden') && (
        <div className="mt-4 pl-4 border-l-2 border-amber-200 space-y-3">
          <p className="text-sm font-semibold text-amber-700">Parkschaden</p>
          <div>
            <Label className="mb-1 block">Variante</Label>
            <RadioGroup options={['Standard', 'Plus']} value={d.ps_variante || ''} onChange={v => set('ps_variante', v)} />
          </div>
          {d.ps_variante && (
            <p className="text-xs text-muted-foreground italic">
              {d.ps_variante === 'Standard' ? '2 Ereignisse pro Jahr' : 'Unbeschränkte Ereignisse · Erweiterte Deckung'}
            </p>
          )}
        </div>
      )}

      {/* Unfallinsassen */}
      {hasDeckung('unfallinsassen') && (
        <div className="mt-4 pl-4 border-l-2 border-rose-200 space-y-3">
          <p className="text-sm font-semibold text-rose-700">Unfallinsassen</p>
          <div>
            <Label className="mb-1 block">Variante</Label>
            <RadioGroup options={['Standard', 'Plus']} value={d.ui_variante || ''} onChange={v => set('ui_variante', v)} />
          </div>
          {d.ui_variante === 'Standard' && (
            <CheckboxGroup
              items={[{key:'heilung',label:'Heilungskosten'},{key:'taggeld',label:'Taggeld'},{key:'invaliditaet',label:'Invalidität'},{key:'todesfall',label:'Todesfall'}]}
              values={d.ui_deckungen || []}
              onChange={v => set('ui_deckungen', v)}
            />
          )}
          {d.ui_variante === 'Plus' && (
            <CheckboxGroup
              items={[{key:'kapital',label:'Erweiterte Kapitalleistungen'},{key:'invaliditaet_hoch',label:'Höhere Invaliditätssummen'},{key:'weltweit',label:'Weltweite Deckung'}]}
              values={d.ui_deckungen || []}
              onChange={v => set('ui_deckungen', v)}
            />
          )}
        </div>
      )}

      {/* Pannenhilfe */}
      {hasDeckung('pannenhilfe') && (
        <div className="mt-4 pl-4 border-l-2 border-sky-200 space-y-3">
          <p className="text-sm font-semibold text-sky-700">Pannenhilfe</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1 block">Deckungsgebiet</Label>
              <RadioGroup options={['Schweiz', 'Europa', 'Schweiz + Europa']} value={d.ph_gebiet || ''} onChange={v => set('ph_gebiet', v)} />
            </div>
            <div>
              <Label className="mb-1 block">Paket</Label>
              <RadioGroup options={['Standard', 'Plus']} value={d.ph_paket || ''} onChange={v => set('ph_paket', v)} />
            </div>
          </div>
          <div>
            <Label className="mb-2 block text-xs text-muted-foreground">Leistungen</Label>
            <CheckboxGroup
              items={[
                {key:'weiterfahrt',label:'Weiterfahrt organisieren'},{key:'ruecktransport',label:'Rücktransport Fahrzeug'},
                {key:'ersatzfahrzeug',label:'Ersatzfahrzeug'},{key:'hotel',label:'Hotelkosten'},
                {key:'bergung',label:'Fahrzeugbergung'},{key:'rueckfuehrung',label:'Fahrzeugrückführung'},
                {key:'heimreise',label:'Heimreise'},
              ]}
              values={d.ph_leistungen || []}
              onChange={v => set('ph_leistungen', v)}
            />
          </div>
        </div>
      )}

      {/* Verkehrsrechtsschutz */}
      {hasDeckung('verkehrsrechtsschutz') && (
        <div className="mt-4 pl-4 border-l-2 border-indigo-200 space-y-3">
          <p className="text-sm font-semibold text-indigo-700">Verkehrsrechtsschutz</p>
          <div>
            <Label className="mb-1 block">Deckungsumfang</Label>
            <RadioGroup options={['Basis', 'Plus']} value={d.vr_umfang || ''} onChange={v => set('vr_umfang', v)} />
          </div>
          <div>
            <Label className="mb-2 block text-xs text-muted-foreground">Bereiche</Label>
            <CheckboxGroup
              items={[
                {key:'fahrzeug',label:'Fahrzeugrechtsschutz'},{key:'fuehrerausweis',label:'Führerausweisverfahren'},
                {key:'strafrecht',label:'Strafrechtsschutz Verkehr'},{key:'vertragsrecht',label:'Vertragsrechtsschutz Fahrzeug'},
                {key:'europa',label:'Europa Deckung'},{key:'weltweit',label:'Weltweite Deckung'},
              ]}
              values={d.vr_bereiche || []}
              onChange={v => set('vr_bereiche', v)}
            />
          </div>
        </div>
      )}

      {/* Zubehör */}
      <SectionHeader title="Zubehör" />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="mb-1 block">Zubehör (CHF)</Label>
          <Input type="number" value={d.zubehoer || ''} onChange={e => set('zubehoer', e.target.value)} placeholder="Wert nachgerüstetes Zubehör" />
        </div>
        <div>
          <Label className="mb-1 block">Zubehör Beschreibung</Label>
          <Input type="text" value={d.zubehoer_beschreibung || ''} onChange={e => set('zubehoer_beschreibung', e.target.value)} placeholder="z.B. Dachbox, Anhängerkupplung..." />
        </div>
      </div>
    </div>
  );
}

export default function RisikoFormular({ sparten = [], data = {}, onChange, onSave, saving, saved }) {
  const set = (sparte, key, val) => {
    const updated = { ...data, [sparte]: { ...(data[sparte] || {}), [key]: val } };
    // Auto-berechnung Ablauf wenn Beginn + Laufzeit gesetzt
    if (key === 'vertrag_beginn' || key === 'vertrag_laufzeit') {
      const beginn = key === 'vertrag_beginn' ? val : (data[sparte]?.vertrag_beginn || '');
      const laufzeit = key === 'vertrag_laufzeit' ? val : (data[sparte]?.vertrag_laufzeit || '');
      if (beginn && laufzeit && laufzeit !== 'maximal') {
        const years = parseInt(laufzeit, 10);
        const d = new Date(beginn);
        d.setFullYear(d.getFullYear() + years);
        d.setDate(d.getDate() - 1);
        updated[sparte].vertrag_ablauf = d.toISOString().split('T')[0];
      }
    }
    onChange(updated);
  };

  const activeForms = sparten.filter(s => FORMS[s]);

  if (activeForms.length === 0) {
    return <p className="text-sm text-muted-foreground italic">Wählen Sie Sparten im ersten Schritt aus, um die Risikoformulare zu sehen.</p>;
  }

  const renderField = (sparte, field) => (
    <div key={field.key} className={(field.type === 'textarea' || field.fullWidth) ? 'col-span-2' : ''}>
      <Label className="mb-1 block">{field.label}</Label>
      {field.type === 'laufzeit' ? (
        <Select value={data[sparte]?.[field.key] || ''} onValueChange={v => set(sparte, field.key, v)}>
          <SelectTrigger><SelectValue placeholder="Laufzeit wählen..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 Jahr</SelectItem>
            <SelectItem value="3">3 Jahre</SelectItem>
            <SelectItem value="5">5 Jahre</SelectItem>
            <SelectItem value="maximal">Maximal</SelectItem>
          </SelectContent>
        </Select>
      ) : field.type === 'marke' ? (
        <Select value={data[sparte]?.[field.key] || ''} onValueChange={v => set(sparte, field.key, v)}>
          <SelectTrigger><SelectValue placeholder="Marke wählen..." /></SelectTrigger>
          <SelectContent className="max-h-60">
            {AUTO_MARKEN.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : field.type === 'select' ? (
        <Select value={data[sparte]?.[field.key] || ''} onValueChange={v => set(sparte, field.key, v)}>
          <SelectTrigger><SelectValue placeholder="Bitte wählen..." /></SelectTrigger>
          <SelectContent>{field.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      ) : field.type === 'textarea' ? (
        <Textarea value={data[sparte]?.[field.key] || ''} onChange={e => set(sparte, field.key, e.target.value)} rows={3} />
      ) : (
        <Input
          type={field.type === 'date' ? 'date' : field.type}
          value={data[sparte]?.[field.key] || ''}
          onChange={e => set(sparte, field.key, e.target.value)}
          placeholder={field.placeholder || ''}
        />
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      {activeForms.map(sparte => (
        <div key={sparte} className="surface p-4">
          <h3 className="text-subheading mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary inline-block" />
            {sparte}
          </h3>
          {sparte === 'Motorfahrzeug' ? (
            <div className="space-y-1">
              {/* Fahrzeugdaten & Nutzung */}
              {MOTORFAHRZEUG_SECTIONS.filter(s => s.title !== 'Gewünschte Deckung').map(section => (
                <div key={section.title}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 border-b border-slate-100 pb-1 mt-4">{section.title}</p>
                  <div className="grid grid-cols-2 gap-4">
                    {section.fields.map(field => renderField(sparte, field))}
                  </div>
                </div>
              ))}
              {/* Strukturierte Deckungsauswahl */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 border-b border-slate-100 pb-1 mt-4">Gewünschte Deckung</p>
                <MFZDeckungFormular
                  d={data[sparte] || {}}
                  set={(key, val) => set(sparte, key, val)}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {FORMS[sparte].map(field => renderField(sparte, field))}
            </div>
          )}
        </div>
      ))}

      {onSave && (
        <div className="flex justify-end items-center gap-3 pt-2">
          {saved && <span className="text-sm text-emerald-600 font-medium">✓ Gespeichert</span>}
          <Button onClick={onSave} disabled={saving}>
            {saving ? 'Speichern...' : 'Risikodaten speichern'}
          </Button>
        </div>
      )}
    </div>
  );
}