import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * BAG-Import validieren
 * 
 * Verwendung:
 * const validation = await base44.functions.invoke('validateBAGImport', {
 *   importVersionId: 'uuid-1234'
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

    // 2. Payload entgegennehmen
    const { importVersionId } = await req.json();

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

    // 4. Import-Version laden
    const { data: versionData, error: versionError } = await supabase
      .from('bag_import_versions')
      .select('*')
      .eq('id', importVersionId)
      .single();

    if (versionError || !versionData) {
      return Response.json(
        { error: 'Import-Version nicht gefunden', details: versionError?.message },
        { status: 404 }
      );
    }

    // 5. Validierungs-Checks durchführen
    const checks = [];
    let allValid = true;

    // Check 1: Record-Count
    const { count } = await supabase
      .from('bag_praemien')
      .select('*', { count: 'exact', head: true })
      .eq('import_version_id', importVersionId);

    checks.push({
      name: 'record_count',
      passed: count === versionData.anzahl_records_erfolgreich,
      expected: versionData.anzahl_records_erfolgreich,
      actual: count
    });

    if (count !== versionData.anzahl_records_erfolgreich) allValid = false;

    // Check 2: Alle Altersklassen vorhanden
    const { data: altersklassen } = await supabase
      .from('bag_praemien')
      .select('altersklasse', { distinct: true })
      .eq('import_version_id', importVersionId);

    const expectedAltersklassen = ['kind', 'jugend', 'erwachsen'];
    const foundAltersklassen = altersklassen?.map(a => a.altersklasse) || [];
    const hasAllAltersklassen = expectedAltersklassen.every(a => foundAltersklassen.includes(a));

    checks.push({
      name: 'altersklassen_complete',
      passed: hasAllAltersklassen,
      expected: expectedAltersklassen,
      actual: foundAltersklassen
    });

    if (!hasAllAltersklassen) allValid = false;

    // Check 3: Alle Modell-Typen vorhanden
    const { data: modelle } = await supabase
      .from('bag_praemien')
      .select('modell', { distinct: true })
      .eq('import_version_id', importVersionId);

    const expectedModelle = ['standard', 'telmed', 'hausarzt', 'hmo'];
    const foundModelle = modelle?.map(m => m.modell) || [];
    const hasAllModelle = expectedModelle.every(m => foundModelle.includes(m));

    checks.push({
      name: 'modelle_complete',
      passed: hasAllModelle,
      expected: expectedModelle,
      actual: foundModelle
    });

    if (!hasAllModelle) allValid = false;

    // Check 4: Plausibilität Prämiendaten
    const { data: praemienStats } = await supabase.rpc('get_praemie_stats', {
      import_version_id_param: importVersionId
    });

    const praemienPlausibel = praemienStats?.min > 0 && praemienStats?.max < 2000;

    checks.push({
      name: 'praemien_plausibel',
      passed: praemienPlausibel,
      expected: { min: '> 0', max: '< 2000' },
      actual: praemienStats
    });

    if (!praemienPlausibel) allValid = false;

    // 6. Validierungsergebnis aktualisieren
    const { error: updateError } = await supabase
      .from('bag_import_versions')
      .update({
        validiert: allValid,
        validiert_am: new Date().toISOString(),
        validiert_von: user.email
      })
      .eq('id', importVersionId);

    if (updateError) {
      console.error('Fehler beim Aktualisieren der Validierung:', updateError);
    }

    // 7. Ergebnis zurückgeben
    return Response.json({
      valid: allValid,
      importVersionId,
      checks,
      summary: {
        total: versionData.anzahl_records_gesamt,
        erfolgreich: versionData.anzahl_records_erfolgreich,
        fehler: versionData.anzahl_fehler,
        status: versionData.status
      }
    });

  } catch (error) {
    console.error('Validierungs-Fehler:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});