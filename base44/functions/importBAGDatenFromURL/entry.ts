import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { read, utils } from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Nur Admins können BAG-Daten importieren' }, { status: 403 });
    }

    const { file_url, jahr = 2026 } = await req.json();

    if (!file_url) {
      return Response.json({ error: 'Keine Datei-URL angegeben' }, { status: 400 });
    }

    // Datei herunterladen
    const fileResponse = await fetch(file_url);
    const arrayBuffer = await fileResponse.arrayBuffer();
    const workbook = read(new Uint8Array(arrayBuffer));
    
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return Response.json({ error: 'Ungültige Excel-Datei' }, { status: 400 });
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = utils.sheet_to_json(sheet);

    const importResults = {
      gesamt: 0,
      erfolgreich: 0,
      fehler: 0
    };

    // Versicherer-Mapping (Versicherer-ID zu Name)
    const versichererMap = {
      1: 'CSS', 2: 'Helsana', 3: 'Sanitas', 4: 'Swica', 5: 'ÖKK',
      6: 'Visana', 7: 'KPT', 8: 'Agrisano', 9: 'Concordia', 10: 'Atupri',
      11: 'Assura', 12: 'Intras', 13: 'Sympany', 14: 'bkk mobilise', 15: 'Galenus', 16: 'Groupe Mutuel'
    };

    // Tarif-Mapping - nur relevante Tarife für KVG Grundversicherung
    // TAR-STD = Standard, TAR-TEL = Telmed, TAR-HAM = Hausarzt, TAR-HMO = HMO
    const modellMapping = {
      'TAR-STD': 'standard',
      'TAR-TEL': 'telmed',
      'TAR-HAM': 'hausarzt',
      'TAR-HMO': 'hmo'
    };

    // Bulk-Create für bessere Performance
    const batchData = [];

    for (const row of data) {
      importResults.gesamt++;
      
      try {
        const versichererId = parseInt(row['Versicherer'] || '0');
        const kantonCode = row['Kanton'] || 'CH';
        const regionCode = row['Region'] || 'PR-REG CH0';
        const altersklasse = row['Altersklasse'] || 'AKL-ERW';
        const unfalleinschluss = row['Unfalleinschluss'] || 'MIT-UNF';
        const tariftyp = row['Tariftyp'] || '';
        const franchiseCode = row['Franchise'] || 'FRA-300';
        const praemie = parseFloat(row['Prämie'] || row['Praemie'] || '0');
        const geschaeftsjahr = parseInt(row['Geschäftsjahr'] || row['Geschaeftsjahr'] || '2026');
        
        // Filter: Nur Erwachsene, ohne Unfall, 2026, relevante Tarife
        if (altersklasse !== 'AKL-ERW') continue;
        if (unfalleinschluss !== 'OHNE-UNF') continue;
        if (!modellMapping[tariftyp]) continue;
        
        const krankenkasse = versichererMap[versichererId] || `VK-${versichererId}`;
        
        batchData.push({
          jahr: geschaeftsjahr || jahr,
          krankenkasse,
          kanton: kantonCode,
          region: regionCode,
          modell: modellMapping[tariftyp],
          franchise: mapFranchise(franchiseCode),
          unfall: false,
          praemie_erwachsene: praemie,
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
        });
        
      } catch (error) {
        importResults.fehler++;
      }
    }

    // Bulk import in batches von 100
    const BATCH_SIZE = 100;
    for (let i = 0; i < batchData.length; i += BATCH_SIZE) {
      const batch = batchData.slice(i, i + BATCH_SIZE);
      await base44.entities.BAGPraemienDaten.bulkCreate(batch);
      importResults.erfolgreich += batch.length;
    }

    return Response.json({
      success: true,
      results: importResults,
      message: `${importResults.erfolgreich} von ${importResults.gesamt} Datensätzen erfolgreich importiert`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function mapFranchise(franchiseCode) {
  const mapping = {
    'FRA-0': 0,
    'FRA-100': 100,
    'FRA-200': 200,
    'FRA-300': 300,
    'FRA-400': 400,
    'FRA-500': 500,
    'FRA-1000': 1000,
    'FRA-1500': 1500,
    'FRA-2000': 2000,
    'FRA-2500': 2500
  };
  return mapping[franchiseCode] || (parseInt(franchiseCode.replace('FRA-', '')) || 300);
}