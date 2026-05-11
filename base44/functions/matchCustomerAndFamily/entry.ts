import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * matchCustomerAndFamily - CORRECTED LOGIC
 * 
 * Automatische Kunden- und Familienerkennung:
 * 1. Exakte Übereinstimmung (Vorname + Nachname + Geburtsdatum) → gleicher Kunde
 * 2. Nachname + Adresse identisch ABER anderer Vorname/Geburtsdatum → NEUES Familienmitglied
 * 3. Keine automatische Zuordnung zu Hauptkunden wenn andere Person erkannt
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { extractedData, organization_id } = await req.json();
    if (!extractedData) return Response.json({ error: 'Missing extractedData' }, { status: 400 });

    console.log(`[matchCustomerAndFamily] START: ${extractedData.first_name} ${extractedData.last_name}, DOB: ${extractedData.birthdate}`);

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

    // ── EXACT MATCH: Same first name, last name, AND birthdate ──────────────
    let exactMatch = null;
    for (const customer of customers) {
      const custFirstName = (customer.first_name || '').trim().toLowerCase();
      const custLastName = (customer.last_name || '').trim().toLowerCase();
      const custBirthdate = customer.birthdate || null;

      if (custFirstName === firstName && custLastName === lastName && custBirthdate === birthdate) {
        exactMatch = customer;
        break;
      }
    }

    if (exactMatch) {
      console.log(`[matchCustomerAndFamily] EXACT MATCH found: ${exactMatch.id}`);
      return Response.json({
        success: true,
        decision: {
          action: 'link_existing',
          customer_id: exactMatch.id,
          primary_customer_id: null,
          is_family_member: false,
          family_role: null,
          confidence: 100,
          matched_customer: exactMatch,
          matched_customers: [exactMatch],
          reasons: ['first_name_exact', 'last_name_exact', 'birthdate_exact'],
          message: `Kunde exakt gefunden: ${exactMatch.first_name} ${exactMatch.last_name} (${exactMatch.birthdate})`
        },
        all_matches: []
      });
    }

    // ── POTENTIAL FAMILY MEMBER: Same last name + address but different first name OR birthdate ──
    let potentialFamilyMatches = [];
    for (const customer of customers) {
      const custLastName = (customer.last_name || '').trim().toLowerCase();
      const custStreet = (customer.street || '').trim().toLowerCase();
      const custZipCode = customer.zip_code || null;
      const custFirstName = (customer.first_name || '').trim().toLowerCase();
      const custBirthdate = customer.birthdate || null;

      // Same last name AND same address (street + zip)
      const sameAddress = custStreet === street && custZipCode === zipCode;
      const sameLastName = custLastName === lastName;
      
      if (sameAddress && sameLastName) {
        // BUT: different first name OR different birthdate
        const differentFirstName = custFirstName !== firstName;
        const differentBirthdate = custBirthdate !== birthdate && birthdate !== null;
        
        if (differentFirstName || differentBirthdate) {
          potentialFamilyMatches.push({
            customer_id: customer.id,
            customer,
            reason: differentFirstName ? 'different_first_name' : 'different_birthdate',
            confidence: 75
          });
        }
      }
    }

    // If we found potential family members → ask to create new family member
    if (potentialFamilyMatches.length > 0) {
      console.log(`[matchCustomerAndFamily] FAMILY MEMBER PATTERN detected: ${potentialFamilyMatches.length} potential household(s)`);
      
      return Response.json({
        success: true,
        decision: {
          action: 'create_family_member',
          customer_id: null,
          primary_customer_id: potentialFamilyMatches[0].customer.id,
          is_family_member: true,
          family_role: extractedData.role === 'Ehepartner' ? 'spouse' : 
                       extractedData.role === 'Kind' ? 'child' :
                       extractedData.role === 'Parent' ? 'parent' : 'other',
          confidence: 75,
          matched_customer: potentialFamilyMatches[0].customer,
          matched_customers: potentialFamilyMatches.map(m => m.customer),
          reasons: ['same_last_name', 'same_address', 'different_first_name_or_birthdate'],
          message: `Familienmitglied erkannt! Neue Person: ${firstName || '?'} ${lastName || '?'} | Hauptkontakt: ${potentialFamilyMatches[0].customer.first_name} ${potentialFamilyMatches[0].customer.last_name}`
        },
        all_matches: potentialFamilyMatches.map(m => ({
          customer_id: m.customer.id,
          name: `${m.customer.first_name} ${m.customer.last_name}`,
          email: m.customer.email,
          birthdate: m.customer.birthdate,
          address: `${m.customer.street}, ${m.customer.zip_code} ${m.customer.city}`,
          score: m.confidence,
          reason: m.reason
        }))
      });
    }

    // ── PARTIAL MATCHES (email, phone, etc.) ───────────────────────────────
    let partialMatches = [];
    for (const customer of customers) {
      let score = 0;
      const reasons = [];

      const custFirstName = (customer.first_name || '').trim().toLowerCase();
      const custLastName = (customer.last_name || '').trim().toLowerCase();
      const custEmail = (customer.email || '').trim().toLowerCase();
      const custPhone = (customer.phone || '').trim();
      const custMobile = (customer.mobile || '').trim();

      if (custLastName === lastName) {
        score += 15;
        reasons.push('last_name');
      }

      if (custEmail && email && custEmail === email) {
        score += 30;
        reasons.push('email_exact');
      }

      if ((custPhone && phone && custPhone === phone) || (custMobile && mobile && custMobile === mobile)) {
        score += 20;
        reasons.push('phone_exact');
      }

      if (score > 0) {
        partialMatches.push({
          customer_id: customer.id,
          customer,
          score,
          reasons
        });
      }
    }

    partialMatches.sort((a, b) => b.score - a.score);

    if (partialMatches.length > 0 && partialMatches[0].score >= 30) {
      console.log(`[matchCustomerAndFamily] PARTIAL MATCH (email/phone): ${partialMatches[0].customer.id}`);
      
      return Response.json({
        success: true,
        decision: {
          action: 'ask_confirmation',
          customer_id: null,
          primary_customer_id: partialMatches[0].customer.id,
          is_family_member: false,
          family_role: null,
          confidence: partialMatches[0].score,
          matched_customer: partialMatches[0].customer,
          matched_customers: partialMatches.slice(0, 3).map(m => m.customer),
          reasons: partialMatches[0].reasons,
          message: `Mögliche Übereinstimmung via E-Mail/Telefon gefunden. Bitte bestätigen.`
        },
        all_matches: partialMatches.slice(0, 3).map(m => ({
          customer_id: m.customer.id,
          name: `${m.customer.first_name} ${m.customer.last_name}`,
          email: m.customer.email,
          score: m.score,
          reasons: m.reasons
        }))
      });
    }

    // ── NO MATCHES → new customer ──────────────────────────────────────────
    console.log(`[matchCustomerAndFamily] NO MATCHES - new customer`);
    
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
        matched_customers: [],
        reasons: [],
        message: 'Kein bestehender Kunde gefunden. Neuer Kunde wird erstellt.'
      },
      all_matches: []
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
        matched_customers: [],
        reasons: [],
        message: 'Matching-Fehler. Neuer Kunde wird erstellt.'
      },
      all_matches: []
    });
  }
});