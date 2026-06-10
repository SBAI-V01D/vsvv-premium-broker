/**
 * importBAGDatenLive
 * Automatischer Import aller BAG-Prämiendaten von PrimAI API (api.primai.ch)
 * - Ruft Daten für alle PLZ-Regionen (1, 2, 3) und alle Franchisen (0-2500) ab
 * - Speichert in Supabase Tabelle bag_praemien (UPSERT)
 * - Als scheduled Automation monatlich ausführbar
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Admin-only für automatische Imports
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return Response.json({ error: 'Supabase credentials missing' }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // Konfiguration
    const JAHR = 2026;
    const FRANCHISEN = [0, 100, 200, 300, 400, 500, 600, 1000, 1500, 2000, 2500];
    
    // Representative PLZ für jede Region
    const PLZ_REGIONEN = {
      '1': ['8001', '3011', '4051', '1201'], // Städte (ZH, BE, BS, GE)
      '2': ['4304', '8032', '3004'], // Agglomeration
      '3': ['6300', '9000', '7000'] // Ländlich
    };

    const KANTONE = [
      'ZH', 'BE', 'LU', 'UR', 'SZ', 'OW', 'NW', 'GL', 'ZG', 'FR', 'SO', 'BS', 'BL', 'SH', 'AR', 'AI', 'SG', 'GR', 'AG', 'TG', 'TI', 'VD', 'VS', 'NE', 'GE', 'JU'
    ];

    const ALTERS_KLASSEN = ['kind', 'jugend', 'erwachsen'];
    const UNFALL_OPTIONEN = [true, false];

    const stats = {
      total: 0,
      inserted: 0,
      updated: 0,
      errors: 0
    };

    const recordsToInsert = [];

    console.log('Starte BAG-Import für Jahr', JAHR);
    console.log('Regionen:', Object.keys(PLZ_REGIONEN).length);
    console.log('Franchisen:', FRANCHISEN.length);
    console.log('Kantone:', KANTONE.length);

    // Durch alle Kombinationen iterieren
    for (const region of Object.keys(PLZ_REGIONEN)) {
      for (const plz of PLZ_REGIONEN[region]) {
        for (const kanton of KANTONE) {
          for (const franchise of FRANCHISEN) {
            for (const altersklasse of ALTERS_KLASSEN) {
              for (const unfall of UNFALL_OPTIONEN) {
                stats.total++;
                
                // Geburtsjahr basierend auf Altersklasse
                let yob;
                if (altersklasse === 'kind') yob = 2020; // ~6 Jahre alt
                else if (altersklasse === 'jugend') yob = 2005; // ~21 Jahre alt
                else yob = 1980; // ~46 Jahre alt

                try {
                  const params = new URLSearchParams({
                    plz: plz,
                    yob: String(yob),
                    deductible: String(franchise),
                    accident: String(unfall),
                    limit: '500'
                  });

                  const url = `https://api.primai.ch/v1/compare?${params.toString()}`;
                  const res = await fetch(url, {
                    headers: { 'Accept': 'application/json', 'User-Agent': 'VSVV-CRM-BAG-Importer/1.0' }
                  });

                  if (!res.ok) {
                    stats.errors++;
                    console.error('API Error für PLZ', plz, 'Franchise', franchise, res.status);
                    continue;
                  }

                  const data = await res.json();
                  
                  if (!data.offers || data.offers.length === 0) {
                    continue;
                  }

                  // Angebote für diese Kombination verarbeiten
                  for (const offer of data.offers) {
                    // Modell mappen
                    const modellLabel = offer.model?.toLowerCase() || '';
                    let modell = 'standard';
                    if (modellLabel.includes('hmo')) modell = 'hmo';
                    else if (modellLabel.includes('hausarzt') || modellLabel.includes('medbase') || modellLabel.includes('contact')) modell = 'hausarzt';
                    else if (modellLabel !== 'standard' && !modellLabel.includes('freie arztwahl')) modell = 'telmed';

                    // Record erstellen
                    const record = {
                      jahr: JAHR,
                      krankenkasse: offer.insurer,
                      kanton: kanton,
                      region: region,
                      modell: modell,
                      franchise: franchise,
                      unfall: unfall,
                      altersklasse: altersklasse,
                      praemie_erwachsene: altersklasse === 'erwachsen' ? (offer.price?.total || 0) : null,
                      praemie_kinder: altersklasse === 'kind' ? (offer.price?.total || 0) : null,
                      geschlecht: 'm', // Standard (kann erweitert werden)
                      alter_von: altersklasse === 'kind' ? 0 : altersklasse === 'jugend' ? 19 : 26,
                      alter_bis: altersklasse === 'kind' ? 18 : altersklasse === 'jugend' ? 25 : 99,
                      datenquelle: 'BAG',
                      importiert_am: new Date().toISOString(),
                      importiert_von: user.email,
                      gueltig_ab: `${JAHR}-01-01`,
                      gueltig_bis: `${JAHR}-12-31`,
                      aktiv: true
                    };

                    recordsToInsert.push(record);
                    stats.inserted++;
                  }

                } catch (error) {
                  stats.errors++;
                  console.error('Error bei PLZ', plz, 'Franchise', franchise, error.message);
                }
              }
            }
          }
        }
      }
    }

    console.log('Records gesammelt:', recordsToInsert.length);

    // Batch-Insert in Supabase (500er Blöcke)
    const BATCH_SIZE = 500;
    let batchCount = 0;

    for (let i = 0; i < recordsToInsert.length; i += BATCH_SIZE) {
      batchCount++;
      const batch = recordsToInsert.slice(i, i + BATCH_SIZE);
      
      console.log(`Insertiere Batch ${batchCount} (${batch.length} Records)...`);

      // UPSERT Logic: Verwende insert mit onConflict
      const { error } = await supabase
        .from('bag_praemien')
        .upsert(batch, {
          onConflict: 'jahr,krankenkasse,kanton,region,modell,franchise,unfall,altersklasse'
        });

      if (error) {
        stats.errors += batch.length;
        console.error('Batch Insert Error:', error.message);
      } else {
        stats.updated += batch.length;
      }

      // Rate Limiting: 100ms Pause zwischen Batches
      if (i + BATCH_SIZE < recordsToInsert.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('Import abgeschlossen!');
    console.log('Total:', stats.total);
    console.log('Inserted/Updated:', stats.updated);
    console.log('Errors:', stats.errors);

    return Response.json({
      success: true,
      stats: {
        total_combinations: stats.total,
        records_inserted: stats.updated,
        errors: stats.errors
      },
      message: `BAG-Daten für ${JAHR} erfolgreich importiert (${stats.updated} Records)`
    });

  } catch (error) {
    console.error('importBAGDatenLive error:', error);
    return Response.json({ 
      error: error.message,
      stats: { total: 0, inserted: 0, updated: 0, errors: 1 }
    }, { status: 500 });
  }
});