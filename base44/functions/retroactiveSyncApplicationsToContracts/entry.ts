import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Status-Gruppen die automatisch einen Vertrag erstellen sollen
const ACCEPTED_STATUSES = ['angenommen', 'policiert', 'approved', 'angenommen_vorbehalt', 'conditional_approved', 'aktiv'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Alle Anträge mit akzeptierten Status und OHNE Vertrag
    const applications = await base44.asServiceRole.entities.Application.filter({
      linked_contract_id: null,
    });

    const acceptedApps = applications.filter(app =>
      ACCEPTED_STATUSES.includes(app.custom_status || app.status)
    );

    let created = 0;
    let skipped = 0;

    for (const app of acceptedApps) {
      // Prüfe, ob bereits ein Vertrag für diesen Antrag existiert
      const existingContracts = await base44.asServiceRole.entities.Contract.filter({
        linked_application_id: app.id,
      });

      if (existingContracts.length > 0) {
        // Vertrag existiert, nur verlinken
        await base44.asServiceRole.entities.Application.update(app.id, {
          linked_contract_id: existingContracts[0].id,
        });
        skipped++;
        continue;
      }

      // Vertrag erstellen
      const premiumMonthly = app.estimated_premium_monthly || null;
      const premiumYearly = app.estimated_premium_yearly || (premiumMonthly ? Math.round(premiumMonthly * 12 * 100) / 100 : null);

      const newContract = await base44.asServiceRole.entities.Contract.create({
        customer_id: app.customer_id,
        customer_name: app.customer_name,
        primary_customer_id: app.primary_customer_id || app.customer_id,
        is_family_member: app.is_family_member || false,
        organization_id: app.organization_id,
        insurer: app.insurer,
        insurance_type: app.insurance_type || app.sparte,
        sparte: app.sparte || app.insurance_type,
        sparte_data: app.sparte_data || {},
        product: app.product || app.sparte,
        policy_number: app.policy_number || '',
        premium_yearly: premiumYearly,
        premium_monthly: premiumMonthly,
        start_date: app.contract_start_date || app.requested_start_date || '',
        end_date: app.contract_end_date || '',
        assigned_broker: app.assigned_broker || '',
        custom_status: 'aktiv',
        status: 'active',
        linked_application_id: app.id,
        notes: [
          'Automatisch erstellt aus Antrag (rückwirkend).',
          app.sparte_data?.franchise ? `Franchise: CHF ${app.sparte_data.franchise}` : null,
          app.sparte_data?.model ? `Modell: ${app.sparte_data.model}` : null,
          app.sparte_data?.age_group ? `Kategorie: ${app.sparte_data.age_group}` : null,
          app.notes || null,
        ].filter(Boolean).join(' | '),
      });

      // Antrag mit Vertrags-ID verknüpfen
      await base44.asServiceRole.entities.Application.update(app.id, {
        linked_contract_id: newContract.id,
      });

      created++;
      console.log(`[retroactiveSyncApplicationsToContracts] Vertrag erstellt: ${app.customer_name} | ${app.insurer}`);
    }

    return Response.json({
      ok: true,
      total_accepted_apps: acceptedApps.length,
      contracts_created: created,
      contracts_relinked: skipped,
      message: `${created} Verträge erstellt, ${skipped} wieder verlinkt`,
    });

  } catch (error) {
    console.error('[retroactiveSyncApplicationsToContracts] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});