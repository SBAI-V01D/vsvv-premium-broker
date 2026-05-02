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

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Du bist ein Experte für Schweizer Versicherungsformulare. Analysiere dieses Dokument (Versicherungsantrag) und extrahiere alle relevanten Daten.

Extrahiere folgende Felder mit einem Konfidenzwert (0.0 - 1.0) pro Feld:

PERSONENDATEN:
- first_name: Vorname
- last_name: Nachname
- birthdate: Geburtsdatum (Format: YYYY-MM-DD)
- street: Strasse und Hausnummer
- zip_code: Postleitzahl
- city: Ort
- canton: Kanton (2-Buchstaben-Kürzel wie ZH, BE, etc.)
- phone: Telefonnummer
- mobile: Mobilnummer
- email: E-Mail-Adresse
- ahv_number: AHV-Nummer (Format: 756.xxxx.xxxx.xx)
- civil_status: Zivilstand (single/married/divorced/widowed)
- profession: Beruf

VERSICHERUNGSDATEN:
- insurer: Versicherungsgesellschaft
- insurance_type: Versicherungsart (KVG/VVG/Leben/Haftpflicht/Motorfahrzeug/Hausrat/BVG/Sonstige)
- product: Produkt / Tarif
- policy_number: Policen- oder Vertragsnummer
- contract_start_date: Vertragsbeginn (YYYY-MM-DD)
- contract_end_date: Vertragsende (YYYY-MM-DD)
- estimated_premium_monthly: Monatsprämie in CHF (nur Zahl)
- estimated_premium_yearly: Jahresprämie in CHF (nur Zahl)
- payment_interval: Zahlungsintervall (monatlich/vierteljährlich/halbjährlich/jährlich)
- franchise: Franchise falls KVG (z.B. "300", "500", "1000", "1500", "2000", "2500")

FIRMENDATEN (falls vorhanden):
- company_name: Firmenname
- company_uid: UID-Nummer
- company_industry: Branche
- company_contact: Ansprechpartner

Für jedes gefundene Feld gib einen Konfidenzwert an (wie sicher du dir bist).
Wenn ein Feld nicht im Dokument vorhanden ist, setze den Wert auf null und Konfidenz auf 0.

Sprache: Deutsch (CH), eventuell Französisch.
Dateiname als Kontext: "${file_name || ''}"`,
      file_urls: [file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          fields: {
            type: 'object',
            properties: {
              first_name: { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'number' } } },
              last_name: { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'number' } } },
              birthdate: { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'number' } } },
              street: { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'number' } } },
              zip_code: { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'number' } } },
              city: { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'number' } } },
              canton: { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'number' } } },
              phone: { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'number' } } },
              mobile: { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'number' } } },
              email: { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'number' } } },
              ahv_number: { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'number' } } },
              civil_status: { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'number' } } },
              profession: { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'number' } } },
              insurer: { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'number' } } },
              insurance_type: { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'number' } } },
              product: { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'number' } } },
              policy_number: { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'number' } } },
              contract_start_date: { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'number' } } },
              contract_end_date: { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'number' } } },
              estimated_premium_monthly: { type: 'object', properties: { value: { type: ['number', 'null'] }, confidence: { type: 'number' } } },
              estimated_premium_yearly: { type: 'object', properties: { value: { type: ['number', 'null'] }, confidence: { type: 'number' } } },
              payment_interval: { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'number' } } },
              franchise: { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'number' } } },
              company_name: { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'number' } } },
              company_uid: { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'number' } } },
              company_industry: { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'number' } } },
              company_contact: { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'number' } } },
            }
          },
          overall_confidence: { type: 'number' },
          extraction_notes: { type: 'string' }
        },
        required: ['fields', 'overall_confidence']
      },
      model: 'gemini_3_flash'
    });

    return Response.json({
      success: true,
      fields: result.fields || {},
      overall_confidence: result.overall_confidence || 0,
      extraction_notes: result.extraction_notes || '',
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});