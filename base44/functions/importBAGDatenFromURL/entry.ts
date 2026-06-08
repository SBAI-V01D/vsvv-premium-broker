import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Nur Admins' }, { status: 403 });
    }

    const { file_url } = await req.json();
    if (!file_url) {
      return Response.json({ error: 'Keine Datei-URL' }, { status: 400 });
    }

    // Built-in Import verwenden (optimiert für grosse Dateien)
    const importResult = await base44.entities.BAGPraemienDaten.importFromUrl(file_url, {
      transform: (row: any) => {
        const altersklasse = row['Altersklasse'] || row[5];
        const unfalleinschluss = row['Unfalleinschluss'] || row[6];
        const tarifTyp = row['Tariftyp'] || row[8];
        const praemie = row['Prämie'] || row[13];
        
        if (altersklasse !== 'AKL-ERW' || unfalleinschluss !== 'OHNE-UNF' || !praemie) {
          return null;
        }

        const versichererMap: Record<number, string> = {
          1: 'CSS', 2: 'Helsana', 3: 'Sanitas', 4: 'Swica', 5: 'ÖKK',
          6: 'Visana', 7: 'KPT', 8: 'Agrisano', 9: 'Concordia', 10: 'Atupri'
        };

        const modellMap: Record<string, string> = {
          'TAR-STD': 'standard', 'TAR-TEL': 'telmed', 'TAR-HAM': 'hausarzt', 'TAR-HMO': 'hmo'
        };

        const franchiseMatch = (row['Franchise'] || row[11])?.toString().match(/(\d+)/);
        const franchise = franchiseMatch ? parseInt(franchiseMatch[1]) : 300;

        return {
          jahr: parseInt(row['Geschäftsjahr'] || row[3] || '2026'),
          krankenkasse: versichererMap[row['Versicherer']] || `VK-${row['Versicherer']}`,
          kanton: row['Kanton'] || row[1] || 'CH',
          region: row['Region'] || row[5] || 'PR-REG CH0',
          modell: modellMap[tarifTyp] || 'standard',
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
          gueltig_ab: `${row['Geschäftsjahr'] || 2026}-01-01`,
          gueltig_bis: `${row['Geschäftsjahr'] || 2026}-12-31`,
          aktiv: true
        };
      }
    });

    return Response.json({
      success: true,
      results: importResult,
      message: `Import abgeschlossen: ${importResult?.successCount || 0} Datensätze`
    });

  } catch (error) {
    console.error('BAG Import Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});