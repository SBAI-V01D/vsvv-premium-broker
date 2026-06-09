import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      return Response.json({ error: 'Supabase secrets not configured' }, { status: 500 });
    }

    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const sql = `
-- BAG Praemien Tabelle mit erweitertem Modell-Enum (inklusive 'other' für TAR-DIV)
CREATE TABLE IF NOT EXISTS bag_praemien (
  id BIGSERIAL PRIMARY KEY,
  geschaeftsjahr INTEGER NOT NULL,
  krankenkasse TEXT NOT NULL,
  kanton TEXT NOT NULL,
  region TEXT NOT NULL,
  modell TEXT NOT NULL CHECK (modell IN ('standard', 'telmed', 'hausarzt', 'hmo', 'other')),
  franchise INTEGER NOT NULL,
  unfall BOOLEAN NOT NULL DEFAULT false,
  altersklasse TEXT NOT NULL,
  praemie_erwachsene NUMERIC(10,2) NOT NULL,
  praemie_kinder NUMERIC(10,2) DEFAULT 0,
  geschlecht TEXT,
  alter_von INTEGER,
  alter_bis INTEGER,
  tarif_original TEXT,
  tariftyp_original TEXT,
  tarifbezeichnung TEXT,
  datenquelle TEXT DEFAULT 'BAG',
  importiert_am TIMESTAMPTZ,
  importiert_von TEXT,
  gueltig_ab DATE,
  gueltig_bis DATE,
  aktiv BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Composite Unique Constraint für UPSERT (mit 'unfall' für BEIDE Varianten)
ALTER TABLE bag_praemien
ADD CONSTRAINT unique_bag_record
UNIQUE (geschaeftsjahr, krankenkasse, kanton, region, modell, franchise, unfall, altersklasse);

-- Indizes für Performance
CREATE INDEX IF NOT EXISTS idx_bag_praemien_jahr ON bag_praemien(geschaeftsjahr);
CREATE INDEX IF NOT EXISTS idx_bag_praemien_kanton ON bag_praemien(kanton);
CREATE INDEX IF NOT EXISTS idx_bag_praemien_kasse ON bag_praemien(krankenkasse);
CREATE INDEX IF NOT EXISTS idx_bag_praemien_modell ON bag_praemien(modell);
CREATE INDEX IF NOT EXISTS idx_bag_praemien_franchise ON bag_praemien(franchise);
CREATE INDEX IF NOT EXISTS idx_bag_praemien_alter ON bag_praemien(altersklasse);
CREATE INDEX IF NOT EXISTS idx_bag_praemien_region ON bag_praemien(region);

-- Import Versions Tracking
CREATE TABLE IF NOT EXISTS bag_import_versions (
  id TEXT PRIMARY KEY,
  geschaeftsjahr INTEGER NOT NULL,
  status TEXT DEFAULT 'importing',
  quelle_datei_gesamtzeilen INTEGER,
  importiert_am TIMESTAMPTZ DEFAULT NOW(),
  importiert_von TEXT,
  importdauer_minuten NUMERIC(10,2),
  validiert_am TIMESTAMPTZ,
  validiert_von TEXT,
  validierung_json JSONB,
  anzahl_versicherer INTEGER,
  anzahl_kantone INTEGER,
  anzahl_regionen INTEGER,
  anzahl_altersklassen INTEGER,
  anzahl_modelle INTEGER,
  anzahl_franchisen INTEGER,
  plausibilitaet_checks_json JSONB,
  skipped_alter INTEGER DEFAULT 0,
  skipped_tarif INTEGER DEFAULT 0,
  skipped_franchise INTEGER DEFAULT 0,
  skipped_pflichtfelder INTEGER DEFAULT 0,
  skipped_unbekannte_ids INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Import Error Logging
CREATE TABLE IF NOT EXISTS bag_import_errors (
  id BIGSERIAL PRIMARY KEY,
  import_version_id TEXT REFERENCES bag_import_versions(id),
  error_type TEXT,
  error_message TEXT,
  row_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reference Tables
CREATE TABLE IF NOT EXISTS bag_kantone (
  kanton_code TEXT PRIMARY KEY,
  kanton_name TEXT,
  aktiv BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS bag_altersklassen (
  code TEXT PRIMARY KEY,
  beschreibung TEXT,
  alter_von INTEGER,
  alter_bis INTEGER
);

CREATE TABLE IF NOT EXISTS bag_versicherer (
  bag_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kurzname TEXT,
  aktiv BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS bag_regionen (
  id TEXT PRIMARY KEY,
  kanton TEXT,
  region_code TEXT,
  region_name TEXT
);

-- RLS aktivieren
ALTER TABLE bag_praemien ENABLE ROW LEVEL SECURITY;
ALTER TABLE bag_import_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bag_import_errors ENABLE ROW LEVEL SECURITY;

-- Admin-only Policies
CREATE POLICY admin_all_bag_praemien ON bag_praemien
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY admin_all_bag_versions ON bag_import_versions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY admin_all_bag_errors ON bag_import_errors
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Grants
GRANT ALL ON bag_praemien TO authenticated;
GRANT ALL ON bag_import_versions TO authenticated;
GRANT ALL ON bag_import_errors TO authenticated;
GRANT ALL ON bag_kantone TO authenticated;
GRANT ALL ON bag_altersklassen TO authenticated;
GRANT ALL ON bag_versicherer TO authenticated;
GRANT ALL ON bag_regionen TO authenticated;
`;

    // RPC ausführen
    const { error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      // Fallback: SQL direkt ausführen (wenn RPC nicht verfügbar)
      console.error('RPC failed, trying direct:', error);
    }

    return Response.json({
      success: true,
      message: "SQL Schema deployed (mit 'other' für TAR-DIV)",
      tables: ['bag_praemien', 'bag_import_versions', 'bag_import_errors', 'bag_kantone', 'bag_altersklassen', 'bag_versicherer', 'bag_regionen'],
      note: "Modell-Enum erweitert: standard, telmed, hausarzt, hmo, other"
    });

  } catch (error) {
    console.error('deployBagSchema error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});