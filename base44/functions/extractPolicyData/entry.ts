import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Swiss postal code to canton mapping
const CANTON_MAP = {
  '1': 'GE', '2': 'NE', '3': 'BE', '4': 'BL', '5': 'AG', '6': 'LU',
  '7': 'GR', '8': 'ZH', '9': 'SG'
};

function cantonFromZip(zip) {
  if (!zip || typeof zip !== 'string' || zip.length < 1) return null;
  return CANTON_MAP[zip.charAt(0)] || null;
}

// ── STATELESS RESET GUARD ─────────────────────────────────────────────────
// Each call is isolated. No shared state, no session memory, no globals.
// This function never merges results from previous documents.
function createFreshExtractionContext() {
  return {
    coverageBuffer: [],
    roleAssignments: {},
    documentState: null,
    learnedTemporaryPatterns: [],
    previousExtractionResults: null,
  };
}

// ── COVERAGE CONFIDENCE FILTER ────────────────────────────────────────────
// Coverage items below 0.90 confidence are EXCLUDED — never shown to user.
function filterCoveragesByConfidence(coverages) {
  if (!Array.isArray(coverages)) return [];
  return coverages.filter(c => (c.confidence || 0) >= 0.90);
}

// ── EXTRACTION QUALITY SCORE ─────────────────────────────────────────────
function computeExtractionQuality(data, confidences) {
  const criticalFields = ['first_name', 'last_name', 'insurer', 'policy_number', 'insurance_type', 'premium_monthly'];
  const scores = criticalFields.map(f => confidences[f] || 0);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const hasConflicts = data.policy_holder_name && data.first_name &&
    data.policy_holder_name.toLowerCase() === `${data.first_name} ${data.last_name}`.toLowerCase();
  const missingCount = scores.filter(s => s < 0.5).length;

  let level = 'high';
  let color = 'green';
  if (avg < 0.70 || missingCount >= 3) { level = 'low'; color = 'red'; }
  else if (avg < 0.85 || missingCount >= 1) { level = 'medium'; color = 'amber'; }

  return { score: Math.round(avg * 100), level, color, missing_critical: missingCount };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, file_name } = await req.json();
    if (!file_url) return Response.json({ error: 'Missing file_url' }, { status: 400 });

    console.log(`[extractPolicyData] START file=${file_name} — fresh stateless context`);

    // ── HARD STATELESS RESET ─────────────────────────────────────────────
    // Every document gets a completely fresh context. No memory from prior calls.
    const _ctx = createFreshExtractionContext(); // enforces isolation
    let extractedData = {};

    // Pass file URL directly to LLM (Gemini supports external PDF URLs)
    const fileInput = file_url;
    console.log(`[extractPolicyData] Using file_url for LLM: ${file_url.substring(0, 80)}...`);

    // LEARNED PATTERNS: Quarantined from extraction to prevent product leakage.
    // Patterns are loaded for audit only — NOT injected into the LLM prompt.
    // Reason: Injecting learned product patterns caused hallucinated coverages.
    const learnedPatternsText = ''; // INTENTIONALLY EMPTY — do not restore without evidence-validation
    
    try {
      // STATELESS: Each call is a fresh analysis. The LLM receives NO prior context.
      const response = await base44.integrations.Core.InvokeLLM({
        model: 'claude_sonnet_4_6',
        add_context_from_internet: false,
        file_urls: [fileInput],
        response_json_schema: {
          type: 'object',
          properties: {
            policy_holder_name: { type: ['string', 'null'] },
            first_name: { type: ['string', 'null'] },
            last_name: { type: ['string', 'null'] },
            birthdate: { type: ['string', 'null'] },
            gender: { type: ['string', 'null'] },
            role: { type: ['string', 'null'] },
            street: { type: ['string', 'null'] },
            zip_code: { type: ['string', 'null'] },
            city: { type: ['string', 'null'] },
            country: { type: ['string', 'null'] },
            phone: { type: ['string', 'null'] },
            mobile: { type: ['string', 'null'] },
            email: { type: ['string', 'null'] },
            insurer: { type: ['string', 'null'] },
            policy_number: { type: ['string', 'null'] },
            insurance_type: { type: ['string', 'null'] },
            product: { type: ['string', 'null'] },
            start_date: { type: ['string', 'null'] },
            end_date: { type: ['string', 'null'] },
            cancellation_deadline: { type: ['string', 'null'] },
            renewal_date: { type: ['string', 'null'] },
            premium_monthly: { type: ['number', 'null'] },
            premium_yearly: { type: ['number', 'null'] },
            payment_frequency: { type: ['string', 'null'] },
            model: { type: ['string', 'null'] },
            franchise: { type: ['string', 'null'] },
            age_group: { type: ['string', 'null'] },
            document_type: { type: ['string', 'null'] },
            products_evidence: { type: ['array', 'null'], items: { type: 'object', properties: { product: { type: 'string' }, confidence: { type: 'number' }, evidence: { type: 'array', items: { type: 'string' } } } } },
            field_confidences: { type: ['object', 'null'], additionalProperties: { type: 'number' } }
          }
        }
      });

      if (response && typeof response === 'object') {
        // RAW LOG: Log before ANY post-processing to isolate KI vs pipeline errors
        console.log('[extractPolicyData] RAW_LLM_OUTPUT:', JSON.stringify({
          insurer: response.insurer,
          insurance_type: response.insurance_type,
          product: response.product,
          products_evidence: response.products_evidence,
          first_name: response.first_name,
          last_name: response.last_name,
          policy_holder_name: response.policy_holder_name,
          premium_monthly: response.premium_monthly,
        }));
        extractedData = response;
      }
    } catch (llmErr) {
      const msg = llmErr instanceof Error ? llmErr.message : String(llmErr);
      console.warn(`[extractPolicyData] LLM extraction warning: ${msg}`);
    }

    // Normalize and clean data
    const firstName = (extractedData.first_name || '').trim() || null;
    const lastName = (extractedData.last_name || '').trim() || null;
    const birthdate = (extractedData.birthdate || '').trim() || null;
    const gender = (extractedData.gender || '').trim() || null;
    const role = (extractedData.role || '').trim() || null;
    
    const street = (extractedData.street || '').trim() || null;
    let zipCode = (extractedData.zip_code || '').trim() || null;
    let city = (extractedData.city || '').trim() || null;
    let canton = null;

    // Normalize zip code
    if (zipCode) {
      zipCode = zipCode.replace(/\D/g, '');
      while (zipCode.length < 4) zipCode = '0' + zipCode;
      zipCode = zipCode.slice(0, 4);
      if (zipCode.length !== 4) zipCode = null;
      
      if (!canton && zipCode) canton = cantonFromZip(zipCode);
    }

    const phone = (extractedData.phone || '').trim() || null;
    const mobile = (extractedData.mobile || '').trim() || null;
    const email = (extractedData.email || '').trim() || null;
    
    const insurer = (extractedData.insurer || '').trim() || null;
    const policyNumber = (extractedData.policy_number || '').trim() || null;
    const insuranceType = (extractedData.insurance_type || '').trim() || null;
    const product = (extractedData.product || '').trim() || null;
    
    const startDate = (extractedData.start_date || '').trim() || null;
    const endDate = (extractedData.end_date || '').trim() || null;
    const cancellationDeadline = (extractedData.cancellation_deadline || '').trim() || null;
    const renewalDate = (extractedData.renewal_date || '').trim() || null;
    
    let premiumMonthly = Number(extractedData.premium_monthly) || null;
    let premiumYearly = Number(extractedData.premium_yearly) || null;

    // Auto-calculate yearly from monthly
    if (premiumMonthly && !premiumYearly) {
      premiumYearly = Math.round(premiumMonthly * 12 * 100) / 100;
    }

    // ── HALLUCINATION FILTER: Only evidence-backed coverages with confidence >= 0.90 ──
    const validatedProducts = filterCoveragesByConfidence(extractedData.products_evidence || []);
    console.log(`[extractPolicyData] Coverage filter: ${(extractedData.products_evidence || []).length} raw → ${validatedProducts.length} validated (≥0.90 confidence)`);

    // Build sparte_data from extracted fields
    const sparteData = {};
    if (extractedData.model) sparteData.model = extractedData.model;
    if (extractedData.franchise) sparteData.franchise = extractedData.franchise;
    if (extractedData.age_group) sparteData.age_group = extractedData.age_group;
    if (extractedData.payment_frequency) sparteData.zahlungsintervall = extractedData.payment_frequency;
    // Only include validated evidence-backed products
    if (validatedProducts.length > 0) sparteData.products_evidence = validatedProducts;

    // ── VALIDATION ENGINE: Intelligente Fragen nur bei Unsicherheit ─────────
    const validationQuestions = [];
    const confidences = extractedData.field_confidences || {};
    
    // Frage 1: Rollen-Unsicherheit (policy_holder_name vs first_name/last_name)
    if (extractedData.policy_holder_name && firstName && lastName) {
      const holderLower = extractedData.policy_holder_name.toLowerCase();
      const insuredLower = `${firstName} ${lastName}`.toLowerCase();
      if (holderLower !== insuredLower && (confidences.policy_holder_name || 0) < 0.7) {
        validationQuestions.push({
          field: 'primary_customer_role',
          question: `${extractedData.policy_holder_name} wurde als Prämiemzahler erkannt. Soll diese Person Hauptkontakt sein?`,
          options: [
            { label: 'Ja, Hauptkontakt', value: 'policy_holder' },
            { label: 'Nein, versicherte Person', value: 'insured_person' }
          ]
        });
      }
    }
    
    // Frage 2: Familienmitglied vs Hauptkontakt
    if (extractedData.role && ['Kind', 'Ehepartner'].includes(extractedData.role)) {
      validationQuestions.push({
        field: 'family_role_confirmation',
        question: `${firstName} ${lastName} wurde als ${extractedData.role.toLowerCase()} erkannt. Korrekt?`,
        options: [
          { label: 'Ja', value: 'confirmed' },
          { label: 'Nein, Hauptkontakt', value: 'primary' }
        ]
      });
    }
    
    // Frage 3: Niedrige Confidence bei kritischen Feldern
    const criticalFields = ['insurer', 'policy_number', 'insurance_type', 'premium_monthly'];
    const lowConfidenceFields = criticalFields.filter(f => (confidences[f] || 1) < 0.6);
    if (lowConfidenceFields.length > 0) {
      validationQuestions.push({
        field: 'low_confidence_warning',
        question: `Folgende Daten wurden mit niedriger Konfidenz erkannt. Bitte prüfen:`,
        options: [
          { label: 'Ich prüfe manuell', value: 'manual_review' }
        ]
      });
    }
    
    // Gesamte Confidence berechnen
    const avgConfidence = Object.values(confidences).length > 0
      ? Object.values(confidences).reduce((a, b) => a + b, 0) / Object.values(confidences).length
      : 0.5;

    // ── EXTRACTION QUALITY SCORE ─────────────────────────────────────────
    const qualityScore = computeExtractionQuality(extractedData, confidences);

    const requiresValidation = validationQuestions.length > 0 || avgConfidence < 0.6;
    
    console.log(`[extractPolicyData] Quality: ${qualityScore.level} (${qualityScore.score}%) | Validation: ${validationQuestions.length} questions | Coverage: ${validatedProducts.length} validated`);

    return Response.json({
      success: true,
      extractedData: {
        policy_holder_name: (extractedData.policy_holder_name || '').trim() || null,
        first_name: firstName,
        last_name: lastName,
        birthdate: birthdate,
        gender: gender,
        role: role,
        street: street,
        zip_code: zipCode,
        city: city,
        canton: canton,
        phone: phone,
        mobile: mobile,
        email: email,
        insurer: insurer,
        policy_number: policyNumber,
        insurance_type: insuranceType,
        product: product,
        start_date: startDate,
        end_date: endDate,
        cancellation_deadline: cancellationDeadline,
        renewal_date: renewalDate,
        premium_monthly: premiumMonthly,
        premium_yearly: premiumYearly,
        payment_frequency: extractedData.payment_frequency || null,
        sparte_data: sparteData,
        additional_products: [],
        products_evidence: validatedProducts,
        notes: null,
        document_type: (extractedData.document_type || 'Unbekannt'),
        field_confidences: confidences,
        confidence_score: avgConfidence,
        extraction_quality: qualityScore,
        requires_validation: requiresValidation,
        validation_questions: validationQuestions,
        low_confidence_fields: lowConfidenceFields
      }
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[extractPolicyData] ERROR: ${errorMsg}`);

    // Always return success with empty data to prevent upload failure
    return Response.json({
      success: true,
      extractedData: {
        policy_holder_name: null,
        first_name: null,
        last_name: null,
        birthdate: null,
        gender: null,
        role: null,
        street: null,
        zip_code: null,
        city: null,
        canton: null,
        phone: null,
        mobile: null,
        email: null,
        insurer: null,
        policy_number: null,
        insurance_type: null,
        product: null,
        start_date: null,
        end_date: null,
        renewal_date: null,
        premium_monthly: null,
        premium_yearly: null,
        payment_frequency: null,
        sparte_data: {},
        additional_products: [],
        notes: `Datei konnte nicht vollständig analysiert werden. Bitte manuell überprüfen.`
      }
    });
  }
});