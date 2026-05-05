import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * CALCULATE PRICING BENCHMARK
 * 
 * 1. Gruppiere Policies nach: product + insurance_type
 * 2. Berechne Durchschnittsprämie (premium_yearly)
 * 3. Speichere als premium_benchmark
 * 
 * Läuft täglich oder on-demand
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log(`[calculatePricingBenchmark] START`);

    // ─── FETCH ALL ACTIVE POLICIES ───
    const policies = await base44.entities.Contract.filter({ status: 'active' });

    // ─── GROUP BY PRODUCT + INSURANCE_TYPE ───
    const grouped = {};
    for (const policy of policies) {
      if (!policy.premium_yearly) continue;

      const key = `${policy.insurance_type}|${policy.sparte || policy.product || 'default'}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(policy);
    }

    // ─── CALCULATE BENCHMARKS ───
    let updated = 0;
    for (const [key, policyList] of Object.entries(grouped)) {
      const avg = policyList.reduce((sum, p) => sum + (p.premium_yearly || 0), 0) / policyList.length;

      for (const policy of policyList) {
        if (policy.premium_benchmark !== avg) {
          await base44.entities.Contract.update(policy.id, {
            premium_benchmark: Math.round(avg * 100) / 100,
            premium_current: policy.premium_yearly, // Cache aktuellen Wert
          });
          updated += 1;
        }
      }
    }

    console.log(
      `[calculatePricingBenchmark] ✅ Benchmarks calculated for ${Object.keys(grouped).length} product types, ${updated} policies updated`
    );

    return Response.json({
      success: true,
      message: 'Pricing benchmarks calculated',
      product_types: Object.keys(grouped).length,
      updated,
    });
  } catch (error) {
    console.error(`[calculatePricingBenchmark] ERROR: ${error.message}`);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});