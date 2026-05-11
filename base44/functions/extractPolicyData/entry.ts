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
      prompt: `Du bist ein Experte für Schweizer Versicherungspolicen. Analysiere dieses Dokument SEHR SORGFÄLTIG und extrahiere ALLE verfügbaren Informationen.

═══════════════════════════════════════════════
KUNDENDATEN (Versicherungsnehmer / Policeninhaber)
═══════════════════════════════════════════════
Suche nach folgenden Abschnitten im Dokument:
- "Versicherungsnehmer", "Policeninhaber", "Ihre Adresse", "An:", "Vertragspartner"
- Das ist NICHT der Lenker/Fahrer, NICHT die versicherte Sache

Extrahiere:
1. first_name: Vorname (z.B. "Hans")
2. last_name: Nachname / Familienname (z.B. "Müller")
3. birthdate: Geburtsdatum im Format YYYY-MM-DD (z.B. 1980-03-15)
   - Suche nach: "geboren am", "Geb.", "Geburtsdatum", "AHV-Nr.", Datum neben dem Namen
4. street: Strasse + Hausnummer (z.B. "Musterstrasse 12")
5. zip_code: Postleitzahl – IMMER 4-stellig in der Schweiz (z.B. "8001", "3001", "4051")
   - Falls du "80010" oder "30010" siehst, nimm nur die ersten 4 Ziffern
6. city: Ortsname (z.B. "Zürich", "Bern", "Basel")
7. canton: 2-Buchstaben Kantonskürzel aus PLZ/Ort ableiten (z.B. "ZH", "BE", "AG", "BS", "LU", "SG")
8. phone: Telefonnummer falls vorhanden
9. email: E-Mail-Adresse falls vorhanden
10. company_name: Firmenname NUR bei Firmenkunden/Gewerbe
11. policy_holder_name: Vollständiger Name (Vorname + Nachname zusammen)

WICHTIG: Wenn ein Feld nicht im Dokument steht → null zurückgeben, NICHT raten!

═══════════════════════════════════════════════
VERTRAGSDATEN
═══════════════════════════════════════════════
12. policy_number: Policennummer exakt wie auf dem Dokument
13. provider: Versicherungsgesellschaft (vollständiger Name, z.B. "Helsana AG", "Zurich Insurance", "AXA Winterthur")
14. insurance_type: Versicherungsart
    Mögliche Werte: KVG, VVG_Zusatz, Motorfahrzeug, Hausrat, Haftpflicht_Privat, Leben_3a, Leben_3b, Unfall, Rechtsschutz, BVG, UVG, KTG, Gebäude
15. product: Exakter Produkt- oder Tarifname (z.B. "COMPACT", "HMO", "TELEMED", "Vollkasko", "TOP", "BASIC")
16. start_date: Vertragsbeginn YYYY-MM-DD
17. end_date: Vertragsende / Ablaufdatum YYYY-MM-DD
18. cancellation_deadline: Kündigungsfrist als Datum YYYY-MM-DD
19. premium_monthly: Monatsprämie als Zahl (z.B. 142.05) – NUR Zahl
20. premium_yearly: Jahresprämie als Zahl (z.B. 1704.60) – NUR Zahl. Falls nur Monatsprämie: x12 berechnen
21. franchise: Franchisebetrag als Zahl (z.B. 300, 1500, 2500) – nur für KVG/Kranken
22. kassenmodell: Modell (Standardmodell, HMO, Telemed, Hausarztmodell, FLEX, Freie Arztwahl)
23. additional_products: Zusatzversicherungen als Array (bei Kombi-Policen)
    Format: [{"product": "HOSPITAL FLEX", "premium_monthly": 45.20, "premium_yearly": 542.40, "policy_number": "..."}]
24. notes: Wichtige Klauseln, Boni, Sonderkonditionen

PLZ-REGELN für die Schweiz:
- ZH=8xxx, BE=3xxx, LU=6xxx, UR=6xxx, SZ=6xxx, OW=6xxx, NW=6xxx, GL=8xxx, ZG=6xxx
- FR=1xxx/1700, SO=4xxx, BS=4xxx, BL=4xxx, SH=8xxx, AR=9xxx, AI=9xxx, SG=9xxx
- GR=7xxx, AG=5xxx, TG=8xxx, TI=6xxx, VD=1xxx, VS=1xxx/3xxx, NE=2xxx, GE=1xxx, JU=2xxx

Gib null zurück wenn ein Feld nicht vorhanden ist.`,
      file_urls: [file_url],
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          first_name: { type: ['string', 'null'] },
          last_name: { type: ['string', 'null'] },
          policy_holder_name: { type: ['string', 'null'] },
          birthdate: { type: ['string', 'null'] },
          street: { type: ['string', 'null'] },
          zip_code: { type: ['string', 'null'] },
          city: { type: ['string', 'null'] },
          canton: { type: ['string', 'null'] },
          phone: { type: ['string', 'null'] },
          email: { type: ['string', 'null'] },
          company_name: { type: ['string', 'null'] },
          policy_number: { type: ['string', 'null'] },
          provider: { type: ['string', 'null'] },
          insurance_type: { type: ['string', 'null'] },
          product: { type: ['string', 'null'] },
          start_date: { type: ['string', 'null'] },
          end_date: { type: ['string', 'null'] },
          cancellation_deadline: { type: ['string', 'null'] },
          premium_monthly: { type: ['number', 'null'] },
          premium_yearly: { type: ['number', 'null'] },
          franchise: { type: ['number', 'null'] },
          kassenmodell: { type: ['string', 'null'] },
          additional_products: {
            type: 'array',
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
          notes: { type: ['string', 'null'] }
        }
      }
    });

    // Normalize zip_code: strip non-digits, take first 4
    let zip = response.zip_code || null;
    if (zip) {
      zip = zip.replace(/\D/g, '').slice(0, 4);
      if (zip.length !== 4) zip = null;
    }

    // Derive canton from zip if KI didn't provide it
    let canton = response.canton || null;
    if (!canton && zip) {
      const prefix = parseInt(zip[0]);
      const map = {1:'VD',2:'NE',3:'BE',4:'BS',5:'AG',6:'LU',7:'GR',8:'ZH',9:'SG'};
      canton = map[prefix] || null;
      // Refine some specific ranges
      if (zip >= '1200' && zip <= '1299') canton = 'GE';
      if (zip >= '1870' && zip <= '1999') canton = 'VS';
      if (zip >= '2300' && zip <= '2999') canton = 'JU';
    }

    // Build sparte_data
    const sparteData = {};
    if (response.franchise) sparteData.franchise = String(response.franchise);
    if (response.kassenmodell) sparteData.model = response.kassenmodell;

    // If only monthly premium given, calculate yearly
    let premiumMonthly = response.premium_monthly || null;
    let premiumYearly = response.premium_yearly || null;
    if (premiumMonthly && !premiumYearly) {
      premiumYearly = Math.round(premiumMonthly * 12 * 100) / 100;
    }

    console.log(`[extractPolicyData] OK: provider=${response.provider} name=${response.first_name} ${response.last_name} zip=${zip} city=${response.city} canton=${canton}`);

    return Response.json({
      success: true,
      extractedData: {
        first_name: response.first_name || null,
        last_name: response.last_name || null,
        policy_holder_name: response.policy_holder_name || null,
        birthdate: response.birthdate || null,
        street: response.street || null,
        zip_code: zip,
        city: response.city || null,
        canton: canton,
        phone: response.phone || null,
        email: response.email || null,
        company_name: response.company_name || null,
        policy_number: response.policy_number || null,
        provider: response.provider || null,
        insurer: response.provider || null,
        insurance_type: response.insurance_type || null,
        product: response.product || null,
        start_date: response.start_date || null,
        end_date: response.end_date || null,
        cancellation_deadline: response.cancellation_deadline || null,
        premium_monthly: premiumMonthly,
        premium_yearly: premiumYearly,
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