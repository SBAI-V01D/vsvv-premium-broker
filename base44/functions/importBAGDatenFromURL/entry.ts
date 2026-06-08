import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    if (user?.role !== 'admin') return Response.json({ error: 'Nur Admins' }, { status: 403 });

    const { file_url, jahr = 2026 } = await req.json();

    if (!file_url) return Response.json({ error: 'Keine Datei-URL' }, { status: 400 });

    console.log('[BAG] Starte Import mit Base44 import_data');

    // Base44's native import_data Funktion verwenden
    // Diese ist optimiert für grosse Dateien
    const importResult = await base44.import_data({
      file_url,
      entity_name: 'BAGPraemienDaten',
      transform: (row) => {
        // Mapping von Excel-Row zu Entity
        const versichererMap = {
          1: 'CSS', 2: 'Helsana', 3: 'Sanitas', 4: 'Swica', 5: 'ÖKK',
          6: 'Visana', 7: 'KPT', 8: 'Agrisano', 9: 'Concordia', 10: 'Atupri',
          11: 'Assura', 12: 'Intras', 13: 'Sympany', 14: 'bkk mobilise', 15: 'Galenus', 16: 'Groupe Mutuel'
        };

        const modellMap = {
          'TAR-STD': 'standard', 'TAR-TEL': 'telmed', 'TAR-HAM': 'hausarzt', 'TAR-HMO': 'hmo'
        };

        const [versichererId, kantonCode, geschaeftsjahr, , regionCode, altersklasse, unfalleinschluss, , tarifTyp, , , franchiseCode, , praemie] = row;

        // Filter: Nur Erwachsene, ohne Unfall, Prämie > 0
        if (altersklasse !== 'AKL-ERW' || unfalleinschluss !== 'OHNE-UNF' || !praemie || parseFloat(praemie) <= 0) {
          return null;
        }

        const modell = modellMap[tarifTyp] || 'standard';
        if (!['standard', 'telmed', 'hausarzt', 'hmo'].includes(modell)) {
          return null;
        }

        let franchise = 300;
        const match = String(franchiseCode || '').match(/(\d+)/);
        if (match) franchise = parseInt(match[1]);

        return {
          jahr: parseInt(geschaeftsjahr || jahr),
          krankenkasse: versichererMap[versichererId] || `VK-${versichererId}`,
          kanton: kantonCode || 'CH',
          region: regionCode || 'PR-REG CH0',
          modell,
          franchise,
          unfall: false,
          praemie_erwachsene: parseFloat(praemie),
          praemie_kinder: 0,
          geschlecht: 'm',
          alter_von: 26,
          alter_bis: 99,
          datenquelle: 'BAG',
          importiert_am: new Date().toISOString(),
          importiert_von: user.id,
          gueltig_ab: `${jahr}-01-01`,
          gueltig_bis: `${jahr}-12-31`,
          aktiv: true
        };
      }
    });

    console.log('[BAG] Import abgeschlossen:', importResult);

    return Response.json({
      success: true,
      results: importResult,
      message: `${importResult?.success_count || 0} Datensätze importiert`
    });

  } catch (error) {
    console.error('[BAG Error]', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});