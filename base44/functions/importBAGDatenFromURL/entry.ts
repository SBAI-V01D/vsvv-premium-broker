import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    if (user?.role !== 'admin') return Response.json({ error: 'Nur Admins' }, { status: 403 });

    const { file_url, jahr = 2026, kanton } = await req.json();

    if (!file_url) return Response.json({ error: 'Keine Datei-URL' }, { status: 400 });
    if (!kanton) return Response.json({ error: 'Kanton erforderlich' }, { status: 400 });

    console.log(`[BAG] Import Kanton ${kanton} Jahr ${jahr}`);

    const fileResponse = await fetch(file_url);
    if (!fileResponse.ok) throw new Error(`Download failed: ${fileResponse.status}`);
    
    const buffer = await fileResponse.arrayBuffer();
    const XLSX = await import('npm:xlsx@0.18.5');
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];

    // Alle Rows auf einmal als Array laden (XLSX macht das intern sowieso)
    const allRows = XLSX.utils.sheet_to_json(worksheet, { raw: true, header: 1 });
    
    console.log(`[BAG] ${kanton}: ${allRows.length} Rows total, filtern...`);

    const versichererMap = {
      1: 'CSS', 2: 'Helsana', 3: 'Sanitas', 4: 'Swica', 5: 'ÖKK',
      6: 'Visana', 7: 'KPT', 8: 'Agrisano', 9: 'Concordia', 10: 'Atupri',
      11: 'Assura', 12: 'Intras', 13: 'Sympany', 14: 'bkk mobilise', 15: 'Galenus', 16: 'Groupe Mutuel'
    };

    const modellMap = {
      'TAR-STD': 'standard', 'TAR-TEL': 'telmed', 'TAR-HAM': 'hausarzt', 'TAR-HMO': 'hmo'
    };

    // Rows für diesen Kanton filtern und transformieren
    const records = [];
    let skipped = 0;

    for (let i = 1; i < allRows.length; i++) {
      const row = allRows[i];
      if (!row?.length) continue;

      const [versichererId, kantonCode, geschaeftsjahr, , regionCode, altersklasse, unfalleinschluss, , tarifTyp, , , franchiseCode, , praemie] = row;

      if (kantonCode !== kanton) { skipped++; continue; }
      if (altersklasse !== 'AKL-ERW') { skipped++; continue; }
      if (unfalleinschluss !== 'OHNE-UNF') { skipped++; continue; }
      if (!praemie || parseFloat(praemie) <= 0) { skipped++; continue; }

      const modell = modellMap[tarifTyp];
      if (!modell) { skipped++; continue; }

      let franchise = 300;
      const m = String(franchiseCode || '').match(/(\d+)/);
      if (m) franchise = parseInt(m[1]);

      records.push({
        jahr: parseInt(geschaeftsjahr || jahr),
        krankenkasse: versichererMap[versichererId] || `VK-${versichererId}`,
        kanton: kantonCode,
        region: String(regionCode || 'PR-REG CH0'),
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
    }

    console.log(`[BAG] ${kanton}: ${records.length} Datensätze gefunden, speichere...`);

    // In Batches von 25 speichern
    const BATCH = 25;
    let erfolgreich = 0;
    let fehler = 0;

    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH);
      await base44.entities.BAGPraemienDaten.bulkCreate(batch);
      erfolgreich += batch.length;
    }

    console.log(`[BAG] ${kanton}: ${erfolgreich} gespeichert, ${fehler} Fehler`);

    return Response.json({
      success: true,
      kanton,
      results: { erfolgreich, fehler, skipped },
      message: `${kanton}: ${erfolgreich} Datensätze importiert`
    });

  } catch (error) {
    console.error(`[BAG Error]`, error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});