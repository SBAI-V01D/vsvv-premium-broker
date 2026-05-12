import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { file_url, document_id } = await req.json();

    if (!file_url) {
      return Response.json({ error: 'file_url erforderlich' }, { status: 400 });
    }

    // ============================================================
    // INTELLIGENCE: PRIORITÄT 1 → 5 (Familie-zentrisch, nicht Person-zentrisch)
    // ============================================================

    // Lade alle Daten
    const [allCustomers, allContracts] = await Promise.all([
      base44.asServiceRole.entities.Customer.list(null, 500),
      base44.asServiceRole.entities.Contract.list(null, 1000)
    ]);

    const insights = {
      // Phase Information
      detectionPhase: null,
      requiresKIAnalysis: false,

      // Erkannte Daten
      extractedData: null,

      // PRIORITÄT 1: Familie erkannt?
      familyDetected: null,
      matchedPrimaryCustomer: null,

      // PRIORITÄT 2: Person erkannt?
      matchedPerson: null,
      personIsInFamily: false,

      // PRIORITÄT 3: Neues Familienmitglied?
      suggestedFamilyMember: null,

      // PRIORITÄT 4: Vertrag erkannt?
      suggestedContract: null,
      suggestedContractInsurer: null,
      suggestedContractType: null,

      // PRIORITÄT 5: Neuer Hauptkontakt?
      suggestedPrimaryCustomer: null,

      // UI-Hilfsdaten
      availablePrimaryCustomers: [],
      availableFamilyMembers: [],
      
      // Konfidenz auf jeder Stufe
      familyConfidence: 0,
      personConfidence: 0,
      contractConfidence: 0,
    };

    // ============================================================
    // KI EXTRAKTION (nur wenn nötig später)
    // ============================================================
    let extractedData = null;

    const extractFromDocument = async () => {
      if (extractedData) return extractedData;

      insights.requiresKIAnalysis = true;

      try {
        extractedData = await base44.integrations.Core.InvokeLLM({
          prompt: `Analysiere dieses Versicherungsdokument STRUKTURIERT:

1. **Versicherungsnehmer**: Vorname, Nachname
2. **Geburtsdatum**: YYYY-MM-DD
3. **Adresse**: Strasse, PLZ, Ort
4. **E-Mail / Telefon**
5. **Versicherter / Lenker**: Vorname, Nachname (falls unterschiedlich)
6. **Versicherer**
7. **Policennummer**
8. **Versicherungsart**
9. **Jahresprämie**

Antworte NUR mit JSON.`,
          file_urls: [file_url],
          response_json_schema: {
            type: 'object',
            properties: {
              policy_holder_first_name: { type: ['string', 'null'] },
              policy_holder_last_name: { type: ['string', 'null'] },
              insured_first_name: { type: ['string', 'null'] },
              insured_last_name: { type: ['string', 'null'] },
              birthdate: { type: ['string', 'null'] },
              street: { type: ['string', 'null'] },
              zip_code: { type: ['string', 'null'] },
              city: { type: ['string', 'null'] },
              email: { type: ['string', 'null'] },
              phone: { type: ['string', 'null'] },
              insurer: { type: ['string', 'null'] },
              policy_number: { type: ['string', 'null'] },
              insurance_type: { type: ['string', 'null'] },
              premium_yearly: { type: ['number', 'null'] },
            }
          },
          model: 'gemini_3_flash'
        });

        insights.extractedData = extractedData;
        return extractedData;
      } catch (error) {
        console.error('KI-Extraktion fehlgeschlagen:', error);
        return null;
      }
    };

    // ============================================================
    // HELPER: Similarity & Matching
    // ============================================================
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
          if (i === 0) costs[j] = j;
          else if (j > 0) {
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

    // ============================================================
    // PRIORITÄT 1: FAMILIE ERKANNT?
    // ============================================================
    // Über: Adresse, Familienname, bestehende Verträge, Policennummer
    
    const extracted = await extractFromDocument();

    // 1a. Via Adresse (schnell)
    if (extracted?.zip_code && extracted?.city) {
      const familyCandidates = allCustomers
        .filter(c => !c.is_family_member && c.zip_code === extracted.zip_code)
        .filter(c => (c.last_name.toLowerCase() === extracted.policy_holder_last_name.toLowerCase()));

      if (familyCandidates.length > 0) {
        insights.matchedPrimaryCustomer = familyCandidates[0];
        insights.familyConfidence = 92;
        insights.detectionPhase = 'family_via_address';
      }
    }

    // 1b. Via Familienname + Adresse (Fuzzy)
    if (!insights.matchedPrimaryCustomer && extracted?.policy_holder_last_name) {
      const familyMatches = allCustomers
        .filter(c => !c.is_family_member)
        .map(c => ({
          customer: c,
          score: similarity(c.last_name, extracted.policy_holder_last_name),
        }))
        .filter(x => x.score > 0.90)
        .sort((a, b) => b.score - a.score);

      if (familyMatches.length > 0) {
        insights.matchedPrimaryCustomer = familyMatches[0].customer;
        insights.familyConfidence = Math.round(familyMatches[0].score * 100);
        insights.detectionPhase = 'family_via_lastname';
      }
    }

    // ============================================================
    // PRIORITÄT 2: PERSON IN FAMILIE ERKANNT?
    // ============================================================
    let matchedFamily = [];
    
    if (insights.matchedPrimaryCustomer) {
      // Hole alle Familienmitglieder
      matchedFamily = allCustomers.filter(m =>
        (m.id === insights.matchedPrimaryCustomer.id) ||
        (m.primary_customer_id === insights.matchedPrimaryCustomer.id)
      );

      // Versuche die versicherte Person zu matchen
      const insuredName = extracted?.insured_first_name || extracted?.policy_holder_first_name;
      const insuredLast = extracted?.insured_last_name || extracted?.policy_holder_last_name;

      if (insuredName && insuredLast) {
        const personMatches = matchedFamily
          .map(m => ({
            person: m,
            score: (
              similarity(m.first_name, insuredName) * 0.5 +
              similarity(m.last_name, insuredLast) * 0.5
            ),
          }))
          .filter(x => x.score > 0.80)
          .sort((a, b) => b.score - a.score);

        if (personMatches.length > 0) {
          insights.matchedPerson = personMatches[0].person;
          insights.personConfidence = Math.round(personMatches[0].score * 100);
          insights.personIsInFamily = true;
          insights.detectionPhase = 'person_in_family_found';
        }
      }

      insights.availableFamilyMembers = matchedFamily.map(m => ({
        id: m.id,
        first_name: m.first_name,
        last_name: m.last_name,
        family_role: m.family_role,
      }));
    }

    // ============================================================
    // PRIORITÄT 3: NEUES FAMILIENMITGLIED ERKANNT?
    // ============================================================
    if (insights.matchedPrimaryCustomer && !insights.matchedPerson) {
      // Unterschiedliche Personen erkannt
      if (
        extracted?.insured_first_name &&
        extracted?.insured_last_name &&
        (extracted.insured_first_name.toLowerCase() !== extracted.policy_holder_first_name.toLowerCase() ||
         extracted.insured_last_name.toLowerCase() !== extracted.policy_holder_last_name.toLowerCase())
      ) {
        insights.suggestedFamilyMember = {
          first_name: extracted.insured_first_name,
          last_name: extracted.insured_last_name,
          birthdate: extracted.birthdate,
          family_role: 'other',
        };
        insights.detectionPhase = 'new_family_member_suggested';
      }
    }

    // ============================================================
    // PRIORITÄT 4: VERTRAG ERKANNT?
    // ============================================================
    if (extracted?.insurer && extracted?.insurance_type) {
      // Bestehende Verträge checken
      const existingContracts = (insights.matchedPerson?.id || insights.matchedPrimaryCustomer?.id)
        ? allContracts.filter(c => 
            c.customer_id === (insights.matchedPerson?.id || insights.matchedPrimaryCustomer?.id)
          )
        : [];

      // Ist es ein neuer Vertrag?
      const sameInsurer = !existingContracts.find(c =>
        c.insurer.toLowerCase() === extracted.insurer.toLowerCase() &&
        c.insurance_type === extracted.insurance_type
      );

      if (sameInsurer) {
        insights.suggestedContract = {
          insurer: extracted.insurer,
          insurance_type: extracted.insurance_type,
          premium_yearly: extracted.premium_yearly,
          policy_number: extracted.policy_number,
        };
        insights.contractConfidence = 85;
        insights.detectionPhase = 'new_contract_detected';
      }
    }

    // ============================================================
    // PRIORITÄT 5: NEUER HAUPTKONTAKT? (Nur wenn alles else fehlschlägt)
    // ============================================================
    if (!insights.matchedPrimaryCustomer && extracted) {
      insights.suggestedPrimaryCustomer = {
        first_name: extracted.policy_holder_first_name,
        last_name: extracted.policy_holder_last_name,
        email: extracted.email,
        phone: extracted.phone,
        birthdate: extracted.birthdate,
        street: extracted.street,
        zip_code: extracted.zip_code,
        city: extracted.city,
      };
      insights.detectionPhase = 'new_primary_customer_last_resort';

      // Verfügbare Hauptkunden für manuelle Auswahl
      insights.availablePrimaryCustomers = allCustomers
        .filter(c => !c.is_family_member)
        .map(c => ({
          id: c.id,
          first_name: c.first_name,
          last_name: c.last_name,
          customer_number: c.customer_number,
        }));
    } else if (!insights.matchedPrimaryCustomer) {
      // Keine Extraktion möglich
      insights.detectionPhase = 'extraction_failed';
    }

    return Response.json({
      success: true,
      insights,
    });

  } catch (error) {
    console.error('smartDocumentAnalysis Fehler:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
});