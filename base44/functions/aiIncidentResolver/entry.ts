/**
 * aiIncidentResolver — KI-gestützte Incident-Analyse mit Lösungsvorschlag
 * Admin bestätigt oder lehnt den Vorschlag ab. Kein Auto-Fix.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Nur Admins dürfen KI-Vorschläge anfordern.' }, { status: 403 });
    }

    const { incident_id } = await req.json();
    if (!incident_id) return Response.json({ error: 'incident_id fehlt' }, { status: 400 });

    const incident = await base44.asServiceRole.entities.EnterpriseIncident.get(incident_id);
    if (!incident) return Response.json({ error: 'Incident nicht gefunden' }, { status: 404 });

    const prompt = `
Du bist ein Enterprise-Governance-Experte für Versicherungsmakler-Software.
Analysiere diesen Incident und erstelle einen konkreten, umsetzbaren Lösungsvorschlag.

INCIDENT:
- Titel: ${incident.title}
- Beschreibung: ${incident.description}
- Schweregrad: ${incident.severity}
- Kategorie: ${incident.category}
- Root Cause: ${incident.root_cause || 'nicht bekannt'}
- Technische Details: ${incident.technical_details || 'keine'}
- Aktueller Status: ${incident.status}
- Governance-Block: ${incident.governance_block ? 'Ja' : 'Nein'}
- Empfohlene Aktion (System): ${incident.recommended_action || 'keine'}

Erstelle einen strukturierten Lösungsvorschlag auf Deutsch.
Der Vorschlag muss realistisch und für einen Admin umsetzbar sein.
Bei Governance-Blocks: NUR manuelle Schritte vorschlagen, KEIN automatischer Fix.

Antworte NUR mit diesem JSON-Objekt:
{
  "zusammenfassung": "1-2 Sätze: Was ist das Problem und wie wird es gelöst?",
  "ursache": "Kurze Erklärung der Ursache (max. 1 Satz)",
  "schritte": ["Schritt 1", "Schritt 2", "Schritt 3"],
  "empfohlener_status": "resolved | accepted_risk | in_review",
  "risiko": "low | medium | high",
  "begruendung": "Warum dieser Status-Vorschlag?",
  "manuelle_aktion_noetig": true | false
}`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          zusammenfassung: { type: 'string' },
          ursache: { type: 'string' },
          schritte: { type: 'array', items: { type: 'string' } },
          empfohlener_status: { type: 'string' },
          risiko: { type: 'string' },
          begruendung: { type: 'string' },
          manuelle_aktion_noetig: { type: 'boolean' },
        },
      },
    });

    return Response.json({ proposal: result, incident_id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});