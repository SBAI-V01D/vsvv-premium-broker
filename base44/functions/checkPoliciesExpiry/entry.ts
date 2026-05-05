import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * CHECK POLICIES EXPIRY
 * 
 * Scheduled daily: checks if any policies expire (today > end_date)
 * Sets status = expired for non-renewed policies
 * 
 * CRITICAL: Only expires if NOT already renewed
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const today = new Date().toISOString().split('T')[0];
    console.log(`[checkPoliciesExpiry] START date=${today}`);

    // ─── FETCH ACTIVE & RENEWAL_DUE POLICIES ───
    const policies = await base44.entities.Contract.filter({}); // All
    const policyUpdates = policies.filter(
      p => (p.status === 'active' || p.status === 'renewal_due') && p.end_date
    );

    let expiredCount = 0;
    const updates = [];

    for (const policy of policyUpdates) {
      // Check if today > end_date
      if (today > policy.end_date) {
        console.log(
          `[checkPoliciesExpiry] ⚠️ Policy ${policy.id} expired (end_date=${policy.end_date})`
        );

        // Only expire if not renewed
        if (policy.status !== 'renewed') {
          await base44.entities.Contract.update(policy.id, {
            status: 'expired',
          });

          updates.push({
            policy_id: policy.id,
            policy_number: policy.policy_number,
            end_date: policy.end_date,
          });

          expiredCount++;
        }
      }
    }

    console.log(`[checkPoliciesExpiry] ✅ COMPLETE: ${expiredCount} policies marked expired`);

    return Response.json({
      success: true,
      date: today,
      policies_expired: expiredCount,
      updates,
    });
  } catch (error) {
    console.error(`[checkPoliciesExpiry] ERROR: ${error.message}`);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});