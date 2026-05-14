import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { event, data, old_data } = await req.json();

    if (event.type !== 'update') {
      return Response.json({ status: 'skipped', reason: 'Only processes updates' });
    }

    const application = data;

    // Diese Funktion ist redundant mit onApplicationUpdate
    // onApplicationUpdate kümmert sich bereits um Vertragserstellung
    // Diese Funktion wird deaktiviert um Duplikate zu verhindern
    return Response.json({ 
      status: 'skipped', 
      reason: 'Disabled - onApplicationUpdate handles contract creation' 
    });

    if (!application.customer_id || !application.insurer) {
      return Response.json({ status: 'skipped', reason: 'Missing customer_id or insurer' });
    }

    // Check if contract already exists for this application
    try {
      const existing = await base44.entities.Contract.filter({
        source_application_id: application.id
      }, '-created_date', 1);

      if (existing && existing.length > 0) {
        console.log(`[APP_TO_CONTRACT] Contract already exists for application ${application.id}`);
        return Response.json({ status: 'skipped', reason: 'Contract already exists' });
      }
    } catch (e) {
      console.warn(`[APP_TO_CONTRACT] Could not check existing contracts: ${e.message}`);
    }

    // Fetch customer for organization/advisor inheritance
    let customer;
    try {
      customer = await base44.entities.Customer.get(application.customer_id);
    } catch (e) {
      console.log(`[APP_TO_CONTRACT] Customer ${application.customer_id} not found`);
      return Response.json({ status: 'error', error: 'Customer not found' }, { status: 404 });
    }

    if (!customer) {
      return Response.json({ status: 'error', error: 'Customer not found' }, { status: 404 });
    }

    // Build contract data from application
    const contractData = {
      customer_id: application.customer_id,
      customer_name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Unknown',
      organization_id: customer.organization_id || application.organization_id,
      advisor_id: customer.advisor_id || application.advisor_id,
      insurer: application.insurer,
      insurance_type: application.insurance_type || application.sparte || 'other',
      product: application.product || '',
      policy_number: application.policy_number || `APP-${application.id.substring(0, 8)}`,
      premium_yearly: application.estimated_premium_yearly || 0,
      premium_monthly: application.estimated_premium_monthly || 0,
      status: 'active',
      start_date: application.contract_start_date || new Date().toISOString().split('T')[0],
      end_date: application.contract_end_date || '',
      auto_renew: true,
      source_application_id: application.id,
      notes: `Auto-created from application ${application.id}`,
    };

    // Inherit sparte-specific data if available
    if (application.sparte_data) {
      contractData.sparte = application.sparte || '';
      contractData.sparte_data = application.sparte_data;
    }

    // Create contract
    try {
      const created = await base44.entities.Contract.create(contractData);
      console.log(`[APP_TO_CONTRACT] Created contract ${created.id} from application ${application.id}`);

      // Update application with linked contract
      try {
        await base44.entities.Application.update(application.id, {
          linked_contract_id: created.id,
          status_changed_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn(`[APP_TO_CONTRACT] Could not link contract back to application: ${e.message}`);
      }

      return Response.json({
        status: 'success',
        contract_id: created.id,
        customer_id: application.customer_id,
      });
    } catch (e) {
      console.error(`[APP_TO_CONTRACT] Contract creation failed: ${e.message}`);
      return Response.json({ error: e.message }, { status: 500 });
    }

  } catch (error) {
    console.error('[APP_TO_CONTRACT] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});