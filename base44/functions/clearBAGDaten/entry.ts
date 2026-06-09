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

    // Direkter SQL TRUNCATE für schnelles Löschen
    const { error } = await supabase.rpc('exec_sql', {
      sql: `TRUNCATE TABLE bag_praemien RESTART IDENTITY CASCADE;
            TRUNCATE TABLE bag_import_versions RESTART IDENTITY CASCADE;
            TRUNCATE TABLE bag_import_errors RESTART IDENTITY CASCADE;`
    });

    if (error) {
      // Fallback: DELETE statt TRUNCATE
      await supabase.from('bag_praemien').delete();
      await supabase.from('bag_import_versions').delete();
      await supabase.from('bag_import_errors').delete();
    }

    return Response.json({
      success: true,
      message: 'Alle BAG-Daten wurden gelöscht',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('clearBAGDaten error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});