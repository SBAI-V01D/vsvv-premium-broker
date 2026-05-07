import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { event, data, old_data } = await req.json();

    if (event.type !== 'create' && event.type !== 'update') {
      return Response.json({ status: 'skipped', reason: 'Not a create/update event' });
    }

    const application = data;

    if (!application || !application.customer_id) {
      return Response.json({ status: 'skipped', reason: 'No customer_id in application' });
    }

    // Fetch application details to get extracted data
    let appDetails;
    try {
      appDetails = await base44.entities.Application.get(application.id);
    } catch (e) {
      console.log(`[SYNC_APP_CUSTOMER] Could not fetch application ${application.id}`);
      return Response.json({ status: 'error', error: e.message }, { status: 500 });
    }

    if (!appDetails) {
      return Response.json({ status: 'skipped', reason: 'Application not found' });
    }

    // Build extracted data from application fields
    const extractedData = {
      first_name: appDetails.first_name || '',
      last_name: appDetails.last_name || '',
      company_name: appDetails.company_name || '',
      email: appDetails.email || '',
      phone: appDetails.phone || '',
      mobile: appDetails.mobile || '',
      street: appDetails.street || '',
      zip_code: appDetails.zip_code || '',
      city: appDetails.city || '',
      canton: appDetails.canton || '',
      birthdate: appDetails.birthdate || '',
      legal_form: appDetails.legal_form || '',
      uid_number: appDetails.uid_number || '',
      industry: appDetails.industry || '',
      contact_person_firstname: appDetails.contact_person_firstname || '',
      contact_person_lastname: appDetails.contact_person_lastname || '',
      nationality: appDetails.nationality || 'CH',
    };

    // Fetch existing customer
    let customer;
    try {
      customer = await base44.entities.Customer.get(appDetails.customer_id);
    } catch (e) {
      console.log(`[SYNC_APP_CUSTOMER] Customer ${appDetails.customer_id} not found, skipping enrichment`);
      return Response.json({ status: 'skipped', reason: 'Customer not found for enrichment' });
    }

    if (!customer) {
      return Response.json({ status: 'skipped', reason: 'Customer not found' });
    }

    // Build enrichment data
    const enrichmentData = {};

    // Only add missing data
    if (extractedData.email && !customer.email) enrichmentData.email = extractedData.email;
    if (extractedData.phone && !customer.phone) enrichmentData.phone = extractedData.phone;
    if (extractedData.mobile && !customer.mobile) enrichmentData.mobile = extractedData.mobile;
    if (extractedData.street && !customer.street) enrichmentData.street = extractedData.street;
    if (extractedData.zip_code && !customer.zip_code) enrichmentData.zip_code = extractedData.zip_code;
    if (extractedData.city && !customer.city) enrichmentData.city = extractedData.city;
    if (extractedData.canton && !customer.canton) enrichmentData.canton = extractedData.canton;
    if (extractedData.birthdate && !customer.birthdate) enrichmentData.birthdate = extractedData.birthdate;
    if (extractedData.nationality && !customer.nationality) enrichmentData.nationality = extractedData.nationality;

    // Company customer enrichment
    if (customer.customer_type === 'business') {
      if (extractedData.company_name && !customer.company_name) enrichmentData.company_name = extractedData.company_name;
      if (extractedData.legal_form && !customer.legal_form) enrichmentData.legal_form = extractedData.legal_form;
      if (extractedData.uid_number && !customer.uid_number) enrichmentData.uid_number = extractedData.uid_number;
      if (extractedData.industry && !customer.industry) enrichmentData.industry = extractedData.industry;
    }

    // Apply enrichment if there's data to add
    if (Object.keys(enrichmentData).length > 0) {
      try {
        await base44.entities.Customer.update(customer.id, enrichmentData);
        console.log(`[SYNC_APP_CUSTOMER] Enriched customer ${customer.id} from application ${application.id}`);
        return Response.json({ status: 'success', enriched_fields: Object.keys(enrichmentData) });
      } catch (e) {
        console.error(`[SYNC_APP_CUSTOMER] Enrichment failed: ${e.message}`);
        return Response.json({ status: 'error', error: e.message }, { status: 500 });
      }
    }

    return Response.json({ status: 'skipped', reason: 'No enrichment needed' });

  } catch (error) {
    console.error('[SYNC_APP_CUSTOMER] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});