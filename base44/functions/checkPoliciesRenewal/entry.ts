import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * CHECK POLICIES RENEWAL
 * 
 * Scheduled daily: checks if any policies reach renewal_date
 * Sets status = renewal_due for auto_renew=true policies
 * 
 * CRITICAL: Does NOT create new version yet (separate function)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const today = new Date().toISOString().split('T')[0];
    console.log(`[checkPoliciesRenewal] START date=${today}`);

    // ─── FETCH ALL ACTIVE POLICIES ───
    const policies = await base44.entities.Contract.filter({
      status: 'active',
      auto_renew: true,
    });

    let renewalCount = 0;
    const updates = [];

    for (const policy of policies) {
      if (!policy.renewal_date) continue;

      // Check if today >= renewal_date
      if (today >= policy.renewal_date) {
        console.log(
          `[checkPoliciesRenewal] ⚠️ Policy ${policy.id} ready for renewal (date=${policy.renewal_date})`
        );

        // Update status
        await base44.entities.Contract.update(policy.id, {
          status: 'renewal_due',
        });

        updates.push({
          policy_id: policy.id,
          policy_number: policy.policy_number,
          renewal_date: policy.renewal_date,
        });

        renewalCount++;
      }
    }

    console.log(`[checkPoliciesRenewal] ✅ COMPLETE: ${renewalCount} policies marked renewal_due`);

    return Response.json({
      success: true,
      date: today,
      policies_renewal_due: renewalCount,
      updates,
    });
  } catch (error) {
    console.error(`[checkPoliciesRenewal] ERROR: ${error.message}`);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});