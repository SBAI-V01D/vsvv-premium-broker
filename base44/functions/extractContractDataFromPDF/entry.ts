import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { file_url, customer_id } = await req.json();

    if (!file_url) {
      return Response.json({ error: 'file_url erforderlich' }, { status: 400 });
    }

    const extractionResult = await base44.integrations.Core.InvokeLLM({
      prompt: `Du bist ein Experte für Schweizer Versicherungspolicen. Analysiere das Dokument äusserst präzise und extrahiere ALLE verfügbaren Informationen.

WICHTIG: Lies das gesamte Dokument sorgfältig und extrahiere ALLE folgenden Felder so vollständig wie möglich:

1. **Versicherungsart** (insurance_type): 
   Klassifiziere exakt: KVG, VVG_Zusatz, Leben_3a, Leben_3b, Haftpflicht_Privat, Hausrat, Motorfahrzeug, Gebäude, Rechtsschutz, Unfall, Krankentaggeld, BVG, UVG, Sonstige

2. **Versicherungsgesellschaft** (provider): Vollständiger Name inkl. "Suisse", "AG", etc.

3. **Policennummer** (policy_number): Exakte Nummer/Code auf dem Dokument

4. **Produkt / Tarifname** (product): 
   - Exakter Produkt- oder Tarifname wie auf dem Dokument (z.B. "COMPACT", "FLEXCARE", "TOP", "BASIC", "COMFORT", "PRIMA", "MYCARE", "TELEMED", "STANDARD", "PREMIUM", "GLOBAL", "NATURA", etc.)
   - Für KVG: Modell (HMO, Telemed, Hausarztmodell, Freie Arztwahl, FLEX, etc.) + Franchise (z.B. "300", "500", "1000", "1500", "2000", "2500")
   - Für Motorfahrzeug: Deckungsart (Haftpflicht, Halbkasko, Vollkasko) + Selbstbehalt (z.B. "SB 500")
   - Für Leben/BVG: Planbezeichnung + Deckungssumme
   - Schreibe alles was du siehst: Produktname, Tarifbezeichnung, Plan, Modell

4b. **Zusatzversicherungen** (additional_products): 
   - Wenn das Dokument MEHRERE Versicherungsprodukte enthält (z.B. Grundversicherung KVG + Zusatzversicherungen VVG), liste ALLE zusätzlichen Produkte separat auf
   - Häufig bei: Krankenkassen-Police mit Zusatzmodulen (Spital, Zahn, Ambulant, Ausland), Kombipolicen
   - Für jedes Zusatzprodukt: product (Produktname), premium_monthly, premium_yearly, policy_number (falls abweichend), notes
   - Beispiel: [{"product": "HOSPITAL FLEX", "premium_monthly": 45.20, "premium_yearly": 542.40}, {"product": "DENTA PLUS", "premium_monthly": 18.50}]

5. **Deckungssumme / Versicherungssumme** (coverage_amount): Maximalbetrag in CHF als Zahl, falls vorhanden

6. **Franchise** (franchise): Nur für KVG/Kranken: Franchisebetrag als Zahl (z.B. 300, 500, 1000, 2500)

7. **Selbstbehalt** (deductible): Prozentwert oder Betrag, falls angegeben

8. **Monatsprämie CHF** (premium_monthly): Nur die Zahl, ohne Währungszeichen

9. **Jahresprämie CHF** (premium_yearly): Nur die Zahl, ohne Währungszeichen. Falls nur Monatsprämie: berechne x12

10. **Vertragsbeginn** (start_date): Format YYYY-MM-DD

11. **Vertragsende** (end_date): Format YYYY-MM-DD

12. **Kündigungsfrist** (cancellation_deadline): Datum YYYY-MM-DD oder Anzahl Monate als Text

13. **Versicherungsnehmer Name** (policy_holder_name): Vollständiger Name der versicherten Person / Vertragsinhaber

14. **Geburtsdatum Versicherungsnehmer** (birthdate): Format YYYY-MM-DD falls vorhanden

15. **Adresse** (address): Strasse, PLZ, Ort falls vorhanden (als Text)

16. **Zusätzliche Bemerkungen** (notes): Besondere Klauseln, Boni, Rabatte, Sonderkonditionen, die du auf dem Dokument siehst

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt. Null wenn nicht vorhanden.`,
      file_urls: [file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          insurance_type: { type: 'string' },
          provider: { type: 'string' },
          policy_number: { type: 'string' },
          product: { type: 'string' },
          coverage_amount: { type: ['number', 'null'] },
          franchise: { type: ['number', 'null'] },
          deductible: { type: ['string', 'null'] },
          premium_monthly: { type: ['number', 'null'] },
          premium_yearly: { type: ['number', 'null'] },
          start_date: { type: ['string', 'null'] },
          end_date: { type: ['string', 'null'] },
          cancellation_deadline: { type: ['string', 'null'] },
          policy_holder_name: { type: ['string', 'null'] },
          first_name: { type: ['string', 'null'] },
          last_name: { type: ['string', 'null'] },
          birthdate: { type: ['string', 'null'] },
          address: { type: ['string', 'null'] },
          notes: { type: ['string', 'null'] },
          additional_products: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                product: { type: 'string' },
                policy_number: { type: 'string' },
                premium_monthly: { type: 'number' },
                premium_yearly: { type: 'number' },
                notes: { type: 'string' }
              }
            }
          }
        }
      },
      model: 'gemini_3_flash'
    });

    const data = extractionResult;

    // Map insurance_type to sparte key
    const typeMap = {
      'KVG': 'kvg',
      'VVG_Zusatz': 'vvg_zusatz', 'VVG Zusatz': 'vvg_zusatz', 'Zusatzversicherung': 'vvg_zusatz',
      'Leben_3a': 'leben_3a', 'Säule 3a': 'leben_3a', 'Säule3a': 'leben_3a',
      'Leben_3b': 'leben_3b', 'Säule 3b': 'leben_3b',
      'Haftpflicht_Privat': 'haftpflicht_privat', 'Haftpflicht': 'haftpflicht_privat',
      'Hausrat': 'hausrat',
      'Motorfahrzeug': 'motorfahrzeug', 'Auto': 'motorfahrzeug', 'Fahrzeug': 'motorfahrzeug',
      'Gebäude': 'gebaude_privat',
      'Rechtsschutz': 'rechtsschutz_privat',
      'Unfall': 'unfall_privat',
      'Krankentaggeld': 'ktg', 'KTG': 'ktg',
      'BVG': 'bvg', 'Pensionskasse': 'bvg',
      'UVG': 'uvg',
      'Krankenkasse': 'kvg',
    };

    const rawType = data.insurance_type || '';
    const mappedType = typeMap[rawType] || Object.entries(typeMap).find(([k]) => rawType.toLowerCase().includes(k.toLowerCase()))?.[1] || rawType.toLowerCase().replace(/\s+/g, '_');

    // Build sparte_data for specific spartes
    const sparte_data = {};
    if (data.franchise) sparte_data.franchise = String(data.franchise);
    if (data.deductible) sparte_data.selbstbehalt = data.deductible;
    if (data.coverage_amount) sparte_data.deckungssumme = data.coverage_amount;

    return Response.json({
      success: true,
      extractedData: {
        customer_id,
        insurance_type: mappedType || null,
        insurer: data.provider || null,
        provider: data.provider || null,
        policy_number: data.policy_number || null,
        product: data.product || null,
        premium_monthly: data.premium_monthly ? Number(data.premium_monthly) : null,
        premium_yearly: data.premium_yearly ? Number(data.premium_yearly) : null,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        cancellation_deadline: data.cancellation_deadline || null,
        policy_holder_name: data.policy_holder_name || null,
        first_name: data.first_name || null,
        last_name: data.last_name || null,
        birthdate: data.birthdate || null,
        address: data.address || null,
        notes: data.notes || null,
        sparte_data: Object.keys(sparte_data).length > 0 ? sparte_data : null,
        additional_products: data.additional_products?.length > 0 ? data.additional_products : null,
      },
      message: 'Daten erfolgreich extrahiert. Bitte überprüfen und bestätigen.'
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message,
      message: 'Fehler bei der PDF-Analyse. Bitte versuchen Sie es erneut oder geben Sie die Daten manuell ein.'
    }, { status: 500 });
  }
});