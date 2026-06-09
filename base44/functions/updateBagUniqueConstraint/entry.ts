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

    // SQL: Unique Constraint erweitern um 'unfall'
    const sql = `
-- Drop old unique constraint
ALTER TABLE bag_praemien DROP CONSTRAINT IF EXISTS unique_bag_record;

-- Add new unique constraint including 'unfall'
ALTER TABLE bag_praemien
ADD CONSTRAINT unique_bag_record
UNIQUE (geschaeftsjahr, krankenkasse, kanton, region, modell, franchise, unfall, altersklasse);
`;

    const { error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      throw new Error(`SQL failed: ${error.message}`);
    }

    return Response.json({
      success: true,
      message: 'Unique Constraint aktualisiert: unfall ist jetzt Teil des Composite Keys',
      note: 'MIT-UNF und OHNE-UNF können jetzt beide gespeichert werden'
    });

  } catch (error) {
    console.error('updateBagUniqueConstraint error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});