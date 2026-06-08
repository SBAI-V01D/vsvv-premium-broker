import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { read, utils } from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Nur Admins können BAG-Daten importieren' }, { status: 403 });
    }

    const { file_url, jahr = 2026 } = await req.json();

    if (!file_url) {
      return Response.json({ error: 'Keine Datei-URL angegeben' }, { status: 400 });
    }

    // Datei herunterladen mit Timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s Timeout
    
    let fileResponse;
    try {
      fileResponse = await fetch(file_url, { signal: controller.signal });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      return Response.json({ error: 'Download fehlgeschlagen: ' + fetchError.message }, { status: 400 });
    }
    
    clearTimeout(timeoutId);
    
    if (!fileResponse.ok) {
      return Response.json({ error: 'Datei konnte nicht heruntergeladen werden (' + fileResponse.status + ')' }, { status: 400 });
    }
    
    const arrayBuffer = await fileResponse.arrayBuffer();
    
    // Excel parsen
    let workbook;
    try {
      workbook = read(new Uint8Array(arrayBuffer), { 
        cellDates: false,
        cellNF: false,
        cellText: true
      });
    } catch (excelError) {
      return Response.json({ error: 'Excel-Parsing fehlgeschlagen: ' + excelError.message }, { status: 400 });
    }
    
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return Response.json({ error: 'Ungültige Excel-Datei' }, { status: 400 });
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = utils.sheet_to_json(sheet, { raw: true });

    if (!data || data.length === 0) {
      return Response.json({ error: 'Excel-Datei ist leer' }, { status: 400 });
    }

    // Mapping-Tabellen
    const versichererMap = {
      1: 'CSS', 2: 'Helsana', 3: 'Sanitas', 4: 'Swica', 5: 'ÖKK',
      6: 'Visana', 7: 'KPT', 8: 'Agrisano', 9: 'Concordia', 10: 'Atupri',
      11: 'Assura', 12: 'Intras', 13: 'Sympany', 14: 'bkk mobilise', 15: 'Galenus', 16: 'Groupe Mutuel'
    };

    const modellMap = {
      'TAR-STD': 'standard', 'TAR-TEL': 'telmed', 'TAR-HAM': 'hausarzt', 'TAR-HMO': 'hmo',
      'standard': 'standard', 'telmed': 'telmed', 'hausarzt': 'hausarzt', 'hmo': 'hmo'
    };

    let erfolgreich = 0;
    let fehler = 0;
    const batch = [];
    const BATCH_SIZE = 20; // Kleinere Batches für bessere Stabilität

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
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
        
        // Filter: Nur Erwachsene, ohne Unfall
        if (altersklasse !== 'AKL-ERW') continue;
        if (unfalleinschluss !== 'OHNE-UNF') continue;
        
        const modell = modellMap[tarifTyp] || 'standard';
        if (!['standard', 'telmed', 'hausarzt', 'hmo'].includes(modell)) continue;

        const krankenkasse = versichererMap[versichererId] || `VK-${versichererId}`;
        const franchise = parseInt(franchiseCode.replace('FRA-', '')) || 300;

        batch.push({
          jahr: geschaeftsjahr,
          krankenkasse,
          kanton: kantonCode,
          region: regionCode,
          modell,
          franchise,
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
        
        // Batch-weise speichern
        if (batch.length >= BATCH_SIZE) {
          await base44.entities.BAGPraemienDaten.bulkCreate(batch);
          erfolgreich += batch.length;
          batch.length = 0;
          // Kurze Pause zwischen Batches
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      } catch (error) {
        fehler++;
      }
    }

    // Restliche Daten speichern
    if (batch.length > 0) {
      await base44.entities.BAGPraemienDaten.bulkCreate(batch);
      erfolgreich += batch.length;
    }

    return Response.json({
      success: true,
      results: {
        gesamt: data.length,
        erfolgreich,
        fehler
      },
      message: `${erfolgreich} von ${data.length} Datensätzen importiert`
    });

  } catch (error) {
    console.error('BAG Import Error:', error);
    return Response.json({ error: error.message || 'Import fehlgeschlagen' }, { status: 500 });
  }
});