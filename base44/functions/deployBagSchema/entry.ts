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

    // Supabase Management API - direkte SQL-Ausführung via REST
    // Extrahiere Project-ID aus der URL: https://xxxxx.supabase.co
    const projectId = supabaseUrl.replace('https://', '').split('.')[0];
    const managementUrl = `https://api.supabase.com/v1/projects/${projectId}/database/query`;

    const sql = `
CREATE TABLE IF NOT EXISTS bag_praemien (
  id BIGSERIAL PRIMARY KEY,
  geschaeftsjahr INTEGER NOT NULL,
  krankenkasse TEXT NOT NULL,
  kanton TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT '',
  modell TEXT NOT NULL,
  franchise INTEGER NOT NULL,
  unfall BOOLEAN NOT NULL DEFAULT false,
  altersklasse TEXT NOT NULL,
  praemie_erwachsene NUMERIC(10,2) NOT NULL DEFAULT 0,
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

CREATE UNIQUE INDEX IF NOT EXISTS unique_bag_record 
ON bag_praemien(geschaeftsjahr, krankenkasse, kanton, region, modell, franchise, unfall, altersklasse);

CREATE INDEX IF NOT EXISTS idx_bag_praemien_jahr ON bag_praemien(geschaeftsjahr);
CREATE INDEX IF NOT EXISTS idx_bag_praemien_kanton ON bag_praemien(kanton);
CREATE INDEX IF NOT EXISTS idx_bag_praemien_kasse ON bag_praemien(krankenkasse);
CREATE INDEX IF NOT EXISTS idx_bag_praemien_modell ON bag_praemien(modell);
CREATE INDEX IF NOT EXISTS idx_bag_praemien_franchise ON bag_praemien(franchise);

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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bag_import_errors (
  id BIGSERIAL PRIMARY KEY,
  import_version_id TEXT,
  error_type TEXT,
  error_message TEXT,
  row_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT ALL ON bag_praemien TO authenticated, service_role;
GRANT ALL ON bag_import_versions TO authenticated, service_role;
GRANT ALL ON bag_import_errors TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
`;

    // Versuche Management API
    const response = await fetch(managementUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      const errText = await response.text();
      
      // Fallback: Supabase REST API mit service_role für einzelne Statements
      // Wir nutzen die Postgres REST endpoint
      const pgUrl = `${supabaseUrl}/rest/v1/rpc/exec_sql`;
      
      return Response.json({
        success: false,
        error: `Management API nicht verfügbar (${response.status}): ${errText}`,
        instruction: 'Bitte führe das SQL-Schema manuell im Supabase Dashboard aus (SQL Editor)',
        sql_snippet: 'CREATE TABLE IF NOT EXISTS bag_praemien ...',
        management_url_attempted: managementUrl
      }, { status: 500 });
    }

    const result = await response.json();

    return Response.json({
      success: true,
      message: 'BAG Schema erfolgreich deployed',
      result
    });

  } catch (error) {
    console.error('deployBagSchema error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});