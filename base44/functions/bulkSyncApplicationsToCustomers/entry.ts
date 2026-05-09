import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * BULK SYNC: Prüft alle Anträge und ergänzt fehlende Kundendaten
 * 
 * Für jeden Antrag mit customer_id:
 * 1. Lade den verlinkten Kunden
 * 2. Extrahiere relevante Felder aus dem Antrag (sparte_data, direkte Felder)
 * 3. Ergänze beim Kunden fehlende Felder
 * 
 * Nur Admin-Zugriff.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('[bulkSyncApplicationsToCustomers] START');

    // Alle Anträge laden
    const applications = await base44.asServiceRole.entities.Application.list(null, 2000);
    console.log(`[bulkSync] Loaded ${applications.length} applications`);

    // Alle Kunden laden (für schnellen Lookup)
    const allCustomers = await base44.asServiceRole.entities.Customer.list(null, 5000);
    const customerMap = {};
    for (const c of allCustomers) {
      customerMap[c.id] = c;
    }

    let enrichedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const enrichedDetails = [];

    for (const app of applications) {
      if (!app.customer_id) {
        skippedCount++;
        continue;
      }

      const customer = customerMap[app.customer_id];
      if (!customer) {
        skippedCount++;
        continue;
      }

      // Felder aus dem Antrag extrahieren
      const appData = extractFromApplication(app);
      
      // Nur fehlende Felder ergänzen (nie überschreiben)
      const enrichmentData = {};

      if (appData.email && !customer.email) enrichmentData.email = appData.email;
      if (appData.phone && !customer.phone) enrichmentData.phone = appData.phone;
      if (appData.mobile && !customer.mobile) enrichmentData.mobile = appData.mobile;
      if (appData.street && !customer.street) enrichmentData.street = appData.street;
      if (appData.zip_code && !customer.zip_code) enrichmentData.zip_code = appData.zip_code;
      if (appData.city && !customer.city) enrichmentData.city = appData.city;
      if (appData.canton && !customer.canton) enrichmentData.canton = appData.canton;
      if (appData.birthdate && !customer.birthdate) enrichmentData.birthdate = appData.birthdate;
      if (appData.ahv_number && !customer.ahv_number) enrichmentData.ahv_number = appData.ahv_number;
      if (appData.nationality && !customer.nationality) enrichmentData.nationality = appData.nationality;
      if (appData.profession && !customer.profession) enrichmentData.profession = appData.profession;

      // Firmenkunden-Felder
      if (customer.customer_type === 'business' || app.kundentyp === 'firma') {
        if (appData.company_name && !customer.company_name) enrichmentData.company_name = appData.company_name;
        if (appData.legal_form && !customer.legal_form) enrichmentData.legal_form = appData.legal_form;
        if (appData.uid_number && !customer.uid_number) enrichmentData.uid_number = appData.uid_number;
        if (appData.industry && !customer.industry) enrichmentData.industry = appData.industry;
      }

      if (Object.keys(enrichmentData).length === 0) {
        skippedCount++;
        continue;
      }

      try {
        await base44.asServiceRole.entities.Customer.update(customer.id, enrichmentData);
        // Update local cache to prevent double-enrichment within this run
        Object.assign(customerMap[customer.id], enrichmentData);
        enrichedCount++;
        enrichedDetails.push({
          customer_id: customer.id,
          customer_name: `${customer.first_name} ${customer.last_name}`,
          application_id: app.id,
          fields: Object.keys(enrichmentData),
        });
        console.log(`[bulkSync] Enriched customer ${customer.id} (${customer.first_name} ${customer.last_name}) with: ${Object.keys(enrichmentData).join(', ')}`);
      } catch (e) {
        errorCount++;
        console.error(`[bulkSync] Failed to update customer ${customer.id}: ${e.message}`);
      }
    }

    console.log(`[bulkSync] DONE — enriched: ${enrichedCount}, skipped: ${skippedCount}, errors: ${errorCount}`);

    return Response.json({
      success: true,
      total_applications: applications.length,
      enriched: enrichedCount,
      skipped: skippedCount,
      errors: errorCount,
      details: enrichedDetails,
    });

  } catch (error) {
    console.error('[bulkSyncApplicationsToCustomers] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Extrahiere relevante Kundendaten aus einem Antrag
 * Prüft direkte Felder UND sparte_data
 */
function extractFromApplication(app) {
  const s = app.sparte_data || {};
  
  return {
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
}