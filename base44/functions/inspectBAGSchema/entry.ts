/**
 * inspectBAGSchema
 * Prüft die Spaltennamen der bag_praemien Tabelle
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return Response.json({ error: 'Supabase credentials missing' }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // Spaltennamen abfragen
    const { data: columns, error } = await supabase
      .from('bag_praemien')
      .select('*')
      .limit(1);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    // Spaltennamen aus erster Row extrahieren
    const columnNames = columns && columns.length > 0 
      ? Object.keys(columns[0])
      : [];

    return Response.json({
      success: true,
      column_names: columnNames,
      sample_record: columns?.[0] || null,
      message: `bag_praemien Tabelle hat ${columnNames.length} Spalten`
    });

  } catch (error) {
    console.error('inspectBAGSchema error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});