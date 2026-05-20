import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * SMART DOCUMENT ANALYSIS — Enterprise Edition
 *
 * Ablauf:
 * 1. KI extrahiert alle relevanten Felder aus dem Dokument
 * 2. Kundenerkennung nach Priorität (kein hartes Auto-Matching über Namen allein)
 * 3. Gibt strukturierte Analyse-Ergebnisse zurück für manuelle Bestätigung im UI
 *
 * WICHTIG: Diese Funktion erstellt KEINE Kunden, Anträge oder Verträge.
 * Sie gibt nur Vorschläge zurück. Die Erstellung erfolgt nach manueller Bestätigung.
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const { file_url, document_type } = await req.json();

    if (!file_url) {
      return Response.json({ error: 'file_url erforderlich' }, { status: 400 });
    }

    // ================================================================
    // SCHRITT 1: KI-EXTRAKTION
    // ================================================================
    let extracted = null;
    try {
      extracted = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Analysiere dieses Versicherungsdokument präzise. Dokumenttyp-Hinweis: "${document_type || 'unbekannt'}".

Extrahiere ALLE folgenden Felder soweit im Dokument vorhanden:

DOKUMENTINFO:
- document_subtype: Erkannter Untertyp: "neuantrag" (neuer Antrag), "aenderungsantrag" (Änderung/Mutation), "erneuerungsantrag" (Verlängerung/Erneuerung), "police" (fertige Police), "kuendigung", "offerte", "rechnung", "korrespondenz"
- document_confidence: Konfidenz der Dokumenterkennung (0.0–1.0)

VERSICHERUNGSNEHMER (Vertragsinhaber):
- policy_holder_first_name: Vorname des Versicherungsnehmers
- policy_holder_last_name: Nachname des Versicherungsnehmers
- policy_holder_birthdate: Geburtsdatum VN im Format YYYY-MM-DD
- policy_holder_email: E-Mail VN
- policy_holder_phone: Telefon VN
- policy_holder_street: Strasse + Nr VN
- policy_holder_zip_code: PLZ VN
- policy_holder_city: Ort VN

VERSICHERTE PERSON (falls abweichend vom VN):
- insured_first_name: Vorname versicherte Person
- insured_last_name: Nachname versicherte Person
- insured_birthdate: Geburtsdatum versicherte Person YYYY-MM-DD
- insured_ahv_number: AHV-Nummer versicherte Person
- insured_is_different: true wenn versicherte Person ≠ Versicherungsnehmer, sonst false

VERSICHERUNGSDATEN:
- insurer: Versicherungsgesellschaft (z.B. "CSS", "Helsana", "AXA", "Zurich", "Swica", "Sanitas")
- policy_number: Policennummer oder Antragsnummer
- insurance_type: EXAKTER Wert aus: "health", "life", "property", "liability", "motor", "other"
  Regeln: KVG/Krankenpflege/Zusatz/Spital/VVG-Gesundheit = "health"; Auto/Kasko/MF = "motor"; Hausrat/Gebäude = "property"; Haftpflicht = "liability"; Leben/Rente = "life"; sonst "other"
- sparte: Exakte Sparte (z.B. "kvg", "vvg", "uvg", "bvg", "mf", "haftpflicht", "leben", "kvg_vvg")
- product: Produktname/Tarif (z.B. "Hausarztmodell", "COMPLETA PLUS", "TOP")
- franchise: Franchise-Betrag in CHF falls vorhanden (z.B. 300, 500, 1000)
- model: Versicherungsmodell (z.B. "Hausarztmodell", "Telmed", "Standard")
- coverage_type: Deckungstyp/Kategorie (z.B. "Erwachsene ab 26 Jahre", "Kind 0-18 Jahre", "Jugendliche 19-25 Jahre")

PRÄMIEN:
- premium_monthly: Monatsprämie als Zahl in CHF
- premium_yearly: Jahresprämie als Zahl in CHF (falls nur Monatsprämie: mal 12)
- payment_interval: Zahlungsintervall ("monatlich", "vierteljährlich", "halbjährlich", "jährlich")

VERTRAGSDATEN:
- start_date: Vertragsbeginn YYYY-MM-DD
- end_date: Vertragsende YYYY-MM-DD (falls vorhanden)
- contract_duration: Vertragsdauer in Jahren (falls angegeben)
- health_declaration_required: true/false ob Gesundheitsfragen zu beantworten sind

VERMITTLER:
- broker_name: Name des Vermittlers/Brokers
- broker_number: Vermittlernummer

PROVISION:
- commission_estimate: Geschätzte Jahresprovision in CHF (falls angegeben oder berechenbar)

Antworte NUR mit JSON, keine Erklärungen. Felder die nicht gefunden werden: null.`,
        file_urls: [file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            document_subtype: { type: ['string', 'null'] },
            document_confidence: { type: ['number', 'null'] },
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
            payment_interval: { type: ['string', 'null'] },
            start_date: { type: ['string', 'null'] },
            end_date: { type: ['string', 'null'] },
            contract_duration: { type: ['number', 'null'] },
            health_declaration_required: { type: ['boolean', 'null'] },
            broker_name: { type: ['string', 'null'] },
            broker_number: { type: ['string', 'null'] },
            commission_estimate: { type: ['number', 'null'] },
          }
        },
        model: 'gemini_3_flash',
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

    // ================================================================
    // SCHRITT 2: KUNDENERKENNUNG — STRENGE PRIORITÄTSREIHENFOLGE
    // Kein hartes Auto-Matching nur über Namen!
    // ================================================================

    const allCustomers = await base44.asServiceRole.entities.Customer.list(null, 500);
    const allContracts = await base44.asServiceRole.entities.Contract.list(null, 1000);

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
      // Vermeide Duplikate
      if (!customerMatches.find(m => m.customer.id === customer.id)) {
        customerMatches.push({ customer, matchType, confidence, notes });
      }
    };

    // PRIORITÄT 1: Kundennummer (wenn im Dokument erwähnt)
    // (Kundennummer wird aus policy_number oder broker_number inferiert – direkt nicht extrahiert)

    // PRIORITÄT 2: Policennummer → Vertrag → Kunde
    if (extracted.policy_number) {
      const contractMatch = allContracts.find(c =>
        c.policy_number && c.policy_number.replace(/[^0-9]/g,'') === extracted.policy_number.replace(/[^0-9]/g,'')
      );
      if (contractMatch) {
        const customer = allCustomers.find(c => c.id === contractMatch.customer_id);
        if (customer) {
          addMatch(customer, 'policy_number', 99, `Policennummer ${extracted.policy_number} → Vertrag gefunden`);
          detectionPhase = 'matched_via_policy_number';
        }
      }
    }

    // PRIORITÄT 3: E-Mail
    if (extracted.policy_holder_email) {
      const emailMatches = allCustomers.filter(c =>
        c.email && c.email.toLowerCase() === extracted.policy_holder_email.toLowerCase()
      );
      emailMatches.forEach(c => addMatch(c, 'email', 97, `E-Mail: ${extracted.policy_holder_email}`));
      if (emailMatches.length > 0 && detectionPhase === 'no_match') detectionPhase = 'matched_via_email';
    }

    // PRIORITÄT 4: Telefonnummer
    if (extracted.policy_holder_phone) {
      const phone = extracted.policy_holder_phone.replace(/[^0-9]/g, '');
      const phoneMatches = allCustomers.filter(c => {
        const cp = (c.phone || c.mobile || '').replace(/[^0-9]/g, '');
        return cp && cp.length >= 9 && cp === phone;
      });
      phoneMatches.forEach(c => addMatch(c, 'phone', 90, `Telefon: ${extracted.policy_holder_phone}`));
      if (phoneMatches.length > 0 && detectionPhase === 'no_match') detectionPhase = 'matched_via_phone';
    }

    // PRIORITÄT 5: Vorname + Nachname + Geburtsdatum
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
        addMatch(c, 'name_birthdate', Math.min(conf, 95), `Name + GD: ${searchFirstName} ${searchLastName} ${searchBirthdate}`);
      });
      if (nameGdMatches.length > 0 && detectionPhase === 'no_match') detectionPhase = 'matched_via_name_birthdate';
    }

    // PRIORITÄT 6: Adresse (Strasse + PLZ)
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

    // PRIORITÄT 7: Fuzzy Name (nur als HINWEIS, kein sicheres Match — Confidence max 70)
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
    const primaryCustomers = allCustomers.filter(c => !c.is_family_member);
    const availablePrimaryCustomers = primaryCustomers.map(c => ({
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      customer_number: c.customer_number,
      city: c.city,
      zip_code: c.zip_code,
      organization_id: c.organization_id,
      advisor_id: c.advisor_id,
    }));

    // Wenn ein Match gefunden: Familie laden
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
      neuantrag: 'neuantrag',
      'neuer antrag': 'neuantrag',
      antrag: 'neuantrag',
      aenderungsantrag: 'aenderungsantrag',
      änderungsantrag: 'aenderungsantrag',
      'änderung': 'aenderungsantrag',
      mutation: 'aenderungsantrag',
      erneuerungsantrag: 'erneuerungsantrag',
      erneuerung: 'erneuerungsantrag',
      'verlängerung': 'erneuerungsantrag',
      verlaengerung: 'erneuerungsantrag',
      police: 'police',
      kuendigung: 'kuendigung',
      offerte: 'offerte',
      rechnung: 'rechnung',
      korrespondenz: 'korrespondenz',
    };
    const rawSubtype = (extracted.document_subtype || document_type || '').toLowerCase();
    const normalizedSubtype = subtypeMap[rawSubtype] || 'neuantrag';

    // Berechne Jahresprämie
    const premiumYearly = extracted.premium_yearly
      || (extracted.premium_monthly ? Math.round(extracted.premium_monthly * 12 * 100) / 100 : null);

    return Response.json({
      success: true,
      extracted: {
        // Dokumentinfo
        document_subtype: normalizedSubtype,
        document_confidence: extracted.document_confidence || 0.8,
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
        // Versicherungsdaten
        insurer: extracted.insurer,
        policy_number: extracted.policy_number,
        insurance_type: extracted.insurance_type || 'other',
        sparte: extracted.sparte ? extracted.sparte.toLowerCase() : null,
        product: extracted.product,
        franchise: extracted.franchise,
        model: extracted.model,
        coverage_type: extracted.coverage_type,
        premium_monthly: extracted.premium_monthly,
        premium_yearly: premiumYearly,
        payment_interval: extracted.payment_interval,
        start_date: extracted.start_date,
        end_date: extracted.end_date,
        health_declaration_required: extracted.health_declaration_required || false,
        broker_name: extracted.broker_name,
        commission_estimate: extracted.commission_estimate,
      },
      // Matching-Ergebnisse
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