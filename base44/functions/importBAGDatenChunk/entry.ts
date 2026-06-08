import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    if (user?.role !== 'admin') return Response.json({ error: 'Nur Admins' }, { status: 403 });

    const { file_url, jahr = 2026, kanton, start_row = 1, end_row } = await req.json();

    if (!file_url) return Response.json({ error: 'Keine Datei-URL' }, { status: 400 });
    if (!kanton) return Response.json({ error: 'Kanton erforderlich' }, { status: 400 });

    console.log(`[BAG Chunk] ${kanton} Rows ${start_row}-${end_row || 'end'}`);

    // Datei herunterladen
    const fileResponse = await fetch(file_url);
    if (!fileResponse.ok) throw new Error('Download failed');
    
    const buffer = await fileResponse.arrayBuffer();
    
    // Excel parsen
    const XLSX = await import('npm:xlsx@0.18.5');
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    
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
    const records = [];
    const BATCH_SIZE = 20;

    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:Z1');
    const totalRows = range.e.r + 1;
    const actualEnd = end_row || totalRows;

    for (let i = start_row; i < actualEnd && i < totalRows; i++) {
      const row = XLSX.utils.sheet_to_json(worksheet, { 
        raw: true, header: 1, 
        range: { s: { r: i, c: 0 }, e: { r: i, c: 20 } }
      })[0];
      
      if (!row?.length) continue;

      try {
        const [versichererId, kantonCode, geschaeftsjahr, , regionCode, altersklasse, unfalleinschluss, , tarifTyp, , , franchiseCode, , praemie] = row;

        if (kantonCode !== kanton) { skipped++; continue; }
        if (altersklasse !== 'AKL-ERW' || unfalleinschluss !== 'OHNE-UNF' || !praemie || parseFloat(praemie) <= 0) { skipped++; continue; }

        const modell = modellMap[tarifTyp] || 'standard';
        if (!['standard', 'telmed', 'hausarzt', 'hmo'].includes(modell)) { skipped++; continue; }

        const krankenkasse = versichererMap[versichererId] || `VK-${versichererId}`;
        let franchise = 300;
        const match = String(franchiseCode || '').match(/(\d+)/);
        if (match) franchise = parseInt(match[1]);

        records.push({
          jahr: parseInt(geschaeftsjahr || jahr),
          krankenkasse,
          kanton: kantonCode,
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
        });

        if (records.length >= BATCH_SIZE) {
          await base44.entities.BAGPraemienDaten.bulkCreate(records);
          erfolgreich += records.length;
          records.length = 0;
        }
      } catch (e) { fehler++; }
    }

    if (records.length > 0) {
      await base44.entities.BAGPraemienDaten.bulkCreate(records);
      erfolgreich += records.length;
    }

    return Response.json({
      success: true,
      kanton,
      chunk: { start: start_row, end: actualEnd },
      results: { erfolgreich, fehler, skipped },
      message: `${kanton} (${start_row}-${actualEnd}): ${erfolgreich}`
    });

  } catch (error) {
    console.error('[BAG Chunk Error]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});