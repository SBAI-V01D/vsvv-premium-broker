import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * SMART DOCUMENT ANALYSIS — Enterprise Edition v2
 *
 * Ablauf:
 * 1. KI extrahiert alle relevanten Felder inkl. mehrerer Policen (wie Leads-Analyse)
 * 2. Kundenerkennung nach Priorität (kein hartes Auto-Matching über Namen allein)
 * 3. Gibt strukturierte Analyse-Ergebnisse zurück für manuelle Bestätigung im UI
 *
 * WICHTIG: Diese Funktion erstellt KEINE Kunden, Anträge oder Verträge.
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const { file_url, document_type } = await req.json();

    if (!file_url) {
      return Response.json({ error: 'file_url erforderlich' }, { status: 400 });
    }

    // ================================================================
    // SCHRITT 1: KI-EXTRAKTION — erweitertes Schema mit policies-Array
    // ================================================================
    let extracted = null;
    try {
      extracted = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Du bist ein Schweizer Versicherungsexperte. Analysiere dieses Versicherungsdokument präzise.
Dokumenttyp-Hinweis: "${document_type || 'unbekannt'}".

Extrahiere ALLE folgenden Felder soweit im Dokument vorhanden:

DOKUMENTINFO:
- document_subtype: Erkannter Untertyp: "neuantrag", "aenderungsantrag", "erneuerungsantrag", "police", "kuendigung", "offerte", "rechnung", "korrespondenz"
- document_confidence: Konfidenz der Dokumenterkennung (0.0–1.0)
- summary: Kurze Zusammenfassung auf Deutsch (1–2 Sätze)

VERSICHERUNGSNEHMER (Vertragsinhaber):
- policy_holder_first_name, policy_holder_last_name
- policy_holder_birthdate: Format YYYY-MM-DD
- policy_holder_email, policy_holder_phone
- policy_holder_street, policy_holder_zip_code, policy_holder_city

VERSICHERTE PERSON (falls abweichend vom VN):
- insured_first_name, insured_last_name
- insured_birthdate: Format YYYY-MM-DD
- insured_ahv_number
- insured_is_different: true wenn versicherte Person ≠ Versicherungsnehmer

POLICEN (WICHTIG: Extrahiere ALLE Policen/Versicherungen im Dokument als Array!):
Für jede Police:
  - insurer: Versicherungsgesellschaft (z.B. "CSS", "Helsana", "AXA", "Zurich", "Swica", "Sanitas")
  - policy_number: Policen- oder Antragsnummer
  - insurance_type: EXAKT aus: "health"(KVG/VVG/Kranken), "life"(Leben/Rente), "property"(Hausrat/Gebäude), "liability"(Haftpflicht), "motor"(Auto/MF), "other"
  - sparte: z.B. "kvg", "vvg", "uvg", "bvg", "mf", "haftpflicht", "leben"
  - product: Produktname/Tarif (z.B. "Hausarztmodell", "COMPLETA PLUS", "TOP")
  - franchise: Franchise in CHF (Zahl)
  - model: Versicherungsmodell (z.B. "Hausarztmodell", "Telmed", "Standard")
  - coverage_type: Deckungskategorie (z.B. "Erwachsene ab 26", "Kind 0-18")
  - premium_monthly: Monatsprämie als CHF-Zahl
  - premium_yearly: Jahresprämie als CHF-Zahl (falls nur monatlich: mal 12)
  - start_date: Format YYYY-MM-DD
  - end_date: Format YYYY-MM-DD
  - health_declaration_required: true/false
  - coverage_summary: Kurze Beschreibung der Deckung

VERMITTLER & PROVISION:
- broker_name, broker_number
- commission_estimate: Geschätzte Jahresprovision CHF

Antworte NUR mit JSON. Felder nicht gefunden = null.`,
        file_urls: [file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            document_subtype: { type: ['string', 'null'] },
            document_confidence: { type: ['number', 'null'] },
            summary: { type: ['string', 'null'] },
            policy_holder_first_name: { type: ['string', 'null'] },
            policy_holder_last_name: { type: ['string', 'null'] },
            policy_holder_birthdate: { type: ['string', 'null'] },
            policy_holder_email: { type: ['string', 'null'] },
            policy_holder_phone: { type: ['string', 'null'] },
            policy_holder_street: { type: ['string', 'null'] },
            policy_holder_zip_code: { type: ['string', 'null'] },
            policy_holder_city: { type: ['string', 'null'] },
            insured_first_name: { type: ['string', 'null'] },
            insured_last_name: { type: ['string', 'null'] },
            insured_birthdate: { type: ['string', 'null'] },
            insured_ahv_number: { type: ['string', 'null'] },
            insured_is_different: { type: ['boolean', 'null'] },
            policies: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  insurer: { type: ['string', 'null'] },
                  policy_number: { type: ['string', 'null'] },
                  insurance_type: { type: ['string', 'null'] },
                  sparte: { type: ['string', 'null'] },
                  product: { type: ['string', 'null'] },
                  franchise: { type: ['number', 'null'] },
                  model: { type: ['string', 'null'] },
                  coverage_type: { type: ['string', 'null'] },
                  premium_monthly: { type: ['number', 'null'] },
                  premium_yearly: { type: ['number', 'null'] },
                  start_date: { type: ['string', 'null'] },
                  end_date: { type: ['string', 'null'] },
                  health_declaration_required: { type: ['boolean', 'null'] },
                  coverage_summary: { type: ['string', 'null'] },
                }
              }
            },
            broker_name: { type: ['string', 'null'] },
            broker_number: { type: ['string', 'null'] },
            commission_estimate: { type: ['number', 'null'] },
          }
        },
        model: 'gpt_5_mini',
      });
      if (!extracted || typeof extracted !== 'object') {
        throw new Error('Leere Antwort von KI');
      }
    } catch (aiErr) {
      console.error('[smartDocumentAnalysis] KI-Extraktion fehlgeschlagen:', aiErr.message);
      return Response.json({
        success: false,
        error: 'KI-Analyse fehlgeschlagen: ' + aiErr.message,
        extracted: null,
        customerMatches: [],
        detectionPhase: 'extraction_failed',
      });
    }

    // Erste Police als Hauptpolice für Rückwärtskompatibilität
    const policies = extracted.policies || [];
    const firstPolicy = policies[0] || {};

    // ================================================================
    // SCHRITT 2: KUNDENERKENNUNG — parallel + gefiltert (Performance)
    // Verträge nur laden wenn eine Policennummer vorhanden ist
    // ================================================================
    const hasPoliceNumber = policies.some(p => p.policy_number);
    const [allCustomers, allContracts] = await Promise.all([
      base44.asServiceRole.entities.Customer.list(null, 500),
      hasPoliceNumber
        ? base44.asServiceRole.entities.Contract.list(null, 1000)
        : Promise.resolve([]),
    ]);

    const customerMatches = [];
    let detectionPhase = 'no_match';

    const similarity = (a, b) => {
      if (!a || !b) return 0;
      const s1 = a.toLowerCase().trim();
      const s2 = b.toLowerCase().trim();
      if (s1 === s2) return 1;
      const longer = s1.length > s2.length ? s1 : s2;
      const shorter = s1.length > s2.length ? s2 : s1;
      const costs = Array.from({ length: shorter.length + 1 }, (_, i) => i);
      for (let i = 1; i <= longer.length; i++) {
        let prev = i;
        for (let j = 1; j <= shorter.length; j++) {
          const val = longer[i-1] === shorter[j-1] ? costs[j-1]
            : Math.min(costs[j-1], prev, costs[j]) + 1;
          costs[j-1] = prev;
          prev = val;
        }
        costs[shorter.length] = prev;
      }
      return (longer.length - costs[shorter.length]) / longer.length;
    };

    const addMatch = (customer, matchType, confidence, notes) => {
      if (!customerMatches.find(m => m.customer.id === customer.id)) {
        customerMatches.push({ customer, matchType, confidence, notes });
      }
    };

    // PRIORITÄT 1: Policennummer → Vertrag → Kunde (alle Policen prüfen)
    for (const pol of policies) {
      if (pol.policy_number) {
        const contractMatch = allContracts.find(c =>
          c.policy_number && c.policy_number.replace(/[^0-9]/g,'') === pol.policy_number.replace(/[^0-9]/g,'')
        );
        if (contractMatch) {
          const customer = allCustomers.find(c => c.id === contractMatch.customer_id);
          if (customer) {
            addMatch(customer, 'policy_number', 99, `Policennummer ${pol.policy_number} → Vertrag gefunden`);
            detectionPhase = 'matched_via_policy_number';
          }
        }
      }
    }

    // PRIORITÄT 2: E-Mail
    if (extracted.policy_holder_email) {
      const emailMatches = allCustomers.filter(c =>
        c.email && c.email.toLowerCase() === extracted.policy_holder_email.toLowerCase()
      );
      emailMatches.forEach(c => addMatch(c, 'email', 97, `E-Mail: ${extracted.policy_holder_email}`));
      if (emailMatches.length > 0 && detectionPhase === 'no_match') detectionPhase = 'matched_via_email';
    }

    // PRIORITÄT 3: Telefonnummer
    if (extracted.policy_holder_phone) {
      const phone = extracted.policy_holder_phone.replace(/[^0-9]/g, '');
      const phoneMatches = allCustomers.filter(c => {
        const cp = (c.phone || c.mobile || '').replace(/[^0-9]/g, '');
        return cp && cp.length >= 9 && cp === phone;
      });
      phoneMatches.forEach(c => addMatch(c, 'phone', 90, `Telefon: ${extracted.policy_holder_phone}`));
      if (phoneMatches.length > 0 && detectionPhase === 'no_match') detectionPhase = 'matched_via_phone';
    }

    // PRIORITÄT 4: Name + Geburtsdatum
    const searchFirstName = extracted.insured_is_different ? extracted.insured_first_name : extracted.policy_holder_first_name;
    const searchLastName = extracted.insured_is_different ? extracted.insured_last_name : extracted.policy_holder_last_name;
    const searchBirthdate = extracted.insured_is_different ? extracted.insured_birthdate : extracted.policy_holder_birthdate;

    if (searchFirstName && searchLastName && searchBirthdate) {
      const nameGdMatches = allCustomers.filter(c => {
        const fnSim = similarity(c.first_name, searchFirstName);
        const lnSim = similarity(c.last_name, searchLastName);
        const bdMatch = c.birthdate === searchBirthdate;
        return fnSim > 0.85 && lnSim > 0.85 && bdMatch;
      });
      nameGdMatches.forEach(c => {
        const conf = Math.round((similarity(c.first_name, searchFirstName) + similarity(c.last_name, searchLastName)) / 2 * 100);
        addMatch(c, 'name_birthdate', Math.min(conf, 95), `Name + GD: ${searchFirstName} ${searchLastName}`);
      });
      if (nameGdMatches.length > 0 && detectionPhase === 'no_match') detectionPhase = 'matched_via_name_birthdate';
    }

    // PRIORITÄT 5: Adresse (Strasse + PLZ)
    if (extracted.policy_holder_zip_code && extracted.policy_holder_street) {
      const addressMatches = allCustomers.filter(c => {
        if (!c.zip_code || !c.street) return false;
        const zipMatch = c.zip_code === extracted.policy_holder_zip_code;
        const streetSim = similarity(c.street, extracted.policy_holder_street);
        return zipMatch && streetSim > 0.75;
      });
      addressMatches.forEach(c => addMatch(c, 'address', 75, `Adresse: ${extracted.policy_holder_street}, ${extracted.policy_holder_zip_code}`));
      if (addressMatches.length > 0 && detectionPhase === 'no_match') detectionPhase = 'matched_via_address';
    }

    // PRIORITÄT 6: Fuzzy Name — nur wenn noch kein sicherer Match gefunden (Performance)
    if (customerMatches.length === 0 && searchFirstName && searchLastName) {
      const fuzzyMatches = allCustomers
        .map(c => ({
          customer: c,
          score: (similarity(c.first_name, searchFirstName) * 0.5 + similarity(c.last_name, searchLastName) * 0.5),
        }))
        .filter(x => x.score > 0.80)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      fuzzyMatches.forEach(({ customer, score }) => {
        addMatch(customer, 'fuzzy_name', Math.round(score * 70), `Ähnlicher Name (unsicher): ${customer.first_name} ${customer.last_name}`);
      });
      if (fuzzyMatches.length > 0) detectionPhase = 'fuzzy_name_only';
    }

    // ================================================================
    // SCHRITT 3: FAMILIENSTRUKTUR ANALYSIEREN
    // ================================================================
    // Nur Hauptkunden (keine Familienmitglieder) — max 200 ans Frontend
    // Der gematchte Hauptkontakt wird immer eingefügt (auch wenn >200)
    const primaryCustomers = allCustomers.filter(c => !c.is_family_member);
    const primarySlice = primaryCustomers.slice(0, 200);
    // Sicherstellen dass matchedPrimaryCustomer in der Liste ist
    const bestMatchPrimaryId = customerMatches.length > 0
      ? (customerMatches[0].customer.is_family_member ? customerMatches[0].customer.primary_customer_id : customerMatches[0].customer.id)
      : null;
    if (bestMatchPrimaryId && !primarySlice.find(c => c.id === bestMatchPrimaryId)) {
      const missing = primaryCustomers.find(c => c.id === bestMatchPrimaryId);
      if (missing) primarySlice.push(missing);
    }
    const availablePrimaryCustomers = primarySlice.map(c => ({
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      customer_number: c.customer_number,
      city: c.city,
      zip_code: c.zip_code,
    }));

    let matchedPrimaryCustomer = null;
    let availableFamilyMembers = [];

    if (customerMatches.length > 0) {
      const bestMatch = customerMatches[0].customer;
      const primaryId = bestMatch.is_family_member ? bestMatch.primary_customer_id : bestMatch.id;
      if (primaryId) {
        matchedPrimaryCustomer = allCustomers.find(c => c.id === primaryId) || null;
        availableFamilyMembers = allCustomers
          .filter(c => c.id === primaryId || c.primary_customer_id === primaryId)
          .map(c => ({
            id: c.id,
            first_name: c.first_name,
            last_name: c.last_name,
            family_role: c.family_role,
            birthdate: c.birthdate,
            is_family_member: c.is_family_member,
            organization_id: c.organization_id,
            advisor_id: c.advisor_id,
          }));
      }
    }

    // ================================================================
    // SCHRITT 4: DOKUMENTTYP NORMALISIEREN
    // ================================================================
    const subtypeMap = {
      neuantrag: 'neuantrag', 'neuer antrag': 'neuantrag', antrag: 'neuantrag',
      aenderungsantrag: 'aenderungsantrag', änderungsantrag: 'aenderungsantrag',
      'änderung': 'aenderungsantrag', mutation: 'aenderungsantrag',
      erneuerungsantrag: 'erneuerungsantrag', erneuerung: 'erneuerungsantrag',
      'verlängerung': 'erneuerungsantrag', verlaengerung: 'erneuerungsantrag',
      police: 'police', kuendigung: 'kuendigung', offerte: 'offerte',
      rechnung: 'rechnung', korrespondenz: 'korrespondenz',
    };
    const rawSubtype = (extracted.document_subtype || document_type || '').toLowerCase();
    const normalizedSubtype = subtypeMap[rawSubtype] || 'neuantrag';

    // Normalisiere Policen
    const normalizedPolicies = policies.map(pol => ({
      insurer: pol.insurer || null,
      policy_number: pol.policy_number || null,
      insurance_type: pol.insurance_type || 'other',
      sparte: pol.sparte ? pol.sparte.toLowerCase() : null,
      product: pol.product || null,
      franchise: pol.franchise || null,
      model: pol.model || null,
      coverage_type: pol.coverage_type || null,
      premium_monthly: pol.premium_monthly || null,
      premium_yearly: pol.premium_yearly || (pol.premium_monthly ? Math.round(pol.premium_monthly * 12 * 100) / 100 : null),
      start_date: pol.start_date || null,
      end_date: pol.end_date || null,
      health_declaration_required: pol.health_declaration_required || false,
      coverage_summary: pol.coverage_summary || null,
    }));

    return Response.json({
      success: true,
      extracted: {
        // Dokumentinfo
        document_subtype: normalizedSubtype,
        document_confidence: extracted.document_confidence || 0.8,
        summary: extracted.summary || null,
        // Versicherungsnehmer
        policy_holder_first_name: extracted.policy_holder_first_name,
        policy_holder_last_name: extracted.policy_holder_last_name,
        policy_holder_birthdate: extracted.policy_holder_birthdate,
        policy_holder_email: extracted.policy_holder_email,
        policy_holder_phone: extracted.policy_holder_phone,
        policy_holder_street: extracted.policy_holder_street,
        policy_holder_zip_code: extracted.policy_holder_zip_code,
        policy_holder_city: extracted.policy_holder_city,
        // Versicherte Person
        insured_first_name: extracted.insured_first_name,
        insured_last_name: extracted.insured_last_name,
        insured_birthdate: extracted.insured_birthdate,
        insured_ahv_number: extracted.insured_ahv_number,
        insured_is_different: extracted.insured_is_different || false,
        // Policen-Array (neu)
        policies: normalizedPolicies,
        // Rückwärtskompatibilität: erste Police als Hauptfelder
        insurer: firstPolicy.insurer || null,
        policy_number: firstPolicy.policy_number || null,
        insurance_type: firstPolicy.insurance_type || 'other',
        sparte: firstPolicy.sparte ? firstPolicy.sparte.toLowerCase() : null,
        product: firstPolicy.product || null,
        franchise: firstPolicy.franchise || null,
        model: firstPolicy.model || null,
        coverage_type: firstPolicy.coverage_type || null,
        premium_monthly: firstPolicy.premium_monthly || null,
        premium_yearly: firstPolicy.premium_yearly || (firstPolicy.premium_monthly ? Math.round(firstPolicy.premium_monthly * 12 * 100) / 100 : null),
        start_date: firstPolicy.start_date || null,
        end_date: firstPolicy.end_date || null,
        health_declaration_required: firstPolicy.health_declaration_required || false,
        broker_name: extracted.broker_name || null,
        commission_estimate: extracted.commission_estimate || null,
      },
      customerMatches,
      detectionPhase,
      matchedPrimaryCustomer,
      availableFamilyMembers,
      availablePrimaryCustomers,
    });

  } catch (error) {
    console.error('[smartDocumentAnalysis] ERROR:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});