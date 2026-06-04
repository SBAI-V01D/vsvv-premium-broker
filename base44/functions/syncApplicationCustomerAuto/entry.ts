import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Entity Automation: Application create/update → Customer Enrichment
 * Ergänzt beim verlinkten Kunden fehlende Felder aus dem Antrag.
 * Prüft direkte Felder UND sparte_data des Antrags.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { event, data } = await req.json();

    if (!['create', 'update'].includes(event?.type)) {
      return Response.json({ status: 'skipped', reason: 'Not a create/update event' });
    }

    const application = data;

    if (!application?.customer_id) {
      return Response.json({ status: 'skipped', reason: 'No customer_id in application' });
    }

    // Fetch full application record (payload may be truncated)
    let app;
    try {
      app = await base44.asServiceRole.entities.Application.get(application.id);
    } catch (e) {
      return Response.json({ status: 'error', error: e.message }, { status: 500 });
    }

    if (!app) {
      return Response.json({ status: 'skipped', reason: 'Application not found' });
    }

    // Fetch existing customer
    let customer;
    try {
      customer = await base44.asServiceRole.entities.Customer.get(app.customer_id);
    } catch (e) {
      // Customer may have been deleted — skip silently
      return Response.json({ status: 'skipped', reason: 'Customer not found or deleted' });
    }

    if (!customer) {
      return Response.json({ status: 'skipped', reason: 'Customer not found' });
    }

    // Skip archived customers
    if (customer.archived) {
      return Response.json({ status: 'skipped', reason: 'Customer is archived' });
    }

    // Extract data from application (direct fields + sparte_data)
    const s = app.sparte_data || {};
    const appData = {
      email:        app.email        || s.email        || '',
      phone:        app.phone        || s.phone        || '',
      mobile:       app.mobile       || s.mobile       || '',
      street:       app.street       || s.street       || '',
      zip_code:     app.zip_code     || s.zip_code     || '',
      city:         app.city         || s.city         || '',
      canton:       app.canton       || s.canton       || '',
      birthdate:    app.birthdate    || s.birthdate    || '',
      ahv_number:   app.ahv_number   || s.ahv_number   || '',
      nationality:  app.nationality  || s.nationality  || '',
      profession:   app.profession   || s.profession   || '',
      company_name: app.company_name || s.company_name || '',
      legal_form:   app.legal_form   || s.legal_form   || '',
      uid_number:   app.uid_number   || s.uid_number   || '',
      industry:     app.industry     || s.industry     || '',
    };

    // Only enrich missing fields
    const enrichmentData = {};
    const fields = ['email','phone','mobile','street','zip_code','city','canton','birthdate','ahv_number','nationality','profession'];
    for (const f of fields) {
      if (appData[f] && !customer[f]) enrichmentData[f] = appData[f];
    }

    // Business fields
    if (customer.customer_type === 'business' || app.kundentyp === 'firma') {
      for (const f of ['company_name','legal_form','uid_number','industry']) {
        if (appData[f] && !customer[f]) enrichmentData[f] = appData[f];
      }
    }

    // Berater vom Antrag ist verbindlich — immer setzen wenn vorhanden
    const advisorId = app.advisor_id || app.assigned_broker;
    if (advisorId) {
      enrichmentData.primary_advisor_id = advisorId;
      enrichmentData.advisor_id = advisorId;
      const existing = customer.assigned_advisors || [];
      if (!existing.includes(advisorId)) {
        enrichmentData.assigned_advisors = [...existing, advisorId];
      }
      enrichmentData.access_level = 'assigned_advisors_only';
    }

    if (Object.keys(enrichmentData).length === 0) {
      return Response.json({ status: 'skipped', reason: 'No enrichment needed' });
    }

    await base44.asServiceRole.entities.Customer.update(customer.id, enrichmentData);
    console.log(`[SYNC_APP_CUSTOMER] Enriched customer ${customer.id} with: ${Object.keys(enrichmentData).join(', ')}`);

    return Response.json({ status: 'success', enriched_fields: Object.keys(enrichmentData) });

  } catch (error) {
    console.error('[SYNC_APP_CUSTOMER] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});