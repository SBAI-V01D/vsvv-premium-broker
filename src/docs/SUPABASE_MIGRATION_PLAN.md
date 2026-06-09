# VSVV CRM - Supabase Migrationsplan & Datenmodell

## Executive Summary

**Ziel:** Migration des Krankenkassenvergleichs und Aufbau eines skalierbaren CRM-Systems auf Supabase.

**Architektur:**
- **Base44** = Frontend, UI, Business-Logic, Authentication
- **Supabase** = Zentrale relationale Datenbank für alle CRM-Daten
- **BAG-Daten** = 217'472 vollständige Datensätze ohne Verluste

---

## 1. Technische Analyse bestehende Lösung

### 1.1 Aktuelle Komponenten

| Komponente | Technologie | Status | Migration |
|---|---|---|---|
| BAGDatenImport.jsx | Client-side Excel-Parsing | ✅ Perfekt | **Behalten** |
| KrankenkassenVergleich.jsx | Business-Logic | ✅ Perfekt | **Behalten** |
| BAGPraemienDaten Entity | Base44 Entity | ❌ Limitiert | **Durch Supabase ersetzen** |
| Vergleichslogik | Client-side Berechnung | ✅ Schnell | **Behalten** |

### 1.2 Aktuelle Probleme

1. **Rate Limiting:** Base44 API limitiert bei 25-100 Records/Batch
2. **Performance:** 217'472 Records → ~8'700 API-Calls = Stunden
3. **Datenverluste:** Unbekannte IDs, TAR-DIV, Altersklassen werden gefiltert
4. **Skalierung:** Nicht für Zusatzversicherungen, Offerten, etc. erweiterbar

---

## 2. Zielarchitektur - Supabase Datenmodell

### 2.1 Datenbank-Schema (Vollständig)

