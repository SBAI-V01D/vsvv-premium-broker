import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── PURE EXTRACTION MODE ──────────────────────────────────────────
// true  = skip ALL normalizeData/deriveZusatzTyp/applyLearned. RAW LLM direct to UI.
// false = restore normal pipeline (only after LLM output confirmed clean)
const PURE_EXTRACTION_MODE = true;

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

// Health insurance keywords
const HEALTH_KEYWORDS = [
  'kvg', 'krankenversicherung', 'grundversicherung', 'zusatzversicherung',
  'spital', 'ambulant', 'denta', 'zahn', 'dental', 'hmo', 'telmed',
  'hausarzt', 'medizin', 'arzt', 'ärztlich'
];

// Property/Liability insurance types (not health insurance)
const NON_HEALTH_KEYWORDS = [
  'hausrat', 'household', 'property', 'haftpflicht', 'liability', 'gebäude', 'building',
  'motorfahrzeug', 'auto', 'kfz', 'rechtsschutz', 'legal protection', 'unfall', 'accident'
];

function isHealthInsurance(productNames = []) {
  const combined = productNames.join(' ').toLowerCase();
  // If has non-health keywords → definitely not health insurance
  const hasNonHealthKeyword = NON_HEALTH_KEYWORDS.some(k => combined.includes(k));
  if (hasNonHealthKeyword) return false;
  // If has explicit health keywords → health insurance
  const hasHealthKeyword = HEALTH_KEYWORDS.some(k => combined.includes(k));
  if (hasHealthKeyword) return true;
  // Default: assume health (but this should rarely happen with proper product names)
  return true;
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

  // Sparte mapping: 
  // PRIORITY 1: Use sparte extracted directly from PDF label
  let sparte = null;
  let sparteDetectionMethod = null;
  
  const sparteFromPdf = raw?.versicherung?.sparte ? raw.versicherung.sparte.toLowerCase() : null;
  if (sparteFromPdf) {
    // Map PDF sparte labels to internal keys
    if (sparteFromPdf.includes('hausrat') || sparteFromPdf.includes('household')) {
      sparte = 'hausrat';
      sparteDetectionMethod = 'pdf_label_hausrat';
    } else if (sparteFromPdf.includes('kranken') || sparteFromPdf.includes('health')) {
      sparte = 'kvg';
      sparteDetectionMethod = 'pdf_label_kranken';
    } else if (sparteFromPdf.includes('motorfahrzeug') || sparteFromPdf.includes('auto') || sparteFromPdf.includes('kfz')) {
      sparte = 'motorfahrzeug';
      sparteDetectionMethod = 'pdf_label_motorfahrzeug';
    } else if (sparteFromPdf.includes('haftpflicht') || sparteFromPdf.includes('liability')) {
      sparte = 'haftpflicht';
      sparteDetectionMethod = 'pdf_label_haftpflicht';
    } else if (sparteFromPdf.includes('leben') || sparteFromPdf.includes('life')) {
      sparte = 'leben_3a';
      sparteDetectionMethod = 'pdf_label_leben';
    }
  }
  
  // PRIORITY 2: If no PDF label, derive from products
  if (!sparte) {
    if (!isHealth) {
      const productNamesList = produkte.map(p => p.name).join(' ').toLowerCase();
      if (productNamesList.includes('hausrat') || productNamesList.includes('household')) {
        sparte = 'hausrat';
        sparteDetectionMethod = 'product_name_hausrat';
      } else if (productNamesList.includes('motorfahrzeug') || productNamesList.includes('auto') || productNamesList.includes('kfz')) {
        sparte = 'motorfahrzeug';
        sparteDetectionMethod = 'product_name_motorfahrzeug';
      } else if (productNamesList.includes('haftpflicht') || productNamesList.includes('liability')) {
        sparte = 'haftpflicht';
        sparteDetectionMethod = 'product_name_haftpflicht';
      } else {
        sparte = 'vvg_zusatz';
        sparteDetectionMethod = 'product_non_health_fallback';
      }
    } else if (productType) {
      sparte = productType === 'VVG' ? 'vvg_zusatz'
             : productType === 'KVG + VVG' ? 'kvg_vvg_kombi'
             : productType === 'KVG' ? 'kvg'
             : null;
      sparteDetectionMethod = productType ? 'product_type_derived' : null;
    }
  }

  // Gesundheitsdeklaration: ONLY for Krankenversicherung (KVG/VVG)
  // Sparte ist jetzt gesetzt, daher ist diese Abfrage sicher
  const isKvgLike = sparte && (sparte === 'kvg' || sparte === 'kvg_vvg_kombi' || sparte === 'vvg_zusatz');
  const gesundheitsdeklaration = isKvgLike && isHealth ? (raw?.versicherung?.gesundheitsdeklaration ?? false) : false;

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

  // ROLLENLOGIK: policy_holder (Versicherungsnehmer) hat absolute Priorität.
  // Lenker/Fahrer sind NIEMALS der Kunde.
  const companyName = raw?.person?.firma ?? null;
  const firstName   = raw?.person?.vorname ?? null;
  const lastName    = raw?.person?.nachname ?? null;

  // Sicherheitscheck: wenn vorname/nachname mit Lenker übereinstimmt → auf null setzen
  const lenkerName = raw?.rollen?.lenker_name ?? raw?.rollen?.fahrer_name ?? null;
  const resolvedFirstName = lenkerName && firstName && lenkerName.toLowerCase().includes(firstName.toLowerCase())
    ? null : firstName;
  const resolvedLastName = lenkerName && lastName && lenkerName.toLowerCase().includes(lastName.toLowerCase())
    ? null : lastName;

  // ─── ROLLEN-KLASSIFIZIERUNG (STEP 1) ──────────────────────────────────
  // Detektiere klar: policy_holder vs driver vs insured_person
  const roleClassification = {
    policy_holder: {
      type: companyName ? 'company' : 'person',
      name: companyName || `${resolvedFirstName || ''} ${resolvedLastName || ''}`.trim(),
      source: 'person_field', // "Ihre Adresse" / "Versicherungsnehmer"
      detected: !!(companyName || resolvedFirstName || resolvedLastName),
    },
    driver: {
      name: lenkerName,
      source: 'rollen_field', // "Lenker"
      detected: !!lenkerName,
    },
    insured_person: {
      name: null, // Optional: weitere versicherte Person
      source: 'rollen_field',
      detected: false,
    },
  };

  return {
    // Person (policy_holder only)
    company_name: companyName,
    first_name: resolvedFirstName,
    last_name:  resolvedLastName,
    birthdate:  raw?.person?.geburtsdatum ?? null,
    // Rollen (nur für Debug/Info, nicht als Kunde)
    lenker_name: lenkerName,
    // STEP 1: ROLLEN-KLASSIFIZIERUNG
    role_classification: roleClassification,
    // Contact
    phone:      raw?.kontaktperson?.telefon ?? null,
    email:      raw?.kontaktperson?.email ?? null,
    // Address
    street:     raw?.adresse?.strasse ?? null,
    zip_code:   raw?.adresse?.plz ?? null,
    city:       raw?.adresse?.ort ?? null,
    canton:     raw?.adresse?.kanton ?? null,
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
  // Bei Firmenkunden: Firma reicht, Vorname/Nachname optional
  if (!n.company_name && !n.first_name)  missing.push('Vorname');
  if (!n.company_name && !n.last_name)   missing.push('Nachname');
  if (!n.company_name && !n.birthdate)   missing.push('Geburtsdatum');
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

    // STEP 0: Check file size before sending to LLM (limit: 10MB)
    try {
      const headRes = await fetch(file_url, { method: 'HEAD' });
      const contentLength = headRes.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
        const sizeMB = (parseInt(contentLength) / 1024 / 1024).toFixed(1);
        console.warn(`[extractApplicationData] File too large: ${sizeMB}MB (max 10MB)`);
        return Response.json({
          success: false,
          error: `Die PDF-Datei ist zu gross (${sizeMB} MB). Bitte komprimieren Sie das Dokument auf unter 10 MB und laden Sie es erneut hoch.`,
          error_code: 'FILE_TOO_LARGE',
          file_size_mb: parseFloat(sizeMB),
        }, { status: 413 });
      }
    } catch (sizeCheckErr) {
      console.warn(`[extractApplicationData] Size check failed (non-fatal): ${sizeCheckErr.message}`);
    }

    // ─── STAGE 0: RAW OCR TEXT DUMP ──────────────────────────────────────
    // Purpose: Reveal EXACTLY what Gemini reads from the PDF.
    // This is the ground truth input. If phantom products appear here,
    // they come from hidden PDF layers or OCR artifacts — not LLM hallucination.
    let rawOcrText = null;
    try {
      const ocrDump = await base44.integrations.Core.InvokeLLM({
        model: 'gemini_3_flash',
        file_urls: [file_url],
        prompt: 'Extract ALL visible text from this document EXACTLY as it appears. Copy word for word. Include every section, table, header, footer, number, and label. Do NOT interpret, summarize, or modify anything. Return as plain readable text.',
      });
      rawOcrText = typeof ocrDump === 'string' ? ocrDump : JSON.stringify(ocrDump);
      console.log('[STAGE 0] RAW OCR TEXT DUMP START ============================');
      console.log(rawOcrText);
      console.log('[STAGE 0] RAW OCR TEXT DUMP END ==============================');
      // Check for suspicious product names in raw text
      const phantomCheck = ['TOP', 'SANA', 'ambulant', 'Ambulant', 'BeneFit', 'CasaMed'];
      const found = phantomCheck.filter(p => rawOcrText.includes(p));
      if (found.length > 0) {
        console.warn('[STAGE 0] PHANTOM CANDIDATES IN RAW TEXT:', found.join(', '));
      } else {
        console.log('[STAGE 0] No phantom product keywords in raw text.');
      }
    } catch (ocrErr) {
      console.warn('[STAGE 0] OCR dump failed (non-fatal):', ocrErr.message);
    }

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

VERSICHERUNGSNEHMER vs. ROLLEN (ABSOLUT KRITISCH):
Das Dokument kann verschiedene Personen/Entitäten enthalten. Du MUSST die ROLLEN unterscheiden!

SCHRITT 1 – VERSICHERUNGSNEHMER (= Kunde, höchste Priorität):
Suche im Dokument nach: "Versicherungsnehmer", "Ihre Adresse", "Antragsteller", "Prämienzahler", "Rechnungsempfänger"
→ Der ADRESSBLOCK (Brief-Adresse oben auf dem Dokument) ist der Versicherungsnehmer/Prämienzahler.
→ "VERSICHERUNGSPOLICE für [Name]" = VERSICHERTE PERSON (NOT Versicherungsnehmer!) → person.vorname/nachname = diese Person, ABER nur wenn kein separater Adressblock vorhanden.
→ Wenn Adressblock UNGLEICH "für [Name]": Adressblock-Person = person.*, "für [Name]" = rollen.versicherte_person
→ Diese Entität ist der KUNDE. Trage sie in person.* ein.
→ Falls Firma (GmbH, AG, Genossenschaft, etc.) → person.firma setzen, vorname/nachname = null (oder Kontaktperson)
→ Falls Privatperson → person.vorname + person.nachname setzen, firma = null

SCHRITT 2 – ANDERE ROLLEN (NIEMALS als Kunde verwenden):
Suche nach: "Lenker", "Fahrer", "Fahrzeughalter", "versicherte Person" (wenn ≠ VN), "Begünstigter"
→ Diese Personen sind NICHT der Versicherungsnehmer/Kunde!
→ Trage sie in rollen.* ein (lenker, fahrer, etc.)
→ NIEMALS einen Lenker/Fahrer als person.vorname/nachname setzen!

BEISPIEL (Motorfahrzeugversicherung):
- "Versicherungsnehmer: VSV Management GmbH" → person.firma = "VSV Management GmbH"
- "Lenker: Peter Martin Adam" → rollen.lenker_name = "Peter Martin Adam"
- person.vorname/nachname = null (kein Privatname des VN)

Dateiname: "${file_name || ''}"

PRODUKTE (ABSOLUT KRITISCH – NUR MIT EIGENEM CHF-BETRAG):
- produkte: ARRAY mit {typ, name}
- EINZIGE REGEL: Ein Produkt wird NUR aufgenommen wenn es eine EIGENE CHF-Prämie in der Police hat.
- "inklusive", "kostenfrei", kein eigener CHF-Betrag = KEIN PRODUKT, niemals aufnehmen!
- Kostenbeteiligung / Varianten / Abteilungen ("Allgemeine Abteilung", "Halbprivate Abteilung") = KEINE Produkte!
- typ: "Grundversicherung" für KVG | "Zusatz" für VVG
- Konkretes Beispiel aus dieser Police:
    Spitalversicherung myFlex CHF 63.10 → [{typ:"Zusatz", name:"Spitalversicherung myFlex"}]
    Gesundheitskonto inklusive → NICHT aufnehmen (kein CHF-Betrag)
    Gesundheitskonto-Bonus inklusive → NICHT aufnehmen (kein CHF-Betrag)
- Wenn keine Produkte mit eigenem CHF-Betrag: []
- ABSOLUT VERBOTEN: TOP, SANA, Ambulant, Balance, Standard ergänzen wenn nicht explizit mit eigenem CHF-Betrag im Dokument!

VERSICHERUNGS-FELDER:
- gesellschaft: Name der Versicherungsgesellschaft
- sparte: Versicherungssparte direkt vom Dokument (z.B. "Hausratversicherung", "Krankenversicherung", "Motorfahrzeugversicherung") – dies ist das wichtigste Feld!
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
              firma:        { type: ['string','null'] },
              vorname:      { type: ['string','null'] },
              nachname:     { type: ['string','null'] },
              geburtsdatum: { type: ['string','null'] },
              ist_praemienzahler: { type: ['boolean','null'] }
            },
            required: ['firma','vorname','nachname','geburtsdatum']
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
              ort:     { type: ['string','null'] },
              kanton:  { type: ['string','null'] }
            },
            required: ['strasse','plz','ort']
          },
          versicherung: {
            type: 'object',
            properties: {
              gesellschaft:           { type: ['string','null'] },
              sparte:                 { type: ['string','null'] },
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
          rollen: {
            type: 'object',
            properties: {
              lenker_name:        { type: ['string','null'] },
              fahrer_name:        { type: ['string','null'] },
              beguenstigter:      { type: ['string','null'] },
              versicherte_person: { type: ['string','null'] }
            },
            required: ['lenker_name','fahrer_name','beguenstigter']
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
        required: ['person','kontaktperson','adresse','versicherung','rollen','meta']
      },
      model: 'gemini_3_flash'
    });

    const confidence = raw?.meta?.confidence ?? 0;

    // ─── PURE MODE: bypass ALL normalization ─────────────────────────────────
    if (PURE_EXTRACTION_MODE) {
      console.log('[extractApplicationData] *** PURE MODE *** skipping normalizeData + all enrichment');
      console.log('[PURE LLM] person:', JSON.stringify(raw?.person));
      console.log('[PURE LLM] versicherung.produkte:', JSON.stringify(raw?.versicherung?.produkte));
      console.log('[PURE LLM] versicherung.praemie_monat:', raw?.versicherung?.praemie_monat);
      console.log('[PURE LLM] rollen:', JSON.stringify(raw?.rollen));
      console.log('[PURE LLM] adresse:', JSON.stringify(raw?.adresse));

      const rawProdukte = (raw?.versicherung?.produkte || []).map(p => ({ name: p.name, typ: p.typ, source: 'raw_llm' }));

      const pureMapped = {
        company_name:        raw?.person?.firma ?? null,
        first_name:          raw?.person?.vorname ?? null,
        last_name:           raw?.person?.nachname ?? null,
        birthdate:           raw?.person?.geburtsdatum ?? null,
        phone:               raw?.kontaktperson?.telefon ?? null,
        email:               raw?.kontaktperson?.email ?? null,
        street:              raw?.adresse?.strasse ?? null,
        zip_code:            raw?.adresse?.plz ?? null,
        city:                raw?.adresse?.ort ?? null,
        canton:              raw?.adresse?.kanton ?? null,
        insurer:             raw?.versicherung?.gesellschaft ?? null,
        contract_start_date: raw?.versicherung?.beginn ?? null,
        contract_end_date:   raw?.versicherung?.ende ?? null,
        franchise:           raw?.versicherung?.franchise ?? null,
        kassenmodell:        raw?.versicherung?.kassenmodell ?? null,
        zahlungsintervall:   raw?.versicherung?.zahlungsintervall ?? null,
        premium_monthly:     raw?.versicherung?.praemie_monat ?? null,
        premium_yearly:      raw?.versicherung?.praemie_monat ? Math.round(raw.versicherung.praemie_monat * 12 * 100) / 100 : null,
        produkte:            rawProdukte,
        product_label:       rawProdukte.map(p => p.name).filter(Boolean).join(', ') || null,
        product_type:        null,
        sparte:              null,
        zusatz_type:         null,
        age_group:           null,
        gesundheitsdeklaration: false,
        lenker_name:         raw?.rollen?.lenker_name ?? null,
        versicherte_person:  raw?.rollen?.versicherte_person ?? null,
        role_classification: {
          policy_holder: { name: `${raw?.person?.vorname || ''} ${raw?.person?.nachname || ''}`.trim() || raw?.person?.firma, source: 'raw_person_field' },
          driver:        { name: raw?.rollen?.lenker_name ?? null, source: 'raw_rollen' },
          insured_person:{ name: raw?.rollen?.versicherte_person ?? null, source: 'raw_rollen' },
        }
      };

      return Response.json({
        success: true,
        structured: raw,
        normalized: pureMapped,
        pure_mode: true,
        raw_ocr_text: rawOcrText,
        confidence,
        status: `pure_mode (${rawProdukte.length} raw products, 0 derived)`,
        missing_fields: [],
        age_group: null,
        product_type: null,
        role_classification: pureMapped.role_classification,
        gesundheitsdeklaration: false,
      });
    }

    // ─── STEP 2: normalizeData (only when PURE_EXTRACTION_MODE = false) ─────────────
    const normalized = normalizeData(raw);
    const missingFields = validateNormalized(normalized);
    console.log(`[normalizeData] produkte=${JSON.stringify(normalized.produkte)}`);
    console.log(`[normalizeData] sparte=${normalized.sparte} product_type=${normalized.product_type}`);
    if (missingFields.length > 0) console.warn(`[normalizeData] MISSING: ${missingFields.join(', ')}`);
    console.log('[extractApplicationData] ROLE CLASSIFICATION:', JSON.stringify(normalized.role_classification));

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
      // STEP 1: Role Classification
      role_classification:     normalized.role_classification,
      confidence,
      status,
      missing_fields: missingFields,
    });

  } catch (error) {
    console.error(`[extractApplicationData] ERROR: ${error.message}`);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});