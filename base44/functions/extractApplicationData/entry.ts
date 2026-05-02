import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Calculate age group from birthdate string YYYY-MM-DD
function calcAgeGroup(birthdate) {
  if (!birthdate) return null;
  const birth = new Date(birthdate);
  const today = new Date();
  const age = today.getFullYear() - birth.getFullYear() -
    (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
  if (age <= 18) return 'Kind';
  if (age <= 25) return 'Jugend';
  return 'Erwachsen';
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

    console.log(`[extractApplicationData] START file=${file_name}`);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Du bist ein Experte für Schweizer Versicherungsformulare (KVG, VVG, KK, Leben, Sach).
Analysiere dieses Dokument und extrahiere ALLE Daten in exakt der vorgegebenen JSON-Struktur.

KRITISCHE REGELN:
- KEIN Feld leer lassen: wenn nicht vorhanden → null
- Datumsformat: YYYY-MM-DD
- Prämie: nur Zahl ohne Währungssymbol (z.B. 142.05)
- Telefon: internationales Format +41...
- E-Mail: validieren, bei ungültig → null
- confidence in "meta": 0-100 (Gesamtkonfidenz)
- Sprache: Deutsch (CH) / Französisch

Dateiname: "${file_name || ''}"

VERSICHERUNGS-FELDER:
- franchise: numerisch z.B. "300", "1000", "2500" oder null
- kassenmodell: Standard / Hausarzt / HMO / Telemed / Flexmed oder null
- produkte: ARRAY mit Objekten {typ, name}. Beispiele:
    [{typ:"Grundversicherung", name:"BeneFit PLUS"}, {typ:"Zusatz", name:"TOP"}, {typ:"Zusatz", name:"SANA"}]
  Wenn keine Produkte erkennbar: leeres Array []

PFLICHTFELDER-PRÜFUNG:
Wenn person.vorname, person.nachname, person.geburtsdatum oder versicherung.beginn fehlen → meta.incomplete = true

Extrahiere in EXAKT dieser Struktur:`,
      file_urls: [file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          person: {
            type: 'object',
            properties: {
              vorname:      { type: ['string','null'] },
              nachname:     { type: ['string','null'] },
              geburtsdatum: { type: ['string','null'] }
            },
            required: ['vorname','nachname','geburtsdatum']
          },
          kontaktperson: {
            type: 'object',
            properties: {
              name:    { type: ['string','null'] },
              telefon: { type: ['string','null'] },
              email:   { type: ['string','null'] }
            },
            required: ['name','telefon','email']
          },
          adresse: {
            type: 'object',
            properties: {
              strasse: { type: ['string','null'] },
              plz:     { type: ['string','null'] },
              ort:     { type: ['string','null'] }
            },
            required: ['strasse','plz','ort']
          },
          versicherung: {
            type: 'object',
            properties: {
              gesellschaft:   { type: ['string','null'] },
              beginn:         { type: ['string','null'] },
              praemie_monat:  { type: ['number','null'] },
              franchise:      { type: ['string','null'] },
              kassenmodell:   { type: ['string','null'] },
              produkte: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    typ:  { type: 'string' },
                    name: { type: 'string' }
                  },
                  required: ['typ','name']
                }
              }
            },
            required: ['gesellschaft','beginn','praemie_monat','franchise','kassenmodell','produkte']
          },
          meta: {
            type: 'object',
            properties: {
              confidence:  { type: 'number' },
              incomplete:  { type: 'boolean' }
            },
            required: ['confidence','incomplete']
          }
        },
        required: ['person','kontaktperson','adresse','versicherung','meta']
      },
      model: 'gemini_3_flash'
    });

    const confidence = result?.meta?.confidence ?? 0;
    const incomplete = result?.meta?.incomplete ?? false;

    // Compute age group from extracted birthdate
    const ageGroup = calcAgeGroup(result?.person?.geburtsdatum);

    // Validation: missing critical fields
    const missingFields = [];
    if (!result?.person?.vorname)          missingFields.push('person.vorname');
    if (!result?.person?.nachname)         missingFields.push('person.nachname');
    if (!result?.person?.geburtsdatum)     missingFields.push('person.geburtsdatum');
    if (!result?.versicherung?.beginn)     missingFields.push('versicherung.beginn');
    if (!result?.versicherung?.gesellschaft) missingFields.push('versicherung.gesellschaft');

    const status = (missingFields.length > 0 || incomplete) ? 'unvollstaendig'
                 : confidence < 85 ? 'pruefung_erforderlich'
                 : 'ok';

    console.log(`[extractApplicationData] confidence=${confidence} status=${status} ageGroup=${ageGroup}`);
    console.log(`[extractApplicationData] EXTRACTED: ${JSON.stringify(result, null, 2)}`);
    console.log(`[extractApplicationData] MAPPING:`);
    console.log(`  person.vorname → Customer.first_name: ${result?.person?.vorname}`);
    console.log(`  person.nachname → Customer.last_name: ${result?.person?.nachname}`);
    console.log(`  person.geburtsdatum → Customer.birthdate: ${result?.person?.geburtsdatum}`);
    console.log(`  adresse.strasse → Customer.street: ${result?.adresse?.strasse}`);
    console.log(`  adresse.plz → Customer.zip_code: ${result?.adresse?.plz}`);
    console.log(`  adresse.ort → Customer.city: ${result?.adresse?.ort}`);
    console.log(`  kontaktperson.telefon → Customer.phone: ${result?.kontaktperson?.telefon}`);
    console.log(`  kontaktperson.email → Customer.email: ${result?.kontaktperson?.email}`);
    console.log(`  versicherung.gesellschaft → Application.insurer: ${result?.versicherung?.gesellschaft}`);
    console.log(`  versicherung.beginn → Application.contract_start_date: ${result?.versicherung?.beginn}`);
    console.log(`  versicherung.franchise → Application.sparte_data.franchise: ${result?.versicherung?.franchise}`);
    console.log(`  versicherung.kassenmodell → Application.sparte_data.model: ${result?.versicherung?.kassenmodell}`);
    console.log(`  versicherung.produkte → Application.sparte_data.produkte: ${JSON.stringify(result?.versicherung?.produkte)}`);
    console.log(`  ageGroup → Application.sparte_data.age_group: ${ageGroup}`);
    if (missingFields.length > 0) console.warn(`[extractApplicationData] MISSING: ${missingFields.join(', ')}`);

    return Response.json({
      success: true,
      structured: result,
      age_group: ageGroup,
      confidence,
      status,          // 'ok' | 'pruefung_erforderlich' | 'unvollstaendig'
      auto_save: confidence >= 85 && status === 'ok',
      missing_fields: missingFields,
    });
  } catch (error) {
    console.error(`[extractApplicationData] ERROR: ${error.message}`);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});