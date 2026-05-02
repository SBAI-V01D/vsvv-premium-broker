import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Analysiere dieses Dokument und klassifiziere es:

Prüfe ob es sich um einen VERSICHERUNGSANTRAG handelt. Kriterien für einen Antrag:
- Enthält Schlüsselwörter: "Antrag", "Versicherungsantrag", "Offerte unterschrieben", "Proposal", "Antragsformular", "Antragsteller"
- Hat typische Antragsstruktur: Kundendatenfelder, Versicherungsoptionen, Unterschrift/Datum
- Formularcharakter mit auszufüllenden Feldern
- Ist ein Neuabschluss oder eine Offerte zur Unterschrift

KEIN Antrag (= Anlage) sind: Policen/Verträge, Rechnungen, Ausweise, Korrespondenz, Abrechnungen, Kündigungsschreiben, Schadenmeldungen, Gesundheitsfragebögen ohne Antragsformular.

Gib zurück:
- document_type: "antrag" oder "anlage"
- confidence: Zahl zwischen 0 und 1 (wie sicher bist du?)
- reason: kurze Begründung auf Deutsch (max. 1 Satz)
- insurer: Versicherungsgesellschaft falls erkennbar, sonst null
- insurance_type: Versicherungsart falls erkennbar (KVG, VVG, Leben, etc.), sonst null

Dateiname als Kontext: "${file_name || ''}"`,
      file_urls: [file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          document_type: { type: 'string', enum: ['antrag', 'anlage'] },
          confidence: { type: 'number' },
          reason: { type: 'string' },
          insurer: { type: ['string', 'null'] },
          insurance_type: { type: ['string', 'null'] }
        },
        required: ['document_type', 'confidence', 'reason']
      },
      model: 'gemini_3_flash'
    });

    const confidence = result.confidence || 0;
    let status = 'klassifiziert';
    if (confidence < 0.85) {
      status = 'pruefung_erforderlich';
    }

    return Response.json({
      success: true,
      document_type: result.document_type,
      confidence,
      status,
      reason: result.reason,
      insurer: result.insurer || null,
      insurance_type: result.insurance_type || null,
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});