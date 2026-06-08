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
      details: [] as any[]
    };

    for (const row of data) {
      importResults.gesamt++;
      
      try {
        const praemienDaten = {
          jahr,
          krankenkasse: row['Krankenkasse'] || row['krankenkasse'] || row['Versicherer'],
          kanton: kanton || row['Kanton'] || row['kanton'],
          region: row['Region'] || row['region'] || 'Gesamt',
          modell: mapModell(row['Modell'] || row['modell'] || 'Standard'),
          franchise: parseInt(row['Franchise'] || row['franchise'] || '300'),
          unfall: row['Unfall'] !== false && row['unfall'] !== false,
          praemie_erwachsene: parseFloat(row['Praemie_Erwachsene'] || row['praemie_erwachsene'] || row['Monatspraemie'] || '0'),
          praemie_kinder: parseFloat(row['Praemie_Kinder'] || row['praemie_kinder'] || '0'),
          geschlecht: row['Geschlecht'] ? row['Geschlecht'].toLowerCase() : 'm',
          alter_von: parseInt(row['Alter_Von'] || row['alter_von'] || '26'),
          alter_bis: parseInt(row['Alter_Bis'] || row['alter_bis'] || '99'),
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
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function mapModell(modell: string): string {
  const mapping: Record<string, string> = {
    'Standard': 'standard',
    'standard': 'standard',
    'Telmed': 'telmed',
    'telmed': 'telmed',
    'Hausarzt': 'hausarzt',
    'hausarzt': 'hausarzt',
    'HMO': 'hmo',
    'hmo': 'hmo'
  };
  return mapping[modell] || 'standard';
}