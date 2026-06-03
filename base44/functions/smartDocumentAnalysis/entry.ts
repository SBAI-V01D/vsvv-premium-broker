import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    const { file_url, document_type } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url erforderlich' }, { status: 400 });
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // KI-Extraktion OHNE response_json_schema (verhindert null-Typ-Fehler)
    let extracted = null;
    const rawResponse = await base44.integrations.Core.InvokeLLM({
      model: 'claude_sonnet_4_6',
      file_urls: [file_url],
      prompt: `Du bist eine Schweizer Versicherungs-Extraktionsengine. Dokumenttyp-Hinweis: "${document_type || 'unbekannt'}"

PERSONENROLLEN: VN=Versicherungsnehmer/Praemienzahler (Adressblock), VP=Versicherte Person.
GM: Box "Versicherte Person / Versicherungsnehmer" = direkte Angabe.
CSS: "VERSICHERUNGSPOLICE fuer [Name]" = VP, Adressblock = VN.
Helsana: Adressblock = VN, Versicherten-Nr. Zeile = VP.
Wenn VN=VP: insured_is_different=false. Sonst: insured_is_different=true.

KVG-Produkte: Standard, SanaTel(RT), PrimaFlex(RX), SanaFlex(RF), SanaMed(RM), BeneFit PLUS, HMO, HAM.
VVG GM: HB(H-Bonus), KH(H-Capital), MU(Mundo), SB(Bonus), AB, DP, GL, SP, HO, CO, DE, BH.
VVG Helsana: COMPLETA, TOP, SANA, HOSPITAL, DENTAplus, OMNI, VITA, PREVEA.
VVG CSS: myFlex Spital/Ambulant/Dental.

RABATTE: Zeilen mit negativen Betraegen, Familienrabatt, Nichtnutzungsrabatt, Umweltabgabe, Kombinationsrabatt = KEINE Produkte!
MONATSTOTALE = Summe, kein Produkt.

Antworte NUR mit reinem JSON (kein Markdown, keine Erklaerung). Fehlende Felder = null.
{
  "document_subtype": "police",
  "document_confidence": 0.95,
  "summary": "...",
  "total_monthly_premium": 548.25,
  "policy_holder_first_name": "Helga",
  "policy_holder_last_name": "Schoenholzer",
  "policy_holder_birthdate": "1961-03-28",
  "policy_holder_email": null,
  "policy_holder_phone": null,
  "policy_holder_street": "Hohlstrasse 515",
  "policy_holder_zip_code": "8048",
  "policy_holder_city": "Zuerich",
  "insured_first_name": null,
  "insured_last_name": null,
  "insured_birthdate": null,
  "insured_ahv_number": "756.0161.8445.52",
  "insured_is_different": false,
  "policies": [
    {
      "insurer": "Avenir Krankenversicherung AG",
      "policy_number": null,
      "insurance_type": "health",
      "sparte": "kvg",
      "product": "SanaTel - obligatorische Krankenpflegeversicherung",
      "product_short": "RT",
      "franchise": 2500,
      "model": "SanaTel",
      "coverage_type": "Nur Krankheit",
      "premium_monthly": 378.25,
      "premium_yearly": null,
      "start_date": "2026-01-01",
      "end_date": "2026-12-31",
      "health_declaration_required": false,
      "coverage_summary": null
    }
  ],
  "broker_name": null,
  "commission_estimate": null
}
WICHTIG: Obiges ist nur Beispielstruktur. Extrahiere die echten Daten aus dem Dokument.`,
    });

    let rawText = typeof rawResponse === 'string' ? rawResponse : JSON.stringify(rawResponse);
    rawText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Keine JSON-Antwort von KI. Preview: ' + rawText.slice(0, 300));
    extracted = JSON.parse(jsonMatch[0]);
    console.log('[smartDocumentAnalysis] Extrahiert:', extracted.policy_holder_last_name, 'policies=', (extracted.policies||[]).length);

    const hasData = extracted.policy_holder_last_name || extracted.insured_last_name ||
      (extracted.policies && extracted.policies.length > 0) || extracted.total_monthly_premium;

    if (!hasData) {
      return Response.json({
        success: false,
        error: extracted.summary ? 'Kein Versicherungsdokument: "' + extracted.summary + '"' : 'In diesem Dokument konnten keine Versicherungsdaten gefunden werden.',
        extracted: { summary: extracted.summary, document_confidence: extracted.document_confidence },
        customerMatches: [], detectionPhase: 'no_insurance_data',
      });
    }

    const policies = extracted.policies || [];
    const firstPolicy = policies[0] || {};

    // Kundenerkennung
    const [allCustomers, allContracts] = await Promise.all([
      base44.asServiceRole.entities.Customer.list(null, 1000),
      policies.some(p => p.policy_number) ? base44.asServiceRole.entities.Contract.list(null, 1000) : Promise.resolve([]),
    ]);

    const sim = (a, b) => {
      if (!a || !b) return 0;
      const s1 = a.toLowerCase().trim(), s2 = b.toLowerCase().trim();
      if (s1 === s2) return 1;
      const longer = s1.length > s2.length ? s1 : s2, shorter = s1.length > s2.length ? s2 : s1;
      const c = Array.from({ length: shorter.length + 1 }, (_, i) => i);
      for (let i = 1; i <= longer.length; i++) {
        let p = i;
        for (let j = 1; j <= shorter.length; j++) {
          const v = longer[i-1] === shorter[j-1] ? c[j-1] : Math.min(c[j-1], p, c[j]) + 1;
          c[j-1] = p; p = v;
        }
        c[shorter.length] = p;
      }
      return (longer.length - c[shorter.length]) / longer.length;
    };

    const customerMatches = [];
    let detectionPhase = 'no_match';
    const addMatch = (c, type, conf, notes) => { if (!customerMatches.find(m => m.customer.id === c.id)) customerMatches.push({ customer: c, matchType: type, confidence: conf, notes }); };

    for (const pol of policies) {
      if (pol.policy_number) {
        const cm = allContracts.find(c => c.policy_number && c.policy_number.replace(/\D/g,'') === pol.policy_number.replace(/\D/g,''));
        if (cm) { const cu = allCustomers.find(c => c.id === cm.customer_id); if (cu) { addMatch(cu, 'policy_number', 99, 'Policennummer'); detectionPhase = 'matched_via_policy_number'; } }
      }
    }
    if (extracted.policy_holder_email) {
      allCustomers.filter(c => c.email && c.email.toLowerCase() === extracted.policy_holder_email.toLowerCase())
        .forEach(c => { addMatch(c, 'email', 97, 'E-Mail'); if (detectionPhase === 'no_match') detectionPhase = 'matched_via_email'; });
    }
    if (extracted.policy_holder_zip_code && extracted.policy_holder_street) {
      allCustomers.filter(c => c.zip_code === extracted.policy_holder_zip_code && c.street && sim(c.street, extracted.policy_holder_street) > 0.70)
        .forEach(c => { addMatch(c, 'address', 85, 'Adresse'); if (detectionPhase === 'no_match') detectionPhase = 'matched_via_address'; });
    }
    const phF = extracted.policy_holder_first_name, phL = extracted.policy_holder_last_name, phB = extracted.policy_holder_birthdate;
    if (phF && phL) {
      if (phB) allCustomers.filter(c => sim(c.first_name, phF) > 0.85 && sim(c.last_name, phL) > 0.85 && c.birthdate === phB)
        .forEach(c => { addMatch(c, 'name_birthdate', 95, 'Name+GD'); if (detectionPhase === 'no_match') detectionPhase = 'matched_via_name_birthdate'; });
      if (customerMatches.length === 0) {
        allCustomers.map(c => ({ c, s: sim(c.first_name, phF) * 0.5 + sim(c.last_name, phL) * 0.5 }))
          .filter(x => x.s > 0.85).sort((a, b) => b.s - a.s).slice(0, 2)
          .forEach(({ c, s }) => { addMatch(c, 'fuzzy_name', Math.round(s * 80), 'Name'); if (detectionPhase === 'no_match') detectionPhase = 'fuzzy_policyholder'; });
      }
    }
    if (extracted.insured_is_different && extracted.insured_first_name && extracted.insured_last_name) {
      const iF = extracted.insured_first_name, iL = extracted.insured_last_name, iB = extracted.insured_birthdate;
      if (iB) allCustomers.filter(c => sim(c.first_name, iF) > 0.85 && sim(c.last_name, iL) > 0.85 && c.birthdate === iB)
        .forEach(c => { addMatch(c, 'insured_name_birthdate', 92, 'VP'); if (detectionPhase === 'no_match') detectionPhase = 'matched_insured_birthdate'; });
      if (customerMatches.length === 0) {
        allCustomers.map(c => ({ c, s: sim(c.first_name, iF) * 0.5 + sim(c.last_name, iL) * 0.5 }))
          .filter(x => x.s > 0.85).sort((a, b) => b.s - a.s).slice(0, 2)
          .forEach(({ c, s }) => { addMatch(c, 'fuzzy_insured', Math.round(s * 75), 'VP fuzzy'); if (detectionPhase === 'no_match') detectionPhase = 'fuzzy_insured'; });
      }
    }

    const primaryCustomers = allCustomers.filter(c => !c.is_family_member).slice(0, 300);
    const bestPId = customerMatches.length > 0 ? (customerMatches[0].customer.is_family_member ? customerMatches[0].customer.primary_customer_id : customerMatches[0].customer.id) : null;
    if (bestPId && !primaryCustomers.find(c => c.id === bestPId)) { const m = allCustomers.find(c => c.id === bestPId); if (m) primaryCustomers.push(m); }
    const availablePrimaryCustomers = primaryCustomers.map(c => ({ id: c.id, first_name: c.first_name, last_name: c.last_name, customer_number: c.customer_number, birthdate: c.birthdate, city: c.city, zip_code: c.zip_code, email: c.email || null }));
    let matchedPrimaryCustomer = null, availableFamilyMembers = [];
    if (customerMatches.length > 0) {
      const best = customerMatches[0].customer, pId = best.is_family_member ? best.primary_customer_id : best.id;
      if (pId) {
        matchedPrimaryCustomer = allCustomers.find(c => c.id === pId) || null;
        availableFamilyMembers = allCustomers.filter(c => c.id === pId || c.primary_customer_id === pId)
          .map(c => ({ id: c.id, first_name: c.first_name, last_name: c.last_name, family_role: c.family_role, birthdate: c.birthdate, is_family_member: c.is_family_member, organization_id: c.organization_id, advisor_id: c.advisor_id }));
      }
    }

    const subtypeMap = { neuantrag:'neuantrag', antrag:'neuantrag', aenderungsantrag:'aenderungsantrag', mutation:'aenderungsantrag', police:'police', offerte:'offerte', korrespondenz:'korrespondenz' };
    const normalizedSubtype = subtypeMap[(extracted.document_subtype || document_type || '').toLowerCase()] || 'neuantrag';
    const normalizedPolicies = policies.map(pol => ({
      insurer: pol.insurer || null, policy_number: pol.policy_number || null, insurance_type: pol.insurance_type || 'other',
      sparte: pol.sparte ? pol.sparte.toLowerCase() : null, product: pol.product || null, product_short: pol.product_short || null,
      franchise: pol.franchise || null, model: pol.model || null, coverage_type: pol.coverage_type || null,
      premium_monthly: pol.premium_monthly || null, premium_yearly: pol.premium_yearly || (pol.premium_monthly ? Math.round(pol.premium_monthly * 12 * 100) / 100 : null),
      start_date: pol.start_date || null, end_date: pol.end_date || null, health_declaration_required: pol.health_declaration_required || false, coverage_summary: pol.coverage_summary || null,
    }));

    return Response.json({
      success: true,
      extracted: {
        document_subtype: normalizedSubtype, document_confidence: extracted.document_confidence || 0.8, summary: extracted.summary || null,
        policy_holder_first_name: extracted.policy_holder_first_name || null, policy_holder_last_name: extracted.policy_holder_last_name || null,
        policy_holder_birthdate: extracted.policy_holder_birthdate || null, policy_holder_email: extracted.policy_holder_email || null,
        policy_holder_phone: extracted.policy_holder_phone || null, policy_holder_street: extracted.policy_holder_street || null,
        policy_holder_zip_code: extracted.policy_holder_zip_code || null, policy_holder_city: extracted.policy_holder_city || null,
        insured_first_name: extracted.insured_first_name || null, insured_last_name: extracted.insured_last_name || null,
        insured_birthdate: extracted.insured_birthdate || null, insured_ahv_number: extracted.insured_ahv_number || null,
        insured_is_different: extracted.insured_is_different || false, policies: normalizedPolicies,
        insurer: firstPolicy.insurer || null, policy_number: firstPolicy.policy_number || null, insurance_type: firstPolicy.insurance_type || 'other',
        sparte: firstPolicy.sparte ? firstPolicy.sparte.toLowerCase() : null, product: firstPolicy.product || null,
        franchise: firstPolicy.franchise || null, model: firstPolicy.model || null, coverage_type: firstPolicy.coverage_type || null,
        premium_monthly: firstPolicy.premium_monthly || null, premium_yearly: firstPolicy.premium_yearly || (firstPolicy.premium_monthly ? Math.round(firstPolicy.premium_monthly * 12 * 100) / 100 : null),
        start_date: firstPolicy.start_date || null, end_date: firstPolicy.end_date || null,
        health_declaration_required: firstPolicy.health_declaration_required || false,
        broker_name: extracted.broker_name || null, commission_estimate: extracted.commission_estimate || null,
      },
      customerMatches, detectionPhase, matchedPrimaryCustomer, availableFamilyMembers, availablePrimaryCustomers,
    });
  } catch (error) {
    console.error('[smartDocumentAnalysis] ERROR:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});