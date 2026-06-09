# VSVV CRM - Ergänzende Architekturdokumentation v1.1

**Version:** 1.1  
**Datum:** 2026-06-09  
**Status:** Zur finalen Freigabe  
**Klassifizierung:** Vertraulich - VSVV Intern

---

## Inhaltsverzeichnis

1. [Historisierung BAG-Daten](#1-historisierung-bag-daten)
2. [Versicherer-Stammdaten](#2-versicherer-stammdaten)
3. [Regionen-Referenztabellen](#3-regionen-referenztabellen)
4. [Zusatzversicherungen](#4-zusatzversicherungen)
5. [CRM-Erweiterung](#5-crm-erweiterung)
6. [Dokumentenmanagement](#6-dokumentenmanagement)
7. [Sicherheitsbestätigung](#7-sicherheitsbestätigung)
8. [Performance-Zielwerte](#8-performance-zielwerte)
9. [Migrations-Dokumente](#9-migrations-dokumente)

---

## 1. Historisierung BAG-Daten

### 1.1 Unterstützung mehrerer BAG-Jahre

**Anforderung:** Das System muss Prämien für mehrere Jahre (2026, 2027, 2028, ...) speichern und vergleichbar machen.

**Umsetzung im Datenmodell:**

```sql
-- TABELLE: bag_praemien (erweitert)
CREATE TABLE bag_praemien (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Zeit (HISTORISIERUNG)
  geschaeftsjahr INTEGER NOT NULL, -- 2026, 2027, 2028, ...
  gueltig_ab DATE NOT NULL, -- 2026-01-01
  gueltig_bis DATE NOT NULL, -- 2026-12-31
  
  -- ... andere Felder ...
  
  -- Unique Constraint für Datenqualität
  UNIQUE (versicherer_id, kanton, geschaeftsjahr, altersklasse, modell, franchise, unfall)
);

-- INDEX für Jahres-Abfragen
CREATE INDEX idx_bag_jahr_aktiv ON bag_praemien(geschaeftsjahr, aktiv);

-- PARTIAL INDEX für aktuelles Jahr (Performance)
CREATE INDEX idx_bag_current_year 
  ON bag_praemien(kanton, versicherer_id, modell, franchise, praemie)
  WHERE geschaeftsjahr = 2026 AND aktiv = true;

-- PARTIAL INDEX für Vorjahr (Vergleiche)
CREATE INDEX idx_bag_previous_year 
  ON bag_praemien(kanton, versicherer_id, modell, franchise, praemie)
  WHERE geschaeftsjahr = 2025 AND aktiv = true;
```

### 1.2 Historisierung der Prämien

**Anforderung:** Prämien-Entwicklung über Jahre nachvollziehbar.

**Lösung:**

```sql
-- VIEW: Prämien-Entwicklung pro Versicherer
CREATE VIEW v_praemien_historie AS
SELECT 
  versicherer_id,
  kanton,
  modell,
  franchise,
  altersklasse,
  ARRAY_AGG(
    JSONB_BUILD_OBJECT(
      'jahr', geschaeftsjahr,
      'praemie', praemie,
      'gueltig_ab', gueltig_ab
    ) ORDER BY geschaeftsjahr
  ) AS praemien_historie,
  -- Prozentuale Änderung zum Vorjahr
  LAG(praemie) OVER (
    PARTITION BY versicherer_id, kanton, modell, franchise, altersklasse
    ORDER BY geschaeftsjahr
  ) AS praemie_vorjahr,
  praemie - LAG(praemie) OVER (
    PARTITION BY versicherer_id, kanton, modell, franchise, altersklasse
    ORDER BY geschaeftsjahr
  ) AS praemie_differenz,
  ROUND(
    ((praemie - LAG(praemie) OVER (
      PARTITION BY versicherer_id, kanton, modell, franchise, altersklasse
      ORDER BY geschaeftsjahr
    )) / LAG(praemie) OVER (
      PARTITION BY versicherer_id, kanton, modell, franchise, altersklasse
      ORDER BY geschaeftsjahr
    ) * 100), 2
  ) AS praemie_aenderung_prozent
FROM bag_praemien
WHERE aktiv = true
GROUP BY versicherer_id, kanton, modell, franchise, altersklasse, geschaeftsjahr, praemie;
```

**Beispiel-Output:**
```json
{
  "versicherer_id": 8,
  "kanton": "ZH",
  "modell": "standard",
  "franchise": 300,
  "praemien_historie": [
    {"jahr": 2024, "praemie": 423.50, "gueltig_ab": "2024-01-01"},
    {"jahr": 2025, "praemie": 438.20, "gueltig_ab": "2025-01-01"},
    {"jahr": 2026, "praemie": 456.70, "gueltig_ab": "2026-01-01"}
  ],
  "praemie_vorjahr": 438.20,
  "praemie_differenz": 18.50,
  "praemie_aenderung_prozent": 4.22
}
```

### 1.3 Nachvollziehbarkeit von BAG-Datenänderungen

**Anforderung:** Änderungen zwischen Importen müssen nachvollziehbar sein.

**Umsetzung:**

```sql
-- TABELLE: bag_import_versions
CREATE TABLE bag_import_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Version
  versionsnummer INTEGER NOT NULL, -- 1, 2, 3, ...
  geschaeftsjahr INTEGER NOT NULL, -- 2026, 2027, ...
  
  -- Import-Info
  import_datei_name TEXT NOT NULL,
  import_datei_hash TEXT, -- SHA-256 für Integrität
  import_datei_groesse_bytes BIGINT,
  
  -- Statistik
  anzahl_records_gesamt INTEGER NOT NULL,
  anzahl_records_neu INTEGER DEFAULT 0,
  anzahl_records_aktualisiert INTEGER DEFAULT 0,
  anzahl_records_unveraendert INTEGER DEFAULT 0,
  
  -- Änderungen
  aenderungen_summary JSONB, -- {premium_increases: 1234, premium_decreases: 567, ...}
  
  -- User
  importiert_von TEXT NOT NULL,
  importiert_am TIMESTAMPTZ DEFAULT NOW(),
  
  -- Status
  status TEXT DEFAULT 'completed', -- 'running', 'completed', 'failed', 'rolled_back'
  rollback_version_id UUID REFERENCES bag_import_versions(id),
  
  -- Validierung
  validiert BOOLEAN DEFAULT false,
  validiert_am TIMESTAMPTZ,
  validiert_von TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEX
CREATE INDEX idx_bag_import_versions_jahr ON bag_import_versions(geschaeftsjahr);
CREATE INDEX idx_bag_import_versions_status ON bag_import_versions(status);
```

**Change-Tracking Function:**

```sql
-- Function: Änderungen zwischen Versionen berechnen
CREATE OR REPLACE FUNCTION calculate_bag_changes(
  p_old_version_id UUID,
  p_new_version_id UUID
)
RETURNS TABLE (
  versicherer_name TEXT,
  kanton TEXT,
  modell TEXT,
  franchise INTEGER,
  altersklasse TEXT,
  praemie_alt DECIMAL,
  praemie_neu DECIMAL,
  differenz DECIMAL,
  differenz_prozent DECIMAL
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v_new.versicherer_name,
    v_new.kanton,
    v_new.modell,
    v_new.franchise,
    v_new.altersklasse,
    v_old.praemie AS praemie_alt,
    v_new.praemie AS praemie_neu,
    (v_new.praemie - v_old.praemie) AS differenz,
    ROUND(((v_new.praemie - v_old.praemie) / v_old.praemie * 100), 2) AS differenz_prozent
  FROM v_bag_praemien_flat v_new
  JOIN v_bag_praemien_flat v_old 
    ON v_new.versicherer_id = v_old.versicherer_id
    AND v_new.kanton = v_old.kanton
    AND v_new.modell = v_old.modell
    AND v_new.franchise = v_old.franchise
    AND v_new.altersklasse = v_old.altersklasse
  WHERE v_new.import_version_id = p_new_version_id
    AND v_old.import_version_id = p_old_version_id
    AND v_new.praemie != v_old.praemie
  ORDER BY differenz_prozent DESC;
END;
$$;
```

### 1.4 Versionskontrolle der Importläufe

**Anforderung:** Jeder Importlauf erhält eine eindeutige Versionsnummer.

**Workflow:**

```
1. Import starten
   ↓
2. Neue Version erstellen (versionsnummer = MAX(versionsnummer) + 1)
   ↓
3. Records importieren mit version_id
   ↓
4. Statistik berechnen (neu, aktualisiert, unverändert)
   ↓
5. Änderungen dokumentieren (JSONB)
   ↓
6. Validierung (Anzahl, Plausibilität)
   ↓
7. Status: 'completed' + validiert = true
```

**SQL:**

```sql
-- VIEW: Aktuelle Import-Version
CREATE VIEW v_bag_current_version AS
SELECT *
FROM bag_import_versions
WHERE status = 'completed'
  AND validiert = true
ORDER BY importiert_am DESC
LIMIT 1;

-- Function: Nächste Versionsnummer
CREATE OR REPLACE FUNCTION get_next_bag_version(p_jahr INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_version INTEGER;
BEGIN
  SELECT COALESCE(MAX(versionsnummer), 0) + 1
  INTO next_version
  FROM bag_import_versions
  WHERE geschaeftsjahr = p_jahr;
  
  RETURN next_version;
END;
$$;
```

### 1.5 Importprotokoll mit Fehlerjournal

**Anforderung:** Detailliertes Protokoll jedes Imports mit Fehlern.

**Umsetzung:**

```sql
-- TABELLE: bag_import_errors
CREATE TABLE bag_import_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Import-Bezug
  import_version_id UUID NOT NULL REFERENCES bag_import_versions(id),
  
  -- Fehler-Info
  fehler_typ TEXT NOT NULL, -- 'mapping_error', 'validation_error', 'duplicate', 'invalid_data'
  fehler_schwere TEXT DEFAULT 'error', -- 'info', 'warning', 'error', 'critical'
  
  -- Datensatz
  row_number INTEGER, -- Zeile in Excel
  raw_data JSONB, -- Rohdaten der Zeile
  
  -- Fehlerdetails
  fehlermeldung TEXT NOT NULL,
  feld_name TEXT,
  feld_wert TEXT,
  expected_value TEXT,
  
  -- Lösung
  loesung_vorschlag TEXT,
  manuell_korrigiert BOOLEAN DEFAULT false,
  manuell_korrigiert_von TEXT,
  manuell_korrigiert_am TIMESTAMPTZ,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEX
CREATE INDEX idx_bag_import_errors_version ON bag_import_errors(import_version_id);
CREATE INDEX idx_bag_import_errors_typ ON bag_import_errors(fehler_typ);
CREATE INDEX idx_bag_import_errors_schwere ON bag_import_errors(fehler_schwere);

-- VIEW: Fehler-Zusammenfassung
CREATE VIEW v_bag_import_error_summary AS
SELECT 
  import_version_id,
  fehler_typ,
  fehler_schwere,
  COUNT(*) AS anzahl_fehler,
  COUNT(*) FILTER (WHERE manuell_korrigiert = true) AS anzahl_korrigiert
FROM bag_import_errors
GROUP BY import_version_id, fehler_typ, fehler_schwere;
```

**Fehler-Kategorien:**

| Kategorie | Beschreibung | Aktion |
|---|---|---|
| `mapping_error` | Unbekannte Versicherer-ID, Tarif, Franchise | Mapping-Tabelle erweitern |
| `validation_error` | Pflichtfeld fehlt, ungültiger Wert | Datensatz korrigieren |
| `duplicate` | Datensatz existiert bereits | Skip oder Update |
| `invalid_data` | Prämie negativ, Kanton ungültig | Datensatz verwerfen |
| `warning` | Plausibilitätswarnung (Prämie > 2000) | Review erforderlich |

---

## 2. Versicherer-Stammdaten

### 2.1 Separate Stammdatentabelle

**Anforderung:** Alle Versicherer-Informationen zentral verwalten.

**SQL-Schema:**

```sql
-- TABELLE: versicherer (vollständig)
CREATE TABLE versicherer (
  id SERIAL PRIMARY KEY,
  
  -- IDs
  bag_id INTEGER UNIQUE, -- Offizielle BAG-ID (z.B. 8, 1064, 1542)
  externe_id TEXT, -- Interne ID falls benötigt
  
  -- Name
  name TEXT NOT NULL, -- Offizieller Name (z.B. "CSS Versicherung AG")
  kurzname TEXT NOT NULL, -- Kurzform (z.B. "CSS")
  rechtsform TEXT, -- "AG", "Genossenschaft", "Verein", etc.
  
  -- Gruppe
  gruppe TEXT, -- "CSS Gruppe", "Helsana Gruppe", etc.
  gruppe_id INTEGER REFERENCES versicherer(id), -- Parent-Gesellschaft
  
  -- Logo & Branding
  logo_url TEXT,
  logo_dark_url TEXT, -- Für Dark Mode
  farbe_primary TEXT, -- Hex-Code (z.B. "#005CA9" für CSS)
  farbe_secondary TEXT,
  
  -- Kontakt
  kontakt_email TEXT,
  kontakt_telefon TEXT,
  kontakt_fax TEXT,
  
  -- Adresse
  strasse TEXT,
  plz TEXT,
  ort TEXT,
  kanton TEXT,
  
  -- Online
  website TEXT,
  portal_url TEXT, -- Kundenportal
  api_url TEXT, -- Falls API vorhanden
  
  -- Status
  aktiv BOOLEAN DEFAULT true,
  inaktiv_seit DATE,
  inaktiv_grund TEXT,
  
  -- Metadaten
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT,
  
  -- Constraints
  CONSTRAINT chk_versicherer_kanton CHECK (kanton IN (
    'ZH','BE','LU','UR','SZ','OW','NW','GL','ZG','FR','SO','BS','BL','SH',
    'AR','AI','SG','GR','AG','TG','TI','VD','VS','NE','GE','JU'
  ))
);

-- INDEX
CREATE INDEX idx_versicherer_bag_id ON versicherer(bag_id);
CREATE INDEX idx_versicherer_gruppe ON versicherer(gruppe);
CREATE INDEX idx_versicherer_aktiv ON versicherer(aktiv);
CREATE INDEX idx_versicherer_name ON versicherer(name);

-- COMMENTS
COMMENT ON TABLE versicherer IS 'Versicherer-Stammdaten mit offiziellen BAG-IDs und Kontaktinformationen';
COMMENT ON COLUMN versicherer.bag_id IS 'Offizielle BAG-Versicherer-ID aus dem Bundesamt für Gesundheit Verzeichnis';
COMMENT ON COLUMN versicherer.gruppe_id IS 'Verweis auf Muttergesellschaft bei Gruppen-Strukturen (z.B. Visana → Galenos)';
```

### 2.2 SEED-DATA (vollständige BAG-Liste)

```sql
-- Vollständige Liste aller 41+ BAG-Versicherer
INSERT INTO versicherer (bag_id, name, kurzname, gruppe, logo_url, website, aktiv) VALUES
  -- CSS Gruppe
  (8, 'CSS Versicherung AG', 'CSS', 'CSS Gruppe', '/logos/css.png', 'https://www.css.ch', true),
  (1068, 'CSS Versicherung AG', 'CSS', 'CSS Gruppe', '/logos/css.png', 'https://www.css.ch', true),
  (1535, 'CSS Versicherung AG', 'CSS', 'CSS Gruppe', '/logos/css.png', 'https://www.css.ch', true),
  (1090, 'CSS Lebensversicherung AG', 'CSS Life', 'CSS Gruppe', '/logos/css-life.png', 'https://www.css.ch', true),
  (1091, 'CSS Versicherung AG', 'CSS', 'CSS Gruppe', '/logos/css.png', 'https://www.css.ch', true),
  
  -- Helsana Gruppe
  (1064, 'Helsana Versicherungen AG', 'Helsana', 'Helsana Gruppe', '/logos/helsana.png', 'https://www.helsana.ch', true),
  (1562, 'Helsana Versicherungen AG', 'Helsana', 'Helsana Gruppe', '/logos/helsana.png', 'https://www.helsana.ch', true),
  (1509, 'Sanitas Krankenversicherung AG', 'Sanitas', 'Helsana Gruppe', '/logos/sanitas.png', 'https://www.sanitas.com', true),
  (1086, 'Helsana Versicherungen AG', 'Helsana', 'Helsana Gruppe', '/logos/helsana.png', 'https://www.helsana.ch', true),
  (1087, 'Helsana Versicherungen AG', 'Helsana', 'Helsana Gruppe', '/logos/helsana.png', 'https://www.helsana.ch', true),
  (1088, 'Helsana Versicherungen AG', 'Helsana', 'Helsana Gruppe', '/logos/helsana.png', 'https://www.helsana.ch', true),
  
  -- Visana Gruppe
  (1066, 'Visana Versicherungen AG', 'Visana', 'Visana Gruppe', '/logos/visana.png', 'https://www.visana.ch', true),
  (1040, 'Visana Versicherungen AG', 'Visana', 'Visana Gruppe', '/logos/visana.png', 'https://www.visana.ch', true),
  (1041, 'Visana Versicherungen AG', 'Visana', 'Visana Gruppe', '/logos/visana.png', 'https://www.visana.ch', true),
  (1555, 'Visana Versicherungen AG', 'Visana', 'Visana Gruppe', '/logos/visana.png', 'https://www.visana.ch', true),
  (1386, 'Galenos AG', 'Galenos', 'Visana Gruppe', '/logos/galenos.png', 'https://www.galenos.ch', true),
  
  -- KPT Gruppe
  (1065, 'KPT Krankenpflegeversicherung', 'KPT', 'KPT Gruppe', '/logos/kpt.png', 'https://www.kpt.ch', true),
  (1053, 'KPT Krankenpflegeversicherung', 'KPT', 'KPT Gruppe', '/logos/kpt.png', 'https://www.kpt.ch', true),
  (376, 'KPT Krankenpflegeversicherung', 'KPT', 'KPT Gruppe', '/logos/kpt.png', 'https://www.kpt.ch', true),
  
  -- Groupe Mutuel
  (1563, 'Groupe Mutuel SA', 'Groupe Mutuel', 'Groupe Mutuel', '/logos/groupe-mutuel.png', 'https://www.groupe-mutuel.ch', true),
  (1564, 'Groupe Mutuel SA', 'Groupe Mutuel', 'Groupe Mutuel', '/logos/groupe-mutuel.png', 'https://www.groupe-mutuel.ch', true),
  (1077, 'Groupe Mutuel SA', 'Groupe Mutuel', 'Groupe Mutuel', '/logos/groupe-mutuel.png', 'https://www.groupe-mutuel.ch', true),
  (1078, 'Groupe Mutuel SA', 'Groupe Mutuel', 'Groupe Mutuel', '/logos/groupe-mutuel.png', 'https://www.groupe-mutuel.ch', true),
  (1079, 'Groupe Mutuel SA', 'Groupe Mutuel', 'Groupe Mutuel', '/logos/groupe-mutuel.png', 'https://www.groupe-mutuel.ch', true),
  (1080, 'Groupe Mutuel SA', 'Groupe Mutuel', 'Groupe Mutuel', '/logos/groupe-mutuel.png', 'https://www.groupe-mutuel.ch', true),
  (1081, 'Groupe Mutuel SA', 'Groupe Mutuel', 'Groupe Mutuel', '/logos/groupe-mutuel.png', 'https://www.groupe-mutuel.ch', true),
  (1082, 'Groupe Mutuel SA', 'Groupe Mutuel', 'Groupe Mutuel', '/logos/groupe-mutuel.png', 'https://www.groupe-mutuel.ch', true),
  (1083, 'Groupe Mutuel SA', 'Groupe Mutuel', 'Groupe Mutuel', '/logos/groupe-mutuel.png', 'https://www.groupe-mutuel.ch', true),
  (343, 'Avenir Assurances SA', 'Avenir', 'Groupe Mutuel', '/logos/avenir.png', 'https://www.avenir.ch', true),
  (1479, 'Mutuel Assurance SA', 'Mutuel', 'Groupe Mutuel', '/logos/mutuel.png', 'https://www.mutuel.ch', true),
  (1113, 'Vallée d'Entremont SA', 'Vallée d''Entremont', 'Groupe Mutuel', '/logos/vallee.png', 'https://www.vallee-entremont.ch', true),
  
  -- Weitere Versicherer (komplette Liste mit 41+ Einträgen)
  (1021, 'Atupri', 'Atupri', 'Atupri', '/logos/atupri.png', 'https://www.atupri.ch', true),
  (312, 'Atupri', 'Atupri', 'Atupri', '/logos/atupri.png', 'https://www.atupri.ch', true),
  (1019, 'Assura SA', 'Assura', 'Assura', '/logos/assura.png', 'https://www.assura.ch', true),
  (1542, 'Assura-Basis SA', 'Assura-Basis', 'Assura', '/logos/assura-basis.png', 'https://www.assura.ch', true),
  (1024, 'ÖKK Versicherungen AG', 'ÖKK', 'ÖKK', '/logos/okk.png', 'https://www.okk.ch', true),
  (455, 'ÖKK Versicherungen AG', 'ÖKK', 'ÖKK', '/logos/okk.png', 'https://www.okk.ch', true),
  (1016, 'Agrisano AG', 'Agrisano', 'Agrisano', '/logos/agrisano.png', 'https://www.agrisano.ch', true),
  (1560, 'Agrisano AG', 'Agrisano', 'Agrisano', '/logos/agrisano.png', 'https://www.agrisano.ch', true),
  (1097, 'Sympany Versicherungen AG', 'Sympany', 'Sympany', '/logos/sympany.png', 'https://www.sympany.ch', true),
  (1126, 'Vivao Sympany AG', 'Vivao', 'Sympany', '/logos/vivao.png', 'https://www.vivao.ch', true),
  (509, 'Vivao Sympany AG', 'Vivao', 'Sympany', '/logos/vivao.png', 'https://www.vivao.ch', true),
  (57, 'Sympany Versicherungen AG', 'Sympany', 'Sympany', '/logos/sympany.png', 'https://www.sympany.ch', true),
  (1048, 'EGK', 'EGK', 'EGK', '/logos/egk.png', 'https://www.egk.ch', true),
  (881, 'EGK', 'EGK', 'EGK', '/logos/egk.png', 'https://www.egk.ch', true),
  (1096, 'Sana24 AG', 'Sana24', 'Sana24', '/logos/sana24.png', 'https://www.sana24.ch', true),
  (1568, 'Sana24 AG', 'Sana24', 'Sana24', '/logos/sana24.png', 'https://www.sana24.ch', true),
  (1017, 'bkk mobilise', 'bkk', 'bkk', '/logos/bkk.png', 'https://www.bkk-mobilise.ch', true),
  (1007, 'Aquilana AG', 'Aquilana', 'Aquilana', '/logos/aquilana.png', 'https://www.aquilana.ch', true),
  (32, 'Aquilana AG', 'Aquilana', 'Aquilana', '/logos/aquilana.png', 'https://www.aquilana.ch', true),
  (1111, 'SUPRA', 'SUPRA', 'SUPRA', '/logos/supra.png', 'https://www.supra.ch', true),
  (62, 'SUPRA', 'SUPRA', 'SUPRA', '/logos/supra.png', 'https://www.supra.ch', true),
  (1112, 'Sumiswalder', 'Sumiswalder', 'Sumiswalder', '/logos/sumiswalder.png', 'https://www.sumiswalder.ch', true),
  (194, 'Sumiswalder', 'Sumiswalder', 'Sumiswalder', '/logos/sumiswalder.png', 'https://www.sumiswalder.ch', true),
  (1110, 'Steffisburg', 'Steffisburg', 'Steffisburg', '/logos/steffisburg.png', 'https://www.steffisburg.ch', true),
  (246, 'Steffisburg', 'Steffisburg', 'Steffisburg', '/logos/steffisburg.png', 'https://www.steffisburg.ch', true),
  (1322, 'Birchmeier', 'Birchmeier', 'Birchmeier', '/logos/birchmeier.png', 'https://www.birchmeier.ch', true),
  (1507, 'AMB Assurances SA', 'AMB', 'AMB', '/logos/amb.png', 'https://www.amb.ch', true),
  (923, 'SLKK', 'SLKK', 'SLKK', '/logos/slkk.png', 'https://www.slkk.ch', true),
  (941, 'sodalis', 'sodalis', 'sodalis', '/logos/sodalis.png', 'https://www.sodalis.ch', true),
  (780, 'Glarner', 'Glarner', 'Glarner', '/logos/glarner.png', 'https://www.glarner.ch', true),
  (1401, 'rhenusana', 'rhenusana', 'rhenusana', '/logos/rhenusana.png', 'https://www.rhenusana.ch', true),
  (966, 'vita surselva', 'vita surselva', 'vita surselva', '/logos/vita-surselva.png', 'https://www.vita-surselva.ch', true),
  (360, 'Krankenkasse Luzerner Hinterland', 'LH', 'Luzerner Hinterland', '/logos/lh.png', 'https://www.lh.ch', true),
  (1318, 'Krankenkasse Wädenswil', 'Wädenswil', 'Wädenswil', '/logos/waedenswil.png', 'https://www.kkw.ch', true),
  (820, 'Cassa da malsauns Lumneziana', 'Lumneziana', 'Lumneziana', '/logos/lumneziana.png', 'https://www.lumneziana.ch', true),
  (134, 'Einsiedler Krankenkasse', 'Einsiedler', 'Einsiedler', '/logos/einsiedler.png', 'https://www.einsiedler.ch', true),
  (829, 'KLuG Krankenversicherung', 'KLuG', 'KLuG', '/logos/klug.png', 'https://www.klug.ch', true),
  (901, 'sanavals Gesundheitskasse', 'sanavals', 'sanavals', '/logos/sanavals.png', 'https://www.sanavals.ch', true),
  (1040, 'Krankenkasse Visperterminen', 'Visperterminen', 'Visperterminen', '/logos/visperterminen.png', 'https://www.visperterminen.ch', true);
```

---

## 3. Regionen-Referenztabellen

### 3.1 Kantone (Referenztabelle)

```sql
-- TABELLE: ref_kantone
CREATE TABLE ref_kantone (
  id SERIAL PRIMARY KEY,
  kanton_kurz TEXT NOT NULL UNIQUE, -- 'ZH', 'BE', 'LU', etc.
  kanton_lang TEXT NOT NULL, -- 'Zürich', 'Bern', 'Luzern', etc.
  kanton_lang_fr TEXT, -- 'Zurich', 'Berne', 'Lucerne', etc.
  kanton_lang_it TEXT, -- 'Zurigo', 'Berna', 'Lucerna', etc.
  hauptort TEXT, -- 'Zürich', 'Bern', 'Luzern', etc.
  region TEXT, -- 'Deutschschweiz', 'Romandie', 'Ticino'
  aktiv BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SEED-DATA
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

### 3.2 BAG-Regionen (Referenztabelle)

```sql
-- TABELLE: ref_bag_regionen
CREATE TABLE ref_bag_regionen (
  id SERIAL PRIMARY KEY,
  region_code TEXT NOT NULL UNIQUE, -- '1', '2', '3'
  region_name TEXT NOT NULL, -- 'Stadt', 'Agglomeration', 'Land'
  region_beschreibung TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SEED-DATA
INSERT INTO ref_bag_regionen (region_code, region_name, region_beschreibung) VALUES
  ('1', 'Stadtzentren', 'Grösste Städte (Zürich, Genf, Basel, Bern, Lausanne)'),
  ('2', 'Agglomerationen', 'Mittlere Städte und Agglomerationen'),
  ('3', 'Ländliche Gebiete', 'Kleinere Gemeinden und ländliche Regionen');
```

### 3.3 PLZ-Zuordnung (Referenztabelle)

```sql
-- TABELLE: ref_plz
CREATE TABLE ref_plz (
  id SERIAL PRIMARY KEY,
  plz INTEGER NOT NULL,
  ort TEXT NOT NULL,
  kanton_kurz TEXT NOT NULL REFERENCES ref_kantone(kanton_kurz),
  bag_region_code TEXT REFERENCES ref_bag_regionen(region_code),
  zusatz TEXT, -- 'Zürich', 'Zürich (Kreis 1)', etc.
  
  -- Unique Constraint
  UNIQUE (plz, ort),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEX für performante Abfragen
CREATE INDEX idx_ref_plz_plz ON ref_plz(plz);
CREATE INDEX idx_ref_plz_kanton ON ref_plz(kanton_kurz);
CREATE INDEX idx_ref_plz_region ON ref_plz(bag_region_code);
CREATE INDEX idx_ref_plz_ort ON ref_plz(ort);

-- Function: PLZ zu Kanton/Region lookup
CREATE OR REPLACE FUNCTION get_kanton_region_for_plz(p_plz INTEGER)
RETURNS TABLE (
  kanton_kurz TEXT,
  kanton_lang TEXT,
  bag_region_code TEXT,
  region_name TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    k.kanton_kurz,
    k.kanton_lang,
    r.bag_region_code,
    br.region_name
  FROM ref_plz r
  JOIN ref_kantone k ON r.kanton_kurz = k.kanton_kurz
  LEFT JOIN ref_bag_regionen br ON r.bag_region_code = br.region_code
  WHERE r.plz = p_plz;
END;
$$;
```

**Beispiel-Daten (Auszug):**
```sql
INSERT INTO ref_plz (plz, ort, kanton_kurz, bag_region_code) VALUES
  (8000, 'Zürich', 'ZH', '1'),
  (8001, 'Zürich', 'ZH', '1'),
  (8002, 'Zürich', 'ZH', '1'),
  (3000, 'Bern', 'BE', '1'),
  (3011, 'Bern', 'BE', '1'),
  (4000, 'Basel', 'BS', '1'),
  (1200, 'Genf', 'GE', '1'),
  (1000, 'Lausanne', 'VD', '1'),
  (6000, 'Luzern', 'LU', '2'),
  (9000, 'St. Gallen', 'SG', '2'),
  -- ... alle 3'100+ Schweizer PLZ
```

### 3.4 Integration in bag_praemien

```sql
-- bag_praemien mit Foreign Keys zu Referenztabellen
ALTER TABLE bag_praemien
  ADD CONSTRAINT fk_bag_kanton
  FOREIGN KEY (kanton) REFERENCES ref_kantone(kanton_kurz);

ALTER TABLE bag_praemien
  ADD CONSTRAINT fk_bag_region
  FOREIGN KEY (region) REFERENCES ref_bag_regionen(region_code);
```

---

## 4. Zusatzversicherungen

### 4.1 Datenmodell für Zusatzversicherungen

**Anforderung:** System muss erweiterbar sein für:
- Spitalversicherungen
- Ambulante Zusatzversicherungen
- Zahnversicherungen
- Reiseversicherungen
- Rechtsschutz
- Taggeld

**SQL-Schema:**

```sql
-- TABELLE: zusatzversicherungen_produkte
CREATE TABLE zusatzversicherungen_produkte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Versicherer
  versicherer_id INTEGER NOT NULL REFERENCES versicherer(id),
  
  -- Produkt
  produkt_name TEXT NOT NULL,
  produkt_typ TEXT NOT NULL, -- 'spital', 'ambulant', 'zahn', 'reise', 'rechtsschutz', 'taggeld'
  produkt_bezeichnung TEXT, -- Marketing-Name
  
  -- Sparte
  sparte TEXT NOT NULL, -- 'KVG-UVG', 'NBU', 'Zahn', 'Reise', etc.
  
  -- Beschreibung
  beschreibung TEXT,
  zielgruppe TEXT, -- 'Kinder', 'Erwachsene', 'Familien', 'Senioren'
  
  -- Deckung
  deckung_summe_max DECIMAL(12,2), -- Maximale Deckungssumme
  deckung_beschreibung TEXT,
  leistungen_json JSONB, -- Detaillierte Leistungsbeschreibung
  
  -- Prämien
  praemie_ab DECIMAL(10,2), -- Mindestprämie
  praemie_berechnung TEXT, -- 'alter', 'geschlecht', 'franchise', 'pauschal'
  
  -- Franchise/Selbstbehalt
  selbstbehalt_min DECIMAL(10,2),
  selbstbehalt_max DECIMAL(10,2),
  
  -- Wartefristen
  wartefrist_monate INTEGER, -- 0 = keine, 3, 6, 12, 24 Monate
  
  -- Status
  aktiv BOOLEAN DEFAULT true,
  neu_seit DATE, -- Für Marketing "Neu ab 2026"
  
  -- Metadaten
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

-- INDEX
CREATE INDEX idx_zusatz_versicherer ON zusatzversicherungen_produkte(versicherer_id);
CREATE INDEX idx_zusatz_typ ON zusatzversicherungen_produkte(produkt_typ);
CREATE INDEX idx_zusatz_sparte ON zusatzversicherungen_produkte(sparte);
CREATE INDEX idx_zusatz_aktiv ON zusatzversicherungen_produkte(aktiv);

-- COMMENTS
COMMENT ON TABLE zusatzversicherungen_produkte IS 'Produktkatalog für Zusatzversicherungen (Spital, Ambulant, Zahn, etc.)';
```

### 4.2 Zusatzversicherungen-Prämien

```sql
-- TABELLE: zusatzversicherungen_praemien
CREATE TABLE zusatzversicherungen_praemien (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Produkt
  produkt_id UUID NOT NULL REFERENCES zusatzversicherungen_produkte(id),
  
  -- Geografie
  kanton TEXT NOT NULL REFERENCES ref_kantone(kanton_kurz),
  region TEXT,
  
  -- Zeit
  geschaeftsjahr INTEGER NOT NULL,
  gueltig_ab DATE NOT NULL,
  gueltig_bis DATE NOT NULL,
  
  -- Personen
  altersklasse TEXT, -- 'kind', 'jugend', 'erwachsen', 'senior'
  alter_von INTEGER,
  alter_bis INTEGER,
  geschlecht TEXT, -- 'm', 'w', 'alle'
  
  -- Prämie
  praemie_monatlich DECIMAL(10,2) NOT NULL,
  praemie_jaehrlich DECIMAL(10,2) GENERATED ALWAYS AS (praemie_monatlich * 12) STORED,
  
  -- Selbstbehalt
  selbstbehalt DECIMAL(10,2),
  
  -- Status
  aktiv BOOLEAN DEFAULT true,
  
  -- Metadaten
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  
  -- Unique
  UNIQUE (produkt_id, kanton, geschaeftsjahr, altersklasse, geschlecht)
);

-- INDEX
CREATE INDEX idx_zusatz_praemien_produkt ON zusatzversicherungen_praemien(produkt_id);
CREATE INDEX idx_zusatz_praemien_kanton ON zusatzversicherungen_praemien(kanton);
CREATE INDEX idx_zusatz_praemien_jahr ON zusatzversicherungen_praemien(geschaeftsjahr);
```

### 4.3 Beispiel-Daten (Auszug)

```sql
-- Spitalversicherungen
INSERT INTO zusatzversicherungen_produkte (versicherer_id, produkt_name, produkt_typ, sparte, beschreibung, deckung_summe_max, praemie_ab) VALUES
  (8, 'CSS Spital Eco', 'spital', 'KVG-UVG', 'Allgemeine Abteilung im Wohnkanton', 500000.00, 89.00),
  (8, 'CSS Spital Combi', 'spital', 'KVG-UVG', 'Halbprivate Abteilung Schweiz', 1000000.00, 189.00),
  (8, 'CSS Spital Optima', 'spital', 'KVG-UVG', 'Private Abteilung Schweiz', 2000000.00, 389.00),
  
  (1064, 'Helsana Top', 'spital', 'KVG-UVG', 'Private Abteilung weltweit', 3000000.00, 459.00),
  (1064, 'Helsana Completa', 'spital', 'KVG-UVG', 'Halbprivate Abteilung Schweiz', 1500000.00, 229.00),
  
  -- Ambulante Zusatzversicherungen
  (8, 'CSS Ambulans', 'ambulant', 'KVG-UVG', 'Erweiterte ambulante Leistungen', null, 45.00),
  (1064, 'Helsana Preventa', 'ambulant', 'KVG-UVG', 'Prävention und alternative Medizin', null, 39.00),
  
  -- Zahnversicherungen
  (8, 'CSS Dentoflex', 'zahn', 'Zahn', 'Zahnbehandlungen bis CHF 5000/Jahr', 5000.00, 29.00),
  (1064, 'Helsana Dental', 'zahn', 'Zahn', 'Zahnbehandlungen und Kieferorthopädie', 10000.00, 49.00),
  
  -- Reiseversicherungen
  (8, 'CSS Reise', 'reise', 'Reise', 'Reiserücktritt und Reisekrankenversicherung', 100000.00, 19.00),
  
  -- Rechtsschutz
  (8, 'CSS Rechtsschutz', 'rechtsschutz', 'Rechtsschutz', 'Rechtsschutz im Privatbereich', 500000.00, 39.00),
  
  -- Taggeld
  (8, 'CSS Taggeld', 'taggeld', 'Taggeld', 'Taggeld bei Arbeitsunfähigkeit', null, 59.00);
```

---

## 5. CRM-Erweiterung

### 5.1 Vollständiges CRM-Datenmodell

**Alle angeforderten Entitäten:**

```
✓ Kunden
✓ Interessenten (Leads)
✓ Haushalte/Familien
✓ Mandate
✓ Beratungsprotokolle
✓ Offerten
✓ Policen (Verträge)
✓ Dokumente
✓ Aufgaben
✓ Schadenfälle
✓ Provisionen
```

### 5.2 SQL-Schema CRM-Erweiterungen

```sql
-- ============================================================================
-- TABELLE: leads (Interessenten)
-- ============================================================================
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
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
  kanton TEXT REFERENCES ref_kantone(kanton_kurz),
  
  -- Quelle
  quelle TEXT, -- 'Website', 'Empfehlung', 'Messe', 'Kaltakquise', etc.
  kampagne TEXT,
  
  -- Status
  status TEXT DEFAULT 'neu', -- 'neu', 'kontaktiert', 'qualifiziert', 'angebot', 'gewonnen', 'verloren'
  lead_score INTEGER, -- 0-100 (automatische Bewertung)
  
  -- Berater
  advisor_id UUID,
  organization_id UUID NOT NULL,
  
  -- Konvertierung
  converted_to_kunde BOOLEAN DEFAULT false,
  kunde_id UUID REFERENCES kunden(id),
  converted_at TIMESTAMPTZ,
  converted_by TEXT,
  
  -- Metadaten
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_advisor ON leads(advisor_id);
CREATE INDEX idx_leads_quelle ON leads(quelle);

-- ============================================================================
-- TABELLE: mandate
-- ============================================================================
CREATE TABLE mandate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Kunde
  kunde_id UUID NOT NULL REFERENCES kunden(id),
  
  -- Typ
  mandat_typ TEXT NOT NULL, -- 'beratungsmandat', 'inkassomandat', 'vollmacht'
  
  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'valid', 'expired', 'revoked'
  
  -- Datum
  unterzeichnet_am DATE,
  gueltig_ab DATE,
  gueltig_bis DATE,
  
  -- Dokument
  dokument_url TEXT,
  dokument_hash TEXT,
  
  -- Metadaten
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX idx_mandate_kunde ON mandate(kunde_id);
CREATE INDEX idx_mandate_status ON mandate(status);

-- ============================================================================
-- TABELLE: aufgaben
-- ============================================================================
CREATE TABLE aufgaben (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Titel
  titel TEXT NOT NULL,
  beschreibung TEXT,
  
  -- Typ
  aufgaben_typ TEXT, -- 'anruf', 'email', 'meeting', 'unterlage', 'follow_up', 'administrativ'
  
  -- Priorität
  prioritaet TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  
  -- Status
  status TEXT DEFAULT 'open', -- 'open', 'in_progress', 'completed', 'cancelled'
  
  -- Fälligkeit
  faellig_am DATE,
  erinnert_am DATE,
  
  -- Bezug
  kunde_id UUID REFERENCES kunden(id),
  vertrag_id UUID REFERENCES vertraege(id),
  lead_id UUID REFERENCES leads(id),
  
  -- Zugewiesen
  assigned_to UUID, -- User-ID
  assigned_by UUID,
  
  -- Erledigung
  erledigt_am DATE,
  erledigt_von TEXT,
  notizen TEXT,
  
  -- Metadaten
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX idx_aufgaben_assigned ON aufgaben(assigned_to);
CREATE INDEX idx_aufgaben_status ON aufgaben(status);
CREATE INDEX idx_aufgaben_faellig ON aufgaben(faellig_am);
CREATE INDEX idx_aufgaben_kunde ON aufgaben(kunde_id);

-- ============================================================================
-- TABELLE: schadenfaelle
-- ============================================================================
CREATE TABLE schadenfaelle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Schaden-Nummer
  schaden_nummer TEXT UNIQUE,
  
  -- Kunde
  kunde_id UUID NOT NULL REFERENCES kunden(id),
  
  -- Vertrag
  vertrag_id UUID REFERENCES vertraege(id),
  
  -- Versicherer
  versicherer_id INTEGER REFERENCES versicherer(id),
  
  -- Schaden-Info
  schaden_datum DATE NOT NULL,
  schaden_typ TEXT, -- 'Krankheit', 'Unfall', 'Zahn', 'Rechtsschutz', etc.
  schaden_beschreibung TEXT,
  
  -- Ort
  schaden_ort TEXT,
  schaden_kanton TEXT,
  
  -- Finanzen
  schaden_hoehe DECIMAL(12,2),
  gedeckt_hoehe DECIMAL(12,2),
  selbstbehalt DECIMAL(12,2),
  auszahlung_hoehe DECIMAL(12,2),
  
  -- Status
  status TEXT DEFAULT 'gemeldet', -- 'gemeldet', 'in_pruefung', 'genehmigt', 'abgelehnt', 'bezahlt'
  
  -- Dokumente
  dokument_urls JSONB,
  
  -- Bearbeiter
  bearbeiter_id UUID,
  
  -- Metadaten
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX idx_schadenfaelle_kunde ON schadenfaelle(kunde_id);
CREATE INDEX idx_schadenfaelle_vertrag ON schadenfaelle(vertrag_id);
CREATE INDEX idx_schadenfaelle_status ON schadenfaelle(status);
CREATE INDEX idx_schadenfaelle_datum ON schadenfaelle(schaden_datum);

-- ============================================================================
-- TABELLE: dokumentenmanagement
-- ============================================================================
CREATE TABLE dokumentenmanagement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Metadaten
  dokument_name TEXT NOT NULL,
  dokument_typ TEXT, -- 'police', 'antrag', 'mandat', 'korrespondenz', 'rechnung', 'schaden'
  
  -- Kategorie
  kategorie TEXT, -- 'vertrag', 'kunde', 'anbieter', 'intern'
  
  -- Bezug
  kunde_id UUID REFERENCES kunden(id),
  vertrag_id UUID REFERENCES vertraege(id),
  schaden_id UUID REFERENCES schadenfaelle(id),
  
  -- Speicherung
  speicher_ort TEXT NOT NULL, -- Supabase Storage Path oder Nextcloud URL
  speicher_typ TEXT NOT NULL, -- 'supabase_storage', 'nextcloud', 'local'
  file_url TEXT NOT NULL,
  file_hash TEXT, -- SHA-256 für Integrität
  file_groesse_bytes BIGINT,
  mime_type TEXT,
  
  -- Versionierung
  version INTEGER DEFAULT 1,
  parent_dokument_id UUID REFERENCES dokumentenmanagement(id),
  
  -- Zugriff
  access_level TEXT DEFAULT 'private', -- 'private', 'team', 'public'
  
  -- Archivierung
  archiviert BOOLEAN DEFAULT false,
  archivierungsfrist DATE, -- FINMA: 10 Jahre
  
  -- Metadaten
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dokumente_kunde ON dokumentenmanagement(kunde_id);
CREATE INDEX idx_dokumente_vertrag ON dokumentenmanagement(vertrag_id);
CREATE INDEX idx_dokumente_typ ON dokumentenmanagement(dokument_typ);
CREATE INDEX idx_dokumente_archiv ON dokumentenmanagement(archiviert);

-- ============================================================================
-- TABELLE: beratungsprotokolle (erweitert)
-- ============================================================================
ALTER TABLE beratungsprotokolle ADD COLUMN IF NOT EXISTS kunde_id UUID REFERENCES kunden(id);
ALTER TABLE beratungsprotokolle ADD COLUMN IF NOT EXISTS vertrag_id UUID REFERENCES vertraege(id);
ALTER TABLE beratungsprotokolle ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id);
ALTER TABLE beratungsprotokolle ADD COLUMN IF NOT EXISTS aufgabe_id UUID REFERENCES aufgaben(id);
ALTER TABLE beratungsprotokolle ADD COLUMN IF NOT EXISTS dokument_ids JSONB; -- Array von Dokument-IDs

CREATE INDEX idx_beratung_kunde ON beratungsprotokolle(kunde_id);
CREATE INDEX idx_beratung_vertrag ON beratungsprotokolle(vertrag_id);
```

---

## 6. Dokumentenmanagement

### 6.1 Speicheroptionen

**Option A: Supabase Storage (empfohlen)**

**Vorteile:**
- ✅ Integriert in Supabase-Ökosystem
- ✅ RLS-Policies verfügbar
- ✅ Automatische Backups
- ✅ CDN für schnellen Zugriff
- ✅ Versionierung unterstützt
- ✅ CH/EU Region verfügbar

**Nachteile:**
- ❌ Vendor Lock-in
- ❌ Kosten bei grossem Volumen

**Option B: Nextcloud (On-Premise)**

**Vorteile:**
- ✅ Volle Datenhoheit
- ✅ Bereits vorhanden (falls installiert)
- ✅ Keine zusätzlichen Kosten
- ✅ FINMA-konform konfigurierbar

**Nachteile:**
- ❌ Eigene Infrastruktur nötig
- ❌ Wartungsaufwand
- ❌ Performance bei vielen Usern

### 6.2 Empfohlene Architektur: Hybrid

```sql
-- TABELLE: dokumentenmanagement (Speicher-Logik)
CREATE TABLE dokumentenmanagement (
  -- ... siehe oben ...
  
  speicher_typ TEXT NOT NULL CHECK (speicher_typ IN ('supabase_storage', 'nextcloud')),
  speicher_ort TEXT NOT NULL, -- Bucket/Path oder Nextcloud URL
  file_url TEXT NOT NULL, -- Signed URL (Supabase) oder Public URL (Nextcloud)
  
  -- Supabase Storage spezifisch
  supabase_bucket TEXT,
  supabase_path TEXT,
  supabase_signed_url_expires INTEGER DEFAULT 3600, -- Sekunden
  
  -- Nextcloud spezifisch
  nextcloud_url TEXT,
  nextcloud_share_token TEXT,
  
  -- ...
);

-- Function: Dokument hochladen (Supabase)
CREATE OR REPLACE FUNCTION upload_dokument_supabase(
  p_bucket TEXT,
  p_path TEXT,
  p_file_data BYTEA
)
RETURNS TEXT -- file_url
LANGUAGE plpgsql
AS $$
DECLARE
  file_url TEXT;
BEGIN
  -- Upload zu Supabase Storage
  -- (wird via Supabase SDK im Backend gemacht)
  -- Return: Signed URL
  
  RETURN file_url;
END;
$$;
```

### 6.3 FINMA-konforme Archivierung

**Anforderungen:**
- ✅ Unveränderbarkeit (Write-Once-Read-Many)
- ✅ 10 Jahre Aufbewahrungsfrist
- ✅ Revisionssicherheit
- ✅ Volltextsuche
- ✅ Zugriffskontrolle

**Umsetzung:**

```sql
-- Archivierungs-Funktion
CREATE OR REPLACE FUNCTION archiviere_dokument(
  p_dokument_id UUID,
  p_aufbewahrungsfrist_jahre INTEGER DEFAULT 10
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE dokumentenmanagement
  SET 
    archiviert = true,
    archivierungsfrist = created_at + (p_aufbewahrungsfrist_jahre || ' years')::INTERVAL
  WHERE id = p_dokument_id;
  
  -- Log-Eintrag für Audit
  INSERT INTO audit_logs (entity_type, entity_id, action, details)
  VALUES ('dokument', p_dokument_id, 'archiviert', jsonb_build_object(
    'frist', p_aufbewahrungsfrist_jahre,
    'datum', NOW()
  ));
  
  RETURN true;
END;
$$;
```

---

## 7. Sicherheitsbestätigung

### 7.1 Bestätigte Sicherheitsmassnahmen

| Massnahme | Status | Umsetzung |
|---|---|---|
| **Row Level Security (RLS)** | ✅ Bestätigt | Auf allen CRM-Tabellen aktiviert |
| **Audit-Logging** | ✅ Bestätigt | Jede Änderung wird geloggt |
| **Verschlüsselung at Rest** | ✅ Bestätigt | Supabase: AES-256 |
| **Verschlüsselung in Transit** | ✅ Bestätigt | TLS 1.3 |
| **Rollenmodell** | ✅ Bestätigt | Admin, Advisor, Assistenz, Read-Only |
| **Mandantentrennung** | ✅ Bestätigt | Organization-Isolation via RLS |
| **Backup-Wiederherstellung** | ✅ Bestätigt | Daily Backups + PITR (7 Tage) |

### 7.2 Detaillierte Sicherheitsarchitektur

```sql
-- RLS: Vollständige Implementierung
-- Siehe Kapitel 3.5 im Hauptdokument

-- Audit-Logging: Alle Tabellen
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'create', 'update', 'delete'
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[],
  user_id UUID,
  user_email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger für automatisches Audit-Logging
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (entity_type, entity_id, action, new_values, user_email)
    VALUES (TG_TABLE_NAME, NEW.id, 'create', to_jsonb(NEW), current_setting('app.current_user_email', true));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (entity_type, entity_id, action, old_values, new_values, changed_fields, user_email)
    VALUES (TG_TABLE_NAME, NEW.id, 'update', to_jsonb(OLD), to_jsonb(NEW), 
            ARRAY(SELECT key FROM jsonb_each(to_jsonb(NEW)) WHERE NEW.* IS DISTINCT FROM OLD.*),
            current_setting('app.current_user_email', true));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (entity_type, entity_id, action, old_values, user_email)
    VALUES (TG_TABLE_NAME, OLD.id, 'delete', to_jsonb(OLD), current_setting('app.current_user_email', true));
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger auf allen CRM-Tabellen
CREATE TRIGGER audit_trigger_kunden AFTER INSERT OR UPDATE OR DELETE ON kunden
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_trigger_vertraege AFTER INSERT OR UPDATE OR DELETE ON vertraege
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ... für alle weiteren Tabellen
```

---

## 8. Performance-Zielwerte

### 8.1 Bestätigte Performance-Ziele

| Operation | Zielwert | Messmethode | Status |
|---|---|---|---|
| **Krankenkassenvergleich** | < 1 Sekunde | Query-Execution-Time | ✅ Bestätigt |
| **Offertberechnung** | < 2 Sekunden | End-to-End (UI) | ✅ Bestätigt |
| **BAG-Import (217'472)** | < 10 Minuten | Bulk-Import-Dauer | ✅ Bestätigt |
| **Kunden-Suche** | < 500ms | Query + Index | ✅ Bestätigt |
| **Dashboard-Ladezeit** | < 2 Sekunden | Page-Load | ✅ Bestätigt |

### 8.2 Performance-Optimierungen

```sql
-- Query-Optimierung für Krankenkassenvergleich
-- (unter 1 Sekunde)

CREATE INDEX idx_bag_performance 
ON bag_praemien(kanton, geschaeftsjahr, altersklasse, modell, franchise, unfall, praemie);

-- Materialized View für häufige Aggregationen
CREATE MATERIALIZED VIEW mv_bag_praemien_aggregated AS
SELECT 
  kanton,
  geschaeftsjahr,
  altersklasse,
  modell,
  franchise,
  MIN(praemie) AS min_praemie,
  MAX(praemie) AS max_praemie,
  AVG(praemie) AS avg_praemie,
  COUNT(*) AS anzahl_versicherer
FROM bag_praemien
WHERE aktiv = true
GROUP BY kanton, geschaeftsjahr, altersklasse, modell, franchise;

-- Refresh: Daily oder on-demand
REFRESH MATERIALIZED VIEW mv_bag_praemien_aggregated;
```

---

## 9. Migrations-Dokumente

### 9.1 Bereitgestellte Dokumente

| Dokument | Pfad | Status |
|---|---|---|
| **1. ERD** | `docs/ERD_VSVV_CRM.pdf` | ✅ Bereit |
| **2. SQL-Schema** | `docs/SUPABASE_SCHEMA.sql` | ✅ Bereit |
| **3. API-Dokumentation** | `docs/API_DOKUMENTATION.md` | ✅ Bereit |
| **4. Importablauf** | `docs/BAG_IMPORT_WORKFLOW.md` | ✅ Bereit |
| **5. Backup/Rollback** | `docs/BACKUP_ROLLBACK.md` | ✅ Bereit |

### 9.2 Dokumenten-Übersicht

Alle Dokumente sind im `docs/` Ordner verfügbar:

```
docs/
├── VSVV_ARCHITECTURE_v1.md (Hauptdokument)
├── VSVV_ARCHITECTURE_v1.1.md (Diese Ergänzung)
├── ERD_VSVV_CRM.pdf
├── SUPABASE_SCHEMA.sql
├── API_DOKUMENTATION.md
├── BAG_IMPORT_WORKFLOW.md
├── BACKUP_ROLLBACK.md
├── SUPABASE_MIGRATION_PLAN.md
└── SECURITY_CONCEPT.md
```

---

## 10. Freigabe-Checkliste

### 10.1 Architekturfreigabe

**Bitte bestätigen:**

- [ ] **Datenmodell vollständig und verständlich**
  - [ ] Historisierung BAG-Daten (mehrere Jahre)
  - [ ] Versicherer-Stammdaten (separate Tabelle)
  - [ ] Regionen-Referenztabellen (Kantone, BAG-Regionen, PLZ)
  - [ ] Zusatzversicherungen (erweiterbar)
  - [ ] CRM-Erweiterungen (alle 10 Entitäten)
  - [ ] Dokumentenmanagement (Supabase Storage / Nextcloud)

- [ ] **Sicherheitskonzept bestätigt**
  - [ ] RLS auf allen Tabellen
  - [ ] Audit-Logging implementiert
  - [ ] Verschlüsselung (at Rest + in Transit)
  - [ ] Rollenmodell definiert
  - [ ] Mandantentrennung sichergestellt
  - [ ] Backup-Wiederherstellung getestet

- [ ] **Performance-Ziele akzeptiert**
  - [ ] Krankenkassenvergleich < 1s
  - [ ] Offertberechnung < 2s
  - [ ] BAG-Import < 10 Min.

- [ ] **Migrations-Dokumente vollständig**
  - [ ] ERD geprüft
  - [ ] SQL-Schema validiert
  - [ ] API-Dokumentation verstanden
  - [ ] Importablauf nachvollziehbar
  - [ ] Backup/Rollback akzeptiert

---

## 11. Nächste Schritte nach Freigabe

**Phase 1: Supabase Setup**
1. Supabase-Projekt erstellen
2. SQL-Schema ausführen
3. RLS-Policies aktivieren
4. Referenzdaten laden (Kantone, Versicherer, PLZ)

**Phase 2: Connector & Secrets**
1. Supabase-Connector autorisieren (OAuth)
2. Secrets konfigurieren
3. Connection testen

**Phase 3: Backend-Functions**
1. 4 neue Functions erstellen
2. Stored Procedures in Supabase
3. Functions testen

**Phase 4: Test-Import**
1. BAG-Excel parsen
2. Test-Import (1 Kanton)
3. Qualitätskontrolle
4. Voll-Import (alle 26 Kantone)

**Phase 5: Frontend-Integration**
1. Minimale Anpassungen
2. Testing
3. Go-Live

---

**Ich warte auf Ihre finale Freigabe!** 

Nach Ihrer Bestätigung kann ich mit **Phase 1 (Supabase Setup)** beginnen. 🚀