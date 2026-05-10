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

    console.log(`[extractPolicyData] START file=${file_name}`);

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `Du bist ein Experte für Schweizer Versicherungspolicen. Analysiere dieses Dokument und extrahiere ALLE verfügbaren Informationen.

WICHTIG: Extrahiere sowohl Vertragsdaten als auch vollständige Kundendaten (Versicherungsnehmer).

KUNDENDATEN (Versicherungsnehmer / "Ihre Adresse" / "An"):
- Vorname und Nachname getrennt (kein Lenker/Fahrer – nur Versicherungsnehmer!)
- Vollständige Adresse: Strasse, PLZ (4-stellig), Ort/Stadt
- Geburtsdatum im Format YYYY-MM-DD
- Telefon / E-Mail wenn vorhanden
- Bei Firmenkunden: Firmenname

VERTRAGSDATEN:
- Policennummer (exakt wie auf dem Dokument)
- Versicherungsgesellschaft
- Versicherungsart (KVG, VVG, Motorfahrzeug, Hausrat, Haftpflicht, Leben, etc.)
- Produkt / Tarif (z.B. COMPACT, HMO, TELEMED, Vollkasko, etc.)
- Vertragsbeginn (YYYY-MM-DD)
- Vertragsende / Ablaufdatum (YYYY-MM-DD) – bei jährlicher Erneuerung: letzter Tag des Jahres
- Monatsprämie als Zahl (z.B. 142.05) – NUR Zahl, kein CHF-Symbol
- Jahresprämie als Zahl (z.B. 1704.60)
- Franchise als Zahl (z.B. 300, 1500, 2500)
- Kassenmodell (Standardmodell, Hausarzt, HMO, Telemed, Flexmed)
- Kündigungsfrist als Datum

ADRESSFORMAT Schweiz: PLZ ist immer 4-stellig (z.B. 8001, 3001, 4051)

Gib null zurück wenn ein Feld nicht vorhanden ist. Kein Raten!`,
      file_urls: [file_url],
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          // Kundendaten
          first_name: { type: ['string', 'null'], description: 'Vorname des Versicherungsnehmers' },
          last_name: { type: ['string', 'null'], description: 'Nachname des Versicherungsnehmers' },
          company_name: { type: ['string', 'null'], description: 'Firmenname (nur bei Firmenkunden)' },
          policy_holder_name: { type: ['string', 'null'], description: 'Vollständiger Name des Versicherungsnehmers' },
          birthdate: { type: ['string', 'null'], description: 'Geburtsdatum (YYYY-MM-DD)' },
          street: { type: ['string', 'null'], description: 'Strasse und Hausnummer' },
          zip_code: { type: ['string', 'null'], description: 'Postleitzahl (4-stellig)' },
          city: { type: ['string', 'null'], description: 'Ort / Stadt' },
          canton: { type: ['string', 'null'], description: 'Kanton (2-stelliger Code, z.B. ZH, BE, AG)' },
          phone: { type: ['string', 'null'], description: 'Telefonnummer' },
          email: { type: ['string', 'null'], description: 'E-Mail-Adresse' },
          // Vertragsdaten
          policy_number: { type: ['string', 'null'], description: 'Policennummer' },
          provider: { type: ['string', 'null'], description: 'Versicherungsgesellschaft' },
          insurance_type: { type: ['string', 'null'], description: 'Versicherungsart (KVG, VVG, Motorfahrzeug, etc.)' },
          product: { type: ['string', 'null'], description: 'Produkt / Tarif' },
          start_date: { type: ['string', 'null'], description: 'Vertragsbeginn (YYYY-MM-DD)' },
          end_date: { type: ['string', 'null'], description: 'Vertragsende (YYYY-MM-DD)' },
          cancellation_deadline: { type: ['string', 'null'], description: 'Kündigungsfrist (YYYY-MM-DD)' },
          premium_monthly: { type: ['number', 'null'], description: 'Monatsprämie in CHF' },
          premium_yearly: { type: ['number', 'null'], description: 'Jahresprämie in CHF' },
          franchise: { type: ['number', 'null'], description: 'Franchise in CHF' },
          kassenmodell: { type: ['string', 'null'], description: 'Kassenmodell (Standardmodell, HMO, Telemed, Hausarzt)' },
          sparte_data: {
            type: ['object', 'null'],
            description: 'Spartenspezifische Daten',
            properties: {
              franchise: { type: ['string', 'null'] },
              model: { type: ['string', 'null'] },
              age_group: { type: ['string', 'null'] }
            }
          },
          additional_products: {
            type: 'array',
            description: 'Zusätzliche Versicherungsprodukte (Zusatzversicherungen)',
            items: {
              type: 'object',
              properties: {
                product: { type: 'string' },
                premium_monthly: { type: ['number', 'null'] },
                premium_yearly: { type: ['number', 'null'] },
                policy_number: { type: ['string', 'null'] }
              }
            }
          },
          notes: { type: ['string', 'null'], description: 'Zusätzliche Hinweise oder Bemerkungen' }
        }
      }
    });

    console.log(`[extractPolicyData] OK: provider=${response.provider} policyHolder=${response.first_name} ${response.last_name} zip=${response.zip_code} city=${response.city}`);

    // Build sparte_data with franchise if found
    const sparteData = response.sparte_data || {};
    if (response.franchise && !sparteData.franchise) {
      sparteData.franchise = String(response.franchise);
    }
    if (response.kassenmodell && !sparteData.model) {
      sparteData.model = response.kassenmodell;
    }

    return Response.json({
      success: true,
      extractedData: {
        // Customer fields
        first_name: response.first_name || null,
        last_name: response.last_name || null,
        company_name: response.company_name || null,
        policy_holder_name: response.policy_holder_name || null,
        birthdate: response.birthdate || null,
        street: response.street || null,
        zip_code: response.zip_code || null,
        city: response.city || null,
        canton: response.canton || null,
        phone: response.phone || null,
        email: response.email || null,
        // Contract fields
        policy_number: response.policy_number || null,
        provider: response.provider || null,
        insurer: response.provider || null,
        insurance_type: response.insurance_type || null,
        product: response.product || null,
        start_date: response.start_date || null,
        end_date: response.end_date || null,
        cancellation_deadline: response.cancellation_deadline || null,
        premium_monthly: response.premium_monthly || null,
        premium_yearly: response.premium_yearly || null,
        sparte_data: Object.keys(sparteData).length > 0 ? sparteData : null,
        additional_products: response.additional_products || [],
        notes: response.notes || null,
      }
    });
  } catch (error) {
    console.error(`[extractPolicyData] ERROR: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});