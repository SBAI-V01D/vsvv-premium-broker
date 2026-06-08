import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { read, utils } from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Nur Admins können BAG-Daten importieren' }, { status: 403 });
    }

    const body = await req.json();
    const jahr = parseInt(body.jahr || '2026');
    const kantonFilter = body.kanton;
    
    // Decode base64 to Uint8Array
    const base64Data = body.file.split(',')[1] || body.file;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const arrayBuffer = bytes.buffer;

    // Excel parsen mit minimalen Optionen für weniger Speicher
    const workbook = read(new Uint8Array(arrayBuffer), { 
      cellDates: false,
      cellNF: false,
      cellText: true
    });
    
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return Response.json({ error: 'Ungültige Excel-Datei' }, { status: 400 });
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = utils.sheet_to_json(sheet, { raw: true, dateNF: 'yyyy-mm-dd' });

    // Versicherer-Mapping
    const versichererMap = {
      1: 'CSS', 2: 'Helsana', 3: 'Sanitas', 4: 'Swica', 5: 'ÖKK',
      6: 'Visana', 7: 'KPT', 8: 'Agrisano', 9: 'Concordia', 10: 'Atupri',
      11: 'Assura', 12: 'Intras', 13: 'Sympany', 14: 'bkk mobilise', 15: 'Galenus', 16: 'Groupe Mutuel',
      17: 'CSS', 18: 'Helsana', 19: 'Sanitas', 20: 'Swica'
    };

    const recordsToCreate = [];
    let erfolgreich = 0;
    let fehler = 0;

    for (const row of data) {
      try {
        const versichererId = parseInt(row['Versicherer'] || '0');
        const kantonCode = row['Kanton'] || 'CH';
        const regionCode = row['Region'] || 'PR-REG CH0';
        const altersklasse = row['Altersklasse'] || 'AKL-ERW';
        const unfalleinschluss = row['Unfalleinschluss'] || 'OHNE-UNF';
        const tarifTyp = row['Tariftyp'] || 'TAR-STD';
        const franchiseCode = row['Franchise'] || 'FRA-300';
        const praemie = parseFloat(row['Prämie'] || row['Praemie'] || '0');
        const geschaeftsjahr = parseInt(row['Geschäftsjahr'] || row['Geschaeftsjahr'] || jahr);
        
        // Filter: Nur Erwachsene, ohne Unfall, unterstützte Modelle
        if (altersklasse !== 'AKL-ERW') continue;
        if (unfalleinschluss !== 'OHNE-UNF') continue;
        if (kantonFilter && kantonCode !== kantonFilter) continue;
        
        const modell = mapModellFromTariftyp(tarifTyp);
        if (!['standard', 'telmed', 'hausarzt', 'hmo'].includes(modell)) continue;

        const krankenkasse = versichererMap[versichererId] || `VK-${versichererId}`;
        
        recordsToCreate.push({
          jahr: geschaeftsjahr,
          krankenkasse,
          kanton: kantonCode,
          region: regionCode,
          modell,
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
          gueltig_ab: `${geschaeftsjahr}-01-01`,
          gueltig_bis: `${geschaeftsjahr}-12-31`,
          aktiv: true
        });
        
        erfolgreich++;
      } catch (error) {
        fehler++;
      }
    }

    // Batch-Create für bessere Performance
    if (recordsToCreate.length > 0) {
      await base44.entities.BAGPraemienDaten.bulkCreate(recordsToCreate);
    }

    return Response.json({
      success: true,
      results: {
        gesamt: data.length,
        erfolgreich,
        fehler,
        details: []
      },
      message: `${erfolgreich} von ${data.length} Datensätzen erfolgreich importiert`
    });

  } catch (error) {
    console.error('BAG Import Error:', error);
    return Response.json({ error: error.message || 'Import fehlgeschlagen' }, { status: 500 });
  }
});

function mapModellFromTariftyp(tariftyp) {
  const mapping = {
    'TAR-STD': 'standard',
    'TAR-TEL': 'telmed',
    'TAR-HAM': 'hausarzt',
    'TAR-HMO': 'hmo',
    'standard': 'standard',
    'telmed': 'telmed',
    'hausarzt': 'hausarzt',
    'hmo': 'hmo'
  };
  return mapping[tariftyp] || 'standard';
}

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