```sql
-- ============================================================================
-- VSVV CRM - Supabase Schema v1.0
-- ============================================================================

-- ============================================================================
-- CORE: Versicherer & BAG-Daten
-- ============================================================================

-- Tabelle: Versicherer (stammdaten)
CREATE TABLE versicherer (
  id SERIAL PRIMARY KEY,
  bag_id INTEGER UNIQUE, -- Offizielle BAG-ID (z.B. 8, 1068, 1542)
  name TEXT NOT NULL, -- Offizieller Name (z.B. "CSS", "Helsana")
  kurzname TEXT, -- Kurzform für UI
  gruppe TEXT, -- "CSS Gruppe", "Helsana Gruppe", etc.
  logo_url TEXT,
  aktiv BOOLEAN DEFAULT true,
  kontakt_email TEXT,
  kontakt_telefon TEXT,
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabelle: BAG-Prämien (Haupttabelle - 217'472 Records)
CREATE TABLE bag_praemien (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Versicherer
  versicherer_id INTEGER NOT NULL REFERENCES versicherer(id),
  
  -- Geografie
  kanton TEXT NOT NULL, -- 2-stellig (ZH, BE, LU, etc.)
  region TEXT, -- Prämieregion (1, 2, 3)
  plz_bereich TEXT, -- PLZ-Range für Region-Mapping
  
  -- Zeit
  geschaeftsjahr INTEGER NOT NULL, -- 2026, 2027, etc.
  gueltig_ab DATE,
  gueltig_bis DATE,
  
  -- Personen
  altersklasse TEXT NOT NULL, -- 'kind', 'jugend', 'erwachsen'
  alter_von INTEGER,
  alter_bis INTEGER,
  geschlecht TEXT, -- 'm', 'w', 'alle'
  
  -- Versicherung
  modell TEXT NOT NULL, -- 'standard', 'telmed', 'hausarzt', 'hmo'
  tarifbezeichnung TEXT, -- Original BAG-Code (TAR-STD, TAR-HAM, etc.)
  franchise INTEGER NOT NULL, -- CHF-Betrag (0, 100, 200, ..., 2500)
  unfall BOOLEAN DEFAULT false, -- true = MIT-UNF, false = OHNE-UNF
  
  -- Prämie
  praemie DECIMAL(10,2) NOT NULL, -- Monatsprämie in CHF
  
  -- Metadaten
  datenquelle TEXT DEFAULT 'BAG',
  importiert_am TIMESTAMPTZ DEFAULT NOW(),
  importiert_von TEXT, -- User-Email
  aktiv BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CORE: Indizes für Performance (<1s Abfragen)
-- ============================================================================

-- Einzel-Indizes
CREATE INDEX idx_bag_versicherer ON bag_praemien(versicherer_id);
CREATE INDEX idx_bag_kanton ON bag_praemien(kanton);
CREATE INDEX idx_bag_region ON bag_praemien(region);
CREATE INDEX idx_bag_jahr ON bag_praemien(geschaeftsjahr);
CREATE INDEX idx_bag_altersklasse ON bag_praemien(altersklasse);
CREATE INDEX idx_bag_modell ON bag_praemien(modell);
CREATE INDEX idx_bag_franchise ON bag_praemien(franchise);
CREATE INDEX idx_bag_unfall ON bag_praemien(unfall);
CREATE INDEX idx_bag_aktiv ON bag_praemien(aktiv);

-- Composite-Indizes für typische Abfragen
CREATE INDEX idx_bag_query_kanton_jahr 
  ON bag_praemien(kanton, geschaeftsjahr, aktiv);

CREATE INDEX idx_bag_query_full 
  ON bag_praemien(kanton, geschaeftsjahr, altersklasse, modell, franchise, unfall);

CREATE INDEX idx_bag_praemie_lookup 
  ON bag_praemien(versicherer_id, modell, franchise, kanton, geschaeftsjahr);

-- ============================================================================
-- CRM: Kunden & Haushalts-Management
-- ============================================================================

CREATE TABLE kunden (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kundennummer TEXT UNIQUE,
  
  -- Stammdaten
  vorname TEXT NOT NULL,
  nachname TEXT NOT NULL,
  email TEXT,
  telefon TEXT,
  mobil TEXT,
  
  -- Adresse
  strasse TEXT,
  plz TEXT,
  ort TEXT,
  kanton TEXT,
  
  -- Demografie
  geburtsdatum DATE,
  geschlecht TEXT,
  zivilstand TEXT, -- 'single', 'verheiratet', 'geschieden', 'verwitwet'
  
  -- Haushalt
  ist_haushaltsvorstand BOOLEAN DEFAULT true,
  primary_kunde_id UUID REFERENCES kunden(id), -- Verweis auf Haushaltsvorstand
  familien_role TEXT, -- 'primary', 'spouse', 'child', 'parent'
  
  -- Organisation
  organization_id UUID NOT NULL,
  advisor_id UUID, -- Zugewiesener Berater
  
  -- Status
  mandats_status TEXT, -- 'valid', 'invalid', 'pending', 'expired'
  mandats_datum DATE,
  portal_enabled BOOLEAN DEFAULT false,
  
  -- Metadaten
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  archived BOOLEAN DEFAULT false
);

CREATE INDEX idx_kunden_organization ON kunden(organization_id);
CREATE INDEX idx_kunden_advisor ON kunden(advisor_id);
CREATE INDEX idx_kunden_household ON kunden(primary_kunde_id);
CREATE INDEX idx_kunden_email ON kunden(email);

-- ============================================================================
-- CRM: Verträge & Policen
-- ============================================================================

CREATE TABLE vertraege (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Kunden-Bezug
  kunde_id UUID NOT NULL REFERENCES kunden(id),
  primary_kunde_id UUID REFERENCES kunden(id), -- Haushaltsvorstand
  ist_familienmitglied BOOLEAN DEFAULT false,
  
  -- Versicherung
  versicherer_id INTEGER REFERENCES versicherer(id),
  sparte TEXT NOT NULL, -- 'krankenkasse', 'leben', 'auto', 'hausrat', etc.
  produkt_name TEXT,
  police_nummer TEXT,
  
  -- Prämien
  praemie_monatlich DECIMAL(10,2),
  praemie_jaehrlich DECIMAL(10,2),
  waehrung TEXT DEFAULT 'CHF',
  
  -- Laufzeit
  start_date DATE NOT NULL,
  end_date DATE,
  kuendigungsfrist_monate INTEGER,
  auto_verlaengerung BOOLEAN DEFAULT true,
  
  -- Status
  status TEXT DEFAULT 'active', -- 'active', 'pending', 'cancelled', 'expired'
  kuendigungsdatum DATE,
  kuendigungsgrund TEXT,
  
  -- BAG-Daten-Bezug (für Krankenkassen)
  bag_praemie_id UUID REFERENCES bag_praemien(id), -- Link zur BAG-Prämie
  
  -- Metadaten
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  archived BOOLEAN DEFAULT false
);

CREATE INDEX idx_vertraege_kunde ON vertraege(kunde_id);
CREATE INDEX idx_vertraege_versicherer ON vertraege(versicherer_id);
CREATE INDEX idx_vertraege_sparte ON vertraege(sparte);
CREATE INDEX idx_vertraege_status ON vertraege(status);

-- ============================================================================
-- CRM: Krankenkassen-Vergleiche (Audit-Trail)
-- ============================================================================

CREATE TABLE kk_vergleiche (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Kunden-Bezug
  kunde_id UUID REFERENCES kunden(id),
  customer_name TEXT NOT NULL,
  
  -- Berater
  advisor_id UUID NOT NULL,
  advisor_name TEXT,
  organization_id UUID NOT NULL,
  
  -- Vergleichsdatum
  vergleichsdatum TIMESTAMPTZ DEFAULT NOW(),
  
  -- Eingabedaten (Snapshot)
  persoenliche_daten JSONB, -- {vorname, nachname, geburtsdatum, wohnort, plz, kanton, geschlecht}
  aktuelle_versicherung JSONB, -- {krankenkasse, modell, franchise, unfall}
  vergleichsoptionen JSONB, -- Filter-Einstellungen
  
  -- Ergebnisse (Snapshot)
  vergleichsergebnisse JSONB, -- Array aller Vergleichsresultate
  ki_analyse JSONB, -- KI-Empfehlungen
  
  -- Status
  status TEXT DEFAULT 'durchgefuehrt', -- 'entwurf', 'durchgefuehrt', 'gespeichert', 'praesentiert'
  pdf_url TEXT,
  
  -- Metadaten
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kk_vergleiche_kunde ON kk_vergleiche(kunde_id);
CREATE INDEX idx_kk_vergleiche_advisor ON kk_vergleiche(advisor_id);
CREATE INDEX idx_kk_vergleiche_datum ON kk_vergleiche(vergleichsdatum);

-- ============================================================================
-- CRM: Offerten & Ausschreibungen (Erweiterbar)
-- ============================================================================

CREATE TABLE offerten (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Kunde
  kunde_id UUID NOT NULL REFERENCES kunden(id),
  
  -- Typ
  sparte TEXT NOT NULL, -- 'krankenkasse', 'leben', 'auto', etc.
  offert_typ TEXT, -- 'neu', 'verlaengerung', 'wechsel'
  
  -- Versicherer
  versicherer_id INTEGER REFERENCES versicherer(id),
  
  -- Offert-Daten
  praemie_monatlich DECIMAL(10,2),
  praemie_jaehrlich DECIMAL(10,2),
  deckung_summe DECIMAL(12,2),
  selbstbehalt DECIMAL(10,2),
  laufzeit_monate INTEGER,
  
  -- Status
  status TEXT DEFAULT 'ausstehend', -- 'ausstehend', 'erhalten', 'analysiert', 'empfohlen', 'angenommen', 'abgelehnt'
  erstelltdatum DATE DEFAULT CURRENT_DATE,
  gueltig_bis DATE,
  
  -- Entscheidung
  angenommen_am DATE,
  abgelehnt_am DATE,
  ablehnungsgrund TEXT,
  
  -- Dokumente
  dokument_url TEXT,
  
  -- Metadaten
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX idx_offerten_kunde ON offerten(kunde_id);
CREATE INDEX idx_offerten_versicherer ON offerten(versicherer_id);
CREATE INDEX idx_offerten_sparte ON offerten(sparte);
CREATE INDEX idx_offerten_status ON offerten(status);

-- ============================================================================
-- CRM: Provisionen & Courtagen
-- ============================================================================

CREATE TABLE provisionen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Vertrag
  vertrag_id UUID REFERENCES vertraege(id),
  
  -- Finanzdaten
  provisionsatz DECIMAL(5,2), -- Prozent
  provisions_betrag DECIMAL(10,2), -- CHF
  waehrung TEXT DEFAULT 'CHF',
  
  -- Periode
  abrechnungs_monat INTEGER, -- 1-12
  abrechnungs_jahr INTEGER,
  
  -- Status
  status TEXT DEFAULT 'offen', -- 'offen', 'berechnet', 'ausgezahlt', 'storniert'
  storno_grund TEXT,
  
  -- Auszahlung
  ausgezahlt_am DATE,
  auszahlungs_referenz TEXT,
  
  -- Metadaten
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX idx_provisionen_vertrag ON provisionen(vertrag_id);
CREATE INDEX idx_provisionen_status ON provisionen(status);
CREATE INDEX idx_provisionen_periode ON provisionen(abrechnungs_jahr, abrechnungs_monat);

-- ============================================================================
-- CRM: Beratungsprotokolle & Interaktionen
-- ============================================================================

CREATE TABLE beratungsprotokolle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Kunde
  kunde_id UUID NOT NULL REFERENCES kunden(id),
  
  -- Typ
  protokoll_typ TEXT, -- 'beratung', 'telefonat', 'email', 'meeting'
  thema TEXT,
  
  -- Inhalt
  zusammenfassung TEXT,
  empfehlungen TEXT,
  naechste_schritte TEXT,
  
  -- Dokumente
  dokument_urls JSONB, -- Array von URLs
  
  -- Metadaten
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT, -- Berater-Email
  organization_id UUID NOT NULL
);

CREATE INDEX idx_beratung_kunde ON beratungsprotokolle(kunde_id);
CREATE INDEX idx_beratung_typ ON beratungsprotokolle(protokoll_typ);
CREATE INDEX idx_beratung_datum ON beratungsprotokolle(created_at);

-- ============================================================================
-- SYSTEM: Import-Logs & Audit-Trail
-- ============================================================================

CREATE TABLE import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Import-Info
  import_typ TEXT NOT NULL, -- 'bag_praemien', 'kunden', 'vertraege', etc.
  datei_name TEXT,
  datei_groesse_bytes INTEGER,
  
  -- Statistik
  anzahl_gesamt INTEGER,
  anzahl_erfolgreich INTEGER,
  anzahl_fehler INTEGER,
  
  -- Fehler
  fehler_details JSONB, -- Array von Fehlermeldungen
  
  -- User
  importiert_von TEXT NOT NULL, -- Email
  importiert_am TIMESTAMPTZ DEFAULT NOW(),
  
  -- Status
  status TEXT DEFAULT 'completed' -- 'running', 'completed', 'failed'
);

CREATE INDEX idx_import_logs_typ ON import_logs(import_typ);
CREATE INDEX idx_import_logs_datum ON import_logs(importiert_am);

-- ============================================================================
-- SYSTEM: RLS Policies (Row Level Security)
-- ============================================================================

-- Hinweis: RLS wird in Supabase aktiviert mit:
-- ALTER TABLE kunden ENABLE ROW LEVEL SECURITY;
-- etc.

-- Beispiel-Policies (müssen an Base44 Auth angepasst werden):
-- CREATE POLICY "Organization isolation" ON kunden
--   FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- ============================================================================
-- SYSTEM: Functions & Stored Procedures
-- ============================================================================

-- Function: BAG-Prämien abfragen (performant)
CREATE OR REPLACE FUNCTION query_bag_praemien(
  p_kanton TEXT,
  p_jahr INTEGER,
  p_altersklasse TEXT DEFAULT NULL,
  p_modell TEXT DEFAULT NULL,
  p_franchise INTEGER DEFAULT NULL,
  p_unfall BOOLEAN DEFAULT false
)
RETURNS TABLE (
  versicherer_name TEXT,
  modell TEXT,
  franchise INTEGER,
  praemie DECIMAL,
  tarifbezeichnung TEXT,
  kanton TEXT,
  region TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.name AS versicherer_name,
    bp.modell,
    bp.franchise,
    bp.praemie,
    bp.tarifbezeichnung,
    bp.kanton,
    bp.region
  FROM bag_praemien bp
  JOIN versicherer v ON bp.versicherer_id = v.id
  WHERE bp.kanton = p_kanton
    AND bp.geschaeftsjahr = p_jahr
    AND bp.aktiv = true
    AND (p_altersklasse IS NULL OR bp.altersklasse = p_altersklasse)
    AND (p_modell IS NULL OR bp.modell = p_modell)
    AND (p_franchise IS NULL OR bp.franchise = p_franchise)
    AND bp.unfall = p_unfall
  ORDER BY bp.praemie ASC;
END;
$$;

-- Function: Import-Statistik
CREATE OR REPLACE FUNCTION get_import_stats()
RETURNS TABLE (
  import_typ TEXT,
  anzahl_importe BIGINT,
  letzte_import TIMESTAMPTZ,
  gesamt_records BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    il.import_typ,
    COUNT(*)::BIGINT AS anzahl_importe,
    MAX(il.importiert_am) AS letzte_import,
    SUM(il.anzahl_erfolgreich)::BIGINT AS gesamt_records
  FROM import_logs il
  GROUP BY il.import_typ
  ORDER BY letzte_import DESC;
END;
$$;

-- ============================================================================
-- SEED DATA: Versicherer (vollständige BAG-Liste)
-- ============================================================================

-- Beispiel-Daten (muss mit vollständiger Liste gefüllt werden)
INSERT INTO versicherer (bag_id, name, kurzname, gruppe) VALUES
  (8, 'CSS', 'CSS', 'CSS Gruppe'),
  (1068, 'CSS', 'CSS', 'CSS Gruppe'),
  (1535, 'CSS', 'CSS', 'CSS Gruppe'),
  (1064, 'Helsana', 'Helsana', 'Helsana Gruppe'),
  (1562, 'Helsana', 'Helsana', 'Helsana Gruppe'),
  (1509, 'Sanitas', 'Sanitas', 'Helsana Gruppe'),
  (1384, 'Swica', 'Swica', 'Swica Gruppe'),
  (1066, 'Visana', 'Visana', 'Visana Gruppe'),
  (1386, 'Galenos', 'Galenos', 'Visana Gruppe'),
  (1065, 'KPT', 'KPT', 'KPT Gruppe'),
  (1118, 'Concordia', 'Concordia', 'Concordia Gruppe'),
  (1563, 'Groupe Mutuel', 'GM', 'Groupe Mutuel'),
  (1021, 'Atupri', 'Atupri', 'Atupri'),
  (1019, 'Assura', 'Assura', 'Assura'),
  (1542, 'Assura-Basis', 'Assura-Basis', 'Assura'),
  (1024, 'ÖKK', 'ÖKK', 'ÖKK'),
  (1016, 'Agrisano', 'Agrisano', 'Agrisano'),
  (1560, 'Agrisano', 'Agrisano', 'Agrisano'),
  (1097, 'Sympany', 'Sympany', 'Sympany'),
  (1048, 'EGK', 'EGK', 'EGK'),
  (1096, 'Sana24', 'Sana24', 'Sana24'),
  (1568, 'Sana24', 'Sana24', 'Sana24'),
  (1017, 'bkk mobilise', 'bkk', 'bkk'),
  (1007, 'Aquilana', 'Aquilana', 'Aquilana'),
  (1111, 'SUPRA', 'SUPRA', 'SUPRA'),
  (1112, 'Sumiswalder', 'Sumiswalder', 'Sumiswalder'),
  (1110, 'Steffisburg', 'Steffisburg', 'Steffisburg'),
  (1322, 'Birchmeier', 'Birchmeier', 'Birchmeier'),
  (1507, 'AMB Assurances', 'AMB', 'AMB'),
  (923, 'SLKK', 'SLKK', 'SLKK'),
  (941, 'sodalis', 'sodalis', 'sodalis'),
  (780, 'Glarner', 'Glarner', 'Glarner'),
  (1401, 'rhenusana', 'rhenusana', 'rhenusana'),
  (966, 'vita surselva', 'vita surselva', 'vita surselva'),
  (360, 'Luzerner Hinterland', 'LH', 'Luzerner Hinterland'),
  (1318, 'Wädenswil', 'Wädenswil', 'Wädenswil'),
  (820, 'Lumneziana', 'Lumneziana', 'Lumneziana'),
  (134, 'Einsiedler', 'Einsiedler', 'Einsiedler'),
  (829, 'KLuG', 'KLuG', 'KLuG'),
  (901, 'sanavals', 'sanavals', 'sanavals'),
  (1040, 'Visperterminen', 'Visperterminen', 'Visperterminen');

-- ============================================================================
-- VIEW: Aktuelle BAG-Prämien (für einfache Abfragen)
-- ============================================================================

CREATE VIEW v_aktuelle_bag_praemien AS
SELECT 
  bp.*,
  v.name AS versicherer_name,
  v.gruppe AS versicherer_gruppe
FROM bag_praemien bp
JOIN versicherer v ON bp.versicherer_id = v.id
WHERE bp.aktiv = true
  AND bp.geschaeftsjahr = (SELECT MAX(geschaeftsjahr) FROM bag_praemien WHERE aktiv = true);

-- Grant access (muss an Base44 Auth angepasst werden)
-- GRANT SELECT ON v_aktuelle_bag_praemien TO authenticated;

-- ============================================================================
-- ENDE SCHEMA v1.0
-- ============================================================================
```

