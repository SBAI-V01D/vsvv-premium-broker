import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * matchCustomerAndFamily
 * 
 * Automatische Kunden- und Familienerkennung:
 * 1. Sucht existierende Kunden nach Vorname, Nachname, Geburtsdatum, Adresse
 * 2. Erkennt automatisch Familienmitglieder (gleiche Adresse, gleicher Name)
 * 3. Schlägt Hauptkontakt vor oder markiert als neuer Kunde
 * 4. Vorbereitung von Vertragsdaten
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { extractedData, organization_id } = await req.json();
    if (!extractedData) return Response.json({ error: 'Missing extractedData' }, { status: 400 });

    console.log(`[matchCustomerAndFamily] START: ${extractedData.first_name} ${extractedData.last_name}`);

    // Fetch all customers for matching
    const customers = await base44.asServiceRole.entities.Customer.list(null, 1000);
    
    const firstName = (extractedData.first_name || '').trim().toLowerCase();
    const lastName = (extractedData.last_name || '').trim().toLowerCase();
    const birthdate = extractedData.birthdate || null;
    const street = (extractedData.street || '').trim().toLowerCase();
    const zipCode = extractedData.zip_code || null;
    const city = (extractedData.city || '').trim().toLowerCase();
    const email = (extractedData.email || '').trim().toLowerCase();
    const phone = (extractedData.phone || '').trim();
    const mobile = (extractedData.mobile || '').trim();

    // ── MATCHING LOGIC ───────────────────────────────────────────────────────
    let matches = [];

    for (const customer of customers) {
      let score = 0;
      const reasons = [];

      const custFirstName = (customer.first_name || '').trim().toLowerCase();
      const custLastName = (customer.last_name || '').trim().toLowerCase();
      const custBirthdate = customer.birthdate || null;
      const custStreet = (customer.street || '').trim().toLowerCase();
      const custZipCode = customer.zip_code || null;
      const custCity = (customer.city || '').trim().toLowerCase();
      const custEmail = (customer.email || '').trim().toLowerCase();
      const custPhone = (customer.phone || '').trim();
      const custMobile = (customer.mobile || '').trim();

      // Name match (exact)
      if (custFirstName === firstName && custLastName === lastName) {
        score += 40;
        reasons.push('name_exact');
      }
      // Name match (partial)
      else if (custLastName === lastName) {
        score += 20;
        reasons.push('lastname_exact');
      }

      // Birthdate match
      if (custBirthdate && birthdate && custBirthdate === birthdate) {
        score += 25;
        reasons.push('birthdate_exact');
      }

      // Address match (street + zip)
      if (custStreet === street && custZipCode === zipCode) {
        score += 20;
        reasons.push('address_exact');
      } else if (custCity === city && custZipCode === zipCode) {
        score += 10;
        reasons.push('city_zip_match');
      }

      // Email match
      if (custEmail && email && custEmail === email) {
        score += 30;
        reasons.push('email_exact');
      }

      // Phone match
      if ((custPhone && phone && custPhone === phone) || (custMobile && mobile && custMobile === mobile)) {
        score += 15;
        reasons.push('phone_exact');
      }

      if (score > 0) {
        matches.push({
          customer_id: customer.id,
          customer: customer,
          score,
          reasons,
          is_potential_family: score >= 20 && score < 50 && custCity === city && custZipCode === zipCode
        });
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    // ── DECISION LOGIC ─────────────────────────────────────────────────────
    let decision = {
      action: 'new_customer',  // new_customer | link_existing | link_family
      customer_id: null,
      primary_customer_id: null,
      is_family_member: false,
      family_role: null,
      confidence: 0,
      matched_customer: null,
      reasons: [],
      message: ''
    };

    if (matches.length === 0) {
      // No matches → create new customer
      decision.action = 'new_customer';
      decision.message = 'Kein bestehender Kunde gefunden. Neuer Kunde wird erstellt.';
      decision.confidence = 0;
    } else if (matches[0].score >= 60) {
      // High confidence → link to existing customer
      decision.action = 'link_existing';
      decision.customer_id = matches[0].customer.id;
      decision.matched_customer = matches[0].customer;
      decision.confidence = matches[0].score;
      decision.reasons = matches[0].reasons;
      decision.message = `Kunde mit hoher Konfidenz (${matches[0].score}%) gefunden: ${matches[0].customer.first_name} ${matches[0].customer.last_name}`;

      console.log(`[matchCustomerAndFamily] HIGH CONFIDENCE MATCH: ${matches[0].customer.id}`);
    } else if (matches[0].score >= 40 && matches[0].is_potential_family) {
      // Medium confidence + same address → potential family member
      decision.action = 'link_family';
      decision.primary_customer_id = matches[0].customer.id;
      decision.matched_customer = matches[0].customer;
      decision.confidence = matches[0].score;
      decision.reasons = matches[0].reasons;
      decision.is_family_member = true;

      // Detect family role
      if (extractedData.role === 'Ehepartner') {
        decision.family_role = 'spouse';
      } else if (extractedData.role === 'Kind') {
        decision.family_role = 'child';
      } else if (extractedData.role === 'Parent') {
        decision.family_role = 'parent';
      } else {
        decision.family_role = 'other';
      }

      decision.message = `Familienmitglied erkannt (${decision.family_role}): ${matches[0].customer.first_name} ${matches[0].customer.last_name}`;

      console.log(`[matchCustomerAndFamily] FAMILY MEMBER DETECTED: ${decision.family_role} of ${matches[0].customer.id}`);
    } else if (matches.length > 1) {
      // Medium confidence + multiple candidates → ask for confirmation
      decision.action = 'ask_confirmation';
      decision.confidence = matches[0].score;
      decision.matched_customer = matches[0].customer;
      decision.reasons = matches[0].reasons;
      decision.message = `${matches.length} Kandidaten gefunden. Bitte manuell bestätigen.`;
    } else {
      // Low confidence → new customer
      decision.action = 'new_customer';
      decision.message = 'Konfidenz zu niedrig. Neuer Kunde wird erstellt.';
      decision.confidence = matches[0]?.score || 0;
    }

    return Response.json({
      success: true,
      decision,
      all_matches: matches.slice(0, 3).map(m => ({
        customer_id: m.customer.id,
        name: `${m.customer.first_name} ${m.customer.last_name}`,
        email: m.customer.email,
        birthdate: m.customer.birthdate,
        score: m.score,
        reasons: m.reasons
      }))
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[matchCustomerAndFamily] ERROR: ${errorMsg}`);

    return Response.json({
      success: true,
      decision: {
        action: 'new_customer',
        customer_id: null,
        primary_customer_id: null,
        is_family_member: false,
        family_role: null,
        confidence: 0,
        matched_customer: null,
        reasons: [],
        message: 'Matching-Fehler. Neuer Kunde wird erstellt.'
      },
      all_matches: []
    });
  }
});