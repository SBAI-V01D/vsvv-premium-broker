import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { file_url, customer_id } = await req.json();

    if (!file_url) {
      return Response.json({ error: 'file_url erforderlich' }, { status: 400 });
    }

    // Extract contract data using LLM with vision
    const extractionResult = await base44.integrations.Core.InvokeLLM({
      prompt: `Analysiere das hochgeladene Versicherungsdokument/die Police und extrahiere folgende Informationen:
      
      1. Versicherungsart (z.B. KVG, VVG, Leben, Haftpflicht, Hausrat, Motorfahrzeug, Gebäude, etc.)
      2. Versicherungsgesellschaft/Versicherer
      3. Policennummer
      4. Monatsprämie in CHF (nur die Zahl)
      5. Jahresprämie in CHF (nur die Zahl)
      6. Vertragsbeginn (Datum im Format YYYY-MM-DD)
      7. Vertragsende/Ablaufdatum (Datum im Format YYYY-MM-DD)
      8. Kündigungsfrist (Datum im Format YYYY-MM-DD, falls vorhanden)
      
      Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt (keine zusätzlichen Erklärungen).
      Wenn eine Information nicht gefunden wird, setze sie auf null.
      Beispiel:
      {
        "insurance_type": "KVG",
        "provider": "Allianz Suisse",
        "policy_number": "123456789",
        "premium_monthly": 250.50,
        "premium_yearly": 3006,
        "start_date": "2023-01-15",
        "end_date": "2025-01-15",
        "cancellation_deadline": "2024-10-15"
      }`,
      file_urls: [file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          insurance_type: { type: 'string' },
          provider: { type: 'string' },
          policy_number: { type: 'string' },
          premium_monthly: { type: ['number', 'null'] },
          premium_yearly: { type: ['number', 'null'] },
          start_date: { type: ['string', 'null'] },
          end_date: { type: ['string', 'null'] },
          cancellation_deadline: { type: ['string', 'null'] }
        }
      },
      model: 'gemini_3_flash'
    });

    // Validate extracted data
    const data = extractionResult;
    
    // Map insurance_type to valid enum values if needed
    const validTypes = ['KVG', 'VVG', 'Leben', 'Haftpflicht', 'Hausrat', 'Rechtsschutz', 'Motorfahrzeug', 'Gebäude', 'Unfall', 'Krankentaggeld', 'BVG', 'Säule 3a', 'Sonstige'];
    
    if (data.insurance_type && !validTypes.includes(data.insurance_type)) {
      // Try to map common variations
      const typeMap = {
        'Krankenkasse': 'KVG',
        'Haftung': 'Haftpflicht',
        'Haus': 'Hausrat',
        'Auto': 'Motorfahrzeug',
        'Gebäude': 'Gebäude',
        'Altersvorsorge': 'Säule 3a'
      };
      for (const [key, value] of Object.entries(typeMap)) {
        if (data.insurance_type.includes(key)) {
          data.insurance_type = value;
          break;
        }
      }
      if (!validTypes.includes(data.insurance_type)) {
        data.insurance_type = 'Sonstige';
      }
    }

    return Response.json({
      success: true,
      extractedData: {
        customer_id,
        insurance_type: data.insurance_type || null,
        provider: data.provider || null,
        policy_number: data.policy_number || null,
        premium_monthly: data.premium_monthly ? Number(data.premium_monthly) : null,
        premium_yearly: data.premium_yearly ? Number(data.premium_yearly) : null,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        cancellation_deadline: data.cancellation_deadline || null
      },
      message: 'Daten erfolgreich extrahiert. Bitte überprüfen und bestätigen.'
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message,
      message: 'Fehler bei der PDF-Analyse. Bitte versuchen Sie es später erneut oder geben Sie die Daten manuell ein.'
    }, { status: 500 });
  }
});