---

## 3. Migrationsplan - Schritt für Schritt

### **Phase 1: Supabase Setup (Tag 1)**

```
1.1 Supabase-Projekt erstellen/verbinden
1.2 SQL-Schema ausführen (alle Tabellen + Indizes)
1.3 RLS-Policies konfigurieren
1.4 Base44 Supabase-Connector autorisieren
```

### **Phase 2: Daten-Import (Tag 2-3)**

```
2.1 BAG-Excel-Datei client-side parsen (bestehende Logik)
2.2 Alle 217'472 Records validieren (KEINE Filterung!)
2.3 Bulk-Import via Supabase Function (COPY oder batch INSERT)
2.4 Qualitätskontrolle:
    - Total Records = 217'472 ✓
    - Alle Versicherer-IDs gemappt ✓
    - Alle Altersklassen (kind, jugend, erwachsen) ✓
    - Alle Tariftypen (inkl. TAR-DIV) ✓
    - Alle Franchisen (0-2500) ✓
```

### **Phase 3: Backend-Functions (Tag 4)**

```
Neue Base44 Functions:
- importBAGDatenToSupabase(payload: {records, jahr, user})
- queryBAGPraemien(payload: {kanton, jahr, altersklasse, modell, franchise, unfall})
- validateBAGImport(payload: {import_id})
- getBAGStatistik(payload: {})
```

