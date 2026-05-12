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

    // Hilfsfunktion: Ähnlichkeit berechnen (Levenshtein-ähnlich)
    const similarity = (str1, str2) => {
      if (!str1 || !str2) return 0;
      const s1 = str1.toLowerCase().trim();
      const s2 = str2.toLowerCase().trim();
      if (s1 === s2) return 1;
      const longer = s1.length > s2.length ? s1 : s2;
      const shorter = s1.length > s2.length ? s2 : s1;
      if (longer.length === 0) return 1;
      const editDistance = levenshteinDistance(longer, shorter);
      return (longer.length - editDistance) / longer.length;
    };

    const levenshteinDistance = (s1, s2) => {
      const costs = [];
      for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
          if (i === 0) {
            costs[j] = j;
          } else if (j > 0) {
            let newValue = costs[j - 1];
            if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
              newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
            }
            costs[j - 1] = lastValue;
            lastValue = newValue;
          }
        }
        if (i > 0) costs[s2.length] = lastValue;
      }
      return costs[s2.length];
    };

    // Suche nach Hauptkontakt: Erst exakt, dann fuzzy match
    let primaryMatch = null;
    let confidenceScore = 0;

    if (extractedData.policy_holder_first_name && extractedData.policy_holder_last_name) {
      // 1. Exakte Übereinstimmung
      primaryMatch = allCustomers.find(c =>
        !c.is_family_member &&
        c.first_name?.toLowerCase() === extractedData.policy_holder_first_name?.toLowerCase() &&
        c.last_name?.toLowerCase() === extractedData.policy_holder_last_name?.toLowerCase()
      );

      if (primaryMatch) {
        confidenceScore = 95;
      } else {
        // 2. Fuzzy match: >80% Ähnlichkeit
        const candidates = allCustomers
          .filter(c => !c.is_family_member)
          .map(c => ({
            customer: c,
            firstNameSim: similarity(c.first_name, extractedData.policy_holder_first_name),
            lastNameSim: similarity(c.last_name, extractedData.policy_holder_last_name),
          }))
          .filter(x => x.firstNameSim > 0.8 && x.lastNameSim > 0.85)
          .sort((a, b) => (b.firstNameSim + b.lastNameSim) - (a.firstNameSim + a.lastNameSim));

        if (candidates.length > 0) {
          primaryMatch = candidates[0].customer;
          confidenceScore = Math.round((candidates[0].firstNameSim + candidates[0].lastNameSim) / 2 * 100);
        }
      }
    }

    if (primaryMatch) {
      insights.matchedPrimaryCustomer = primaryMatch;
      insights.matchConfidence = confidenceScore;

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
    } else {
      // Kein Hauptkontakt gefunden – Angebot für neuen Hauptkunden ODER Familienmitglied zu Bestehendem
      if (extractedData.policy_holder_first_name && extractedData.policy_holder_last_name) {
        insights.suggestedPrimaryCustomer = {
          first_name: extractedData.policy_holder_first_name,
          last_name: extractedData.policy_holder_last_name,
          birthdate: extractedData.birthdate || null,
        };

        // Wenn versicherte Person != Versicherungsnehmer → Option: neues Familienmitglied
        if (
          extractedData.insured_first_name &&
          extractedData.insured_last_name &&
          (extractedData.insured_first_name.toLowerCase() !== extractedData.policy_holder_first_name.toLowerCase() ||
            extractedData.insured_last_name.toLowerCase() !== extractedData.policy_holder_last_name.toLowerCase())
        ) {
          insights.suggestedFamilyMember = {
            first_name: extractedData.insured_first_name,
            last_name: extractedData.insured_last_name,
            birthdate: extractedData.insured_birthdate || null,
          };
        }
      }
      
      // Verfügbare Hauptkontakte für Auswahl bereitstellen (für Familienmitglied-Option)
      const primaryCustomers = allCustomers.filter(c => !c.is_family_member);
      insights.availablePrimaryCustomers = primaryCustomers.map(c => ({
        id: c.id,
        first_name: c.first_name,
        last_name: c.last_name,
        customer_number: c.customer_number,
      }));
      
      insights.matchConfidence = 15; // Zeigt "Neuer Kunde erkannt"
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