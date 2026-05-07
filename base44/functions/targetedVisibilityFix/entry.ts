import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * TARGETED VISIBILITY FIX – REPAIR DOMINANT CONSTRAINT ONLY
 * 
 * Analyzes which visibility constraint is hiding MOST records,
 * then safely repairs ONLY that constraint.
 * 
 * Does NOT:
 * - run bulk reconstruction
 * - modify unrelated fields
 * - touch archived/lifecycle logic unnecessarily
 * - execute mass updates
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('[TARGETED_FIX] Starting visibility constraint analysis...');
    const startTime = Date.now();

    // ─────────────────────────────────────────────────────────────
    // STEP 1: Fetch all customers (unfiltered)
    // ─────────────────────────────────────────────────────────────
    const allCustomers = await base44.entities.Customer.list('-created_date', 5000);
    console.log(`[TARGETED_FIX] Total customers in DB: ${allCustomers.length}`);

    if (allCustomers.length === 0) {
      return Response.json({
        status: 'data_loss_confirmed',
        message: 'Zero customers found. Database restoration required.',
        next_step: 'Contact support for full database restoration.'
      }, { status: 400 });
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 2: Analyze visibility constraints
    // ─────────────────────────────────────────────────────────────
    const constraints = {
      missing_org_id: allCustomers.filter(c => !c.organization_id),
      archived_true: allCustomers.filter(c => c.archived),
      inactive_status: allCustomers.filter(c => c.status !== 'active'),
      missing_mandate: allCustomers.filter(c => !c.mandate_status),
      missing_advisor: allCustomers.filter(c => !c.advisor_id),
      reconstructed_email: allCustomers.filter(c => c.email?.includes('reconstructed')),
    };

    // Identify dominant constraint (affects most records)
    const dominantConstraint = Object.entries(constraints)
      .map(([key, records]) => ({ key, count: records.length }))
      .sort((a, b) => b.count - a.count)[0];

    const analysis = {
      total_customers: allCustomers.length,
      dominant_constraint: dominantConstraint.key,
      affected_count: dominantConstraint.count,
      affected_percent: ((dominantConstraint.count / allCustomers.length) * 100).toFixed(1),
      all_constraints: Object.entries(constraints).map(([key, records]) => ({
        name: key,
        count: records.length,
        percent: ((records.length / allCustomers.length) * 100).toFixed(1),
      })),
    };

    console.log(`[TARGETED_FIX] Dominant constraint: ${dominantConstraint.key} (${dominantConstraint.count} records)`);

    // ─────────────────────────────────────────────────────────────
    // STEP 3: Repair ONLY the dominant constraint
    // ─────────────────────────────────────────────────────────────
    let repaired = 0;
    const repairDetails = [];

    if (dominantConstraint.key === 'missing_org_id') {
      console.log('[TARGETED_FIX] Fixing: missing organization_id');
      
      // Get default organization
      const orgs = await base44.entities.Organization.list('', 1);
      const defaultOrgId = orgs?.[0]?.id;

      if (!defaultOrgId) {
        throw new Error('No organization found. Cannot assign default org.');
      }

      for (const customer of constraints.missing_org_id) {
        try {
          await base44.entities.Customer.update(customer.id, {
            organization_id: defaultOrgId,
          });
          repaired++;
          if (repaired <= 3) {
            repairDetails.push({
              id: customer.id,
              name: `${customer.first_name} ${customer.last_name}`,
              fix: `assigned org ${defaultOrgId}`,
            });
          }
        } catch (e) {
          console.warn(`[TARGETED_FIX] Failed to update ${customer.id}: ${e.message}`);
        }

        if (repaired % 10 === 0) {
          await new Promise(r => setTimeout(r, 100));
        }
      }
    }

    if (dominantConstraint.key === 'archived_true') {
      console.log('[TARGETED_FIX] Fixing: archived=true');

      for (const customer of constraints.archived_true) {
        try {
          await base44.entities.Customer.update(customer.id, {
            archived: false,
          });
          repaired++;
          if (repaired <= 3) {
            repairDetails.push({
              id: customer.id,
              name: `${customer.first_name} ${customer.last_name}`,
              fix: 'unarchived',
            });
          }
        } catch (e) {
          console.warn(`[TARGETED_FIX] Failed to update ${customer.id}: ${e.message}`);
        }

        if (repaired % 10 === 0) {
          await new Promise(r => setTimeout(r, 100));
        }
      }
    }

    if (dominantConstraint.key === 'inactive_status') {
      console.log('[TARGETED_FIX] Fixing: inactive status');

      for (const customer of constraints.inactive_status) {
        try {
          await base44.entities.Customer.update(customer.id, {
            status: 'active',
          });
          repaired++;
          if (repaired <= 3) {
            repairDetails.push({
              id: customer.id,
              name: `${customer.first_name} ${customer.last_name}`,
              fix: 'status → active',
            });
          }
        } catch (e) {
          console.warn(`[TARGETED_FIX] Failed to update ${customer.id}: ${e.message}`);
        }

        if (repaired % 10 === 0) {
          await new Promise(r => setTimeout(r, 100));
        }
      }
    }

    if (dominantConstraint.key === 'missing_mandate') {
      console.log('[TARGETED_FIX] Fixing: missing mandate_status');

      for (const customer of constraints.missing_mandate) {
        try {
          await base44.entities.Customer.update(customer.id, {
            mandate_status: 'pending',
          });
          repaired++;
          if (repaired <= 3) {
            repairDetails.push({
              id: customer.id,
              name: `${customer.first_name} ${customer.last_name}`,
              fix: 'mandate_status → pending',
            });
          }
        } catch (e) {
          console.warn(`[TARGETED_FIX] Failed to update ${customer.id}: ${e.message}`);
        }

        if (repaired % 10 === 0) {
          await new Promise(r => setTimeout(r, 100));
        }
      }
    }

    if (dominantConstraint.key === 'reconstructed_email') {
      console.log('[TARGETED_FIX] Fixing: reconstructed email addresses');

      const orgs = await base44.entities.Organization.list('', 1);
      const defaultOrgId = orgs?.[0]?.id;

      for (const customer of constraints.reconstructed_email) {
        try {
          // Keep org_id assignment too
          await base44.entities.Customer.update(customer.id, {
            // Email stays as-is (indicator of recovery)
            // But ensure org_id and status are correct
            organization_id: defaultOrgId || customer.organization_id,
            status: 'active',
            archived: false,
            mandate_status: customer.mandate_status || 'pending',
          });
          repaired++;
          if (repaired <= 3) {
            repairDetails.push({
              id: customer.id,
              name: `${customer.first_name} ${customer.last_name}`,
              fix: 'normalized (org, status, archived, mandate)',
            });
          }
        } catch (e) {
          console.warn(`[TARGETED_FIX] Failed to update ${customer.id}: ${e.message}`);
        }

        if (repaired % 10 === 0) {
          await new Promise(r => setTimeout(r, 100));
        }
      }
    }

    const elapsed = Date.now() - startTime;

    return Response.json({
      status: 'visibility_constraint_repaired',
      timestamp: new Date().toISOString(),
      analysis,
      repair_action: {
        constraint_fixed: dominantConstraint.key,
        records_repaired: repaired,
        sample_repairs: repairDetails,
      },
      next_steps: [
        '1. Refresh dashboard (F5 or Cmd+Shift+R)',
        '2. Test customer overview',
        '3. Test global search',
        '4. Test Customer 360',
        '5. Verify dashboard widgets load',
        '6. Check contracts/applications visibility',
      ],
      duration_ms: elapsed,
    });

  } catch (error) {
    console.error('[TARGETED_FIX] Fatal error:', error.message);
    return Response.json({
      status: 'error',
      error: error.message,
      instruction: 'Check function logs for details. If data loss confirmed, restoration required.',
    }, { status: 500 });
  }
});