### **Phase 4: Frontend-Integration (Tag 5)**

```
Minimale Änderungen:
- BAGDatenImport.jsx: bulkCreate → importBAGDatenToSupabase
- KrankenkassenVergleich.jsx: Entity.filter → queryBAGPraemien
- BAGDatenVerwaltung.jsx: Stats aus Supabase
```

### **Phase 5: Testing & Go-Live (Tag 6-7)**

```
5.1 Test-Szenarien:
    - Import 217'472 Records ✓
    - Abfrage <1s ✓
    - Vergleichslogik identisch ✓
    - PDF-Export funktioniert ✓
    
5.2 Rollback-Plan:
    - Base44 Entity bleibt parallel erhalten
    - Switch bei Problemen zurück auf Entity
```

---

## 4. Import-Workflow für zukünftige BAG-Updates

### **Jährlicher Prozess (September/Oktober)**

```
1. BAG veröffentlicht neue Excel-Datei
2. Admin lädt Datei in BAGDatenImport.jsx
3. Client-side Parsing (bestehende Logik)
4. Validierung:
   - Neue Versicherer? → versicherer-Tabelle updaten
   - Neue Tariftypen? → MODELL_MAP erweitern
   - Neue Franchisen? → FRANCHISE_AKRO_MAP erweitern
5. Bulk-Import via Function (217k+ Records)
6. Qualitätskontrolle via Dashboard
7. Old Year archival (aktiv=false setzen)
```

