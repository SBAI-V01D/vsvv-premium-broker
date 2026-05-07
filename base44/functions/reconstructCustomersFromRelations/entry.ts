import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * CUSTOMER RELATION RECONSTRUCTION
 * 
 * Scans contracts, applications, tasks, documents for customer_id references
 * and reconstructs missing Customer entities from these relations.
 * 
 * SAFE: Only creates missing records, never deletes existing ones
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('[RECONSTRUCTION] Starting customer relation scan...');
    const startTime = Date.now();

    // Get all existing customers to avoid duplicates
    const existingCustomers = await base44.entities.Customer.list('-created_date', 5000);
    const existingCustomerIds = new Set(existingCustomers.map(c => c.id));
    console.log(`[RECONSTRUCTION] Found ${existingCustomers.length} existing customer records`);

    // Scan for customer_id references in related entities
    const customerRefs = new Map(); // customer_id => { sources: [], data: {...} }

    // 1. SCAN CONTRACTS
    console.log('[RECONSTRUCTION] Scanning contracts...');
    const contracts = await base44.entities.Contract.list('-created_date', 10000);
    let contractCount = 0;
    for (const contract of contracts) {
      if (contract.customer_id) {
        if (!customerRefs.has(contract.customer_id)) {
          customerRefs.set(contract.customer_id, {
            sources: [],
            data: {
              customer_id: contract.customer_id,
              customer_name: contract.customer_name,
              organization_id: contract.organization_id,
              advisor_id: contract.advisor_id,
            }
          });
        }
        customerRefs.get(contract.customer_id).sources.push(`contract:${contract.id}`);
        contractCount++;
      }
    }
    console.log(`[RECONSTRUCTION] Contracts scanned: ${contractCount} with customer refs`);

    // 2. SCAN APPLICATIONS
    console.log('[RECONSTRUCTION] Scanning applications...');
    const applications = await base44.entities.Application.list('-created_date', 10000);
    let appCount = 0;
    for (const app of applications) {
      if (app.customer_id) {
        if (!customerRefs.has(app.customer_id)) {
          customerRefs.set(app.customer_id, {
            sources: [],
            data: {
              customer_id: app.customer_id,
              customer_name: app.customer_name,
              organization_id: app.organization_id,
              advisor_id: app.advisor_id,
            }
          });
        }
        customerRefs.get(app.customer_id).sources.push(`application:${app.id}`);
        appCount++;
      }
    }
    console.log(`[RECONSTRUCTION] Applications scanned: ${appCount} with customer refs`);

    // 3. SCAN TASKS
    console.log('[RECONSTRUCTION] Scanning tasks...');
    const tasks = await base44.entities.Task.list('-created_date', 10000);
    let taskCount = 0;
    for (const task of tasks) {
      if (task.customer_id) {
        if (!customerRefs.has(task.customer_id)) {
          customerRefs.set(task.customer_id, {
            sources: [],
            data: {
              customer_id: task.customer_id,
              customer_name: task.customer_name,
              organization_id: '',
            }
          });
        }
        customerRefs.get(task.customer_id).sources.push(`task:${task.id}`);
        taskCount++;
      }
    }
    console.log(`[RECONSTRUCTION] Tasks scanned: ${taskCount} with customer refs`);

    // 4. SCAN DOCUMENTS
    console.log('[RECONSTRUCTION] Scanning documents...');
    const documents = await base44.entities.Document.list('-created_date', 10000);
    let docCount = 0;
    for (const doc of documents) {
      if (doc.customer_id) {
        if (!customerRefs.has(doc.customer_id)) {
          customerRefs.set(doc.customer_id, {
            sources: [],
            data: {
              customer_id: doc.customer_id,
              customer_name: doc.customer_name,
              organization_id: '',
            }
          });
        }
        customerRefs.get(doc.customer_id).sources.push(`document:${doc.id}`);
        docCount++;
      }
    }
    console.log(`[RECONSTRUCTION] Documents scanned: ${docCount} with customer refs`);

    // Summary of findings
    const missingCustomerIds = Array.from(customerRefs.keys()).filter(id => !existingCustomerIds.has(id));
    console.log(`[RECONSTRUCTION] Found ${customerRefs.size} unique customer_id references`);
    console.log(`[RECONSTRUCTION] Missing customer records: ${missingCustomerIds.length}`);

    // Build detailed reconstruction report
    const reconstructionNeeded = [];
    for (const customerId of missingCustomerIds) {
      const ref = customerRefs.get(customerId);
      reconstructionNeeded.push({
        customer_id: customerId,
        customer_name: ref.data.customer_name || '(Unknown)',
        organization_id: ref.data.organization_id || '(Unknown)',
        advisor_id: ref.data.advisor_id || '(Unassigned)',
        relation_count: ref.sources.length,
        sources: ref.sources.slice(0, 10), // First 10 sources
        total_sources: ref.sources.length
      });
    }

    console.log(`[RECONSTRUCTION] Analysis complete in ${Date.now() - startTime}ms`);

    return Response.json({
      status: 'analysis_complete',
      timestamp: new Date().toISOString(),
      summary: {
        total_customer_refs_found: customerRefs.size,
        existing_customer_records: existingCustomers.length,
        missing_customer_records: missingCustomerIds.length,
        contracts_with_customer_refs: contractCount,
        applications_with_customer_refs: appCount,
        tasks_with_customer_refs: taskCount,
        documents_with_customer_refs: docCount
      },
      reconstruction_needed: reconstructionNeeded,
      next_step: missingCustomerIds.length > 0 
        ? 'Call reconstructAndRestoreCustomers with this report'
        : 'No reconstruction needed - all customer references exist',
      admin_action_required: missingCustomerIds.length > 0
    });
    
  } catch (error) {
    console.error('[RECONSTRUCTION] Error:', error.message);
    return Response.json({ 
      status: 'error', 
      error: error.message
    }, { status: 500 });
  }
});