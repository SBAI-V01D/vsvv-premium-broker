/**
 * importBAGDatenLive
 * Automatischer Import aller BAG-Prämiendaten von PrimAI API (api.primai.ch)
 * - Ruft Daten für alle PLZ-Regionen (1, 2, 3) und alle Franchisen (0-2500) ab
 * - Speichert in Supabase Tabelle bag_praemien (UPSERT)
 * - Als scheduled Automation monatlich ausführbar
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

// Retry-Utility mit Backoff (für 429/5xx Fehler)
async function fetchWithRetry(url: string, maxRetries = 3, baseDelay = 2000) {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'VSVV-CRM-BAG-Importer/1.0' },
      });
      
      // Bei 429: Retry-After Header respektieren
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '2', 10) * 1000;
        console.log(`Rate limit (429). Warte ${retryAfter}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter));
        continue;
      }
      
      // Bei 5xx: Exponential Backoff
      if (res.status >= 500 && res.status < 600) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`Server error (${res.status}). Retry ${attempt}/${maxRetries} in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return res;
    } catch (error) {
      lastError = error as Error;
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`Network error. Retry ${attempt}/${maxRetries} in ${delay}ms: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

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
      api_success: 0,
      api_errors: 0,
      db_inserted: 0,
      db_errors: 0
    };

    const errorLog: Array<{
      plz: string;
      kanton: string;
      franchise: number;
      altersklasse: string;
      unfall: boolean;
      error: string;
      status?: number;
    }> = [];

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
                  
                  // Retry-Logic für API Calls
                  const res = await fetchWithRetry(url, 3, 2000);

                  if (!res.ok) {
                    stats.api_errors++;
                    errorLog.push({
                      plz, kanton, franchise, altersklasse, unfall,
                      error: `API error: ${res.status}`,
                      status: res.status
                    });
                    console.error(`API Error [${res.status}] für PLZ ${plz}, Franchise ${franchise}`);
                    continue;
                  }

                  const data = await res.json();
                  stats.api_success++;
                  
                  if (!data.offers || data.offers.length === 0) {
                    continue;
                  }

                  // Angebote für diese Kombination verarbeiten
                  for (const offer of data.offers) {
                    // Modell mappen (Kategorie für Filter)
                    const modellLabel = offer.model?.toLowerCase() || '';
                    let modell = 'standard';
                    if (modellLabel.includes('hmo')) modell = 'hmo';
                    else if (modellLabel.includes('hausarzt') || modellLabel.includes('medbase') || modellLabel.includes('contact')) modell = 'hausarzt';
                    else if (modellLabel !== 'standard' && !modellLabel.includes('freie arztwahl')) modell = 'telmed';

                    // Prämie immer setzen (NOT NULL Constraint)
                    const praemie = offer.price?.total || 0;
                    
                    // Record erstellen (MIT spezifischem Produkt-Label)
                    const record = {
                      geschaeftsjahr: JAHR,
                      krankenkasse: offer.insurer,
                      kanton: kanton,
                      region: region,
                      modell: modell,
                      modell_label: offer.model || `${modell} (Standard)`, // Spezifisches Produkt
                      franchise: franchise,
                      unfall: unfall,
                      altersklasse: altersklasse,
                      praemie_erwachsene: praemie,
                      praemie_kinder: praemie,
                      geschlecht: 'm',
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
                    stats.db_inserted++;
                  }

                } catch (error) {
                  stats.api_errors++;
                  errorLog.push({
                    plz, kanton, franchise, altersklasse, unfall,
                    error: error.message
                  });
                  console.error(`Error bei PLZ ${plz}, Franchise ${franchise}: ${error.message}`);
                }
              }
            }
          }
        }
      }
    }

    console.log('Records gesammelt:', recordsToInsert.length);

    // Batch-Insert in Supabase (200er Blöcke für mehr Stabilität)
    const BATCH_SIZE = 200;
    let batchCount = 0;

    for (let i = 0; i < recordsToInsert.length; i += BATCH_SIZE) {
      batchCount++;
      const batch = recordsToInsert.slice(i, i + BATCH_SIZE);
      
      console.log(`Insertiere Batch ${batchCount} (${batch.length} Records)...`);

      // UPSERT Logic: 9-Feld Unique Constraint (inkl. modell_label)
      const { error } = await supabase
        .from('bag_praemien')
        .upsert(batch, {
          onConflict: 'geschaeftsjahr,krankenkasse,kanton,region,modell,modell_label,franchise,unfall,altersklasse'
        });

      if (error) {
        stats.db_errors += batch.length;
        errorLog.push({
          plz: 'BATCH',
          kanton: 'BATCH',
          franchise: batch.length,
          altersklasse: 'N/A',
          unfall: false,
          error: `DB error: ${error.message}`
        });
        console.error('Batch Insert Error:', error.message);
      } else {
        stats.db_inserted += batch.length;
      }

      // Rate Limiting: 200ms Pause zwischen Batches
      if (i + BATCH_SIZE < recordsToInsert.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log('Import abgeschlossen!');
    console.log('Total Kombinationen:', stats.total);
    console.log('API Success:', stats.api_success);
    console.log('API Errors:', stats.api_errors);
    console.log('DB Records:', stats.db_inserted);
    console.log('DB Errors:', stats.db_errors);
    
    if (errorLog.length > 0) {
      console.log('Fehler-Details:', JSON.stringify(errorLog.slice(0, 10), null, 2));
      console.log(`... und ${errorLog.length - 10} weitere Fehler`);
    }

    return Response.json({
      success: true,
      stats: {
        total_combinations: stats.total,
        api_success: stats.api_success,
        api_errors: stats.api_errors,
        db_records: stats.db_inserted,
        db_errors: stats.db_errors,
        total_errors: errorLog.length
      },
      error_log: errorLog.slice(0, 50), // Erste 50 Fehler für Debugging
      message: `BAG-Daten für ${JAHR} importiert: ${stats.db_inserted} Records, ${errorLog.length} Fehler`
    });

  } catch (error) {
    console.error('importBAGDatenLive error:', error);
    return Response.json({ 
      error: error.message,
      stats: { total: 0, inserted: 0, updated: 0, errors: 1 }
    }, { status: 500 });
  }
});