### **Import-Funktion (Backend)**

```javascript
// Pseudo-Code
async function importBAGDatenToSupabase({ records, jahr, user }) {
  // 1. Transaktion starten
  // 2. Records in Batches (1000) INSERT INTO bag_praemien
  // 3. Import-Log schreiben
  // 4. Statistik zurückgeben
  // 5. Bei Fehler: Rollback
}
```

---

## 5. API-Funktionen für Krankenkassenvergleich

### **5.1 Query-Funktion (Haupt-Endpoint)**

```javascript
// Base44 Function: queryBAGPraemien
export async function queryBAGPraemien(payload) {
  const { kanton, jahr, altersklasse, modell, franchise, unfall } = payload;
  
  // Supabase Query via Connector
  const result = await supabase
    .from('bag_praemien')
    .select(`
      *,
      versicherer:versicherer_id(name, gruppe)
    `)
    .eq('kanton', kanton)
    .eq('geschaeftsjahr', jahr)
    .eq('aktiv', true)
    .eq('unfall', unfall || false);
  
  // Optionale Filter
  if (altersklasse) result.eq('altersklasse', altersklasse);
  if (modell) result.eq('modell', modell);
  if (franchise) result.eq('franchise', franchise);
  
  // Order by Prämie
  result.order('praemie', { ascending: true });
  
  return { data: result.data, error: result.error };
}
```

