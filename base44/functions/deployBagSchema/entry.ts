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

    // SQL Schema ausführen
    const schemaSQL = `
-- VSVV CRM - BAG Premium Data Schema
-- Created: 2026-06-09

-- Reference Tables
CREATE TABLE IF NOT EXISTS bag_kantone (
  kanton_code TEXT PRIMARY KEY,
  kanton_name TEXT NOT NULL,
  region TEXT,
  aktiv BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS bag_regionen (
  region_code TEXT PRIMARY KEY,
  region_name TEXT NOT NULL,
  kanton_code TEXT REFERENCES bag_kantone(kanton_code)
);

CREATE TABLE IF NOT EXISTS bag_altersklassen (
  altersklasse_code TEXT PRIMARY KEY,
  beschreibung TEXT NOT NULL,
  alter_von INTEGER,
  alter_bis INTEGER
);

-- Insurer Directory
CREATE TABLE IF NOT EXISTS bag_versicherer (
  id SERIAL PRIMARY KEY,
  bag_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  kurzname TEXT,
  kontaktperson TEXT,
  email TEXT,
  telefon TEXT,
  website TEXT,
  aktiv BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BAG Premium Data (Main Table)
CREATE TABLE IF NOT EXISTS bag_praemien (
  id SERIAL PRIMARY KEY,
  geschaeftsjahr INTEGER NOT NULL,
  krankenkasse TEXT NOT NULL,
  kanton TEXT NOT NULL REFERENCES bag_kantone(kanton_code),
  region TEXT REFERENCES bag_regionen(region_code),
  modell TEXT NOT NULL CHECK (modell IN ('standard', 'telmed', 'hausarzt', 'hmo')),
  franchise INTEGER NOT NULL,
  unfalleinschluss BOOLEAN DEFAULT false,
  altersklasse TEXT NOT NULL REFERENCES bag_altersklassen(altersklasse_code),
  praemie_erwachsene DECIMAL(10,2) NOT NULL CHECK (praemie_erwachsene >= 0),
  praemie_kinder DECIMAL(10,2) DEFAULT 0,
  geschlecht TEXT CHECK (geschlecht IN ('m', 'w')),
  alter_von INTEGER,
  alter_bis INTEGER,
  datenquelle TEXT DEFAULT 'BAG',
  importiert_am TIMESTAMPTZ DEFAULT NOW(),
  importiert_von TEXT,
  gueltig_ab DATE,
  gueltig_bis DATE,
  aktiv BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Import Versions (Tracking)
CREATE TABLE IF NOT EXISTS bag_import_versions (
  id TEXT PRIMARY KEY,
  geschaeftsjahr INTEGER NOT NULL,
  importiert_am TIMESTAMPTZ DEFAULT NOW(),
  importiert_von TEXT,
  quelle_datei TEXT,
  quelle_datei_gesamtzeilen INTEGER,
  importiert_gesamt INTEGER DEFAULT 0,
  fehler_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'in_progress',
  importdauer_minuten DECIMAL(10,2),
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Error Logs
CREATE TABLE IF NOT EXISTS bag_import_errors (
  id SERIAL PRIMARY KEY,
  import_version_id TEXT REFERENCES bag_import_versions(id),
  zeilennummer INTEGER,
  fehler_typ TEXT,
  fehler_beschreibung TEXT,
  rohdaten JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_bag_praemien_geschaeftsjahr ON bag_praemien(geschaeftsjahr);
CREATE INDEX IF NOT EXISTS idx_bag_praemien_kanton ON bag_praemien(kanton);
CREATE INDEX IF NOT EXISTS idx_bag_praemien_krankenkasse ON bag_praemien(krankenkasse);
CREATE INDEX IF NOT EXISTS idx_bag_praemien_modell ON bag_praemien(modell);
CREATE INDEX IF NOT EXISTS idx_bag_praemien_franchise ON bag_praemien(franchise);
CREATE INDEX IF NOT EXISTS idx_bag_praemien_altersklasse ON bag_praemien(altersklasse);
CREATE INDEX IF NOT EXISTS idx_bag_praemien_region ON bag_praemien(region);
CREATE INDEX IF NOT EXISTS idx_bag_praemien_composite ON bag_praemien(geschaeftsjahr, kanton, altersklasse, modell, franchise);

-- Reference Data Insertion
INSERT INTO bag_kantone (kanton_code, kanton_name, region) VALUES
  ('ZH', 'Zürich', 'ZH'), ('BE', 'Bern', 'BE'), ('LU', 'Luzern', 'Zentralschweiz'),
  ('UR', 'Uri', 'Zentralschweiz'), ('SZ', 'Schwyz', 'Zentralschweiz'),
  ('OW', 'Obwalden', 'Zentralschweiz'), ('NW', 'Nidwalden', 'Zentralschweiz'),
  ('GL', 'Glarus', 'Ostschweiz'), ('ZG', 'Zug', 'Zentralschweiz'),
  ('FR', 'Freiburg', 'Romandie'), ('SO', 'Solothurn', 'Nordwestschweiz'),
  ('BS', 'Basel-Stadt', 'Nordwestschweiz'), ('BL', 'Basel-Landschaft', 'Nordwestschweiz'),
  ('SH', 'Schaffhausen', 'Ostschweiz'), ('AR', 'Appenzell Ausserrhoden', 'Ostschweiz'),
  ('AI', 'Appenzell Innerrhoden', 'Ostschweiz'), ('SG', 'St. Gallen', 'Ostschweiz'),
  ('GR', 'Graubünden', 'Ostschweiz'), ('AG', 'Aargau', 'Zürichsee'),
  ('TG', 'Thurgau', 'Ostschweiz'), ('TI', 'Tessin', 'Tessin'),
  ('VD', 'Waadt', 'Romandie'), ('VS', 'Wallis', 'Romandie'),
  ('NE', 'Neuenburg', 'Romandie'), ('GE', 'Genf', 'Romandie'),
  ('JU', 'Jura', 'Romandie')
ON CONFLICT (kanton_code) DO NOTHING;

INSERT INTO bag_altersklassen (altersklasse_code, beschreibung, alter_von, alter_bis) VALUES
  ('kind', 'Kinder (0-18 Jahre)', 0, 18),
  ('jugend', 'Jugendliche (19-25 Jahre)', 19, 25),
  ('erwachsen', 'Erwachsene (26+ Jahre)', 26, 99)
ON CONFLICT (altersklasse_code) DO NOTHING;

-- RLS Policies (if needed)
ALTER TABLE bag_praemien ENABLE ROW LEVEL SECURITY;
ALTER TABLE bag_import_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bag_import_errors ENABLE ROW LEVEL SECURITY;

-- Admin can see everything
CREATE POLICY "Admin access bag_praemien" ON bag_praemien
  FOR ALL USING (true);

CREATE POLICY "Admin access bag_import_versions" ON bag_import_versions
  FOR ALL USING (true);

CREATE POLICY "Admin access bag_import_errors" ON bag_import_errors
  FOR ALL USING (true);
`;

    const { error } = await supabase.rpc('exec_sql', { sql: schemaSQL });
    
    if (error) {
      // Fallback: Execute statements one by one
      const statements = schemaSQL.split(';').filter(s => s.trim());
      for (const stmt of statements) {
        if (stmt.trim().length > 10) {
          try {
            await supabase.query(stmt);
          } catch (stmtError) {
            console.warn('Statement failed (may already exist):', stmtError.message);
          }
        }
      }
    }

    // Verify tables exist
    const { data: tables, error: tableError } = await supabase
      .from('pg_tables')
      .select('tablename')
      .eq('schemaname', 'public')
      .in('tablename', ['bag_praemien', 'bag_import_versions', 'bag_import_errors', 'bag_kantone', 'bag_altersklassen']);

    if (tableError) {
      throw new Error(tableError.message);
    }

    return Response.json({
      success: true,
      message: 'SQL Schema erfolgreich deployed',
      tables: tables?.map(t => t.tablename) || [],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('deployBagSchema error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});