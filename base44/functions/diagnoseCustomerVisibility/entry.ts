import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * DIAGNOSE CUSTOMER VISIBILITY ISSUES
 * 
 * Checks if reconstructed customers exist but are hidden due to:
 * - visibility flags
 * - lifecycle status
 * - archived state
 * - owner assignment
 * - query filters
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('[DIAGNOSE] Starting customer visibility diagnosis...');
    const startTime = Date.now();

    // Fetch ALL customers (no filters)
    const allCustomers = await base44.entities.Customer.list('-created_date', 5000);
    console.log(`[DIAGNOSE] Total customers in database: ${allCustomers.length}`);

    // Categorize by visibility state
    const visibility = {
      total: allCustomers.length,
      archived: [],
      missing_organization: [],
      missing_owner: [],
      lifecycle_issues: [],
      email_reconstructed: [], // Temp email pattern
      fully_healthy: [],
      potentially_hidden: []
    };

    const organizationIds = new Set();
    
    for (const customer of allCustomers) {
      const issues = [];

      // Check archived
      if (customer.archived === true) {
        visibility.archived.push({
          id: customer.id,
          name: `${customer.first_name} ${customer.last_name}`,
          archived_at: customer.archived_at,
          archived_by: customer.archived_by
        });
        issues.push('archived');
      }

      // Check organization
      if (!customer.organization_id) {
        visibility.missing_organization.push({
          id: customer.id,
          name: `${customer.first_name} ${customer.last_name}`,
          created_date: customer.created_date
        });
        issues.push('no_org');
      } else {
        organizationIds.add(customer.organization_id);
      }

      // Check reconstructed pattern (temp email)
      if (customer.email?.includes('@reconstructed.local')) {
        visibility.email_reconstructed.push({
          id: customer.id,
          name: `${customer.first_name} ${customer.last_name}`,
          email: customer.email,
          created_date: customer.created_date
        });
        issues.push('reconstructed');
      }

      // Check lifecycle/status
      if (customer.status !== 'active' && customer.status !== undefined) {
        visibility.lifecycle_issues.push({
          id: customer.id,
          name: `${customer.first_name} ${customer.last_name}`,
          status: customer.status,
          mandate_status: customer.mandate_status
        });
        issues.push('inactive_status');
      }

      // Identify potentially hidden
      if (issues.length > 0) {
        visibility.potentially_hidden.push({
          id: customer.id,
          name: `${customer.first_name} ${customer.last_name}`,
          issues,
          archived: customer.archived,
          status: customer.status,
          organization_id: customer.organization_id,
          email: customer.email
        });
      }

      if (issues.length === 0) {
        visibility.fully_healthy.push({
          id: customer.id,
          name: `${customer.first_name} ${customer.last_name}`
        });
      }
    }

    // Check contracts for linked customers
    const contracts = await base44.entities.Contract.list('-created_date', 5000);
    const customersInContracts = new Set(contracts.map(c => c.customer_id));
    
    const orphanedContracts = [];
    const brokenRelations = [];
    
    for (const contract of contracts) {
      if (!customersInContracts.has(contract.customer_id)) {
        orphanedContracts.push({
          contract_id: contract.id,
          customer_id: contract.customer_id,
          customer_name: contract.customer_name
        });
      }
      
      const linkedCustomer = allCustomers.find(c => c.id === contract.customer_id);
      if (linkedCustomer && (linkedCustomer.archived || !linkedCustomer.organization_id)) {
        brokenRelations.push({
          contract_id: contract.id,
          customer_id: contract.customer_id,
          customer_archived: linkedCustomer.archived,
          customer_missing_org: !linkedCustomer.organization_id
        });
      }
    }

    console.log(`[DIAGNOSE] Analysis complete: ${visibility.fully_healthy.length} healthy, ${visibility.potentially_hidden.length} issues`);

    return Response.json({
      status: 'diagnosis_complete',
      timestamp: new Date().toISOString(),
      summary: {
        total_customers: visibility.total,
        healthy_customers: visibility.fully_healthy.length,
        archived_customers: visibility.archived.length,
        missing_organization: visibility.missing_organization.length,
        reconstructed_pattern: visibility.email_reconstructed.length,
        inactive_status: visibility.lifecycle_issues.length,
        potentially_hidden: visibility.potentially_hidden.length,
        contracts_with_hidden_customers: brokenRelations.length
      },
      visibility_issues: {
        archived: visibility.archived.slice(0, 10),
        missing_organization: visibility.missing_organization.slice(0, 10),
        reconstructed_emails: visibility.email_reconstructed.slice(0, 10),
        lifecycle_issues: visibility.lifecycle_issues.slice(0, 10),
        broken_relations: brokenRelations.slice(0, 10)
      },
      next_steps: [
        visibility.potentially_hidden.length > 0 
          ? `1. Run forceCustomerVisibility to fix ${visibility.potentially_hidden.length} hidden customers`
          : '1. No hidden customers detected',
        '2. Verify frontend queries include active status filter',
        '3. Clear dashboard cache and refresh',
        '4. Run validateSystemIntegrity again'
      ],
      potentially_hidden_details: visibility.potentially_hidden.slice(0, 20)
    });
    
  } catch (error) {
    console.error('[DIAGNOSE] Error:', error.message);
    return Response.json({ 
      status: 'error', 
      error: error.message
    }, { status: 500 });
  }
});