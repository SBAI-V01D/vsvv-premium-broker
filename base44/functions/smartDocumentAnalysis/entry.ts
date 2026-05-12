import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { file_url, document_id } = await req.json();

    if (!file_url) {
      return Response.json({ error: 'file_url erforderlich' }, { status: 400 });
    }

    // ============================================================
    // PHASE 1: DETERMINISTIC MATCHING (Schnell, günstig, präzise)
    // ============================================================

    // 1. Hole Kundendaten
    const [allCustomers, allContracts] = await Promise.all([
      base44.asServiceRole.entities.Customer.list(null, 500),
      base44.asServiceRole.entities.Contract.list(null, 1000)
    ]);

    const insights = {
      documentType: 'unbekannt',
      matchedPrimaryCustomer: null,
      matchedFamily: [],
      suggestedPrimaryCustomer: null,
      suggestedFamilyMember: null,
      suggestedContract: null,
      availablePrimaryCustomers: [],
      matchConfidence: 0,
      matchPhase: 'exact',
      requiresKIAnalysis: false,
    };

    // Hilfsfunktion: Ähnlichkeit berechnen (Levenshtein)
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

    // STEP 1: EXACT MATCHING (99% Konfidenz)
    // Versuche mit Kundennummer, E-Mail, Telefon, exaktem Namen
    let matchedCustomer = null;

    // Versuche OCR-Text direkt aus Dateinamen/Metadaten zu extrahieren
    // Sehr schnell: Regex auf typische Muster
    const docNamePatterns = {
      customerNumber: /(?:K-|Kund[e]?\s+)?(\d{3,5})/i,
      policyNumber: /(?:Police|Policy|Vertrag)\s*[#:]?\s*(\d{8,})/i,
      email: /([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+)/,
      phone: /(?:\+41|0)(?:\s)?(?:\d{2}\s?\d{3}\s?\d{2}\s?\d{2}|\d{9})/,
    };

    // Wenn Kundennummer im Dateinamen → direkter Treffer
    const customerNumberMatch = document_id?.match(docNamePatterns.customerNumber);
    if (customerNumberMatch) {
      matchedCustomer = allCustomers.find(c =>
        c.customer_number === customerNumberMatch[1]
      );
      if (matchedCustomer && !matchedCustomer.is_family_member) {
        insights.matchedPrimaryCustomer = matchedCustomer;
        insights.matchConfidence = 99;
        insights.matchPhase = 'exact_customer_number';
      }
    }

    // STEP 2: FUZZY NAME MATCHING (85-95% Konfidenz)
    // Wenn noch kein Match: Führe einfache Fuzzy-Suche durch
    if (!insights.matchedPrimaryCustomer) {
      // Dieser Schritt ist SEHR schnell - kein LLM-Call
      const candidates = allCustomers
        .filter(c => !c.is_family_member)
        .map(c => ({
          customer: c,
          score: (
            (similarity(c.first_name, '') * 0.3 || 0) +
            (similarity(c.last_name, '') * 0.7 || 0)
          ),
        }))
        .filter(x => x.score > 0.85)
        .sort((a, b) => b.score - a.score);

      if (candidates.length > 0) {
        matchedCustomer = candidates[0].customer;
        insights.matchedPrimaryCustomer = matchedCustomer;
        insights.matchConfidence = Math.round(candidates[0].score * 100);
        insights.matchPhase = 'fuzzy_name';
      }
    }

    // ============================================================
    // PHASE 2: KI ANALYSE NUR BEI BEDARF
    // ============================================================

    // Wenn kein gutes Match gefunden → KI-Analyse nur für Extraktion
    if (!insights.matchedPrimaryCustomer) {
      insights.requiresKIAnalysis = true;
      insights.matchPhase = 'ki_extraction_needed';

      try {
        const extractedData = await base44.integrations.Core.InvokeLLM({
          prompt: `Analysiere dieses Versicherungsdokument und extrahiere STRUKTURIERT:
          
1. **Versicherungsnehmer**: Vorname, Nachname
2. **Geburtsdatum**: YYYY-MM-DD
3. **Adresse**: Strasse, PLZ, Ort
4. **E-Mail / Telefon**
5. **Versicherer**
6. **Policennummer**
7. **Versicherungsart**
8. **Jahresprämie**: nur Zahl
9. **Versicherte Person** (falls unterschiedlich): Vorname, Nachname

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
              address: { type: ['string', 'null'] },
              email: { type: ['string', 'null'] },
              phone: { type: ['string', 'null'] },
              insurer: { type: ['string', 'null'] },
              policy_number: { type: ['string', 'null'] },
              insurance_type: { type: ['string', 'null'] },
              premium_yearly: { type: ['number', 'null'] },
              document_type: { type: ['string', 'null'] },
            }
          },
          model: 'gemini_3_flash' // Schneller als default
        });

        // Nach KI-Extraktion: Erneut Fuzzy Matching versuchen
        if (extractedData.policy_holder_first_name && extractedData.policy_holder_last_name) {
          const fuzzyMatches = allCustomers
            .filter(c => !c.is_family_member)
            .map(c => ({
              customer: c,
              firstSim: similarity(c.first_name, extractedData.policy_holder_first_name),
              lastSim: similarity(c.last_name, extractedData.policy_holder_last_name),
            }))
            .filter(x => x.firstSim > 0.8 && x.lastSim > 0.85)
            .sort((a, b) => (b.firstSim + b.lastSim) - (a.firstSim + a.lastSim));

          if (fuzzyMatches.length > 0) {
            matchedCustomer = fuzzyMatches[0].customer;
            insights.matchedPrimaryCustomer = matchedCustomer;
            insights.matchConfidence = Math.round(
              (fuzzyMatches[0].firstSim + fuzzyMatches[0].lastSim) / 2 * 100
            );
            insights.matchPhase = 'fuzzy_after_ki';
          } else {
            // Neuer Kunde erkannt
            insights.suggestedPrimaryCustomer = {
              first_name: extractedData.policy_holder_first_name,
              last_name: extractedData.policy_holder_last_name,
              birthdate: extractedData.birthdate,
              email: extractedData.email,
              phone: extractedData.phone,
            };

            // Neues Familienmitglied?
            if (
              extractedData.insured_first_name &&
              extractedData.insured_last_name &&
              (extractedData.insured_first_name.toLowerCase() !== extractedData.policy_holder_first_name.toLowerCase() ||
                extractedData.insured_last_name.toLowerCase() !== extractedData.policy_holder_last_name.toLowerCase())
            ) {
              insights.suggestedFamilyMember = {
                first_name: extractedData.insured_first_name,
                last_name: extractedData.insured_last_name,
                birthdate: extractedData.birthdate,
              };
            }

            insights.matchConfidence = 15;
            insights.matchPhase = 'new_customer_detected';
          }
        }

        insights.documentType = extractedData.document_type;
      } catch (kiError) {
        console.error('KI-Analyse fehlgeschlagen:', kiError);
        insights.matchPhase = 'ki_failed';
        insights.matchConfidence = 0;
      }
    }

    // Wenn Hauptkunde gefunden: Familie prüfen
    if (insights.matchedPrimaryCustomer) {
      const familyMembers = allCustomers.filter(m =>
        m.primary_customer_id === insights.matchedPrimaryCustomer.id &&
        m.family_role !== 'primary'
      );
      insights.matchedFamily = familyMembers;
    }

    // Verfügbare Hauptkontakte für UI (wenn neuer Kunde)
    if (!insights.matchedPrimaryCustomer) {
      insights.availablePrimaryCustomers = allCustomers
        .filter(c => !c.is_family_member)
        .map(c => ({
          id: c.id,
          first_name: c.first_name,
          last_name: c.last_name,
          customer_number: c.customer_number,
        }));
    }

    return Response.json({
      success: true,
      insights,
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: error.message,
      phase: 'unknown',
    }, { status: 500 });
  }
});