### **5.2 Vergleichslogik (bleibt client-side)**

```javascript
// KrankenkassenVergleich.jsx - unverändert
const berechnePraemie = (kk, modell, franchise, kanton, bagDaten) => {
  // Bestehende Logik 1:1 übernehmen
  // ...
};
```

---

## 6. Zukünftige Erweiterungen

### **6.1 Zusatzversicherungen (Phase 2)**

```sql
CREATE TABLE zusatzversicherungen (
  id UUID PRIMARY KEY,
  versicherer_id INTEGER REFERENCES versicherer(id),
  produkt_name TEXT NOT NULL,
  sparte TEXT, -- 'spital', 'zahn', 'ambulant', 'naturheilkunde'
  praemie DECIMAL(10,2),
  deckung_summe DECIMAL(12,2),
  selbstbehalt DECIMAL(10,2),
  wartefrist_monate INTEGER,
  bedingungen JSONB,
  aktiv BOOLEAN DEFAULT true
);
```

### **6.2 Offertsystem (Phase 3)**

```sql
CREATE TABLE ausschreibungen (
  id UUID PRIMARY KEY,
  kunde_id UUID REFERENCES kunden(id),
  titel TEXT NOT NULL,
  sparten TEXT[], -- Array von Sparten
  status TEXT DEFAULT 'entwurf',
  fristdatum DATE,
  ausgewaehlte_versicherer JSONB, -- [{versicherer_id, status}]
  offerten_count INTEGER DEFAULT 0
);
```

