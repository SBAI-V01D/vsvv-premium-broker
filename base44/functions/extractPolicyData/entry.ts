import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Swiss postal code to canton mapping (comprehensive)
const PLZ_TO_CANTON = {
  '1200': 'GE', '1201': 'GE', '1202': 'GE', '1203': 'GE', '1204': 'GE', '1205': 'GE', '1206': 'GE', '1207': 'GE', '1208': 'GE', '1209': 'GE',
  '1210': 'GE', '1211': 'GE', '1212': 'GE', '1213': 'GE', '1214': 'GE', '1215': 'GE', '1216': 'GE', '1217': 'GE', '1218': 'GE', '1219': 'GE',
  '1220': 'GE', '1222': 'GE', '1223': 'GE', '1224': 'GE', '1225': 'GE', '1226': 'GE', '1227': 'GE', '1228': 'GE', '1229': 'GE',
  '1231': 'GE', '1233': 'GE', '1234': 'GE', '1235': 'GE', '1236': 'GE', '1237': 'GE', '1242': 'GE', '1243': 'GE', '1244': 'GE', '1245': 'GE',
  '1246': 'GE', '1247': 'GE', '1248': 'GE', '1251': 'GE', '1252': 'GE', '1253': 'GE', '1254': 'GE', '1255': 'GE', '1256': 'GE', '1257': 'GE',
  '1258': 'GE', '1259': 'GE', '1260': 'GE', '1261': 'GE', '1262': 'GE', '1263': 'GE', '1264': 'GE', '1265': 'GE', '1266': 'GE', '1267': 'GE',
  '1268': 'GE', '1269': 'GE', '1271': 'GE', '1272': 'GE', '1273': 'GE', '1274': 'GE', '1275': 'GE', '1276': 'GE', '1277': 'GE', '1278': 'GE',
  '1279': 'GE', '1281': 'GE', '1282': 'GE', '1283': 'GE', '1284': 'GE', '1285': 'GE', '1286': 'GE', '1287': 'GE', '1288': 'GE', '1289': 'GE',
  '1290': 'GE', '1291': 'GE', '1292': 'GE', '1293': 'GE', '1294': 'GE', '1295': 'GE', '1296': 'GE', '1297': 'GE', '1298': 'GE', '1299': 'GE',
};

