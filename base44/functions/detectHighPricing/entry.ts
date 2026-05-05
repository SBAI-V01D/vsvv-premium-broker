import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * DETECT HIGH PRICING
 * 
 * 1. Vergleiche premium_current vs premium_benchmark
 * 2. IF current > benchmark * 1.15 → pricing_status = high
 * 3. Erstelle PricingSuggestion (optional)
 * 
 * Läuft täglich
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log(`[detectHighPricing] START`);

    const policies = await base44.entities.Contract.filter({ status: 'active' });
    const THRESHOLD = 1.15; // 15% über Benchmark = zu teuer

    let highPricingCount = 0;

    for (const policy of policies) {
      if (!policy.premium_benchmark || !policy.premium_current) continue;

      const ratio = policy.premium_current / policy.premium_benchmark;
      const isHighPricing = ratio > THRESHOLD;

      // ─── UPDATE PRICING STATUS ───
      if (isHighPricing && policy.pricing_status !== 'high') {
        await base44.entities.Contract.update(policy.id, {
          pricing_status: 'high',
        });
        highPricingCount += 1;
      } else if (!isHighPricing && policy.pricing_status === 'high') {
        await base44.entities.Contract.update(policy.id, {
          pricing_status: 'normal',
        });
      }
    }

    console.log(`[detectHighPricing] ✅ ${highPricingCount} policies with high pricing detected`);

    return Response.json({
      success: true,
      message: 'High pricing detection completed',
      high_pricing_count: highPricingCount,
    });
  } catch (error) {
    console.error(`[detectHighPricing] ERROR: ${error.message}`);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});