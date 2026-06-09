import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * BAG-Prämiendaten zu Supabase importieren
 * 
 * Verwendung:
 * const result = await base44.functions.invoke('importBAGDatenToSupabase', {
 *   records: [...], // Array von BAG-Datensätzen
 *   jahr: 2026,
 *   importModus: 'alle_26' | 'auswahl',
 *   selectedKantone: ['ZH', 'BE', ...]
 * });
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // 1. Authentifizierung prüfen (nur Admins dürfen importieren)
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json(
        { error: 'Nur Admins dürfen BAG-Daten importieren' },
        { status: 403 }
      );
    }

    // 2. Payload entgegennehmen
    const { records, jahr, importModus, selectedKantone } = await req.json();
    
    if (!records || !Array.isArray(records) || records.length === 0) {
      return Response.json(
        { error: 'Keine Datensätze zum Importieren' },
        { status: 400 }
      );
    }

    // 3. Supabase-Clients initialisieren (mit Service Role Key)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return Response.json(
        { error: 'Supabase-Secrets nicht konfiguriert. Bitte SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY in Base44 Secrets eintragen.' },
        { status: 500 }
      );
    }

    const { createClient } = await import('npm:@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false }
    });

    // 4. Import-Version erstellen (für Tracking)
    const importVersionId = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const { error: versionError } = await supabase
      .from('bag_import_versions')
      .insert({
        id: importVersionId,
        versionsnummer: 1, // Wird später auto-increment
        geschaeftsjahr: jahr,
        import_datei_name: `BAG_Import_${jahr}_${now}`,
        importiert_am: now,
        importiert_von: user.email,
        anzahl_records_gesamt: records.length,
        status: 'in_progress'
      });

    if (versionError) {
      console.error('Fehler beim Erstellen der Import-Version:', versionError);
    }

    // 5. Datensätze importieren (Batch-Processing)
    const BATCH_SIZE = 100;
    let erfolgreich = 0;
    let fehler = 0;
    const errors = [];
    const filteredRecords = [];

    // Filtern nach selectedKantone wenn Modus 'auswahl'
    if (importModus === 'auswahl' && selectedKantone && selectedKantone.length > 0) {
      filteredRecords.push(...records.filter(r => selectedKantone.includes(r.kanton)));
    } else {
      filteredRecords.push(...records);
    }

    // Batches verarbeiten
    for (let i = 0; i < filteredRecords.length; i += BATCH_SIZE) {
      const batch = filteredRecords.slice(i, i + BATCH_SIZE);
      
      // enriched Records mit import_metadata
      const enrichedBatch = batch.map(r => ({
        ...r,
        import_version_id: importVersionId,
        importiert_am: now,
        importiert_von: user.email,
        aktiv: true
      }));

      // UPSERT in Supabase (verhindert Duplikate bei gleichen Schlüsseln)
      const { data, error } = await supabase
        .from('bag_praemien')
        .upsert(enrichedBatch, {
          onConflict: 'geschaeftsjahr,krankenkasse,kanton,region,modell,franchise,unfalleinschluss,altersklasse',
          ignoreDuplicates: false // false = aktualisieren, true = überspringen
        })
        .select();

      if (error) {
        fehler += batch.length;
        errors.push({
          batch_index: i,
          error: error.message,
          details: error.details
        });
        console.error(`Batch ${i} fehlgeschlagen:`, error);
      } else {
        erfolgreich += data?.length || batch.length;
      }

      // Rate-Limit Pause (100ms zwischen Batches)
      if (i + BATCH_SIZE < filteredRecords.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // 6. Import-Version aktualisieren
    const { error: updateError } = await supabase
      .from('bag_import_versions')
      .update({
        status: fehler > 0 ? 'completed_with_errors' : 'completed',
        anzahl_records_erfolgreich: erfolgreich,
        anzahl_fehler: fehler,
        validiert: false
      })
      .eq('id', importVersionId);

    if (updateError) {
      console.error('Fehler beim Aktualisieren der Import-Version:', updateError);
    }

    // 7. Ergebnis zurückgeben
    return Response.json({
      success: erfolgreich > 0,
      importVersionId,
      gesamt: filteredRecords.length,
      erfolgreich,
      fehler,
      errors: errors.length > 0 ? errors : null,
      message: `${erfolgreich} von ${filteredRecords.length} Datensätzen erfolgreich importiert`
    });

  } catch (error) {
    console.error('Import-Fehler:', error);
    return Response.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
});