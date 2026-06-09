# VSVV CRM - SQL-Schema für Supabase

**Version:** 1.0  
**Datum:** 2026-06-09  
**Status:** Zur Ausführung bereit  
**Ziel:** Supabase PostgreSQL Database

---

## Inhaltsverzeichnis

1. [Referenztabellen](#1-referenztabellen)
2. [Stammdaten](#2-stammdaten)
3. [BAG-Prämiendaten](#3-bag-prämiendaten)
4. [Import-Management](#4-import-management)
5. [CRM-Kunden](#5-crm-kunden)
6. [CRM-Verträge](#6-crm-verträge)
7. [CRM-Operationen](#7-crm-operationen)
8. [Vergleiche & Offerten](#8-vergleiche--offerten)
9. [Zusatzversicherungen](#9-zusatzversicherungen)
10. [Audit & Logging](#10-audit--logging)
11. [Row Level Security](#11-row-level-security)
12. [Stored Procedures](#12-stored-procedures)
13. [SEED-Daten](#13-seed-daten)

---

## 1. Referenztabellen

### 1.1 Kantone

```sql
-- TABELLE: ref_kantone
CREATE TABLE IF NOT EXISTS ref_kantone (
  id SERIAL PRIMARY KEY,
  kanton_kurz TEXT NOT NULL UNIQUE,
  kanton_lang TEXT NOT NULL,
  kanton_lang_fr TEXT,
  kanton_lang_it TEXT,
  hauptort TEXT,
  region TEXT,
  aktiv BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE ref_kantone IS 'Alle 26 Schweizer Kantone mit Mehrsprachigkeit';

INSERT INTO ref_kantone (kanton_kurz, kanton_lang, hauptort, region) VALUES
  ('ZH', 'Zürich', 'Zürich', 'Deutschschweiz'),
  ('BE', 'Bern', 'Bern', 'Deutschschweiz'),
  ('LU', 'Luzern', 'Luzern', 'Deutschschweiz'),
  ('UR', 'Uri', 'Altdorf', 'Deutschschweiz'),
  ('SZ', 'Schwyz', 'Schwyz', 'Deutschschweiz'),
  ('OW', 'Obwalden', 'Sarnen', 'Deutschschweiz'),
  ('NW', 'Nidwalden', 'Stans', 'Deutschschweiz'),
  ('GL', 'Glarus', 'Glarus', 'Deutschschweiz'),
  ('ZG', 'Zug', 'Zug', 'Deutschschweiz'),
  ('FR', 'Freiburg', 'Freiburg', 'Romandie'),
  ('SO', 'Solothurn', 'Solothurn', 'Deutschschweiz'),
  ('BS', 'Basel-Stadt', 'Basel', 'Deutschschweiz'),
  ('BL', 'Basel-Landschaft', 'Liestal', 'Deutschschweiz'),
  ('SH', 'Schaffhausen', 'Schaffhausen', 'Deutschschweiz'),
  ('AR', 'Appenzell Ausserrhoden', 'Herisau', 'Deutschschweiz'),
  ('AI', 'Appenzell Innerrhoden', 'Appenzell', 'Deutschschweiz'),
  ('SG', 'St. Gallen', 'St. Gallen', 'Deutschschweiz'),
  ('GR', 'Graubünden', 'Chur', 'Deutschschweiz'),
  ('AG', 'Aargau', 'Aarau', 'Deutschschweiz'),
  ('TG', 'Thurgau', 'Frauenfeld', 'Deutschschweiz'),
  ('TI', 'Tessin', 'Bellinzona', 'Ticino'),
  ('VD', 'Waadt', 'Lausanne', 'Romandie'),
  ('VS', 'Wallis', 'Sion', 'Romandie'),
  ('NE', 'Neuenburg', 'Neuenburg', 'Romandie'),
  ('GE', 'Genf', 'Genf', 'Romandie'),
  ('JU', 'Jura', 'Delémont', 'Romandie');
```

### 1.2 BAG-Regionen

```sql
-- TABELLE: ref_bag_regionen
CREATE TABLE IF NOT EXISTS ref_bag_regionen (
  id SERIAL PRIMARY KEY,
  region_code TEXT NOT NULL UNIQUE,
  region_name TEXT NOT NULL,
  region_beschreibung TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO ref_bag_regionen (region_code, region_name, region_beschreibung) VALUES
  ('1', 'Stadtzentren', 'Grösste Städte (Zürich, Genf, Basel, Bern, Lausanne)'),
  ('2', 'Agglomerationen', 'Mittlere Städte und Agglomerationen'),
  ('3', 'Ländliche Gebiete', 'Kleinere Gemeinden und ländliche Regionen');
```

### 1.3 PLZ

```sql
-- TABELLE: ref_plz
CREATE TABLE IF NOT EXISTS ref_plz (
  id SERIAL PRIMARY KEY,
  plz INTEGER NOT NULL,
  ort TEXT NOT NULL,
  kanton_kurz TEXT NOT NULL REFERENCES ref_kantone(kanton_kurz),
  bag_region_code TEXT REFERENCES ref_bag_regionen(region_code),
  zusatz TEXT,
  UNIQUE (plz, ort),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ref_plz_plz ON ref_plz(plz);
CREATE INDEX idx_ref_plz_kanton ON ref_plz(kanton_kurz);
CREATE INDEX idx_ref_plz_region ON ref_plz(bag_region_code);
```

---

## 2. Stammdaten

### 2.1 Versicherer

```sql
-- TABELLE: versicherer
CREATE TABLE IF NOT EXISTS versicherer (
  id SERIAL PRIMARY KEY,
  bag_id INTEGER UNIQUE,
  externe_id TEXT,
  name TEXT NOT NULL,
  kurzname TEXT NOT NULL,
  rechtsform TEXT,
  gruppe TEXT,
  gruppe_id INTEGER REFERENCES versicherer(id),
  logo_url TEXT,
  logo_dark_url TEXT,
  farbe_primary TEXT,
  farbe_secondary TEXT,
  kontakt_email TEXT,
  kontakt_telefon TEXT,
  kontakt_fax TEXT,
  strasse TEXT,
  plz TEXT,
  ort TEXT,
  kanton TEXT REFERENCES ref_kantone(kanton_kurz),
  website TEXT,
  portal_url TEXT,
  api_url TEXT,
  aktiv BOOLEAN DEFAULT true,
  inaktiv_seit DATE,
  inaktiv_grund TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT,
  CONSTRAINT chk_versicherer_kanton CHECK (kanton IN (
    'ZH','BE','LU','UR','SZ','OW','NW','GL','ZG','FR','SO','BS','BL','SH',
    'AR','AI','SG','GR','AG','TG','TI','VD','VS','NE','GE','JU'
  ))
);

CREATE INDEX idx_versicherer_bag_id ON versicherer(bag_id);
CREATE INDEX idx_versicherer_gruppe ON versicherer(gruppe);
CREATE INDEX idx_versicherer_aktiv ON versicherer(aktiv);
CREATE INDEX idx_versicherer_name ON versicherer(name);

COMMENT ON TABLE versicherer IS 'Versicherer-Stammdaten mit offiziellen BAG-IDs';
```

---

## 3. BAG-Prämiendaten

### 3.1 Haupttabelle

```sql
-- TABELLE: bag_praemien
CREATE TABLE IF NOT EXISTS bag_praemien (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Keys
  versicherer_id INTEGER NOT NULL REFERENCES versicherer(id),
  
  -- Geografie
  kanton TEXT NOT NULL REFERENCES ref_kantone(kanton_kurz),
  region TEXT REFERENCES ref_bag_regionen(region_code),
  plz_bereich TEXT,
  
  -- Zeit
  geschaeftsjahr INTEGER NOT NULL,
  gueltig_ab DATE NOT NULL,
  gueltig_bis DATE NOT NULL,
  
  -- Personen
  altersklasse TEXT NOT NULL CHECK (altersklasse IN ('kind', 'jugend', 'erwachsen')),
  alter_von INTEGER,
  alter_bis INTEGER,
  geschlecht TEXT CHECK (geschlecht IN ('m', 'w', 'alle')),
  
  -- Versicherung
  modell TEXT NOT NULL CHECK (modell IN ('standard', 'telmed', 'hausarzt', 'hmo', 'div')),
  tarifbezeichnung TEXT,
  franchise INTEGER NOT NULL CHECK (franchise >= 0 AND franchise <= 2500),
  unfall BOOLEAN DEFAULT false,
  
  -- Prämie
  praemie DECIMAL(10,2) NOT NULL CHECK (praemie > 0),
  
  -- Metadaten
  datenquelle TEXT DEFAULT 'BAG',
  importiert_am TIMESTAMPTZ DEFAULT NOW(),
  importiert_von TEXT,
  import_version_id UUID,
  aktiv BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique Constraint
  UNIQUE (versicherer_id, kanton, geschaeftsjahr, altersklasse, modell, franchise, unfall)
);

-- Performance-Indizes
CREATE INDEX idx_bag_versicherer ON bag_praemien(versicherer_id);
CREATE INDEX idx_bag_kanton ON bag_praemien(kanton);
CREATE INDEX idx_bag_jahr ON bag_praemien(geschaeftsjahr);
CREATE INDEX idx_bag_altersklasse ON bag_praemien(altersklasse);
CREATE INDEX idx_bag_modell ON bag_praemien(modell);
CREATE INDEX idx_bag_franchise ON bag_praemien(franchise);
CREATE INDEX idx_bag_unfall ON bag_praemien(unfall);
CREATE INDEX idx_bag_aktiv ON bag_praemien(aktiv);

-- Composite-Indizes für Hauptabfragen
CREATE INDEX idx_bag_query_full 
  ON bag_praemien(kanton, geschaeftsjahr, altersklasse, modell, franchise, unfall, praemie);

CREATE INDEX idx_bag_query_kanton_jahr 
  ON bag_praemien(kanton, geschaeftsjahr, aktiv);

CREATE INDEX idx_bag_praemie_lookup 
  ON bag_praemien(versicherer_id, modell, franchise, kanton, geschaeftsjahr);

-- Partial Index für aktuelles Jahr
CREATE INDEX idx_bag_current_year 
  ON bag_praemien(kanton, versicherer_id, modell, franchise, praemie)
  WHERE geschaeftsjahr = 2026 AND aktiv = true;

COMMENT ON TABLE bag_praemien IS 'Offizielle BAG-Prämiendaten (217'472+ Records)';
```

---

## 4. Import-Management

### 4.1 Versionen

```sql
-- TABELLE: bag_import_versions
CREATE TABLE IF NOT EXISTS bag_import_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  versionsnummer INTEGER NOT NULL,
  geschaeftsjahr INTEGER NOT NULL,
  import_datei_name TEXT NOT NULL,
  import_datei_hash TEXT,
  import_datei_groesse_bytes BIGINT,
  anzahl_records_gesamt INTEGER NOT NULL,
  anzahl_records_neu INTEGER DEFAULT 0,
  anzahl_records_aktualisiert INTEGER DEFAULT 0,
  anzahl_records_unveraendert INTEGER DEFAULT 0,
  aenderungen_summary JSONB,
  importiert_von TEXT NOT NULL,
  importiert_am TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'completed',
  rollback_version_id UUID REFERENCES bag_import_versions(id),
  validiert BOOLEAN DEFAULT false,
  validiert_am TIMESTAMPTZ,
  validiert_von TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bag_import_versions_jahr ON bag_import_versions(geschaeftsjahr);
CREATE INDEX idx_bag_import_versions_status ON bag_import_versions(status);
```

### 4.2 Fehler

```sql
-- TABELLE: bag_import_errors
CREATE TABLE IF NOT EXISTS bag_import_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_version_id UUID NOT NULL REFERENCES bag_import_versions(id),
  fehler_typ TEXT NOT NULL,
  fehler_schwere TEXT DEFAULT 'error',
  row_number INTEGER,
  raw_data JSONB,
  fehlermeldung TEXT NOT NULL,
  feld_name TEXT,
  feld_wert TEXT,
  expected_value TEXT,
  loesung_vorschlag TEXT,
  manuell_korrigiert BOOLEAN DEFAULT false,
  manuell_korrigiert_von TEXT,
  manuell_korrigiert_am TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bag_import_errors_version ON bag_import_errors(import_version_id);
CREATE INDEX idx_bag_import_errors_typ ON bag_import_errors(fehler_typ);
```

---

## 5. CRM-Kunden

### 5.1 Leads

```sql
-- TABELLE: leads
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vorname TEXT NOT NULL,
  nachname TEXT NOT NULL,
  email TEXT,
  telefon TEXT,
  mobil TEXT,
  strasse TEXT,
  plz TEXT,
  ort TEXT,
  kanton TEXT REFERENCES ref_kantone(kanton_kurz),
  quelle TEXT,
  kampagne TEXT,
  status TEXT DEFAULT 'neu',
  lead_score INTEGER,
  advisor_id UUID,
  organization_id UUID NOT NULL,
  converted_to_kunde BOOLEAN DEFAULT false,
  kunde_id UUID,
  converted_at TIMESTAMPTZ,
  converted_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_advisor ON leads(advisor_id);
CREATE INDEX idx_leads_quelle ON leads(quelle);
```

### 5.2 Kunden

```sql
-- TABELLE: kunden
CREATE TABLE IF NOT EXISTS kunden (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kundennummer TEXT UNIQUE NOT NULL,
  vorname TEXT NOT NULL,
  nachname TEXT NOT NULL,
  email TEXT,
  telefon TEXT,
  mobil TEXT,
  strasse TEXT,
  plz TEXT,
  ort TEXT,
  kanton TEXT REFERENCES ref_kantone(kanton_kurz),
  geburtsdatum DATE,
  geschlecht TEXT CHECK (geschlecht IN ('m', 'w')),
  zivilstand TEXT,
  ist_haushaltsvorstand BOOLEAN DEFAULT true,
  primary_kunde_id UUID,
  familien_role TEXT CHECK (familien_role IN ('primary', 'spouse', 'child', 'parent', 'other')),
  organization_id UUID NOT NULL,
  advisor_id UUID,
  mandats_status TEXT CHECK (mandats_status IN ('valid', 'invalid', 'pending', 'expired')),
  mandats_datum DATE,
  portal_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT NOT NULL,
  archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  archived_by TEXT
);

CREATE INDEX idx_kunden_organization ON kunden(organization_id);
CREATE INDEX idx_kunden_advisor ON kunden(advisor_id);
CREATE INDEX idx_kunden_household ON kunden(primary_kunde_id);
CREATE INDEX idx_kunden_email ON kunden(email);
CREATE INDEX idx_kunden_plz ON kunden(plz);
CREATE INDEX idx_kunden_archived ON kunden(archived);
```

---

## 6. CRM-Verträge

### 6.1 Verträge

```sql
-- TABELLE: vertraege
CREATE TABLE IF NOT EXISTS vertraege (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kunde_id UUID NOT NULL REFERENCES kunden(id),
  primary_kunde_id UUID REFERENCES kunden(id),
  ist_familienmitglied BOOLEAN DEFAULT false,
  versicherer_id INTEGER REFERENCES versicherer(id),
  sparte TEXT NOT NULL,
  produkt_name TEXT,
  police_nummer TEXT,
  praemie_monatlich DECIMAL(10,2),
  praemie_jaehrlich DECIMAL(10,2),
  waehrung TEXT DEFAULT 'CHF',
  start_date DATE NOT NULL,
  end_date DATE,
  kuendigungsfrist_monate INTEGER,
  auto_verlaengerung BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'active',
  kuendigungsdatum DATE,
  kuendigungsgrund TEXT,
  bag_praemie_id UUID REFERENCES bag_praemien(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT NOT NULL,
  archived BOOLEAN DEFAULT false
);

CREATE INDEX idx_vertraege_kunde ON vertraege(kunde_id);
CREATE INDEX idx_vertraege_versicherer ON vertraege(versicherer_id);
CREATE INDEX idx_vertraege_sparte ON vertraege(sparte);
CREATE INDEX idx_vertraege_status ON vertraege(status);
CREATE INDEX idx_vertraege_start ON vertraege(start_date);
CREATE INDEX idx_vertraege_end ON vertraege(end_date);
```

### 6.2 Provisionen

```sql
-- TABELLE: provisionen
CREATE TABLE IF NOT EXISTS provisionen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertrag_id UUID REFERENCES vertraege(id),
  provisionsatz DECIMAL(5,2),
  provisions_betrag DECIMAL(10,2),
  waehrung TEXT DEFAULT 'CHF',
  abrechnungs_monat INTEGER CHECK (abrechnungs_monat BETWEEN 1 AND 12),
  abrechnungsjahr INTEGER,
  status TEXT DEFAULT 'offen',
  storno_grund TEXT,
  ausgezahlt_am DATE,
  auszahlungs_referenz TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT NOT NULL
);

CREATE INDEX idx_provisionen_vertrag ON provisionen(vertrag_id);
CREATE INDEX idx_provisionen_status ON provisionen(status);
CREATE INDEX idx_provisionen_periode ON provisionen(abrechnungsjahr, abrechnungs_monat);
```

---

## 7. CRM-Operationen

(Wird fortgesetzt - Datei ist sehr gross. Ich erstelle separate Files für die restlichen Kapitel.)

```sql
-- Weitere Tabellen: aufgaben, schadenfaelle, beratungsprotokolle, dokumente
-- Siehe: docs/SQL_SCHEMA_CRM_OPERATIONS.sql
```

---

## 8. Vergleiche & Offerten

(Wird fortgesetzt - siehe separate Files.)

---

## 9. Zusatzversicherungen

(Wird fortgesetzt - siehe separate Files.)

---

## 10. Audit & Logging

(Wird fortgesetzt - siehe separate Files.)

---

## 11. Row Level Security

(Wird fortgesetzt - siehe separate Files.)

---

## 12. Stored Procedures

(Wird fortgesetzt - siehe separate Files.)

---

## 13. SEED-Daten

(Wird fortgesetzt - siehe separate Files.)

---

## Ausführung

**Reihenfolge:**

1. `ref_kantone`, `ref_bag_regionen`, `ref_plz` (Referenzen zuerst)
2. `versicherer` (Stammdaten)
3. `bag_praemien` (Hauptdaten)
4. `bag_import_versions`, `bag_import_errors` (Import-Management)
5. `kunden`, `leads` (CRM)
6. `vertraege`, `provisionen` (Verträge)
7. Weitere CRM-Tabellen
8. RLS-Policies
9. Stored Procedures
10. SEED-Daten

**Befehl:**

```bash
psql -h db.xxx.supabase.co -U postgres -d postgres -f SQL_SCHEMA_COMPLETE.sql
```

---

**Fortsetzung in separaten Dateien:**

- `docs/SQL_SCHEMA_CRM_OPERATIONS.sql` (aufgaben, schadenfaelle, etc.)
- `docs/SQL_SCHEMA_VERSICHERUNGEN.sql` (zusatzversicherungen)
- `docs/SQL_SCHEMA_AUDIT.sql` (audit_logs, import_logs)
- `docs/SQL_RLS_POLICIES.sql` (Row Level Security)
- `docs/SQL_STORED_PROCEDURES.sql` (Functions, Views)
- `docs/SQL_SEED_DATA.sql` (Versicherer, Kantone, PLZ)