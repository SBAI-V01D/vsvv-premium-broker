import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * SYSTEM INTEGRITY VALIDATION
 * 
 * Verifies that all customer/contract/application/document relations are intact
 * after reconstruction.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('[VALIDATE] Starting system integrity check...');
    const startTime = Date.now();

    // Fetch all entities
    const [customers, contracts, applications, documents, tasks] = await Promise.all([
      base44.entities.Customer.list('-created_date', 5000),
      base44.entities.Contract.list('-created_date', 10000),
      base44.entities.Application.list('-created_date', 10000),
      base44.entities.Document.list('-created_date', 10000),
      base44.entities.Task.list('-created_date', 5000)
    ]);

    console.log(`[VALIDATE] Loaded ${customers.length} customers, ${contracts.length} contracts, ${applications.length} applications`);

    // Build indexes
    const customerIds = new Set(customers.map(c => c.id));
    const contractIds = new Set(contracts.map(c => c.id));
    const applicationIds = new Set(applications.map(a => a.id));

    // Validation results
    const issues = [];
    const stats = {
      total_customers: customers.length,
      total_contracts: contracts.length,
      total_applications: applications.length,
      total_documents: documents.length,
      total_tasks: tasks.length,
      orphaned_contracts: 0,
      orphaned_applications: 0,
      orphaned_documents: 0,
      orphaned_tasks: 0,
      missing_organization_ids: 0,
      archived_but_active: 0
    };

    // Check contracts
    for (const contract of contracts) {
      if (!customerIds.has(contract.customer_id)) {
        stats.orphaned_contracts++;
        issues.push({
          type: 'orphaned_contract',
          entity_id: contract.id,
          customer_id: contract.customer_id,
          severity: 'HIGH'
        });
      }
      if (!contract.organization_id) {
        stats.missing_organization_ids++;
      }
    }

    // Check applications
    for (const app of applications) {
      if (!customerIds.has(app.customer_id)) {
        stats.orphaned_applications++;
        issues.push({
          type: 'orphaned_application',
          entity_id: app.id,
          customer_id: app.customer_id,
          severity: 'HIGH'
        });
      }
      if (!app.organization_id) {
        stats.missing_organization_ids++;
      }
    }

    // Check documents
    for (const doc of documents) {
      if (doc.customer_id && !customerIds.has(doc.customer_id)) {
        stats.orphaned_documents++;
        issues.push({
          type: 'orphaned_document',
          entity_id: doc.id,
          customer_id: doc.customer_id,
          severity: 'MEDIUM'
        });
      }
    }

    // Check tasks
    for (const task of tasks) {
      if (task.customer_id && !customerIds.has(task.customer_id)) {
        stats.orphaned_tasks++;
        issues.push({
          type: 'orphaned_task',
          entity_id: task.id,
          customer_id: task.customer_id,
          severity: 'MEDIUM'
        });
      }
    }

    // Check archived customers with relations
    for (const customer of customers) {
      if (customer.archived) {
        const hasRelations = contracts.some(c => c.customer_id === customer.id) ||
                           applications.some(a => a.customer_id === customer.id);
        if (hasRelations) {
          stats.archived_but_active++;
          issues.push({
            type: 'archived_with_relations',
            customer_id: customer.id,
            customer_name: `${customer.first_name} ${customer.last_name}`,
            severity: 'MEDIUM'
          });
        }
      }
    }

    const integrity_ok = issues.length === 0;
    console.log(`[VALIDATE] Complete: ${integrity_ok ? '✓ PASS' : '✗ ISSUES FOUND'} in ${Date.now() - startTime}ms`);

    return Response.json({
      status: integrity_ok ? 'valid' : 'issues_found',
      timestamp: new Date().toISOString(),
      integrity_check: integrity_ok ? 'PASSED ✓' : 'FAILED ✗',
      statistics: stats,
      issues: issues.slice(0, 50),
      total_issues: issues.length,
      recommendations: integrity_ok 
        ? ['System integrity confirmed', 'All relations intact', 'Ready for production']
        : [
            'Fix orphaned entities',
            'Assign missing organization_ids',
            'Unarchive customers with active relations',
            'Verify system consistency'
          ]
    });
    
  } catch (error) {
    console.error('[VALIDATE] Error:', error.message);
    return Response.json({ 
      status: 'error', 
      error: error.message
    }, { status: 500 });
  }
});