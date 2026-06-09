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

    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Aktuelle Daten in bag_praemien zählen (2026)
    const jahr = 2026;
    
    const { count: totalImported } = await supabase
      .from('bag_praemien')
      .select('*', { count: 'exact', head: true })
      .eq('geschaeftsjahr', jahr);

    // Datenqualität
    const { data: versichererData } = await supabase
      .from('bag_praemien')
      .select('krankenkasse')
      .eq('geschaeftsjahr', jahr);
    const uniqueVersicherer = new Set(versichererData?.map(r => r.krankenkasse)).size;

    const { data: kantonData } = await supabase
      .from('bag_praemien')
      .select('kanton')
      .eq('geschaeftsjahr', jahr);
    const uniqueKantone = new Set(kantonData?.map(r => r.kanton)).size;

    const { data: regionData } = await supabase
      .from('bag_praemien')
      .select('region')
      .eq('geschaeftsjahr', jahr);
    const uniqueRegionen = new Set(regionData?.map(r => r.region)).size;

    const { data: alterData } = await supabase
      .from('bag_praemien')
      .select('altersklasse')
      .eq('geschaeftsjahr', jahr);
    const uniqueAltersklassen = new Set(alterData?.map(r => r.altersklasse)).size;

    const { data: modellData } = await supabase
      .from('bag_praemien')
      .select('modell')
      .eq('geschaeftsjahr', jahr);
    const uniqueModelle = new Set(modellData?.map(r => r.modell)).size;

    const { data: franchiseData } = await supabase
      .from('bag_praemien')
      .select('franchise')
      .eq('geschaeftsjahr', jahr);
    const uniqueFranchisen = new Set(franchiseData?.map(r => r.franchise)).size;

    // Erwarte: ~73'380 für ZH
    const expectedRecords = 73380;
    const importedRecords = totalImported || 0;
    const difference = expectedRecords - importedRecords;

    return Response.json({
      success: true,
      geschaeftsjahr: jahr,
      statistik: {
        quelle_gesamtzeilen: expectedRecords,
        importiert: importedRecords,
        differenz: difference,
        differenz_prozent: expectedRecords > 0 ? parseFloat(((difference / expectedRecords) * 100).toFixed(2)) : 0,
      },
      datenqualitaet: {
        versicherer: uniqueVersicherer,
        kantone: uniqueKantone,
        regionen: uniqueRegionen,
        altersklassen: uniqueAltersklassen,
        modelle: uniqueModelle,
        franchisen: uniqueFranchisen,
      },
      overall: difference === 0 ? 'PASS' : 'FAIL',
    });

  } catch (error) {
    console.error('validateBAGImportAdHoc error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});