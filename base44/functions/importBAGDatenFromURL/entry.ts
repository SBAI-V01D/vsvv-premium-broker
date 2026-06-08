import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { read, utils } from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    if (user?.role !== 'admin') return Response.json({ error: 'Nur Admins' }, { status: 403 });

    const { file_url, jahr = 2026, kantone } = await req.json();

    if (!file_url) return Response.json({ error: 'Keine Datei-URL' }, { status: 400 });

    // Kanton-Filter: null = alle Kantone, Array = spezifische Kantone
    const kantonFilter = kantone || null;

    // Datei herunterladen
    const fileResponse = await fetch(file_url);
    if (!fileResponse.ok) return Response.json({ error: 'Download fehlgeschlagen' }, { status: 400 });
    
    const arrayBuffer = await fileResponse.arrayBuffer();
    const workbook = read(new Uint8Array(arrayBuffer), { cellDates: false, cellNF: false, cellText: true });
    
    if (!workbook.SheetNames?.length) return Response.json({ error: 'Ungültige Datei' }, { status: 400 });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = utils.sheet_to_json(sheet, { raw: true, header: 1 });

    // Mapping
    const versichererMap = {
      1: 'CSS', 2: 'Helsana', 3: 'Sanitas', 4: 'Swica', 5: 'ÖKK',
      6: 'Visana', 7: 'KPT', 8: 'Agrisano', 9: 'Concordia', 10: 'Atupri',
      11: 'Assura', 12: 'Intras', 13: 'Sympany', 14: 'bkk mobilise', 15: 'Galenus', 16: 'Groupe Mutuel'
    };

    const modellMap = {
      'TAR-STD': 'standard', 'TAR-TEL': 'telmed', 'TAR-HAM': 'hausarzt', 'TAR-HMO': 'hmo'
    };

    let erfolgreich = 0;
    let fehler = 0;
    let skipped = 0;
    let kanton_filtered = 0;
    const batch = [];
    const BATCH_SIZE = 100;

    // Header überspringen (Row 0)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row?.length) continue;

      try {
        const versichererId = row[0];
        const kantonCode = row[1] || 'CH';
        const geschaeftsjahr = row[2] || jahr;
        const regionCode = row[4] || 'PR-REG CH0';
        const altersklasse = row[5];
        const unfalleinschluss = row[6];
        const tarifTyp = row[8];
        const franchiseCode = row[11];
        const praemie = row[13];

        // Kanton-Filter (nur wenn spezifische Kantone angegeben)
        if (kantonFilter && !kantonFilter.includes(kantonCode)) {
          kanton_filtered++;
          continue;
        }

        // Filter: Nur Erwachsene, ohne Unfall, gültige Prämie
        if (altersklasse !== 'AKL-ERW' || unfalleinschluss !== 'OHNE-UNF' || !praemie || praemie <= 0) {
          skipped++;
          continue;
        }

        const modell = modellMap[tarifTyp] || 'standard';
        if (!['standard', 'telmed', 'hausarzt', 'hmo'].includes(modell)) {
          skipped++;
          continue;
        }

        const krankenkasse = versichererMap[versichererId] || `VK-${versichererId}`;
        let franchise = 300;
        if (franchiseCode) {
          const match = franchiseCode.toString().match(/(\d+)/);
          if (match) franchise = parseInt(match[1]);
        }

        batch.push({
          jahr: parseInt(geschaeftsjahr),
          krankenkasse,
          kanton: kantonCode,
          region: regionCode,
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
          gueltig_ab: `${geschaeftsjahr}-01-01`,
          gueltig_bis: `${geschaeftsjahr}-12-31`,
          aktiv: true
        });

        if (batch.length >= BATCH_SIZE) {
          await base44.entities.BAGPraemienDaten.bulkCreate(batch);
          erfolgreich += batch.length;
          batch.length = 0;
        }
      } catch (error) {
        fehler++;
      }
    }

    // Rest speichern
    if (batch.length > 0) {
      await base44.entities.BAGPraemienDaten.bulkCreate(batch);
      erfolgreich += batch.length;
    }

    return Response.json({
      success: true,
      results: { 
        gesamt: data.length - 1, 
        erfolgreich, 
        fehler, 
        skipped,
        kanton_filtered,
        kantone: kantonFilter ? kantonFilter.join(', ') : 'Alle'
      },
      message: kantonFilter 
        ? `${erfolgreich} Datensätze für ${kantonFilter.length} Kantone importiert`
        : `${erfolgreich} Datensätze für alle Kantone importiert`
    });

  } catch (error) {
    console.error('BAG Import Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});