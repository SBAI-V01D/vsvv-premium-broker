import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * ONE-CLICK ANNAHME — Antrag → Vertrag in einem Schritt
 * 
 * Diese Function kombiniert Status-Update und Contract-Erstellung
 * für maximale operative Geschwindigkeit bei Standardfällen.
 * 
 * Verwendet bestehende Guards aus onApplicationUpdate.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { application_id } = await req.json();
    if (!application_id) return Response.json({ error: 'application_id erforderlich' }, { status: 400 });

    console.log(`[acceptApplicationAndCreateContract] START app=${application_id} user=${user.email}`);

    // 1. Application laden
    const app = await base44.entities.Application.get(application_id);
    if (!app) return Response.json({ error: 'Antrag nicht gefunden' }, { status: 404 });

    // 2. Guard: Bereits verknüpft? — Nur wenn verlinkter Vertrag noch aktiv existiert
    if (app.linked_contract_id) {
      let existingContract = null;
      try {
        existingContract = await base44.entities.Contract.get(app.linked_contract_id);
      } catch (_) {
        existingContract = null;
      }
      if (existingContract && !existingContract.archived) {
        return Response.json({
          success: false,
          message: 'Antrag bereits mit Vertrag verknüpft',
          contract_id: app.linked_contract_id,
        });
      }
      // Verknüpfter Vertrag existiert nicht mehr oder archiviert → Link leeren und neu erstellen
      await base44.entities.Application.update(application_id, { linked_contract_id: null });
      app.linked_contract_id = null;
    }

    // 3. Status auf "angenommen" setzen → triggert onApplicationUpdate
    const acceptanceDate = app.acceptance_date || new Date().toISOString().split('T')[0];
    await base44.entities.Application.update(application_id, {
      custom_status: 'angenommen',
      status_changed_at: new Date().toISOString(),
      acceptance_date: acceptanceDate,
    });

    console.log(`[acceptApplicationAndCreateContract] Status gesetzt, warte auf Contract-Erstellung...`);

    // 4. Kurz warten damit onApplicationUpdate Contract erstellen kann
    await new Promise(resolve => setTimeout(resolve, 500));

    // 5. Contract laden der erstellt wurde
    const updatedApp = await base44.entities.Application.get(application_id);
    const contractId = updatedApp.linked_contract_id;

    if (!contractId) {
      // Fallback: manuell erstellen (falls onApplicationUpdate nicht feuert)
      console.warn('[acceptApplicationAndCreateContract] onApplicationUpdate hat keinen Contract erstellt — manuelle Erstellung');
      
      // Organisation-ID sicherstellen
      let finalOrgId = app.organization_id;
      if (!finalOrgId) {
        const customer = await base44.entities.Customer.get(app.customer_id);
        finalOrgId = customer?.organization_id;
        if (finalOrgId) {
          await base44.entities.Application.update(application_id, { organization_id: finalOrgId });
        }
      }

      // ENTERPRISE GUARD: Customer-ID validieren (existiert noch?)
      let customerExists = false;
      try {
        const customerCheck = await base44.entities.Customer.get(app.customer_id);
        customerExists = !!customerCheck && !customerCheck.archived;
      } catch (_) { customerExists = false; }
      
      if (!customerExists) {
        console.error(`[acceptApplicationAndCreateContract] BLOCKED: customer_id ${app.customer_id} does not exist or is archived`);
        return Response.json({ 
          error: 'Kunde existiert nicht oder ist archiviert', 
          customer_id: app.customer_id,
          application_id: application_id 
        }, { status: 400 });
      }
      
      const premiumYearly = app.estimated_premium_yearly || (app.estimated_premium_monthly ? Math.round(app.estimated_premium_monthly * 12) : 0);
      
      const newContract = await base44.entities.Contract.create({
        customer_id: app.customer_id,
        customer_name: app.customer_name,
        primary_customer_id: app.primary_customer_id || app.customer_id,
        organization_id: finalOrgId,
        advisor_id: app.advisor_id,
        assigned_broker: app.assigned_broker,
        insurer: app.insurer,
        insurance_type: app.insurance_type || app.sparte,
        sparte: app.sparte,
        sparte_data: app.sparte_data || {},
        product: app.product || app.sparte,
        policy_number: app.policy_number || '',
        premium_yearly: premiumYearly,
        premium_monthly: app.estimated_premium_monthly,
        start_date: app.contract_start_date || app.requested_start_date,
        end_date: app.contract_end_date,
        acceptance_date: acceptanceDate,
        status: 'active',
        custom_status: 'aktiv',
        source_application_id: application_id,
        notes: `Automatisch erstellt via One-Click-Annahme durch ${user.email}`,
      });

      await base44.entities.Application.update(application_id, {
        linked_contract_id: newContract.id,
      });

      // ENTERPRISE GUARD: Kündigungsfrist synchronisieren (sofort, nicht warten)
      try {
        await base44.functions.invoke('syncCancellationDeadline', { contract_id: newContract.id });
        console.log(`[acceptApplicationAndCreateContract] syncCancellationDeadline executed for ${newContract.id}`);
      } catch (syncErr) {
        console.warn(`[acceptApplicationAndCreateContract] syncCancellationDeadline failed (non-blocking): ${syncErr.message}`);
      }

      return Response.json({
        success: true,
        application_id,
        contract_id: newContract.id,
        message: 'Antrag angenommen und Vertrag erstellt',
      });
    }

    console.log(`[acceptApplicationAndCreateContract] ✅ Contract erstellt: ${contractId}`);

    return Response.json({
      success: true,
      application_id,
      contract_id: contractId,
      message: 'Antrag angenommen und Vertrag erstellt',
    });

  } catch (error) {
    console.error(`[acceptApplicationAndCreateContract] ERROR: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});