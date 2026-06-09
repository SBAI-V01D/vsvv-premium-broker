import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * BAG-Prämiendaten aus Supabase abfragen
 * 
 * Verwendung:
 * const data = await base44.functions.invoke('queryBAGPraemien', {
 *   jahr: 2026,
 *   kanton: 'ZH',
 *   altersklasse: 'erwachsen',
 *   modell: 'standard',
 *   franchise: 300
 * });
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // 1. Authentifizierung prüfen
    const user = await base44.auth.me();
    if (!user) {
      return Response.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Query-Parameter entgegennehmen
    const { jahr, kanton, altersklasse, modell, franchise, limit = 1000 } = await req.json();

    // 3. Supabase-Clients initialisieren
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return Response.json(
        { error: 'Supabase-Secrets nicht konfiguriert' },
        { status: 500 }
      );
    }

    const { createClient } = await import('npm:@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false }
    });

    // 4. Query aufbauen
    let query = supabase
      .from('bag_praemien')
      .select('*')
      .eq('aktiv', true);

    if (jahr) query = query.eq('geschaeftsjahr', jahr);
    if (kanton) query = query.eq('kanton', kanton);
    if (altersklasse) query = query.eq('altersklasse', altersklasse);
    if (modell) query = query.eq('modell', modell);
    if (franchise) query = query.eq('franchise', franchise);

    query = query.limit(limit);

    // 5. Query ausführen
    const { data, error } = await query;

    if (error) {
      return Response.json(
        { error: error.message, details: error.details },
        { status: 500 }
      );
    }

    // 6. Ergebnis zurückgeben
    return Response.json({
      data: data || [],
      count: data?.length || 0,
      query: { jahr, kanton, altersklasse, modell, franchise }
    });

  } catch (error) {
    console.error('Query-Fehler:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});