import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * SMART DOCUMENT ANALYSIS — Strict Mode v3
 * Model: claude_sonnet_4_6 (hallucination-free)
 * - Nur Produkte mit explizitem CHF-Betrag werden extrahiert
 * - Versicherungsnehmer (Adressblock) vs. versicherte Person klar getrennt
 * - Kundenzuordnung sucht BEIDE: Versicherungsnehmer UND versicherte Person
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const { file_url, document_type } = await req.json();
    if (!file_url) {
      return Response.json({ error: 'file_url erforderlich' }, { status: 400 });
    }

    // Auth required — InvokeLLM muss user-scoped sein damit file_url korrekt aufgeloest wird
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[smartDocumentAnalysis] START model=claude_sonnet_4_6 user=' + user.email);

    // ================================================================
    // SCHRITT 1: KI-EXTRAKTION — STRICT MODE mit Claude
    // ================================================================
    let extracted = null;
    try {
      extracted = await base44.integrations.Core.InvokeLLM({
        model: 'claude_sonnet_4_6',
        file_urls: [file_url],
        prompt: `Du bist eine deterministische Schweizer Versicherungs-Extraktionsengine. STRICT MODE aktiv.
Dokumenttyp-Hinweis: "${document_type || 'unbekannt'}"

## ABSOLUTE VERBOTE — Null Toleranz
- NIEMALS Produkte ergänzen, ableiten, erfinden oder aus Erfahrung hinzufügen
- NIEMALS Standardprodukte annehmen ("KVG hat immer Grundversicherung", "CSS hat Ambulant")
- NIEMALS fehlende Werte mit Strings füllen — nur null zurückgeben
- NIEMALS "unknown", "n/a", "nicht angegeben" schreiben — immer null

## PRODUKTE — Eiserne Regel
Ein Eintrag im policies-Array ist NUR erlaubt wenn GLEICHZEITIG gilt:
  1. Ein Produktname steht explizit im Dokument
  2. Daneben steht ein CHF-Betrag (Zahl) — nicht "inklusive", nicht "kostenfrei"
  3. Es ist eine eigenständige Position, kein Unterpunkt / keine Variante

NICHT extrahieren (auch wenn erwähnt):
- Gesundheitskonto, Gesundheitskonto-Bonus
- 24h Notfallservice, medizinische Beratung
- "Allgemeine Abteilung", "Halbprivate Abteilung" (das sind Optionen, keine Produkte)
- Inklusivleistungen, Boni, Rabatte
- Alles ohne eigenen CHF-Betrag

BEISPIEL KORREKT: Nur "Spitalversicherung myFlex CHF 63.10" im Dokument → 1 Eintrag mit product="Spitalversicherung myFlex", premium_monthly=63.10
BEISPIEL FALSCH: Zusätzlich Grundversicherung/Ambulant hinzufügen weil "CSS typischerweise..."

## PERSONENROLLEN — Strikte Priorität

SCHRITT 1 — VERSICHERUNGSNEHMER (= Adressblock oben rechts / Briefkopf):
  Der Name und die Adresse oben auf dem Dokument = Versicherungsnehmer / Prämienzahler
  → policy_holder_first_name, policy_holder_last_name, policy_holder_street/zip/city

SCHRITT 2 — VERSICHERTE PERSON (= wer tatsächlich versichert ist):
  Steht als "VERSICHERUNGSPOLICE für [Name]" oder "Versicherter:" oder in der Deckungstabelle
  → insured_first_name, insured_last_name, insured_birthdate
  → insured_is_different = true wenn NICHT identisch mit Versicherungsnehmer

WICHTIG: Adressblock-Person ≠ versicherte Person ist häufig (z.B. Ehefrau zahlt, Ehemann versichert)

## ZU EXTRAHIERENDE FELDER

DOKUMENTINFO:
- document_subtype: "neuantrag" / "aenderungsantrag" / "erneuerungsantrag" / "police" / "kuendigung" / "offerte" / "rechnung" / "korrespondenz"
- document_confidence: 0.0–1.0
- summary: 1–2 Sätze auf Deutsch

VERSICHERUNGSNEHMER (aus Adressblock/Briefkopf):
- policy_holder_first_name, policy_holder_last_name
- policy_holder_birthdate: YYYY-MM-DD (falls im Adressblock angegeben)
- policy_holder_street, policy_holder_zip_code, policy_holder_city
- policy_holder_email, policy_holder_phone

VERSICHERTE PERSON (wer versichert ist):
- insured_first_name, insured_last_name
- insured_birthdate: YYYY-MM-DD — aus Deckungsblock oder Policenzeile
- insured_ahv_number
- insured_is_different: true wenn ≠ Versicherungsnehmer, sonst false

POLICEN (nur mit eigenem CHF-Betrag):
Für jeden Eintrag:
- insurer: Voller Firmenname der Versicherung
- policy_number: Policennummer als String, oder null (NIEMALS "unknown")
- insurance_type: "health" / "life" / "property" / "liability" / "motor" / "other"
- sparte: "kvg" / "vvg_zusatz" / "kvg_vvg_kombi" / "motorfahrzeug" / "haftpflicht_privat" / "hausrat" / "leben_3a" / "unfall_privat"
- product: Exakter Produktname aus dem Dokument
- product_short: Max 2 Wörter (z.B. "Spital", "Zahn", "Hausrat", "Grundversicherung")
- franchise: Zahl CHF, nur bei KVG, sonst null
- model: Modellname oder null
- coverage_type: Altersgruppe (z.B. "Erwachsene") oder null
- premium_monthly: NETTO Monatsprämie CHF nach Rabatten
- premium_yearly: Jahresprämie CHF
- start_date: YYYY-MM-DD
- end_date: YYYY-MM-DD
- health_declaration_required: true/false
- coverage_summary: Wichtigste Deckungsdetails

VERMITTLER:
- broker_name, broker_number (null falls nicht angegeben)

Antworte NUR mit JSON. Fehlende Felder = null. Lieber 0 Policen als halluzinierte Produkte.`,
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
                  product_short: { type: ['string', 'null'] },
                  franchise: { type: ['number', 'null'] },
                  model: { type: ['string', 'null'] },
                  coverage_type: { type: ['string', 'null'] },
                  premium_monthly: { type: ['number', 'null'] },
                  premium_yearly: { type: ['number', 'null'] },
                  start_date: { type: ['string', 'null'] },
                  end_date: { type: ['string', 'null'] },
                  cancellation_deadline: { type: ['string', 'null'] },
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
      });

      if (!extracted || typeof extracted !== 'object') {
        throw new Error('Leere Antwort von KI');
      }

      console.log('[smartDocumentAnalysis] Extraktion OK:', JSON.stringify({
        policyholder: `${extracted.policy_holder_first_name} ${extracted.policy_holder_last_name}`,
        insured: extracted.insured_is_different ? `${extracted.insured_first_name} ${extracted.insured_last_name}` : 'identisch',
        policies_count: (extracted.policies || []).length,
        policy_numbers: (extracted.policies || []).map(p => p.policy_number),
      }));

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

    // Kein Inhalt extrahiert? Klare Fehlermeldung statt leere Felder
    const hasAnyData = extracted.policy_holder_last_name || extracted.insured_last_name ||
      (extracted.policies && extracted.policies.length > 0);
    if (!hasAnyData) {
      console.warn('[smartDocumentAnalysis] Keine Versicherungsdaten gefunden — kein Versicherungsdokument?');
      return Response.json({
        success: false,
        error: 'In diesem Dokument konnten keine Versicherungsdaten gefunden werden. Bitte prüfen Sie ob das korrekte PDF hochgeladen wurde.',
        extracted: null,
        customerMatches: [],
        detectionPhase: 'no_insurance_data',
      });
    }

    const policies = extracted.policies || [];
    const firstPolicy = policies[0] || {};

    // ================================================================
    // SCHRITT 2: KUNDENERKENNUNG
    // Sucht nach BEIDEN: Versicherungsnehmer UND versicherte Person
    // ================================================================
    const hasPoliceNumber = policies.some(p => p.policy_number);
    const [allCustomers, allContracts] = await Promise.all([
      base44.asServiceRole.entities.Customer.list(null, 1000),
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

    // P1: Policennummer → Vertrag → Kunde
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

    // P2: E-Mail
    if (extracted.policy_holder_email) {
      const emailMatches = allCustomers.filter(c =>
        c.email && c.email.toLowerCase() === extracted.policy_holder_email.toLowerCase()
      );
      emailMatches.forEach(c => addMatch(c, 'email', 97, `E-Mail: ${extracted.policy_holder_email}`));
      if (emailMatches.length > 0 && detectionPhase === 'no_match') detectionPhase = 'matched_via_email';
    }

    // P3: Adresse (Strasse + PLZ) — höhere Priorität als Fuzzy-Name
    if (extracted.policy_holder_zip_code && extracted.policy_holder_street) {
      const addressMatches = allCustomers.filter(c => {
        if (!c.zip_code || !c.street) return false;
        const zipMatch = c.zip_code === extracted.policy_holder_zip_code;
        const streetSim = similarity(c.street, extracted.policy_holder_street);
        return zipMatch && streetSim > 0.70;
      });
      addressMatches.forEach(c => addMatch(c, 'address', 85, `Adresse: ${extracted.policy_holder_street}, ${extracted.policy_holder_zip_code}`));
      if (addressMatches.length > 0 && detectionPhase === 'no_match') detectionPhase = 'matched_via_address';
    }

    // P4: Versicherungsnehmer Name + GD (direkte Übereinstimmung)
    const phFirst = extracted.policy_holder_first_name;
    const phLast = extracted.policy_holder_last_name;
    const phBirth = extracted.policy_holder_birthdate;

    if (phFirst && phLast) {
      // Mit Geburtsdatum
      if (phBirth) {
        const nameGdMatches = allCustomers.filter(c => {
          const fnSim = similarity(c.first_name, phFirst);
          const lnSim = similarity(c.last_name, phLast);
          return fnSim > 0.85 && lnSim > 0.85 && c.birthdate === phBirth;
        });
        nameGdMatches.forEach(c => {
          addMatch(c, 'name_birthdate', 95, `VN Name+GD: ${phFirst} ${phLast}`);
        });
        if (nameGdMatches.length > 0 && detectionPhase === 'no_match') detectionPhase = 'matched_via_name_birthdate';
      }
      // Nur Name (Fuzzy)
      if (customerMatches.length === 0) {
        const fuzzyPH = allCustomers
          .map(c => ({
            customer: c,
            score: similarity(c.first_name, phFirst) * 0.5 + similarity(c.last_name, phLast) * 0.5,
          }))
          .filter(x => x.score > 0.85)
          .sort((a, b) => b.score - a.score)
          .slice(0, 2);
        fuzzyPH.forEach(({ customer, score }) => {
          addMatch(customer, 'fuzzy_name', Math.round(score * 80), `VN Name: ${phFirst} ${phLast}`);
        });
        if (fuzzyPH.length > 0 && detectionPhase === 'no_match') detectionPhase = 'fuzzy_policyholder';
      }
    }

    // P5: Versicherte Person (falls abweichend) — sucht als Familienmitglied
    if (extracted.insured_is_different && extracted.insured_first_name && extracted.insured_last_name) {
      const insFirst = extracted.insured_first_name;
      const insLast = extracted.insured_last_name;
      const insBirth = extracted.insured_birthdate;

      // Mit Geburtsdatum
      if (insBirth) {
        const insuredMatches = allCustomers.filter(c => {
          const fnSim = similarity(c.first_name, insFirst);
          const lnSim = similarity(c.last_name, insLast);
          return fnSim > 0.85 && lnSim > 0.85 && c.birthdate === insBirth;
        });
        insuredMatches.forEach(c => {
          addMatch(c, 'insured_name_birthdate', 92, `Versicherte Person Name+GD: ${insFirst} ${insLast}`);
        });
        if (insuredMatches.length > 0 && detectionPhase === 'no_match') detectionPhase = 'matched_insured_birthdate';
      }

      // Fuzzy Name versicherte Person
      if (customerMatches.length === 0) {
        const fuzzyIns = allCustomers
          .map(c => ({
            customer: c,
            score: similarity(c.first_name, insFirst) * 0.5 + similarity(c.last_name, insLast) * 0.5,
          }))
          .filter(x => x.score > 0.85)
          .sort((a, b) => b.score - a.score)
          .slice(0, 2);
        fuzzyIns.forEach(({ customer, score }) => {
          addMatch(customer, 'fuzzy_insured', Math.round(score * 75), `VP Name: ${insFirst} ${insLast}`);
        });
        if (fuzzyIns.length > 0 && detectionPhase === 'no_match') detectionPhase = 'fuzzy_insured';
      }
    }

    console.log('[smartDocumentAnalysis] Matches:', customerMatches.length, 'phase:', detectionPhase);

    // ================================================================
    // SCHRITT 3: FAMILIENSTRUKTUR
    // ================================================================
    const primaryCustomers = allCustomers.filter(c => !c.is_family_member);
    const primarySlice = primaryCustomers.slice(0, 300);

    const bestMatchPrimaryId = customerMatches.length > 0
      ? (customerMatches[0].customer.is_family_member
          ? customerMatches[0].customer.primary_customer_id
          : customerMatches[0].customer.id)
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
      birthdate: c.birthdate,
      city: c.city,
      zip_code: c.zip_code,
      email: c.email || null,
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
    // SCHRITT 4: NORMALISIEREN & ANTWORT
    // ================================================================
    const subtypeMap = {
      neuantrag: 'neuantrag', 'neuer antrag': 'neuantrag', antrag: 'neuantrag',
      aenderungsantrag: 'aenderungsantrag', mutation: 'aenderungsantrag',
      erneuerungsantrag: 'erneuerungsantrag', erneuerung: 'erneuerungsantrag',
      police: 'police', kuendigung: 'kuendigung', offerte: 'offerte',
      rechnung: 'rechnung', korrespondenz: 'korrespondenz',
    };
    const rawSubtype = (extracted.document_subtype || document_type || '').toLowerCase();
    const normalizedSubtype = subtypeMap[rawSubtype] || 'neuantrag';

    const normalizedPolicies = policies.map(pol => ({
      insurer: pol.insurer || null,
      policy_number: pol.policy_number || null,
      insurance_type: pol.insurance_type || 'other',
      sparte: pol.sparte ? pol.sparte.toLowerCase() : null,
      product: pol.product || null,
      product_short: pol.product_short || null,
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
        document_subtype: normalizedSubtype,
        document_confidence: extracted.document_confidence || 0.8,
        summary: extracted.summary || null,
        // Versicherungsnehmer
        policy_holder_first_name: extracted.policy_holder_first_name || null,
        policy_holder_last_name: extracted.policy_holder_last_name || null,
        policy_holder_birthdate: extracted.policy_holder_birthdate || null,
        policy_holder_email: extracted.policy_holder_email || null,
        policy_holder_phone: extracted.policy_holder_phone || null,
        policy_holder_street: extracted.policy_holder_street || null,
        policy_holder_zip_code: extracted.policy_holder_zip_code || null,
        policy_holder_city: extracted.policy_holder_city || null,
        // Versicherte Person
        insured_first_name: extracted.insured_first_name || null,
        insured_last_name: extracted.insured_last_name || null,
        insured_birthdate: extracted.insured_birthdate || null,
        insured_ahv_number: extracted.insured_ahv_number || null,
        insured_is_different: extracted.insured_is_different || false,
        // Policen
        policies: normalizedPolicies,
        // Erste Police als Hauptfelder (Rückwärtskompatibilität)
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