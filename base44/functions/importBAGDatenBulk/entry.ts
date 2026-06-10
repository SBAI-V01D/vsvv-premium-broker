import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { createClient } from 'npm:@supabase/supabase-js@2';

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

    const body = await req.json();
    const { records, batch_index, total_batches } = body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return Response.json({ error: 'No records provided' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Bulk upsert direkt in Supabase — sehr schnell, kein Rate-Limit
    const { data, error } = await supabase
      .from('bag_praemien')
      .upsert(records, {
        onConflict: 'geschaeftsjahr,krankenkasse,kanton,region,modell,franchise,unfalleinschluss,altersklasse',
        ignoreDuplicates: false
      });

    if (error) {
      // Fallback: einfaches insert ohne upsert (falls unique constraint nicht existiert)
      const { error: insertError } = await supabase
        .from('bag_praemien')
        .insert(records);

      if (insertError) {
        return Response.json({ error: insertError.message, batch_index }, { status: 500 });
      }
    }

    return Response.json({
      success: true,
      inserted: records.length,
      batch_index,
      total_batches
    });

  } catch (error) {
    console.error('importBAGDatenBulk error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});