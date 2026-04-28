import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url } = await req.json();
    if (!file_url) {
      return Response.json({ error: 'file_url erforderlich' }, { status: 400 });
    }

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `Analysiere dieses Versicherungs-PDF und extrahiere folgende Informationen:
- Versicherungsnummer/Policennummer
- Versicherungsgesellschaft/Anbieter
- Versicherungsart (z.B. KVG, VVG, Leben, Motorfahrzeug, Gebäude, Haftpflicht, etc.)
- Startdatum des Vertrags
- Enddatum/Laufzeit des Vertrags
- Monatliche Prämie (falls angegeben)
- Jährliche Prämie (falls angegeben)

Gib nur die gefundenen Informationen zurück. Wenn ein Feld nicht vorhanden ist, setze es auf null.`,
      file_urls: [file_url],
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          policy_number: {
            type: ['string', 'null'],
            description: 'Policennummer'
          },
          provider: {
            type: ['string', 'null'],
            description: 'Versicherungsgesellschaft'
          },
          insurance_type: {
            type: ['string', 'null'],
            description: 'Versicherungsart'
          },
          start_date: {
            type: ['string', 'null'],
            description: 'Startdatum (ISO-Format: YYYY-MM-DD)'
          },
          end_date: {
            type: ['string', 'null'],
            description: 'Enddatum (ISO-Format: YYYY-MM-DD)'
          },
          premium_monthly: {
            type: ['number', 'null'],
            description: 'Monatliche Prämie'
          },
          premium_yearly: {
            type: ['number', 'null'],
            description: 'Jährliche Prämie'
          }
        }
      }
    });

    // Normalize insurance types
    const validInsuranceTypes = ['KVG', 'VVG', 'Leben', 'Haftpflicht', 'Hausrat', 'Rechtsschutz', 'Motorfahrzeug', 'Gebäude', 'Unfall', 'Krankentaggeld', 'BVG', 'Säule 3a', 'Sonstige'];
    if (response.insurance_type) {
      const upperType = response.insurance_type.toUpperCase().trim();
      const matched = validInsuranceTypes.find(t => upperType.includes(t) || t.includes(upperType));
      response.insurance_type = matched || 'Sonstige';
    }

    return Response.json({
      success: true,
      data: {
        policy_number: response.policy_number || null,
        provider: response.provider || null,
        insurance_type: response.insurance_type || null,
        start_date: response.start_date || null,
        end_date: response.end_date || null,
        premium_monthly: response.premium_monthly || null,
        premium_yearly: response.premium_yearly || null
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});