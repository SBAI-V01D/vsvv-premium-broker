// Vollständige Schweizer Versicherungssparten

export const SPARTEN_PRIVAT = [
  { value: 'kvg', label: 'Krankenversicherung KVG (Grundversicherung)', group: 'Privat' },
  { value: 'vvg_zusatz', label: 'Zusatzversicherung VVG', group: 'Privat' },
  { value: 'kvg_vvg_kombi', label: 'Grund- und Zusatzversicherung (Kombi)', group: 'Privat' },
  { value: 'leben_3a', label: 'Lebensversicherung Säule 3a', group: 'Privat' },
  { value: 'leben_3b', label: 'Lebensversicherung Säule 3b', group: 'Privat' },
  { value: 'unfall_privat', label: 'Unfallversicherung', group: 'Privat' },
  { value: 'haftpflicht_privat', label: 'Haftpflichtversicherung', group: 'Privat' },
  { value: 'hausrat', label: 'Hausratversicherung', group: 'Privat' },
  { value: 'gebaude_privat', label: 'Gebäudeversicherung', group: 'Privat' },
  { value: 'motorfahrzeug', label: 'Motorfahrzeugversicherung', group: 'Privat' },
  { value: 'rechtsschutz_privat', label: 'Rechtsschutzversicherung', group: 'Privat' },
  { value: 'reise', label: 'Reiseversicherung', group: 'Privat' },
  { value: 'cyber_privat', label: 'Cyberversicherung Privat', group: 'Privat' },
]

export const SPARTEN_FIRMA = [
  // Pflichtversicherungen
  { value: 'bvg', label: 'BVG – Pensionskasse', group: 'Firma Pflicht' },
  { value: 'uvg', label: 'UVG – Unfallversicherung', group: 'Firma Pflicht' },
  { value: 'ktg', label: 'KTG – Krankentaggeld', group: 'Firma Pflicht' },
  // Sachversicherungen
  { value: 'inventar', label: 'Betriebs-/Geschäftsinventar', group: 'Firma Sach' },
  { value: 'gebaude_firma', label: 'Gebäudeversicherung Firma', group: 'Firma Sach' },
  { value: 'technisch', label: 'Technische Versicherungen', group: 'Firma Sach' },
  { value: 'transport', label: 'Transportversicherung', group: 'Firma Sach' },
  // Haftpflicht
  { value: 'betriebshaftpflicht', label: 'Betriebshaftpflicht', group: 'Firma Haftpflicht' },
  { value: 'berufshaftpflicht', label: 'Berufshaftpflicht', group: 'Firma Haftpflicht' },
  { value: 'do', label: "D&O – Organhaftpflicht", group: 'Firma Haftpflicht' },
  // Weitere
  { value: 'rechtsschutz_firma', label: 'Rechtsschutz Firma', group: 'Firma Weitere' },
  { value: 'cyber_firma', label: 'Cyberversicherung Firma', group: 'Firma Weitere' },
  { value: 'kredit', label: 'Kreditversicherung', group: 'Firma Weitere' },
  { value: 'flotte', label: 'Flottenversicherung', group: 'Firma Weitere' },
  { value: 'keyman', label: 'Keyman-Versicherung', group: 'Firma Weitere' },
  { value: 'gruppen_leben', label: 'Gruppen-Lebensversicherung', group: 'Firma Weitere' },
]

export const ALL_SPARTEN = [...SPARTEN_PRIVAT, ...SPARTEN_FIRMA]

export const getSparteLabel = (value) => {
  const s = ALL_SPARTEN.find(s => s.value === value)
  return s?.label || value
}

