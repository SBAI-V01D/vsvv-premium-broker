import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * CHECK POLICIES RENEWAL
 * 
 * 1. Berechne renewal_alert_start_date (end_date - 180 Tage)
 * 2. SEND erste Alert wenn erreicht
 * 3. Setze renewal_status = notified
 * 
 * Läuft täglich als scheduled task
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log(`[checkPoliciesRenewal] START`);

    // ─── FETCH ALL ACTIVE POLICIES ───
    const policies = await base44.entities.Contract.filter({ status: 'active' }, '-end_date');
    
    let alerted = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const policy of policies) {
      if (!policy.end_date) continue;

      // ─── CALC RENEWAL ALERT DATE (180 days before end) ───
      const endDate = new Date(policy.end_date);
      const alertDate = new Date(endDate);
      alertDate.setDate(alertDate.getDate() - 180);
      alertDate.setHours(0, 0, 0, 0);

      // ─── FIRST ALERT CHECK ───
      if (today >= alertDate && policy.renewal_status !== 'completed') {
        // Only set to notified if currently "none"
        if (policy.renewal_status === 'none') {
          await base44.entities.Contract.update(policy.id, {
            renewal_status: 'notified',
            renewal_last_reminder: today.toISOString().split('T')[0],
            renewal_alert_start_date: alertDate.toISOString().split('T')[0],
          });

          console.log(`[checkPoliciesRenewal] ✅ Alert triggered for policy ${policy.id} (${policy.policy_number})`);
          alerted += 1;
        }
      }
    }

    return Response.json({
      success: true,
      message: `Renewal alerts checked`,
      alerted,
      total: policies.length,
    });
  } catch (error) {
    console.error(`[checkPoliciesRenewal] ERROR: ${error.message}`);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});