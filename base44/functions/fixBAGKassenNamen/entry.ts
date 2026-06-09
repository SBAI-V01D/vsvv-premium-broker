import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Vollständige BAG ID → Kassenname Mapping
const VERSICHERER_NAMEN = {
  1068: 'CSS', 1535: 'CSS', 1090: 'CSS', 1091: 'CSS',
  1064: 'Helsana', 1509: 'Helsana', 1086: 'Helsana', 1087: 'Helsana', 1088: 'Helsana',
  1109: 'Sanitas',
  1113: 'Swica',
  1066: 'Visana', 1040: 'Visana', 1041: 'Visana',
  1065: 'KPT', 1053: 'KPT',
  1118: 'Concordia', 1100: 'Concordia',
  1562: 'Groupe Mutuel', 1563: 'Groupe Mutuel', 1564: 'Groupe Mutuel',
  1077: 'Groupe Mutuel', 1078: 'Groupe Mutuel', 1079: 'Groupe Mutuel',
  1080: 'Groupe Mutuel', 1081: 'Groupe Mutuel', 1082: 'Groupe Mutuel', 1083: 'Groupe Mutuel',
  1021: 'Atupri',
  1019: 'Assura',
  1024: 'ÖKK',
  1016: 'Agrisano',
  1097: 'Sympany', 1126: 'Vivao Sympany',
  1048: 'EGK',
  1096: 'Sana24',
  1017: 'bkk mobilise',
  1025: 'Galenus',
  1007: 'Aquilana',
  1111: 'SUPRA',
  1112: 'Sumiswalder',
  1110: 'Steffisburg',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    let fixed = 0;
    let skipped = 0;
    const unknownIds = new Set();

    // Alle BAG-Datensätze laden (paginiert)
    let page = 0;
    const pageSize = 200;
    let hasMore = true;

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    while (hasMore) {
      const records = await base44.asServiceRole.entities.BAGPraemienDaten.list('-created_date', pageSize, page * pageSize);
      
      if (!records || records.length === 0) {
        hasMore = false;
        break;
      }

      // Nur Datensätze mit numerischen IDs herausfiltern
      const toFix = records.filter(r => {
        const n = parseInt(r.krankenkasse);
        return !isNaN(n) && String(n) === String(r.krankenkasse).trim();
      });

      // In Batches von 5 mit Pause updaten
      for (let i = 0; i < toFix.length; i++) {
        const record = toFix[i];
        const kasseNum = parseInt(record.krankenkasse);
        const richtiger_name = VERSICHERER_NAMEN[kasseNum];
        if (richtiger_name) {
          await base44.asServiceRole.entities.BAGPraemienDaten.update(record.id, {
            krankenkasse: richtiger_name
          });
          fixed++;
          if (fixed % 5 === 0) await sleep(2000);
        } else {
          unknownIds.add(kasseNum);
          skipped++;
        }
      }

      if (records.length < pageSize) {
        hasMore = false;
      } else {
        page++;
        await sleep(3000);
      }
    }

    return Response.json({
      success: true,
      fixed,
      skipped,
      unknownIds: [...unknownIds],
      message: `${fixed} Datensätze korrigiert, ${skipped} unbekannte IDs übersprungen`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});