// Dynamische Pflichtfelder je Sparte
export const SPARTE_FIELDS = {
  kvg: [
    { key: 'ahv_number', label: 'AHV-Nummer', type: 'text', placeholder: '756.1234.5678.90' },
    { key: 'birth_date', label: 'Geburtsdatum', type: 'date' },
    { key: 'franchise', label: 'Franchise (CHF)', type: 'select', options: ['300','500','1000','1500','2000','2500'] },
    { key: 'model', label: 'Kassenmodell', type: 'select', options: ['Standardmodell','HMO','Hausarztmodell','Telemed','Flexmed'] },
    { key: 'current_insurer', label: 'Aktuelle Krankenkasse', type: 'text' },
  ],
  vvg_zusatz: [
    { key: 'ahv_number', label: 'AHV-Nummer', type: 'text' },
    { key: 'birth_date', label: 'Geburtsdatum', type: 'date' },
    { key: 'zusatz_type', label: 'Zusatzversicherungstyp', type: 'select', options: ['Spital allgemein','Spital halbprivat','Spital privat','Ambulant','Dental','Alternativ'] },
    { key: 'health_declaration', label: 'Gesundheitserklärung nötig', type: 'select', options: ['Ja','Nein'] },
  ],
  leben_3a: [
    { key: 'ahv_number', label: 'AHV-Nummer', type: 'text' },
    { key: 'birth_date', label: 'Geburtsdatum', type: 'date' },
    { key: 'sum_insured', label: 'Versicherungssumme (CHF)', type: 'number' },
    { key: 'duration_years', label: 'Laufzeit (Jahre)', type: 'number' },
    { key: 'smoker', label: 'Raucher', type: 'select', options: ['Nein','Ja'] },
    { key: 'beneficiary', label: 'Begünstigte Person', type: 'text' },
  ],
  leben_3b: [
    { key: 'ahv_number', label: 'AHV-Nummer', type: 'text' },
    { key: 'birth_date', label: 'Geburtsdatum', type: 'date' },
    { key: 'sum_insured', label: 'Versicherungssumme (CHF)', type: 'number' },
    { key: 'duration_years', label: 'Laufzeit (Jahre)', type: 'number' },
    { key: 'smoker', label: 'Raucher', type: 'select', options: ['Nein','Ja'] },
  ],
  motorfahrzeug: [
    { key: 'vehicle_type', label: 'Fahrzeugtyp', type: 'select', options: ['PW','Motorrad','Lieferwagen','LKW','Anhänger'] },
    { key: 'brand_model', label: 'Marke / Modell', type: 'text' },
    { key: 'year', label: 'Baujahr', type: 'number' },
    { key: 'license_plate', label: 'Kennzeichen', type: 'text' },
    { key: 'coverage', label: 'Deckungsart', type: 'select', options: ['Haftpflicht','Teilkasko','Vollkasko'] },
    { key: 'garage', label: 'Unterstand', type: 'select', options: ['Keine','Carport','Garage'] },
  ],
  hausrat: [
    { key: 'address', label: 'Versicherter Ort', type: 'text' },
    { key: 'sum_insured', label: 'Versicherungssumme (CHF)', type: 'number' },
    { key: 'sqm', label: 'Wohnfläche (m²)', type: 'number' },
    { key: 'simple_theft', label: 'Einfacher Diebstahl', type: 'select', options: ['Nein','Ja'] },
  ],
  bvg: [
    { key: 'company_name', label: 'Firmenname', type: 'text' },
    { key: 'uid', label: 'UID-Nummer', type: 'text', placeholder: 'CHE-123.456.789' },
    { key: 'employees_count', label: 'Anzahl Mitarbeitende', type: 'number' },
    { key: 'total_salary', label: 'Gesamte Lohnsumme (CHF)', type: 'number' },
    { key: 'plan_type', label: 'Plantyp', type: 'select', options: ['Vollversicherung','Teilautonome Kasse','Vollautonome Kasse'] },
  ],
  uvg: [
    { key: 'company_name', label: 'Firmenname', type: 'text' },
    { key: 'uid', label: 'UID-Nummer', type: 'text', placeholder: 'CHE-123.456.789' },
    { key: 'employees_count', label: 'Anzahl Mitarbeitende', type: 'number' },
    { key: 'total_salary', label: 'Lohnsumme (CHF)', type: 'number' },
    { key: 'nbuv', label: 'NBUV einschliessen', type: 'select', options: ['Ja','Nein'] },
  ],
  ktg: [
    { key: 'company_name', label: 'Firmenname', type: 'text' },
    { key: 'uid', label: 'UID-Nummer', type: 'text' },
    { key: 'employees_count', label: 'Anzahl Mitarbeitende', type: 'number' },
    { key: 'waiting_days', label: 'Karenztage', type: 'select', options: ['3','7','14','30','60','90'] },
    { key: 'benefit_percent', label: 'Leistung (%)', type: 'select', options: ['80','90','100'] },
  ],
  betriebshaftpflicht: [
    { key: 'company_name', label: 'Firmenname', type: 'text' },
    { key: 'uid', label: 'UID-Nummer', type: 'text' },
    { key: 'turnover', label: 'Jahresumsatz (CHF)', type: 'number' },
    { key: 'sum_insured', label: 'Deckungssumme (CHF)', type: 'number' },
    { key: 'activity', label: 'Betriebstätigkeit', type: 'text' },
  ],
  cyber_firma: [
    { key: 'company_name', label: 'Firmenname', type: 'text' },
    { key: 'turnover', label: 'Jahresumsatz (CHF)', type: 'number' },
    { key: 'employees_count', label: 'Mitarbeitende', type: 'number' },
    { key: 'data_volume', label: 'Datensätze (Kunden/Patienten)', type: 'text' },
    { key: 'sum_insured', label: 'Deckungssumme (CHF)', type: 'number' },
  ],
}

// Kombi KVG+VVG uses combined fields
SPARTE_FIELDS['kvg_vvg_kombi'] = [
  { key: 'ahv_number', label: 'AHV-Nummer', type: 'text', placeholder: '756.1234.5678.90' },
  { key: 'birth_date', label: 'Geburtsdatum', type: 'date' },
  { key: 'franchise', label: 'Franchise KVG (CHF)', type: 'select', options: ['300','500','1000','1500','2000','2500'] },
  { key: 'model', label: 'Kassenmodell', type: 'select', options: ['Standardmodell','HMO','Hausarztmodell','Telemed','Flexmed'] },
  { key: 'current_insurer', label: 'Aktuelle Krankenkasse', type: 'text' },
  { key: 'zusatz_type', label: 'Zusatzversicherungstyp', type: 'select', options: ['Spital allgemein','Spital halbprivat','Spital privat','Ambulant','Dental','Alternativ'] },
  { key: 'health_declaration', label: 'Gesundheitserklärung nötig', type: 'select', options: ['Ja','Nein'] },
]

export const getFieldsForSparte = (sparte) => SPARTE_FIELDS[sparte] || []