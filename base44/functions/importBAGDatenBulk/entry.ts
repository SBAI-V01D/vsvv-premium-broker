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

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${supabaseKey}` } }
    });

    // Feldnamen anpassen: frontend sendet "jahr", DB hat "geschaeftsjahr"
    const mappedRecords = records.map(r => ({
      geschaeftsjahr:    r.jahr ?? r.geschaeftsjahr,
      krankenkasse:      r.krankenkasse,
      kanton:            r.kanton,
      region:            r.region ?? '',
      modell:            r.modell,
      franchise:         r.franchise,
      unfall:            r.unfall ?? false,
      altersklasse:      r.altersklasse,
      praemie_erwachsene: r.praemie_erwachsene ?? 0,
      praemie_kinder:    r.praemie_kinder ?? 0,
      geschlecht:        r.geschlecht ?? null,
      alter_von:         r.alter_von ?? null,
      alter_bis:         r.alter_bis ?? null,
      tarif_original:    r.tarif_original ?? null,
      tariftyp_original: r.tariftyp_original ?? null,
      tarifbezeichnung:  r.tarifbezeichnung ?? null,
      datenquelle:       r.datenquelle ?? 'BAG',
      importiert_am:     r.importiert_am ?? new Date().toISOString(),
      importiert_von:    r.importiert_von ?? null,
      gueltig_ab:        r.gueltig_ab ?? null,
      gueltig_bis:       r.gueltig_bis ?? null,
      aktiv:             r.aktiv ?? true,
    }));

    // Upsert mit korrektem unique constraint: geschaeftsjahr,krankenkasse,kanton,region,modell,franchise,unfall,altersklasse
    const { error } = await supabase
      .from('bag_praemien')
      .upsert(mappedRecords, {
        onConflict: 'geschaeftsjahr,krankenkasse,kanton,region,modell,franchise,unfall,altersklasse',
        ignoreDuplicates: false
      });

    if (error) {
      // Fallback: insert ohne conflict-handling
      const { error: insertError } = await supabase
        .from('bag_praemien')
        .insert(mappedRecords);

      if (insertError) {
        return Response.json({ error: insertError.message, batch_index }, { status: 500 });
      }
    }

    return Response.json({
      success: true,
      inserted: mappedRecords.length,
      batch_index,
      total_batches
    });

  } catch (error) {
    console.error('importBAGDatenBulk error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});