import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── NORMALIZATION PIPELINE (Single Source of Truth) ─────────────────────────

/**
 * Step 1: Altersgruppe – ALWAYS calculated from birthdate, never from form text.
 * Maps to exact form values used in ApplicationForm.
 */
function calcAgeGroup(birthdate) {
  if (!birthdate) return null;
  const birth = new Date(birthdate);
  if (isNaN(birth)) return null;
  const today = new Date();
  const age = today.getFullYear() - birth.getFullYear() -
    (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
  if (age <= 18) return 'Kind (0–18 Jahre)';
  if (age <= 25) return 'Jugendliche (19–25 Jahre)';
  return 'Erwachsene (ab 26 Jahre)';
}

/**
 * Step 2: KVG product name list – used for KVG/VVG classification.
 * Grundversicherung = KVG, everything else = VVG
 * Also detect insurance type (health vs. property/liability)
 */
const KVG_NAMES = [
  'benefitplus', 'benefit plus', 'grundversicherung', 'casamed', 'mybenefits',
  'callmed', 'telbasic', 'compacamed', 'compact', 'classic', 'medbase', 'flexicare',
  'mycare', 'premed', 'sanitas basic', 'basic', 'standard',
];

// Property/Liability insurance types (not health insurance)
const NON_HEALTH_KEYWORDS = [
  'hausrat', 'household', 'property', 'haftpflicht', 'liability', 'gebäude', 'building',
  'motorfahrzeug', 'auto', 'kfz', 'rechtsschutz', 'legal protection', 'unfall', 'accident'
];

function isHealthInsurance(productNames = []) {
  const combined = productNames.join(' ').toLowerCase();
  // If any health-specific keyword is present, it's health insurance
  // If no keywords but has non-health keywords → not health insurance
  const hasNonHealthKeyword = NON_HEALTH_KEYWORDS.some(k => combined.includes(k));
  return !hasNonHealthKeyword;
}

function normalizeProduktTyp(p, isHealth = true) {
  const nameLower = (p.name || '').toLowerCase();
  const typLower = (p.typ || '').toLowerCase();

  const isKVG = typLower === 'grundversicherung' || typLower === 'kvg' ||
    KVG_NAMES.some(k => nameLower.includes(k));

  const typ = isKVG ? 'KVG' : 'VVG';
  const result = { name: p.name || '', typ };

  // Zusatzversicherungstyp: only for VVG products AND health insurance
  if (typ === 'VVG' && isHealth) {
    result.zusatz_typ = deriveZusatzTyp(p.name || '', true);
  }

  return result;
}

/**
 * Step 3: Zusatzversicherungstyp – maps to exact form values:
 * Only for health insurance (KVG/VVG):
 * 'Spital allgemein' | 'Spital halbprivat' | 'Spital privat' | 'Ambulant' | 'Dental' | 'Alternativ'
 * 
 * For property/liability insurance (Sach/Haft): returns null
 */
function deriveZusatzTyp(name, isHealthInsurance = true) {
  const n = name.toLowerCase();

  // Non-health insurance (property, liability, household) – no Spital/Ambulant/Dental/Alternativ types
  if (!isHealthInsurance) {
    return null;
  }

  // Spital – check most specific first (only for health insurance)
  if (n.includes('privat') && n.includes('spital')) return 'Spital privat';
  if (n.includes('halbprivat') || n.includes('semi-privat') || n.includes('semiprivat')) return 'Spital halbprivat';
  if (n.includes('hospital') || n.includes('spital') || n.includes('stationär') || n.includes('allgemein')) return 'Spital allgemein';

  // Ambulant / Dental / Alternativ (health insurance only)
  if (n.includes('denta') || n.includes('dental') || n.includes('zahn')) return 'Dental';
  if (n.includes('alternativ') || n.includes('komplementär') || n.includes('natur')) return 'Alternativ';
  if (n.includes('top') || n.includes('sana') || n.includes('ambulant') || n.includes('vision') || n.includes('optic')) return 'Ambulant';

  return null;
}

/**
 * Step 4: Derive the dominant Zusatzversicherungstyp from all VVG products.
 * Priority: Spital privat > halbprivat > allgemein > Ambulant > Dental > Alternativ
 */
function deriveMainZusatzType(normalizedProdukte) {
  const vvgProducts = normalizedProdukte.filter(p => p.typ === 'VVG' && p.zusatz_typ);
  if (vvgProducts.length === 0) return null;

  const priority = ['Spital privat', 'Spital halbprivat', 'Spital allgemein', 'Ambulant', 'Dental', 'Alternativ'];
  for (const prio of priority) {
    if (vvgProducts.some(p => p.zusatz_typ === prio)) return prio;
  }
  return vvgProducts[0].zusatz_typ;
}

/**
 * Step 5: Normalize products array.
 */
function normalizeProdukte(produkte) {
  if (!Array.isArray(produkte)) return [];
  const isHealth = isHealthInsurance(produkte.map(p => p.name || ''));
  return produkte.map(p => normalizeProduktTyp(p, isHealth));
}

/**
 * Step 6: Derive product type from normalized products.
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
 * Step 7: Kassenmodell normalization – maps to form values.
 */
function normalizeKassenmodell(raw) {
  if (!raw) return null;
  const r = raw.toLowerCase();
  if (r.includes('hausarzt') || r.includes('gp')) return 'Hausarztmodell';
  if (r.includes('hmo')) return 'HMO';
  if (r.includes('telmed') || r.includes('telemed')) return 'Telmed';
  if (r.includes('flexmed') || r.includes('flex')) return 'Flexmed';
  if (r.includes('standard') || r === '') return 'Standardmodell';
  if (raw.trim()) return raw.trim();
  return 'Standardmodell';
}

/**
 * Step 8: Build a product label string for the "product" field in the form.
 * e.g. "BeneFit PLUS, TOP, HOSPITAL ECO"
 */
function buildProductLabel(normalizedProdukte) {
  if (!normalizedProdukte || normalizedProdukte.length === 0) return null;
  return normalizedProdukte.map(p => p.name).filter(Boolean).join(', ');
}

/**
 * Step 9: MAIN normalizeData function.
 */
function normalizeData(raw) {
  const produkte = normalizeProdukte(raw?.versicherung?.produkte);
  const productType = deriveProductType(produkte);
  const kassenmodell = normalizeKassenmodell(raw?.versicherung?.kassenmodell);
  const zusatzType = deriveMainZusatzType(produkte);
  const isHealth = isHealthInsurance((raw?.versicherung?.produkte || []).map(p => p.name || ''));

  // Prämien: monthly extracted, yearly = monthly × 12
  const premiumMonthly = raw?.versicherung?.praemie_monat ?? null;
  const premiumYearly = premiumMonthly ? Math.round(premiumMonthly * 12 * 100) / 100 : null;

  // Age group: ALWAYS calculated from birthdate, mapped to exact form values
  const ageGroup = calcAgeGroup(raw?.person?.geburtsdatum);

  // Gesundheitsdeklaration: ONLY for health insurance
  const gesundheitsdeklaration = isHealth ? (raw?.versicherung?.gesundheitsdeklaration ?? false) : false;

  // Sparte mapping: 
  // - Only set if clearly identifiable from products
  // - NO DEFAULT! If uncertain, leave null for manual review
  let sparte = null;
  let sparteDetectionMethod = null;
  
  if (!isHealth) {
    sparte = 'vvg_zusatz'; // Property/Liability/etc.
    sparteDetectionMethod = 'non_health_keywords';
  } else if (productType) {
    sparte = productType === 'VVG' ? 'vvg_zusatz'
           : productType === 'KVG + VVG' ? 'kvg_vvg_kombi'
           : productType === 'KVG' ? 'kvg'
           : null;
    sparteDetectionMethod = productType ? 'product_type_derived' : null;
  }
  // If still null (no products detected), leave it null – will be determined by classification

  // Product label (all product names joined)
  const productLabel = buildProductLabel(produkte);

  // contract_end_date: use extracted value, or calculate from start date (31.12 of start year)
  const contractStartDate = raw?.versicherung?.beginn ?? null;
  let contractEndDate = raw?.versicherung?.ende ?? null;
  if (!contractEndDate && contractStartDate) {
    const startYear = new Date(contractStartDate).getFullYear();
    if (!isNaN(startYear)) {
      contractEndDate = `${startYear}-12-31`;
    }
  }

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
    insurer:             raw?.versicherung?.gesellschaft ?? null,
    contract_start_date: contractStartDate,
    contract_end_date:   contractEndDate,
    zahlungsintervall:   raw?.versicherung?.zahlungsintervall ?? null,
    franchise:           raw?.versicherung?.franchise ?? null,
    // Normalized / derived
    produkte,
    product_type:           productType,
    product_label:          productLabel,
    kassenmodell,
    zusatz_type:            zusatzType,
    premium_monthly:        premiumMonthly,
    premium_yearly:         premiumYearly,
    age_group:              ageGroup,
    gesundheitsdeklaration,
    sparte,                 // NULL if uncertain (no default)
    sparte_detection_method: sparteDetectionMethod, // Debug: how was sparte determined
  };
}

