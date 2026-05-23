/**
 * generateEnterpriseImprovements — KI-gestützte Verbesserungsvorschläge
 * 
 * ANALYSIERT Enterprise Audit Results und generiert:
 * 1. Automatisierte KI-Verbesserungsvorschläge pro Issue
 * 2. Konkrete Implementierungs-Schritte
 * 3. Impact-Abschätzung (Performance, UX, Compliance)
 * 4. Freigabe-Workflow (Vorschlag → Review → Approved → Implemented)
 * 
 * PRINZIPIEN:
 * - KEINE autonomen Änderungen
 * - JEDER Vorschlag muss vom User freigegeben werden
 * - Impact muss messbar sein (vorher/nachher)
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin required' }, { status: 401 });
    }

    const body = await req.json();
    const { audit_result } = body;

    if (!audit_result) {
      return Response.json({ error: 'Audit result required' }, { status: 400 });
    }

    // ── KI-ANALYSE: Verbesserungsvorschläge generieren ─────────────────────
    const prompt = `Du bist Enterprise Architecture KI für Swiss Insurance Broker.

AUDIT RESULTS:
${JSON.stringify(audit_result, null, 2)}

AUFGABE:
Generiere konkrete, umsetzbare Verbesserungsvorschläge für JEDES Issue (critical + warning).

STRUKTUR PRO VORSCHLAG:
{
  "id": "IMP-001",
  "title": "Kurzer, prägnanter Titel",
  "priority": "critical|high|medium|low",
  "area": "performance|relationship_integrity|ai_quality|query_governance|design|mobile|workflow",
  "current_state": "Was ist das Problem? (konkret, mit Zahlen)",
  "target_state": "Was soll erreicht werden? (messbar)",
  "ki_recommendation": "Konkrete KI-Empfehlung (Schritt-für-Schritt)",
  "implementation_steps": [
    "Schritt 1: ...",
    "Schritt 2: ...",
    "Schritt 3: ..."
  ],
  "estimated_impact": {
    "performance_improvement_percent": 30,
    "ux_improvement": "Weniger Klicks, bessere Übersicht",
    "compliance_benefit": "Vollständige Auditierbarkeit",
    "effort_level": "low|medium|high",
    "estimated_hours": 4
  },
  "affected_entities": ["Customer", "Contract"],
  "affected_pages": ["/kunden", "/vertraege"],
  "success_metrics": {
    "metric": "Customer Query Time",
    "before_ms": 650,
    "target_ms": 300,
    "how_to_measure": "Enterprise Audit → Performance Section"
  },
  "risks": ["Mögliche Regressionen"],
  "rollback_plan": "Wie zurückrollen?"
}

ANTWORTE ALS JSON ARRAY mit allen Vorschlägen.
Sortiert nach priority (critical > high > medium > low).`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          improvements: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
                area: { type: 'string' },
                current_state: { type: 'string' },
                target_state: { type: 'string' },
                ki_recommendation: { type: 'string' },
                implementation_steps: { type: 'array', items: { type: 'string' } },
                estimated_impact: {
                  type: 'object',
                  properties: {
                    performance_improvement_percent: { type: 'number' },
                    ux_improvement: { type: 'string' },
                    compliance_benefit: { type: 'string' },
                    effort_level: { type: 'string', enum: ['low', 'medium', 'high'] },
                    estimated_hours: { type: 'number' },
                  },
                },
                affected_entities: { type: 'array', items: { type: 'string' } },
                affected_pages: { type: 'array', items: { type: 'string' } },
                success_metrics: {
                  type: 'object',
                  properties: {
                    metric: { type: 'string' },
                    before_ms: { type: 'number' },
                    target_ms: { type: 'number' },
                    how_to_measure: { type: 'string' },
                  },
                },
                risks: { type: 'array', items: { type: 'string' } },
                rollback_plan: { type: 'string' },
              },
            },
          },
          generated_at: { type: 'string' },
          generated_by: { type: 'string' },
        },
      },
    });

    // ── IMPROVEMENTS speichern ─────────────────────────────────────────────
    const improvementsWithMeta = result.improvements.map(imp => ({
      ...imp,
      audit_id: audit_result.summary?.audit_id || `AUDIT-${Date.now()}`,
      status: 'proposed', // proposed → approved → in_progress → implemented → verified
      proposed_by: user.full_name || user.email,
      proposed_at: new Date().toISOString(),
      approved_by: null,
      approved_at: null,
      implemented_at: null,
      verified_at: null,
      actual_impact: null, // Wird nach Implementation gemessen
    }));

    // Improvement Records erstellen
    const createdImprovements = [];
    for (const imp of improvementsWithMeta) {
      const record = await base44.entities.EnterpriseImprovement.create(imp);
      createdImprovements.push(record);
    }

    return Response.json({
      improvements: createdImprovements,
      total_count: createdImprovements.length,
      critical_count: createdImprovements.filter(i => i.priority === 'critical').length,
      high_count: createdImprovements.filter(i => i.priority === 'high').length,
      generated_at: result.generated_at,
      generated_by: result.generated_by,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});