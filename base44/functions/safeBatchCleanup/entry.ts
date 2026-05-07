import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * SAFE BATCH CLEANUP - ONLY DELETES TRACKED IMPORT BATCHES
 * 
 * - ONLY targets customers with matching import_batch_id
 * - SKIPS customers with contracts/applications/documents
 * - Uses SOFT DELETE (archived flag) not hard delete
 * - Full audit logging
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { batch_id } = await req.json();

    if (!batch_id) {
      return Response.json({ 
        error: 'batch_id required (e.g., "import_20260507_001")' 
      }, { status: 400 });
    }

    // Get customers in this batch ONLY
    const customers = await base44.entities.Customer.filter({ import_batch_id: batch_id });
    
    if (!customers || customers.length === 0) {
      return Response.json({
        status: 'success',
        batch_id,
        message: `No customers found for batch: ${batch_id}`
      });
    }

    console.log(`[SAFE_CLEANUP] Batch ${batch_id}: Found ${customers.length} customers`);

    // Start cleanup in background
    (async () => {
      const stats = {
        archived: 0,
        skipped_with_contracts: 0,
        skipped_with_applications: 0,
        skipped_with_documents: 0,
        errors: 0
      };

      // Get all contracts, applications, documents once
      const [allContracts, allApps, allDocs] = await Promise.all([
        base44.entities.Contract.list('', 5000),
        base44.entities.Application.list('', 5000),
        base44.entities.Document.list('', 5000)
      ]);

      const contractCustomerIds = new Set(allContracts.map(c => c.customer_id));
      const appCustomerIds = new Set(allApps.map(a => a.customer_id));
      const docCustomerIds = new Set(allDocs.map(d => d.customer_id));

      for (const customer of customers) {
        // PROTECTION: Skip if customer has active relations
        if (contractCustomerIds.has(customer.id)) {
          stats.skipped_with_contracts++;
          console.warn(`[SAFE_CLEANUP] Skipping ${customer.id} - has contracts`);
          continue;
        }
        if (appCustomerIds.has(customer.id)) {
          stats.skipped_with_applications++;
          console.warn(`[SAFE_CLEANUP] Skipping ${customer.id} - has applications`);
          continue;
        }
        if (docCustomerIds.has(customer.id)) {
          stats.skipped_with_documents++;
          console.warn(`[SAFE_CLEANUP] Skipping ${customer.id} - has documents`);
          continue;
        }

        // SOFT DELETE: Archive instead of hard delete
        try {
          await base44.entities.Customer.update(customer.id, {
            archived: true,
            archived_at: new Date().toISOString(),
            archived_batch_id: batch_id,
            archived_by: user.email
          });
          stats.archived++;
        } catch (e) {
          console.error(`[SAFE_CLEANUP] Failed to archive ${customer.id}: ${e.message}`);
          stats.errors++;
        }

        // Rate limit
        if (stats.archived % 10 === 0) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      console.log(`[SAFE_CLEANUP] Batch ${batch_id} completed: ${JSON.stringify(stats)}`);
    })();

    return Response.json({
      status: 'success',
      batch_id,
      customers_found: customers.length,
      message: `Cleanup läuft... ${customers.length} Kunden werden überprüft (archiviert wenn sicher)`
    });
    
  } catch (error) {
    console.error('[SAFE_CLEANUP] Error:', error.message);
    return Response.json({ status: 'error', error: error.message }, { status: 500 });
  }
});