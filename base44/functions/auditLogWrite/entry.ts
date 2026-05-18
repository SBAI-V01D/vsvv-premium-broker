import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * CENTRAL AUDIT LOG — Strukturierte Logs für ALLE Systemaktionen
 * 
 * Verwendung:
 * 1. Entity-Changes (create/update/delete)
 * 2. Automation-Triggers (warum ausgelöst?)
 * 3. Guard-Hits (erlaubt/blockiert?)
 * 4. Process-Transitions (Statuswechsel)
 * 5. Errors (mit Stack-Trace)
 * 
 * Felder:
 * - entity_type: Betroffene Entität
 * - entity_id: Betroffene ID
 * - action: create|update|delete|automation|guard|error
 * - source: Welche Automation/Funktion? (z.B. 'onApplicationUpdate')
 * - trigger_reason: Warum ausgelöst? (z.B. 'status_change_to_approved')
 * - guard_result: allowed|blocked|skipped
 * - guard_reason: Welcher Guard? (z.B. 'contract_exists_by_source')
 * - old_values: Vorher-Werte
 * - new_values: Nachher-Werte
 * - summary: Menschliche Zusammenfassung
 * - duration_ms: Wie lange dauerte die Operation?
 * - error_details: Fehlerdetails bei action='error'
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      entity_type,
      entity_id,
      action,
      source,
      trigger_reason,
      guard_result,
      guard_reason,
      old_values,
      new_values,
      summary,
      duration_ms,
      error_details,
    } = body;

    // Audit-Log-Eintrag erstellen
    const auditEntry = {
      entity_type: entity_type || 'system',
      entity_id: entity_id || null,
      action: action || 'update',
      changed_by: user.email,
      changed_at: new Date().toISOString(),
      old_values: old_values || {},
      new_values: new_values || {},
      summary: summary || `${action}d ${entity_type || 'entity'} ${entity_id || ''}`,
      // ERWEITERTE FELDER für Automation-Observability
      details: JSON.stringify({
        source: source || null,
        trigger_reason: trigger_reason || null,
        guard_result: guard_result || null,
        guard_reason: guard_reason || null,
        duration_ms: duration_ms || null,
        error_details: error_details || null,
      }),
    };

    try {
      await base44.entities.AuditLog.create(auditEntry);
    } catch (err) {
      // Fallback: AuditLog-Entity existiert nicht → Console-Log
      console.log('[AUDIT]', JSON.stringify(auditEntry));
    }

    return Response.json({ success: true, logged: true, entry: auditEntry });

  } catch (error) {
    console.error('[AUDIT WRITE ERROR]', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});