// Fallback mapping by first digit(s)
function cantonFromZip(zip) {
  if (!zip || zip.length !== 4) return null;
  
  if (PLZ_TO_CANTON[zip]) return PLZ_TO_CANTON[zip];
  
  const prefixMap = {
    '10': 'VD', '11': 'VD', '12': 'GE', '13': 'VD', '14': 'VD', '15': 'VD', '16': 'VD', '17': 'VD', '18': 'VS', '19': 'VS',
    '20': 'NE', '21': 'NE', '22': 'NE', '23': 'JU', '24': 'JU', '25': 'JU', '26': 'JU', '27': 'JU',
    '30': 'BE', '31': 'BE', '32': 'BE', '33': 'BE', '34': 'BE', '35': 'BE', '36': 'BE', '37': 'BE', '38': 'BE', '39': 'BE',
    '40': 'BS', '41': 'BL', '42': 'BL', '43': 'BL', '44': 'BL', '45': 'BL', '46': 'SO', '47': 'SO',
    '50': 'AG', '51': 'AG', '52': 'AG', '53': 'AG', '54': 'AG', '55': 'AG', '56': 'AG', '57': 'AG', '58': 'AG', '59': 'AG',
    '60': 'LU', '61': 'LU', '62': 'LU', '63': 'OW', '64': 'NW', '65': 'SZ', '66': 'LU', '67': 'ZG', '68': 'OW',
    '70': 'GR', '71': 'GR', '72': 'GR', '73': 'GR', '74': 'GR', '75': 'GR', '76': 'GR', '77': 'GR',
    '80': 'ZH', '81': 'ZH', '82': 'ZH', '83': 'ZH', '84': 'ZH', '85': 'ZH', '86': 'ZH', '87': 'ZH', '88': 'SH', '89': 'TG',
    '90': 'AR', '91': 'AI', '92': 'AI', '93': 'SG', '94': 'SG', '95': 'SG', '96': 'SG', '97': 'SG',
  };
  
  return prefixMap[zip.substring(0, 2)] || null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url, file_name } = await req.json();
    if (!file_url) {
      return Response.json({ error: 'file_url erforderlich' }, { status: 400 });
    }

    console.log(`[extractPolicyData] START file=${file_name}`);

    if (!file_url || typeof file_url !== 'string') {
      console.error('[extractPolicyData] Invalid file_url:', file_url);
      return Response.json({ error: 'Invalid file_url provided' }, { status: 400 });
    }

    let response;
    try {
      response = await base44.integrations.Core.InvokeLLM({
        model: 'automatic',
        prompt: `Du bist ein SPEZIALISIERTER OCR-Experte für Schweizer Versicherungspolicen mit PERFEKTER Zeichenerkennung.

KRITISCHE AUFGABE: Extrahiere EXAKT die Kundendaten (Name, Vorname, Geburtsdatum, Adresse) und Vertragsdaten aus dieser Police.

═══════════════════════════════════════════════════════════════════════════════════════
SECTION 1: KUNDENDATEN (Versicherungsnehmer/Policeninhaber)
═══════════════════════════════════════════════════════════════════════════════════════

SUCHE NACH DIESEN LABELS IM DOKUMENT:
- "Versicherungsnehmer", "Policeninhaber", "Versicherter", "Ihre Adresse", "An:", "Adresse des Versicherten"
- "Name und Adresse", "Vertragspartner"

⚠️ AUSSCHLIESSLICH: Das ist NICHT der Lenker/Fahrer, NICHT die versicherte Sache, NICHT der Arzt/Zahnarzt.

EXTRAHIERE GENAU:
1. first_name: Vorname (z.B. "Hans", "Maria", "José")
2. last_name: Nachname/Familienname (z.B. "Müller", "Meyer")
3. birthdate: Geburtsdatum im Format YYYY-MM-DD
4. street: Strasse + Hausnummer (z.B. "Musterstrasse 12")
5. zip_code: Postleitzahl - IMMER 4-stellig (z.B. "8001", "3000", "1201")
6. city: Ortsname (z.B. "Zürich", "Bern", "Genève")
7. canton: 2-Buchstaben Kantonskürzel (z.B. ZH, BE, GE, VD, AG, LU, SG)
8. phone: Telefonnummer (falls vorhanden)
9. email: E-Mail-Adresse (falls vorhanden)
10. mobile: Mobilnummer (falls vorhanden)

═══════════════════════════════════════════════════════════════════════════════════════
SECTION 2: VERTRAGSDATEN
═══════════════════════════════════════════════════════════════════════════════════════

11. policy_number: Policennummer (z.B. "123.456.789")
12. insurer: Versicherungsgesellschaft (z.B. "Helsana AG")
13. insurance_type: Versicherungsart (z.B. "KVG", "Motorfahrzeug")
14. product: Produkt-/Tarifname (z.B. "COMPACT", "HMO 1500")
15. start_date: Versicherungsbeginn (YYYY-MM-DD)
16. end_date: Vertragsende/Ablaufdatum (YYYY-MM-DD)
17. cancellation_deadline: Kündigungsfrist (YYYY-MM-DD)
18. premium_monthly: Monatsprämie als Dezimalzahl (z.B. 142.05)
19. premium_yearly: Jahresprämie (z.B. 1704.60)

═══════════════════════════════════════════════════════════════════════════════════════
SECTION 3: SPARTENSPEZIFISCHE DATEN
═══════════════════════════════════════════════════════════════════════════════════════

20. sparte_data: JSON Object mit franchise, model, age_group, coverage (falls relevant)
21. additional_products: Array von Zusatzversicherungen

WICHTIGE REGELN:
🚫 NIEMALS erfinden oder raten - unbekannte Felder → null!
✅ Datumsformate: DD.MM.YYYY → YYYY-MM-DD
✅ Postleitzahlen: IMMER 4-stellig prüfen
✅ Namen: Exakt wie im Dokument

RÜCKGABE: Gültiges JSON mit allen Feldern. Fehlende Felder = null.`,
        file_urls: [file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            birthdate: { type: 'string' },
            street: { type: 'string' },
            zip_code: { type: 'string' },
            city: { type: 'string' },
            canton: { type: 'string' },
            phone: { type: 'string' },
            mobile: { type: 'string' },
            email: { type: 'string' },
            policy_number: { type: 'string' },
            insurer: { type: 'string' },
            insurance_type: { type: 'string' },
            product: { type: 'string' },
            start_date: { type: 'string' },
            end_date: { type: 'string' },
            cancellation_deadline: { type: 'string' },
            premium_monthly: { type: 'number' },
            premium_yearly: { type: 'number' },
            sparte_data: { type: 'object', additionalProperties: true },
            additional_products: {
              type: 'array',
              items: { 
                type: 'object', 
                properties: { 
                  product: { type: 'string' }, 
                  premium_monthly: { type: 'number' }, 
                  premium_yearly: { type: 'number' }, 
                  policy_number: { type: 'string' } 
                }
              }
            }
          }
        }
      });
    } catch (llmError) {
      const llmMsg = llmError instanceof Error ? llmError.message : String(llmError);
      console.error(`[extractPolicyData] LLM ERROR: ${llmMsg}`);
      
      if (llmMsg.includes('no pages') || llmMsg.includes('document has no pages')) {
        return Response.json({ error: 'Die PDF-Datei ist leer oder beschädigt.' }, { status: 400 });
      }
      if (llmMsg.includes('missing field') || llmMsg.includes('schema')) {
        return Response.json({ error: 'Fehler bei der Datenverarbeitung. Bitte versuche es später erneut.' }, { status: 400 });
      }
      
      return Response.json({ error: `Extraktion fehlgeschlagen: ${llmMsg}` }, { status: 400 });
    }

    if (!response) {
      console.error('[extractPolicyData] Empty LLM response');
      return Response.json({ error: 'Keine Daten aus der Datei extrahiert' }, { status: 400 });
    }

    let zip = response.zip_code || null;
    if (zip) {
      zip = String(zip).replace(/\D/g, '');
      while (zip.length < 4) zip = '0' + zip;
      zip = zip.slice(0, 4);
      if (zip.length !== 4) zip = null;
    }

    let canton = response.canton || null;
    if (!canton && zip) canton = cantonFromZip(zip);
    if (canton) canton = String(canton).toUpperCase().slice(0, 2);

    const sparteData = response.sparte_data || {};
    let premiumMonthly = response.premium_monthly || null;
    let premiumYearly = response.premium_yearly || null;
    if (premiumMonthly && !premiumYearly) {
      premiumYearly = Math.round(premiumMonthly * 12 * 100) / 100;
    }

    console.log(`[extractPolicyData] OK: insurer=${response.insurer} name=${response.first_name} ${response.last_name} zip=${zip} city=${response.city} canton=${canton}`);

    return Response.json({
      success: true,
      extractedData: {
        first_name: response.first_name || null,
        last_name: response.last_name || null,
        birthdate: response.birthdate || null,
        street: response.street || null,
        zip_code: zip,
        city: response.city || null,
        canton: canton,
        phone: response.phone || null,
        mobile: response.mobile || null,
        email: response.email || null,
        policy_number: response.policy_number || null,
        insurer: response.insurer || null,
        insurance_type: response.insurance_type || null,
        product: response.product || null,
        start_date: response.start_date || null,
        end_date: response.end_date || null,
        cancellation_deadline: response.cancellation_deadline || null,
        premium_monthly: premiumMonthly,
        premium_yearly: premiumYearly,
        sparte_data: Object.keys(sparteData).length > 0 ? sparteData : null,
        additional_products: response.additional_products || [],
        notes: null,
      }
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[extractPolicyData] OUTER ERROR: ${errorMsg}`);
    
    return Response.json({ 
      error: `Systemfehler: ${errorMsg}` 
    }, { status: 500 });
  }
});