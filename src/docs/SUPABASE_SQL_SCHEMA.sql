-- ============================================================
-- VSVV CRM - Supabase SQL Schema
-- ============================================================
-- Version: 1.0
-- Datum: 2026-06-09
-- Status: Phase 1 - Testumgebung
-- Region: eu-central-1 (Frankfurt)
-- ============================================================

-- Hinweis: Dieses Schema wird im Supabase SQL Editor ausgeführt
-- URL: https://supabase.com/dashboard/project/YOUR_PROJECT_REF/sql/new

-- ============================================================
-- 1. Referenzdaten
-- ============================================================

-- Kantone (26 Schweizer Kantone)
CREATE TABLE IF NOT EXISTS ref_kantone (
  id SERIAL PRIMARY KEY,
  kanton_code VARCHAR(2) UNIQUE NOT NULL,
  kanton_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO ref_kantone (kanton_code, kanton_name) VALUES
('ZH', 'Zürich'), ('BE', 'Bern'), ('LU', 'Luzern'), ('UR', 'Uri'),
('SZ', 'Schwyz'), ('OW', 'Obwalden'), ('NW', 'Nidwalden'), ('GL', 'Glarus'),
('ZG', 'Zug'), ('FR', 'Freiburg'), ('SO', 'Solothurn'), ('BS', 'Basel-Stadt'),
('BL', 'Basel-Landschaft'), ('SH', 'Schaffhausen'), ('AR', 'Appenzell Ausserrhoden'),
('AI', 'Appenzell Innerrhoden'), ('SG', 'St. Gallen'), ('GR', 'Graubünden'),
('AG', 'Aargau'), ('TG', 'Thurgau'), ('TI', 'Tessin'), ('VD', 'Waadt'),
('VS', 'Wallis'), ('NE', 'Neuenburg'), ('GE', 'Genf'), ('JU', 'Jura')
ON CONFLICT (kanton_code) DO NOTHING;

-- BAG-Prämienregionen
CREATE TABLE IF NOT EXISTS ref_bag_regionen (
  id SERIAL PRIMARY KEY,
  region_code VARCHAR(1) UNIQUE NOT NULL,
  region_name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO ref_bag_regionen (region_code, region_name, description) VALUES
('1', 'Städtische Regionen', 'Zentren wie Zürich, Genf, Basel, Bern'),
('2', 'Agglomerationen', 'Mittlere Regionen'),
('3', 'Ländliche Regionen', 'Ländliche Gebiete')
ON CONFLICT (region_code) DO NOTHING;

-- Altersklassen
CREATE TABLE IF NOT EXISTS ref_alterklassen (
  id SERIAL PRIMARY KEY,
  alterklasse_code VARCHAR(20) UNIQUE NOT NULL,
  alter_von INTEGER NOT NULL,
  alter_bis INTEGER NOT NULL,
  description VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO ref_alterklassen (alterklasse_code, alter_von, alter_bis, description) VALUES
('kind', 0, 18, 'Kinder 0-18 Jahre'),
('jugend', 19, 25, 'Jugendliche 19-25 Jahre'),
('erwachsen', 26, 99, 'Erwachsene 26+ Jahre')
ON CONFLICT (alterklasse_code) DO NOTHING;

-- Versicherer-Stammdaten
CREATE TABLE IF NOT EXISTS versicherer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  kurzname VARCHAR(50),
  kontaktperson VARCHAR(200),
  funktion VARCHAR(100),
  email VARCHAR(200),
  telefon VARCHAR(50),
  adresse TEXT,
  plz VARCHAR(10),
  ort VARCHAR(100),
  website VARCHAR(200),
  bearbeitungszeit_tage INTEGER,
  aktiv BOOLEAN DEFAULT true,
  bewertung DECIMAL(3,2),
  spezialisierungen TEXT[],
  bevorzugter_kanal VARCHAR(50),
  portal_url VARCHAR(200),
  notizen TEXT,
  logo_url VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index für schnelle Suche
CREATE INDEX IF NOT EXISTS idx_versicherer_name ON versicherer(name);
CREATE INDEX IF NOT EXISTS idx_versicherer_aktiv ON versicherer(aktiv) WHERE aktiv = true;

-- ============================================================
-- 2. BAG-Prämiendaten (Haupttabelle)
-- ============================================================

CREATE TABLE IF NOT EXISTS bag_praemien (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jahr INTEGER NOT NULL,
  krankenkasse VARCHAR(200) NOT NULL,
  kanton VARCHAR(2) NOT NULL REFERENCES ref_kantone(kanton_code),
  region VARCHAR(1) REFERENCES ref_bag_regionen(region_code),
  modell VARCHAR(50) NOT NULL,
  franchise INTEGER NOT NULL,
  unfall BOOLEAN DEFAULT false,
  altersklasse VARCHAR(20) NOT NULL REFERENCES ref_alterklassen(alterklasse_code),
  praemie_erwachsene DECIMAL(10,2) NOT NULL,
  praemie_kinder DECIMAL(10,2) DEFAULT 0,
  geschlecht VARCHAR(1),
  alter_von INTEGER,
  alter_bis INTEGER,
  datenquelle VARCHAR(50) DEFAULT 'BAG',
  importiert_am TIMESTAMPTZ,
  importiert_von VARCHAR(200),
  gueltig_ab DATE,
  gueltig_bis DATE,
  aktiv BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Composite Indexes für Performance (< 1s Queries)
CREATE INDEX IF NOT EXISTS idx_bag_kanton_jahr ON bag_praemien(kanton, jahr);
CREATE INDEX IF NOT EXISTS idx_bag_kasse_modell ON bag_praemien(krankenkasse, modell);
CREATE INDEX IF NOT EXISTS idx_bag_alterklasse ON bag_praemien(altersklasse);
CREATE INDEX IF NOT EXISTS idx_bag_franchise ON bag_praemien(franchise);
CREATE INDEX IF NOT EXISTS idx_bag_praemie_search ON bag_praemien(kanton, jahr, altersklasse, modell, franchise);
CREATE INDEX IF NOT EXISTS idx_bag_aktiv ON bag_praemien(aktiv) WHERE aktiv = true;

-- ============================================================
-- 3. BAG-Import Management
-- ============================================================

CREATE TABLE IF NOT EXISTS bag_import_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  versionsnummer INTEGER NOT NULL,
  geschaeftsjahr INTEGER NOT NULL,
  import_datei_name VARCHAR(500),
  import_datei_groesse_bytes BIGINT,
  import_start_am TIMESTAMPTZ,
  import_ende_am TIMESTAMPTZ,
  anzahl_records_gesamt INTEGER,
  anzahl_records_erfolgreich INTEGER,
  anzahl_fehler INTEGER,
  status VARCHAR(50) DEFAULT 'in_progress',
  validiert BOOLEAN DEFAULT false,
  validiert_am TIMESTAMPTZ,
  validiert_von VARCHAR(200),
  rollback_version_id UUID,
  rollback_am TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bag_import_versions_status ON bag_import_versions(status);
CREATE INDEX IF NOT EXISTS idx_bag_import_versions_jahr ON bag_import_versions(geschaeftsjahr);

CREATE TABLE IF NOT EXISTS bag_import_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_version_id UUID REFERENCES bag_import_versions(id) ON DELETE CASCADE,
  fehler_typ VARCHAR(100) NOT NULL,
  fehler_schwere VARCHAR(50) DEFAULT 'error',
  row_number INTEGER,
  fehlermeldung TEXT,
  feld_name VARCHAR(100),
  feld_wert TEXT,
  manuell_korrigiert BOOLEAN DEFAULT false,
  manuell_korrigiert_von VARCHAR(200),
  manuell_korrigiert_am TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bag_import_errors_version ON bag_import_errors(import_version_id);
CREATE INDEX IF NOT EXISTS idx_bag_import_errors_typ ON bag_import_errors(fehler_typ);

-- ============================================================
-- 4. CRM-Kunden (Basis-Struktur)
-- ============================================================

CREATE TABLE IF NOT EXISTS kunden (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_number VARCHAR(50) UNIQUE,
  vorname VARCHAR(100) NOT NULL,
  nachname VARCHAR(100) NOT NULL,
  email VARCHAR(200),
  telefon VARCHAR(50),
  mobile VARCHAR(50),
  strasse VARCHAR(200),
  plz VARCHAR(10),
  ort VARCHAR(100),
  kanton VARCHAR(2) REFERENCES ref_kantone(kanton_code),
  geburtsdatum DATE,
  ahv_number VARCHAR(50),
  zivilstand VARCHAR(50),
  beruf VARCHAR(100),
  nationalitaet VARCHAR(100),
  kundenart VARCHAR(50) DEFAULT 'privat',
  status VARCHAR(50) DEFAULT 'aktiv',
  mandate_status VARCHAR(50) DEFAULT 'pending',
  organization_id UUID,
  advisor_id UUID,
  teamlead_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kunden_email ON kunden(email);
CREATE INDEX IF NOT EXISTS idx_kunden_advisor ON kunden(advisor_id);
CREATE INDEX IF NOT EXISTS idx_kunden_organization ON kunden(organization_id);

-- ============================================================
-- 5. CRM-Verträge
-- ============================================================

CREATE TABLE IF NOT EXISTS vertraege (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES kunden(id) ON DELETE CASCADE,
  customer_name VARCHAR(200),
  organization_id UUID,
  advisor_id UUID,
  versicherer_id UUID REFERENCES versicherer(id),
  versicherer_name VARCHAR(200),
  policen_nummer VARCHAR(100),
  versicherungsart VARCHAR(50),
  produkt VARCHAR(200),
  praemie_monatlich DECIMAL(10,2),
  praemie_jaehrlich DECIMAL(10,2),
  startdatum DATE,
  enddatum DATE,
  kuendigungsfrist DATE,
  status VARCHAR(50) DEFAULT 'aktiv',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vertraege_customer ON vertraege(customer_id);
CREATE INDEX IF NOT EXISTS idx_vertraege_advisor ON vertraege(advisor_id);
CREATE INDEX IF NOT EXISTS idx_vertraege_status ON vertraege(status);

-- ============================================================
-- 6. Audit-Logs (revisionssicher)
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_schema_version VARCHAR(20) DEFAULT '1.0',
  audit_id VARCHAR(100) UNIQUE NOT NULL,
  audit_level INTEGER DEFAULT 2,
  audit_level_name VARCHAR(50),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  trigger_type VARCHAR(50),
  trigger_source VARCHAR(200),
  actor_type VARCHAR(50),
  actor_id VARCHAR(200),
  actor_name VARCHAR(200),
  process_id VARCHAR(100),
  process_type VARCHAR(100),
  process_stage VARCHAR(100),
  event_id VARCHAR(100),
  event_type VARCHAR(100),
  event_sequence INTEGER DEFAULT 1,
  entity_type VARCHAR(100),
  entity_id VARCHAR(200),
  action VARCHAR(50),
  decision_code VARCHAR(100),
  decision_logic TEXT,
  guard_evaluated VARCHAR(100),
  guard_result VARCHAR(50),
  guard_reason TEXT,
  business_severity_type VARCHAR(50),
  business_severity_level VARCHAR(50),
  technical_severity_type VARCHAR(50),
  technical_severity_level VARCHAR(50),
  previous_state_summary JSONB,
  new_state_summary JSONB,
  side_effects JSONB[],
  business_impact_financial_chf DECIMAL(15,2),
  business_impact_description TEXT,
  retry_attempt INTEGER DEFAULT 0,
  retry_of_event_id VARCHAR(100),
  recovered BOOLEAN DEFAULT false,
  recovery_strategy VARCHAR(50),
  original_error TEXT,
  anomaly_detected BOOLEAN DEFAULT false,
  anomaly_type VARCHAR(100),
  anomaly_score INTEGER,
  correlation_id VARCHAR(100),
  related_entities JSONB[],
  ip_address INET,
  duration_ms INTEGER,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Append-only: Keine UPDATE/DELETE erlaubt (wird via RLS erzwungen)
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation ON audit_logs(correlation_id);

-- ============================================================
-- 7. Row Level Security (RLS) Policies
-- ============================================================

-- RLS aktivieren für alle Tabellen
ALTER TABLE bag_praemien ENABLE ROW LEVEL SECURITY;
ALTER TABLE kunden ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertraege ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE versicherer ENABLE ROW LEVEL SECURITY;

-- BAG-Prämien: Alle authentifizierten User dürfen lesen
CREATE POLICY "authenticated_read_bag_praemien"
ON bag_praemien FOR SELECT
TO authenticated
USING (true);

-- BAG-Prämien: Nur Admins dürfen schreiben (Import)
CREATE POLICY "admin_write_bag_praemien"
ON bag_praemien FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Kunden: User sieht nur eigene Kunden (oder Admin alle)
CREATE POLICY "advisor_own_customers"
ON kunden FOR SELECT
TO authenticated
USING (
  advisor_id = auth.uid()
  OR 
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

CREATE POLICY "advisor_insert_customers"
ON kunden FOR INSERT
TO authenticated
WITH CHECK (
  advisor_id = auth.uid()
  OR 
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Verträge: Ähnlich wie Kunden
CREATE POLICY "advisor_own_contracts"
ON vertraege FOR SELECT
TO authenticated
USING (
  advisor_id = auth.uid()
  OR 
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Audit-Logs: Nur Admins dürfen lesen/schreiben
CREATE POLICY "admin_only_audit_logs"
ON audit_logs FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Versicherer: Alle authentifizierten User dürfen lesen
CREATE POLICY "authenticated_read_versicherer"
ON versicherer FOR SELECT
TO authenticated
USING (true);

-- Versicherer: Nur Admins dürfen schreiben
CREATE POLICY "admin_write_versicherer"
ON versicherer FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

-- ============================================================
-- 8. Helper Functions
-- ============================================================

-- Function: Current User ID
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Current User Role
CREATE OR REPLACE FUNCTION user_role()
RETURNS TEXT AS $$
DECLARE
  role TEXT;
BEGIN
  SELECT raw_user_meta_data->>'role'
  INTO role
  FROM auth.users
  WHERE id = auth.uid();
  
  RETURN role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Current User Organization
CREATE OR REPLACE FUNCTION current_user_org()
RETURNS UUID AS $$
DECLARE
  org_id UUID;
BEGIN
  SELECT (raw_user_meta_data->>'organization_id')::uuid
  INTO org_id
  FROM auth.users
  WHERE id = auth.uid();
  
  RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 9. Seed Data (Versicherer)
-- ============================================================

INSERT INTO versicherer (name, kurzname, aktiv) VALUES
('CSS Versicherung AG', 'CSS', true),
('Helsana Versicherungen AG', 'Helsana', true),
('Sanitas Versicherungen AG', 'Sanitas', true),
('Swica Gesundheitsorganisation', 'Swica', true),
('ÖKK Versicherungen AG', 'ÖKK', true),
('Visana Versicherungen AG', 'Visana', true),
('KPT Krankenkasse AG', 'KPT', true),
('Groupe Mutuel Versicherungen', 'Groupe Mutuel', true),
('Concordia Versicherungen', 'Concordia', true),
('Atupri Gesundheitsversicherung', 'Atupri', true),
('Assura SA', 'Assura', true),
('Sympany Versicherungen', 'Sympany', true),
('Agrisano Versicherungen', 'Agrisano', true),
('bkk mobilise', 'bkk mobilise', true),
('Galenus Versicherungen', 'Galenus', true),
('EGK Krankenkasse', 'EGK', true),
('Sana24 AG', 'Sana24', true),
('Vivao Sympany AG', 'Vivao', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Ende des Schemas
-- ============================================================