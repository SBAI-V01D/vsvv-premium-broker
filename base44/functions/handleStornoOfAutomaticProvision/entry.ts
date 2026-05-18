import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Storniert automatisch erstellte Provisionen wenn Vertrag storniert wird
 * Trigger: Entity automation auf Contract (update event, cancel_date set)
 * 
 * Verhindert verwaiste offene Provisionen bei Vertragsauflösung
 * 
 * Erzeugt Storno nur wenn:
 * - Vertrag erhält cancel_date (storniert)
 * - Offene Provision mit created_automatically = true existiert
 * - Provision nicht bereits storniert
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    
    const { event, data: contractData, old_data: oldContractData, changed_fields } = payload;
    
    // Nur bei Update-Events auf Contract
    if (event.type !== 'update' || event.entity_name !== 'Contract') {
      return Response.json({ 
        success: false, 
        reason: 'Not a Contract update event',
        skipped: true 
      });
    }

    // Prüfe ob cancel_date gesetzt wurde (kein cancel_date → kein cancel_date)
    const hadCancelDate = oldContractData?.cancel_date ? true : false;
    const hasNowCancelDate = contractData?.cancel_date ? true : false;
    
    if (hadCancelDate || !hasNowCancelDate) {
      return Response.json({ 
        success: false, 
        reason: 'Contract not being cancelled (no cancel_date set)',
        skipped: true 
      });
    }

    const contractId = event.entity_id;

    // Finde alle automatisch erstellten Provisionen für diesen Vertrag
    const autoProvisions = await base44.asServiceRole.entities.CommissionEntry.filter({
      policy_id: contractId,
    });
    
    const openAutoProvisions = autoProvisions.filter(p =>
      p.created_automatically === true &&
      (p.provision_status === 'ausstehend' || p.provision_status === 'pending') &&
      !p.archived &&
      !p.is_storno
    );

    if (openAutoProvisions.length === 0) {
      return Response.json({ 
        success: false, 
        reason: 'No open automatic provisions found for this contract',
        skipped: true 
      });
    }

    const stornoResults = [];

    // Erstelle Storno für jede offene automatische Provision
    for (const provision of openAutoProvisions) {
      try {
        // ── GUARD 1: Existiert bereits ein Storno für diese Provision? ─────────────────
        const existingStornos = await base44.asServiceRole.entities.CommissionEntry.filter({
          is_storno: true,
          storno_reference_id: provision.id,
          archived: false,
        });
        
        if (existingStornos.length > 0) {
          console.log(`[handleStornoOfAutomaticProvision] GUARD: Storno existiert bereits für Provision ${provision.id}`);
          stornoResults.push({
            original_provision_id: provision.id,
            status: 'skipped',
            reason: 'storno_already_exists',
            existing_storno_id: existingStornos[0].id,
          });
          continue; // Skip diese Provision
        }

        // ── GUARD 2: Ist die Provision bereits storniert? ─────────────────────────────
        if (provision.provision_status === 'cancelled' || provision.status === 'cancelled' || provision.is_storno) {
          console.log(`[handleStornoOfAutomaticProvision] GUARD: Provision ${provision.id} bereits storniert`);
          stornoResults.push({
            original_provision_id: provision.id,
            status: 'skipped',
            reason: 'provision_already_cancelled',
          });
          continue; // Skip diese Provision
        }

        // ── GUARD 3: Wurde die Provision bereits ausbezahlt? ──────────────────────────
        const wasPaid = (provision.provision_status === 'paid' || provision.status === 'paid');
        if (wasPaid) {
          console.log(`[handleStornoOfAutomaticProvision] GUARD: Provision ${provision.id} bereits ausbezahlt - manuelle Prüfung erforderlich`);
          // Nicht skippen - aber markieren für manuelle Prüfung
        }

        // Storno-Datensatz basierend auf Original
        const storno = {
          policy_id: provision.policy_id,
          policy_number: provision.policy_number,
          advisor_id: provision.advisor_id,
          advisor_name: provision.advisor_name,
          organization_id: provision.organization_id,
          organization_name: provision.organization_name,
          customer_id: provision.customer_id,
          customer_name: provision.customer_name,
          insurer: provision.insurer,
          product_category: provision.product_category,
          premium_yearly: provision.premium_yearly,
          start_date: provision.start_date,
          
          // Storno-Markierung
          is_storno: true,
          storno_datum: new Date().toISOString().split('T')[0],
          storno_reference_id: provision.id,
          storno_grund: `Automatische Storno: Vertrag ${contractData?.policy_number || contractId} storniert am ${new Date().toISOString().split('T')[0]}`,
          
          // Archiv Original-Beträge für Audit
          storno_ursprung_provision_brutto: provision.advisor_provision_amount || 0,
          storno_war_ausbezahlt: wasPaid,
          storno_rueckforderungsbetrag: wasPaid ? (provision.provision_payout_amount || provision.advisor_provision_amount || 0) : 0,
          
          // Status: Storniert
          provision_status: 'cancelled',
          status: 'cancelled',
          entry_date: new Date().toISOString().split('T')[0],
          
          // Markierungen
          created_automatically: true,
          created_from_contract: true,
          provision_created_automatically: true,
          notes: `Automatische Storno wegen Vertragsauflösung - Original: ${provision.id}`,
          
          archived: false,
        };

        const createdStorno = await base44.asServiceRole.entities.CommissionEntry.create(storno);
        
        // Audit Log
        await base44.asServiceRole.entities.AuditLog.create({
          entity_type: 'commission',
          entity_id: createdStorno.id,
          action: 'create',
          changed_by: 'system_automation',
          changed_at: new Date().toISOString(),
          summary: `Automatische Storno-Provision: Vertrag ${contractData?.policy_number} storniert - Original: ${provision.id}`,
          new_values: storno,
        }).catch(() => {});

        // AUDIT LOG: Storno erstellt
        await base44.functions.invoke('auditLogWrite', {
          entity_type: 'CommissionEntry',
          entity_id: createdStorno.id,
          action: 'create',
          source: 'handleStornoOfAutomaticProvision',
          trigger_reason: 'contract_cancelled',
          guard_result: 'allowed',
          guard_reason: 'no_existing_storno',
          old_values: {},
          new_values: {
            is_storno: true,
            storno_reference_id: provision.id,
            provision_status: 'cancelled',
          },
          summary: `Storno-Provision erstellt für Vertrag ${contractData?.policy_number || contractId} - Original: ${provision.id}`,
          duration_ms: 0,
        }).catch(() => {});

        stornoResults.push({
          original_provision_id: provision.id,
          storno_id: createdStorno.id,
          status: 'created',
          guard_checks_passed: ['no_existing_storno', 'not_already_cancelled'],
        });

      } catch (err) {
        console.error(`[handleStornoOfAutomaticProvision] Storno für Provision ${provision.id} fehlgeschlagen:`, err.message);
        
        // AUDIT LOG: Error
        await base44.functions.invoke('auditLogWrite', {
          entity_type: 'CommissionEntry',
          entity_id: provision.id,
          action: 'error',
          source: 'handleStornoOfAutomaticProvision',
          trigger_reason: 'contract_cancelled',
          error_details: err.message,
          old_values: {},
          new_values: {},
          summary: `Storno-Erstellung fehlgeschlagen: ${err.message}`,
          duration_ms: 0,
        }).catch(() => {});

        stornoResults.push({
          original_provision_id: provision.id,
          status: 'failed',
          error: err.message
        });
      }
    }

    const createdCount = stornoResults.filter(r => r.status === 'created').length;
    const skippedCount = stornoResults.filter(r => r.status === 'skipped').length;
    const failedCount = stornoResults.filter(r => r.status === 'failed').length;

    return Response.json({
      success: true,
      contract_id: contractId,
      stornos_created: createdCount,
      stornos_skipped: skippedCount,
      stornos_failed: failedCount,
      details: stornoResults,
      message: `${createdCount} Storno-Provision(en) erstellt, ${skippedCount} übersprungen (bereits vorhanden), ${failedCount} fehlgeschlagen`,
      guards_applied: ['no_existing_storno', 'not_already_cancelled', 'track_paid_status'],
    });

  } catch (error) {
    console.error('[handleStornoOfAutomaticProvision] ERROR:', error.message);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});