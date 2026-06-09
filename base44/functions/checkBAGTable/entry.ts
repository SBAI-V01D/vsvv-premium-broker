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

    // Prüfe ob Tabelle existiert
    const { data: tables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'bag_praemien');

    const tableExists = tables && tables.length > 0;

    // Wenn Tabelle existiert, zähle Datensätze
    let count = 0;
    let error = null;
    if (tableExists) {
      try {
        const { count: c } = await supabase
          .from('bag_praemien')
          .select('*', { count: 'exact', head: true });
        count = c || 0;
      } catch (e) {
        error = e.message;
      }
    }

    // Prüfe bag_import_versions
    const { data: imports } = await supabase
      .from('bag_import_versions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    return Response.json({
      table_exists: tableExists,
      record_count: count,
      import_error: error,
      recent_imports: imports || [],
    });

  } catch (err) {
    console.error('checkBAGTable error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});