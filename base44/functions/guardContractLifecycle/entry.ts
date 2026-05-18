import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * CONTRACT LIFECYCLE GUARD — Zentrale Validierung für alle Contract-Operationen
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