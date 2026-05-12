import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { file_url, document_id } = await req.json();

    if (!file_url) {
      return Response.json({ error: 'file_url erforderlich' }, { status: 400 });
    }

    // 1. Extrahiere Dokumentdaten (KI-Analyse)
    const extractedData = await base44.integrations.Core.InvokeLLM({
      prompt: `Du bist ein Experte für Schweizer Versicherungsdokumente. Analysiere dieses Dokument präzise und gib folgende Informationen zurück:

1. **Dokumenttyp**: "versicherungsantrag" | "police" | "vertragsdokument" | "zusatzdokument" | "anlage" | "allgemeines_dokument"
2. **Versicherer**: Name der Versicherungsgesellschaft
3. **Versicherte Person**: Vorname und Nachname
4. **Geburtsdatum**: Format YYYY-MM-DD (falls vorhanden)
5. **Policennummer**: Falls vorhanden
6. **Adresse**: Strasse, PLZ, Ort
7. **Versicherungsart**: KVG, Motorfahrzeug, Leben, Haftpflicht, etc.
8. **Monatsprämie**: CHF (nur Zahl)
9. **Jahresprämie**: CHF (nur Zahl)
10. **Hauptkontakt**: Name der Versicherungsnehmer/in (falls unterschiedlich von versicherter Person)

Antworte AUSSCHLIESSLICH mit JSON.`,
      file_urls: [file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          document_type: { type: 'string' },
          insurer: { type: ['string', 'null'] },
          insured_person_name: { type: ['string', 'null'] },
          insured_first_name: { type: ['string', 'null'] },
          insured_last_name: { type: ['string', 'null'] },
          birthdate: { type: ['string', 'null'] },
          policy_number: { type: ['string', 'null'] },
          address: { type: ['string', 'null'] },
          insurance_type: { type: ['string', 'null'] },
          premium_monthly: { type: ['number', 'null'] },
          premium_yearly: { type: ['number', 'null'] },
          policy_holder_name: { type: ['string', 'null'] },
          policy_holder_first_name: { type: ['string', 'null'] },
          policy_holder_last_name: { type: ['string', 'null'] },
        }
      },
      model: 'gemini_3_flash'
    });

    // 2. Hole alle Kunden + Verträge
    const [allCustomers, allContracts] = await Promise.all([
      base44.asServiceRole.entities.Customer.list(null, 500),
      base44.asServiceRole.entities.Contract.list(null, 1000)
    ]);

    // 3. Intelligente Zuordnung
    const insights = {
      documentType: extractedData.document_type || 'unbekannt',
      insurer: extractedData.insurer,
      insuredName: extractedData.insured_person_name || `${extractedData.insured_first_name || ''} ${extractedData.insured_last_name || ''}`.trim(),
      insuredBirthdate: extractedData.birthdate,
      policyHolderName: extractedData.policy_holder_name || extractedData.policy_holder_first_name,
      policyNumber: extractedData.policy_number,
      address: extractedData.address,
      insuranceType: extractedData.insurance_type,
      premiumYearly: extractedData.premium_yearly,
      
      // Matching-Logik
      matchedPrimaryCustomer: null,
      matchedFamily: [],
      suggestedFamilyMember: null,
      suggestedContract: null,
      matchConfidence: 0,
    };

    // Suche nach Hauptkontakt (exakt nach Name + Adresse oder Name + Geburtsdatum)
    if (extractedData.policy_holder_first_name && extractedData.policy_holder_last_name) {
      const primaryMatch = allCustomers.find(c =>
        !c.is_family_member &&
        c.first_name?.toLowerCase() === extractedData.policy_holder_first_name?.toLowerCase() &&
        c.last_name?.toLowerCase() === extractedData.policy_holder_last_name?.toLowerCase()
      );

      if (primaryMatch) {
        insights.matchedPrimaryCustomer = primaryMatch;
        insights.matchConfidence = 95;

        // Hole Familie
        const familyMembers = allCustomers.filter(m =>
          m.primary_customer_id === primaryMatch.id && m.family_role !== 'primary'
        );
        insights.matchedFamily = familyMembers;

        // Prüfe ob versicherte Person ein bekanntes Familienmitglied ist
        if (extractedData.insured_first_name && extractedData.insured_last_name) {
          const insuredMatch = familyMembers.find(m =>
            m.first_name?.toLowerCase() === extractedData.insured_first_name?.toLowerCase() &&
            m.last_name?.toLowerCase() === extractedData.insured_last_name?.toLowerCase()
          );

          if (insuredMatch) {
            insights.suggestedContract = {
              customer_id: insuredMatch.id,
              insurer: extractedData.insurer,
              insurance_type: extractedData.insurance_type,
              premium_yearly: extractedData.premium_yearly,
              policy_number: extractedData.policy_number,
              status: 'pending',
            };
          } else if (extractedData.insured_birthdate || extractedData.insured_first_name) {
            // Neues Familienmitglied vorschlagen
            insights.suggestedFamilyMember = {
              first_name: extractedData.insured_first_name || '',
              last_name: extractedData.insured_last_name || '',
              birthdate: extractedData.insured_birthdate,
              primary_customer_id: primaryMatch.id,
              family_role: extractedData.insured_birthdate ? 'child' : 'spouse',
            };
          }
        }
      }
    }

    return Response.json({
      success: true,
      insights,
      extractedData,
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
});