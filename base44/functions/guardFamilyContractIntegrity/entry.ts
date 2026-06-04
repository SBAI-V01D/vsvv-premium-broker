import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Entity Automation Guard: Contract create/update → Family Integrity Check
 * Stellt sicher dass Verträge von Familienmitgliedern korrekt gekennzeichnet sind.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (!['create', 'update'].includes(event?.type)) {
      return Response.json({ status: 'skipped', reason: 'Not a create/update event' });
    }

    const contract = data;
    if (!contract?.customer_id) {
      return Response.json({ status: 'skipped', reason: 'No customer_id in contract' });
    }

    // Kunde laden
    let customer;
    try {
      customer = await base44.asServiceRole.entities.Customer.get(contract.customer_id);
    } catch (e) {
      console.warn('[GUARD_FAMILY] Customer not found:', contract.customer_id);
      return Response.json({ status: 'skipped', reason: 'Customer not found' });
    }

    if (!customer) {
      return Response.json({ status: 'skipped', reason: 'Customer is null' });
    }

    // Skip archived customers
    if (customer.archived) {
      return Response.json({ status: 'skipped', reason: 'Customer is archived' });
    }

    const updates: any = {};
    const changes: string[] = [];

    // FALL 1: Kunde ist Familienmitglied
    if (customer.is_family_member) {
      // Vertrag MUSS is_family_member=true haben
      if (contract.is_family_member !== true) {
        updates.is_family_member = true;
        changes.push('is_family_member: false → true');
      }

      // Vertrag MUSS gleiche primary_customer_id wie Kunde haben
      if (customer.primary_customer_id && contract.primary_customer_id !== customer.primary_customer_id) {
        updates.primary_customer_id = customer.primary_customer_id;
        changes.push(`primary_customer_id: ${contract.primary_customer_id} → ${customer.primary_customer_id}`);
      }
    } 
    // FALL 2: Kunde ist Hauptkunde (nicht Familienmitglied)
    else {
      // Vertrag sollte is_family_member=false haben (oder undefined)
      if (contract.is_family_member === true) {
        updates.is_family_member = false;
        changes.push('is_family_member: true → false');
      }

      // Vertrag sollte primary_customer_id=customer_id haben (oder undefined)
      if (contract.primary_customer_id && contract.primary_customer_id !== customer.id) {
        updates.primary_customer_id = customer.id;
        changes.push(`primary_customer_id: ${contract.primary_customer_id} → ${customer.id}`);
      }
    }

    // Wenn keine Änderungen nötig sind, skip
    if (Object.keys(updates).length === 0) {
      return Response.json({ status: 'ok', reason: 'No corrections needed' });
    }

    // Updates durchführen
    await base44.asServiceRole.entities.Contract.update(contract.id, updates);

    // Audit-Log erstellen
    await base44.asServiceRole.entities.AuditLog.create({
      audit_schema_version: '1.0',
      audit_id: `AUD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      audit_level: 2,
      audit_level_name: 'lifecycle_transition',
      timestamp: new Date().toISOString(),
      trigger_type: 'entity_create',
      trigger_source: 'guardFamilyContractIntegrity',
      actor_type: 'automation',
      actor_id: 'guardFamilyContractIntegrity',
      actor_name: 'Family Contract Integrity Guard',
      process_id: `FCG-${Date.now()}`,
      process_type: 'family_contract_integrity_guard',
      process_stage: 'contract_correction',
      event_id: `EVT-${contract.id}`,
      event_type: 'contract_family_integrity_corrected',
      event_sequence: 1,
      entity_type: 'contract',
      entity_id: contract.id,
      action: 'update',
      decision_code: 'FAMILY_INTEGRITY_AUTO_FIX',
      decision_logic: 'Vertrag eines Familienmitglieds hatte inkonsistente is_family_member/primary_customer_id Werte',
      previous_state_summary: {
        is_family_member: contract.is_family_member,
        primary_customer_id: contract.primary_customer_id
      },
      new_state_summary: updates,
      business_impact_description: 'Datenintegrität für Haushaltszuordnung automatisch korrigiert',
      metadata: {
        customer_id: customer.id,
        customer_name: `${customer.first_name} ${customer.last_name}`,
        customer_is_family_member: customer.is_family_member,
        changes_applied: changes
      }
    });

    console.log(`[GUARD_FAMILY] Corrected contract ${contract.id}: ${changes.join(', ')}`);

    return Response.json({ 
      status: 'corrected', 
      contract_id: contract.id,
      changes,
      updates
    });
  } catch (error) {
    console.error('[GUARD_FAMILY] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});