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
    // Scheduled automation — use service role directly (no user context)
    console.log(`[calculatePricingBenchmark] START`);

    // ─── FETCH ALL ACTIVE POLICIES ───
    const policies = await base44.asServiceRole.entities.Contract.filter({ status: 'active' });

    // ─── GROUP BY PRODUCT + INSURANCE_TYPE ───
    const grouped = {};
    for (const policy of policies) {
      if (!policy.premium_yearly || !policy.organization_id) continue;

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
        const rounded = Math.round(avg * 100) / 100;
        if (policy.premium_benchmark !== rounded) {
          // Pass full required fields to avoid validation errors
          await base44.asServiceRole.entities.Contract.update(policy.id, {
            customer_id: policy.customer_id,
            insurer: policy.insurer,
            insurance_type: policy.insurance_type,
            organization_id: policy.organization_id,
            premium_benchmark: rounded,
            premium_current: policy.premium_yearly,
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