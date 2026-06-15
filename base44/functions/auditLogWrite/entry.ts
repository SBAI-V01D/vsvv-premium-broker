import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * CENTRAL AUDIT LOG v1.0 — Enterprise Audit Infrastructure
 * 
 * Schema v1.0 (frozen) — 10 Core-Bereiche + 7 Enterprise-Ergänzungen
 * 
 * Verwendung:
 * 1. Entity-Changes mit Lifecycle-Tracking
 * 2. Automation-Triggers mit Correlation-IDs
 * 3. Guard-Hits mit Decision-Codes
 * 4. Process-Transitions mit State-Snapshots
 * 5. Business-Impact (CHF, Compliance)
 * 
 * ASYNC / NON-BLOCKING:
 * - Audit darf NICHT Hauptprozess blockieren
 * - Fire-and-Forget bei Fehlern
 * - Business-Logik läuft immer weiter
 */
Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Auth optional für Scheduler/Automationen
    const actor = user || { email: 'system', full_name: 'System' };

    const rawBody = await req.json();

    // === ENTITY AUTOMATION ADAPTER ===
    // Entity-Automations liefern: { event: {type, entity_name, entity_id}, data, old_data, changed_fields }
    // Direkte API-Aufrufe liefern: { entity_type, entity_id, action, ... }
    let body = rawBody;
    if (rawBody.event && rawBody.event.entity_name) {
      const ev = rawBody.event;
      const newData  = rawBody.data || {};
      const oldData  = rawBody.old_data || {};
      // Felder berechnen die sich geändert haben
      const autoChangedFields = rawBody.changed_fields ||
        Object.keys(newData).filter(k => JSON.stringify(newData[k]) !== JSON.stringify(oldData[k]));
      body = {
        entity_type:    ev.entity_name,
        entity_id:      ev.entity_id,
        action:         ev.type,
        event_type:     ev.type,
        trigger_type:   'automation',
        trigger_source: 'entity_automation',
        actor_type:     'automation',
        new_values:     newData,
        old_values:     oldData,
        changed_fields: autoChangedFields,
        // Tenant aus Entity-Daten extrahieren
        tenant_id:      newData.organization_id || oldData.organization_id || null,
        // Approval-Metadaten falls vorhanden
        approval_metadata: (newData.approved_at || newData.approved_by) ? {
          approved_by:   newData.approved_by || null,
          approved_at:   newData.approved_at || null,
          approved_by_id:newData.approved_by_user_id || null,
        } : undefined,
      };
    }

    // === CORE FIELDS (Required) ===
    const {
      entity_type,
      entity_id,
      action,
      trigger_type,
      trigger_source,
      process_id,
      process_type,
      process_stage,
      event_type,
      correlation_id,
    } = body;

    // Governance-Erweiterungen v1.1
    const tenant_id      = body.tenant_id || null;
    const changed_fields = body.changed_fields || [];
    const approval_metadata = body.approval_metadata || null;

    // === ACTOR (Human vs System) ===
    const actor_type = body.actor_type || (user ? 'user' : 'automation');
    const actor_id = body.actor_id || actor.email;
    const actor_name = body.actor_name || actor.full_name || trigger_source;

    // === DECISION ENGINE ===
    const guard_evaluated = body.guard_evaluated;
    const guard_result = body.guard_result; // allowed|blocked|skipped|error
    const guard_reason = body.guard_reason;
    
    let decision_code = body.decision_code;
    let decision_logic = body.decision_logic;
    
    // Decision-Code generieren falls nicht vorhanden
    if (!decision_code && guard_evaluated) {
      const reasonShort = (guard_reason || 'evaluated').split(' ').slice(0, 3).join('_').toUpperCase();
      decision_code = `${entity_type || 'GUARD'}_${guard_result.toUpperCase()}_${reasonShort}`;
      decision_logic = `Guard '${guard_evaluated}' evaluated: ${guard_reason || 'No reason provided'}`;
    }

    // === AUDIT LEVEL (1-4) ===
    const financialImpact = body.business_impact_financial_chf || 0;
    let audit_level = body.audit_level || 2;
    let audit_level_name = body.audit_level_name || 'lifecycle_transition';
    
    // Audit-Level bestimmen
    if (event_type?.includes('storno') || event_type?.includes('duplicate') || financialImpact >= 1000) {
      audit_level = 1;
      audit_level_name = 'critical_business';
    } else if (event_type?.includes('created') || event_type?.includes('approved') || event_type?.includes('cancelled')) {
      audit_level = 2;
      audit_level_name = 'lifecycle_transition';
    } else if (guard_result === 'blocked' || guard_result === 'allowed') {
      audit_level = 3;
      audit_level_name = 'guard_decision';
    } else {
      audit_level = 4;
      audit_level_name = 'debug_verbose';
    }

    // === BUSINESS SEVERITY ===
    let business_severity_type = body.business_severity_type || 'operational';
    let business_severity_level = body.business_severity_level || 'low';
    
    if (financialImpact >= 5000 || body.is_compliance_relevant) {
      business_severity_type = 'financial';
      business_severity_level = 'critical';
    } else if (financialImpact >= 1000 || event_type?.includes('customer')) {
      business_severity_type = 'customer_impact';
      business_severity_level = 'high';
    }

    // === STATE SNAPSHOTS (Light) ===
    const old_values = body.old_values || {};
    const new_values = body.new_values || {};
    const previous_state_summary = body.previous_state_summary || old_values;
    const new_state_summary = body.new_state_summary || new_values;

    // === SIDE EFFECTS ===
    const side_effects = body.side_effects || [];

    // === BUSINESS IMPACT ===
    const business_impact_financial_chf = financialImpact;
    const business_impact_description = body.business_impact_description || '';

    // === RETRY / RECOVERY ===
    const retry_attempt = body.retry_attempt || 0;
    const retry_of_event_id = body.retry_of_event_id || null;
    const recovered = body.recovered || false;
    const recovery_strategy = body.recovery_strategy || null;
    const original_error = body.original_error || null;

    // === ANOMALY PREP ===
    const anomaly_detected = body.anomaly_detected || false;
    const anomaly_type = body.anomaly_type || null;
    const anomaly_score = body.anomaly_score || null;

    // === RELATED ENTITIES ===
    const related_entities = body.related_entities || [];

    // === METADATA ===
    const ip_address = body.ip_address || null;
    const error_message = body.error_message || null;
    const metadata = body.metadata || {};

    // === GENERATE IDS (if not provided) ===
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    const entitySuffix = entity_id ? entity_id.slice(-3).toUpperCase() : '000';
    
    const audit_id = body.audit_id || `AUD-${date}-${random}`;
    const event_id = body.event_id || `EVT-${date}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    const event_sequence = body.event_sequence || 1;
    
    const processTypeShort = (process_type || 'unknown').slice(0, 3).toUpperCase();
    const final_correlation_id = correlation_id || `${processTypeShort}-${date}-${entitySuffix}${random}`;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    const final_process_id = process_id || `${process_type || 'unknown'}_${entity_id || 'none'}_${timestamp}`;

    // === AUDIT ENTRY v1.0 ===
    const auditEntry = {
      // Core Identification
      audit_schema_version: '1.0',
      audit_id,
      audit_level,
      audit_level_name,
      timestamp: new Date().toISOString(),
      
      // Trigger
      trigger_type: trigger_type || 'manual',
      trigger_source: trigger_source || 'unknown',
      
      // Actor
      actor_type,
      actor_id,
      actor_name,
      
      // Process Context
      process_id: final_process_id,
      process_type: process_type || 'unknown',
      process_stage: process_stage || '',
      
      // Event
      event_id,
      event_type: event_type || action,
      event_sequence,
      
      // Entity
      entity_type: entity_type || 'system',
      entity_id: entity_id || null,
      action: action || 'update',
      
      // Decision Engine
      decision_code: decision_code || null,
      decision_logic: decision_logic || null,
      
      // Guard
      guard_evaluated: guard_evaluated || null,
      guard_result: guard_result || null,
      guard_reason: guard_reason || null,
      
      // Severity
      business_severity_type,
      business_severity_level,
      technical_severity_type: body.technical_severity_type || (error_message ? 'error' : 'info'),
      technical_severity_level: body.technical_severity_level || (error_message ? 'high' : 'low'),
      
      // State Snapshots
      previous_state_summary,
      new_state_summary,
      
      // Side Effects
      side_effects,
      
      // Business Impact
      business_impact_financial_chf,
      business_impact_description,
      
      // Retry/Recovery
      retry_attempt,
      retry_of_event_id,
      recovered,
      recovery_strategy,
      original_error,
      
      // Anomaly Prep
      anomaly_detected,
      anomaly_type,
      anomaly_score,
      
      // Correlation
      correlation_id: final_correlation_id,
      related_entities,
      
      // Metadata
      ip_address,
      duration_ms: Date.now() - startTime,
      error_message,
      metadata,

      // === GOVERNANCE EXTENSIONS v1.1 ===
      tenant_id,
      changed_fields,
      approval_metadata,
      change_source: body.change_source || actor_type,
    };

    // === ASYNC WRITE (Non-Blocking) ===
    try {
      await base44.entities.AuditLog.create(auditEntry);
      console.log(`[AUDIT v1.0] Logged: ${audit_id} (${event_type})`);
    } catch (err) {
      // CRITICAL: Audit-Fehler darf NICHT Hauptprozess beeinflussen!
      console.error('[AUDIT v1.0] Write failed (non-blocking):', err.message);
      // Fire-and-Forget — kein Throw!
    }

    return Response.json({ 
      success: true, 
      logged: true, 
      audit_id,
      correlation_id: final_correlation_id,
    });

  } catch (error) {
    console.error('[AUDIT v1.0 WRITE ERROR]', error);
    // NICHT throwen — Audit ist passiv!
    return Response.json({ 
      success: false, 
      error: error.message,
      audit_failed: true,
    }, { status: 500 });
  }
});