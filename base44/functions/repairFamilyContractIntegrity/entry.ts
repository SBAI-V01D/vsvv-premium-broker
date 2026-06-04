import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Nur für Admins' }, { status: 403 });
    }

    const { dry_run = true } = await req.json().catch(() => ({}));

    // 1. Alle Familienmitglieder laden
    const familyMembers = await base44.asServiceRole.entities.Customer.filter({ is_family_member: true });
    console.log(`[REPAIR] Starte Reparatur für ${familyMembers.length} Familienmitglieder (dry_run: ${dry_run})`);

    const results = {
      repaired: [],
      errors: [],
      skipped: []
    };

    for (const member of familyMembers) {
      const memberContracts = await base44.asServiceRole.entities.Contract.filter({ customer_id: member.id });
      
      for (const contract of memberContracts) {
        const needsFix = contract.is_family_member !== true || contract.primary_customer_id !== member.primary_customer_id;
        
        if (!needsFix) {
          results.skipped.push({
            contract_id: contract.id,
            reason: 'Bereits korrekt'
          });
          continue;
        }

        try {
          if (dry_run) {
            results.repaired.push({
              contract_id: contract.id,
              customer_id: member.id,
              customer_name: `${member.first_name} ${member.last_name}`,
              insurer: contract.insurer,
              policy_number: contract.policy_number,
              changes: {
                is_family_member: { from: contract.is_family_member, to: true },
                primary_customer_id: { from: contract.primary_customer_id, to: member.primary_customer_id }
              },
              status: 'dry_run'
            });
          } else {
            await base44.asServiceRole.entities.Contract.update(contract.id, {
              is_family_member: true,
              primary_customer_id: member.primary_customer_id
            });

            // Audit-Log erstellen
            await base44.asServiceRole.entities.AuditLog.create({
              audit_schema_version: '1.0',
              audit_id: `AUD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
              audit_level: 2,
              audit_level_name: 'lifecycle_transition',
              timestamp: new Date().toISOString(),
              trigger_type: 'manual',
              trigger_source: user.email,
              actor_type: 'user',
              actor_id: user.id,
              actor_name: user.full_name || user.email,
              process_id: `FAMILY-REPAIR-${Date.now()}`,
              process_type: 'family_contract_integrity_repair',
              process_stage: 'contract_update',
              event_id: `EVT-${contract.id}`,
              event_type: 'contract_family_flag_corrected',
              event_sequence: 1,
              entity_type: 'contract',
              entity_id: contract.id,
              action: 'update',
              decision_code: 'DATA_INTEGRITY_AUTO_FIX',
              decision_logic: 'Vertrag eines Familienmitglieds hatte falsche is_family_member/primary_customer_id Werte',
              previous_state_summary: {
                is_family_member: contract.is_family_member,
                primary_customer_id: contract.primary_customer_id
              },
              new_state_summary: {
                is_family_member: true,
                primary_customer_id: member.primary_customer_id
              },
              business_impact_description: 'Datenintegrität für Haushaltszuordnung korrigiert',
              metadata: {
                customer_id: member.id,
                customer_name: `${member.first_name} ${member.last_name}`,
                repaired_by: user.email
              }
            });

            results.repaired.push({
              contract_id: contract.id,
              customer_id: member.id,
              customer_name: `${member.first_name} ${member.last_name}`,
              insurer: contract.insurer,
              policy_number: contract.policy_number,
              changes: {
                is_family_member: { from: contract.is_family_member, to: true },
                primary_customer_id: { from: contract.primary_customer_id, to: member.primary_customer_id }
              },
              status: 'repaired'
            });
          }
        } catch (error) {
          results.errors.push({
            contract_id: contract.id,
            error: error.message,
            customer_id: member.id
          });
        }
      }
    }

    return Response.json({
      summary: {
        dry_run,
        total_repaired: results.repaired.length,
        total_errors: results.errors.length,
        total_skipped: results.skipped.length,
        timestamp: new Date().toISOString()
      },
      ...results
    });
  } catch (error) {
    console.error('[REPAIR] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});