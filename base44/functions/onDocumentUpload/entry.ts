import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * ON DOCUMENT UPLOAD — Entity Automation (Document.create)
 *
 * ENTERPRISE: Nur Klassifizierung + Logging.
 * KEINE automatische Kundenzuweisung oder Antrags-/Vertragserstellung.
 * Die Kundenzuweisung erfolgt manuell nach KI-Analyse im SmartDocumentReview-Wizard.
 *
 * Aufgaben:
 * 1. Dokumenttyp klassifizieren
 * 2. Dokument-Metadaten aktualisieren
 * 3. Systemlog schreiben
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const payload = await req.json();
    const documentId = payload?.event?.entity_id || payload?.data?.id;
    const docData = payload?.data;

    if (!documentId || !docData?.file_url) {
      return Response.json({ skipped: true, reason: 'No document_id or file_url' });
    }

    // Nur neue Dokumente (stage: uploaded)
    if (docData.processing_stage && docData.processing_stage !== 'uploaded') {
      return Response.json({ skipped: true, reason: `Already processed: ${docData.processing_stage}` });
    }

    console.log(`[onDocumentUpload] START doc=${documentId} file=${docData.name}`);

    // ── STEP 1: KI-Schnellklassifizierung (nur Kategorie, keine Kundenzuweisung) ──
    let classification = null;
    try {
      classification = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Klassifiziere dieses Versicherungsdokument.

DATEINAME: "${docData.name || 'unbekannt'}"

Erkenne NUR:
1. document_category: Einer von: "neuantrag", "aenderungsantrag", "erneuerungsantrag", "police", "kuendigung", "rechnung", "schadensmeldung", "gesundheitsdeklaration", "vollmacht", "mahnung", "offerte", "korrespondenz"
2. confidence: Konfidenz 0.0–1.0
3. summary: Kurze Beschreibung (max. 100 Zeichen)

Antworte NUR mit JSON.`,
        file_urls: [docData.file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            document_category: { type: 'string' },
            confidence: { type: 'number' },
            summary: { type: 'string' },
          },
          required: ['document_category', 'confidence']
        },
        model: 'gemini_3_flash'
      });
    } catch (aiErr) {
      console.warn(`[onDocumentUpload] KI-Klassifizierung fehlgeschlagen: ${aiErr.message}`);
    }

    const category = classification?.document_category || 'korrespondenz';
    const confidence = classification?.confidence || 0;

    // ── STEP 2: Dokument-Metadaten aktualisieren ─────────────────────────────
    const categoryToDocCategory = {
      neuantrag:          'application',
      aenderungsantrag:   'application',
      erneuerungsantrag:  'application',
      police:             'contract',
      kuendigung:         'correspondence',
      rechnung:           'invoice',
      schadensmeldung:    'claim',
      gesundheitsdeklaration: 'other',
      vollmacht:          'other',
      mahnung:            'correspondence',
      offerte:            'application',
      korrespondenz:      'correspondence',
    };

    const isAntrag = ['neuantrag', 'aenderungsantrag', 'erneuerungsantrag', 'offerte'].includes(category);
    const classificationStatus = confidence >= 0.80 ? 'klassifiziert' : 'pruefung_erforderlich';

    // Nur updaten wenn noch keine customer_id gesetzt (d.h. noch nicht manuell verarbeitet)
    if (!docData.customer_id) {
      await base44.asServiceRole.entities.Document.update(documentId, {
        doc_type: isAntrag ? 'antrag' : 'anlage',
        category: categoryToDocCategory[category] || 'other',
        classification_status: classificationStatus,
        classification_confidence: confidence,
        classification_reason: classification?.summary || `Automatisch klassifiziert: ${category}`,
        processing_stage: 'parsed',
      });
    }

    // ── STEP 3: Systemlog ────────────────────────────────────────────────────
    await base44.asServiceRole.entities.SystemLog.create({
      level: classificationStatus === 'klassifiziert' ? 'info' : 'warn',
      source: 'onDocumentUpload',
      message: `${docData.name || documentId} → ${category} (${Math.round(confidence * 100)}%) | Wartet auf manuelle Kundenzuweisung`,
      related_entity_type: 'Document',
      related_entity_id: documentId,
    });

    return Response.json({
      success: true,
      document_id: documentId,
      category,
      confidence,
      classification_status: classificationStatus,
      note: 'Kundenzuweisung erfolgt manuell über SmartDocumentReview-Wizard',
    });

  } catch (error) {
    console.error(`[onDocumentUpload] ERROR: ${error.message}`);
    try {
      await base44.asServiceRole.entities.SystemLog.create({
        level: 'error',
        source: 'onDocumentUpload',
        message: `Fehler: ${error.message}`,
      });
    } catch {}
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});