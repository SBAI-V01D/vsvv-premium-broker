import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ERROR_TYPE_MAP = {
  policy_holder_name: 'role_error',
  first_name: 'role_error',
  last_name: 'role_error',
  insurance_type: 'product_error',
  product: 'product_error',
  policy_number: 'ocr_error',
  premium_monthly: 'premium_error',
  premium_yearly: 'premium_error',
  start_date: 'date_error',
  end_date: 'date_error',
  street: 'address_error',
  zip_code: 'address_error',
  city: 'address_error',
};

function computeDiff(original, corrected) {
  const corrections = [];
  const errorCategories = new Set();
  const FIELDS = ['policy_holder_name', 'first_name', 'last_name', 'birthdate', 'insurer',
    'policy_number', 'insurance_type', 'product', 'premium_monthly', 'premium_yearly',
    'start_date', 'end_date', 'street', 'zip_code', 'city'];

  for (const field of FIELDS) {
    const orig = original[field];
    const corr = corrected[field];
    const origStr = orig != null ? String(orig) : '';
    const corrStr = corr != null ? String(corr) : '';
    if (origStr !== corrStr) {
      const errorType = ERROR_TYPE_MAP[field] || 'unknown';
      errorCategories.add(errorType);
      corrections.push({ field, original_value: origStr, corrected_value: corrStr, error_type: errorType });
    }
  }
  return { corrections, errorCategories: Array.from(errorCategories) };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { original_extraction, corrected_extraction, insurer, document_type, file_name, file_url } = await req.json();

    if (!original_extraction || !corrected_extraction) {
      return Response.json({ success: true, message: 'No corrections to process' });
    }

    const { corrections, errorCategories } = computeDiff(original_extraction, corrected_extraction);

    if (corrections.length === 0) {
      return Response.json({ success: true, message: 'No field changes detected', correction_count: 0 });
    }

    console.log(`[learnFromCorrection] ${corrections.length} corrections for ${insurer} / ${document_type}`);

    // Build corrected_values object (only changed fields)
    const correctedValues = {};
    for (const c of corrections) correctedValues[c.field] = c.corrected_value;

    // LLM analysis: why was the AI wrong + what patterns can be learned?
    let aiAnalysis = '';
    let patternsExtracted = [];

    try {
      const analysisResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Sie sind ein Experte für Schweizer Versicherungsdokumente.

Analysieren Sie diese KI-Extraktionsfehler und leiten Sie wiederverwendbare Muster ab.

Versicherung: ${insurer || 'Unbekannt'}
Dokumenttyp: ${document_type || 'Unbekannt'}

KORREKTUREN (was KI extrahierte → was der Broker korrigiert hat):
${corrections.map(c => `- Feld "${c.field}": "${c.original_value}" → "${c.corrected_value}"`).join('\n')}

AUFGABEN:
1. Analysieren Sie in 1-2 Sätzen, warum die KI falsch lag (Rollenfehler? OCR? Layoutproblem? Gesellschafts-spezifische Struktur?)
2. Leiten Sie konkrete, wiederverwendbare Muster ab die bei zukünftigen Extraktionen helfen

AUSGABE als JSON:
{
  "analysis": "1-2 Sätze: warum lag die KI falsch?",
  "patterns": [
    {
      "signal": "Begriff/Signal der im Dokument vorkommt (z.B. 'Prämienzahler', 'Total VVG Nettoprämie')",
      "maps_to": "Zielfeld (z.B. 'policy_holder_name', 'insurance_type')",
      "maps_to_value": "Fester Wert wenn immer gleich (z.B. 'Krankenzusatz VVG'), sonst null",
      "confidence_boost": 0.10-0.20,
      "description": "Erklaerung des Musters"
    }
  ]
}

Nur echte, spezifische Muster ableiten. Wenn kein klares Muster erkennbar, leeres patterns-Array zurückgeben.`,
        response_json_schema: {
          type: 'object',
          properties: {
            analysis: { type: 'string' },
            patterns: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  signal: { type: 'string' },
                  maps_to: { type: 'string' },
                  maps_to_value: { type: ['string', 'null'] },
                  confidence_boost: { type: 'number' },
                  description: { type: 'string' }
                }
              }
            }
          }
        }
      });

      aiAnalysis = analysisResult?.analysis || '';
      patternsExtracted = analysisResult?.patterns || [];
    } catch (llmErr) {
      console.warn(`[learnFromCorrection] LLM analysis failed: ${llmErr.message}`);
    }

    // Save correction log
    const correctionLog = await base44.asServiceRole.entities.ExtractionCorrectionLog.create({
      insurer: insurer || 'Unbekannt',
      document_type: document_type || 'Unbekannt',
      file_name: file_name || '',
      file_url: file_url || '',
      original_extraction,
      corrected_values: correctedValues,
      field_corrections: corrections,
      error_categories: errorCategories,
      correction_count: corrections.length,
      ai_analysis: aiAnalysis,
      patterns_extracted: patternsExtracted,
      corrected_by_user_id: user.id,
      corrected_by_email: user.email,
      reviewed: false,
    });

    // Update or create InsuranceKnowledgePattern records
    const patternsUpdated = [];
    for (const pattern of patternsExtracted) {
      if (!pattern.signal || !pattern.maps_to) continue;

      // Look for existing pattern
      const existing = await base44.asServiceRole.entities.InsuranceKnowledgePattern.filter({
        insurer: insurer || 'Unbekannt',
        signal: pattern.signal,
        maps_to: pattern.maps_to,
        is_active: true,
      });

      if (existing.length > 0) {
        // Update correction_count
        const p = existing[0];
        const sourceIds = [...(p.source_correction_ids || []), correctionLog.id];
        await base44.asServiceRole.entities.InsuranceKnowledgePattern.update(p.id, {
          correction_count: (p.correction_count || 1) + 1,
          last_confirmed_date: new Date().toISOString().split('T')[0],
          source_correction_ids: sourceIds,
          confidence_boost: Math.min((p.confidence_boost || 0.10) + 0.02, 0.30),
        });
        patternsUpdated.push({ action: 'updated', signal: pattern.signal, maps_to: pattern.maps_to });
      } else {
        // Create new pattern
        await base44.asServiceRole.entities.InsuranceKnowledgePattern.create({
          insurer: insurer || 'Unbekannt',
          document_type: document_type || 'Unbekannt',
          pattern_type: pattern.maps_to === 'policy_holder_name' || pattern.maps_to === 'first_name' ? 'role_mapping' : 'field_signal',
          signal: pattern.signal,
          maps_to: pattern.maps_to,
          maps_to_value: pattern.maps_to_value || null,
          confidence_boost: pattern.confidence_boost || 0.12,
          correction_count: 1,
          first_seen_date: new Date().toISOString().split('T')[0],
          last_confirmed_date: new Date().toISOString().split('T')[0],
          description: pattern.description || '',
          source_correction_ids: [correctionLog.id],
          is_active: true,
          validated_by_admin: false,
        });
        patternsUpdated.push({ action: 'created', signal: pattern.signal, maps_to: pattern.maps_to });
      }
    }

    console.log(`[learnFromCorrection] Done: ${corrections.length} corrections, ${patternsUpdated.length} patterns updated`);

    return Response.json({
      success: true,
      correction_log_id: correctionLog.id,
      correction_count: corrections.length,
      error_categories: errorCategories,
      ai_analysis: aiAnalysis,
      patterns_updated: patternsUpdated,
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[learnFromCorrection] ERROR: ${msg}`);
    return Response.json({ error: msg }, { status: 500 });
  }
});