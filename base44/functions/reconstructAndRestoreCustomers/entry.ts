import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * CUSTOMER RECONSTRUCTION & RESTORATION
 * 
 * Takes missing customer IDs and reconstructs them from relation data.
 * Creates minimal but complete Customer records.
 * 
 * SAFE: Only creates missing records, preserves all existing relations
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { reconstruction_report } = await req.json();
    
    if (!reconstruction_report || !Array.isArray(reconstruction_report.reconstruction_needed)) {
      return Response.json({
        status: 'error',
        message: 'reconstruction_report required',
        instructions: 'First run reconstructCustomersFromRelations to get the report'
      });
    }

    console.log(`[RESTORE] Starting customer reconstruction for ${reconstruction_report.reconstruction_needed.length} customers`);
    const startTime = Date.now();

    const toRestore = reconstruction_report.reconstruction_needed;
    let created = 0;
    let failed = 0;
    const failedRecords = [];

    // Get default organization if not specified
    let defaultOrgId = null;
    try {
      const orgs = await base44.entities.Organization.list('', 1);
      if (orgs?.length > 0) defaultOrgId = orgs[0].id;
    } catch (e) {
      console.warn('[RESTORE] Could not fetch default org:', e.message);
    }

    // Process each missing customer
    for (const record of toRestore) {
      try {
        // Extract first/last name from customer_name if possible
        const names = (record.customer_name || 'Unknown Customer').split(' ');
        const first_name = names[0] || 'Unknown';
        const last_name = names.slice(1).join(' ') || 'Customer';

        const customerData = {
          id: record.customer_id, // Important: preserve original ID
          first_name,
          last_name,
          email: `${record.customer_id}@reconstructed.local`,
          customer_type: 'private',
          status: 'active',
          mandate_status: 'pending',
          organization_id: record.organization_id || defaultOrgId || 'UNASSIGNED',
          advisor_id: record.advisor_id || '',
          notes: `[AUTO-RECONSTRUCTED] From ${record.total_sources} relations - ${new Date().toISOString()}`,
          archived: false // Ensure visibility
        };

        console.log(`[RESTORE] Creating customer ${record.customer_id}: ${first_name} ${last_name}`);
        
        const created_customer = await base44.entities.Customer.create(customerData);
        
        if (created_customer?.id) {
          created++;
          console.log(`[RESTORE] ✓ Created: ${created_customer.id}`);
        } else {
          failed++;
          failedRecords.push({
            customer_id: record.customer_id,
            error: 'Create returned no ID'
          });
        }
      } catch (error) {
        failed++;
        const errorMsg = error.message?.substring(0, 100) || 'Unknown error';
        console.error(`[RESTORE] ✗ Failed ${record.customer_id}: ${errorMsg}`);
        failedRecords.push({
          customer_id: record.customer_id,
          error: errorMsg
        });
      }

      // Rate limiting
      if ((created + failed) % 5 === 0) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    console.log(`[RESTORE] Complete: ${created} created, ${failed} failed in ${Date.now() - startTime}ms`);

    return Response.json({
      status: 'reconstruction_complete',
      timestamp: new Date().toISOString(),
      summary: {
        total_attempted: toRestore.length,
        successfully_created: created,
        failed: failed,
        success_rate: toRestore.length > 0 ? ((created / toRestore.length) * 100).toFixed(1) : '0'
      },
      next_steps: [
        '1. Verify reconstructed customers in dashboard',
        '2. Check Customer 360 page for restored visibility',
        '3. Verify all contracts/applications still linked',
        '4. Run validateSystemIntegrity to confirm data consistency'
      ],
      failed_records: failedRecords.slice(0, 20),
      admin_action: user.email
    });
    
  } catch (error) {
    console.error('[RESTORE] Fatal error:', error.message);
    return Response.json({ 
      status: 'error', 
      error: error.message
    }, { status: 500 });
  }
});