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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, file_name } = await req.json();
    if (!file_url) return Response.json({ error: 'Missing file_url' }, { status: 400 });

    console.log(`[extractPolicyData] START file=${file_name}`);

    let extractedData = {};
    
    try {
      // MINIMAL Schema für Vertex AI Kompatibilität
      const response = await base44.integrations.Core.InvokeLLM({
        model: 'automatic',
        prompt: `Extract customer and insurance data from this document. Return ONLY a JSON object.

EXTRACT:
- first_name: First name (empty string if not found)
- last_name: Last name (empty string if not found)
- birthdate: Birth date YYYY-MM-DD (empty string if not found)
- street: Street address (empty string if not found)
- zip_code: Postal code 4 digits (empty string if not found)
- city: City name (empty string if not found)
- phone: Phone (empty string if not found)
- email: Email (empty string if not found)
- policy_number: Policy number (empty string if not found)
- insurer: Insurance company (empty string if not found)
- insurance_type: Insurance type (empty string if not found)
- product: Product name (empty string if not found)
- start_date: Start date YYYY-MM-DD (empty string if not found)
- end_date: End date YYYY-MM-DD (empty string if not found)
- premium_monthly: Monthly premium number (0 if not found)
- premium_yearly: Yearly premium number (0 if not found)

RULES:
- Return empty string "" for missing fields, NOT null
- Use empty string "" for strings, 0 for numbers
- Dates must be YYYY-MM-DD format or empty string
- Do NOT invent data
- Do NOT make assumptions`,
        file_urls: [file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            birthdate: { type: 'string' },
            street: { type: 'string' },
            zip_code: { type: 'string' },
            city: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
            policy_number: { type: 'string' },
            insurer: { type: 'string' },
            insurance_type: { type: 'string' },
            product: { type: 'string' },
            start_date: { type: 'string' },
            end_date: { type: 'string' },
            premium_monthly: { type: 'number' },
            premium_yearly: { type: 'number' }
          },
          required: ['first_name', 'last_name', 'zip_code', 'city', 'insurer', 'policy_number']
        }
      });

      if (response && typeof response === 'object') {
        extractedData = response;
      }
    } catch (llmErr) {
      const msg = llmErr instanceof Error ? llmErr.message : String(llmErr);
      console.warn(`[extractPolicyData] LLM extraction warning: ${msg}`);
      // Continue with empty data, don't fail
      extractedData = {};
    }

    // Normalize and clean data
    const firstName = (extractedData.first_name || '').trim() || null;
    const lastName = (extractedData.last_name || '').trim() || null;
    const birthdate = (extractedData.birthdate || '').trim() || null;
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
      
      // Auto-derive canton from zip
      if (!canton && zipCode) canton = cantonFromZip(zipCode);
    }

    const phone = (extractedData.phone || '').trim() || null;
    const email = (extractedData.email || '').trim() || null;
    const policyNumber = (extractedData.policy_number || '').trim() || null;
    const insurer = (extractedData.insurer || '').trim() || null;
    const insuranceType = (extractedData.insurance_type || '').trim() || null;
    const product = (extractedData.product || '').trim() || null;
    const startDate = (extractedData.start_date || '').trim() || null;
    const endDate = (extractedData.end_date || '').trim() || null;

    let premiumMonthly = Number(extractedData.premium_monthly) || null;
    let premiumYearly = Number(extractedData.premium_yearly) || null;

    // Auto-calculate yearly from monthly
    if (premiumMonthly && !premiumYearly) {
      premiumYearly = Math.round(premiumMonthly * 12 * 100) / 100;
    }

    console.log(`[extractPolicyData] SUCCESS: insurer=${insurer}, name=${firstName} ${lastName}, zip=${zipCode}, city=${city}`);

    return Response.json({
      success: true,
      extractedData: {
        first_name: firstName,
        last_name: lastName,
        birthdate: birthdate,
        street: street,
        zip_code: zipCode,
        city: city,
        canton: canton,
        phone: phone,
        email: email,
        policy_number: policyNumber,
        insurer: insurer,
        insurance_type: insuranceType,
        product: product,
        start_date: startDate,
        end_date: endDate,
        premium_monthly: premiumMonthly,
        premium_yearly: premiumYearly,
        sparte_data: {},
        additional_products: [],
        notes: null
      }
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[extractPolicyData] ERROR: ${errorMsg}`);

    // Always return success with empty data to prevent upload failure
    return Response.json({
      success: true,
      extractedData: {
        first_name: null,
        last_name: null,
        birthdate: null,
        street: null,
        zip_code: null,
        city: null,
        canton: null,
        phone: null,
        email: null,
        policy_number: null,
        insurer: null,
        insurance_type: null,
        product: null,
        start_date: null,
        end_date: null,
        premium_monthly: null,
        premium_yearly: null,
        sparte_data: {},
        additional_products: [],
        notes: `Datei konnte nicht vollständig analysiert werden. Bitte manuell überprüfen.`
      }
    });
  }
});