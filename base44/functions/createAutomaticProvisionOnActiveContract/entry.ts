import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Automatische Provisionsbuchung bei Vertragsaktivierung
 * Trigger: Entity automation auf Contract (update event)
 * 
 * Erstellt KEINE finale Abrechnung, nur offene Provision zur Vorbereitung
 * 
 * Erzeugt nur wenn:
 * - Vertrag wird von nicht-aktiv zu aktiv geändert
 * - Kunde aktiv
 * - Keine bestehende offene Provision vorhanden
 * - Vertrag nicht storniert
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

    // Prüfe ob status zu "active" gewechselt hat
    const wasActive = oldContractData?.status === 'active';
    const isNowActive = contractData?.status === 'active';
    
    if (wasActive || !isNowActive) {
      return Response.json({ 
        success: false, 
        reason: 'Contract not transitioning to active',
        skipped: true 
      });
    }

    const contractId = event.entity_id;
    const customerId = contractData?.customer_id;
    const organizationId = contractData?.organization_id;

    // Validierungen
    if (!customerId || !organizationId) {
      return Response.json({ 
        success: false, 
        reason: 'Missing customer_id or organization_id'
      }, { status: 400 });
    }

    // Kunde validieren
    const customers = await base44.asServiceRole.entities.Customer.filter({ id: customerId });
    if (customers.length === 0 || customers[0].archived) {
      return Response.json({ 
        success: false, 
        reason: 'Customer not found or archived'
      }, { status: 400 });
    }
    const customer = customers[0];

    // Storno-Check (kein Storno erforderlich)
    if (contractData?.cancel_date) {
      return Response.json({ 
        success: false, 
        reason: 'Cannot create provision for cancelled contract',
        skipped: true 
      });
    }

    // Duplikat-Check: Existiert bereits eine offene/ausstehende Provision für diesen Vertrag?
    // CRITICAL: Ausschließlich nicht-Storno-Einträge, um Reaktivierungen nach Storno korrekt zu handhaben
    const existingProvisions = await base44.asServiceRole.entities.CommissionEntry.filter({
      policy_id: contractId,
    });
    
    const hasOpenProvision = existingProvisions.some(e => 
      (e.provision_status === 'erwartet' || e.provision_status === 'ausstehend' || e.provision_status === 'pending') &&
      !e.archived &&
      !e.is_storno  // Stornos sind nicht "offen" für Duplikat-Prüfung
    );

    if (hasOpenProvision) {
      return Response.json({ 
        success: false, 
        reason: 'Open provision for this contract already exists',
        skipped: true 
      });
    }

    // Neue Provisionsbuchung erstellen (OFFEN, NICHT automatisch berechnet)
    const newProvision = {
      policy_id: contractId,
      policy_number: contractData?.policy_number || '',
      advisor_id: contractData?.advisor_id || '',
      advisor_name: contractData?.advisor_name || '',
      organization_id: organizationId,
      organization_name: customer.organization_id ? 'Organization' : '',
      customer_id: customerId,
      customer_name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.company_name || 'Unknown',
      insurer: contractData?.insurer || '',
      product_category: contractData?.sparte || contractData?.insurance_type || '',
      
      // Vertragsdaten (nur Referenzen, keine Berechnung)
      premium_yearly: contractData?.premium_yearly || 0,
      start_date: contractData?.start_date || new Date().toISOString().split('T')[0],
      
      // Provisionsfelder LEER für manuelle Ergänzung
      company_provision_amount: null,
      advisor_provision_percentage: null,
      advisor_provision_amount: null,
      provision_storno_percentage: 10, // Default-Wert
      provision_payout_amount: null,
      
      // Status: ERWARTET (nicht eingegangen, nicht ausbezahlt)
      provision_status: 'erwartet',
      status: 'erwartet',
      entry_date: new Date().toISOString().split('T')[0],
      
      // Markierungen für automatische Erstellung
      created_automatically: true,
      created_from_contract: true,
      provision_created_automatically: true,
      notes: `Automatisch aus Vertragsaktivierung erstellt - ${new Date().toISOString().split('T')[0]}`,
      
      // Audit
      archived: false,
    };

    const created = await base44.asServiceRole.entities.CommissionEntry.create(newProvision);

    // Audit Log
    await base44.asServiceRole.entities.AuditLog.create({
      entity_type: 'commission',
      entity_id: created.id,
      action: 'create',
      changed_by: 'system_automation',
      changed_at: new Date().toISOString(),
      summary: `Automatische Provisionsbuchung aus Vertragsaktivierung: ${contractData?.policy_number || contractId}`,
      new_values: newProvision,
    }).catch(() => {});

    return Response.json({
      success: true,
      provision_id: created.id,
      contract_id: contractId,
      customer_id: customerId,
      message: 'Open provision created automatically for active contract'
    });

  } catch (error) {
    console.error('[createAutomaticProvisionOnActiveContract] ERROR:', error.message);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});