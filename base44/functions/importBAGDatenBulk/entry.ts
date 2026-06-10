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
    const { records, batch_index, total_batches, force_delete_year } = body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return Response.json({ error: 'No records provided' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${supabaseKey}` } }
    });

    // Feldnamen mappen
    const mappedRecords = records.map(r => ({
      geschaeftsjahr:     Number(r.jahr ?? r.geschaeftsjahr),
      krankenkasse:       String(r.krankenkasse),
      kanton:             String(r.kanton),
      region:             String(r.region ?? ''),
      modell:             String(r.modell),
      franchise:          Number(r.franchise),
      unfall:             Boolean(r.unfall ?? false),
      altersklasse:       String(r.altersklasse),
      praemie_erwachsene: Number(r.praemie_erwachsene ?? 0),
      praemie_kinder:     Number(r.praemie_kinder ?? 0),
      geschlecht:         r.geschlecht ?? null,
      alter_von:          r.alter_von != null ? Number(r.alter_von) : null,
      alter_bis:          r.alter_bis != null ? Number(r.alter_bis) : null,
      tarif_original:     r.tarif_original ?? null,
      tariftyp_original:  r.tariftyp_original ?? null,
      tarifbezeichnung:   r.tarifbezeichnung ?? null,
      datenquelle:        r.datenquelle ?? 'BAG',
      importiert_am:      new Date().toISOString(),
      importiert_von:     r.importiert_von ?? null,
      gueltig_ab:         r.gueltig_ab ?? null,
      gueltig_bis:        r.gueltig_bis ?? null,
      aktiv:              true,
    }));

    const jahr = mappedRecords[0]?.geschaeftsjahr;

    // Beim ersten Batch: alle bestehenden Records für dieses Jahr via RPC löschen
    if (batch_index === 0 && jahr) {
      console.log(`Deleting all records for year ${jahr}...`);
      
      // Direkt via REST DELETE mit service role
      const deleteUrl = `${supabaseUrl}/rest/v1/bag_praemien?geschaeftsjahr=eq.${jahr}`;
      const deleteRes = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        }
      });
      
      if (!deleteRes.ok) {
        const errText = await deleteRes.text();
        console.error('DELETE failed:', deleteRes.status, errText);
      } else {
        console.log(`Delete successful for year ${jahr}, status: ${deleteRes.status}`);
      }
    }

    // In 500er Chunks inserieren
    const INTERNAL_BATCH = 500;
    let totalInserted = 0;
    let lastError = null;
    let chunkErrors = 0;

    for (let i = 0; i < mappedRecords.length; i += INTERNAL_BATCH) {
      const chunk = mappedRecords.slice(i, i + INTERNAL_BATCH);

      // Direkt via REST POST mit service role
      const insertUrl = `${supabaseUrl}/rest/v1/bag_praemien`;
      const insertRes = await fetch(insertUrl, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal,resolution=ignore-duplicates'
        },
        body: JSON.stringify(chunk)
      });

      if (!insertRes.ok) {
        const errText = await insertRes.text();
        lastError = errText;
        chunkErrors++;
        console.error(`Chunk ${Math.floor(i/INTERNAL_BATCH)} insert error (${insertRes.status}):`, errText.substring(0, 200));
        continue;
      }

      totalInserted += chunk.length;
    }

    console.log(`Import done: ${totalInserted} inserted, ${chunkErrors} chunk errors`);

    return Response.json({
      success: chunkErrors === 0 || totalInserted > 0,
      inserted: totalInserted,
      total_sent: mappedRecords.length,
      batch_index,
      total_batches,
      chunk_errors: chunkErrors,
      ...(lastError ? { last_error: lastError.substring(0, 500) } : {})
    });

  } catch (error) {
    console.error('importBAGDatenBulk error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});