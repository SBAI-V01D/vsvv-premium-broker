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

    // Direkter DELETE über Supabase API (löscht alle Records)
    const { error } = await supabase.from('bag_praemien').delete().neq('id', 0);

    if (error) {
      throw new Error(`DELETE failed: ${error.message}`);
    }

    // Auch Import-Versions und Errors löschen
    await supabase.from('bag_import_versions').delete().neq('id', 0);
    await supabase.from('bag_import_errors').delete().neq('id', 0);

    return Response.json({
      success: true,
      message: 'Alle BAG-Daten wurden gelöscht',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('deleteAllBAGDatenOptimized error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});