### **6.3 Provisionsabrechnung (Phase 4)**

```sql
CREATE TABLE abrechnungen (
  id UUID PRIMARY KEY,
  periode TEXT, -- '2026-01'
  advisor_id UUID,
  total_provisionen DECIMAL(12,2),
  total_courtagen DECIMAL(12,2),
  status TEXT DEFAULT 'offen',
  auszahlung_datum DATE,
  beleg_urls JSONB
);
```

---

## 7. Benötigte Angaben für Supabase-Anbindung

### **7.1 Supabase-Zugangsdaten**

```
✓ Supabase Project URL: https://xxxxx.supabase.co
✓ Supabase Anon Key: eyJhbGc... (public, für Client)
✓ Supabase Service Role Key: eyJhbGc... (secret, für Backend-Functions)
  → Wird als Secret in Base44 gespeichert
```

### **7.2 Base44 Supabase-Connector**

```
Connector muss autorisiert werden mit:
- integration_type: "supabase"
- Scopes: Projects:Read, Database:Read, Secrets:Read
```

### **7.3 Secrets in Base44**

```
SUPABASE_URL = https://xxxxx.supabase.co
SUPABASE_ANON_KEY = eyJhbGc...
SUPABASE_SERVICE_KEY = eyJhbGc... (nur Backend)
```

