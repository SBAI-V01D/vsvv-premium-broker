import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { jahr, kanton, altersklasse, modell, franchise, limit = 5000 } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      return Response.json({ error: 'Supabase-Secrets nicht konfiguriert' }, { status: 500 });
    }

    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    };

    // Query-Parameter zusammenbauen
    const params = new URLSearchParams();
    params.set('aktiv', 'eq.true');
    params.set('limit', String(limit));
    params.set('select', '*');
    if (jahr) params.append('geschaeftsjahr', `eq.${jahr}`);
    if (kanton) params.append('kanton', `eq.${kanton}`);
    if (altersklasse) params.append('altersklasse', `eq.${altersklasse}`);
    if (modell) params.append('modell', `eq.${modell}`);
    if (franchise) params.append('franchise', `eq.${franchise}`);

    const url = `${supabaseUrl}/rest/v1/bag_praemien?${params.toString()}`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Supabase query error:', res.status, errText);
      return Response.json({ error: errText, data: [], count: 0 }, { status: 500 });
    }

    const data = await res.json();

    return Response.json({
      data: Array.isArray(data) ? data : [],
      count: Array.isArray(data) ? data.length : 0,
      query: { jahr, kanton, altersklasse, modell, franchise }
    });

  } catch (error) {
    console.error('queryBAGPraemien error:', error);
    return Response.json({ error: error.message, data: [], count: 0 }, { status: 500 });
  }
});