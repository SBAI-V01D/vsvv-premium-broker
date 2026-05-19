/**
 * aiCorrectionLogger.js — Phase C
 *
 * Anonymisiertes Logging von KI-Korrekturen.
 * Zweck: Datenqualität messen, häufige Fehler erkennen, Muster analysieren.
 *
 * Datenschutz-Regeln:
 *   - Keine Personennamen gespeichert
 *   - Keine Kundendaten gespeichert
 *   - Nur Feldname + Original-KI-Wert + korrigierter Wert + Gesellschaft
 *   - Gesellschaft als anonymes Label (für "problematische PDFs"-Analyse)
 *
 * Wird nur aufgerufen wenn:
 *   1. KI hat einen Wert extrahiert (nicht null)
 *   2. Benutzer hat diesen Wert geändert
 *   → Das ist eine echte Korrektur
 */

import { base44 } from '@/api/base44Client';

/**
 * Vergleicht original KI-Extraktion mit final bestätigten Werten.
 * Gibt eine Liste von Korrekturen zurück.
 *
 * @param {object} original - Rohes KI-Extrakt (aus analyzeMutation)
 * @param {object} edited   - Vom Benutzer bestätigte Version
 * @returns {Array<{field, ai_value, corrected_value, gesellschaft, section}>}
 */
export function detectCorrections(original, edited) {
  const TRACKED_FIELDS = [
    'gesellschaft', 'product_name', 'praemie_monatlich',
    'franchise', 'modell', 'deckung_details', 'section', 'person_name',
  ];

  const corrections = [];
  for (const field of TRACKED_FIELDS) {
    const aiVal  = original[field];
    const newVal = edited[field];

    // Nur wenn KI etwas extrahiert hat UND Benutzer es geändert hat
    if (aiVal != null && aiVal !== '' && String(aiVal) !== String(newVal ?? '')) {
      corrections.push({
        field,
        ai_value:        String(aiVal),
        corrected_value: String(newVal ?? ''),
        gesellschaft:    edited.gesellschaft || original.gesellschaft || 'unbekannt',
        section:         edited.section     || original.section      || 'unbekannt',
        ai_confidence:   original.confidence?.[field] ?? null,
      });
    }
  }
  return corrections;
}

/**
 * Loggt Korrekturen als SystemLog-Einträge.
 * Feuert-und-vergisst (kein await nötig, kein Error-Bubbling).
 *
 * @param {Array} corrections - Aus detectCorrections()
 * @param {string} sourceDocument - Dateiname (anonymisiert, kein Pfad)
 * @param {number} productCount - Anzahl extrahierter Produkte
 */
export function logCorrections(corrections, sourceDocument, productCount) {
  if (!corrections || corrections.length === 0) return;

  const payload = {
    total_corrections: corrections.length,
    product_count: productCount,
    source_document_type: sourceDocument?.split('.').pop()?.toLowerCase() || 'unbekannt',
    corrections: corrections.map(c => ({
      field:           c.field,
      ai_value:        c.ai_value,
      corrected_value: c.corrected_value,
      gesellschaft:    c.gesellschaft,
      section:         c.section,
      ai_confidence:   c.ai_confidence,
    })),
  };

  // Async, fire-and-forget
  base44.entities.SystemLog.create({
    level:               'info',
    source:              'ki_extraktion_korrektur',
    message:             `KI-Korrektur: ${corrections.length} Feld(er) geändert (${productCount} Produkte)`,
    details:             JSON.stringify(payload),
    related_entity_type: 'ComparisonEntry',
  }).catch(() => {}); // Stille Fehler — Logging darf nie den Hauptfluss blockieren
}

/**
 * Berechnet eine Session-Qualitätszahl (0–100).
 * 100 = keine Korrekturen nötig (hohe Konfidenz, kein Edit).
 * 0   = alles falsch.
 *
 * @param {Array} products        - Extrahierte Session-Produkte
 * @param {Array} corrections     - Erkannte Korrekturen
 * @returns {number} 0–100
 */
export function sessionQualityScore(products, corrections) {
  if (!products || products.length === 0) return 0;

  const allConfs = products.flatMap(p =>
    Object.values(p.confidence || {}).filter(v => v != null)
  );
  const avgConf = allConfs.length > 0
    ? allConfs.reduce((a, b) => a + b, 0) / allConfs.length
    : 0.5;

  const totalFields  = products.length * 6; // ~6 relevante Felder pro Produkt
  const corrRatio    = totalFields > 0 ? corrections.length / totalFields : 0;
  const corrPenalty  = Math.min(corrRatio * 50, 40); // max -40 Punkte für Korrekturen

  return Math.max(0, Math.round(avgConf * 100 - corrPenalty));
}