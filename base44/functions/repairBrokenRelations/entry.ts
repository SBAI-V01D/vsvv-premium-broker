import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * REPAIR BROKEN RELATIONS
 * 
 * After customer reconstruction, contracts/applications still reference
 * old customer_ids. This function remaps them to new reconstructed IDs.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('[REPAIR] Starting broken relation repair...');
    const startTime = Date.now();

    // Fetch all customers
    const customers = await base44.entities.Customer.list('-created_date', 5000);
    console.log(`[REPAIR] Loaded ${customers.length} customers`);

    // Build mapping: customer_name → customer_id (prefer reconstructed ones)
    // Also support email-based matching
    const nameToId = {};
    const emailToId = {};
    for (const customer of customers) {
      const fullName = `${customer.first_name} ${customer.last_name}`.trim();
      nameToId[fullName] = customer.id;
      if (customer.email) {
        emailToId[customer.email.toLowerCase()] = customer.id;
      }
      console.log(`[REPAIR] Mapped: ${fullName} → ${customer.id}`);
    }

    // Fetch all contracts with orphaned references
    const contracts = await base44.entities.Contract.list('-created_date', 5000);
    const orphanedContracts = contracts.filter(c => {
      const linkedCustomer = customers.find(cu => cu.id === c.customer_id);
      return !linkedCustomer;
    });

    console.log(`[REPAIR] Found ${orphanedContracts.length} orphaned contracts`);

    let contractsFixed = 0;
    for (const contract of orphanedContracts) {
      try {
        let newCustomerId = nameToId[contract.customer_name];
        
        // If name match fails, try email-based matching
        if (!newCustomerId && contract.customer_id) {
          // Try to find in other contracts/docs with same ID but different name
          for (const other of contracts) {
            if (other.customer_id === contract.customer_id && other.customer_name !== contract.customer_name) {
              newCustomerId = nameToId[other.customer_name];
              break;
            }
          }
        }
        
        if (newCustomerId && newCustomerId !== contract.customer_id) {
          console.log(`[REPAIR] Contract ${contract.id}: ${contract.customer_id} → ${newCustomerId}`);
          await base44.entities.Contract.update(contract.id, {
            customer_id: newCustomerId
          });
          contractsFixed++;
        } else {
          console.log(`[REPAIR] Could not find mapping for: ${contract.customer_name} (${contract.customer_id})`);
        }
      } catch (e) {
        console.error(`[REPAIR] Failed to update contract ${contract.id}: ${e.message}`);
      }

      if ((contractsFixed + 1) % 5 === 0) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    // Fetch all applications with orphaned references
    const applications = await base44.entities.Application.list('-created_date', 5000);
    const orphanedApplications = applications.filter(a => {
      const linkedCustomer = customers.find(cu => cu.id === a.customer_id);
      return !linkedCustomer;
    });

    console.log(`[REPAIR] Found ${orphanedApplications.length} orphaned applications`);

    let applicationsFixed = 0;
    for (const application of orphanedApplications) {
      try {
        const name = application.customer_name;
        const newCustomerId = nameToId[name];
        
        if (newCustomerId && newCustomerId !== application.customer_id) {
          console.log(`[REPAIR] Application ${application.id}: ${application.customer_id} → ${newCustomerId}`);
          // Only update customer_id — do NOT pass full object (avoids required-field validation errors)
          await base44.entities.Application.update(application.id, {
            customer_id: newCustomerId,
          });
          applicationsFixed++;
        }
      } catch (e) {
        console.error(`[REPAIR] Failed to update application ${application.id}: ${e.message}`);
      }

      if ((applicationsFixed + 1) % 5 === 0) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    // Fetch all documents with orphaned references
    const documents = await base44.entities.Document.list('-created_date', 5000);
    const orphanedDocuments = documents.filter(d => {
      const linkedCustomer = customers.find(cu => cu.id === d.customer_id);
      return !linkedCustomer && d.customer_id;
    });

    console.log(`[REPAIR] Found ${orphanedDocuments.length} orphaned documents`);

    let documentsFixed = 0;
    for (const document of orphanedDocuments) {
      try {
        const name = document.customer_name;
        const newCustomerId = nameToId[name];
        
        if (newCustomerId && newCustomerId !== document.customer_id) {
          console.log(`[REPAIR] Document ${document.id}: ${document.customer_id} → ${newCustomerId}`);
          await base44.entities.Document.update(document.id, {
            customer_id: newCustomerId
          });
          documentsFixed++;
        }
      } catch (e) {
        console.error(`[REPAIR] Failed to update document ${document.id}: ${e.message}`);
      }

      if ((documentsFixed + 1) % 5 === 0) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[REPAIR] Complete: ${contractsFixed}+${applicationsFixed}+${documentsFixed} fixed in ${elapsed}ms`);

    return Response.json({
      status: 'relations_repaired',
      timestamp: new Date().toISOString(),
      summary: {
        customers_mapped: Object.keys(nameToId).length,
        orphaned_contracts_found: orphanedContracts.length,
        contracts_fixed: contractsFixed,
        orphaned_applications_found: orphanedApplications.length,
        applications_fixed: applicationsFixed,
        orphaned_documents_found: orphanedDocuments.length,
        documents_fixed: documentsFixed,
        total_fixed: contractsFixed + applicationsFixed + documentsFixed
      },
      next_steps: [
        '1. Run validateSystemIntegrity again',
        '2. Verify Customer 360 pages load',
        '3. Check contract/application links'
      ]
    });
    
  } catch (error) {
    console.error('[REPAIR] Fatal error:', error.message);
    return Response.json({ 
      status: 'error', 
      error: error.message
    }, { status: 500 });
  }
});