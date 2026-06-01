import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
// v6 — Claude (kein Gemini), single types, forced redeploy 2026-06-01

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const { file_url, document_type } = await req.json();
    if (!file_url) {
      return Response.json({ error: 'file_url erforderlich' }, { status: 400 });
    }

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[smartDocumentAnalysis] START user=' + user.email + ' file=' + file_url.slice(-30));

    // ================================================================
    // DIREKTE PDF-EXTRAKTION mit Claude (liest PDF nativ)
    // ================================================================
    let extracted = null;
    try {
      extracted = await base44.integrations.Core.InvokeLLM({
        model: 'claude_sonnet_4_6',
        file_urls: [file_url],
        prompt: `Du bist eine praezise Schweizer Versicherungs-Extraktionsengine.
Dokumenttyp-Hinweis: "${document_type || 'unbekannt'}"
Du erkennst ALLE Dokumenttypen: Police, Versicherungsausweis, Antrag, Zusammenfassung, Offerte, Vorgeburtliche Anmeldung.

=== SCHRITT 1: VERSICHERTE PERSON (VP) vs. VERSICHERUNGSNEHMER (VN) ===

VN = PRAEMIENZAHLER: Person im Adressblock (oben rechts oder links adressiert), zahlt die Praemie.
VP = VERSICHERTE PERSON: Person die tatsaechlich versichert ist.

MUSTER JE VERSICHERER:
- HELSANA POLICE: Adressblock = VN. "Nadine Leuenberger, 18.05.2001, Versicherten-Nr. XXX" = VP (kann andere Person sein!)
- CSS POLICE: Adressblock = VN (z.B. "Frau Daniela Leuenberger"). Box "VERSICHERUNGSPOLICE fuer Thomas Leuenberger, GD 05.02.1966" = VP
- GROUPE MUTUEL POLICE: Box oben rechts "Versicherte Person Mark Schoenholzer / Versicherungsnehmer Helga Schoenholzer" = direkte Angabe
- HELSANA ANTRAG (Online): "Familien-Ansprechperson" oder "Versicherungsvertrag > Vorname Nachname" = VN. Header-Name (z.B. "Yvonne Engeli", "Baby Bernard") = VP.
- GM ANTRAG/ANFRAGE: "Versicherungsnehmer/in" in Box oben rechts = VN. "Zu versichernde Person" = VP.
- VORGEBURT: Baby [Nachname] = VP, Mutter/Vater in Formular Seite 2+ = VN

Wenn VN = VP (selbe Person): insured_is_different = false
Wenn VN ≠ VP (verschiedene Personen): insured_is_different = true, beide Personen extrahieren

=== SCHRITT 2: KVG vs VVG STRIKT TRENNEN ===

KVG-ERKENNUNGSZEICHEN:
- Titel "Grundversicherung", "Versicherungsausweis KVG", "Police Grundversicherung"
- Sektion "Versicherungen gemaeß KVG"
- Produkte: Standard, BeneFit PLUS Telemedizin, BeneFit PLUS Hausarzt, HMO, HAM, Callmed, SanaTel (RT), PrimaFlex (RX), SanaFlex (RF), SanaMed (RM), SanaHAM (RH), SanaCare (RC)
- Hat immer Franchise (CHF 300/500/1000/1500/2000/2500 fuer Erwachsene)
- Hat Unfall-Flag ("Krankheit und Unfall" ODER "Nur Krankheit / Unfall sistiert")

VVG-ERKENNUNGSZEICHEN:
- Titel "Zusatzversicherung", "Versicherungspolice VVG"
- Sektion "Versicherungen gemaeß VVG"
- Helsana VVG: COMPLETA, TOP, SANA, HOSPITAL ECO/Halbprivat/Privat, DENTAplus, Helsana Advocare PLUS, OMNI, VITA, PREVEA
- CSS VVG: myFlex Spital (Balance/Comfort/Premium), myFlex Ambulant, myFlex Dental
- GM VVG: HB (H-Bonus), KH (H-Capital), MU (Mundo), SB (Bonus Heilungskosten), AB (Acrobat), DP (Dentaire Plus/Zahnpflege Plus), GL (Global), LS (Legis sana+), SP (Supra), HO (Hospi), CO (Complementa), DE (Denta), BH (Taggeld), GO (GlobalSmart)

=== SCHRITT 3: RABATTE vs. PRODUKTE ===

RABATTE erkennen (NIEMALS als eigenes Produkt zaehlen):
- Zeilen mit "zu Ihren Gunsten" oder negativen CHF-Betraegen
- Familienrabatt, Kollektivrabatt, Rahmenvertragsrabatt, Jugendrabatt, Kinder/Jugendrabatt
- Kombinationsrabatt, Nichtnutzungsrabatt, Leistungsfreiheitsrabatt
- Umweltabgabe / Verteilung Umweltabgabe (immer Abzug, kein Produkt)
- Mehrjahresvertragsrabatt, Minderjährigenrabatt
- Gesundheitskonto, Gesundheitskonto-Bonus ("inklusive" = Beilage, kein Preis)
- 24h Notfall & medizinische Beratung ("kostenfrei eingeschlossen")

PRODUKTE erkennen: Nur Zeilen MIT explizitem CHF-Preis AND eigenem Produktnamen (fett gedruckt oder mit Code).
MONATSTOTALE ("Total Nettoprämie", "Monatsprämie zu Ihren Lasten") = Summe, kein Produkt!

=== SCHRITT 4: SPEZIALFAELLE ===

VORGEBURT:
- VP = Baby [Nachname], Geburtsdatum liegt in Zukunft oder unbekannt
- KVG und VVG koennen beide vorhanden sein (Philos PrimaFlex + Acrobat/DP/Global)
- Unfall bei KVG: "Mit Unfallrisiko" oder "Krankheit und Unfall" = eingeschlossen

MEHRERE BEGINNDATEN (z.B. KVG 01.01.2027, VVG 01.01.2028):
- start_date pro Police separat angeben, nicht vereinheitlichen

BONUS-STUFEN GM: "Praemienstufe 0" = Bonus-Level, als bonus_stufe=0 angeben

GESUNDHEITSDEKLARATION-SEITEN: Enthalten keine Produkte. Nutze sie nur fuer health_declaration_required=true.

=== SCHRITT 5: KONFIDENZ ===
1.0 = direkt lesbar | 0.8 = klar ableitbar | 0.6 = wahrscheinlich | <0.6 = unsicher

=== SCHRITT 6: MULTI-DOKUMENT-REGEL (KRITISCH) ===
Viele PDFs enthalten MEHRERE Dokumente verschiedener Versicherer (Antrag + bestehende Police als Anlage).

REGEL: Extrahiere IMMER NUR das HAUPT-ANTRAGSDOKUMENT (die ersten relevanten Seiten).
IGNORIERE alle bestehenden Polices anderer Versicherer die spaeter im Dokument erscheinen.

Erkennung des Haupt-Antrags:
- Titel: "Zusammenfassung Ihrer Anfrage", "Versicherungsantrag", "Antrag", "Offerte"
- Erste Seiten mit dem neuen Versicherer-Logo/Briefkopf

Erkennung von Referenz-Dokumenten (NICHT extrahieren):
- Spaetere Seiten mit ANDEREM Versicherernamen und neuem Briefkopf
- Titel: "Police Krankenversicherung", "Uebersicht ueber Ihre Policen", "Beratungsprotokoll", "Information gemaess Art. 45 VAG"
- Beratungsprotokolle, Datenschutzhinweise, Ausweiskopien = immer ignorieren
- Ausstellungsgrund "Praxiswechsel" = bestehende Police eines anderen Versicherers, nicht der Antrag

Beispiel: GM Antrag KH + Sympany Police als Anlage = extrahiere NUR KH H-Capital, ignoriere Sympany.

Bekannte Schweizer Versicherer (alle gleichwertig behandeln):
Helsana, CSS, Groupe Mutuel, Sympany, Vivao Sympany, Swica, Sanitas, Visana, KPT, Assura, Concordia, Philos

Antworte NUR mit dem JSON-Objekt. Fehlende Felder = null.`,
        response_json_schema: {
          type: 'object',
          properties: {
            document_subtype: { type: 'string' },
            document_confidence: { type: 'number' },
            summary: { type: 'string' },
            total_monthly_premium: { type: 'number', description: 'Gesamtprämie/Monat laut Dokument' },
            discount_amount: { type: 'number', description: 'Rabatt/Monat' },
            policy_holder_first_name: { type: 'string' },
            policy_holder_last_name: { type: 'string' },
            policy_holder_birthdate: { type: 'string' },
            policy_holder_email: { type: 'string' },
            policy_holder_phone: { type: 'string' },
            policy_holder_street: { type: 'string' },
            policy_holder_zip_code: { type: 'string' },
            policy_holder_city: { type: 'string' },
            insured_first_name: { type: 'string' },
            insured_last_name: { type: 'string' },
            insured_birthdate: { type: 'string' },
            insured_ahv_number: { type: 'string' },
            insured_is_different: { type: 'boolean' },
            confidence_persons: {
              type: 'object',
              properties: {
                policy_holder_name: { type: 'number' },
                policy_holder_address: { type: 'number' },
                insured_name: { type: 'number' },
                insured_birthdate: { type: 'number' },
                role_distinction: { type: 'number', description: 'Sicherheit der Rollenunterscheidung VN vs VP' },
              }
            },
            policies: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  insurer: { type: 'string' },
                  policy_number: { type: 'string' },
                  insurance_type: { type: 'string' },
                  sparte: { type: 'string', description: 'kvg oder vvg_zusatz' },
                  section: { type: 'string', description: 'grundversicherung oder zusatzversicherung' },
                  product: { type: 'string' },
                  product_short: { type: 'string' },
                  franchise: { type: 'number' },
                  model: { type: 'string' },
                  coverage_type: { type: 'string' },
                  premium_monthly: { type: 'number' },
                  premium_yearly: { type: 'number' },
                  start_date: { type: 'string' },
                  end_date: { type: 'string' },
                  cancellation_deadline: { type: 'string' },
                  health_declaration_required: { type: 'boolean' },
                  coverage_summary: { type: 'string' },
                  confidence: {
                    type: 'object',
                    properties: {
                      product: { type: 'number' },
                      premium_monthly: { type: 'number' },
                      franchise: { type: 'number' },
                      section: { type: 'number' },
                      policy_number: { type: 'number' },
                      dates: { type: 'number' },
                    }
                  },
                }
              }
            },
            broker_name: { type: 'string' },
            broker_number: { type: 'string' },
            commission_estimate: { type: 'number' },
            extraction_notes: { type: 'string', description: 'Was war klar, was war unsicher' },
          }
        },
      });

      if (!extracted || typeof extracted !== 'object') {
        throw new Error('Leere Antwort von KI: ' + typeof extracted);
      }

      console.log('[smartDocumentAnalysis] Extraktion OK: policyholder=' +
        extracted.policy_holder_first_name + ' ' + extracted.policy_holder_last_name +
        ' insured=' + (extracted.insured_is_different ? extracted.insured_first_name + ' ' + extracted.insured_last_name : 'identisch') +
        ' policies=' + (extracted.policies || []).length);

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

    // Kein Inhalt extrahiert?
    const hasAnyData = extracted.policy_holder_last_name || extracted.insured_last_name ||
      (extracted.policies && extracted.policies.length > 0) ||
      extracted.total_monthly_premium || extracted.broker_name || extracted.policy_holder_first_name;
    if (!hasAnyData) {
      const summary = extracted.summary || null;
      const confidence = extracted.document_confidence || 0;
      console.warn('[smartDocumentAnalysis] Keine Versicherungsdaten — confidence=' + confidence);
      const errorMsg = summary
        ? 'Kein Versicherungsdokument erkannt. KI-Beschreibung: "' + summary + '"'
        : 'In diesem Dokument konnten keine Versicherungsdaten gefunden werden. Bitte pruefen Sie ob das korrekte PDF hochgeladen wurde.';
      return Response.json({
        success: false,
        error: errorMsg,
        extracted: { summary, document_confidence: confidence },
        customerMatches: [],
        detectionPhase: 'no_insurance_data',
      });
    }

    const policies = extracted.policies || [];
    const firstPolicy = policies[0] || {};

    // ================================================================
    // KUNDENERKENNUNG — sucht Versicherungsnehmer UND versicherte Person
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

    // P1: Policennummer -> Vertrag -> Kunde
    for (const pol of policies) {
      if (pol.policy_number) {
        const contractMatch = allContracts.find(c =>
          c.policy_number && c.policy_number.replace(/[^0-9]/g,'') === pol.policy_number.replace(/[^0-9]/g,'')
        );
        if (contractMatch) {
          const customer = allCustomers.find(c => c.id === contractMatch.customer_id);
          if (customer) {
            addMatch(customer, 'policy_number', 99, 'Policennummer ' + pol.policy_number + ' -> Vertrag gefunden');
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
      emailMatches.forEach(c => addMatch(c, 'email', 97, 'E-Mail: ' + extracted.policy_holder_email));
      if (emailMatches.length > 0 && detectionPhase === 'no_match') detectionPhase = 'matched_via_email';
    }

    // P3: Adresse (Strasse + PLZ)
    if (extracted.policy_holder_zip_code && extracted.policy_holder_street) {
      const addressMatches = allCustomers.filter(c => {
        if (!c.zip_code || !c.street) return false;
        return c.zip_code === extracted.policy_holder_zip_code && similarity(c.street, extracted.policy_holder_street) > 0.70;
      });
      addressMatches.forEach(c => addMatch(c, 'address', 85, 'Adresse: ' + extracted.policy_holder_street + ', ' + extracted.policy_holder_zip_code));
      if (addressMatches.length > 0 && detectionPhase === 'no_match') detectionPhase = 'matched_via_address';
    }

    // P4: Versicherungsnehmer Name (Fuzzy)
    const phFirst = extracted.policy_holder_first_name;
    const phLast = extracted.policy_holder_last_name;
    const phBirth = extracted.policy_holder_birthdate;

    if (phFirst && phLast) {
      if (phBirth) {
        const nameGdMatches = allCustomers.filter(c => {
          return similarity(c.first_name, phFirst) > 0.85 && similarity(c.last_name, phLast) > 0.85 && c.birthdate === phBirth;
        });
        nameGdMatches.forEach(c => addMatch(c, 'name_birthdate', 95, 'VN Name+GD: ' + phFirst + ' ' + phLast));
        if (nameGdMatches.length > 0 && detectionPhase === 'no_match') detectionPhase = 'matched_via_name_birthdate';
      }
      if (customerMatches.length === 0) {
        const fuzzyPH = allCustomers
          .map(c => ({ customer: c, score: similarity(c.first_name, phFirst) * 0.5 + similarity(c.last_name, phLast) * 0.5 }))
          .filter(x => x.score > 0.85)
          .sort((a, b) => b.score - a.score)
          .slice(0, 2);
        fuzzyPH.forEach(({ customer, score }) => addMatch(customer, 'fuzzy_name', Math.round(score * 80), 'VN Name: ' + phFirst + ' ' + phLast));
        if (fuzzyPH.length > 0 && detectionPhase === 'no_match') detectionPhase = 'fuzzy_policyholder';
      }
    }

    // P5: Versicherte Person (falls abweichend)
    if (extracted.insured_is_different && extracted.insured_first_name && extracted.insured_last_name) {
      const insFirst = extracted.insured_first_name;
      const insLast = extracted.insured_last_name;
      const insBirth = extracted.insured_birthdate;

      if (insBirth) {
        const insuredMatches = allCustomers.filter(c =>
          similarity(c.first_name, insFirst) > 0.85 && similarity(c.last_name, insLast) > 0.85 && c.birthdate === insBirth
        );
        insuredMatches.forEach(c => addMatch(c, 'insured_name_birthdate', 92, 'VP Name+GD: ' + insFirst + ' ' + insLast));
        if (insuredMatches.length > 0 && detectionPhase === 'no_match') detectionPhase = 'matched_insured_birthdate';
      }

      if (customerMatches.length === 0) {
        const fuzzyIns = allCustomers
          .map(c => ({ customer: c, score: similarity(c.first_name, insFirst) * 0.5 + similarity(c.last_name, insLast) * 0.5 }))
          .filter(x => x.score > 0.85)
          .sort((a, b) => b.score - a.score)
          .slice(0, 2);
        fuzzyIns.forEach(({ customer, score }) => addMatch(customer, 'fuzzy_insured', Math.round(score * 75), 'VP Name: ' + insFirst + ' ' + insLast));
        if (fuzzyIns.length > 0 && detectionPhase === 'no_match') detectionPhase = 'fuzzy_insured';
      }
    }

    console.log('[smartDocumentAnalysis] Matches:', customerMatches.length, 'phase:', detectionPhase);

    // ================================================================
    // FAMILIENSTRUKTUR
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
    // NORMALISIEREN & ANTWORT
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
        policy_holder_first_name: extracted.policy_holder_first_name || null,
        policy_holder_last_name: extracted.policy_holder_last_name || null,
        policy_holder_birthdate: extracted.policy_holder_birthdate || null,
        policy_holder_email: extracted.policy_holder_email || null,
        policy_holder_phone: extracted.policy_holder_phone || null,
        policy_holder_street: extracted.policy_holder_street || null,
        policy_holder_zip_code: extracted.policy_holder_zip_code || null,
        policy_holder_city: extracted.policy_holder_city || null,
        insured_first_name: extracted.insured_first_name || null,
        insured_last_name: extracted.insured_last_name || null,
        insured_birthdate: extracted.insured_birthdate || null,
        insured_ahv_number: extracted.insured_ahv_number || null,
        insured_is_different: extracted.insured_is_different || false,
        policies: normalizedPolicies,
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