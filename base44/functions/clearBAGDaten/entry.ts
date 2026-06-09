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

    // Alle BAG-Prämiendaten löschen (2026)
    const { error } = await supabase
      .from('bag_praemien')
      .delete()
      .eq('geschaeftsjahr', 2026);

    if (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }

    // Import-Versionen auch löschen
    await supabase
      .from('bag_import_versions')
      .delete()
      .eq('geschaeftsjahr', 2026);

    return Response.json({
      success: true,
      message: 'Alle BAG-Daten (2026) wurden gelöscht',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('clearBAGDaten error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});