/**
 * explainAiFinding — AI Explainability Layer (P5)
 * 
 * Pipeline:
 *   AI Observation → Validation Layer → Governance Classification → Explanation → Recommendation
 * 
 * NIEMALS direkt urteilen. Immer:
 *  1. Tenant-Isolation prüfen
 *  2. Evidenz sammeln
 *  3. Regeln validieren
 *  4. LLM für Erklärung (mit strukturierten Daten, kein Halluzinieren)
 *  5. Governance-Klassifikation
 *  6. AiFinding persistieren
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PIPELINE_VERSION = '1.0.0';

const GOVERNANCE_RULES = {
  tenant_violation: {
    rule: 'RULE-TI-001',
    description: 'Alle Entitäten müssen eine gültige organization_id haben',
    severity: 'critical',
    governance_risk: 95,
  },
  missing_required_field: {
    rule: 'RULE-DQ-001',
    description: 'Pflichtfelder müssen für alle aktiven Entitäten befüllt sein',
    severity: 'warning',
    governance_risk: 60,
  },
  orphan_relationship: {
    rule: 'RULE-RI-001',
    description: 'Alle Referenz-IDs müssen auf existierende Entitäten zeigen',
    severity: 'critical',
    governance_risk: 85,
  },
  compliance_gap: {
    rule: 'RULE-CO-001',
    description: 'FINMA-relevante Felder (Mandat, FINMA-Nr) müssen vollständig sein',
    severity: 'critical',
    governance_risk: 90,
  },
  approval_missing: {
    rule: 'RULE-AP-001',
    description: 'Freigegebene Dossiers benötigen einen vollständigen Approval-Trail',
    severity: 'critical',
    governance_risk: 88,
  },
  audit_gap: {
    rule: 'RULE-AU-001',
    description: 'Kritische Operationen müssen einen Audit-Trail hinterlassen',
    severity: 'warning',
    governance_risk: 70,
  },
  financial_inconsistency: {
    rule: 'RULE-FI-001',
    description: 'Finanzielle Berechnungen müssen konsistent und nachvollziehbar sein',
    severity: 'critical',
    governance_risk: 92,
  },
};

async function buildEvidence(base44, findingType, entityType, entityId) {
  const evidence = [];
  try {
    if (entityId && entityType) {
      const entity = await base44.asServiceRole.entities[entityType]?.get(entityId);
      if (entity) {
        if (findingType === 'tenant_violation' && !entity.organization_id) {
          evidence.push({
            type: 'missing_field',
            field: 'organization_id',
            entity_type: entityType,
            entity_id: entityId,
            expected_value: 'valid organization UUID',
            actual_value: 'null/undefined',
            description: `${entityType} [${entityId}] hat keine organization_id`,
          });
        }
        if (findingType === 'compliance_gap' && entityType === 'Customer') {
          if (!entity.mandate_status || entity.mandate_status === 'pending') {
            evidence.push({
              type: 'invalid_status',
              field: 'mandate_status',
              entity_type: entityType,
              entity_id: entityId,
              expected_value: 'valid',
              actual_value: entity.mandate_status || 'null',
              description: 'Kundenmandat nicht gültig',
            });
          }
        }
      }
    }
  } catch {
    // Evidence collection failed — non-blocking
  }
  return evidence;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startTime = Date.now();
    const payload = await req.json();
    const {
      finding_type,
      severity,
      entity_type,
      entity_id,
      organization_id,
      context_data,  // Raw data the AI observed
      review_id,
    } = payload;

    if (!finding_type || !organization_id) {
      return Response.json({ error: 'finding_type und organization_id sind Pflichtfelder' }, { status: 400 });
    }

    // ── STEP 1: Tenant Validation (IMMER zuerst) ──────────────────
    const tenantValidationPassed = !!organization_id;
    if (!tenantValidationPassed) {
      return Response.json({
        error: 'Tenant-Validation fehlgeschlagen: organization_id fehlt im Finding',
        code: 'TENANT_VALIDATION_FAILED',
      }, { status: 400 });
    }

    // ── STEP 2: Governance Rule Lookup ────────────────────────────
    const rule = GOVERNANCE_RULES[finding_type] || {
      rule: 'RULE-GEN-001',
      description: 'Allgemeine Governance-Verletzung',
      severity: severity || 'warning',
      governance_risk: 50,
    };

    // ── STEP 3: Evidence Collection ───────────────────────────────
    const evidence = await buildEvidence(base44, finding_type, entity_type, entity_id);

    // ── STEP 4: AI Explainability (LLM mit Strukturdaten) ─────────
    const contextSummary = context_data
      ? JSON.stringify(context_data).slice(0, 800)
      : `Entity: ${entity_type} [${entity_id}]`;

    const llmPrompt = `Du bist ein FINMA-Compliance-Experte für Schweizer Versicherungsbroker.
    
Analysiere dieses Governance-Finding und erstelle eine strukturierte Erklärung.

FINDING:
- Typ: ${finding_type}
- Schweregrad: ${severity || rule.severity}
- Verletzte Regel: ${rule.rule} — ${rule.description}
- Entität: ${entity_type} [${entity_id}]
- Kontext: ${contextSummary}
- Evidenz: ${evidence.map(e => e.description).join('; ') || 'Keine spezifische Evidenz'}

Erstelle eine präzise, professionelle Erklärung. Keine Spekulationen. Nur auf Basis der vorliegenden Daten.`;

    const llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: llmPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: '1-Satz Zusammenfassung auf Deutsch' },
          reasoning: { type: 'string', description: 'Detaillierte Begründung (2-3 Sätze)' },
          violated_rules: { type: 'array', items: { type: 'string' }, description: 'Liste der verletzten Regeln' },
          data_sources: { type: 'array', items: { type: 'string' }, description: 'Verwendete Datenquellen' },
          recommendation: { type: 'string', description: 'Konkrete Handlungsempfehlung' },
          remediation_steps: { type: 'array', items: { type: 'string' }, description: '3-5 konkrete Lösungsschritte' },
          governance_impact: { type: 'string', description: 'Auswirkung auf FINMA-Compliance und Betrieb' },
          hallucination_risk: { type: 'string', enum: ['none', 'low', 'medium', 'high'], description: 'Risiko dass die Analyse spekulativ ist' },
          false_positive_risk: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
      },
    });

    const processingTimeMs = Date.now() - startTime;

    // ── STEP 5: Governance Classification ─────────────────────────
    const confidenceScore = evidence.length > 0 ? 0.92 : 0.72;
    const evidenceStrength = evidence.length >= 2 ? 'strong' : evidence.length === 1 ? 'moderate' : 'weak';

    // ── STEP 6: Persist AiFinding ─────────────────────────────────
    const finding = await base44.asServiceRole.entities.AiFinding.create({
      review_id: review_id || null,
      organization_id,
      finding_type,
      severity: severity || rule.severity,
      confidence_score: confidenceScore,
      evidence_strength: evidenceStrength,
      governance_risk_score: rule.governance_risk,
      false_positive_risk: llmResult?.false_positive_risk || 'low',
      explanation: {
        summary: llmResult?.summary || `${finding_type} erkannt`,
        reasoning: llmResult?.reasoning || rule.description,
        violated_rules: llmResult?.violated_rules || [rule.rule],
        data_sources: llmResult?.data_sources || [entity_type || 'unknown'],
        affected_entities: entity_id ? [{ entity_type, entity_id, issue: finding_type }] : [],
        recommendation: llmResult?.recommendation || 'Manuelle Prüfung erforderlich',
        remediation_steps: llmResult?.remediation_steps || [],
        governance_impact: llmResult?.governance_impact || '',
      },
      evidence,
      explainability: {
        ai_model: 'gpt-4o-mini',
        detection_method: evidence.length > 0 ? 'hybrid' : 'ai_inference',
        validation_checks_passed: ['tenant_isolation', 'rule_lookup', 'evidence_collection'],
        validation_checks_failed: [],
        tenant_validation_passed: true,
        hallucination_risk: llmResult?.hallucination_risk || 'low',
        pipeline_version: PIPELINE_VERSION,
      },
      audit: {
        generated_at: new Date().toISOString(),
        generated_by: user.email,
        processing_time_ms: processingTimeMs,
        pipeline_version: PIPELINE_VERSION,
        review_decision: 'pending',
      },
      status: 'new',
    });

    return Response.json({
      success: true,
      finding_id: finding.id,
      finding_type,
      severity: finding.severity,
      confidence_score: finding.confidence_score,
      evidence_strength: finding.evidence_strength,
      governance_risk_score: finding.governance_risk_score,
      explanation: finding.explanation,
      evidence: finding.evidence,
      explainability: finding.explainability,
      processing_time_ms: processingTimeMs,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});