---

## 8. Performance-Optimierungen

### **8.1 Query-Performance**

```
Ziel: <1s für typische Abfragen

Massnahmen:
✓ Composite-Indizes (kanton, jahr, altersklasse, modell, franchise)
✓ Materialized Views für häufige Aggregationen
✓ Connection-Pooling via Supabase
✓ Client-side Caching (React Query)
```

### **8.2 Import-Performance**

```
Ziel: 217'472 Records in <10 Minuten

Massnahmen:
✓ Supabase COPY Command (statt INSERT)
✓ Batches à 1000 Records
✓ Parallelisierung (4 Kantone gleichzeitig)
✓ Transaktionen pro Batch
```

---

## 9. Sicherheit & Compliance

### **9.1 Row Level Security (RLS)**

```sql
-- Organization-Isolation
ALTER TABLE kunden ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org-Isolation" ON kunden
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Advisor-Isolation
CREATE POLICY "Advisor-Access" ON vertraege
  FOR SELECT
  USING (
    created_by = current_setting('app.current_user_email')::text
    OR advisor_id = current_setting('app.current_user_id')::uuid
  );
```

### **9.2 Audit-Trail**

```
✓ Alle Änderungen werden geloggt (created_at, updated_at, created_by)
✓ Import-Logs für jede BAG-Import
✓ Vergleichs-Snapshots (JSONB) für Audit
```

---

## 10. Zusammenfassung & Nächste Schritte

### **Vorteile der Supabase-Migration**

| Aspekt | Vorher (Base44 Entity) | Nachher (Supabase) |
|---|---|---|
| **Records** | Limitiert (Rate-Limit) | Unlimited (217k+ kein Problem) |
| **Import-Zeit** | Stunden | <10 Minuten |
| **Query-Performance** | Sekunden | <1 Sekunde |
| **Datenverluste** | Ja (Filterung) | Nein (100% vollständig) |
| **Skalierung** | Limitiert | Unlimited (CRM, Offerten, Provisionen) |
| **Erweiterbarkeit** | Nein | Ja (Zusatzversicherungen, etc.) |

### **Nächste Schritte**

1. **Bestätige Migrationsplan** → Du hast ihn gerade gelesen ✅
2. **Supabase-Zugangsdaten bereitstellen** → Project URL + Keys
3. **Supabase-Connector autorisieren** → Ich erstelle OAuth-Request
4. **SQL-Schema ausführen** → Ich liefere SQL-File
5. **Backend-Functions erstellen** → 4 neue Functions
6. **Frontend anpassen** → Minimale Änderungen
7. **Test-Import** → 217'472 Records validieren
8. **Go-Live** → Switch auf Supabase

---

**Bereit für die Migration?** 

Bitte bestätige und stelle die Supabase-Zugangsdaten bereit, dann lege ich sofort los! 🚀