import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * UPDATE KPI: Customer Cache Fields
 * 
 * Recalculates and persists:
 * - total_premium (sum of all active policy premiums)
 * 
 * Called by: contract lifecycle changes
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const payload = await req.json();
    const { customer_id } = payload;

    if (!customer_id) {
      return Response.json({ error: 'customer_id erforderlich' }, { status: 400 });
    }

    console.log(`[updateKPICustomer] RECALC customer=${customer_id}`);

    // ─── FETCH ALL ACTIVE POLICIES FOR CUSTOMER ───
    const policies = await base44.entities.Contract.filter({
      customer_id: customer_id,
      status: 'active',
    });

    // ─── CALCULATE TOTAL PREMIUM ───
    let totalPremium = 0;

    for (const policy of policies) {
      totalPremium += policy.premium_yearly || 0;
    }

    console.log(`[updateKPICustomer] total_premium=${totalPremium}`);

    // ─── UPDATE CUSTOMER ───
    await base44.entities.Customer.update(customer_id, {
      total_premium: totalPremium,
    });

    console.log(`[updateKPICustomer] ✅ Customer KPI updated`);

    return Response.json({
      success: true,
      customer_id,
      total_premium: totalPremium,
      active_policies: policies.length,
    });
  } catch (error) {
    console.error(`[updateKPICustomer] ERROR: ${error.message}`);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});