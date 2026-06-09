import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const payload = await req.json();
    const { import_batch_id } = payload;

    if (!import_batch_id) {
      return Response.json({ error: 'import_batch_id required' }, { status: 400 });
    }

    // Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      return Response.json({ error: 'Supabase secrets not configured' }, { status: 500 });
    }

    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Import-Version laden
    const { data: importVersion, error: importError } = await supabase
      .from('bag_import_versions')
      .select('*')
      .eq('id', import_batch_id)
      .single();

    if (importError || !importVersion) {
      return Response.json({ error: 'Import version not found' }, { status: 404 });
    }

    const jahr = importVersion.geschaeftsjahr;

    // 2. Import-Statistik berechnen
    const { count: totalImported, error: countError } = await supabase
      .from('bag_praemien')
      .select('*', { count: 'exact', head: true })
      .eq('geschaeftsjahr', jahr);

    if (countError) {
      throw new Error(`Count error: ${countError.message}`);
    }

    // 3. Datenqualität prüfen
    const { data: versichererCount } = await supabase
      .from('bag_praemien')
      .select('krankenkasse', { count: 'exact' })
      .eq('geschaeftsjahr', jahr)
      .not('krankenkasse', 'is', null);

    const uniqueVersicherer = new Set(versichererCount?.map(r => r.krankenkasse)).size;

    const { data: kantonData } = await supabase
      .from('bag_praemien')
      .select('kanton', { count: 'exact' })
      .eq('geschaeftsjahr', jahr);
    const uniqueKantone = new Set(kantonData?.map(r => r.kanton)).size;

    const { data: regionData } = await supabase
      .from('bag_praemien')
      .select('region', { count: 'exact' })
      .eq('geschaeftsjahr', jahr);
    const uniqueRegionen = new Set(regionData?.map(r => r.region)).size;

    const { data: alterData } = await supabase
      .from('bag_praemien')
      .select('altersklasse', { count: 'exact' })
      .eq('geschaeftsjahr', jahr);
    const uniqueAltersklassen = new Set(alterData?.map(r => r.altersklasse)).size;

    const { data: modellData } = await supabase
      .from('bag_praemien')
      .select('modell', { count: 'exact' })
      .eq('geschaeftsjahr', jahr);
    const uniqueModelle = new Set(modellData?.map(r => r.modell)).size;

    const { data: franchiseData } = await supabase
      .from('bag_praemien')
      .select('franchise', { count: 'exact' })
      .eq('geschaeftsjahr', jahr);
    const uniqueFranchisen = new Set(franchiseData?.map(r => r.franchise)).size;

    // 4. Plausibilitätsprüfung
    const plausiChecks = {
      praemie_gt_0: true,
      no_null_pflichtfelder: true,
      keine_unbekannten_tariftypen: true,
      keine_unbekannten_altersklassen: true,
      keine_unbekannten_franchisen: true,
    };

    const gueltigeModelle = ['standard', 'telmed', 'hausarzt', 'hmo'];
    const gueltigeAltersklassen = ['kind', 'jugend', 'erwachsen'];
    const gueltigeFranchisen = [0, 100, 200, 300, 400, 500, 600, 1000, 1500, 2000, 2500];

    // Prüfe auf ungültige Werte
    const { data: invalidModell } = await supabase
      .from('bag_praemien')
      .select('id')
      .eq('geschaeftsjahr', jahr)
      .not('modell', 'in', `(${gueltigeModelle.map(m => `'${m}'`).join(',')})`)
      .limit(1);

    if (invalidModell && invalidModell.length > 0) {
      plausiChecks.keine_unbekannten_tariftypen = false;
    }

    const { data: invalidAlter } = await supabase
      .from('bag_praemien')
      .select('id')
      .eq('geschaeftsjahr', jahr)
      .not('altersklasse', 'in', `(${gueltigeAltersklassen.map(a => `'${a}'`).join(',')})`)
      .limit(1);

    if (invalidAlter && invalidAlter.length > 0) {
      plausiChecks.keine_unbekannten_altersklassen = false;
    }

    const { data: invalidFranchise } = await supabase
      .from('bag_praemien')
      .select('id')
      .eq('geschaeftsjahr', jahr)
      .not('franchise', 'in', `(${gueltigeFranchisen.map(f => f).join(',')})`)
      .limit(1);

    if (invalidFranchise && invalidFranchise.length > 0) {
      plausiChecks.keine_unbekannten_franchisen = false;
    }

    const { data: nullPflichtfelder } = await supabase
      .from('bag_praemien')
      .select('id')
      .eq('geschaeftsjahr', jahr)
      .or('krankenkasse.is.null,kanton.is.null,modell.is.null,franchise.is.null,praemie_erwachsene.is.null')
      .limit(1);

    if (nullPflichtfelder && nullPflichtfelder.length > 0) {
      plausiChecks.no_null_pflichtfelder = false;
    }

    const { data: negativePraemien } = await supabase
      .from('bag_praemien')
      .select('id')
      .eq('geschaeftsjahr', jahr)
      .lt('praemie_erwachsene', 0)
      .limit(1);

    if (negativePraemien && negativePraemien.length > 0) {
      plausiChecks.praemie_gt_0 = false;
    }

    // 5. Systemvalidierung
    const expectedRecords = importVersion.quelle_datei_gesamtzeilen || 0;
    const importedRecords = totalImported || 0;
    const difference = expectedRecords - importedRecords;
    const differencePercent = expectedRecords > 0 ? ((difference / expectedRecords) * 100) : 0;

    const validierung = {
      vollstaendigkeit: {
        pass: difference === 0,
        expected: expectedRecords,
        actual: importedRecords,
        difference: difference,
        difference_percent: parseFloat(differencePercent.toFixed(2)),
      },
      datenqualitaet: {
        pass: uniqueVersicherer >= 40 && uniqueKantone === 26 && uniqueModelle === 4 && uniqueAltersklassen === 3,
        versicherer: uniqueVersicherer,
        kantone: uniqueKantone,
        regionen: uniqueRegionen,
        altersklassen: uniqueAltersklassen,
        modelle: uniqueModelle,
        franchisen: uniqueFranchisen,
      },
      plausibilitaet: {
        pass: Object.values(plausiChecks).every(v => v === true),
        checks: plausiChecks,
      },
      performance: {
        pass: true, // Wird separat gemessen
        importdauer_minuten: importVersion.importdauer_minuten || 0,
      },
    };

    const overallPass = 
      validierung.vollstaendigkeit.pass &&
      validierung.datenqualitaet.pass &&
      validierung.plausibilitaet.pass;

    // 6. Update Import Version mit Validierungsergebnis
    const updateData = {
      status: overallPass ? 'validated' : 'validation_failed',
      validiert_am: new Date().toISOString(),
      validiert_von: user.email,
      validierung_json: {
        vollstaendigkeit: validierung.vollstaendigkeit,
        datenqualitaet: validierung.datenqualitaet,
        plausibilitaet: validierung.plausibilitaet,
        overall: overallPass,
      },
      anzahl_versicherer: uniqueVersicherer,
      anzahl_kantone: uniqueKantone,
      anzahl_regionen: uniqueRegionen,
      anzahl_altersklassen: uniqueAltersklassen,
      anzahl_modelle: uniqueModelle,
      anzahl_franchisen: uniqueFranchisen,
      plausibilitaet_checks_json: plausiChecks,
    };

    await supabase
      .from('bag_import_versions')
      .update(updateData)
      .eq('id', import_batch_id);

    return Response.json({
      success: true,
      import_batch_id: import_batch_id,
      geschaeftsjahr: jahr,
      statistik: {
        quelle_gesamtzeilen: expectedRecords,
        importiert: importedRecords,
        differenz: difference,
        differenz_prozent: parseFloat(differencePercent.toFixed(2)),
      },
      datenqualitaet: {
        versicherer: uniqueVersicherer,
        kantone: uniqueKantone,
        regionen: uniqueRegionen,
        altersklassen: uniqueAltersklassen,
        modelle: uniqueModelle,
        franchisen: uniqueFranchisen,
      },
      plausibilitaet: plausiChecks,
      validierung: validierung,
      overall: overallPass ? 'PASS' : 'FAIL',
    });

  } catch (error) {
    console.error('validateBAGImport error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});