import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

const AUTO_MARKEN = [
  'Alfa Romeo','Audi','BMW','Citroën','Dacia','Ferrari','Fiat','Ford','Honda',
  'Hyundai','Jaguar','Jeep','Kia','Lamborghini','Land Rover','Lexus','Maserati',
  'Mazda','Mercedes-Benz','Mini','Mitsubishi','Nissan','Opel','Peugeot','Porsche',
  'Renault','SEAT','Skoda','Smart','Subaru','Suzuki','Tesla','Toyota','Volkswagen',
  'Volvo','Other / Sonstige',
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
    title: 'Gewünschte Deckung',
    fields: [
      { key: 'deckung_gewuenscht', label: 'Gewünschte Deckung', type: 'select', options: ['Haftpflicht', 'Haftpflicht + Teilkasko', 'Vollkasko'] },
      { key: 'selbstbehalt_kasko', label: 'Selbstbehalt Kasko', type: 'select', options: ['CHF 0', 'CHF 200', 'CHF 500', 'CHF 1\'000', 'CHF 1\'500', 'CHF 2\'000'] },
      { key: 'assistance', label: 'Pannenhilfe / Assistance', type: 'select', options: ['Nein', 'Ja'] },
      { key: 'insassen', label: 'Insassenunfall', type: 'select', options: ['Nein', 'Ja'] },
      { key: 'zubehoer', label: 'Zubehör (CHF)', type: 'number', placeholder: 'Wert nachgerüstetes Zubehör' },
      { key: 'zubehoer_beschreibung', label: 'Zubehör Beschreibung', type: 'text', placeholder: 'z.B. Dachbox, Anhängerkupplung...' },
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
        d.setDate(d.getDate() - 1); // letzter Tag der Laufzeit
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
            <div className="space-y-5">
              {MOTORFAHRZEUG_SECTIONS.map(section => (
                <div key={section.title}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 border-b border-slate-100 pb-1">{section.title}</p>
                  <div className="grid grid-cols-2 gap-4">
                    {section.fields.map(field => renderField(sparte, field))}
                  </div>
                </div>
              ))}
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