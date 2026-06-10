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

    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'count=exact'
    };

    // Count records in bag_praemien
    const countRes = await fetch(`${supabaseUrl}/rest/v1/bag_praemien?select=id&limit=1`, {
      headers: { ...headers, 'Prefer': 'count=exact' }
    });

    let record_count = 0;
    let table_exists = false;

    if (countRes.ok) {
      table_exists = true;
      const contentRange = countRes.headers.get('content-range');
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)$/);
        if (match) record_count = parseInt(match[1]);
      }
    } else if (countRes.status === 404 || countRes.status === 400) {
      table_exists = false;
    }

    // Recent imports
    const importsRes = await fetch(
      `${supabaseUrl}/rest/v1/bag_import_versions?select=*&order=created_at.desc&limit=5`,
      { headers }
    );
    const recent_imports = importsRes.ok ? await importsRes.json() : [];

    return Response.json({
      table_exists,
      record_count,
      import_error: null,
      recent_imports: Array.isArray(recent_imports) ? recent_imports : [],
    });

  } catch (err) {
    console.error('checkBAGTable error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});