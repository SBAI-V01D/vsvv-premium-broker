import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * FORCE CUSTOMER VISIBILITY
 * 
 * Fixes hidden reconstructed customers by:
 * - Setting archived = false
 * - Setting status = active
 * - Assigning default organization if missing
 * - Updating lifecycle flags
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { target_customers } = await req.json();
    
    if (!target_customers || !Array.isArray(target_customers)) {
      return Response.json({
        status: 'error',
        message: 'target_customers array required',
        instructions: 'First run diagnoseCustomerVisibility to get the list'
      });
    }

    console.log(`[VISIBILITY] Forcing visibility for ${target_customers.length} customers...`);
    const startTime = Date.now();

    // Get default organization
    let defaultOrgId = null;
    try {
      const orgs = await base44.entities.Organization.list('', 1);
      if (orgs?.length > 0) defaultOrgId = orgs[0].id;
    } catch (e) {
      console.warn('[VISIBILITY] Could not fetch default org');
    }

    let updated = 0;
    let failed = 0;
    const failedUpdates = [];

    for (const customer of target_customers) {
      try {
        const updateData = {
          archived: false,
          status: 'active',
          mandate_status: 'pending'
        };

        // Assign org if missing
        if (!customer.organization_id && defaultOrgId) {
          updateData.organization_id = defaultOrgId;
        }

        // Remove reconstructed email if needed
        if (customer.email?.includes('@reconstructed.local')) {
          updateData.email = `${customer.first_name.toLowerCase()}.${customer.last_name.toLowerCase()}@restored.local`;
        }

        console.log(`[VISIBILITY] Updating ${customer.id}...`);
        
        await base44.entities.Customer.update(customer.id, updateData);
        updated++;
      } catch (error) {
        failed++;
        failedUpdates.push({
          customer_id: customer.id,
          error: error.message?.substring(0, 100)
        });
        console.error(`[VISIBILITY] Failed ${customer.id}: ${error.message}`);
      }

      if ((updated + failed) % 10 === 0) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    console.log(`[VISIBILITY] Complete: ${updated} updated, ${failed} failed in ${Date.now() - startTime}ms`);

    return Response.json({
      status: 'visibility_forced',
      timestamp: new Date().toISOString(),
      summary: {
        total_targeted: target_customers.length,
        successfully_updated: updated,
        failed: failed,
        success_rate: target_customers.length > 0 ? ((updated / target_customers.length) * 100).toFixed(1) : '0'
      },
      next_steps: [
        '1. Clear frontend cache (Ctrl+Shift+R)',
        '2. Refresh Customers page',
        '3. Verify all customers now visible',
        '4. Run validateSystemIntegrity to confirm'
      ],
      failed_updates: failedUpdates.slice(0, 10)
    });
    
  } catch (error) {
    console.error('[VISIBILITY] Fatal error:', error.message);
    return Response.json({ 
      status: 'error', 
      error: error.message
    }, { status: 500 });
  }
});