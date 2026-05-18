import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * CONTRACT LIFECYCLE GUARD — Zentrale Validierung für alle Contract-Operationen
 * 
 * AUDIT INTEGRATION v1.0:
 * - Logt alle Guard-Evaluierungen
 * - Trackt Decision-Codes
 * - Korreliert Process-Chains
 * - Async, Non-Blocking
 * 
 * Verwendung:
 * - Vor Contract.create()
 * - Vor Contract.update() mit Statusänderung
 * - Vor Provision-Erstellung
 * - Vor Task-Erstellung für Contract
 * 
 * Returns:
 * {
 *   valid: boolean,
 *   contractExists: boolean,
 *   contractId: string | null,
 *   reason: string | null,
 *   lifecycle: { current: string, allowedTransitions: string[] }
 * }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const {
      application_id,
      contract_id,
      customer_id,
      insurer,
      sparte,
      check_type, // 'create', 'update', 'link', 'provision'
    } = payload;

    // Validierung: Mindestens eine ID muss vorhanden sein
    if (!application_id && !contract_id && !customer_id) {
      return Response.json({
        valid: false,
        error: 'Missing required fields: application_id, contract_id, or customer_id',
      }, { status: 400 });
    }

    const result = {
      valid: false,
      contractExists: false,
      contractId: null,
      reason: null,
      lifecycle: null,
      guards: {},
    };

    // ── GUARD 1: Contract existiert bereits via application_id ─────────────
    if (application_id) {
      const existingBySource = await base44.asServiceRole.entities.Contract.filter({
        source_application_id: application_id,
      });

      if (existingBySource.length > 0) {
        result.contractExists = true;
        result.contractId = existingBySource[0].id;
        result.reason = 'contract_exists_by_source';
        result.guards.source_application_id = true;
        
        // Lifecycle prüfen
        const contract = existingBySource[0];
        result.lifecycle = {
          current: contract.process_status || 'neu',
          allowedTransitions: CONTRACT_LIFECYCLE[contract.process_status || 'neu'] || [],
        };
        
        // === AUDIT: Guard blocked duplicate contract creation ===
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const random = Math.random().toString(36).slice(2, 8).toUpperCase();
        const auditEntry = {
          audit_schema_version: '1.0',
          audit_id: `AUD-${date}-${random}`,
          audit_level: 1,
          audit_level_name: 'critical_business',
          timestamp: new Date().toISOString(),
          trigger_type: 'api',
          trigger_source: 'guardContractLifecycle',
          actor_type: 'user',
          actor_id: user.id,
          actor_name: user.full_name || user.email,
          process_id: `contract_lifecycle_${contract.id}_${date}`,
          process_type: 'contract_lifecycle',
          process_stage: 'creation_duplicate_check',
          event_id: `EVT-${date}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
          event_type: 'duplicate_contract_blocked',
          event_sequence: 1,
          entity_type: 'contract',
          entity_id: contract.id,
          action: 'block',
          decision_code: 'CONTRACT_CREATE_BLOCKED_DUPLICATE',
          decision_logic: `Guard 'contract_exists_by_source' evaluated: Existing contract ${contract.id} found for application ${application_id}`,
          guard_evaluated: 'contract_exists_by_source',
          guard_result: 'blocked',
          guard_reason: `contract_exists_by_source: ${contract.id}`,
          business_severity_type: 'financial',
          business_severity_level: 'high',
          technical_severity_type: 'info',
          technical_severity_level: 'low',
          previous_state_summary: { application_id, status: 'blocked' },
          new_state_summary: { contract_id: contract.id, reason: 'blocked_duplicate' },
          side_effects: [],
          business_impact_financial_chf: 0,
          business_impact_description: 'Duplicate contract creation prevented',
          correlation_id: `CTL-${date}-${contract.id.slice(-3).toUpperCase()}${random}`,
          related_entities: [
            { entity_type: 'application', entity_id: application_id, relationship: 'source_application' },
          ],
          duration_ms: 0,
          metadata: { policy_number: contract.policy_number, insurer: contract.insurer },
        };
        
        // Async write (non-blocking)
        base44.entities.AuditLog.create(auditEntry).catch(err => {
          console.error('[AUDIT] Failed to log duplicate block:', err.message);
        });
        
        return Response.json(result);
      }
    }

    // ── GUARD 2: Application hat bereits linked_contract_id ─────────────────
    if (application_id) {
      const application = await base44.asServiceRole.entities.Application.get(application_id);
      if (application?.linked_contract_id) {
        result.contractExists = true;
        result.contractId = application.linked_contract_id;
        result.reason = 'contract_already_linked';
        result.guards.linked_contract_id = true;
        
        const contract = await base44.asServiceRole.entities.Contract.get(application.linked_contract_id);
        result.lifecycle = {
          current: contract?.process_status || 'neu',
          allowedTransitions: CONTRACT_LIFECYCLE[contract?.process_status || 'neu'] || [],
        };
        
        // === AUDIT: Guard blocked - contract already linked ===
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const random = Math.random().toString(36).slice(2, 8).toUpperCase();
        const auditEntry = {
          audit_schema_version: '1.0',
          audit_id: `AUD-${date}-${random}`,
          audit_level: 2,
          audit_level_name: 'lifecycle_transition',
          timestamp: new Date().toISOString(),
          trigger_type: 'api',
          trigger_source: 'guardContractLifecycle',
          actor_type: 'user',
          actor_id: user.id,
          actor_name: user.full_name || user.email,
          process_id: `contract_lifecycle_${application.linked_contract_id}_${date}`,
          process_type: 'contract_lifecycle',
          process_stage: 'creation_link_check',
          event_id: `EVT-${date}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
          event_type: 'contract_link_already_exists',
          event_sequence: 1,
          entity_type: 'contract',
          entity_id: application.linked_contract_id,
          action: 'block',
          decision_code: 'CONTRACT_CREATE_BLOCKED_ALREADY_LINKED',
          decision_logic: `Guard 'linked_contract_id' evaluated: Application ${application_id} already linked to contract ${application.linked_contract_id}`,
          guard_evaluated: 'linked_contract_id',
          guard_result: 'blocked',
          guard_reason: `contract_already_linked: ${application.linked_contract_id}`,
          business_severity_type: 'operational',
          business_severity_level: 'medium',
          technical_severity_type: 'info',
          technical_severity_level: 'low',
          previous_state_summary: { application_id, linked_contract_id: application.linked_contract_id },
          new_state_summary: { contract_id: application.linked_contract_id, reason: 'blocked_already_linked' },
          side_effects: [],
          business_impact_financial_chf: 0,
          business_impact_description: 'Contract creation prevented - already linked',
          correlation_id: `CTL-${date}-${application.linked_contract_id.slice(-3).toUpperCase()}${random}`,
          related_entities: [
            { entity_type: 'application', entity_id: application_id, relationship: 'source_application' },
          ],
          duration_ms: 0,
          metadata: { policy_number: contract?.policy_number, insurer: contract?.insurer },
        };
        
        // Async write (non-blocking)
        base44.entities.AuditLog.create(auditEntry).catch(err => {
          console.error('[AUDIT] Failed to log link check:', err.message);
        });
        
        return Response.json(result);
      }
    }

    // ── GUARD 3: Contract-ID direkt geprüft ─────────────────────────────────
    if (contract_id) {
      const contract = await base44.asServiceRole.entities.Contract.get(contract_id);
      
      if (!contract) {
        result.reason = 'contract_not_found';
        return Response.json(result);
      }

      result.contractExists = true;
      result.contractId = contract.id;
      result.lifecycle = {
        current: contract.process_status || 'neu',
        allowedTransitions: CONTRACT_LIFECYCLE[contract.process_status || 'neu'] || [],
      };

      // Status-Transitions prüfen
      if (payload.new_status && payload.new_status !== contract.status) {
        const statusTransitions = {
          'active': ['expired', 'cancelled'],
          'pending': ['active', 'cancelled'],
          'expired': [],
          'cancelled': [],
          'archived': [],
        };
        
        const allowed = statusTransitions[contract.status] || [];
        if (!allowed.includes(payload.new_status)) {
          result.reason = 'invalid_status_transition';
          result.guards.status_transition = {
            current: contract.status,
            requested: payload.new_status,
            allowed,
          };
          return Response.json(result);
        }
      }
    }

    // ── GUARD 4: Duplikat-Prüfung (customer + insurer + sparte + active) ───
    if (customer_id && insurer && check_type === 'create') {
      const existingActive = await base44.asServiceRole.entities.Contract.filter({
        customer_id,
        insurer,
        status: 'active',
      });

      // Hinweis: Wir erlauben mehrere Verträge pro Kunde (verschiedene Produkte)
      // Diese Guard warnt nur, blockiert aber nicht
      if (existingActive.length > 0) {
        result.guards.duplicate_warning = {
          count: existingActive.length,
          message: 'Kunde hat bereits aktive Verträge mit dieser Gesellschaft',
        };
      }
    }

    // ── Alle Guards passed ──────────────────────────────────────────────────
    result.valid = true;
    result.reason = 'all_guards_passed';
    
    // === AUDIT: All guards passed - contract creation allowed ===
    const datePassed = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomPassed = Math.random().toString(36).slice(2, 8).toUpperCase();
    const auditEntryPassed = {
      audit_schema_version: '1.0',
      audit_id: `AUD-${datePassed}-${randomPassed}`,
      audit_level: 2,
      audit_level_name: 'lifecycle_transition',
      timestamp: new Date().toISOString(),
      trigger_type: 'api',
      trigger_source: 'guardContractLifecycle',
      actor_type: 'user',
      actor_id: user.id,
      actor_name: user.full_name || user.email,
      process_id: `contract_lifecycle_${contract_id || 'new'}_${datePassed}`,
      process_type: 'contract_lifecycle',
      process_stage: 'creation_validation_passed',
      event_id: `EVT-${datePassed}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
      event_type: 'contract_create_allowed',
      event_sequence: 1,
      entity_type: 'contract',
      entity_id: contract_id || 'new',
      action: 'allow',
      decision_code: 'CONTRACT_CREATE_ALLOWED',
      decision_logic: 'All guards passed: contract creation allowed',
      guard_evaluated: 'all_guards',
      guard_result: 'allowed',
      guard_reason: 'all_guards_passed',
      business_severity_type: 'operational',
      business_severity_level: 'low',
      technical_severity_type: 'info',
      technical_severity_level: 'low',
      previous_state_summary: {},
      new_state_summary: { valid: true, reason: 'all_guards_passed' },
      side_effects: [],
      business_impact_financial_chf: 0,
      business_impact_description: 'Contract creation validated and allowed',
      correlation_id: `CTL-${datePassed}-${(contract_id || 'new').slice(-3).toUpperCase()}${randomPassed}`,
      related_entities: application_id ? [{ entity_type: 'application', entity_id: application_id, relationship: 'source_application' }] : [],
      duration_ms: 0,
      metadata: { customer_id, insurer, sparte },
    };
    
    // Async write (non-blocking)
    base44.entities.AuditLog.create(auditEntryPassed).catch(err => {
      console.error('[AUDIT] Failed to log allowed creation:', err.message);
    });

    return Response.json(result);

  } catch (error) {
    console.error('[guardContractLifecycle] ERROR:', error.message);
    return Response.json({
      valid: false,
      error: error.message,
    }, { status: 500 });
  }
});

// Contract Lifecycle State Machine
const CONTRACT_LIFECYCLE = {
  'neu': ['pruefung_offen', 'kunde_kontaktieren'],
  'pruefung_offen': ['kunde_kontaktieren', 'verlaengerung_vorbereiten', 'erledigt'],
  'kunde_kontaktieren': ['verlaengerung_vorbereiten', 'beratung_erfolgt', 'erledigt'],
  'verlaengerung_vorbereiten': ['beratung_erfolgt', 'erledigt'],
  'beratung_erfolgt': ['erledigt'],
  'erledigt': [], // Terminal
};