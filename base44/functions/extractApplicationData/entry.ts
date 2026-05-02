import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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
      prompt: `Du bist ein Experte für Schweizer Versicherungsformulare. Analysiere dieses Dokument und extrahiere alle Daten in exakt der vorgegebenen JSON-Struktur.

KRITISCHE REGELN:
- KEIN Feld leer lassen: wenn nicht vorhanden → null
- Datumsformat: YYYY-MM-DD (z.B. 1985-03-15)
- Prämie: nur Zahl ohne Währungssymbol (z.B. 142.05)
- Telefonnummer: internationales Format (z.B. +41791234567)
- E-Mail: validieren, bei ungültigem Format → null
- confidence in "meta": Zahl 0-100 (Gesamtkonfidenz der Extraktion)
- Sprache: Deutsch (CH) oder Französisch

Dateiname: "${file_name || ''}"

Extrahiere GENAU folgende Felder:

person:
  vorname: Vorname der versicherten Person
  nachname: Nachname der versicherten Person
  geburtsdatum: Geburtsdatum (YYYY-MM-DD)

kontaktperson:
  name: Name des Kontakts / Ansprechpartners (kann gleich wie person sein)
  telefon: Telefon- oder Mobilnummer (+41...)
  email: E-Mail-Adresse

adresse:
  strasse: Strasse und Hausnummer
  plz: Postleitzahl
  ort: Ort/Stadt

versicherung:
  gesellschaft: Name der Versicherungsgesellschaft
  sparte: Versicherungsart (KVG/VVG/Leben/Haftpflicht/Motorfahrzeug/Hausrat/BVG/Sonstige)
  beginn: Vertragsbeginn (YYYY-MM-DD)
  praemie_monat: Monatsprämie als Zahl in CHF
  zahlungsintervall: monatlich/vierteljährlich/halbjährlich/jährlich

meta:
  confidence: Gesamtkonfidenz 0-100`,
      file_urls: [file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          person: {
            type: 'object',
            properties: {
              vorname: { type: ['string', 'null'] },
              nachname: { type: ['string', 'null'] },
              geburtsdatum: { type: ['string', 'null'] }
            },
            required: ['vorname', 'nachname', 'geburtsdatum']
          },
          kontaktperson: {
            type: 'object',
            properties: {
              name: { type: ['string', 'null'] },
              telefon: { type: ['string', 'null'] },
              email: { type: ['string', 'null'] }
            },
            required: ['name', 'telefon', 'email']
          },
          adresse: {
            type: 'object',
            properties: {
              strasse: { type: ['string', 'null'] },
              plz: { type: ['string', 'null'] },
              ort: { type: ['string', 'null'] }
            },
            required: ['strasse', 'plz', 'ort']
          },
          versicherung: {
            type: 'object',
            properties: {
              gesellschaft: { type: ['string', 'null'] },
              sparte: { type: ['string', 'null'] },
              beginn: { type: ['string', 'null'] },
              praemie_monat: { type: ['number', 'null'] },
              zahlungsintervall: { type: ['string', 'null'] }
            },
            required: ['gesellschaft', 'sparte', 'beginn', 'praemie_monat', 'zahlungsintervall']
          },
          meta: {
            type: 'object',
            properties: {
              confidence: { type: 'number' }
            },
            required: ['confidence']
          }
        },
        required: ['person', 'kontaktperson', 'adresse', 'versicherung', 'meta']
      },
      model: 'gemini_3_flash'
    });

    const confidence = result?.meta?.confidence ?? 0;
    const autoSave = confidence >= 85;
    const requiresReview = confidence < 85;

    console.log(`[extractApplicationData] RESULT confidence=${confidence} autoSave=${autoSave}`);
    console.log(`[extractApplicationData] EXTRACTED JSON: ${JSON.stringify(result, null, 2)}`);

    // Mapping log
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
    console.log(`  versicherung.sparte → Application.sparte: ${result?.versicherung?.sparte}`);
    console.log(`  versicherung.beginn → Application.contract_start_date: ${result?.versicherung?.beginn}`);
    console.log(`  versicherung.praemie_monat → Application.estimated_premium_monthly: ${result?.versicherung?.praemie_monat}`);

    // Check for missing critical fields
    const missingFields = [];
    if (!result?.person?.vorname) missingFields.push('person.vorname');
    if (!result?.person?.nachname) missingFields.push('person.nachname');
    if (!result?.versicherung?.gesellschaft) missingFields.push('versicherung.gesellschaft');
    if (missingFields.length > 0) {
      console.warn(`[extractApplicationData] MISSING FIELDS: ${missingFields.join(', ')}`);
    }

    return Response.json({
      success: true,
      structured: result,
      confidence,
      auto_save: autoSave,
      requires_review: requiresReview,
      missing_fields: missingFields,
    });
  } catch (error) {
    console.error(`[extractApplicationData] ERROR: ${error.message}`);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});