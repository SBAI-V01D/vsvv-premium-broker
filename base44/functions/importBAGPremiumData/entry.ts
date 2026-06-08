import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { read, utils } from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Nur Admins können BAG-Daten importieren' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const jahr = parseInt(formData.get('jahr') || '2026');
    const kanton = formData.get('kanton');

    if (!file) {
      return Response.json({ error: 'Keine Datei hochgeladen' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = read(new Uint8Array(arrayBuffer));
    
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return Response.json({ error: 'Ungültige Excel-Datei' }, { status: 400 });
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = utils.sheet_to_json(sheet);

    const importResults = {
      gesamt: 0,
      erfolgreich: 0,
      fehler: 0,
      details: []
    };

    // Versicherer-Mapping (Versicherer-ID zu Name) basierend auf BAG-Excel
    const versichererMap = {
      1: 'CSS', 2: 'Helsana', 3: 'Sanitas', 4: 'Swica', 5: 'ÖKK',
      6: 'Visana', 7: 'KPT', 8: 'Agrisano', 9: 'Concordia', 10: 'Atupri',
      11: 'Assura', 12: 'Intras', 13: 'Sympany', 14: 'bkk mobilise', 15: 'Galenus', 16: 'Groupe Mutuel',
      17: 'CSS', 18: 'Helsana', 19: 'Sanitas', 20: 'Swica'
    };

    for (const row of data) {
      importResults.gesamt++;
      
      try {
        // BAG-Excel Spaltenmapping
        const versichererId = parseInt(row['Versicherer'] || '0');
        const kantonCode = row['Kanton'] || 'CH';
        const regionCode = row['Region'] || 'PR-REG CH0';
        const altersklasse = row['Altersklasse'] || 'AKL-ERW';
        const unfalleinschluss = row['Unfalleinschluss'] || 'MIT-UNF';
        const tarifTyp = row['Tariftyp'] || 'TAR-STD';
        const franchiseCode = row['Franchise'] || 'FRA-300';
        const praemie = parseFloat(row['Prämie'] || row['Praemie'] || '0');
        const geschaeftsjahr = parseInt(row['Geschäftsjahr'] || row['Geschaeftsjahr'] || '2026');
        
        // Nur Erwachsene (26+) und OHNE Unfall für Vergleich (wichtig!)
        if (altersklasse !== 'AKL-ERW') continue;
        if (unfalleinschluss !== 'OHNE-UNF') continue;
        
        const krankenkasse = versichererMap[versichererId] || `VK-${versichererId}`;
        
        const praemienDaten = {
          jahr: geschaeftsjahr || jahr,
          krankenkasse,
          kanton: kantonCode,
          region: regionCode,
          modell: mapModellFromTariftyp(tarifTyp),
          franchise: mapFranchise(franchiseCode),
          unfall: unfalleinschluss === 'MIT-UNF',
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
        };

        if (!praemienDaten.krankenkasse || !praemienDaten.praemie_erwachsene) {
          throw new Error('Fehlende Pflichtfelder');
        }

        await base44.entities.BAGPraemienDaten.create(praemienDaten);
        importResults.erfolgreich++;
        
      } catch (error) {
        importResults.fehler++;
        importResults.details.push({
          row: importResults.gesamt,
          error: error.message,
          data: row
        });
      }
    }

    return Response.json({
      success: true,
      results: importResults,
      message: `${importResults.erfolgreich} von ${importResults.gesamt} Datensätzen erfolgreich importiert`
    });

  } catch (error) {
    console.error('BAG Import Error:', error);
    return Response.json({ error: error.message || 'Import fehlgeschlagen' }, { status: 500 });
  }
});

function mapModellFromTariftyp(tariftyp) {
  // BAG Tariftyp Mapping: TAR-TEL (Telmed), TAR-HAM (Hausarzt), TAR-HMO (HMO), TAR-STD (Standard)
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
  // BAG Franchise Codes: FRA-0 (0), FRA-100 (100), FRA-300 (300), etc.
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