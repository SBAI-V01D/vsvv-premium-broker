import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Calculate age group from birthdate string YYYY-MM-DD
function calcAgeGroup(birthdate) {
  if (!birthdate) return null;
  const birth = new Date(birthdate);
  const today = new Date();
  const age = today.getFullYear() - birth.getFullYear() -
    (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
  if (age <= 18) return 'Kind';
  if (age <= 25) return 'Jugendlich';
  return 'Erwachsen';
}

// Derive KVG/VVG type from products array
function deriveProductType(produkte) {
  if (!produkte || produkte.length === 0) return null;
  const hasKVG = produkte.some(p =>
    p.typ === 'Grundversicherung' || (p.typ || '').toLowerCase().includes('kvg')
  );
  const hasVVG = produkte.some(p =>
    p.typ === 'Zusatz' || p.typ === 'Zusatzversicherung' || (p.typ || '').toLowerCase().includes('vvg')
  );
  if (hasKVG && hasVVG) return 'KVG + VVG';
  if (hasKVG) return 'KVG';
  if (hasVVG) return 'VVG';
  return null;
}

// Normalize kassenmodell
function normalizeKassenmodell(raw) {
  if (!raw) return null;
  const r = raw.toLowerCase();
  if (r.includes('hausarzt')) return 'Hausarztmodell';
  if (r.includes('hmo')) return 'HMO';
  if (r.includes('telmed')) return 'Telmed';
  if (r.includes('flexmed')) return 'Flexmed';
  if (raw.trim()) return raw.trim();
  return 'Standard';
}

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

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Du bist ein Experte für Schweizer Versicherungsformulare (KVG, VVG, KK, Leben, Sach).
Analysiere dieses Dokument und extrahiere ALLE Daten in exakt der vorgegebenen JSON-Struktur.

KRITISCHE REGELN:
- KEIN Feld leer lassen: wenn nicht vorhanden → null
- Datumsformat: YYYY-MM-DD
- Prämie: nur Zahl ohne Währungssymbol (z.B. 142.05)
- Telefon: internationales Format +41...
- E-Mail: validieren, bei ungültig → null
- confidence in "meta": 0-100 (Gesamtkonfidenz)
- Sprache: Deutsch (CH) / Französisch

Dateiname: "${file_name || ''}"

PRODUKTE (KRITISCH):
- produkte: ARRAY mit Objekten {typ, name}
- typ MUSS sein: "Grundversicherung" für KVG-Produkte ODER "Zusatz" für VVG/Zusatzversicherungen
- Beispiele:
    [{typ:"Grundversicherung", name:"BeneFit PLUS"}, {typ:"Zusatz", name:"TOP"}, {typ:"Zusatz", name:"SANA"}, {typ:"Zusatz", name:"HOSPITAL ECO"}]
- Wenn keine Produkte erkennbar: leeres Array []

VERSICHERUNGS-FELDER:
- franchise: numerisch z.B. "300", "1000", "2500" oder null
- kassenmodell: Standard / Hausarzt / HMO / Telemed / Flexmed oder null
- zahlungsintervall: "monatlich" / "vierteljährlich" / "halbjährlich" / "jährlich" oder null
- gesundheitsdeklaration: true wenn Text wie "Gesundheitsdeklaration erforderlich" oder "Gesundheitsfragen" vorkommt, sonst false

PFLICHTFELDER-PRÜFUNG:
Wenn person.vorname, person.nachname, person.geburtsdatum oder versicherung.beginn fehlen → meta.incomplete = true

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
              gesellschaft:          { type: ['string','null'] },
              beginn:                { type: ['string','null'] },
              praemie_monat:         { type: ['number','null'] },
              franchise:             { type: ['string','null'] },
              kassenmodell:          { type: ['string','null'] },
              zahlungsintervall:     { type: ['string','null'] },
              gesundheitsdeklaration:{ type: ['boolean','null'] },
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
              confidence:  { type: 'number' },
              incomplete:  { type: 'boolean' }
            },
            required: ['confidence','incomplete']
          }
        },
        required: ['person','kontaktperson','adresse','versicherung','meta']
      },
      model: 'gemini_3_flash'
    });

    const confidence = result?.meta?.confidence ?? 0;
    const incomplete = result?.meta?.incomplete ?? false;

    // Compute derived values server-side
    const ageGroup = calcAgeGroup(result?.person?.geburtsdatum);
    const produkte = result?.versicherung?.produkte || [];
    const productType = deriveProductType(produkte);
    const kassenmodell = normalizeKassenmodell(result?.versicherung?.kassenmodell);
    const premiumMonthly = result?.versicherung?.praemie_monat ?? null;
    const premiumYearly = premiumMonthly ? Math.round(premiumMonthly * 12 * 100) / 100 : null;
    const gesundheitsdeklaration = result?.versicherung?.gesundheitsdeklaration ?? false;

    // Validation: missing critical fields
    const missingFields = [];
    if (!result?.person?.vorname)            missingFields.push('Vorname');
    if (!result?.person?.nachname)           missingFields.push('Nachname');
    if (!result?.person?.geburtsdatum)       missingFields.push('Geburtsdatum');
    if (!result?.versicherung?.beginn)       missingFields.push('Vertragsbeginn');
    if (!result?.versicherung?.gesellschaft) missingFields.push('Versicherungsgesellschaft');
    if (!productType)                        missingFields.push('KVG/VVG');
    if (!ageGroup)                           missingFields.push('Altersgruppe');
    if (!premiumMonthly)                     missingFields.push('Monatsprämie');
    if (produkte.length === 0)               missingFields.push('Produkte');

    const status = missingFields.length > 0 ? 'unvollstaendig'
                 : confidence < 85 ? 'pruefung_erforderlich'
                 : 'ok';

    console.log(`[extractApplicationData] confidence=${confidence} status=${status} ageGroup=${ageGroup} productType=${productType}`);
    console.log(`[extractApplicationData] premiumMonthly=${premiumMonthly} premiumYearly=${premiumYearly}`);
    console.log(`[extractApplicationData] kassenmodell=${kassenmodell} gesundheitsdeklaration=${gesundheitsdeklaration}`);
    console.log(`[extractApplicationData] produkte=${JSON.stringify(produkte)}`);
    if (missingFields.length > 0) console.warn(`[extractApplicationData] MISSING: ${missingFields.join(', ')}`);

    return Response.json({
      success: true,
      structured: result,
      // Derived / computed
      age_group: ageGroup,
      product_type: productType,
      kassenmodell_normalized: kassenmodell,
      premium_monthly: premiumMonthly,
      premium_yearly: premiumYearly,
      gesundheitsdeklaration,
      confidence,
      status,
      missing_fields: missingFields,
    });
  } catch (error) {
    console.error(`[extractApplicationData] ERROR: ${error.message}`);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});