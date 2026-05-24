/**
 * appendAuditEntry — Immutable Audit Log Append
 * 
 * NIEMALS direkt incident_audit_log überschreiben.
 * Immer über diesen Endpoint — garantiert:
 *  - Append-only (niemals bestehende Entries löschen)
 *  - Vollständiger Zeitstempel
 *  - User-Attribution
 *  - Previous + New State Snapshot
 *  - Für FINMA-Revisionen auditierbar
 * 
 * Unterstützte Entitäten: EnterpriseIncident, AdvisoryDossier, Contract
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SUPPORTED_ENTITIES = {
  EnterpriseIncident: 'incident_audit_log',
  AdvisoryDossier:    'approval_history',
  Contract:           'change_history',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { entity_type, entity_id, action, comment, previous_state, new_state, metadata } = payload;

    if (!entity_type || !entity_id || !action) {
      return Response.json({ error: 'entity_type, entity_id und action sind Pflichtfelder' }, { status: 400 });
    }

    const auditField = SUPPORTED_ENTITIES[entity_type];
    if (!auditField) {
      return Response.json({
        error: `Entity-Typ nicht unterstützt. Unterstützt: ${Object.keys(SUPPORTED_ENTITIES).join(', ')}`,
      }, { status: 400 });
    }

    // Fetch current entity
    const entity = await base44.asServiceRole.entities[entity_type].get(entity_id);
    if (!entity) {
      return Response.json({ error: `${entity_type} [${entity_id}] nicht gefunden` }, { status: 404 });
    }

    const existingLog = entity[auditField] || [];

    // New immutable entry
    const newEntry = {
      timestamp:      new Date().toISOString(),
      entry_index:    existingLog.length,        // monoton steigend — Lücken sind Manipulationsindiz
      user_id:        user.id,
      user_name:      user.full_name || user.email,
      user_email:     user.email,
      action,
      comment:        comment || null,
      previous_state: previous_state || null,
      new_state:      new_state || null,
      metadata:       metadata || null,
    };

    // Status-transition fields (für Incidents)
    if (previous_state?.status || new_state?.status) {
      newEntry.previous_status = previous_state?.status || null;
      newEntry.new_status      = new_state?.status || null;
    }

    // Append-only update
    const updatedLog = [...existingLog, newEntry];
    await base44.asServiceRole.entities[entity_type].update(entity_id, {
      [auditField]: updatedLog,
    });

    // Additionally write to global AuditLog for cross-entity traceability
    await base44.asServiceRole.entities.AuditLog.create({
      audit_schema_version: '1.0',
      audit_id: `AUD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      trigger_type: 'api',
      trigger_source: 'appendAuditEntry',
      actor_type: 'user',
      actor_id: user.id,
      actor_name: user.full_name || user.email,
      entity_type: entity_type.toLowerCase(),
      entity_id,
      action: action.includes('delete') ? 'delete' : action.includes('create') ? 'create' : 'update',
      audit_level: 2,
      audit_level_name: 'lifecycle_transition',
      previous_state_summary: previous_state || {},
      new_state_summary: new_state || {},
      metadata: { audit_field: auditField, entry_index: newEntry.entry_index, comment },
    });

    return Response.json({
      success: true,
      entity_type,
      entity_id,
      entry_index: newEntry.entry_index,
      timestamp: newEntry.timestamp,
      total_entries: updatedLog.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});