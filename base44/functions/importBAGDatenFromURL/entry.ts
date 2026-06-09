import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Empfängt bereits fertig geparste Records vom Browser
// Kein Excel-Download, kein xlsx-Parsing serverseitig — nur DB-Write
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    if (user?.role !== 'admin') return Response.json({ error: 'Nur Admins' }, { status: 403 });

    const { records, kanton, jahr = 2026 } = await req.json();

    if (!records || !Array.isArray(records)) {
      return Response.json({ error: 'Keine Records übergeben' }, { status: 400 });
    }
    if (!kanton) return Response.json({ error: 'Kanton erforderlich' }, { status: 400 });

    console.log(`[BAG] ${kanton}: ${records.length} Records speichern...`);

    // Felder ergänzen
    const now = new Date().toISOString();
    const enriched = records.map(r => ({
      ...r,
      importiert_am: now,
      importiert_von: user.id,
      aktiv: true
    }));

    // In Batches von 25 speichern mit Pause zwischen Batches
    const BATCH = 25;
    let erfolgreich = 0;

    for (let i = 0; i < enriched.length; i += BATCH) {
      await base44.entities.BAGPraemienDaten.bulkCreate(enriched.slice(i, i + BATCH));
      erfolgreich += Math.min(BATCH, enriched.length - i);
      // Pause zwischen Batches um Rate Limit zu vermeiden
      if (i + BATCH < enriched.length) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    console.log(`[BAG] ${kanton}: ${erfolgreich} gespeichert`);

    return Response.json({
      success: true,
      kanton,
      results: { erfolgreich, fehler: 0 },
      message: `${kanton}: ${erfolgreich} Datensätze importiert`
    });

  } catch (error) {
    console.error(`[BAG Error]`, error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});