/**
 * Validation: check all critical fields are present.
 */
function validateNormalized(n) {
  const missing = [];
  if (!n.first_name)          missing.push('Vorname');
  if (!n.last_name)           missing.push('Nachname');
  if (!n.birthdate)           missing.push('Geburtsdatum');
  if (!n.contract_start_date) missing.push('Vertragsbeginn');
  if (!n.insurer)             missing.push('Versicherungsgesellschaft');
  if (!n.product_type)        missing.push('KVG/VVG');
  if (!n.age_group)           missing.push('Altersgruppe');
  if (!n.premium_monthly)     missing.push('Monatsprämie');
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
- typ: "Grundversicherung" für KVG-Grundversicherung | "Zusatz" für ALLE Zusatzversicherungen (VVG)
- Grundversicherung = KVG (obligatorisch, z.B. BeneFit PLUS, CasaMed, myBenefits, CompaCaMed, Standard)
- Zusatzversicherung = VVG (freiwillig, z.B. HOSPITAL, TOP, SANA, Dental, Denta, PREVEA, Ambulant)
- Beispiele:
    [{typ:"Grundversicherung", name:"BeneFit PLUS"}, {typ:"Zusatz", name:"TOP"}, {typ:"Zusatz", name:"HOSPITAL ECO"}]
- Wenn keine Produkte erkennbar: []

SPITAL/ZUSATZ-TYPEN erkennen:
- "Spital privat" / "privat" → Spitalversicherung privat
- "Spital halbprivat" / "halbprivat" → Spitalversicherung halbprivat
- "Spital allgemein" / "Hospital" / "allgemein" → Spitalversicherung allgemein
- "Ambulant" / "TOP" / "SANA" → ambulante Zusatzversicherung
- "Denta" / "Dental" / "Zahn" → Zahnversicherung

VERSICHERUNGS-FELDER:
- gesellschaft: Name der Versicherungsgesellschaft
- beginn: Vertragsbeginn (YYYY-MM-DD) – Felder: "Versicherungsbeginn", "Beginn", "gültig ab", "Eintritt", "ab"
- ende: Vertragsablauf / Vertragsende (YYYY-MM-DD) – Felder: "Vertragsende", "Ablauf", "Ablaufdatum", "Ende", "Kündigung zum", "Kündigungstermin", "kündbar auf", "läuft ab am", "Laufzeit bis", "Ablauf der Versicherung", "Ende des Versicherungsjahres" – bei jährlicher Erneuerung: berechne das nächste Ablaufdatum aus dem Beginn (z.B. Beginn 01.01.2025 → Ablauf 31.12.2025) – sonst null
- praemie_monat: Monatsprämie als Zahl (z.B. 142.05), null wenn nicht vorhanden
- franchise: nur Zahl als String, z.B. "300", "2500" oder null
- kassenmodell: Standard / Standardmodell / Hausarzt / HMO / Telemed / Flexmed oder null
- zahlungsintervall: "monatlich" / "vierteljährlich" / "halbjährlich" / "jährlich" oder null
- gesundheitsdeklaration: true wenn "Gesundheitsdeklaration erforderlich", "Gesundheitsfragen", "ärztliche Untersuchung" oder ähnliches steht, sonst false

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
              ende:                   { type: ['string','null'] },
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
            required: ['gesellschaft','beginn','ende','praemie_monat','franchise','kassenmodell','zahlungsintervall','gesundheitsdeklaration','produkte']
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

    // STEP 2: normalizeData – Single Source of Truth
    const normalized = normalizeData(raw);
    const missingFields = validateNormalized(normalized);
    const confidence = raw?.meta?.confidence ?? 0;

    const status = missingFields.length > 0 ? 'unvollstaendig'
                 : confidence < 85 ? 'pruefung_erforderlich'
                 : 'ok';

    console.log(`[normalizeData] productType=${normalized.product_type} sparte=${normalized.sparte} ageGroup=${normalized.age_group}`);
    console.log(`[normalizeData] premiumMonthly=${normalized.premium_monthly} premiumYearly=${normalized.premium_yearly}`);
    console.log(`[normalizeData] kassenmodell=${normalized.kassenmodell} gd=${normalized.gesundheitsdeklaration}`);
    console.log(`[normalizeData] zusatz_type=${normalized.zusatz_type} productLabel=${normalized.product_label}`);
    console.log(`[normalizeData] contract_end_date=${normalized.contract_end_date}`);
    console.log(`[normalizeData] produkte=${JSON.stringify(normalized.produkte)}`);
    if (missingFields.length > 0) console.warn(`[normalizeData] MISSING: ${missingFields.join(', ')}`);

    return Response.json({
      success: true,
      structured: raw,
      normalized,
      // Convenience aliases
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