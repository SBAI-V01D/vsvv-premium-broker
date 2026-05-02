import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── NORMALIZATION PIPELINE (Single Source of Truth) ─────────────────────────

/**
 * Step 1: Altersgruppe – ALWAYS calculated from birthdate, never from form text.
 * ≤18 → Kind | 19–25 → Jugendlich | ≥26 → Erwachsen
 */
function calcAgeGroup(birthdate) {
  if (!birthdate) return null;
  const birth = new Date(birthdate);
  if (isNaN(birth)) return null;
  const today = new Date();
  const age = today.getFullYear() - birth.getFullYear() -
    (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
  if (age <= 18) return 'Kind';
  if (age <= 25) return 'Jugendlich';
  return 'Erwachsen';
}

/**
 * Step 2: Normalize individual product.
 * - Grundversicherung names → typ = "KVG"
 * - Zusatz names → typ = "VVG"
 * Also derives zusatz_type for VVG products.
 */
const KVG_NAMES = ['benefitplus', 'benefit plus', 'grundversicherung', 'casamed', 'mybenefits', 'callmed', 'telbasic'];

function normalizeProduktTyp(p) {
  const nameLower = (p.name || '').toLowerCase();
  const typLower = (p.typ || '').toLowerCase();

  // Explicit KVG indicators
  const isKVG = typLower === 'grundversicherung' || typLower === 'kvg' ||
    KVG_NAMES.some(k => nameLower.includes(k));

  const typ = isKVG ? 'KVG' : 'VVG';
  const result = { name: p.name || '', typ };

  // Zusatzversicherungstyp mapping (only for VVG)
  if (typ === 'VVG') {
    result.zusatz_typ = deriveZusatzTyp(p.name || '');
  }

  return result;
}

/**
 * Step 3: Zusatzversicherungstyp mapping
 * TOP, SANA → ambulant | HOSPITAL → stationär | PREVEA → Risiko
 */
function deriveZusatzTyp(name) {
  const n = name.toLowerCase();
  if (n.includes('hospital')) return 'stationär';
  if (n.includes('prevea') || n.includes('risikovers')) return 'Risiko';
  if (n.includes('top') || n.includes('sana') || n.includes('ambulant') ||
      n.includes('denta') || n.includes('vision') || n.includes('optic')) return 'ambulant';
  return null;
}

/**
 * Step 4: Normalize products array – unified KVG/VVG structure.
 */
function normalizeProdukte(produkte) {
  if (!Array.isArray(produkte)) return [];
  return produkte.map(normalizeProduktTyp);
}

/**
 * Step 5: Derive product type from normalized products.
 * KVG && VVG → "KVG + VVG" | KVG only → "KVG" | VVG only → "VVG"
 */
function deriveProductType(normalizedProdukte) {
  if (!normalizedProdukte || normalizedProdukte.length === 0) return null;
  const hasKVG = normalizedProdukte.some(p => p.typ === 'KVG');
  const hasVVG = normalizedProdukte.some(p => p.typ === 'VVG');
  if (hasKVG && hasVVG) return 'KVG + VVG';
  if (hasKVG) return 'KVG';
  if (hasVVG) return 'VVG';
  return null;
}

/**
 * Step 6: Kassenmodell normalization.
 */
function normalizeKassenmodell(raw) {
  if (!raw) return null;
  const r = raw.toLowerCase();
  if (r.includes('hausarzt') || r.includes('arzt')) return 'Hausarztmodell';
  if (r.includes('hmo')) return 'HMO';
  if (r.includes('telmed')) return 'Telmed';
  if (r.includes('flexmed')) return 'Flexmed';
  if (r.includes('standard') || r === '') return 'Standard';
  if (raw.trim()) return raw.trim();
  return 'Standard';
}

/**
 * Step 7: MAIN normalizeData function.
 * Takes raw LLM output and returns fully normalized data identical to manual entry.
 */
function normalizeData(raw) {
  const produkte = normalizeProdukte(raw?.versicherung?.produkte);
  const productType = deriveProductType(produkte);
  const kassenmodell = normalizeKassenmodell(raw?.versicherung?.kassenmodell);

  // Prämien: extract monthly, always compute yearly = monthly × 12
  const premiumMonthly = raw?.versicherung?.praemie_monat ?? null;
  const premiumYearly = premiumMonthly ? Math.round(premiumMonthly * 12 * 100) / 100 : null;

  // Age group: ALWAYS calculated from birthdate, never from document text
  const ageGroup = calcAgeGroup(raw?.person?.geburtsdatum);

  // Gesundheitsdeklaration
  const gesundheitsdeklaration = raw?.versicherung?.gesundheitsdeklaration ?? false;

  // Sparte mapping (identical to manual entry)
  const sparte = productType === 'VVG' ? 'vvg_zusatz'
               : productType === 'KVG + VVG' ? 'kvg_vvg_kombi'
               : 'kvg';

  return {
    // Person
    first_name: raw?.person?.vorname ?? null,
    last_name:  raw?.person?.nachname ?? null,
    birthdate:  raw?.person?.geburtsdatum ?? null,
    // Contact
    phone:      raw?.kontaktperson?.telefon ?? null,
    email:      raw?.kontaktperson?.email ?? null,
    // Address
    street:     raw?.adresse?.strasse ?? null,
    zip_code:   raw?.adresse?.plz ?? null,
    city:       raw?.adresse?.ort ?? null,
    // Insurance
    insurer:    raw?.versicherung?.gesellschaft ?? null,
    contract_start_date: raw?.versicherung?.beginn ?? null,
    zahlungsintervall:   raw?.versicherung?.zahlungsintervall ?? null,
    franchise:           raw?.versicherung?.franchise ?? null,
    // Normalized / derived
    produkte,
    product_type:     productType,
    kassenmodell,
    premium_monthly:  premiumMonthly,
    premium_yearly:   premiumYearly,
    age_group:        ageGroup,
    gesundheitsdeklaration,
    sparte,
  };
}

/**
 * Validation: check all critical fields are present.
 */
function validateNormalized(n) {
  const missing = [];
  if (!n.first_name)        missing.push('Vorname');
  if (!n.last_name)         missing.push('Nachname');
  if (!n.birthdate)         missing.push('Geburtsdatum');
  if (!n.contract_start_date) missing.push('Vertragsbeginn');
  if (!n.insurer)           missing.push('Versicherungsgesellschaft');
  if (!n.product_type)      missing.push('KVG/VVG');
  if (!n.age_group)         missing.push('Altersgruppe');
  if (!n.premium_monthly)   missing.push('Monatsprämie');
  if (n.produkte.length === 0) missing.push('Produkte');
  return missing;
}

// ─── DENO HANDLER ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url, file_name } = await req.json();
    if (!file_url) {
      return Response.json({ error: 'file_url erforderlich' }, { status: 400 });
    }

    console.log(`[extractApplicationData] START file=${file_name}`);

    // STEP 1: Extract raw data via LLM
    const raw = await base44.integrations.Core.InvokeLLM({
      prompt: `Du bist ein Experte für Schweizer Versicherungsformulare (KVG, VVG, KK, Leben, Sach).
Analysiere dieses Dokument und extrahiere ALLE Daten in exakt der vorgegebenen JSON-Struktur.

KRITISCHE REGELN:
- KEIN Feld leer lassen: wenn nicht vorhanden → null
- Datumsformat: YYYY-MM-DD
- Prämie: nur Zahl ohne Währungssymbol (z.B. 142.05) – NUR Monatsprämie
- Telefon: internationales Format +41...
- E-Mail: validieren, bei ungültig → null
- confidence: 0-100 (Gesamtkonfidenz der Extraktion)

Dateiname: "${file_name || ''}"

PRODUKTE (KRITISCH – EXAKT SO EXTRAHIEREN):
- produkte: ARRAY mit {typ, name}
- typ: "Grundversicherung" für KVG | "Zusatz" für alle Zusatzprodukte
- Beispiele:
    [{typ:"Grundversicherung", name:"BeneFit PLUS"}, {typ:"Zusatz", name:"TOP"}, {typ:"Zusatz", name:"HOSPITAL ECO"}]
- Wenn keine Produkte erkennbar: []

VERSICHERUNGS-FELDER:
- franchise: nur Zahl als String, z.B. "300", "2500" oder null
- kassenmodell: Standard / Hausarzt / HMO / Telemed / Flexmed oder null
- zahlungsintervall: "monatlich" / "vierteljährlich" / "halbjährlich" / "jährlich" oder null
- gesundheitsdeklaration: true wenn "Gesundheitsdeklaration erforderlich" oder "Gesundheitsfragen" steht, sonst false

Extrahiere in EXAKT dieser Struktur:`,
      file_urls: [file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          person: {
            type: 'object',
            properties: {
              vorname:      { type: ['string','null'] },
              nachname:     { type: ['string','null'] },
              geburtsdatum: { type: ['string','null'] }
            },
            required: ['vorname','nachname','geburtsdatum']
          },
          kontaktperson: {
            type: 'object',
            properties: {
              name:    { type: ['string','null'] },
              telefon: { type: ['string','null'] },
              email:   { type: ['string','null'] }
            },
            required: ['name','telefon','email']
          },
          adresse: {
            type: 'object',
            properties: {
              strasse: { type: ['string','null'] },
              plz:     { type: ['string','null'] },
              ort:     { type: ['string','null'] }
            },
            required: ['strasse','plz','ort']
          },
          versicherung: {
            type: 'object',
            properties: {
              gesellschaft:           { type: ['string','null'] },
              beginn:                 { type: ['string','null'] },
              praemie_monat:          { type: ['number','null'] },
              franchise:              { type: ['string','null'] },
              kassenmodell:           { type: ['string','null'] },
              zahlungsintervall:      { type: ['string','null'] },
              gesundheitsdeklaration: { type: ['boolean','null'] },
              produkte: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    typ:  { type: 'string' },
                    name: { type: 'string' }
                  },
                  required: ['typ','name']
                }
              }
            },
            required: ['gesellschaft','beginn','praemie_monat','franchise','kassenmodell','zahlungsintervall','gesundheitsdeklaration','produkte']
          },
          meta: {
            type: 'object',
            properties: {
              confidence: { type: 'number' },
              incomplete: { type: 'boolean' }
            },
            required: ['confidence','incomplete']
          }
        },
        required: ['person','kontaktperson','adresse','versicherung','meta']
      },
      model: 'gemini_3_flash'
    });

    // STEP 2: normalizeData – Single Source of Truth, identical to manual entry
    const normalized = normalizeData(raw);
    const missingFields = validateNormalized(normalized);
    const confidence = raw?.meta?.confidence ?? 0;

    const status = missingFields.length > 0 ? 'unvollstaendig'
                 : confidence < 85 ? 'pruefung_erforderlich'
                 : 'ok';

    console.log(`[normalizeData] productType=${normalized.product_type} sparte=${normalized.sparte} ageGroup=${normalized.age_group}`);
    console.log(`[normalizeData] premiumMonthly=${normalized.premium_monthly} premiumYearly=${normalized.premium_yearly}`);
    console.log(`[normalizeData] kassenmodell=${normalized.kassenmodell} gd=${normalized.gesundheitsdeklaration}`);
    console.log(`[normalizeData] produkte=${JSON.stringify(normalized.produkte)}`);
    if (missingFields.length > 0) console.warn(`[normalizeData] MISSING: ${missingFields.join(', ')}`);

    return Response.json({
      success: true,
      // Raw LLM output (for debug panel)
      structured: raw,
      // Normalized flat fields (used by doSave in DocumentReviewPanel)
      normalized,
      // Convenience top-level aliases (backwards compat with DocumentReviewPanel)
      age_group:               normalized.age_group,
      product_type:            normalized.product_type,
      kassenmodell_normalized: normalized.kassenmodell,
      premium_monthly:         normalized.premium_monthly,
      premium_yearly:          normalized.premium_yearly,
      gesundheitsdeklaration:  normalized.gesundheitsdeklaration,
      confidence,
      status,
      missing_fields: missingFields,
    });

  } catch (error) {
    console.error(`[extractApplicationData] ERROR: ${error.message}`);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});