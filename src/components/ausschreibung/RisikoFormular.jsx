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

const FORMS = {
  'Motorfahrzeug': [
    { key: 'kategorie', label: 'Kategorie', type: 'select', options: ['Neu', 'Fahrzeugwechsel', 'WIK', 'Sonstige'], fullWidth: false },
    { key: 'marke', label: 'Marke', type: 'marke', fullWidth: false },
    { key: 'modell', label: 'Modell / Typ', type: 'text', fullWidth: false },
    { key: 'jahrgang', label: 'Jahrgang', type: 'number', fullWidth: false },
    { key: 'erstzulassung', label: 'Erstzulassung (Monat/Jahr)', type: 'text', placeholder: 'z.B. 03/2021', fullWidth: false },
    { key: 'fahrzeugwert', label: 'Fahrzeugwert (CHF)', type: 'number', fullWidth: false },
    { key: 'hubraum', label: 'Hubraum (ccm)', type: 'number', fullWidth: false },
    { key: 'leistung_kw', label: 'Leistung (kW)', type: 'number', fullWidth: false },
    { key: 'km_pro_jahr', label: 'Kilometer pro Jahr', type: 'select', options: ['bis 5\'000 km', '5\'001–10\'000 km', '10\'001–15\'000 km', '15\'001–20\'000 km', '20\'001–25\'000 km', 'über 25\'000 km'], fullWidth: false },
    { key: 'schildernummer', label: 'Schildernummer / Kontrollschild', type: 'text', placeholder: 'z.B. ZH 123456', fullWidth: false },
    { key: 'leasing', label: 'Leasing', type: 'select', options: ['Nein', 'Ja'], fullWidth: false },
    { key: 'fahrerkreis', label: 'Fahrerkreis', type: 'select', options: ['Nur Halter', 'Halter + Ehepartner', 'Alle Fahrer über 25', 'Unbeschränkt'], fullWidth: false },
    { key: 'juengster_fahrer_jg', label: 'Jüngster Fahrer (Jahrgang)', type: 'number', fullWidth: false },
    { key: 'bonusstufe', label: 'Aktuelle Bonusstufe / Schadenfreiheit', type: 'text', placeholder: 'z.B. Stufe 3 / 5 schadenfrei', fullWidth: false },
    { key: 'vorversicherer', label: 'Vorversicherer', type: 'text', fullWidth: false },
    { key: 'parkierungsort', label: 'Parkierungsort', type: 'select', options: ['Privatgarage', 'Sammelgarage', 'Strasse', 'Firmengelände'], fullWidth: false },
    { key: 'deckung_gewuenscht', label: 'Gewünschte Deckung', type: 'select', options: ['Haftpflicht', 'Haftpflicht + Teilkasko', 'Vollkasko'], fullWidth: false },
    { key: 'selbstbehalt_kasko', label: 'Selbstbehalt Kasko', type: 'select', options: ['CHF 0', 'CHF 200', 'CHF 500', 'CHF 1\'000', 'CHF 1\'500', 'CHF 2\'000'], fullWidth: false },
    { key: 'assistance', label: 'Pannenhilfe / Assistance', type: 'select', options: ['Nein', 'Ja'], fullWidth: false },
    { key: 'insassen', label: 'Insassenunfall', type: 'select', options: ['Nein', 'Ja'], fullWidth: false },
    { key: 'zubehoer', label: 'Zubehör (CHF)', type: 'number', placeholder: 'Wert nachgerüstetes Zubehör', fullWidth: false },
    { key: 'zubehoer_beschreibung', label: 'Zubehör Beschreibung', type: 'text', placeholder: 'z.B. Dachbox, Anhängerkupplung...', fullWidth: false },
    { key: 'bemerkungen', label: 'Bemerkungen', type: 'textarea', fullWidth: true },
  ],
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
    onChange({ ...data, [sparte]: { ...(data[sparte] || {}), [key]: val } });
  };

  const activeForms = sparten.filter(s => FORMS[s]);

  if (activeForms.length === 0) {
    return <p className="text-sm text-muted-foreground italic">Wählen Sie Sparten im ersten Schritt aus, um die Risikoformulare zu sehen.</p>;
  }

  return (
    <div className="space-y-8">
      {activeForms.map(sparte => (
        <div key={sparte} className="surface p-4">
          <h3 className="text-subheading mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary inline-block" />
            {sparte}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {FORMS[sparte].map(field => (
              <div key={field.key} className={(field.type === 'textarea' || field.fullWidth) ? 'col-span-2' : ''}>
                <Label className="mb-1 block">{field.label}</Label>
                {field.type === 'marke' ? (
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
                    type={field.type}
                    value={data[sparte]?.[field.key] || ''}
                    onChange={e => set(sparte, field.key, e.target.value)}
                    placeholder={field.placeholder || ''}
                  />
                )}
              </div>
            ))}
          </div>
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